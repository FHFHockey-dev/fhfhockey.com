#!/usr/bin/env python3
"""Disposable local PostgreSQL proof for the BLSH v6 drafts (never applied to a hosted database):
  - 20261116000000_blsh_native_capture_v6.sql: kill switch, one-shot claim, intent order, object
    recording against a stub storage.objects, manifest-last close, append-only triggers, watchdog,
    retention and grants;
  - 20261116000100_blsh_request_context_v1.sql: parity with the request reader. The same seeded
    rows are read through the reader's own KEY_SQL/PAGE_SQL (imported read-only from
    tasks/artifacts/blsh-request-reader-20261111/capture_reader.py) and through the function, and
    the key seal and every row group must be identical; plus scope, row and grant bounds.
Schema: games, wgo_skater_stats, nst_gamelog_as_counts(_oi) exactly as the production baseline
(20260716112908) defines them; a minimal storage.buckets/objects stub.
Run: LC_ALL=C python3 -I supabase/tests/blsh_capture_v6.py [--write-fixture PATH]
(needs Homebrew postgresql@15 and psycopg2). Prints one line per check and RESULT OK/FAILED.
"""
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
BASE = (ROOT / "supabase/migrations/20260716112908_production_schema_baseline.sql").read_text()
CAPTURE = (ROOT / "supabase/migrations/20261116000000_blsh_native_capture_v6.sql").read_text()
CONTEXT = (ROOT / "supabase/migrations/20261116000100_blsh_request_context_v1.sql").read_text()
READER = ROOT / "tasks/artifacts/blsh-request-reader-20261111/capture_reader.py"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55547
RESULTS = []


def report(name, ok, detail=None):
    RESULTS.append((name, bool(ok)))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok or detail is None else f"  [{detail}]"))
    return bool(ok)


def grab(text, pattern):
    found = re.search(pattern, text, re.S)
    assert found, pattern
    return found.group(0)


def raises(cur, sql, args=None, needle=""):
    cur.execute("savepoint s")
    try:
        cur.execute(sql, args)
    except psycopg2.Error as error:
        cur.execute("rollback to savepoint s")
        return needle in str(error)
    cur.execute("release savepoint s")
    return False


def one(cur, sql, args=None):
    cur.execute(sql, args)
    return cur.fetchone()[0]


def schema(cur):
    cur.execute("create role anon; create role authenticated; create role service_role")
    # The production baseline's default privileges (20260716112908), so the explicit revokes are tested against them.
    cur.execute("alter default privileges for role postgres in schema public grant select,insert,references,delete,trigger,truncate,update on tables to anon, authenticated, service_role;"
                "alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role")
    cur.execute("""create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (bucket_id text not null, name text not null, metadata jsonb, primary key (bucket_id, name));""")
    for table in ("games", "wgo_skater_stats", "nst_gamelog_as_counts", "nst_gamelog_as_counts_oi"):
        cur.execute(grab(BASE, rf"CREATE TABLE public\.{table} \(\n.*?\n\);\n"))
        cur.execute(f"alter table public.{table} add primary key (id)")


def migrate(cur, text):
    cur.execute(text)  # each file carries its own begin/commit


