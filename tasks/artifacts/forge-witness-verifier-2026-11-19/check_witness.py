#!/usr/bin/env python3
"""Disposable local proof of the FORGE independent verifier on PostgreSQL 15 and PostgREST 16.6.

1. Populate a stand-in live project: Supabase-like roles, graphql_public, Vault, net, a cron stand-in with a WGO job,
   and the full FORGE fixture platform with seed in public (the sandbox rehearsal's source). public.games, teams and
   roster_optimizer_team_games get production's RLS (team games FORCE) so the verifier owner cannot read them directly.
2. Apply forge-witness-verifier.sql; a second apply must refuse. Dump everything outside the witness schemas before and
   after: the only differences allowed are the owner's custody read grants.
3. Run the isolation audit, serve PostgREST (public,graphql_public,forge_witness_api; HS256 JWT secret).
4. witness-check.ts: the real FORGE capture as service_role, synthetic single-defect claims, the real verifier route
   as forge_witness_api, duplicates, database re-checks, publisher gate, SQL and HTTP denial matrices.
5. Ops scripts (arm/fire/readback/disarm), then the local reset: the schema-only dump returns to its pre-install state.

Usage, from the repository root:
  POSTGREST_BIN=/abs/path/postgrest python3 -I tasks/artifacts/forge-witness-verifier-2026-11-19/check_witness.py [--out LOCAL-PROOF.json]
"""
import base64
import hashlib
import hmac
import json
import os
import re
import runpy
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WEB = ROOT / "web"
PG = Path(os.environ.get("FORGE_TEST_PG_BIN", "/opt/homebrew/opt/postgresql@15/bin"))
POSTGREST = Path(os.environ["POSTGREST_BIN"])
SANDBOX = runpy.run_path(str(ROOT / "tasks/artifacts/forge-sandbox-publish-2026-11-19/sandbox_bootstrap.py"))
BOOT = SANDBOX["boot"]()
CORE = BOOT["CORE"]
MIGRATION = HERE / "forge-witness-verifier.sql"
WITNESS_SCHEMAS = ["forge_witness", "forge_witness_api", "forge_witness_ops"]
PROD_FLAGS = {"FORGE_PREGAME_CAPTURE_ENABLED": "true", "STARTER_BOARD_CAPTURE_ENABLED": "true", "STARTER_BOARD_COMPUTE_ENABLED": "false",
              "STARTER_BOARD_SERVING_ENABLED": "false", "STARTER_BOARD_SCHEDULER_ENABLED": "true", "STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED": "true",
              "STARTER_BOARD_CHALLENGER_ENABLED": "false", "STARTER_BOARD_CANARY_GAME_IDS": "2026010049", "FORGE_RESERVE_PASS_ENABLED": "true",
              "FORGE_PROJECTION_DAYS_AHEAD": "6"}
ENV = {**os.environ, "LC_ALL": os.environ.get("LC_ALL", "en_US.UTF-8"), "LANG": os.environ.get("LANG", "en_US.UTF-8")}
ENV.pop("GIT_DIR", None)
# Production's RLS on the schedule tables the verifier needs (baseline + 20260829161013).
HOSTILE_RLS = """
alter table public.games enable row level security;
alter table public.teams enable row level security;
alter table public.roster_optimizer_team_games enable row level security;
alter table public.roster_optimizer_team_games force row level security;
do $$ begin
  if not exists (select from pg_policies where schemaname = 'public' and tablename = 'games' and policyname = 'Enable read access for all users') then
    create policy "Enable read access for all users" on public.games for select to anon, authenticated using (true); end if;
  if not exists (select from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'Enable read access for all users') then
    create policy "Enable read access for all users" on public.teams for select using (true); end if;
  if not exists (select from pg_policies where schemaname = 'public' and tablename = 'roster_optimizer_team_games'
      and policyname = 'roster_optimizer_team_games_public_read') then
    create policy roster_optimizer_team_games_public_read on public.roster_optimizer_team_games for select to anon, authenticated using (true); end if;
end $$;
grant select on public.games, public.teams, public.roster_optimizer_team_games to anon, authenticated;
grant all on public.games, public.forge_runs to anon, authenticated, service_role;
"""


def run(*args, check=True, **kw):
    done = subprocess.run([str(a) for a in args], env=ENV, capture_output=True, text=True, **kw)
    if check and done.returncode:
        raise SystemExit(f"{Path(str(args[0])).name} failed ({done.returncode}): {(done.stderr or done.stdout)[-3000:]}")
    return done


