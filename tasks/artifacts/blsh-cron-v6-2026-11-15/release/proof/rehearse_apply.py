#!/usr/bin/env python3
"""Local rehearsal of PREFLIGHT-AND-APPLY.md on a disposable PostgreSQL 15: the exact release/sql files, run by
psql as a NON-superuser owner (like production's postgres role), with the baseline's broad default privileges
(worst case). Never touches a hosted database. Checks:
  - the body extraction reassembles to the exact migration file (sha256);
  - preflight before 153, apply 153 (one transaction, COMMIT), readback 153;
  - preflight before 154, apply 154, readback 154;
  - atomicity: with the ledger row already present, apply 153 fails and leaves no blsh_ object.
Run: LC_ALL=C python3 -I -B rehearse_apply.py <repo root> <release dir>. Prints the observed lines PREFLIGHT-AND-APPLY.md quotes.
"""
import hashlib
import importlib.util
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

sys.dont_write_bytecode = True
REPO, RELEASE = Path(sys.argv[1]), Path(sys.argv[2])
PG, PORT = Path("/opt/homebrew/opt/postgresql@15/bin"), 55551
spec = importlib.util.spec_from_file_location("blsh_capture_v6_proof_readonly", REPO / "supabase/tests/blsh_capture_v6.py")
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)
MIGRATIONS = {153: (REPO / "supabase/migrations/20261116000000_blsh_native_capture_v6.sql", 14, 269,
                    "4e896a891d02543a5a500597c7ce97d745e6a724d1c5100de1a7a2e8c9250c70"),
              154: (REPO / "supabase/migrations/20261116000100_blsh_request_context_v1.sql", 15, 64,
                    "920e3430a89d1c91ac5899f52a2a606563d6e6f700f77e1750dbf5511089642b")}
RESULTS = []


def report(name, ok, detail=None):
    RESULTS.append((name, bool(ok)))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail is not None else ""))


def setup(sock, dbname):
    conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname=dbname)
    conn.autocommit = True
    cur = conn.cursor()
    class SkipExistingRoles:  # roles are cluster-wide: a second database reuses them
        def __init__(self, inner): self.inner = inner
        def execute(self, sql, args=None):
            if sql.startswith("create role anon") and dbname != "postgres": return None
            return self.inner.execute(sql, args)
    proof.schema(SkipExistingRoles(cur))  # roles, baseline default privileges, storage stub, base tables
    cur.execute("""
create schema cron; create table cron.job_run_details (status text, start_time timestamptz);
create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
do $$ begin if not exists (select 1 from pg_roles where rolname = 'apply_owner') then create role apply_owner login nosuperuser; end if; end $$;
grant create, usage on schema public to apply_owner;
grant usage on schema storage, cron, supabase_migrations to apply_owner;
grant select, insert on storage.buckets to apply_owner; grant select on storage.objects to apply_owner;
grant select on cron.job_run_details to apply_owner; grant select, insert on supabase_migrations.schema_migrations to apply_owner;
grant select on public.games, public.wgo_skater_stats, public.nst_gamelog_as_counts, public.nst_gamelog_as_counts_oi to apply_owner;
grant anon, authenticated, service_role to apply_owner;
alter default privileges for role apply_owner in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role apply_owner in schema public grant all on functions to anon, authenticated, service_role;""")
    return conn, cur


def psql(sock, dbname, *args):
    result = subprocess.run([str(PG / "psql"), "-X", "-h", str(sock), "-p", str(PORT), "-U", "apply_owner", "-d", dbname, "-At", "-F", "|", *args],
                            capture_output=True, text=True, env={"PATH": "/usr/bin:/bin", "LC_ALL": "C", "PGOPTIONS": ""})
    return result.returncode, result.stdout, result.stderr


def line(out):
    rows = [r for r in out.splitlines() if "|" in r and not r.startswith("applied_at")]
    return rows[0] if rows else ""