def capture_checks(cur):
    run_rpc = lambda name, *args: one(cur, f"select public.{name}({','.join(['%s'] * len(args))})", args)
    report("claim refused while the kill switch is off (default)",
           raises(cur, "select public.blsh_capture_claim_v1('native-v6','2026-11-19','{}')", needle="disabled"))
    cur.execute("update public.blsh_capture_control set enabled = true")
    first = run_rpc("blsh_capture_claim_v1", "native-v6", "2026-11-19", json.dumps({"deploymentId": "dpl_x"}))
    second = run_rpc("blsh_capture_claim_v1", "native-v6", "2026-11-19", "{}")
    report("one-shot claim: first claims, a second trigger gets claimed=false", first["claimed"] is True and second == {"claimed": False}, (first, second))
    run = first["run_id"]
    report("intent out of order (onIce first) refused", raises(cur, "select public.blsh_capture_intent_v1(%s,'onIce',array['admission:onIce','nst:onIce'])", (run,), "out of order"))
    report("intent with other operations refused", raises(cur, "select public.blsh_capture_intent_v1(%s,'individual',array['nst:individual'])", (run,), "invalid"))
    ok = run_rpc("blsh_capture_intent_v1", run, "individual", ["admission:individual", "nst:individual"]) and \
        run_rpc("blsh_capture_intent_v1", run, "onIce", ["admission:onIce", "nst:onIce"])
    report("intents append in order (individual, onIce)", ok and len(one(cur, "select operation_intents from public.blsh_capture_runs where run_id=%s", (run,))) == 2)
    report("a third intent refused", raises(cur, "select public.blsh_capture_intent_v1(%s,'onIce',array['admission:onIce','nst:onIce'])", (run,), "out of order"))

    path = lambda file, r=run, d="2026-11-19": f"native-v6/{d}/{r}/{file}"
    put = lambda name, size: cur.execute("insert into storage.objects values ('blsh-native-packets', %s, %s)", (name, json.dumps({"size": size})))
    put(path("STARTED.json"), 10)
    report("object missing from storage refused", raises(cur, "select public.blsh_capture_object_v1(%s,1,%s,%s,10)", (run, path("PLAN.json"), "a" * 64), "missing"))
    report("object with another size refused", raises(cur, "select public.blsh_capture_object_v1(%s,1,%s,%s,11)", (run, path("STARTED.json"), "a" * 64), "missing"))
    report("object under another run's path refused", raises(cur, "select public.blsh_capture_object_v1(%s,1,%s,%s,10)", (run, path("STARTED.json", r=str(uuid.uuid4())), "a" * 64), "not this run"))
    report("non-contiguous ordinal refused", raises(cur, "select public.blsh_capture_object_v1(%s,2,%s,%s,10)", (run, path("STARTED.json"), "a" * 64), "contiguous"))
    report("first object recorded", run_rpc("blsh_capture_object_v1", run, 1, path("STARTED.json"), "a" * 64, 10) is True)
    report("objects are append-only (update)", raises(cur, "update public.blsh_capture_objects set sha256=%s", ("b" * 64,), "append-only"))
    report("objects are append-only (delete)", raises(cur, "delete from public.blsh_capture_objects", needle="append-only"))
    report("runs cannot be deleted", raises(cur, "delete from public.blsh_capture_runs", needle="append-only"))
    report("run identity is immutable", raises(cur, "update public.blsh_capture_runs set source_date='2026-11-18' where run_id=%s", (run,), "immutable"))
    report("completion without a recorded manifest refused", raises(cur, "select public.blsh_capture_close_v1(%s,'packet_complete_pending_review',null,%s)", (run, "c" * 64), "manifest"))
    put(path("MANIFEST.json"), 20)
    run_rpc("blsh_capture_object_v1", run, 2, path("MANIFEST.json"), "c" * 64, 20)
    put(path("late.json"), 5)
    report("an object after MANIFEST.json refused", raises(cur, "select public.blsh_capture_object_v1(%s,3,%s,%s,5)", (run, path("late.json"), "d" * 64), "manifest"))
    report("completion with another manifest sha refused", raises(cur, "select public.blsh_capture_close_v1(%s,'packet_complete_pending_review',null,%s)", (run, "e" * 64), "manifest"))
    report("abandoned_uncertain cannot be set by the route", raises(cur, "select public.blsh_capture_close_v1(%s,'abandoned_uncertain','x_x',null)", (run,), "invalid"))
    report("completion closes the run", run_rpc("blsh_capture_close_v1", run, "packet_complete_pending_review", None, "c" * 64) is True)
    report("a second close refused", raises(cur, "select public.blsh_capture_close_v1(%s,'failed','late_close',null)", (run,), "not claimed"))
    report("terminal run is immutable", raises(cur, "update public.blsh_capture_runs set reason='x_y' where run_id=%s", (run,), "terminal"))
    report("keep false->true allowed on a terminal run", run_rpc("blsh_capture_keep_v1", run) is True)
    report("keep true->false refused", raises(cur, "update public.blsh_capture_runs set keep=false where run_id=%s", (run,), "terminal"))

    failed = run_rpc("blsh_capture_claim_v1", "native-v6", "2026-11-20", "{}")["run_id"]
    report("failure close needs a reason", raises(cur, "select public.blsh_capture_close_v1(%s,'failed',null,null)", (failed,), "reason"))
    report("failure close with a reason", run_rpc("blsh_capture_close_v1", failed, "failed", "permit_not_usable", None) is True)

    cur.execute("insert into public.blsh_capture_runs (pipeline, source_date, claimed_at) values ('native-v6','2026-11-21', clock_timestamp() - interval '11 minutes')")
    cur.execute("insert into public.blsh_capture_runs (pipeline, source_date) values ('native-v6','2026-11-22')")
    marked = run_rpc("blsh_capture_watchdog_v1")
    states = dict(cur.execute("select source_date::text, state from public.blsh_capture_runs") or cur.fetchall())
    report("watchdog marks only runs claimed > 10 min", marked == {"abandoned": 1} and states["2026-11-21"] == "abandoned_uncertain" and states["2026-11-22"] == "claimed", (marked, states))

    cur.execute("""insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values
      (2026020401, '2026-11-23', 20262027, 2, 1, 2), (2026020402, '2026-11-20', 20262027, 2, 3, 4)""")
    report("watchdog assert raises when yesterday had games and no run", raises(cur, "select public.blsh_capture_watchdog_assert_v1('2026-11-24')", needle="missing"))
    report("watchdog assert raises when yesterday's run failed", raises(cur, "select public.blsh_capture_watchdog_assert_v1('2026-11-21')", needle="failed"))
    cur.execute("insert into public.blsh_capture_runs (pipeline, source_date, state, closed_at, manifest_sha256) values ('native-v6', '2026-11-25', 'no_slate', now(), %s)", ("9" * 64,))
    cur.execute("""insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values (2026020403, '2026-11-25', 20262027, 2, 5, 6)""")
    report("watchdog assert raises on no_slate when games lists that date", raises(cur, "select public.blsh_capture_watchdog_assert_v1('2026-11-26')", needle="no_slate"))
    report("watchdog assert passes after a complete packet", run_rpc("blsh_capture_watchdog_assert_v1", "2026-11-20")["state"] == "packet_complete_pending_review")

    report("retention keeps the last 45 days", raises(cur, "select public.blsh_capture_retention_v1(current_date - 10)", needle="45 days"))


