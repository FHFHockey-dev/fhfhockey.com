#!/usr/bin/env python3
"""Local rehearsal of the live, game-scoped FORGE release on PostgreSQL 15 + PostgREST 16.6 (service role, as production).

1. Build a production-like `public`: Supabase roles, Vault/net/cron stand-ins (job 408 present and OFF), the FORGE
   fixture platform with custody and hosted dispatch, and the synthetic seed. The publication migration is NOT
   pre-installed, as in production.
2. Apply the repository's migration files 20261118135813 (sha-checked) and 20261119230000.
3. Approve and arm one game with approve-and-arm.sql.
4. Fire the capture job; deliver its GET to the real route. Record the independent verdict as the verifier would.
5. Fire the publish job; deliver its GET.
6. Repeat both GETs (no second capture or publication), and exercise the stop and verdict fences.

Production flags apply throughout (compute off, serving off, another canary). The fixture data comes from
FORGE_SANDBOX_SOURCE (default the approved candidate f886ddac) via git archive.

Usage (repository root): POSTGREST_BIN=/abs/postgrest python3 -I tasks/artifacts/forge-live-release-2026-11-19/check_live.py
"""
import base64
import hashlib
import hmac
import json
import os
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
SANDBOX = runpy.run_path(str(ROOT / "tasks/artifacts/forge-sandbox-publish-2026-11-19/sandbox_bootstrap.py"))
BOOT = SANDBOX["boot"]()
CORE = BOOT["CORE"]
PUBLICATION = "20261118135813_forge_pregame_publication.sql"
PUBLICATION_SHA = "4a70657ae3e0841f6fac1e66ee608ed866c5152b83a23dd10a83f5b435373f97"
LIVE = "20261119230000_forge_live_pregame_run.sql"
GAME, PLAYER = 2099020991, 8471001
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
    publication = (ROOT / "supabase/migrations" / PUBLICATION).read_text()
    assert hashlib.sha256(publication.encode()).hexdigest() == PUBLICATION_SHA, "publication migration changed"
    directory = Path(tempfile.mkdtemp(dir="/tmp", prefix="flv-"))
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
        run(PG / "pg_ctl", "-D", data, "-l", directory / "log", "-w", "-o", f"-k {directory} -p {port} -c listen_addresses='' -c fsync=off", "start")
        owner = psycopg2.connect(dbname="postgres", user="postgres", host=str(directory), port=port)
        owner.autocommit = True

        def q(sql, args=None):
            owner.cursor().execute(sql, args)

        def rows(sql, args=None):
            cur = owner.cursor()
            cur.execute(sql, args)
            return cur.fetchall()

        psql = lambda *extra: run(PG / "psql", "-X", "-q", "-At", "-h", directory, "-p", port, "-U", "postgres", "-v", "ON_ERROR_STOP=1",
                                  *extra, "postgres").stdout
        start = datetime.now(timezone.utc) + timedelta(minutes=120)
        item = BOOT["world"](start)
        q(CORE["fixture_schema"]().split('CREATE TYPE public."NHL_Position_Code"', 1)[0])
        q("""create role authenticator login noinherit; grant anon, authenticated, service_role to authenticator;
          create schema cron;
          create table cron.job(jobid bigint primary key, jobname text unique, schedule text, command text, active boolean default true,
            username text default current_user);
          create sequence cron.jobid_seq start 1000;
          create table cron.job_run_details(runid bigserial, jobid bigint, status text, return_message text, start_time timestamptz, end_time timestamptz);
          create function cron.schedule(n text, s text, c text) returns bigint language sql as
            $$insert into cron.job(jobid,jobname,schedule,command) values(nextval('cron.jobid_seq'),n,s,c) returning jobid$$;
          create function cron.unschedule(j bigint) returns boolean language sql as $$delete from cron.job where jobid=j returning true$$;
          insert into cron.job(jobid,jobname,schedule,command,active) values (408,'forge-pregame-hosted-dispatch','* * * * *','select 1',false);
          create table net.requests(id bigserial primary key, url text, headers jsonb, timeout_ms int);
          create table net._http_response(id bigint, status_code int, content text, timed_out boolean, error_msg text, created timestamptz default now());
          create function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
            returns bigint language sql as $$insert into net.requests(url,headers,timeout_ms) values(url,headers,timeout_milliseconds) returning id$$;
          insert into vault.decrypted_secrets values ('cron_secret', repeat('c', 48));""")
        # Production lacks the publication objects: install the platform without them, then apply the repository files.
        BOOT["add_seed"].__globals__["HOSTED"] = []      # no hosted witness roles or v2 objects: production has none
        seed = BOOT["add_seed"](item)
        core = BOOT["core_platform"]()
        assert core.count(publication) == 1
        core = core.replace(publication, "")
        defaults = "\n".join(f"alter default privileges in schema public revoke all on {k} from anon, authenticated, service_role;"
                             for k in ("tables", "sequences", "functions"))
        q(defaults + "\n" + BOOT["atomic"](core + "\n" + seed))
        assert not rows("select 1 from pg_proc where proname = 'forge_pregame_publish_v1'")
        psql("-f", ROOT / "supabase/migrations" / PUBLICATION)
        # The verifier package's own migration when it is in the tree; otherwise the local interface stub.
        verifier = ROOT / "tasks/artifacts/forge-witness-verifier-2026-11-19/forge-witness-verifier.sql"
        psql("-f", verifier if verifier.exists() else HERE / "witness-stub.sql")
        psql("-f", ROOT / "supabase/migrations" / LIVE)
        psql("-f", ROOT / "supabase/migrations" / "20261120000100_forge_live_signed_verdict.sql")

        # PostgREST as production serves the service role.
        secret = secrets.token_hex(32)
        now = int(time.time())
        service = jwt(secret, {"role": "service_role", "iat": now, "exp": now + 3600})
        env = {k: v for k, v in ENV.items() if not k.startswith(("PGRST_", "PG"))}
        env.update(PGRST_DB_URI=f"postgresql:///postgres?host={directory}&port={port}&user=authenticator", PGRST_DB_ANON_ROLE="anon",
                   PGRST_DB_SCHEMAS="public,graphql_public" + (",forge_witness_api" if verifier.exists() else ""), PGRST_JWT_SECRET=secret, PGRST_SERVER_HOST="127.0.0.1",
                   PGRST_SERVER_PORT=str(rest_port), PGRST_DB_MAX_ROWS="1000")
        q("create schema if not exists graphql_public; grant usage on schema graphql_public to anon, authenticated, service_role;")
        log = (directory / "postgrest.log").open("w")
        postgrest = subprocess.Popen([str(POSTGREST)], env=env, stdout=log, stderr=log)
        for _ in range(100):
            try:
                with socket.create_connection(("127.0.0.1", rest_port), timeout=.2):
                    break
            except OSError:
                time.sleep(.1)
        time.sleep(0.5)

        label = run("git", "rev-parse", "HEAD", cwd=ROOT).stdout.strip()
        cron_at = (lambda dt: f"{dt.minute} {dt.hour} {dt.day} {dt.month} *")
        psql("-v", f"game={GAME}", "-v", f"player={PLAYER}", "-v", f"release={label}", "-v", "approver=local-rehearsal",
             "-v", f"capture_at={cron_at(start - timedelta(minutes=80))}", "-v", f"publish_at={cron_at(start - timedelta(minutes=58))}",
             "-v", f"close_at={cron_at(start + timedelta(minutes=1))}", "-f", HERE / "approve-and-arm.sql")
        if verifier.exists():   # the verifier package's own scripts: credential (stdin) then target + one-fire cron job
            witness = jwt(secret, {"role": "forge_witness_api", "iat": now, "exp": now + 3 * 3600})
            run(PG / "psql", "-X", "-q", "-At", "-h", directory, "-p", port, "-U", "postgres", "-v", "ON_ERROR_STOP=1",
                "-f", verifier.parent / "set-witness-credential.sql", "postgres", input=witness + "\n")
            psql("-v", f"game={GAME}", "-v", f"schedule={cron_at(start - timedelta(minutes=75))}",
                 "-f", verifier.parent / "arm-witness-verify.sql")
        assert rows("select active from cron.job where jobid = 408")[0][0] is False
        child = {k: ENV[k] for k in ("PATH", "HOME", "TMPDIR", "LC_ALL", "LANG") if k in ENV}
        child.update(NODE_PATH=os.pathsep.join([".", str(WEB / "node_modules")]),
                     TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}',
                     NEXT_PUBLIC_SUPABASE_URL=f"http://127.0.0.1:{rest_port}", NEXT_PUBLIC_SUPABASE_PUBLIC_KEY="unused-local",
                     SUPABASE_SERVICE_ROLE_KEY=service, VERCEL_ENV="production", VERCEL_GIT_COMMIT_SHA=label, CRON_SECRET="c" * 48,
                     FORGE_LIVE_GAME=str(GAME),
                     FORGE_OWNER_DSN=json.dumps({"host": str(directory), "port": port, "user": "postgres", "database": "postgres"}), **PROD_FLAGS)
        result = subprocess.run(["node", "-r", "ts-node/register/transpile-only", str(HERE / "live-check.ts")],
                                cwd=WEB, env=child, capture_output=True, text=True, timeout=600)
        if result.returncode:
            raise SystemExit(result.stdout[-5000:] + result.stderr[-4000:] + "\nPostgREST:\n" + (directory / "postgrest.log").read_text()[-1500:])
        route = json.loads(result.stdout.strip().splitlines()[-1])
        receipt = json.loads(psql("-v", f"game={GAME}", "-f", HERE / "readback.sql"))
        print(json.dumps({"postgres": rows("select version()")[0][0].split(",")[0], "postgrest": run(POSTGREST, "--version").stdout.strip(),
                          "flags": PROD_FLAGS, "publicationMigrationSha256": PUBLICATION_SHA,
                          "liveMigrationSha256": hashlib.sha256((ROOT / "supabase/migrations" / LIVE).read_bytes()).hexdigest(),
                          "verifierMigrationSha256": hashlib.sha256(verifier.read_bytes()).hexdigest() if verifier.exists() else "stub",
                          "route": route, "readback": receipt}, indent=1))
        owner.close()
    finally:
        if postgrest:
            postgrest.terminate()
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "immediate", "-w", "stop"], env=ENV, capture_output=True)
        shutil.rmtree(directory, ignore_errors=True)


if __name__ == "__main__":
    main()
