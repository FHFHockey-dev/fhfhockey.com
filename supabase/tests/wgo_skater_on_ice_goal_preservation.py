#!/usr/bin/env python3
"""Native private-fixture regressions. Never accepts a database URL or credentials.

Creates an owned PostgreSQL15 cluster over a new Unix socket, retaining all
fixture files. The exact migration is tested against the 244-column baseline.
Requires installed psycopg2/PostgreSQL15 and the normal shared heavy-test slot.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import uuid

import psycopg2
from psycopg2 import sql

FIELDS = ("es_goals_for", "pp_goals_for", "sh_goals_for",
          "es_goals_against", "pp_goals_against", "sh_goals_against")
LOCK = Path("/private/tmp/fhfh-heavy.lock")
PORT = 55448
DB = "wgo_null_guard_test"
USER = "wgo_guard_fixture_owner"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--migration", type=Path, required=True)
    parser.add_argument("--pg-bin", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--completion", type=Path)
    parser.add_argument("--wait-seconds", type=int, default=0, choices=range(61))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    empty_pass = args.output / "empty.pgpass"
    empty_pass.write_text("")
    empty_pass.chmod(0o600)
    token = str(uuid.uuid4())
    until = time.monotonic() + args.wait_seconds
    while True:
        try:
            LOCK.mkdir()
            break
        except FileExistsError:
            if time.monotonic() >= until:
                (args.output / "RESULT.json").write_text(json.dumps({
                    "status": "BLOCKED_HEAVY_LOCK", "testsStarted": False,
                    "foreignLockChanged": False}) + "\n")
                print("Shared heavy slot held; no tests/server started.", flush=True)
                return 75
            time.sleep(min(5, max(0, until - time.monotonic())))
    owner = LOCK / "owner.json"
    owner.write_text(json.dumps({"owner": "CODEX-WGO-NULL-PRESERVATION-20261029-01",
        "pid": os.getpid(), "token": token,
        "created_utc": datetime.now(timezone.utc).isoformat()}) + "\n")
    inode = LOCK.stat().st_ino
    started = False
    connection = None
    socket = None
    checks = []
    env = {k: v for k, v in os.environ.items()
           if k in ("PATH", "HOME", "USER", "LOGNAME", "TMPDIR", "LANG") or k.startswith("LC_")}
    env.update({"TZ": "UTC", "PGPASSFILE": str(empty_pass), "PGSERVICEFILE": "/dev/null"})
    data = args.output / "pgdata"
    result = {"status": "STARTED", "checks": checks, "hostedCalls": 0}

    def command(name, cmd):
        with (args.output / (name + ".log")).open("w") as log:
            subprocess.run(cmd, env=env, stdout=log, stderr=subprocess.STDOUT,
                           check=True, timeout=30)

    def connect():
        assert socket and socket.startswith("/tmp/fhfh-wgo-null-")
        c = psycopg2.connect(host=socket, port=PORT, dbname=DB, user=USER,
            connect_timeout=2, passfile=str(empty_pass), sslmode="disable",
            options="-c statement_timeout=5000ms -c lock_timeout=3000ms -c TimeZone=UTC")
        c.autocommit = True
        return c

    def query(c, text, params=None):
        with c.cursor() as cur:
            cur.execute(text, params)
            return cur.fetchall() if cur.description else None

    def check(name, work):
        before = time.monotonic()
        work()
        checks.append({"name": name, "status": "PASS",
                       "seconds": round(time.monotonic() - before, 3)})
        print(name + ": PASS", flush=True)

    def seed(c, row_id, value, *, game=2026020061):
        values = [row_id, row_id, "Fixture", "2026-10-08", game, 20262027] + [value] * 6
        query(c, "INSERT INTO public.wgo_skater_stats "
            "(id,player_id,player_name,date,game_id,season_id," + ",".join(FIELDS) + ") "
            "VALUES(" + ",".join(["%s"] * 12) + ")", values)

    def refill(c, row_id, value):
        values = [row_id, row_id, "Fixture", "2026-10-08", 2026020061, 20262027] + [value] * 6
        return query(c, "INSERT INTO public.wgo_skater_stats "
            "(id,player_id,player_name,date,game_id,season_id," + ",".join(FIELDS) + ") "
            "VALUES(" + ",".join(["%s"] * 12) + ") "
            "ON CONFLICT(player_id,date) DO UPDATE SET " +
            ",".join(f + "=EXCLUDED." + f for f in FIELDS) +
            " RETURNING " + ",".join(FIELDS), values)[0]

    try:
        command("initdb", [str(args.pg_bin / "initdb"), "-D", str(data),
            "-A", "trust", "-U", USER, "--no-locale", "--encoding=UTF8", "--no-clean"])
        socket = tempfile.mkdtemp(prefix="fhfh-wgo-null-", dir="/tmp")
        (Path(socket) / "fixture-token.json").write_text(json.dumps({"token": token, "data": str(data)}))
        options = f"-F -p {PORT} -k {socket} -h '' -c shared_buffers=16MB -c max_connections=12"
        command("start", [str(args.pg_bin / "pg_ctl"), "-D", str(data),
            "-l", str(args.output / "postgres.log"), "-o", options, "-w", "start"])
        started = True
        command("createdb", [str(args.pg_bin / "createdb"), "-h", socket,
            "-p", str(PORT), "-U", USER, DB])
        connection = connect()
        version = query(connection, "SELECT current_setting('server_version_num')::integer")[0][0]
        assert version // 10000 == 15
        assert query(connection, "SELECT inet_server_addr() IS NULL, current_database()")[0] == (True, DB)
        baseline = (args.repo / "supabase/migrations/20260716112908_production_schema_baseline.sql").read_text()
        match = re.search(r"CREATE TABLE public\.wgo_skater_stats \(\n[\s\S]*?\n\);", baseline)
        assert match, "Missing canonical fixture table definition"
        query(connection, match.group())
        query(connection, "CREATE UNIQUE INDEX fixture_wgo_player_date ON public.wgo_skater_stats(player_id,date)")
        columns = [r[0] for r in query(connection, "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name='wgo_skater_stats' ORDER BY ordinal_position")]
        assert len(columns) == 244
        query(connection, "CREATE TABLE public.wgo_skater_stats_playoffs (LIKE public.wgo_skater_stats INCLUDING ALL)")
        query(connection, "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE wgo_fixture_writer")
        query(connection, "GRANT USAGE ON SCHEMA public TO wgo_fixture_writer; "
              "GRANT SELECT,INSERT,UPDATE ON public.wgo_skater_stats TO wgo_fixture_writer")

        # Reproduce the old write path first, before installing the exact guard.
        seed(connection, 900000010, 0)
        lost = refill(connection, 900000010, None)
        assert lost == (None,) * 6
        result.update({"postgresVersionNum": version, "fixtureColumns": len(columns),
            "beforeFixKnownZerosErased": len(lost), "migrationSha256": hashlib.sha256(args.migration.read_bytes()).hexdigest()})
        query(connection, args.migration.read_text())

        check("SQL source/unknown/correction semantics", lambda: query(connection,
            (args.repo / "supabase/tests/wgo_skater_on_ice_goal_preservation.sql").read_text()))

        def permissions():
            security = query(connection, "SELECT prosecdef,proconfig FROM pg_proc "
                "WHERE oid='public.preserve_wgo_skater_on_ice_goals()'::regprocedure")[0]
            assert security == (False, ["search_path=pg_catalog"])
            assert query(connection, "SELECT has_function_privilege('anon', "
                "'public.preserve_wgo_skater_on_ice_goals()', 'EXECUTE'), "
                "has_function_privilege('authenticated', 'public.preserve_wgo_skater_on_ice_goals()', 'EXECUTE')")[0] == (False, False)
            query(connection, "SET ROLE wgo_fixture_writer")
            try:
                seed(connection, 900000020, 0)
                assert refill(connection, 900000020, None) == (0,) * 6
            finally:
                query(connection, "RESET ROLE")
        check("Invoker permissions, no client RPC privilege and real writer upsert", permissions)

        def identity():
            for i, (column, new) in enumerate([("player_id", 900000099),
                    ("date", "2026-10-09"), ("season_id", 20252026)], 30):
                sid = 900000000 + i
                seed(connection, sid, 2)
                query(connection, sql.SQL("UPDATE public.wgo_skater_stats SET {}=%s, " +
                    ",".join(f + "=NULL" for f in FIELDS) + " WHERE id=%s").format(sql.Identifier(column)), [new, sid])
                assert query(connection, "SELECT " + ",".join(FIELDS) +
                    " FROM public.wgo_skater_stats WHERE id=%s", [sid])[0] == (None,) * 6
        check("Identity boundaries do not inherit another observation", identity)

        def concurrent(sid, first, second):
            seed(connection, sid, 0)
            one, two = connect(), connect()
            one.autocommit = False
            pool = ThreadPoolExecutor(max_workers=1)
            future = None
            try:
                refill(one, sid, first)
                future = pool.submit(refill, two, sid, second)
                end = time.monotonic() + 2
                waiting = False
                while time.monotonic() < end:
                    row = query(connection, "SELECT wait_event_type FROM pg_stat_activity WHERE pid=%s", [two.get_backend_pid()])
                    if row and row[0][0] == "Lock":
                        waiting = True
                        break
                    if future.done():
                        break
                    time.sleep(.02)
                assert waiting, "second writer did not exercise the conflicting row lock"
                one.commit()
                expected = first if second is None else second
                assert future.result(timeout=6) == (expected,) * 6
                assert query(connection, "SELECT " + ",".join(FIELDS) +
                    " FROM public.wgo_skater_stats WHERE id=%s", [sid])[0] == (expected,) * 6
            finally:
                one.rollback()
                pool.shutdown(wait=True)
                one.close()
                two.close()
        check("Concurrent non-null correction then waiting null refill", lambda: concurrent(900000100, 7, None))
        check("Concurrent null refill then waiting non-null correction", lambda: concurrent(900000101, None, 9))

        def playoffs():
            query(connection, "INSERT INTO public.wgo_skater_stats_playoffs "
                "(id,player_id,player_name,date,game_id,season_id,es_goals_for) "
                "VALUES(900000200,900000200,'Fixture','2026-10-08',2026030001,20262027,2)")
            query(connection, "UPDATE public.wgo_skater_stats_playoffs SET es_goals_for=NULL WHERE id=900000200")
            assert query(connection, "SELECT es_goals_for FROM public.wgo_skater_stats_playoffs WHERE id=900000200")[0][0] is None
        check("Guard does not broaden into playoff table", playoffs)

        if args.completion:
            def repaired_corpus():
                meta = json.loads((args.completion / "RECEIPT-RECONCILIATION.json").read_text())
                records = []
                for game, expected_hash in meta["gameReceiptSHA256"].items():
                    p = args.completion.parent / "journal" / meta["scopeHash"] / "apply" / game / "receipt.json"
                    assert hashlib.sha256(p.read_bytes()).hexdigest() == expected_hash
                    receipt = json.loads(p.read_text())
                    records.extend(json.loads(item["after"]) for item in receipt["intent"]["rows"])
                assert len(records) == 1463
                query(connection, "INSERT INTO public.wgo_skater_stats SELECT * FROM "
                    "pg_catalog.json_populate_recordset(NULL::public.wgo_skater_stats,%s::json)", [json.dumps(records)])
                ids = [r["id"] for r in records]
                before = dict(query(connection, "SELECT id,to_jsonb(t) FROM public.wgo_skater_stats t WHERE id=ANY(%s)", [ids]))
                for record in records:
                    for field in FIELDS:
                        assert record[field] == 0
                        record[field] = None
                set_clause = sql.SQL(",").join(sql.SQL("{}=EXCLUDED.{}").format(sql.Identifier(c), sql.Identifier(c)) for c in columns)
                statement = sql.SQL("INSERT INTO public.wgo_skater_stats SELECT * FROM "
                    "pg_catalog.json_populate_recordset(NULL::public.wgo_skater_stats,%s::json) "
                    "ON CONFLICT(player_id,date) DO UPDATE SET {} RETURNING id").format(set_clause)
                assert len(query(connection, statement, [json.dumps(records)])) == 1463
                after = dict(query(connection, "SELECT id,to_jsonb(t) FROM public.wgo_skater_stats t WHERE id=ANY(%s)", [ids]))
                assert before == after
                result["capturedRepairRowsReplayedOnlyLocally"] = len(records)
                result["capturedWholeRowValuesPreserved"] = 1463 * 244
            check("All 1463 repaired rows survive exact whole-row null refill fixture", repaired_corpus)

        def collision():
            definition = query(connection, "SELECT pg_get_functiondef('public.preserve_wgo_skater_on_ice_goals()'::regprocedure)")[0][0]
            try:
                query(connection, args.migration.read_text())
            except psycopg2.errors.DuplicateFunction:
                query(connection, "ROLLBACK")
            else:
                raise AssertionError("migration silently replaced existing guard")
            assert query(connection, "SELECT pg_get_functiondef('public.preserve_wgo_skater_on_ice_goals()'::regprocedure)")[0][0] == definition
        check("Migration collision fails without replacing existing guard", collision)
        result["status"] = "PASS"
    except BaseException as error:
        result.update({"status": "FAIL", "errorType": type(error).__name__, "error": str(error)})
        print(type(error).__name__ + ": " + str(error), flush=True)
    finally:
        if connection:
            connection.close()
        if started:
            command("stop", [str(args.pg_bin / "pg_ctl"), "-D", str(data), "-m", "fast", "-w", "stop"])
        result.update({"ownedServerStopped": started, "fixtureRetained": str(data), "fixtureDataExists": data.exists(),
                       "atUtc": datetime.now(timezone.utc).isoformat()})
        (args.output / "RESULT.json").write_text(json.dumps(result, indent=2) + "\n")
        if LOCK.is_dir() and LOCK.stat().st_ino == inode and owner.exists() and json.loads(owner.read_text()).get("token") == token:
            owner.unlink()
            LOCK.rmdir()
            result["ownedHeavyLockReleased"] = True
            (args.output / "RESULT.json").write_text(json.dumps(result, indent=2) + "\n")
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
