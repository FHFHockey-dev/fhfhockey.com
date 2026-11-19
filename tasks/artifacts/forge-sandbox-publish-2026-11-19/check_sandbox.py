#!/usr/bin/env python3
"""Disposable local proof of the narrow PostgREST sandbox interface on PostgreSQL 15 and PostgREST 16.6.

1. Populate a stand-in live project: Supabase-like roles (anon, authenticated, service_role, authenticator), graphql_public,
   Vault, net, a cron stand-in with a WGO job, and the full FORGE fixture platform with seed in public. Sample public
   tables get Supabase's default client grants, so denials are meaningful.
2. Dump everything outside the sandbox schemas.
3. Apply the generated bootstrap and the isolation audits.
4. Serve PostgREST (db-schemas public,graphql_public,forge_sandbox_api; HS256 JWT secret).
5. Run the real route twice through it with a pre-minted forge_sandbox_api token and production's flags.
6. Run the denial matrix over HTTP.
7. Dump again and check that only the two sandbox roles were added.
8. Exercise arm/fire/readback/disarm/reset on a fresh bootstrap.

Usage, from the repository root:
  POSTGREST_BIN=/abs/path/postgrest python3 -I tasks/artifacts/forge-sandbox-publish-2026-11-19/check_sandbox.py
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
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WEB = ROOT / "web"
PG = Path(os.environ.get("FORGE_TEST_PG_BIN", "/opt/homebrew/opt/postgresql@15/bin"))
POSTGREST = Path(os.environ["POSTGREST_BIN"])
SANDBOX = runpy.run_path(str(HERE / "sandbox_bootstrap.py"))
BOOT = SANDBOX["boot"]()
CORE = BOOT["CORE"]
SANDBOX_SCHEMAS = ["forge_sandbox", "forge_sandbox_capture", "forge_sandbox_internal", "forge_sandbox_exec", "forge_sandbox_api"]
PROD_FLAGS = {"FORGE_PREGAME_CAPTURE_ENABLED": "true", "STARTER_BOARD_CAPTURE_ENABLED": "true", "STARTER_BOARD_COMPUTE_ENABLED": "false",
              "STARTER_BOARD_SERVING_ENABLED": "false", "STARTER_BOARD_SCHEDULER_ENABLED": "true", "STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED": "true",
              "STARTER_BOARD_CHALLENGER_ENABLED": "false", "STARTER_BOARD_CANARY_GAME_IDS": "2026010049", "FORGE_RESERVE_PASS_ENABLED": "true",
              "FORGE_PROJECTION_DAYS_AHEAD": "6"}
ENV = {**os.environ, "LC_ALL": os.environ.get("LC_ALL", "en_US.UTF-8"), "LANG": os.environ.get("LANG", "en_US.UTF-8")}


def run(*args, **kw):
    done = subprocess.run([str(a) for a in args], env=ENV, capture_output=True, text=True, **kw)
    if done.returncode:
        raise SystemExit(f"{Path(str(args[0])).name} failed ({done.returncode}): {(done.stderr or done.stdout)[-3000:]}")
    return done


def jwt(secret: str, claims: dict) -> str:
    b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=")
    body = b".".join([b64(b'{"alg":"HS256","typ":"JWT"}'), b64(json.dumps(claims, separators=(",", ":")).encode())])
    return (body + b"." + b64(hmac.new(secret.encode(), body, hashlib.sha256).digest())).decode()


def main():
    import psycopg2
    directory = Path(tempfile.mkdtemp(dir="/tmp", prefix="fsa-"))
    data = directory / "data"
    ports = []
    for _ in range(2):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            ports.append(probe.getsockname()[1])
    port, rest_port = ports
    postgrest = None
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

        # 1. Stand-in live project.
        start = datetime.now(timezone.utc) + timedelta(minutes=120)
        item = BOOT["world"](start)
        q(CORE["fixture_schema"]().split('CREATE TYPE public."NHL_Position_Code"', 1)[0])
        q("""create role authenticator login noinherit; grant anon, authenticated, service_role to authenticator;
          create schema graphql_public; grant usage on schema graphql_public to anon, authenticated, service_role;
          grant usage on schema public to anon, authenticated, service_role;
          create schema cron;
          create table cron.job(jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true,
            username text default current_user);
          create table cron.job_run_details(runid bigserial, jobid bigint, status text, return_message text, start_time timestamptz, end_time timestamptz);
          create function cron.schedule(n text, s text, c text) returns bigint language sql as
            $$insert into cron.job(jobname,schedule,command) values(n,s,c) returning jobid$$;
          create function cron.unschedule(j bigint) returns boolean language sql as $$delete from cron.job where jobid=j returning true$$;
          create table net.requests(id bigserial primary key, url text, headers jsonb, timeout_ms int);
          create table net._http_response(id bigint, status_code int, content text, timed_out boolean, error_msg text, created timestamptz default now());
          create function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
            returns bigint language sql as $$insert into net.requests(url,headers,timeout_ms) values(url,headers,timeout_milliseconds) returning id$$;
          insert into vault.decrypted_secrets values ('cron_secret', repeat('c', 48));
          select cron.schedule('update-all-wgo-skaters', '30 7 * * *', 'select 1');""")
        q(BOOT["application_sql"](BOOT["add_seed"](item)))
        # Supabase's default client grants on two sample live tables, so the denial checks below are meaningful.
        q("grant all on public.games, public.forge_runs to anon, authenticated, service_role;")
        live_games = rows("select count(*) from public.games")[0][0]

        def outside_dump():
            dump = run(PG / "pg_dump", "-h", directory, "-p", port, "-U", "postgres", "--no-owner",
                       *[f"--exclude-schema={s}" for s in SANDBOX_SCHEMAS], "postgres").stdout
            grant = ("\n--\n-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: -\n--\n\n"
                     "GRANT USAGE ON SCHEMA extensions TO forge_sandbox_owner;\n\n")
            granted = grant in dump
            dump = re.sub(r"(?m)^\\(un)?restrict \S+$", "", dump.replace(grant, ""))
            (directory / f"outside-{len(dumps)}.sql").write_text(dump)
            dumps.append(granted)
            return hashlib.sha256(dump.encode()).hexdigest(), len(dump)

        def roles_and_members():
            return set(rows("""select r.rolname, coalesce(string_agg(g.rolname, ',' order by g.rolname), '') from pg_roles r
              left join pg_auth_members m on m.member = r.oid left join pg_roles g on g.oid = m.roleid
              where r.rolname !~ '^pg_' group by r.rolname"""))

        dumps = []
        roles_before, (dump_before, dump_size) = roles_and_members(), outside_dump()

        # 2. Bootstrap and audits.
        text, request = SANDBOX["bootstrap"](start)
        (directory / "sandbox.sql").write_text(text)
        psql = lambda *extra: run(PG / "psql", "-X", "-q", "-At", "-h", directory, "-p", port, "-U", "postgres", "-v", "ON_ERROR_STOP=1",
                                  *extra, "postgres").stdout
        psql("-f", directory / "sandbox.sql")
        verdict = json.loads(psql("-f", HERE / "isolation-check.sql").strip().splitlines()[-1])
        assert verdict["ok"] is True, json.dumps(verdict, indent=1)
        prod_audit = json.loads(psql("-f", HERE / "prod-isolation-api.sql").strip().splitlines()[-1])

        # 3. PostgREST as Supabase serves it: authenticator, anon fallback, three exposed schemas, HS256 secret.
        secret = secrets.token_hex(32)
        now = int(time.time())
        tokens = {"anon": jwt(secret, {"role": "anon", "iat": now, "exp": now + 3600}),
                  "authenticated": jwt(secret, {"role": "authenticated", "sub": "00000000-0000-4000-8000-00000000000a", "iat": now, "exp": now + 3600}),
                  "sandbox": jwt(secret, {"role": "forge_sandbox_api", "iat": now, "exp": now + 11 * 3600})}
        env = {k: v for k, v in ENV.items() if not k.startswith(("PGRST_", "PG"))}
        env.update(PGRST_DB_URI=f"postgresql:///postgres?host={directory}&port={port}&user=authenticator", PGRST_DB_ANON_ROLE="anon",
                   PGRST_DB_SCHEMAS="public,graphql_public,forge_sandbox_api", PGRST_JWT_SECRET=secret,
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

        # 4. The real route and the denial matrix.
        label = run("git", "rev-parse", "HEAD", cwd=ROOT).stdout.strip()
        child = {k: ENV[k] for k in ("PATH", "HOME", "TMPDIR", "LC_ALL", "LANG") if k in ENV}
        child.update(NODE_PATH=os.pathsep.join([".", str(WEB / "node_modules")]),
                     TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}',
                     NEXT_PUBLIC_SUPABASE_URL=f"http://127.0.0.1:{rest_port}", NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=tokens["anon"],
                     FORGE_SANDBOX_API_TOKEN=tokens["sandbox"], FORGE_TEST_TOKENS=json.dumps(tokens),
                     VERCEL_ENV="production", VERCEL_GIT_COMMIT_SHA=label, CRON_SECRET=secrets.token_hex(24),
                     FORGE_REHEARSAL_REQUEST=json.dumps(request),
                     FORGE_SANDBOX_OWNER_DSN=json.dumps({"host": str(directory), "port": port, "user": "postgres", "database": "postgres"}),
                     **PROD_FLAGS)
        result = subprocess.run(["node", "-r", "ts-node/register/transpile-only", str(HERE / "sandbox-get-check.ts")],
                                cwd=WEB, env=child, capture_output=True, text=True, timeout=300)
        if result.returncode:
            raise SystemExit(result.stdout[-4000:] + result.stderr[-4000:] + "\nPostgREST log:\n" + (directory / "postgrest.log").read_text()[-2000:])
        route = json.loads(result.stdout.strip().splitlines()[-1])
        first = route["first"]
        # Expected: one GET captures, publishes once and reads that revision back through both readers.
        assert first["httpStatus"] == 200 and first["status"] == "succeeded" and first["receipt"]["custody"] == "qualified" \
            and first["receipt"]["witness"] == "qualified" and first["receipt"]["publicationCount"] == 1 \
            and first["readers"]["daily"]["legalSlot"] == "C#1" and first["readers"]["detailed"]["reason"] == "missing_participation" \
            and first["readers"]["detailed"]["revisionId"] == first["revisionId"], json.dumps({"routeErrors": route.get("routeErrors"),
                "stages": first.get("stages"), "reason": first.get("reason"), "readers": first.get("readers")})[:4000]
        assert route["duplicate"]["rowsAfter"]["publications"] == 1

        # 5. Nothing outside the sandbox changed; the only new roles are the two sandbox roles, and authenticator's only
        #    new membership is forge_sandbox_api.
        dump_after, _ = outside_dump()
        if dump_after != dump_before:
            diff = subprocess.run(["diff", str(directory / "outside-0.sql"), str(directory / "outside-1.sql")], capture_output=True, text=True).stdout
            raise SystemExit("objects or rows outside the sandbox changed:\n" + diff[:4000])
        assert dumps == [False, True], dumps
        after = roles_and_members()
        added = after - roles_before
        before_names = {r for r, _ in roles_before}
        new_roles = sorted(r for r, _ in added if r not in before_names)
        changed = sorted((r, m) for r, m in added if r in before_names)
        assert new_roles == ["forge_sandbox_api", "forge_sandbox_owner"], added
        assert [r for r, _ in changed] == ["authenticator", "postgres"] and "forge_sandbox_api" in dict(changed)["authenticator"].split(","), changed
        assert rows("select count(*) from public.games")[0][0] == live_games

        # 6. Ops scripts on a fresh bootstrap (the arm preflight refuses a sandbox that already ran).
        psql("-f", HERE / "reset-sandbox.sql")
        assert roles_and_members() == roles_before, "reset left role changes"
        psql("-f", directory / "sandbox.sql")
        psql("-v", "schedule=59 23 31 12 *", "-f", HERE / "arm-sandbox-get.sql")
        command = rows("select command from cron.job where jobname='forge-sandbox-get-2099020991'")[0][0]
        assert "cron_secret" not in command and "Bearer" not in command and "?" not in command, command
        fired = [rows(command)[0][0] for _ in range(2)]
        assert fired[0].startswith("fired") and fired[1] == "already_fired", fired
        req = rows("select url, headers->>'Authorization', timeout_ms from net.requests order by id desc limit 1")[0]
        assert req == ("https://fhfhockey.com/api/v1/db/forge-sandbox-run", "Bearer " + "c" * 48, 240000), req[0]
        q("insert into net._http_response(id,status_code,content,timed_out) select request_id,200,%s,false from forge_sandbox_capture.sandbox_get_requests",
          (json.dumps(first["body"]),))
        readback = json.loads(psql("-f", HERE / "readback-sandbox-get.sql"))
        assert readback["httpResponse"]["statusCode"] == 200 and readback["registeredSandboxJobs"] == 0 and readback["otherCronJobs"] == 1, readback
        psql("-f", HERE / "disarm-sandbox-get.sql")
        psql("-f", HERE / "reset-sandbox.sql")
        assert not rows("select 1 from pg_namespace where nspname like 'forge_sandbox%' union all select 1 from pg_roles where rolname like 'forge_sandbox%'")
        assert rows("select count(*) from cron.job")[0][0] == 1
        print(json.dumps({"postgres": rows("select version()")[0][0].split(",")[0], "postgrest": run(POSTGREST, "--version").stdout.strip(),
                          "flags": PROD_FLAGS, "liveGames": live_games, "outsideDumpBytes": dump_size,
                          "outsideDumpSha256Before": dump_before, "outsideDumpSha256AfterRuns": dump_after,
                          "newRoles": new_roles, "changedMemberships": changed, "isolation": verdict, "prodAuditLocal": prod_audit,
                          "route": route, "cron": {"fired": fired, "request": {"url": req[0], "timeoutMs": req[2]}},
                          "reset": "schemas, roles and authenticator membership removed; WGO stand-in job intact"}, indent=1))
        owner.close()
    finally:
        if postgrest:
            postgrest.terminate()
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "immediate", "-w", "stop"], env=ENV, capture_output=True)
        shutil.rmtree(directory, ignore_errors=True)


if __name__ == "__main__":
    main()
