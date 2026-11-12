#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for the L4a reader migrations (never applied to a hosted database here):
  20261111180200_fix_game_score_season_scope.sql          (W2-1 D3 / PR-SQL-3, D6 label)
  20261111180300_fix_skaters_avg_stats_regular_season.sql  (W2-1 D8)
  20261111180400_fix_nhl_team_data_season_identity.sql     (W2-1 D4, PR-SQL-2, F3)
  20261111180500_fix_game_outcomes_level_score_unknown.sql (W2-1 D11)
  20261111180600_fix_goalie_weekly_zero_denominators.sql   (W2-1 D14)

Unix socket only. Loads the baseline (20260716112908) definitions plus the 20260731035012 search_path,
inserts a frozen fixture and checks the served output: every check must FAIL on the baseline and PASS after
the migrations; nhl_team_data is checked under both input permutations; the rollback file must restore the
baseline answers and function properties.
Run: LC_ALL=C python3 -I supabase/tests/l4a_sql_readers.py (needs Homebrew postgresql@15 and psycopg2).
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
FIXES = sorted(MIG.glob("2026111118020*_fix_*.sql")) + sorted(MIG.glob("2026111118030*_fix_*.sql")) + \
    sorted(MIG.glob("2026111118040*_fix_*.sql")) + sorted(MIG.glob("2026111118050*_fix_*.sql")) + \
    sorted(MIG.glob("2026111118060*_fix_*.sql"))
ROLLBACK = ROOT / "supabase/tests/l4a_sql_readers_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55492
SEARCH_PATH = "search_path=pg_catalog, public, extensions, pg_temp"


def ddl(kind, name):
    m = re.search(rf"CREATE {kind} public\.{re.escape(name)} (?:\(\n.*?\n\);|AS\n.*?;)\n", BASE, re.S)
    assert m, name
    return m.group(0)


def func(name):
    m = re.search(rf"CREATE FUNCTION public\.{name}\(.*?\$\$;\n", BASE, re.S)
    assert m, name
    return m.group(0)


def schema():
    enum = re.search(r'CREATE TYPE public\."NHL_Position_Code" AS ENUM \(.*?\);\n', BASE, re.S).group(0)
    parts = ["create role anon; create role authenticated; create role service_role; create schema extensions;", enum]
    parts += [ddl("TABLE", t) for t in ["games", "wgo_skater_stats", '"skatersGameStats"', '"teamGameStats"',
                                        "nst_team_stats", "nhl_standings_details", "yahoo_matchup_weeks"]]
    # Stand-in for the wigo_goalies view (only the columns goalie_weekly_aggregates reads).
    parts.append("create table public.wigo_goalies (goalie_id bigint, goalie_name text, team text, season integer, date date,"
                 " games_played integer, games_started integer, wins integer, losses integer, ot_losses integer, saves integer,"
                 " shots_against integer, goals_against integer, shutouts integer, time_on_ice_seconds double precision);")
    parts += [ddl("VIEW", "nhl_team_data"), ddl("VIEW", '"gameOutcomes"'), ddl("VIEW", "goalie_weekly_aggregates"),
              ddl("VIEW", "league_weekly_goalie_averages")]
    parts += [func("get_skater_game_scores_for_season"), func("get_skaters_avg_stats")]
    for f in ["get_skater_game_scores_for_season(integer,integer)", "get_skaters_avg_stats(date,date)"]:
        parts.append(f"alter function public.{f} set search_path = pg_catalog, public, extensions, pg_temp;")
    for role in ["anon", "authenticated", "service_role"]:
        parts.append(f"GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public.nhl_team_data TO {role};")
    return "\n".join(parts)


