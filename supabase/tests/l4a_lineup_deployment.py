#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261111180700_fix_lineup_deployment_slot_and_pp_share.sql
(W2-1 D7 forward slot; decision 86 PP share). Never applied to a hosted database by this script.

Fixture, season 20252026 regular season, team 1, games 1-20; player 100 dresses in all 20.
  * Game 1 line 1 holds two centres and a right wing (A=C, B=C, R=R); line 2 holds a defenceman playing forward
    (D), a left wing (L) and a right wing (W). Slots must follow the line card (each line ordered L, C, R; ties and
    other positions keep stored order), one player per slot.
  * Team 1's PP units are recorded in games 1-16 (player 100 on PP1 in games 1-3, player 200 on PP1 elsewhere)
    and unrecorded in games 17-20. Decision 86: share = 3/3 (games with a PP-unit assignment); share_of_dressed =
    3/16; pp_record_coverage = 16/20.
Phase 1 (baseline function) must FAIL each check; phase 2 (migration) must PASS; phase 3 (rollback) restores.
Run: LC_ALL=C python3 -I supabase/tests/l4a_lineup_deployment.py (needs Homebrew postgresql@15 and psycopg2).
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
BASE = (ROOT / "supabase/migrations/20260716112908_production_schema_baseline.sql").read_text()
FIX = ROOT / "supabase/migrations/20261111180700_fix_lineup_deployment_slot_and_pp_share.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_lineup_deployment_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55493
A, B_, R, D, L, W, P, Q = 1, 2, 3, 4, 5, 6, 100, 200


def table(name):
    m = re.search(rf"CREATE TABLE public\.{re.escape(name)} \(\n.*?\n\);\n", BASE, re.S)
    assert m, name
    return m.group(0)


def schema():
    func = re.search(r"CREATE FUNCTION public\.refresh_player_lineup_deployment_tallies\(.*?\n\$\$;\n", BASE, re.S).group(0)
    return "\n".join([
        "create role anon; create role authenticated; create role service_role;",
        table("games"), table('"lineCombinations"'), table('"powerPlayCombinations"'),
        "create table public.players (id bigint primary key, position text);",
        table("player_lineup_deployment_tallies"), func])


def fixture(cur):
    positions = {A: "C", B_: "C", R: "R", D: "D", L: "L", W: "R", P: "C", Q: "C"}
    for pid, pos in positions.items():
        cur.execute("insert into public.players values (%s, %s)", (pid, pos))
    for gid in range(1, 21):
        cur.execute('insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values (%s, %s, 20252026, 2, 1, 2)',
                    (gid, f"2025-10-{gid + 5:02d}"))
        forwards = [A, B_, R, D, L, W] if gid == 1 else [P, Q, R]
        if gid == 1:
            forwards += [P, Q, 7]
        cur.execute('insert into public."lineCombinations" ("gameId", "teamId", forwards, defensemen, goalies) values (%s, 1, %s, %s, %s)',
                    (gid, forwards, [11, 12], [30]))
        if gid <= 16:
            cur.execute('insert into public."powerPlayCombinations" ("gameId", "playerId", unit) values (%s, %s, 1)',
                        (gid, P if gid <= 3 else Q))


def checks(cur, label):
    results = []

    def check(name, ok, detail):
        results.append((name, bool(ok)))
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name} — {detail}")

    cur.execute("select * from public.refresh_player_lineup_deployment_tallies(20252026, null)")
    cur.execute("select player_id, deployment_code from public.player_lineup_deployment_tallies"
                " where deployment_group = 'forward' and player_id in (1, 2, 3, 4, 5, 6) order by 1")
    got = cur.fetchall()
    want = [(A, "F1_LW"), (B_, "F1_C"), (R, "F1_RW"), (D, "F2_RW"), (L, "F2_LW"), (W, "F2_C")]
    check("D7 forward slot follows the line card, one player per slot", got == want, f"got={got} want={want}")
    cur.execute("select slot_label, count(*) from public.player_lineup_deployment_tallies where deployment_group = 'forward'"
                " and line_number = 1 and first_game_date = '2025-10-06' and player_id in (1, 2, 3) group by 1 order by 1")
    per_slot = cur.fetchall()
    check("D7 line 1 of game 1 fills LW, C and RW once each", per_slot == [("C", 1), ("LW", 1), ("RW", 1)], f"{per_slot}")
    try:
        cur.execute("select games, total_games, share, share_of_dressed, pp_record_coverage, dressed_games, dressed_games_pp_recorded"
                    " from public.player_lineup_deployment_tallies where player_id = 100 and deployment_code = 'PP1'")
        row = cur.fetchone()
        g, t, share, sod, cov, dg, dgr = row
        ok = (g, t, dg, dgr) == (3, 3, 20, 16) and float(share) == 1.0 and float(sod) == 0.1875 and float(cov) == 0.8
        detail = f"games={g} total={t} share={share} share_of_dressed={sod} coverage={cov} dressed={dg} recorded={dgr}"
    except psycopg2.Error as error:
        ok, detail = False, f"error: {error.pgerror.strip().splitlines()[0]}"
    check("Decision 86: both PP measures with their denominators and coverage", ok, detail)
    cur.execute("select count(*) from public.player_lineup_deployment_tallies where deployment_group = 'power_play'"
                " and player_id = 300")
    return results


def main():
    tmp = Path(tempfile.mkdtemp(prefix="l4alineup-"))
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
        cur.execute(schema())
        fixture(cur)
        print("phase 1: baseline function (defects must reproduce)")
        base = checks(cur, "baseline")
        if any(p for _, p in base):
            ok = False
            print("  ERROR: a check passed on the baseline")
        print("phase 2: apply the migration (twice)")
        cur.execute(FIX.read_text())
        cur.execute(FIX.read_text())
        fixed = checks(cur, "fixed")
        ok &= all(p for _, p in fixed)
        cur.execute("select * from public.refresh_player_lineup_deployment_tallies(20252026, 100)")
        cur.execute("select deployment_code, share_of_dressed from public.player_lineup_deployment_tallies where player_id = 100"
                    " and deployment_group = 'power_play'")
        single = cur.fetchall()
        single_ok = len(single) == 1 and float(single[0][1]) == 0.1875
        print(f"  {'PASS' if single_ok else 'FAIL'} single-player refresh gives the same PP measures — {single}")
        ok &= single_ok
        cur.execute("select * from public.refresh_player_lineup_deployment_tallies(20252026, 1)")
        cur.execute("select deployment_code from public.player_lineup_deployment_tallies where player_id = 1 and deployment_group = 'forward'")
        a_slot = cur.fetchall()
        print(f"  {'PASS' if a_slot == [('F1_LW',)] else 'FAIL'} single-player refresh keeps the linemate-dependent slot — {a_slot}")
        ok &= a_slot == [("F1_LW",)]
        print("phase 3: rollback")
        cur.execute(ROLLBACK.read_text())
        rolled = checks(cur, "rollback")
        restored = [p for _, p in rolled[:2]] == [p for _, p in base[:2]]
        print(f"  {'PASS' if restored else 'FAIL'} rollback restores the baseline slot answers (added columns stay, NULL)")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
