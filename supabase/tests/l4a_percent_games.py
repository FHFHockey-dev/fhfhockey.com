#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261111180800_fix_percent_games_multi_team_unknown.sql
(W2-1 D12 interim fail-closed; decision 16). Never applied to a hosted database by this script.

Season 20242025; TOR played 80 games, CHI 82.
  Skater 1: current team TOR, 40 GP, games for CHI then TOR -> percent_games unknown (was 40/80 against TOR only).
  Skater 2: current team TOR, 60 GP, every game for TOR -> 60/80 = 0.75 (control, unchanged).
  Goalie 1: team_abbrevs 'CHI,TOR' -> unknown (was 30/80). Goalie 2: 'TOR', 40 GP -> 0.5 (control, unchanged).
Defect checks must FAIL on the baseline views and PASS after; control checks must PASS both times; the
rollback file must restore the baseline answers; columns, order and types are unchanged.
Run: LC_ALL=C python3 -I supabase/tests/l4a_percent_games.py (needs Homebrew postgresql@15 and psycopg2).
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
FIX = ROOT / "supabase/migrations/20261111180800_fix_percent_games_multi_team_unknown.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_percent_games_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55494


def ddl(kind, name):
    m = re.search(rf"CREATE {kind} public\.{name} (?:\(\n.*?\n\);|AS\n.*?;)\n", BASE, re.S)
    assert m, name
    return m.group(0)


def schema():
    parts = ["create role anon; create role authenticated; create role service_role;"]
    parts += [ddl("TABLE", t) for t in ["seasons", "teams", "team_summary_years", "wgo_skater_stats",
                                        "wgo_skater_stats_totals", "wgo_goalie_stats_totals"]]
    # Stand-ins: the dump's id sequences are not created here, so surrogate ids may be NULL.
    parts.append("do $$ declare r record; begin for r in select table_name from information_schema.columns"
                 " where table_schema = 'public' and column_name = 'id' and is_nullable = 'NO' loop"
                 " execute format('alter table public.%I alter column id drop not null', r.table_name); end loop; end $$;")
    parts += [ddl("VIEW", "wgo_skater_stats_per_game"), ddl("VIEW", "wgo_goalie_stats_per_game")]
    return "\n".join(parts)


def fixture(cur):
    cur.execute('insert into public.seasons (id, "startDate", "endDate", "regularSeasonEndDate", "numberOfGames")'
                " values (20242025, '2024-10-04', '2025-06-20', '2025-04-17', 82)")
    for name, abbr, gp in [("Toronto Maple Leafs", "TOR", 80), ("Chicago Blackhawks", "CHI", 82)]:
        cur.execute("insert into public.teams (id, name, abbreviation) values (%s, %s, %s)", (1 if abbr == "TOR" else 2, name, abbr))
        cur.execute("insert into public.team_summary_years (season_id, team_id, team_full_name, games_played) values (20242025, %s, %s, %s)",
                    (1 if abbr == "TOR" else 2, name, gp))
    for pid, gp in [(1, 40), (2, 60)]:
        cur.execute("insert into public.wgo_skater_stats_totals (player_id, player_name, season, games_played,"
                    " current_team_abbreviation, current_team_name) values (%s, %s, '20242025', %s, 'TOR', 'Toronto Maple Leafs')",
                    (pid, f"S{pid}", gp))
    rows = [(1, "2024-10-10", "CHI"), (1, "2025-02-10", "TOR"), (2, "2024-10-10", "TOR"), (2, "2025-02-10", "TOR")]
    for i, (pid, d, team) in enumerate(rows):
        cur.execute("insert into public.wgo_skater_stats (id, player_id, player_name, date, season_id, team_abbrev)"
                    " values (%s, %s, 'x', %s, 20242025, %s)", (i + 1, pid, d, team))
    for gid, abbrevs, gp in [(1, "CHI,TOR", 30), (2, "TOR", 40)]:
        cur.execute("insert into public.wgo_goalie_stats_totals (goalie_id, goalie_name, season_id, games_played, team_abbrevs,"
                    " current_team_abbreviation) values (%s, 'G', 20242025, %s, %s, 'TOR')", (gid, gp, abbrevs))


def values(cur):
    cur.execute("select player_id, percent_games from public.wgo_skater_stats_per_game order by 1")
    sk = {k: (None if v is None else float(v)) for k, v in cur.fetchall()}
    cur.execute("select goalie_id, percent_games from public.wgo_goalie_stats_per_game order by 1")
    gk = {k: (None if v is None else float(v)) for k, v in cur.fetchall()}
    return sk, gk


def checks(cur, label):
    sk, gk = values(cur)
    defects = [("traded skater: percent_games unknown", sk[1] is None, f"skater1={sk[1]}"),
               ("multi-team goalie: percent_games unknown", gk[1] is None, f"goalie1={gk[1]}")]
    controls = [("single-team skater keeps GP / team GP", sk[2] == 0.75, f"skater2={sk[2]}"),
                ("single-team goalie keeps GP / team GP", gk[2] == 0.5, f"goalie2={gk[2]}")]
    for name, ok, detail in defects + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name} — {detail}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls]


def types(cur):
    cur.execute("select table_name, ordinal_position, column_name, data_type from information_schema.columns"
                " where table_name in ('wgo_skater_stats_per_game', 'wgo_goalie_stats_per_game') order by 1, 2")
    return cur.fetchall()


def main():
    tmp = Path(tempfile.mkdtemp(prefix="l4apct-"))
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
        before = types(cur)
        print("phase 1: baseline views")
        d0, c0 = checks(cur, "baseline")
        ok &= not any(d0) and all(c0)
        print("phase 2: apply the migration (twice)")
        cur.execute(FIX.read_text())
        cur.execute(FIX.read_text())
        d1, c1 = checks(cur, "fixed")
        ok &= all(d1) and all(c1)
        same = types(cur) == before
        print(f"  {'PASS' if same else 'FAIL'} columns, order and types unchanged")
        ok &= same
        print("phase 3: rollback")
        cur.execute(ROLLBACK.read_text())
        d2, c2 = checks(cur, "rollback")
        restored = d2 == d0 and c2 == c0
        print(f"  {'PASS' if restored else 'FAIL'} rollback restores the baseline answers")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
