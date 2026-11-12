#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for the L4a NST season-long view fixes.

Migrations under test (never applied to a hosted database by this script):
  20261111180000_fix_nst_seasonlong_counts_regular_season.sql  (W2-P0-1, D1/F1, PR-SQL-1 counts)
  20261111180100_fix_nst_seasonlong_rates_unknown_and_ozs.sql   (D9, PR-SQL-1 rates)

Unix socket only, no hosted credentials. Loads the baseline tables and views (20260716112908) plus the
AS percentile views (20261104011002), inserts a frozen fixture, and checks the served views:
  phase 1 (baseline): every check must FAIL (the defects reproduce);
  phase 2 (both migrations): every check must PASS, column types are unchanged and dependents still read;
  phase 3 (rollback file): the baseline answers return.
Run: LC_ALL=C python3 -I supabase/tests/nst_seasonlong_l4a.py (needs Homebrew postgresql@15 and psycopg2).
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MIG = ROOT / "supabase/migrations"
BASE = (MIG / "20260716112908_production_schema_baseline.sql").read_text()
AS_PERCENTILE = (MIG / "20261104011002_nst_percentile_as_from_gamelogs.sql").read_text()
COUNTS_FIX = MIG / "20261111180000_fix_nst_seasonlong_counts_regular_season.sql"
RATES_FIX = MIG / "20261111180100_fix_nst_seasonlong_rates_unknown_and_ozs.sql"
ROLLBACK = ROOT / "supabase/tests/nst_seasonlong_l4a_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55491
STRENGTHS = ["es", "pp", "pk", "as"]
GAMELOG_TABLES = [f"nst_gamelog_{s}_counts{oi}" for s in STRENGTHS for oi in ("", "_oi")]


def table_ddl(name):
    m = re.search(rf"CREATE TABLE public\.{name} \(\n.*?\n\);\n", BASE, re.S)
    assert m, name
    return m.group(0)


def view_ddl(name):
    m = re.search(rf"CREATE VIEW public\.{name} AS\n.*?;\n", BASE, re.S)
    assert m, name
    return m.group(0)


def baseline_schema():
    parts = ["create role anon; create role authenticated; create role service_role;"]
    parts += [table_ddl(t) for t in ["games", *GAMELOG_TABLES, "nst_percentile_as_offense", "nst_percentile_as_defense"]]
    for kind in ["counts", "counts_oi", "rates", "rates_oi"]:
        parts += [view_ddl(f"nst_seasonlong_{s}_{kind}") for s in STRENGTHS]
    parts += [view_ddl(f"nst_seasonlong_combined_{s}") for s in ["es", "pp", "pk"]]
    parts += [view_ddl(f"nst_percentile_{s}_{side}") for s in ["es", "pp", "pk"] for side in ["offense", "defense"]]
    return "\n".join(parts)


# Season 20242025. Regular-season dates R1..R3, playoff date P1; M1 is a 20232024 playoff date that the
# ingest labelled 20242025. Player 1 has two real games (R1, R2), one GP-2 aggregate on regular-season
# date R3, one playoff game and one mis-tagged game. Player 2 has two 20-minute games, ixG 0.6 and unknown.
# Player 3 has one game with zero PK TOI and no on-ice events, OZ 2 / NZ 2 / DZ 1 starts and faceoffs.
R1, R2, R3, P1, M1 = "2024-10-10", "2024-10-12", "2024-10-14", "2025-04-25", "2024-05-28"
GAMES = [(1, R1, 20242025, 2), (2, R2, 20242025, 2), (3, R3, 20242025, 2), (4, P1, 20242025, 3), (5, M1, 20232024, 3)]
# (player, season, date, gp, toi, goals, shots, ixg)
IND = [(1, 20242025, R1, 1, 1000, 1, 3, 0.3), (1, 20242025, R2, 1, 1200, 0, 2, 0.2),
       (1, 20242025, R3, 2, 2400, 2, 5, 0.5), (1, 20242025, P1, 1, 1100, 5, 6, 0.9),
       (1, 20242025, M1, 1, 900, 4, 4, 0.8),
       (2, 20242025, R1, 1, 1200, 0, 1, 0.6), (2, 20242025, R2, 1, 1200, 0, 1, None),
       (3, 20242025, R1, 1, 0, 0, 0, 0.0)]
