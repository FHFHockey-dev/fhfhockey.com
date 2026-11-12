#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261111180900_fix_skater_game_stats_placeholders_nullable.sql
(decision 83, for lane L1's writer). Never applied to a hosted database by this script.

One game, two team rows, two skaters, one goalie per side (synthetic). The writer now sends null for skater
faceoffs, powerPlayToi and shorthandedToi.
  Defect check: the baseline function rejects that payload (INVALID_SKATER_GAME_STATS_ROWS) and the columns
  are NOT NULL; after the migration it persists and the three fields are stored NULL (not "0/0" / "00:00").
  Controls (must hold before and after): a payload with the old placeholder strings persists unchanged; a
  skater with null toi (still required) is rejected; a team row with null powerPlayToi is rejected.
  Rollback restores the baseline function and NOT NULL once the null rows are cleared, and refuses while
  any null row remains.
Run: LC_ALL=C python3 -I supabase/tests/l4a_game_stats_nullable.py (needs Homebrew postgresql@15 and psycopg2).
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
BASE = (ROOT / "supabase/migrations/20260716112908_production_schema_baseline.sql").read_text()
FIX = ROOT / "supabase/migrations/20261111180900_fix_skater_game_stats_placeholders_nullable.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_game_stats_nullable_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55495
COLS = ("faceoffs", "powerPlayToi", "shorthandedToi")


def table(name):
    return re.search(rf"CREATE TABLE public\.{re.escape(name)} \(\n.*?\n\);\n", BASE, re.S).group(0)


def schema():
    enum = re.search(r'CREATE TYPE public\."NHL_Position_Code" AS ENUM \(.*?\);\n', BASE, re.S).group(0)
    func = re.search(r"CREATE FUNCTION public\.persist_complete_game_stats_v1\(.*?\n\$\$;\n", BASE, re.S).group(0)
    return "\n".join([
        "create role anon; create role authenticated; create role service_role;", enum,
        table("games"), table('"teamGameStats"'), table('"skatersGameStats"'), table('"goaliesGameStats"'),
        table('"statsUpdateStatus"'),
        'alter table public."teamGameStats" add primary key ("gameId", "teamId");',
        'alter table public."skatersGameStats" add primary key ("playerId", "gameId");',
        'alter table public."goaliesGameStats" add primary key ("playerId", "gameId");',
        'alter table public."statsUpdateStatus" add primary key ("gameId");',
        func])


def payload(game_id, skater_overrides=None, team_overrides=None):
    teams = [{"gameId": game_id, "teamId": t, "score": 2, "sog": 30, "faceoffPctg": 0.5, "pim": 4, "hits": 20,
              "blockedShots": 10, "giveaways": 5, "takeaways": 5, "powerPlay": "1/3", "powerPlayConversion": "1/3",
              "powerPlayToi": "06:00", **(team_overrides or {})} for t in (1, 2)]
    skaters = [{"playerId": p, "gameId": game_id, "position": "C", "goals": 0, "assists": 1, "points": 1, "plusMinus": 0,
                "pim": 0, "hits": 1, "blockedShots": 0, "powerPlayGoals": 0, "powerPlayPoints": 0, "shorthandedGoals": 0,
                "shPoints": 0, "shots": 2, "faceoffs": "0/0", "faceoffWinningPctg": 0, "toi": "15:00",
                "powerPlayToi": "00:00", "shorthandedToi": "00:00", **(skater_overrides or {})} for p in (11, 12)]
    goalies = [{"playerId": g, "gameId": game_id, "position": "G", "evenStrengthShotsAgainst": "20/22",
                "powerPlayShotsAgainst": "5/6", "shorthandedShotsAgainst": "0/0", "saveShotsAgainst": "25/28",
                "evenStrengthGoalsAgainst": 2, "powerPlayGoalsAgainst": 1, "shorthandedGoalsAgainst": 0, "pim": 0,
                "goalsAgainst": 3, "toi": "60:00", "savePctg": 0.893} for g in (31, 32)]
    return teams, skaters, goalies


def persist(cur, game_id, **overrides):
    teams, skaters, goalies = payload(game_id, **overrides)
    try:
        cur.execute("select outcome from public.persist_complete_game_stats_v1(%s, %s::jsonb, %s::jsonb, %s::jsonb, 2, 2, 2)",
                    (game_id, json.dumps(teams), json.dumps(skaters), json.dumps(goalies)))
        return cur.fetchone()[0]
    except psycopg2.Error as error:
        return "error: " + error.pgerror.strip().splitlines()[0]


def stored(cur, game_id):
    cur.execute('select faceoffs, "powerPlayToi", "shorthandedToi", toi from public."skatersGameStats" where "gameId" = %s'
                ' order by "playerId"', (game_id,))
    return cur.fetchall()


def checks(cur, label, base_game):
    results = []

    def check(name, ok, detail, kind):
        results.append((kind, bool(ok)))
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name} — {detail}")

    nulls = dict.fromkeys(COLS)
    out = persist(cur, base_game, skater_overrides=nulls)
    rows = stored(cur, base_game)
    check("absent faceoffs / PP / SH TOI stored as NULL", out == "complete" and rows == [(None, None, None, "15:00")] * 2,
          f"outcome={out} rows={rows}", "defect")
    out = persist(cur, base_game + 1)
    rows = stored(cur, base_game + 1)
    check("explicit strings still persist unchanged", out == "complete" and rows == [("0/0", "00:00", "00:00", "15:00")] * 2,
          f"outcome={out} rows={rows}", "control")
    out = persist(cur, base_game + 2, skater_overrides={"toi": None})
    check("null skater toi still rejected", "INVALID_SKATER_GAME_STATS_ROWS" in out, out, "control")
    out = persist(cur, base_game + 3, team_overrides={"powerPlayToi": None})
    check("null team powerPlayToi still rejected", "INVALID_TEAM_GAME_STATS_ROWS" in out, out, "control")
    return results