def main():
    tmp = Path(tempfile.mkdtemp(prefix="blshv6apply-"))
    data, sock, work = tmp / "data", tmp / "sock", tmp / "work"
    sock.mkdir(); work.mkdir()
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"], env=env, check=True, capture_output=True)
    subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"), "-o", f"-p {PORT} -k {sock} -h ''", "-w", "start"], env=env, check=True, capture_output=True)
    sqldir = RELEASE / "sql"
    try:
        bodies = {}
        for order, (path, begin, commit, expected) in MIGRATIONS.items():
            lines = path.read_bytes().split(b"\n")
            report(f"{order}: file sha256 is the authorized {expected[:8]}", hashlib.sha256(path.read_bytes()).hexdigest() == expected)
            report(f"{order}: line {begin} is 'begin;' and line {commit} is 'commit;'", lines[begin - 1] == b"begin;" and lines[commit - 1] == b"commit;")
            body = b"\n".join(lines[begin:commit - 1]) + b"\n"
            reassembled = b"\n".join(lines[:begin]) + b"\n" + body + b"\n".join(lines[commit - 1:])
            report(f"{order}: header + extracted body + commit reassembles to the exact file", hashlib.sha256(reassembled).hexdigest() == expected)
            bodies[order] = work / f"body-{order}.sql"; bodies[order].write_bytes(body)

        conn, cur = setup(sock, "postgres")
        rc, out, err = psql(sock, "postgres", "-f", str(sqldir / "preflight.sql"))
        report("preflight before 153", rc == 0, line(out)); pre153 = line(out)
        rc, out, err = psql(sock, "postgres", "-v", f"body={bodies[153]}", "-f", str(sqldir / "apply-153.sql"))
        report("apply 153: one transaction, COMMIT, exit 0", rc == 0 and "COMMIT" in out, err.strip()[:300] or None)
        rc, out, err = psql(sock, "postgres", "-f", str(sqldir / "readback-153.sql"))
        report("readback 153", rc == 0, line(out)); rb153 = line(out)
        rc, out, err = psql(sock, "postgres", "-f", str(sqldir / "preflight.sql"))
        report("preflight before 154", rc == 0, line(out)); pre154 = line(out)
        rc, out, err = psql(sock, "postgres", "-v", f"body={bodies[154]}", "-f", str(sqldir / "apply-154.sql"))
        report("apply 154: one transaction, COMMIT, exit 0", rc == 0 and "COMMIT" in out, err.strip()[:300] or None)
        rc, out, err = psql(sock, "postgres", "-f", str(sqldir / "readback-154.sql"))
        report("readback 154", rc == 0, line(out)); rb154 = line(out)
        conn.close()

        admin = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="postgres"); admin.autocommit = True
        admin.cursor().execute("create database atomic_check"); admin.close()
        conn, cur = setup(sock, "atomic_check")
        cur.execute("insert into supabase_migrations.schema_migrations (version, name) values ('20261116000000', 'blsh_native_capture_v6')")
        rc, out, err = psql(sock, "atomic_check", "-v", f"body={bodies[153]}", "-f", str(sqldir / "apply-153.sql"))
        cur.execute("select count(*) from pg_class where relname like 'blsh\\_capture\\_%'")
        left = cur.fetchone()[0]
        cur.execute("select count(*) from pg_proc where proname like 'blsh\\_capture\\_%'")
        left += cur.fetchone()[0]
        cur.execute("select count(*) from storage.buckets where id = 'blsh-native-packets'")
        left += cur.fetchone()[0]
        report("atomicity: a failing ledger insert rolls back the whole apply (no table, function or bucket left)", rc != 0 and "COMMIT" not in out and left == 0, (rc, left))
        conn.close()
        expected = {
            "pre153": "0|0|0|0|0|0|0|0|0|absent|5|3|t|t|54|3|f|name,version",
            "rb153": "1|3|2|blsh_capture_control:SELECT,blsh_capture_objects:SELECT,blsh_capture_runs:SELECT|0|0|11|10|"
                     "blsh_capture_claim_v1,blsh_capture_close_v1,blsh_capture_enabled_v1,blsh_capture_intent_v1,blsh_capture_keep_v1,"
                     "blsh_capture_object_v1,blsh_capture_watchdog_assert_v1,blsh_capture_watchdog_v1|0|0|false,2621440,{application/json,text/html}|f|0",
            "pre154": "0|0|0|0|1|0|3|11|0|false,2621440,{application/json,text/html}|5|3|t|t|54|3|f|name,version",
            "rb154": '1|1|s|t|{"search_path=\\"\\""}|t|t|f|f|f',
        }
        observed = {"pre153": pre153, "rb153": rb153, "pre154": pre154, "rb154": rb154}
        for key, value in expected.items():
            report(f"{key} equals the documented expected line", observed[key] == value, None if observed[key] == value else observed[key])
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    failed = [n for n, ok in RESULTS if not ok]
    print(f"{len(RESULTS) - len(failed)}/{len(RESULTS)} passed")
    print("RESULT", "OK" if not failed else "FAILED")
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
