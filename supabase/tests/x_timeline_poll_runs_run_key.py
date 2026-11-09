#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261109150000_x_timeline_poll_runs_run_key.sql.

Unix socket only, no hosted credentials. Builds stand-ins for pg_net's net._http_response and pg_cron's cron.job /
cron.job_run_details, applies 20261106201221_x_timeline_poll_runs.sql (its capture body md5 equals production's),
reproduces the reused-response-id loss, then applies the fix and checks that every run is kept.
Run: LC_ALL=C python3 -I supabase/tests/x_timeline_poll_runs_run_key.py (needs Homebrew postgresql@15 and psycopg2).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "supabase/migrations/20261106201221_x_timeline_poll_runs.sql"
FIX = ROOT / "supabase/migrations/20261109150000_x_timeline_poll_runs_run_key.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PRODUCTION_CAPTURE_BODY_MD5 = "7631439c27b860b3b49020168369b1d2"
PORT = 55483
checks = []

STANDINS = """
create role anon; create role authenticated; create role service_role;
create schema net;
create table net._http_response (id bigint not null, status_code integer, content text, created timestamptz not null default now());
create schema cron;
create table cron.job (jobid bigint primary key, jobname text);
create table cron.job_run_details (runid bigint primary key, jobid bigint, start_time timestamptz, status text);
insert into cron.job values (6, 'x-timeline-poll');
"""


def check(name, ok, detail=""):
    checks.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


def body(ok_by_key):
    results = [{"sourceKey": key, "ok": ok, "status": None if ok else 404, "attempts": 1 if ok else 3, "seen": 20 if ok else None,
                "inserted": 0} for key, ok in ok_by_key.items()]
    return json.dumps({"ok": all(ok_by_key.values()), "providers": "ok", "results": results}, separators=(",", ":"))


def respond(cur, response_id, minutes_ago, ok_by_key):
    status = 200 if all(ok_by_key.values()) else 207
    cur.execute("insert into net._http_response (id, status_code, content, created) values (%s, %s, %s, now() - make_interval(mins => %s))",
                (response_id, status, body(ok_by_key), minutes_ago))


def capture(conn):
    with conn.cursor() as cur:
        cur.execute("select public.x_timeline_capture_poll_runs()")
        result = cur.fetchone()[0]
    conn.commit()
    return result


def runs(cur):
    cur.execute("select count(distinct (run_at, response_id)), count(*) from public.x_timeline_poll_runs")
    return cur.fetchone()


def main():
    tmp = Path(tempfile.mkdtemp(prefix="xpollkey-"))
    data, sock = tmp / "data", tmp / "sock"
    sock.mkdir()
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"], env=env, check=True, capture_output=True)
    subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"), "-o", f"-p {PORT} -k {sock} -h ''", "-w", "start"], env=env, check=True, capture_output=True)
    try:
        conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="postgres")
        with conn.cursor() as cur:
            cur.execute(STANDINS)
            cur.execute(BASE.read_text())
            cur.execute("select md5(prosrc) from pg_proc where proname = 'x_timeline_capture_poll_runs'")
            check("base capture body equals production's", cur.fetchone()[0] == PRODUCTION_CAPTURE_BODY_MD5)
            # Before a pg_net restart: ids 5 and 6, both captured.
            respond(cur, 5, 60, {"ccc": True, "dfofantasy": True})
            respond(cur, 6, 58, {"ccc": True, "dfofantasy": False})
        conn.commit()
        capture(conn)
        with conn.cursor() as cur:
            # pg_net restarts its ids and drops the old responses: two new runs reuse 5 and 6, one gets 7.
            cur.execute("delete from net._http_response")
            respond(cur, 5, 4, {"ccc": False, "dfofantasy": True})
            respond(cur, 6, 2, {"ccc": True, "dfofantasy": True})
            respond(cur, 7, 0, {"ccc": True, "dfofantasy": True})
        conn.commit()
        capture(conn)
        with conn.cursor() as cur:
            check("base migration drops runs that reuse a response id (the bug)", runs(cur) == (3, 6), str(runs(cur)))

            cur.execute(FIX.read_text())
        conn.commit()
        with conn.cursor() as cur:
            cur.execute("select pg_get_constraintdef(oid) from pg_constraint where conname = 'x_timeline_poll_runs_pkey'")
            check("primary key is (run_at, response_id, source_key)", cur.fetchone()[0] == "PRIMARY KEY (run_at, response_id, source_key)")
            cur.execute("select proconfig, prosecdef from pg_proc where proname = 'x_timeline_capture_poll_runs'")
            config, secdef = cur.fetchone()
            check("capture keeps search_path '' and security definer", config == ['search_path=""'] and secdef, str(config))
            cur.execute("select has_function_privilege(r, 'public.x_timeline_capture_poll_runs()', 'execute') from unnest(array['anon','authenticated','service_role']) r")
            check("execute only for service_role", [row[0] for row in cur.fetchall()] == [False, False, True])
            base = re.sub(r"\s+", " ", re.search(r"as \$\$(.*?)\$\$;", BASE.read_text(), re.S).group(1))
            fixed = re.sub(r"\s+", " ", re.search(r"as \$\$(.*?)\$\$;", FIX.read_text(), re.S).group(1))
            check("function body differs from the base only in the conflict target",
                  fixed.replace("on conflict (run_at, response_id, source_key)", "on conflict (response_id, source_key)") == base)
        # The 10-minute overlap reaches back to the reused runs at 4 and 2 minutes ago.
        result = capture(conn)
        with conn.cursor() as cur:
            check("after the fix the reused-id runs are captured", runs(cur) == (5, 10), f"{runs(cur)} {result}")
            cur.execute("select ok from public.x_timeline_poll_runs where response_id = 5 and source_key = 'ccc' order by run_at")
            check("both runs with id 5 keep their own result", [row[0] for row in cur.fetchall()] == [True, False])
        result = capture(conn)
        with conn.cursor() as cur:
            check("a repeat capture adds nothing (idempotent)", result["inserted"] == 0 and runs(cur) == (5, 10), str(result))
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)
    failed = [c for c in checks if not c[1]]
    print(f"{len(checks) - len(failed)}/{len(checks)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