def audit_json(text: str) -> dict:
    start = text.index('{"evaluatedAs"')
    try:
        return json.JSONDecoder().raw_decode(text[start:])[0]
    except ValueError as error:
        raise SystemExit(f"audit output did not parse ({error}): {text[start:start + 3000]}")


def jwt(secret: str, claims: dict) -> str:
    b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=")
    body = b".".join([b64(b'{"alg":"HS256","typ":"JWT"}'), b64(json.dumps(claims, separators=(",", ":")).encode())])
    return (body + b"." + b64(hmac.new(secret.encode(), body, hashlib.sha256).digest())).decode()


def main():
    import psycopg2
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else None
    directory = Path(tempfile.mkdtemp(dir="/tmp", prefix="fwv-"))
    data = directory / "data"
    ports = []
    for _ in range(2):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            ports.append(probe.getsockname()[1])
    port, rest_port = ports
    postgrest = None
    step = "init"
    try:
        run(PG / "initdb", "-D", data, "-U", "postgres", "--no-locale", "--encoding=UTF8", "-A", "trust", "--no-sync")
        run(PG / "pg_ctl", "-D", data, "-l", directory / "log", "-w", "-o",
            f"-k {directory} -p {port} -c listen_addresses='' -c fsync=off", "start")
        owner = psycopg2.connect(dbname="postgres", user="postgres", host=str(directory), port=port)
        owner.autocommit = True

        def q(sql, args=None):
            owner.cursor().execute(sql, args)

        def rows(sql, args=None):
            cur = owner.cursor()
            cur.execute(sql, args)
            return cur.fetchall()

        psql = lambda *extra, check=True: run(PG / "psql", "-X", "-q", "-At", "-h", directory, "-p", port, "-U", "postgres", "-v", "ON_ERROR_STOP=1",
                                              *extra, "postgres", check=check)

        # 1. Stand-in live project (same construction as the sandbox rehearsal, without its sandbox).
        step = "stand-in"
        start = datetime.now(timezone.utc) + timedelta(minutes=120)
        item = BOOT["world"](start)
        BOOT["add_seed"].__globals__["HOSTED"] = []   # no hosted dispatch or earlier witness design
        q(CORE["fixture_schema"]().split('CREATE TYPE public."NHL_Position_Code"', 1)[0])
        q("""create role authenticator login noinherit; grant anon, authenticated, service_role to authenticator;
          create schema graphql_public; grant usage on schema graphql_public to anon, authenticated, service_role;
          grant usage on schema public to anon, authenticated, service_role;
          create schema cron;
          create table cron.job(jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true,
            username text default current_user);
          create function cron.schedule(n text, s text, c text) returns bigint language sql as
            $$insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid$$;
          create function cron.unschedule(j bigint) returns boolean language sql as $$delete from cron.job where jobid=j returning true$$;
          create table net.http_request_queue(id bigserial primary key, url text, headers jsonb, timeout_ms int);
          create table net._http_response(id bigint, status_code int, content text, timed_out boolean, error_msg text, created timestamptz default now());
          create function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
            returns bigint language sql as $$insert into net.http_request_queue(url,headers,timeout_ms) values(url,headers,timeout_milliseconds) returning id$$;
          insert into vault.decrypted_secrets values ('cron_secret', repeat('c', 48));
          select cron.schedule('update-all-wgo-skaters', '30 7 * * *', 'select 1');
          -- Production facts (read Nov 19): service_role has no SELECT on pg_net's queue/response and no USAGE on cron,
          -- but CAN read vault.decrypted_secrets.
          revoke all on schema cron from public, anon, authenticated, service_role;
          revoke all on all tables in schema cron from public, anon, authenticated, service_role;
          revoke all on net.http_request_queue, net._http_response from public, anon, authenticated, service_role;
          grant usage on schema vault to service_role; grant select on vault.decrypted_secrets to service_role;""")
        q(BOOT["application_sql"](BOOT["add_seed"](item)))
        q(HOSTILE_RLS)
        request = item["request"]
        assert rows("select rolbypassrls from pg_roles where rolname = 'service_role'")[0][0] is True

        def dump(schema_only=False):
            # pg_dump's per-run \restrict nonce is not content; strip it like the sandbox harness.
            return re.sub(r"(?m)^\\(un)?restrict \S+$", "", run(PG / "pg_dump", "-h", directory, "-p", port, "-U", "postgres", "--no-owner", *(["-s"] if schema_only else []),
                       *[f"--exclude-schema={s}" for s in WITNESS_SCHEMAS], "postgres").stdout)

        def roles_and_members():
            return set(rows("""select r.rolname, coalesce(string_agg(g.rolname, ',' order by g.rolname), '') from pg_roles r
              left join pg_auth_members m on m.member = r.oid left join pg_roles g on g.oid = m.roleid
              where r.rolname !~ '^pg_' group by r.rolname"""))

        roles_before, dump_before, schema_before = roles_and_members(), dump(), dump(True)
        audit_before = audit_json(psql("-f", HERE / "prod-isolation-witness.sql").stdout)

        # 2. Install; a second install refuses; outside the witness schemas only the owner's custody read grants change.
        step = "install"
        psql("-f", MIGRATION)
        again = psql("-f", MIGRATION, check=False)
        assert again.returncode != 0 and "forge_witness already installed" in again.stderr, again.stderr[-500:]
        dump_installed = dump()
        added = [l for l in dump_installed.splitlines() if l not in set(dump_before.splitlines())]
        removed = [l for l in dump_before.splitlines() if l not in set(dump_installed.splitlines())]
        added = [l for l in added if l.strip() and not l.startswith("--") and not re.match(r"^\\(un)?restrict ", l)]
        removed = [l for l in removed if l.strip() and not l.startswith("--") and not re.match(r"^\\(un)?restrict ", l)]
        expected_added = sorted(["GRANT USAGE ON SCHEMA forge_pregame_capture TO forge_witness_owner;"] +
                                [f"GRANT SELECT ON TABLE forge_pregame_capture.{t} TO forge_witness_owner;"
                                 for t in ("artifacts", "claims", "outcomes", "save_fences", "witnesses")])
        assert sorted(added) == expected_added and removed == [], json.dumps({"added": added, "removed": removed})[:3000]
        roles_after = roles_and_members()
        new_roles = sorted(r for r, _ in roles_after - roles_before if r not in {x for x, _ in roles_before})
        changed = sorted((r, m) for r, m in roles_after - roles_before if r in {x for x, _ in roles_before})
        assert new_roles == ["forge_witness_api", "forge_witness_owner"], new_roles
        assert [r for r, _ in changed] == ["authenticator"] and "forge_witness_api" in dict(changed)["authenticator"].split(","), changed
        assert dict(roles_after)["forge_witness_owner"] == "" and not rows(
            "select 1 from pg_auth_members m join pg_roles g on g.oid = m.roleid where g.rolname = 'forge_witness_owner'"), "owner has members"
        attrs = rows("select rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreaterole from pg_roles where rolname like 'forge_witness%' order by 1")
        assert all(not login and not sup and not bypass and not cr for _, login, sup, bypass, cr in attrs), attrs
        audit = audit_json(psql("-f", HERE / "prod-isolation-witness.sql").stdout)
        assert not audit["verdict"].startswith("unsafe"), json.dumps(audit, indent=1)[:4000]
        assert audit["receiptWriters"] == [] and audit["ownerMembers"] == [] and audit["writableRelations"] == [] \
            and audit["writerReachableDynamicDefiners"] == [] and len([t for t in audit["receiptTriggers"] if t["tgenabled"] == "A"]) == 4, audit
        assert sorted((g["object"], tuple(g["privileges"])) for g in audit["serviceRoleOnWitnessObjects"]) == [
            ("function forge_witness.publication_gate_v1", ("EXECUTE",)), ("function forge_witness.require_accepted_v1", ("EXECUTE",)),
            ("schema forge_witness", ("USAGE",))], audit["serviceRoleOnWitnessObjects"]
        reach = {x["object"]: x["service_role_select"] for x in audit["writerSecretReach"]}
        assert reach["table vault.decrypted_secrets"] is True and reach["schema cron usage"] is False and all(
            v is not True for k, v in reach.items() if k.startswith("table ") and k not in ("table vault.decrypted_secrets", "table forge_witness_ops.fires")), reach
        assert sorted(o["relation"] for o in audit["ownerOutside"]) == [f"forge_pregame_capture.{t}" for t in
                                                                        ("artifacts", "claims", "outcomes", "save_fences", "witnesses")], audit["ownerOutside"]

        # 3. PostgREST as Supabase serves it.
        step = "postgrest"
        secret = secrets.token_hex(32)
        now = int(time.time())
        tokens = {"anon": jwt(secret, {"role": "anon", "iat": now, "exp": now + 3600}),
                  "authenticated": jwt(secret, {"role": "authenticated", "sub": "00000000-0000-4000-8000-00000000000a", "iat": now, "exp": now + 3600}),
                  "service_role": jwt(secret, {"role": "service_role", "iat": now, "exp": now + 3600}),
                  "witness": jwt(secret, {"role": "forge_witness_api", "iat": now, "exp": now + 11 * 3600})}
        env = {k: v for k, v in ENV.items() if not k.startswith(("PGRST_", "PG"))}
        env.update(PGRST_DB_URI=f"postgresql:///postgres?host={directory}&port={port}&user=authenticator", PGRST_DB_ANON_ROLE="anon",
                   PGRST_DB_SCHEMAS="public,graphql_public,forge_witness_api", PGRST_JWT_SECRET=secret,
                   PGRST_SERVER_HOST="127.0.0.1", PGRST_SERVER_PORT=str(rest_port), PGRST_DB_MAX_ROWS="1000")
        log = (directory / "postgrest.log").open("w")
        postgrest = subprocess.Popen([str(POSTGREST)], env=env, stdout=log, stderr=log)
        for _ in range(100):
            try:
                with socket.create_connection(("127.0.0.1", rest_port), timeout=.2):
                    break
            except OSError:
                time.sleep(.1)
        else:
            raise SystemExit("PostgREST did not start")
        time.sleep(0.5)

        # 4. Writer capture, then the verifier route and the matrices.
        step = "route"
        label = run("git", "rev-parse", "HEAD", cwd=ROOT).stdout.strip()
        child = {k: ENV[k] for k in ("PATH", "HOME", "TMPDIR", "LC_ALL", "LANG") if k in ENV}
        child.update(NODE_PATH=os.pathsep.join([".", str(WEB / "node_modules")]),
                     TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}',
                     NEXT_PUBLIC_SUPABASE_URL=f"http://127.0.0.1:{rest_port}", NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=tokens["anon"],
                     FORGE_WITNESS_API_TOKEN=tokens["witness"], FORGE_TEST_TOKENS=json.dumps(tokens),
                     VERCEL_ENV="production", VERCEL_GIT_COMMIT_SHA=label, CRON_SECRET=secrets.token_hex(24),
                     FORGE_REHEARSAL_REQUEST=json.dumps(request),
                     FORGE_WITNESS_OWNER_DSN=json.dumps({"host": str(directory), "port": port, "user": "postgres", "database": "postgres"}),
                     **PROD_FLAGS)
        result = subprocess.run(["node", "-r", "ts-node/register/transpile-only", str(HERE / "witness-check.ts")],
                                cwd=WEB, env=child, capture_output=True, text=True, timeout=400)
        if result.returncode:
            raise SystemExit(result.stdout[-6000:] + result.stderr[-6000:] + "\nPostgREST log:\n" + (directory / "postgrest.log").read_text()[-2000:])
        route = json.loads(result.stdout.strip().splitlines()[-1])
        audit_after = audit_json(psql("-f", HERE / "prod-isolation-witness.sql").stdout)
        assert audit_after["verdict"] == audit["verdict"] and audit_after["receiptWriters"] == [], audit_after

        # 5. Ops scripts: arm (one more game), two fires then self-unschedule, readback, disarm, re-arm refusals.
        step = "ops"
        # Credential: set from stdin only; output carries claims, never the token.
        witness_token = tokens["witness"]
        setc = run(PG / "psql", "-X", "-q", "-At", "-h", directory, "-p", port, "-U", "postgres", "-f", HERE / "set-witness-credential.sql",
                   "postgres", input=witness_token + "\n")
        assert witness_token not in setc.stdout + setc.stderr and '"forge_witness_api"' in setc.stdout, setc.stdout[-300:]
        assert rows("select pg_has_role('authenticator', 'forge_witness_api', 'MEMBER')")[0][0] is True
        secret_denials = {}

        def denied_as(role, label, sql):
            cur = owner.cursor()
            try:
                cur.execute("begin")
                cur.execute(f"set local role {role}")
                cur.execute(sql)
                secret_denials[f"{role}: {label}"] = "ALLOWED"
            except psycopg2.Error as error:
                secret_denials[f"{role}: {label}"] = f"{error.pgcode} {str(error).splitlines()[0][:70]}"
            finally:
                owner.rollback() if not owner.autocommit else cur.execute("rollback")
        ops_game = 2099039999
        verdicts_before_ops = rows("select count(*) from forge_witness.verdicts")[0][0]
        unreadable = psql("-v", "game=2099039998", "-v", "schedule=59 23 31 12 *", "-f", HERE / "arm-witness-verify.sql", check=False)
        assert unreadable.returncode != 0 and "witness_schedule_unavailable" in unreadable.stderr, unreadable.stderr[-400:]
        q(f"""do $$ declare cols text; begin
          insert into public.games select (jsonb_populate_record(g, jsonb_build_object('id', {ops_game}))).* from public.games g where g.id = 2099020991;
          select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
            where table_schema = 'public' and table_name = 'roster_optimizer_team_games' and column_name not in ('id', 'source_game_id', 'game_key')
              and is_generated = 'NEVER' and is_identity = 'NO';
          execute format('insert into public.roster_optimizer_team_games (id, source_game_id, game_key, %s)
            select (select max(id) from public.roster_optimizer_team_games) + row_number() over (), {ops_game}, game_key || ''-ops'', %s
            from public.roster_optimizer_team_games where source_game_id = 2099020991', cols, cols);
        end $$""")
        psql("-v", f"game={ops_game}", "-v", "schedule=59 23 31 12 *", "-v", "max_fires=2", "-f", HERE / "arm-witness-verify.sql")
        command = rows("select command from cron.job where jobname = %s", (f"forge-witness-verify-{ops_game}",))[0][0]
        assert "cron_secret" not in command and "Bearer" not in command and "?" not in command, command
        for role in ("service_role", "anon", "authenticated", "forge_witness_api", "authenticator"):
            for label, sql in [("read credentials", "select token from forge_witness.credentials"),
                               ("read credential via definer", "select forge_witness.credential_v1()"),
                               ("set credential", "select forge_witness.set_credential_v1('a.b.c')"),
                               ("revoke credential", "select forge_witness.revoke_credential_v1()"),
                               ("read cron.job", "select command from cron.job"),
                               ("read pg_net queue", "select headers from net.http_request_queue"),
                               ("read pg_net responses", "select content from net._http_response"),
                               ("read fires", "select * from forge_witness_ops.fires"),
                               ("call fire", f"select forge_witness_ops.fire_v1({ops_game}, 1)")]:
                denied_as(role, label, sql)
        allowed = {k: v for k, v in secret_denials.items() if not v.startswith("42501")}
        assert not allowed, allowed
        fired = [rows(command)[0][0] for _ in range(3)]
        assert fired[0].startswith("fired") and fired[1].startswith("fired") and fired[2] == "fires_spent", fired
        assert not rows("select 1 from cron.job where jobname like 'forge-witness-verify-%'")
        req = rows("select url, headers->>'Authorization', timeout_ms, headers->>'x-forge-witness-token' = %s from net.http_request_queue order by id desc limit 1",
                   (witness_token,))[0]
        assert req == ("https://fhfhockey.com/api/v1/db/forge-witness-verify", "Bearer " + "c" * 48, 60000, True), req[0]
        assert not rows("select 1 from cron.job where command like %s", (f"%{witness_token[-20:]}%",))
        q("insert into net._http_response(id,status_code,content,timed_out) select request_id, 200, %s, false from forge_witness_ops.fires",
          (json.dumps({"status": "ok", "results": [{"gameId": ops_game, "status": "claim_missing"}]}),))
        readback = json.loads(psql("-v", f"game={ops_game}", "-f", HERE / "readback-witness-verify.sql").stdout)
        assert len(readback["fires"]) == 2 and readback["registeredJobs"] == 0 and readback["target"]["gameId"] == ops_game, readback
        real_readback = json.loads(psql("-v", "game=2099020991", "-f", HERE / "readback-witness-verify.sql").stdout)
        assert real_readback["gate"]["accepted"] is True, real_readback
        rearm = psql("-v", "game=2099020991", "-v", "schedule=59 23 31 12 *", "-f", HERE / "arm-witness-verify.sql", check=False)
        assert rearm.returncode != 0 and "witness_target_has_verdict" in rearm.stderr, rearm.stderr[-400:]
        assert witness_token not in json.dumps(readback) + json.dumps(real_readback)
        # Revoke: the credential is gone and the old token can no longer act as forge_witness_api through the Data API.
        import urllib.request
        import urllib.error

        def pending_with(token):
            request_ = urllib.request.Request(f"http://127.0.0.1:{rest_port}/rpc/pending_v1", data=b"{}", method="POST",
                                              headers={"Content-Type": "application/json", "Content-Profile": "forge_witness_api",
                                                       "apikey": tokens["anon"], "Authorization": f"Bearer {token}"})
            try:
                return urllib.request.urlopen(request_, timeout=10).status
            except urllib.error.HTTPError as error:
                return error.code
        before_revoke = pending_with(witness_token)
        revoked = json.loads(psql("-f", HERE / "revoke-witness-credential.sql").stdout.strip().splitlines()[-1])
        after_revoke = pending_with(witness_token)
        assert before_revoke == 200 and 400 <= after_revoke < 500, (before_revoke, after_revoke)
        assert revoked == {"credentialPresent": False, "authenticatorMayUseRole": False}, revoked
        no_credential = rows("select forge_witness_ops.fire_v1(2099039997, 1)")[0][0]
        assert no_credential == "credential_missing", no_credential
        unarmed = psql("-v", "game=2099039999", "-v", "schedule=59 23 31 12 *", "-f", HERE / "arm-witness-verify.sql", check=False)
        assert unarmed.returncode != 0 and "witness_arm_preflight_failed" in unarmed.stderr, unarmed.stderr[-300:]
        revoke_proof = {"pendingWithTokenBeforeRevoke": before_revoke, "pendingWithSameTokenAfterRevoke": after_revoke, "revoked": revoked,
                        "fireWithoutCredential": no_credential, "armWithoutCredentialRefused": True}
        psql("-f", HERE / "disarm-witness-verify.sql")
        assert rows("select count(*) from cron.job")[0][0] == 1
        assert rows("select count(*) from forge_witness.verdicts")[0][0] == verdicts_before_ops

        # 6. Local reset: the schema-only dump outside returns exactly to its pre-install state, roles too.
        step = "reset"
        psql("-f", HERE / "reset-witness-local.sql")
        assert roles_and_members() == roles_before, "reset left role changes"
        schema_after = dump(True)
        if schema_after != schema_before:
            import difflib
            raise SystemExit("schema outside the witness schemas differs after reset:\n" + "\n".join(
                difflib.unified_diff(schema_before.splitlines(), schema_after.splitlines(), lineterm="", n=1))[:4000])
        assert not rows("select 1 from pg_namespace where nspname like 'forge_witness%'")
        report = {"postgres": rows("select version()")[0][0].split(",")[0], "postgrest": run(POSTGREST, "--version").stdout.strip(),
                  "migration": {"file": MIGRATION.name, "sha256": hashlib.sha256(MIGRATION.read_bytes()).hexdigest(),
                                "secondApplyRefused": True, "outsideDumpAdded": added, "outsideDumpRemoved": removed,
                                "newRoles": new_roles, "changedMemberships": changed, "roleAttributes": attrs},
                  "auditBeforeInstall": audit_before, "auditInstalled": audit, "auditAfterRuns": {"verdict": audit_after["verdict"]},
                  "route": route,
                  "ops": {"fired": fired, "request": {"url": req[0], "timeoutMs": req[2]}, "readback": readback,
                          "realGameGate": real_readback["gate"], "rearmRefused": True, "unreadableScheduleArmRefused": True,
                          "credentialSetFromStdin": True, "secretDenials": secret_denials, "revoke": revoke_proof},
                  "reset": "witness schemas and roles removed; schema-only dump outside identical to before install; WGO stand-in job intact"}
        text = json.dumps(report, indent=1, default=str)
        if out:
            out.write_text(text + "\n")
        print(text)
        owner.close()
    except BaseException as error:
        print(f"FAILED at step {step}: {error}", file=sys.stderr)
        raise
    finally:
        if postgrest:
            postgrest.terminate()
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "immediate", "-w", "stop"], env=ENV, capture_output=True)
        shutil.rmtree(directory, ignore_errors=True)


if __name__ == "__main__":
    main()