def retention_checks(cur):
    # Rows are kept; bytes are deleted first (Storage API, simulated by deleting the storage.objects row); then the run is marked pruned.
    runs = {}
    for day, keep in (("2020-01-02", False), ("2020-01-03", True)):
        cur.execute("insert into public.blsh_capture_runs (pipeline, source_date, state, closed_at, reason, keep) values ('native-v6', %s, 'failed', now(), 'old_run', %s) returning run_id", (day, keep))
        runs[day] = cur.fetchone()[0]
        path = f"native-v6/{day}/{runs[day]}/FAILED.json"
        cur.execute("insert into storage.objects values ('blsh-native-packets', %s, %s)", (path, json.dumps({"size": 1})))
        cur.execute("insert into public.blsh_capture_objects (run_id, ordinal, path, sha256, bytes) values (%s, 1, %s, %s, 1)", (runs[day], path, "f" * 64))
    listing = one(cur, "select public.blsh_capture_retention_v1('2020-02-01')")
    report("retention lists only closed, not-kept, unpruned runs", len(listing["paths"]) == 1 and str(runs["2020-01-02"]) in listing["paths"][0], listing)
    report("mark pruned refused while the bytes are still in Storage", raises(cur, "select public.blsh_capture_mark_pruned_v1(%s)", (runs["2020-01-02"],), "deleted from Storage first"))
    cur.execute("delete from storage.objects where name like %s", (f"native-v6/2020-01-02/{runs['2020-01-02']}/%",))
    report("after the bytes are deleted, the run is marked pruned", one(cur, "select public.blsh_capture_mark_pruned_v1(%s)", (runs["2020-01-02"],)) is True)
    report("object rows are kept after pruning", one(cur, "select count(*) from public.blsh_capture_objects where path like 'native-v6/2020-%'") == 2)
    report("a pruned run leaves the retention listing", one(cur, "select public.blsh_capture_retention_v1('2020-02-01')")["paths"] == [])
    report("a kept run cannot be pruned", raises(cur, "select public.blsh_capture_mark_pruned_v1(%s)", (runs["2020-01-03"],), "not eligible"))
    report("pruned_at cannot be cleared", raises(cur, "update public.blsh_capture_runs set pruned_at = null where run_id = %s", (runs["2020-01-02"],), "terminal"))
    report("object rows cannot be deleted at all", raises(cur, "delete from public.blsh_capture_objects", needle="append-only"))