def column_state(cur):
    cur.execute("select table_name, column_name, is_nullable, column_default from information_schema.columns"
                " where table_schema = 'public' and table_name in ('skatersGameStats', 'teamGameStats', 'goaliesGameStats')"
                " order by 1, 2")
    return cur.fetchall()


def props(cur):
    cur.execute("select pg_get_function_identity_arguments(oid), pg_get_function_result(oid), proconfig, prosecdef from pg_proc"
                " where proname = 'persist_complete_game_stats_v1'")
    return cur.fetchall()


def main():
    tmp = Path(tempfile.mkdtemp(prefix="l4agamestats-"))
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
        for gid in range(100, 130):
            cur.execute('insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values (%s, %s, 20252026, 2, 1, 2)',
                        (gid, "2025-11-01"))
        cols_before, props_before = column_state(cur), props(cur)
        print("phase 1: baseline")
        base = checks(cur, "baseline", 100)
        ok &= all(p for k, p in base if k == "control") and not any(p for k, p in base if k == "defect")
        print("phase 2: apply the migration (twice)")
        cur.execute(FIX.read_text())
        cur.execute(FIX.read_text())
        fixed = checks(cur, "fixed", 110)
        ok &= all(p for _, p in fixed)
        changed = [(a, b) for a, b in zip(cols_before, column_state(cur)) if a != b]
        want = [(("skatersGameStats", c, "NO", d), ("skatersGameStats", c, "YES", d))
                for (t, c, n, d) in cols_before if t == "skatersGameStats" and c in COLS]
        only = changed == want and props(cur) == props_before
        print(f"  {'PASS' if only else 'FAIL'} only the three skater columns became nullable (defaults kept); "
              f"function signature, result and search_path unchanged — changed={[(a[1], b[2]) for a, b in changed]}")
        ok &= only
        print("phase 3: rollback")
        try:
            cur.execute(ROLLBACK.read_text())
            refused = False
        except psycopg2.Error:
            refused = True
            cur.execute("rollback")
        print(f"  {'PASS' if refused else 'FAIL'} rollback refuses while null rows exist")
        ok &= refused
        cur.execute('delete from public."skatersGameStats" where faceoffs is null')
        cur.execute(ROLLBACK.read_text())
        rolled = checks(cur, "rollback", 120)
        restored = [p for _, p in rolled] == [p for _, p in base] and column_state(cur) == cols_before and props(cur) == props_before
        print(f"  {'PASS' if restored else 'FAIL'} rollback restores the baseline behaviour, columns and function")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