# (player, season, date, gp, toi, cf, ca, sf, sa, ga, oz, nz, dz)
OI = [(1, 20242025, R1, 1, 1000, 10, 8, 5, 4, 1, 3, 1, 2), (1, 20242025, R2, 1, 1200, 12, 6, 6, 3, 0, 1, 2, 1),
      (1, 20242025, R3, 2, 2400, 22, 14, 11, 7, 1, 4, 3, 3), (1, 20242025, P1, 1, 1100, 9, 9, 4, 4, 2, 2, 2, 2),
      (1, 20242025, M1, 1, 900, 7, 7, 3, 3, 1, 1, 1, 1),
      (3, 20242025, R1, 1, 0, 0, 0, 0, 0, 0, 2, 2, 1)]


def load_fixture(cur):
    for g in GAMES:
        cur.execute('insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values (%s,%s,%s,%s,1,2)', g)
    for s in STRENGTHS:
        for i, (p, season, d, gp, toi, goals, shots, ixg) in enumerate(IND):
            cur.execute(f"insert into public.nst_gamelog_{s}_counts (id, player_id, season, date_scraped, gp, toi, goals, shots, ixg,"
                        " faceoffs_won, faceoffs_lost) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,0,0)",
                        (i + 1, p, season, d, gp, toi, goals, shots, ixg))
        for i, (p, season, d, gp, toi, cf, ca, sf, sa, ga, oz, nz, dz) in enumerate(OI):
            cur.execute(f"insert into public.nst_gamelog_{s}_counts_oi (id, player_id, season, date_scraped, gp, toi, cf, ca, sf, sa,"
                        " gf, ga, off_zone_starts, neu_zone_starts, def_zone_starts, off_zone_faceoffs, neu_zone_faceoffs,"
                        " def_zone_faceoffs) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                        (i + 1, p, season, d, gp, toi, cf, ca, sf, sa, 1 if sf else 0, ga, oz, nz, dz, oz, nz, dz))


def one(cur, sql):
    cur.execute(sql)
    return cur.fetchone()


def close(a, b):
    return a is not None and b is not None and abs(float(a) - float(b)) < 1e-6


def run_checks(cur, label):
    """Each check states the correct answer recomputed from the fixture above."""
    results = []

    def check(name, ok, detail):
        results.append((name, bool(ok)))
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name} — {detail}")

    for s in STRENGTHS:
        gp, toi, goals, shots, shp = one(cur, f"select gp, toi_seconds, goals, shots, sh_percentage from public.nst_seasonlong_{s}_counts"
                                        " where player_id = 1 and season = 20242025")
        # Regular-season single games only: R1 + R2 (the GP-2 row on R3, the playoff and mis-tagged rows are out).
        check(f"{s} counts: regular season, one game per row", (gp, toi, goals, shots) == (2, 2200, 1, 5) and close(shp, 20.0),
              f"gp={gp} toi={toi} goals={goals} shots={shots} sh%={shp} (want 2, 2200, 1, 5, 20.0)")
        gpo, toio, cf = one(cur, f"select gp, toi_seconds_oi, cf from public.nst_seasonlong_{s}_counts_oi"
                                 " where player_id = 1 and season = 20242025")
        check(f"{s} counts_oi: regular season, one game per row", (gpo, toio, cf) == (2, 2200, 22),
              f"gp={gpo} toi={toio} cf={cf} (want 2, 2200, 22)")
        g60 = one(cur, f"select goals_per_60 from public.nst_seasonlong_{s}_rates where player_id = 1 and season = 20242025")[0]
        check(f"{s} rates served: goals/60 over regular-season TOI", close(g60, 1 * 3600 / 2200), f"goals_per_60={g60} (want {3600/2200:.6f})")
        ixg, ixg60 = one(cur, f"select c.ixg, r.ixg_per_60 from public.nst_seasonlong_{s}_counts c join public.nst_seasonlong_{s}_rates r"
                              " using (player_id, season) where player_id = 2 and season = 20242025")
        # Rule 13: one game's ixG is unknown, so the full-window count and rate are unknown (not 0.9/60).
        check(f"{s} unknown ixG stays unknown", ixg is None and ixg60 is None, f"ixg={ixg} ixg_per_60={ixg60} (want NULL, NULL)")
        r = one(cur, f"select g60.goals_per_60, oi.cf_pct, oi.on_ice_sv_pct, oi.pdo, oi.off_zone_start_pct, oi.off_zone_faceoff_pct"
                     f" from public.nst_seasonlong_{s}_rates g60 join public.nst_seasonlong_{s}_rates_oi oi using (player_id, season)"
                     " where player_id = 3 and season = 20242025")
        g60z, cfp, svp, pdo, ozs, ozfo = r
        check(f"{s} zero denominators are NULL, not 0/50/100", g60z is None and cfp is None and svp is None and pdo is None,
              f"goals/60={g60z} cf%={cfp} sv%={svp} pdo={pdo} (want all NULL)")
        # Decision 9: OZ / (OZ + DZ) = 2 / 3, not 2 / 5.
        check(f"{s} OZS% and OZFO% = OZ/(OZ+DZ)", close(ozs, 200 / 3) and close(ozfo, 200 / 3), f"ozs={ozs} ozfo={ozfo} (want 66.667)")
    return results


