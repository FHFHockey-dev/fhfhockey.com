#!/usr/bin/env python3
"""Disposable local proof of Track A (signed verdicts) against a restore of the production schema WITH grants.

1. A PostgreSQL 15 cluster whose bootstrap superuser is supabase_admin, so the restored `postgres` role is the same
   non-superuser (CREATEROLE, BYPASSRLS) it is in production. Restore prod-roles + prod-schema-grants (Supabase-managed
   schemas and extensions absent locally fail to restore; the count is reported). forge-witness-verifier.sql
   (9673316c) is already in that dump.
2. Apply forge-witness-signed.sql AS postgres; a second apply must refuse.
3. PostgREST 16.6 (public, forge_witness_api; HS256 secret).
4. signed-check.ts: the committed Edge bundle as the witness, then the writer's attacks, the gate and the audit.

Usage, from the repository root:
  POSTGREST_BIN=/abs/postgrest PROD_SCHEMA_DIR=/abs/prod-schema python3 -I tasks/artifacts/forge-witness-signed-2026-11-19/check_signed.py [--out FILE]
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WEB = ROOT / "web"
PG = Path(os.environ.get("FORGE_TEST_PG_BIN", "/opt/homebrew/opt/postgresql@15/bin"))
POSTGREST = Path(os.environ["POSTGREST_BIN"])
DUMPS = Path(os.environ["PROD_SCHEMA_DIR"])
ENV = {**os.environ, "LC_ALL": os.environ.get("LC_ALL", "en_US.UTF-8"), "LANG": os.environ.get("LANG", "en_US.UTF-8")}
ENV.pop("GIT_DIR", None)


def run(*args, check=True, **kw):
    done = subprocess.run([str(a) for a in args], env=ENV, capture_output=True, text=True, **kw)
    if check and done.returncode:
        raise SystemExit(f"{Path(str(args[0])).name} failed ({done.returncode}): {(done.stderr or done.stdout)[-3000:]}")
    return done


def jwt(secret, claims):
    b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=")
    body = b".".join([b64(b'{"alg":"HS256","typ":"JWT"}'), b64(json.dumps(claims, separators=(",", ":")).encode())])
    return (body + b"." + b64(hmac.new(secret.encode(), body, hashlib.sha256).digest())).decode()


def main():
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else None
    directory = Path(tempfile.mkdtemp(dir="/tmp", prefix="fws-"))
    data = directory / "data"
    ports = []
    for _ in range(2):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            ports.append(probe.getsockname()[1])
    port, rest_port = ports
    postgrest = None
    try:
        run(PG / "initdb", "-D", data, "-U", "supabase_admin", "--no-locale", "--encoding=UTF8", "-A", "trust", "--no-sync")
        run(PG / "pg_ctl", "-D", data, "-l", directory / "log", "-w", "-o", f"-k {directory} -p {port} -c listen_addresses='' -c fsync=off", "start")
        psql = lambda user, *extra, check=True: run(PG / "psql", "-X", "-q", "-At", "-h", directory, "-p", port, "-U", user, *extra, "postgres", check=check)
        roles = psql("supabase_admin", "-f", DUMPS / "prod-roles-20261119.sql", check=False)
        schema = psql("supabase_admin", "-f", DUMPS / "prod-schema-grants-20261119.sql", check=False)
        restore_errors = (roles.stderr + schema.stderr).count("ERROR:")
        # Local adaptation only: authenticator preloads Supabase's supautils/safeupdate, which this build lacks.
        psql("supabase_admin", "-c", "alter role authenticator reset session_preload_libraries")
        facts = json.loads(psql("supabase_admin", "-c", """select json_build_object(
          'postgresSuperuser', (select rolsuper from pg_roles where rolname = 'postgres'),
          'postgresCreaterole', (select rolcreaterole from pg_roles where rolname = 'postgres'),
          'postgresBypassrls', (select rolbypassrls from pg_roles where rolname = 'postgres'),
          'serviceRoleExecutesExecuteSql', has_function_privilege('service_role', 'public.execute_sql(text)', 'EXECUTE'),
          'witnessVerifierInstalled', to_regclass('forge_witness.credentials') is not null,
          'custodyInstalled', to_regclass('forge_pregame_capture.witnesses') is not null,
          'publicTables', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'))""").stdout)
        assert facts["postgresSuperuser"] is False and facts["serviceRoleExecutesExecuteSql"] and facts["witnessVerifierInstalled"] \
            and facts["custodyInstalled"], facts

        # Install Track A as postgres (the production installer), then prove a second install refuses.
        delta = HERE / "forge-witness-signed.sql"
        psql("postgres", "-v", "ON_ERROR_STOP=1", "-f", delta)
        again = psql("postgres", "-v", "ON_ERROR_STOP=1", "-f", delta, check=False)
        assert again.returncode != 0 and "signed verdicts already installed" in again.stderr, again.stderr[-400:]
        assert not json.loads(psql("supabase_admin", "-c", """select json_agg(r.rolname) filter (where pg_has_role(r.oid, 'forge_witness_owner', 'MEMBER'))
          from pg_roles r where r.rolname not in ('supabase_admin', 'forge_witness_owner')""").stdout.strip() or "null"), "owner has members after install"

        secret = secrets.token_hex(32)
        now = int(time.time())
        tokens = {"anon": jwt(secret, {"role": "anon", "iat": now, "exp": now + 3600}),
                  "service_role": jwt(secret, {"role": "service_role", "iat": now, "exp": now + 3600})}
        env = {k: v for k, v in ENV.items() if not k.startswith(("PGRST_", "PG"))}
        env.update(PGRST_DB_URI=f"postgresql:///postgres?host={directory}&port={port}&user=authenticator", PGRST_DB_ANON_ROLE="anon",
                   PGRST_DB_SCHEMAS="public,forge_witness_api", PGRST_JWT_SECRET=secret, PGRST_SERVER_HOST="127.0.0.1",
                   PGRST_SERVER_PORT=str(rest_port))
        log = (directory / "postgrest.log").open("w")
        postgrest = subprocess.Popen([str(POSTGREST)], env=env, stdout=log, stderr=log)
        for _ in range(150):
            try:
                with socket.create_connection(("127.0.0.1", rest_port), timeout=.2):
                    break
            except OSError:
                time.sleep(.1)
        else:
            raise SystemExit("PostgREST did not start")
        time.sleep(1.5)

        child = {k: ENV[k] for k in ("PATH", "HOME", "TMPDIR", "LC_ALL", "LANG") if k in ENV}
        child.update(NODE_PATH=os.pathsep.join([".", str(WEB / "node_modules")]),
                     TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}',
                     FORGE_REST_URL=f"http://127.0.0.1:{rest_port}", FORGE_TEST_TOKENS=json.dumps(tokens),
                     FORGE_OWNER_DSN=json.dumps({"host": str(directory), "port": port, "user": "supabase_admin", "database": "postgres"}),
                     FORGE_EDGE_BUNDLE=str(ROOT / "supabase/functions/forge-witness-verify/core.bundle.js"),
                     FORGE_PSQL=str(PG / "psql"), FORGE_PGHOST=str(directory), FORGE_PGPORT=str(port), FORGE_WORKDIR=str(directory))
        result = subprocess.run(["node", "-r", "ts-node/register/transpile-only", str(HERE / "signed-check.ts")],
                                cwd=WEB, env=child, capture_output=True, text=True, timeout=300)
        if result.returncode:
            raise SystemExit(result.stdout[-5000:] + result.stderr[-5000:] + "\nPostgREST log:\n" + (directory / "postgrest.log").read_text()[-1500:])
        proof = json.loads(result.stdout.strip().splitlines()[-1])
        manifest = json.loads((ROOT / "supabase/functions/forge-witness-verify/bundle-manifest.json").read_text())
        assert proof["release"] == manifest["release"], (proof["release"], manifest["release"])
        report = {"postgres": run(PG / "psql", "--version").stdout.strip(), "postgrest": run(POSTGREST, "--version").stdout.strip(),
                  "prodDump": {"roles": "prod-roles-20261119.sql", "schema": "prod-schema-grants-20261119.sql",
                               "restoreErrorsFromAbsentSupabaseSchemasAndExtensions": restore_errors, "facts": facts},
                  "delta": {"file": delta.name, "sha256": hashlib.sha256(delta.read_bytes()).hexdigest(), "appliedAs": "postgres",
                            "secondApplyRefused": True, "ownerMembersAfterInstall": 0},
                  "edgeBundle": manifest, **proof}
        text = json.dumps(report, indent=1)
        if out:
            out.write_text(text + "\n")
        print(text)
    finally:
        if postgrest:
            postgrest.terminate()
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "immediate", "-w", "stop"], env=ENV, capture_output=True)
        shutil.rmtree(directory, ignore_errors=True)


if __name__ == "__main__":
    main()
