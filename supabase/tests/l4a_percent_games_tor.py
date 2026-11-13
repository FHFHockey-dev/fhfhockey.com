#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261113090100_percent_games_team_of_record_by_date.sql
(owner decision 138; W2-1 D12, decision 16, rules 5 and 13). Never applied to a hosted database.

Starting state is production's: the baseline views replaced by 20261111180800 (order 133, applied).
Season 20242025 (startDate 2024-10-04, regularSeasonEndDate 2025-04-17). TOR, CHI and BOS play regular-season
(type 2) games every few days up to a 2025-03-01 horizon; team_summary_years.games_played is each team's count to
that horizon. A TOR playoff-type game and a game labelled another season sit in the window and must not count.
  Skater 1 (traded CHI -> TOR, first TOR game 2025-01-15): GP / (CHI games before 01-15 + TOR games from 01-15).
  Skater 3 (TOR -> CHI -> TOR): three stints, the second return to TOR a new stint.
  Skater 5 (current team TOR, every game for BOS): one BOS stint, GP / BOS games.
  Goalie 1 ('CHI,TOR', first TOR game 2025-01-20): two stints from wgo_goalie_stats.
Defect checks (FAIL on 133, where these are NULL; PASS after): those four values equal the hand-computed ratios.
Controls (PASS on 133 and after): single-team skater 2 and goalie 2 keep GP / team GP; skater 4 (a stint for a
team missing from teams) and goalie 3 (no per-game rows) stay NULL (rule 13); columns, order and types unchanged;
with sequential scans disabled the planner reaches wgo_skater_stats and wgo_goalie_stats through indexes only.
Rollback restores the 133 answers.
Run: LC_ALL=C python3 -I supabase/tests/l4a_percent_games_tor.py (needs Homebrew postgresql@15 and psycopg2).
"""
import os
import re
import subprocess
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MIG = ROOT / "supabase/migrations"
BASE = (MIG / "20260716112908_production_schema_baseline.sql").read_text()
M133 = MIG / "20261111180800_fix_percent_games_multi_team_unknown.sql"
FIX = MIG / "20261113090100_percent_games_team_of_record_by_date.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_percent_games_tor_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55503
S = 20242025
START, HORIZON = date(2024, 10, 4), date(2025, 3, 1)
TEAMS = {"TOR": (1, "Toronto Maple Leafs", 0), "CHI": (2, "Chicago Blackhawks", 1), "BOS": (3, "Boston Bruins", 2)}
SCHEDULE = {abbr: [START + timedelta(days=offset + 3 * k) for k in range(60)
                   if START + timedelta(days=offset + 3 * k) <= HORIZON] for abbr, (_, _, offset) in TEAMS.items()}


def ddl(kind, name):
    m = re.search(rf"CREATE {kind} public\.{name} (?:\(\n.*?\n\);|AS\n.*?;)\n", BASE, re.S)
    assert m, name
    return m.group(0)


def schema():
    parts = ["create role anon; create role authenticated; create role service_role;"]
    parts += [ddl("TABLE", t) for t in ["seasons", "teams", "team_summary_years", "games", "wgo_skater_stats",
                                        "wgo_goalie_stats", "wgo_skater_stats_totals", "wgo_goalie_stats_totals"]]
    parts += [re.search(rf"CREATE (?:UNIQUE )?INDEX {n} ON [^\n]*\n", BASE).group(0)
              for n in ("wgo_skater_stats_player_id_date_key", "idx_wgo_goalie_stats_goalie_season_date_desc", "idx_games_date")]
    parts.append("do $$ declare r record; begin for r in select table_name from information_schema.columns"
                 " where table_schema = 'public' and column_name = 'id' and is_nullable = 'NO'"
                 " and table_name not in ('games', 'seasons', 'teams') loop"
                 " execute format('alter table public.%I alter column id drop not null', r.table_name); end loop; end $$;")
    parts += [ddl("VIEW", "wgo_skater_stats_per_game"), ddl("VIEW", "wgo_goalie_stats_per_game")]
    return "\n".join(parts)


def team_games(abbr, lo=None, hi=None):
    """Regular-season games of a team with lo <= date < hi (hi None = to the horizon)."""
    return sum(1 for d in SCHEDULE[abbr] if (lo is None or d >= lo) and (hi is None or d < hi))


def fixture(cur):
    cur.execute('insert into public.seasons (id, "startDate", "endDate", "regularSeasonEndDate", "numberOfGames")'
                " values (%s, %s, '2025-06-20', '2025-04-17', 82)", (S, START))
    gid = 1
    for abbr, (tid, name, _) in TEAMS.items():
        cur.execute("insert into public.teams (id, name, abbreviation) values (%s, %s, %s)", (tid, name, abbr))
        cur.execute("insert into public.team_summary_years (season_id, team_id, team_full_name, games_played) values (%s, %s, %s, %s)",
                    (S, tid, name, len(SCHEDULE[abbr])))
        for d in SCHEDULE[abbr]:
            cur.execute('insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values (%s, %s, %s, 2, %s, 99)',
                        (gid, d, S, tid))
            gid += 1
    # Must not count: a TOR playoff-type game and a TOR game labelled another season, both inside the window.
    cur.execute('insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values (9001, \'2025-01-02\', %s, 3, 1, 99)', (S,))
    cur.execute('insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values (9002, \'2025-01-03\', 20232024, 2, 99, 1)')
    totals = [(1, 40), (2, 45), (3, 45), (4, 30), (5, 20)]
    for pid, gp in totals:
        cur.execute("insert into public.wgo_skater_stats_totals (player_id, player_name, season, games_played,"
                    " current_team_abbreviation, current_team_name) values (%s, %s, %s, %s, 'TOR', 'Toronto Maple Leafs')",
                    (pid, f"S{pid}", str(S), gp))
    per_game = [(1, "2024-10-10", "CHI"), (1, "2024-11-05", "CHI"), (1, "2025-01-15", "TOR"), (1, "2025-02-10", "TOR"),
                (2, "2024-10-10", "TOR"), (2, "2025-02-10", "TOR"),
                (3, "2024-10-10", "TOR"), (3, "2024-12-01", "CHI"), (3, "2025-02-01", "TOR"),
                (4, "2024-10-10", "XYZ"), (4, "2025-01-10", "TOR"),
                (5, "2024-10-20", "BOS"), (5, "2025-01-20", "BOS")]
    for i, (pid, d, team) in enumerate(per_game, start=1):
        cur.execute("insert into public.wgo_skater_stats (id, player_id, player_name, date, season_id, team_abbrev)"
                    " values (%s, %s, 'x', %s, %s, %s)", (i, pid, d, S, team))
    for gid_, abbrevs, gp in [(1, "CHI,TOR", 30), (2, "TOR", 35), (3, "CHI,TOR", 25)]:
        cur.execute("insert into public.wgo_goalie_stats_totals (goalie_id, goalie_name, season_id, games_played, team_abbrevs,"
                    " current_team_abbreviation) values (%s, 'G', %s, %s, %s, 'TOR')", (gid_, S, gp, abbrevs))
    for gid_, d, team in [(1, "2024-10-12", "CHI"), (1, "2024-12-12", "CHI"), (1, "2025-01-20", "TOR"), (2, "2024-10-12", "TOR")]:
        cur.execute("insert into public.wgo_goalie_stats (goalie_id, goalie_name, date, season_id, team_abbreviation)"
                    " values (%s, 'G', %s, %s, %s)", (gid_, d, S, team))


def want():
    j15, d01, f01, j20 = date(2025, 1, 15), date(2024, 12, 1), date(2025, 2, 1), date(2025, 1, 20)
    return {
        "s1": 40 / (team_games("CHI", hi=j15) + team_games("TOR", lo=j15)),
        "s3": 45 / (team_games("TOR", hi=d01) + team_games("CHI", lo=d01, hi=f01) + team_games("TOR", lo=f01)),
        "s5": 20 / team_games("BOS"),
        "g1": 30 / (team_games("CHI", hi=j20) + team_games("TOR", lo=j20)),
        "s2": 45 / team_games("TOR"),
        "g2": 35 / team_games("TOR"),
    }


def values(cur):
    cur.execute("select player_id, percent_games from public.wgo_skater_stats_per_game order by 1")
    sk = {k: (None if v is None else float(v)) for k, v in cur.fetchall()}
    cur.execute("select goalie_id, percent_games from public.wgo_goalie_stats_per_game order by 1")
    gk = {k: (None if v is None else float(v)) for k, v in cur.fetchall()}
    return sk, gk


def near(a, b):
    return a is not None and abs(a - b) < 1e-12


def checks(cur, label):
    sk, gk, w = *values(cur), want()
    defects = [
        ("traded skater CHI -> TOR: GP / games available over both stints", near(sk[1], w["s1"]), f"{sk[1]} want {w['s1']}"),
        ("skater TOR -> CHI -> TOR: three stints", near(sk[3], w["s3"]), f"{sk[3]} want {w['s3']}"),
        ("skater whose season was all for BOS (current TOR): GP / BOS games", near(sk[5], w["s5"]), f"{sk[5]} want {w['s5']}"),
        ("traded goalie CHI -> TOR: GP / games available", near(gk[1], w["g1"]), f"{gk[1]} want {w['g1']}"),
    ]
    controls = [
        ("single-team skater keeps GP / team GP", near(sk[2], w["s2"]), f"{sk[2]}"),
        ("single-team goalie keeps GP / team GP", near(gk[2], w["g2"]), f"{gk[2]}"),
        ("skater with a stint for an unknown team stays NULL (rule 13)", sk[4] is None, f"{sk[4]}"),
        ("multi-team goalie without per-game rows stays NULL", gk[3] is None, f"{gk[3]}"),
    ]
    for name, ok, detail in defects + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name} — {detail}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls]


def types(cur):
    cur.execute("select table_name, ordinal_position, column_name, data_type from information_schema.columns"
                " where table_name in ('wgo_skater_stats_per_game', 'wgo_goalie_stats_per_game') order by 1, 2")
    return cur.fetchall()


def plan_ok(cur):
    cur.execute("begin; set local enable_seqscan = off")
    try:
        lines = []
        for sql in (f"select percent_games from public.wgo_skater_stats_per_game where season = '{S}'",
                    f"select percent_games from public.wgo_goalie_stats_per_game where season_id = {S}"):
            cur.execute("explain " + sql)
            lines += [r[0] for r in cur.fetchall()]
    finally:
        cur.execute("rollback")
    seq = [line.strip() for line in lines if re.search(r"Seq Scan on (wgo_skater_stats|wgo_goalie_stats)\b(?!_)", line)]
    probes = [line.strip() for line in lines if re.search(r"Index (Only )?Scan.* on (wgo_skater_stats|wgo_goalie_stats)\b(?!_)", line)]
    return not seq and len(probes) >= 2, seq or probes


def main():
    tmp = Path(tempfile.mkdtemp(prefix="l4apcttor-"))
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
        print("phase 1: production state (133)")
        cur.execute(M133.read_text())
        d0, c0 = checks(cur, "133")
        v133 = values(cur)
        ok &= not any(d0) and all(c0)
        print("phase 2: apply the migration (twice)")
        cur.execute(FIX.read_text())
        cur.execute(FIX.read_text())
        d1, c1 = checks(cur, "fixed")
        ok &= all(d1) and all(c1)
        same = types(cur) == before
        print(f"  {'PASS' if same else 'FAIL'} columns, order and types unchanged")
        good, detail = plan_ok(cur)
        print(f"  {'PASS' if good else 'FAIL'} index probes only on wgo_skater_stats / wgo_goalie_stats — {detail}")
        ok &= same and good
        print("phase 3: rollback")
        cur.execute(ROLLBACK.read_text())
        restored = values(cur) == v133 and types(cur) == before
        print(f"  {'PASS' if restored else 'FAIL'} rollback restores the 133 answers")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