def column_types(cur):
    cur.execute("select table_name, ordinal_position, column_name, data_type from information_schema.columns"
                " where table_schema = 'public' and table_name like 'nst_%' order by 1, 2")
    return cur.fetchall()


def main():
    tmp = Path(tempfile.mkdtemp(prefix="nstseason-"))
    data, sock = tmp / "data", tmp / "sock"
    sock.mkdir()
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"],
                   env=env, check=True, capture_output=True)
    subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"), "-o", f"-p {PORT} -k {sock} -h ''", "-w", "start"],
                   env=env, check=True, capture_output=True)
    ok = True
    try:
        conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="postgres")
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(baseline_schema())
        cur.execute(AS_PERCENTILE)
        load_fixture(cur)
        types_before = column_types(cur)

        print("phase 1: baseline views (defects must reproduce)")
        baseline = run_checks(cur, "baseline")
        if any(passed for _, passed in baseline):
            ok = False
            print("  ERROR: a check passed on the baseline, so it does not detect the defect")

        print("phase 2: apply both migrations")
        cur.execute(COUNTS_FIX.read_text())
        cur.execute(RATES_FIX.read_text())
        fixed = run_checks(cur, "fixed")
        ok &= all(passed for _, passed in fixed)
        same_types = column_types(cur) == types_before
        print(f"  {'PASS' if same_types else 'FAIL'} view columns, order and types unchanged")
        ok &= same_types
        for s in STRENGTHS:
            for side in ["offense", "defense"]:
                cur.execute(f"select count(*) from public.nst_percentile_{s}_{side} where season = 20242025")
        print("  PASS dependent percentile views still read")
        cur.execute(COUNTS_FIX.read_text())
        cur.execute(RATES_FIX.read_text())
        print("  PASS both migrations re-apply")

        print("phase 3: rollback restores the baseline answers")
        cur.execute(ROLLBACK.read_text())
        rolled = run_checks(cur, "rollback")
        restored = [p for _, p in rolled] == [p for _, p in baseline]
        print(f"  {'PASS' if restored else 'FAIL'} rollback reproduces the baseline results")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
