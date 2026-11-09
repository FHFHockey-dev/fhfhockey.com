#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261109015836_nst_admission_post_burst_gap.sql.

Unix socket only, no hosted credentials, no NST. Applies the accepted shared-admission
install, the rename from 20261101161622, then the draft. A fake clock replaces
clock_timestamp() inside the budget body only. Run: python3 -I supabase/tests/nst_admission_post_burst_gap.py
(needs Homebrew postgresql@15 and psycopg2; set LC_ALL=C on macOS).
"""
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
ADMISSION = ROOT / "tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/nst-goalie-writer-20261101/rollout-approval-20261101/PROPOSED-admission-install.sql"
MIGRATION = ROOT / "supabase/migrations/20261109015836_nst_admission_post_burst_gap.sql"
ROLLBACK = ROOT / "supabase/tests/nst_admission_post_burst_gap_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
ACCEPTED_BODY_MD5 = "b1821941a79c71b95eeab6bd0ec13950"
# NST's published limits (unique URLs). The ledger counts every attempt, so these must hold.
NST_LIMITS = [(60, 40), (300, 80), (900, 100), (3600, 180)]
LEDGER_CAPS = [(60, 39), (300, 80), (900, 100), (3600, 180)]
checks = []


def check(name, ok, detail=""):
    checks.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


class Ledger:
    def __init__(self, conn):
        self.c = conn
        self.grants = []  # (t, caller, run_id)

    def admit(self, t, burst, planned, caller="x", run_id=None):
        with self.c.cursor() as cur:
            cur.execute("select set_config('test.now', %s, false)", (f"2026-11-09 03:00:00+00",))
            cur.execute("select set_config('test.offset', %s, false)", (repr(float(t)),))
            cur.execute("select public.nst_admit_attempt_budget_v1(%s, %s)", (burst, planned))
            receipt = cur.fetchone()[0]
        if receipt["allowed"]:
            self.grants.append((t, caller, run_id))
        return receipt["allowed"], receipt["waitMs"]


def setup(data, sock):
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"], env=env, check=True, capture_output=True)
    subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"), "-o", f"-p 55473 -k {sock} -h ''", "-w", "start"], env=env, check=True, capture_output=True)
    conn = psycopg2.connect(host=sock, port=55473, user="postgres", dbname="postgres")
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("create role anon; create role authenticated; create role service_role;")
        cur.execute("create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key, name text);")
        cur.execute(ADMISSION.read_text())
        # 20261101161622 renames the accepted body; this is its only step the budget depends on.
        cur.execute("alter function public.nst_admit_attempt_v1(boolean,integer) rename to nst_admit_attempt_budget_v1")
        cur.execute(MIGRATION.read_text())
        cur.execute("insert into supabase_migrations.schema_migrations values ('20261109015836','nst_admission_post_burst_gap')")
    return conn, env


def install_fake_clock(conn):
    with conn.cursor() as cur:
        cur.execute("create function public.test_clock() returns timestamptz language sql stable as $$ select current_setting('test.now')::timestamptz + make_interval(secs => current_setting('test.offset')::float8) $$")
        cur.execute("select md5(prosrc), pg_get_functiondef(oid) from pg_proc where proname='nst_admit_attempt_budget_v1'")
        real_md5, definition = cur.fetchone()
        draft_body = MIGRATION.read_text().split("$$")[1]
        check("draft body installed exactly", real_md5 == hashlib.md5(draft_body.encode()).hexdigest())
        cur.execute(definition.replace("clock_timestamp()", "public.test_clock()"))
    return real_md5


def reset(conn):
    with conn.cursor() as cur:
        cur.execute("update public.nst_request_admission_state set attempts='{}', last_spacing_ms=22000, burst_remaining=0, burst_last_at=null")


def tj_scenario(conn):
    reset(conn)
    led = Ledger(conn)
    burst_a = [led.admit(0.5 * i, True, 39, "A", "A1")[0] for i in range(39)]
    check("burst A: 39 back-to-back attempts all admitted", all(burst_a))
    allowed, wait = led.admit(19.0 + 22, False, None, "P")
    check("paced call 22 s after the burst is refused until burst+60 s", not allowed and abs(wait - 38_000) <= 2, f"waitMs={wait}")
    allowed, wait = led.admit(41.0, True, 39, "B", "B1")
    check("another caller's burst inside the 60 s gap is refused", not allowed and abs(wait - 38_000) <= 2, f"waitMs={wait}")
    allowed, _ = led.admit(78.9, False, None, "P")
    check("still refused at 59.9 s after the burst's last attempt", not allowed)
    burst_b = [led.admit(80.5 + 0.5 * i, True, 39, "B", "B1")[0] for i in range(39)]
    check("after 60 s, a second burst of 39 is admitted (78 in 5 min)", all(burst_b))
    a, _ = led.admit(99.5 + 30, False, None, "P")
    check("post-burst gap applies again after burst B", not a)
    c1 = led.admit(159.5, True, 39, "C", "C1")
    c2 = led.admit(160.0, True, 39, "C", "C1")
    c3 = led.admit(160.5, True, 39, "C", "C1")
    check("80/5m: only 2 more fit, the 81st is refused", c1[0] and c2[0] and not c3[0], f"c3 waitMs={c3[1]}")
    check("81st waits for the 5-minute window (oldest + 301 s)", abs(c3[1] - (301_001 - 160_500)) <= 2, f"waitMs={c3[1]}")
    t, granted = 160.5, False
    while not granted:
        t += max(c3[1], 25) / 1000 if t == 160.5 else max(wait, 25) / 1000
        granted, wait = led.admit(t, True, 39, "C", "C2")
    check("the next permit comes only once the 5-minute window has room", t >= 301.0, f"admitted at {t:.3f}s")
    return led


def simulate(conn, hours=2.5):
    """Greedy callers: bursts of 39 (two of them) plus two paced 22 s callers."""
    reset(conn)
    led = Ledger(conn)
    callers = {"burst1": 0.0, "burst2": 3.0, "paced1": 1.0, "paced2": 2.0}
    runs = {"burst1": [0, 0, None], "burst2": [0, 0, None]}  # [remaining, run counter, run id]
    end = hours * 3600
    while True:
        name, t = min(callers.items(), key=lambda kv: kv[1])
        if t > end:
            break
        if name.startswith("burst"):
            run = runs[name]
            if run[0] == 0:
                run[1] += 1
                run[2] = f"{name}-{run[1]}"
                run[0] = 39
            allowed, wait = led.admit(t, True, 39, name, run[2])
            if allowed:
                run[0] -= 1
                callers[name] = t + 0.5
            else:
                # A burst that has to wait 30 s or more has ended; the next one starts fresh.
                if wait >= 30_000:
                    run[0] = 0
                callers[name] = t + max(wait, 25) / 1000
        else:
            allowed, wait = led.admit(t, False, None, name)
            callers[name] = t + (22.0 if allowed else max(wait, 25) / 1000)
    return led


def invariants(led, label):
    g = led.grants
    times = [t for t, _, _ in g]
    for window, cap in NST_LIMITS:
        worst = max((sum(1 for u in times if t - window < u <= t) for t in times), default=0)
        check(f"{label}: NST {cap}/{window}s never exceeded", worst <= cap, f"max {worst}")
    for window, cap in LEDGER_CAPS:
        worst = max((sum(1 for u in times if t - window - 1 < u <= t) for t in times), default=0)
        check(f"{label}: ledger cap {cap}/{window}s (+1 s pad) held", worst <= cap, f"max {worst}")
    # NST sees one key, not jobs. A burst run is a chain of burst grants < 30 s apart
    # (concurrent burst callers share one run and its allotment). Each run holds at
    # most the planned 39 attempts, and nothing follows a run for 60 s.
    bad_gap, bad_pace, runs = [], [], []
    for i, (t, caller, run) in enumerate(g):
        if run is not None and runs and runs[-1][-1][1] is not None and t - runs[-1][-1][0] < 30 and g[i - 1][2] is not None:
            runs[-1].append((t, run))
        else:
            runs.append([(t, run)])
        if i and (g[i - 1][2] is None or run is None) and t - g[i - 1][0] < 22 - 1e-6:
            bad_pace.append((round(g[i - 1][0], 3), round(t, 3)))
    for before, after in zip(runs, runs[1:]):
        if before[-1][1] is not None and after[0][0] - before[-1][0] < 60 - 1e-6:
            bad_gap.append((round(before[-1][0], 3), round(after[0][0], 3)))
    longest = max((len(r) for r in runs if r[0][1] is not None), default=0)
    check(f"{label}: every burst run is at most 39 attempts (shared allotment)", longest <= 39, f"longest {longest}")
    check(f"{label}: nothing is admitted within 60 s after a burst run ends", not bad_gap, str(bad_gap[:3]))
    check(f"{label}: 22 s spacing around every paced attempt", not bad_pace, str(bad_pace[:3]))
    return times


def main():
    work = Path(tempfile.mkdtemp(prefix="nstpb"))
    sock = Path(tempfile.mkdtemp(prefix="nstpbs", dir="/tmp"))
    env = None
    try:
        conn, env = setup(work / "data", str(sock))
        install_fake_clock(conn)
        invariants(tj_scenario(conn), "TJ scenario")
        times = invariants(simulate(conn), "2.5 h simulation")
        for window, cap in [(300, 80), (900, 100), (3600, 180)]:
            best = max(sum(1 for u in times if t - window - 1 < u <= t) for t in times)
            check(f"2.5 h simulation actually reaches the {cap}/{window}s window", best == cap, f"max {best}")
        with conn.cursor() as cur:
            cur.execute(ROLLBACK.read_text())
            cur.execute("select md5(prosrc), proacl::text from pg_proc where proname='nst_admit_attempt_budget_v1'")
            md5, acl = cur.fetchone()
            cur.execute("select count(*) from information_schema.columns where table_name='nst_request_admission_state' and column_name like 'burst%'")
            cols = cur.fetchone()[0]
            cur.execute("select count(*) from supabase_migrations.schema_migrations where version='20261109015836'")
            ledger_rows = cur.fetchone()[0]
        check("rollback restores the accepted body, ACL, columns and ledger", md5 == ACCEPTED_BODY_MD5 and cols == 0 and ledger_rows == 0
              and acl == "{postgres=X/postgres,service_role=X/postgres}", f"md5={md5} acl={acl} cols={cols}")
        conn.close()
    finally:
        if env is not None:
            subprocess.run([str(PG / "pg_ctl"), "-D", str(work / "data"), "-w", "stop"], env=env, capture_output=True)
        shutil.rmtree(work, ignore_errors=True)
        shutil.rmtree(sock, ignore_errors=True)
    failed = [c for c in checks if not c[1]]
    print(f"\n{len(checks) - len(failed)}/{len(checks)} checks passed; 0 hosted calls.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