def fixture(cur, nst_order):
    games = [(1, "2024-10-10", 20242025, 2), (2, "2024-10-12", 20242025, 2), (3, "2024-09-28", 20242025, 1),
             (4, "2025-04-25", 20242025, 3), (10, "2026-10-20", 20262027, 2), (11, "2026-10-21", 20262027, 2)]
    for g in games:
        cur.execute('insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values (%s,%s,%s,%s,1,2)', g)
    # Game Score rows for player 1 labelled 20242025: two real regular-season games (one matched by game_id,
    # one by date with no game_id), a 2015 row carrying the bad label, and a playoff game.
    for i, (d, gid) in enumerate([("2024-10-10", 1), ("2024-10-12", None), ("2015-01-01", None), ("2025-04-25", 4)]):
        cur.execute("insert into public.wgo_skater_stats (id, player_id, player_name, date, season_id, game_id, goals,"
                    " total_primary_assists, total_secondary_assists, shots, blocked_shots, penalties_drawn, penalties,"
                    " total_fow, total_fol, sat_for, sat_against, es_goals_for, pp_goals_for, sh_goals_for,"
                    " es_goals_against, pp_goals_against, sh_goals_against)"
                    " values (%s,1,'P',%s,20242025,%s,1,0,0,2,0,0,0,0,0,10,8,1,0,0,0,0,0)", (i + 1, d, gid))
    # skatersGameStats for player 1: preseason (3 goals) and two regular-season games (1 and 0 goals).
    for gid, goals in [(3, 3), (1, 1), (2, 0)]:
        cur.execute('insert into public."skatersGameStats" ("playerId", "gameId", goals) values (1, %s, %s)', (gid, goals))
    # teamGameStats: game 10 final 3-2; game 11 stored level 0-0 (not a final result).
    for gid, team, score in [(10, 1, 3), (10, 2, 2), (11, 1, 0), (11, 2, 0)]:
        cur.execute('insert into public."teamGameStats" ("gameId", "teamId", score) values (%s,%s,%s)', (gid, team, score))
    # Standings on the latest date, season 20262027: ANA 10 GP, BOS 10 GP, CAR 0 GP.
    for team, gp in [("ANA", 10), ("BOS", 10), ("CAR", 0)]:
        cur.execute("insert into public.nhl_standings_details (season_id, date, team_abbrev, games_played, goal_for, goal_against)"
                    " values (20262027, '2026-10-21', %s, %s, %s, %s)", (team, gp, 3 * gp, 2 * gp))
    # NST: ANA has last season at 10 GP (an exact old match on implied GP) and this season one game behind (9 GP);
    # BOS has only last season (current season missing).
    nst = [("ANA", 20252026, 10, 40, 30, "2026-04-18"), ("ANA", 20262027, 9, 27, 18, "2026-10-21"),
           ("BOS", 20252026, 10, 25, 25, "2026-04-18")]
    for team, season, gp, xgf, xga, upd in (nst if nst_order == "forward" else list(reversed(nst))):
        cur.execute("insert into public.nst_team_stats (team_abbreviation, team_name, season, gp, xgf, xga, sf, sa, updated_at)"
                    " values (%s,%s,%s,%s,%s,%s,0,0,%s)", (team, team, season, gp, xgf, xga, upd))
    # Goalie weekly: goalie 1 plays 20 minutes of relief with no shots against in week 1.
    cur.execute("insert into public.yahoo_matchup_weeks (id, game_key, season, week, start_date, end_date)"
                " values (1, 'nhl', '2026', 1, '2026-10-06', '2026-10-12')")
    cur.execute("insert into public.wigo_goalies values (1, 'G', 'ANA', 20262027, '2026-10-08', 1, 0, 0, 0, 0, 0, 0, 0, 0, 1200)")