def grant_checks(cur):
    functions = ["blsh_capture_enabled_v1()", "blsh_capture_claim_v1(text,date,jsonb)", "blsh_capture_intent_v1(uuid,text,text[])",
                 "blsh_capture_object_v1(uuid,integer,text,text,integer)", "blsh_capture_close_v1(uuid,text,text,text)", "blsh_capture_watchdog_v1()",
                 "blsh_capture_watchdog_assert_v1(date)", "blsh_capture_keep_v1(uuid)", "blsh_request_context_v1(date,date)"]
    bad = [(f, role) for f in functions for role in ("anon", "authenticated", "public")
           if role != "public" and one(cur, "select has_function_privilege(%s, %s, 'execute')", (role, "public." + f))]
    bad += [f for f in functions if not one(cur, "select has_function_privilege('service_role', %s, 'execute')", ("public." + f,))]
    report("functions: service_role only (anon/authenticated cannot execute)", not bad, bad)
    owner_only = [f for f in ("blsh_capture_retention_v1(date)", "blsh_capture_mark_pruned_v1(uuid)")
                  for role in ("anon", "authenticated", "service_role") if one(cur, "select has_function_privilege(%s, %s, 'execute')", (role, "public." + f))]
    report("retention helpers are owner-only (not even service_role)", not owner_only, owner_only)
    tables = ["blsh_capture_control", "blsh_capture_runs", "blsh_capture_objects"]
    exposed = [(t, role) for t in tables for role in ("anon", "authenticated") if one(cur, "select has_table_privilege(%s, %s, 'select')", (role, "public." + t))]
    writable = [(t, p) for t in tables for p in ("insert", "update", "delete", "truncate") if one(cur, "select has_table_privilege('service_role', %s, %s)", ("public." + t, p))]
    report("tables: service_role may only select (writes go through the RPCs), even with baseline default privileges", not writable and all(one(cur, "select has_table_privilege('service_role', %s, 'select')", ("public." + t,)) for t in tables), writable)
    report("tables: no anon/authenticated access, RLS on", not exposed and all(one(cur, "select relrowsecurity from pg_class where oid = %s::regclass", ("public." + t,)) for t in tables), exposed)
    bucket = one(cur, "select row_to_json(b) from storage.buckets b where id = 'blsh-native-packets'")
    report("bucket is private with a 2.5 MiB limit and json/html only", bucket and bucket["public"] is False and bucket["file_size_limit"] == 2621440
           and bucket["allowed_mime_types"] == ["application/json", "text/html"], bucket)
    attrs = one(cur, "select array[provolatile::text, prosecdef::text] from pg_proc where proname = 'blsh_request_context_v1'")
    report("request-context function is STABLE and SECURITY DEFINER", attrs == ["s", "true"], attrs)


def seed_context(cur):
    cur.execute("""insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values
      (2026020301, '2026-11-18', 20262027, 2, 1, 2), (2026020302, '2026-11-19', 20262027, 2, 3, 4), (2025020999, '2026-11-19', 20252026, 2, 3, 4)""")
    wgo = [  # id, player, game, season, date
        (101, 8471, 2026020301, 20262027, "2026-11-18"), (102, 8472, 2026020302, 20262027, "2026-11-19"),
        (103, 8473, 2026020302, 20262027, "2026-11-19"), (104, 8474, 2026020302, 20262027, "2026-10-21"),  # before date_from
        (105, 8475, 2026020302, 20252026, "2026-11-19"), (106, 8476, 2026029999, 20262027, "2026-11-19")]   # other season; unknown game
    for i, (wid, player, game, season, day) in enumerate(wgo):
        cur.execute("""insert into public.wgo_skater_stats (id, player_id, game_id, season_id, date, player_name, team_abbrev, position_code,
          games_played, toi_per_game, goals, assists, shots, points) values (%s,%s,%s,%s,%s,%s,'NJD','C',1,%s,%s,1,3,%s)""",
                    (wid, player, game, season, day, f"Player é {i}", 15.5 + i, i % 2, 1 + i % 2))
    nst = [(201, 8471, "2026-11-18"), (202, 8472, "2026-11-19"), (203, 8472, "2026-11-19"), (204, 8473, "2026-11-18")] + \
          [(300 + k, 8476, "2026-11-19") for k in range(10)]  # 10 linked rows: both reads return 9, the client refuses > 8
    for nid, player, day in nst:
        cur.execute("insert into public.nst_gamelog_as_counts (id, player_id, season, date_scraped, gp, toi, ixg, goals, shots) values (%s,%s,20262027,%s,1,900.5,0.42,0,2)", (nid, player, day))
        cur.execute("insert into public.nst_gamelog_as_counts_oi (id, player_id, season, date_scraped, gp, toi, xgf, xga) values (%s,%s,20262027,%s,1,900.5,1.1,0.9)", (nid + 1000, player, day))
    cur.execute("insert into public.nst_gamelog_as_counts (id, player_id, season, date_scraped, gp, toi) values (299, 8471, 20252026, '2026-11-18', 1, 1)")


