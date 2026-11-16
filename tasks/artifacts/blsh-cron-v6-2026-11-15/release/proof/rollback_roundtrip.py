#!/usr/bin/env python3
"""apply -> rollback -> rollback (idempotent) -> apply, for both BLSH v6 migrations, on a disposable local
PostgreSQL 15 with the production baseline's default privileges. Never touches a hosted database.
The catalog snapshot (functions with signature, security, volatility, config and ACL; tables with RLS and
ACL; columns; constraints; indexes; triggers; the bucket row) must be identical after the first and the
second apply. Also: the capture rollback refuses while the bucket holds objects, and drops nothing then.
Reuses schema() from supabase/tests/blsh_capture_v6.py (imported read-only, no bytecode written).
Run: LC_ALL=C python3 -I -B rollback_roundtrip.py <repo root> <release dir>
"""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

sys.dont_write_bytecode = True
REPO, RELEASE = Path(sys.argv[1]), Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("blsh_capture_v6_proof_readonly", REPO / "supabase/tests/blsh_capture_v6.py")
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)
CAPTURE = (REPO / "supabase/migrations/20261116000000_blsh_native_capture_v6.sql").read_text()
CONTEXT = (REPO / "supabase/migrations/20261116000100_blsh_request_context_v1.sql").read_text()
ROLLBACK_CAPTURE = (RELEASE / "supabase/tests/blsh_native_capture_v6_rollback.sql").read_text()
ROLLBACK_CONTEXT = (RELEASE / "supabase/tests/blsh_request_context_v1_rollback.sql").read_text()
PG, PORT = Path("/opt/homebrew/opt/postgresql@15/bin"), 55549
RESULTS = []

SNAPSHOT = r"""
with t as (select c.oid, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'blsh\_%')
select json_build_object(
 'functions', (select coalesce(json_agg(json_build_array(p.oid::regprocedure::text, p.prosecdef, p.provolatile, p.proconfig, coalesce(p.proacl::text, ''),
                                        pg_get_userbyid(p.proowner)) order by p.oid::regprocedure::text), '[]')
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'blsh\_%'),
 'tables', (select coalesce(json_agg(json_build_array(c.relname, c.relrowsecurity, coalesce(c.relacl::text, '')) order by c.relname), '[]')
            from pg_class c join t on t.oid = c.oid),
 'columns', (select coalesce(json_agg(json_build_array(table_name, column_name, data_type, is_nullable, column_default) order by table_name, ordinal_position), '[]')
             from information_schema.columns where table_schema = 'public' and table_name like 'blsh\_%'),
 'constraints', (select coalesce(json_agg(json_build_array(t.relname, k.conname, pg_get_constraintdef(k.oid)) order by t.relname, k.conname), '[]')
                 from pg_constraint k join t on t.oid = k.conrelid),
 'indexes', (select coalesce(json_agg(json_build_array(indexname, indexdef) order by indexname), '[]') from pg_indexes where schemaname = 'public' and tablename like 'blsh\_%'),
 'triggers', (select coalesce(json_agg(json_build_array(t.relname, g.tgname, g.tgenabled) order by t.relname, g.tgname), '[]')
              from pg_trigger g join t on t.oid = g.tgrelid where not g.tgisinternal),
 'bucket', (select row_to_json(b) from storage.buckets b where b.id = 'blsh-native-packets'),
 'killSwitchRows', (select json_agg(row_to_json(c)) from (select singleton, enabled from public.blsh_capture_control) c)
)::text"""


def report(name, ok, detail=None):
    RESULTS.append((name, bool(ok)))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok or detail is None else f"  [{detail}]"))


def snapshot(cur):
    if cur.execute("select to_regclass('public.blsh_capture_control')") or cur.fetchone()[0] is None:
        cur.execute(SNAPSHOT.replace(",\n 'killSwitchRows', (select json_agg(row_to_json(c)) from (select singleton, enabled from public.blsh_capture_control) c)", ""))
    else:
        cur.execute(SNAPSHOT)
    return json.loads(cur.fetchone()[0])


def run(cur, sql):
    try:
        cur.execute(sql)
        return None
    except psycopg2.Error as error:
        cur.execute("rollback")
        return str(error).splitlines()[0]


def main():
    tmp = Path(tempfile.mkdtemp(prefix="blshv6rb-"))
    data, sock = tmp / "data", tmp / "sock"
    sock.mkdir()
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"], env=env, check=True, capture_output=True)
    subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"), "-o", f"-p {PORT} -k {sock} -h ''", "-w", "start"], env=env, check=True, capture_output=True)
    try:
        conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="postgres")
        conn.autocommit = True
        cur = conn.cursor()
        proof.schema(cur)
        empty = snapshot(cur)
        report("1. apply capture v6", run(cur, CAPTURE) is None)
        report("1. apply request context v1", run(cur, CONTEXT) is None)
        first = snapshot(cur)
        report("1. first apply: 12 public blsh_ functions (11 capture + request context), 3 tables, private bucket, kill switch off",
               len(first["functions"]) == 12 and len(first["tables"]) == 3 and first["bucket"]["public"] is False
               and first["killSwitchRows"] == [{"singleton": True, "enabled": False}], (len(first["functions"]), len(first["tables"])))
        cur.execute("update public.blsh_capture_control set enabled = true")
        cur.execute("select public.blsh_capture_claim_v1('native-v6', '2026-11-19', '{}')")
        cur.execute("insert into storage.objects values ('blsh-native-packets', 'native-v6/2026-11-19/x/STARTED.json', '{\"size\": 3}')")
        error = run(cur, ROLLBACK_CAPTURE)
        report("2. capture rollback refuses while the bucket holds objects", error is not None and "still holds objects" in error, error)
        report("2. and that refusal dropped nothing", snapshot(cur)["tables"] == first["tables"])
        cur.execute("delete from storage.objects where bucket_id = 'blsh-native-packets'")
        report("3. rollback request context v1", run(cur, ROLLBACK_CONTEXT) is None)
        report("3. rollback capture v6 (with a claimed run present)", run(cur, ROLLBACK_CAPTURE) is None)
        after = snapshot(cur)
        report("3. after rollback: no blsh_ functions, tables, indexes or triggers remain",
               after["functions"] == [] and after["tables"] == [] and after["indexes"] == [] and after["triggers"] == [], after)
        report("3. after rollback: only the empty private bucket remains, unchanged", after["bucket"] == first["bucket"])
        report("3. after rollback: everything else as before the first apply", {k: v for k, v in after.items() if k != "bucket"} == {k: v for k, v in empty.items() if k != "bucket"})
        report("4. second rollback of both is a no-op (idempotent)", run(cur, ROLLBACK_CONTEXT) is None and run(cur, ROLLBACK_CAPTURE) is None and snapshot(cur) == after)
        report("5. re-apply capture v6 over the kept bucket", run(cur, CAPTURE) is None)
        report("5. re-apply request context v1", run(cur, CONTEXT) is None)
        second = snapshot(cur)
        diff = [k for k in first if first[k] != second[k]]
        report("5. catalog after re-apply equals the first apply exactly (functions, ACLs, tables, columns, constraints, indexes, triggers, bucket, kill switch off)", not diff, diff)
        report("5. the earlier run row is gone (fresh ledger)", (cur.execute("select count(*) from public.blsh_capture_runs") or cur.fetchone()[0]) == 0)
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    failed = [n for n, ok in RESULTS if not ok]
    print(f"{len(RESULTS) - len(failed)}/{len(RESULTS)} passed")
    print("RESULT", "OK" if not failed else "FAILED")
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