def checks(cur, label):
    results = []

    def check(name, ok, detail):
        results.append((name, bool(ok)))
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name} — {detail}")

    cur.execute("select game_date::text from public.get_skater_game_scores_for_season(1, 20242025) order by 1")
    dates = [r[0] for r in cur.fetchall()]
    check("D3 Game Score: regular season of the requested season only", dates == ["2024-10-10", "2024-10-12"], f"dates={dates}")
    cur.execute("select avggoals, numgames from public.get_skaters_avg_stats('2024-09-01', '2025-06-30') where id = 1")
    avg, n = cur.fetchone()
    check("D8 avg stats: regular-season games only", n == 2 and float(avg) == 0.5, f"avggoals={avg} numgames={n} (want 0.5, 2)")
    cur.execute("select team_abbrev, count(*) from public.nhl_team_data group by 1 order by 1")
    counts = dict(cur.fetchall())
    check("D4 nhl_team_data: one row per team", counts == {"ANA": 1, "BOS": 1, "CAR": 1}, f"rows per team={counts}")
    cur.execute("select to_jsonb(d) from public.nhl_team_data d where team_abbrev = 'ANA'")
    ana = [r[0] for r in cur.fetchall()]
    check("D4 ANA joins its exact season (one-game lag beats an old exact match)",
          len(ana) == 1 and ana[0].get("nst_season") == 20262027 and float(ana[0]["xga_per_game"]) == 2.0,
          f"rows={[(r.get('nst_season'), r['xga_per_game']) for r in ana]} (want [(20262027, 2.0)])")
    cur.execute("select to_jsonb(d) from public.nhl_team_data d where team_abbrev = 'BOS'")
    bos = [r[0] for r in cur.fetchall()]
    check("D4 BOS missing current season stays unknown (no last-season prior)",
          len(bos) == 1 and bos[0]["xga"] is None and bos[0].get("nst_season", "absent") is None,
          f"rows={[(r.get('nst_season', 'absent'), r['xga']) for r in bos]} (want [(None, None)])")
    cur.execute("select to_jsonb(d) from public.nhl_team_data d where team_abbrev = 'ANA'")
    check("D4 as-of time of the joined NST row is exposed for historical cutoffs",
          len(ana) == 1 and str(ana[0].get("nst_updated_at", "")).startswith("2026-10-21"), f"nst_updated_at={[r.get('nst_updated_at') for r in ana]}")
    cur.execute("select goal_for_per_game from public.nhl_team_data where team_abbrev = 'CAR'")
    gfpg = cur.fetchone()[0]
    check("D4 zero GP per-game is unknown, not 0", gfpg is None, f"goal_for_per_game={gfpg}")
    cur.execute('select "teamId", outcome from public."gameOutcomes" where "gameId" = 11 order by 1')
    level = cur.fetchall()
    cur.execute('select "teamId", outcome from public."gameOutcomes" where "gameId" = 10 order by 1')
    final = cur.fetchall()
    check("D11 level stored score is not a result", level == [(1, None), (2, None)] and final == [(1, "WIN"), (2, "LOSS")],
          f"game11={level} game10={final}")
    cur.execute("select weekly_sv_pct from public.goalie_weekly_aggregates where goalie_id = 1")
    sv = cur.fetchone()[0]
    cur.execute("select avg_league_weekly_sv_pct from public.league_weekly_goalie_averages")
    lsv = cur.fetchone()[0]
    check("D14 goalie SV% with zero shots against is unknown", sv is None and lsv is None, f"goalie={sv} league={lsv}")
    return results


def props(cur):
    cur.execute("select proname, prosecdef, proconfig, pg_get_function_result(oid), pg_get_function_arguments(oid) from pg_proc"
                " where proname in ('get_skater_game_scores_for_season', 'get_skaters_avg_stats') order by 1")
    return cur.fetchall()


def run_db(sock, env, nst_order):
    data = Path(tempfile.mkdtemp(prefix=f"l4areaders-{nst_order}-")) / "data"
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
        fixture(cur, nst_order)
        props_before = props(cur)
        print(f"phase 1 ({nst_order} NST order): baseline (defects must reproduce)")
        base = checks(cur, "baseline")
        if any(p for _, p in base):
            ok = False
            print("  ERROR: a check passed on the baseline")
        print(f"phase 2 ({nst_order}): apply {len(FIXES)} migrations singly")
        for f in FIXES:
            cur.execute(f.read_text())
        fixed = checks(cur, "fixed")
        ok &= all(p for _, p in fixed)
        props_after = props(cur)
        same = [p[:2] + p[3:] for p in props_after] == [p[:2] + p[3:] for p in props_before] and \
            all(p[2] == [SEARCH_PATH] for p in props_after)
        print(f"  {'PASS' if same else 'FAIL'} function signatures, return types, SECURITY DEFINER and search_path kept")
        ok &= same
        for f in FIXES:
            cur.execute(f.read_text())
        print("  PASS migrations re-apply")
        print(f"phase 3 ({nst_order}): rollback file")
        cur.execute(ROLLBACK.read_text())
        rolled = checks(cur, "rollback")
        restored = [p for _, p in rolled] == [p for _, p in base] and props(cur) == props_before
        print(f"  {'PASS' if restored else 'FAIL'} rollback restores baseline answers and function properties")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    return ok


def main():
    assert len(FIXES) == 5, FIXES
    sock = Path(tempfile.mkdtemp(prefix="l4areaders-sock-"))
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    ok = run_db(sock, env, "forward") and run_db(sock, env, "reversed")
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