def reader_module():
    sys.dont_write_bytecode = True  # never leave a .pyc in the reader lane's folder
    spec = importlib.util.spec_from_file_location("blsh_capture_reader_readonly", READER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def context_checks(cur, fixture_out):
    seed_context(cur)
    reader = reader_module()
    start, through = "2026-10-22", "2026-11-19"
    cur.execute(reader.KEY_SQL, (20262027, start, through))
    seal = json.loads(cur.fetchone()[0])
    reader_rows = []
    for at in range(0, len(seal["ids"]), reader.PAGE_KEYS):
        cur.execute(reader.PAGE_SQL, (seal["ids"][at:at + reader.PAGE_KEYS], 20262027, start, through))
        reader_rows += json.loads(cur.fetchone()[0])["rows"]
    out = one(cur, "select public.blsh_request_context_v1(%s, %s)", (start, through))
    report("key seal equals the reader's KEY_SQL", out["keySeal"] == seal, (out["keySeal"], seal))
    report("every row group equals the reader's PAGE_SQL", out["rows"] == reader_rows and len(reader_rows) == 4, (len(out["rows"]), len(reader_rows)))
    report("linked lists keep the reader's LIMIT 9 (client refuses > 8)", max(len(group[1]) for group in out["rows"]) == 9)
    report("metadata: version, scope, columns pin", out["version"] == "fhfh.blsh.request-context.v1" and out["dateFrom"] == start and out["eventThroughDate"] == through
           and out["columnsSHA256"] == reader.COLUMNS_SHA256)
    report("a span over 28 days refused", raises(cur, "select public.blsh_request_context_v1('2026-10-21','2026-11-19')", needle="SCOPE_INVALID"))
    report("reversed or out-of-season dates refused", raises(cur, "select public.blsh_request_context_v1('2026-11-19','2026-11-18')", needle="SCOPE_INVALID")
           and raises(cur, "select public.blsh_request_context_v1('2027-06-20','2027-07-01')", needle="SCOPE_INVALID"))
    if fixture_out:
        fixture_rows = [group for group in out["rows"] if max(len(group[1]), len(group[2]), len(group[3])) <= 8]
        fixture = {**out, "keySeal": {"ids": [g[0][0] for g in fixture_rows], "rows": len(fixture_rows)}, "rows": fixture_rows,
                   "snapshotUTC": "2026-11-20T12:40:00+00:00", "statementUTC": "2026-11-20T12:40:00+00:00"}
        Path(fixture_out).write_text(json.dumps(fixture, ensure_ascii=False, indent=1) + "\n")
        print("wrote fixture", fixture_out)
    cur.execute("""insert into public.wgo_skater_stats (id, player_id, game_id, season_id, date, player_name)
      select 20000 + g, 9000000 + g, 2026020301, 20262027, '2026-11-01', 'bulk' from generate_series(1, 10001) g""")
    report("10,001 WGO rows refused (row bound)", raises(cur, "select public.blsh_request_context_v1('2026-10-22','2026-11-19')", needle="ROW_BOUND"))


def bucket_check(sock):
    admin = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="postgres"); admin.autocommit = True
    admin.cursor().execute("create database blsh_bucket_exists")
    admin.close()
    conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="blsh_bucket_exists"); conn.autocommit = True
    cur = conn.cursor()
    cur.execute("""create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (bucket_id text not null, name text not null, metadata jsonb, primary key (bucket_id, name));
create table public.games (id bigint primary key, date date, type smallint);
insert into storage.buckets values ('blsh-native-packets', 'blsh-native-packets', true, 2621440, array['application/json','text/html'])""")
    refused = False
    try:
        cur.execute(CAPTURE)
    except psycopg2.Error as error:
        refused = "other settings" in str(error)
        cur.execute("rollback")
    report("migration refuses a pre-existing bucket with other settings (public=true)", refused)
    report("and the refusal applied nothing", one(cur, "select to_regclass('public.blsh_capture_runs') is null") is True)
    conn.close()


def main():
    fixture_out = sys.argv[sys.argv.index("--write-fixture") + 1] if "--write-fixture" in sys.argv else None
    tmp = Path(tempfile.mkdtemp(prefix="blshv6-"))
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
        schema(cur)
        migrate(cur, CAPTURE)
        migrate(cur, CONTEXT)
        report("both migrations apply on a clean database", True)
        report("kill switch defaults to off", one(cur, "select public.blsh_capture_enabled_v1()") is False)
        cur.execute("begin")
        capture_checks(cur)
        cur.execute("rollback")
        cur.execute("begin")
        retention_checks(cur)
        cur.execute("rollback")
        grant_checks(cur)
        cur.execute("begin")
        context_checks(cur, fixture_out)
        cur.execute("rollback")
        conn.close()
        bucket_check(sock)
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    failed = [name for name, ok in RESULTS if not ok]
    print(f"{len(RESULTS) - len(failed)}/{len(RESULTS)} passed")
    print("RESULT", "OK" if not failed else "FAILED")
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
