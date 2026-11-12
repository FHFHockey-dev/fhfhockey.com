#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261111181000_fix_goalie_totals_nst_units_aggregate_gsaa.sql
(W2-P0-9, decision 10, rules 13 and 17). Never applied to a hosted database by this script.

Season 20242025, synthetic goalies built through the real source view (vw_goalie_stats_unified_source):
  Goalie 1: two games (Nov 1, Nov 3), NST per-game GSAA deliberately different from the decision-10 value.
  Goalie 2: two games on the same dates. Goalie 3: one game on Nov 10 (outside goalie 1's window, very low SV%).
  Goalie 4: Nov 1 with NST rows, Nov 3 without any NST row.
  Defect checks (must FAIL on the baseline view, PASS after):
    - NST GAA / shots / saves / xGA per 60 use minutes x 60 seconds (baseline: minutes read as seconds, 60x).
    - GSAA (all, 5v5, HD all, HD 5v5) = SA x league goals-per-shot over the same season, strength and the
      goalie's first-to-last date - GA (baseline: sum of NST per-game GSAA); goalie 3's game is outside the window.
    - GSAA/60 = aggregate GSAA x 60 / NST minutes.
    - Goalie 4 (one game without NST rows): every rewritten NST value is NULL (rule 13; baseline mixes games).
  Controls (must PASS before and after): official SV%, GAA (seconds), NST TOI/GA sums, games played; column names,
  order and types unchanged; the dependent snapshot materialized view refreshes; the rollback restores the
  baseline answers.
Run: LC_ALL=C python3 -I supabase/tests/l4a_goalie_totals.py (needs Homebrew postgresql@15 and psycopg2).
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
FIX = ROOT / "supabase/migrations/20261111181000_fix_goalie_totals_nst_units_aggregate_gsaa.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_goalie_totals_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55496
NST = [f"nst_gamelog_goalie_{s}_{k}" for s in ("5v5", "all", "ev", "pk", "pp") for k in ("counts", "rates")]
D1, D2, D3 = "2024-11-01", "2024-11-03", "2024-11-10"

# (goalie, date) -> {strength: (toi_min, sa, sv, nst_per_game_gsaa, xga, hd_sa, hd_sv, nst_per_game_hd_gsaa)}
GAMES = {
    (1, D1): {"all": (60.0, 30, 28, 0.70, 2.5, 8, 7, 0.20), "5v5": (48.0, 22, 21, 0.50, 1.8, 6, 6, 0.60)},
    (1, D2): {"all": (58.5, 20, 16, -2.20, 1.9, 5, 3, -1.10), "5v5": (45.0, 15, 12, -1.80, 1.4, 4, 2, -1.20)},
    (2, D1): {"all": (60.0, 35, 32, 0.10, 3.0, 9, 8, 0.10), "5v5": (50.0, 27, 25, 0.20, 2.2, 7, 6, 0.05)},
    (2, D2): {"all": (60.0, 25, 24, 1.30, 2.0, 6, 6, 0.90), "5v5": (49.0, 19, 19, 1.10, 1.5, 5, 5, 0.70)},
    (3, D3): {"all": (60.0, 40, 30, -6.00, 3.5, 12, 6, -4.00), "5v5": (50.0, 30, 22, -5.00, 2.8, 9, 4, -3.00)},
    (4, D1): {"all": (60.0, 28, 26, 0.40, 2.4, 7, 6, 0.30), "5v5": (47.0, 21, 20, 0.30, 1.7, 5, 5, 0.40)},
    (4, D2): None,
}


def ddl(kind, name):
    m = re.search(rf"CREATE {kind} public\.{name} (?:\(\n.*?\n\);|AS\n.*?;)\n", BASE, re.S)
    assert m, name
    return m.group(0)


def schema():
    enum = re.search(r'CREATE TYPE public\."NHL_Position_Code" AS ENUM \(.*?\);\n', BASE, re.S).group(0)
    parts = ["create role anon; create role authenticated; create role service_role;", enum,
             ddl("TABLE", "players"), ddl("TABLE", "wgo_goalie_stats")] + [ddl("TABLE", t) for t in NST]
    parts += [ddl("VIEW", "vw_goalie_stats_unified_source"), ddl("VIEW", "goalie_totals_unified"),
              ddl("MATERIALIZED VIEW", "goalie_totals_unified_snapshot")]
    return "\n".join(parts)


def fixture(cur):
    for (gid, d), strengths in GAMES.items():
        a = (strengths or GAMES[(1, D1)])["all"]
        cur.execute("insert into public.wgo_goalie_stats (goalie_id, goalie_name, date, season_id, games_played, games_started,"
                    " saves, goals_against, shots_against, time_on_ice) values (%s, %s, %s, 20242025, 1, 1, %s, %s, %s, 3600)",
                    (gid, f"G{gid}", d, a[2], a[1] - a[2], a[1]))
        if not strengths:
            continue
        for s, (toi, sa, sv, gsaa, xga, hsa, hsv, hgsaa) in strengths.items():
            cur.execute(f"insert into public.nst_gamelog_goalie_{s}_counts (player_id, date_scraped, season, gp, toi, shots_against,"
                        " saves, goals_against, gsaa, xg_against, hd_shots_against, hd_saves, hd_gsaa)"
                        " values (%s, %s, 20242025, 1, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                        (gid, d, toi, sa, sv, sa - sv, gsaa, xga, hsa, hsv, hgsaa))


def expected(gid, s, hd=False):
    games = [(d, v[s]) for (g, d), v in GAMES.items() if g == gid and v]
    first, last = min(d for d, _ in games), max(d for d, _ in games)
    league = [v[s] for (g, d), v in GAMES.items() if v and first <= d <= last]
    if hd:
        lg_ga, lg_sa = sum(x[5] - x[6] for x in league), sum(x[5] for x in league)
        sa, ga = sum(x[5] for _, x in games), sum(x[5] - x[6] for _, x in games)
    else:
        lg_ga, lg_sa = sum(x[1] - x[2] for x in league), sum(x[1] for x in league)
        sa, ga = sum(x[1] for _, x in games), sum(x[1] - x[2] for _, x in games)
    toi = sum(x[0] for _, x in games)
    gsaa = sa * lg_ga / lg_sa - ga
    return {"gsaa": gsaa, "gsaa60": gsaa * 60 / toi, "gaa": ga * 60 / toi, "toi": toi}


def near(a, b):
    return a is not None and b is not None and abs(float(a) - float(b)) < 1e-9


COLS = ["nst_all_gaa", "nst_all_shots_against_per_60", "nst_all_saves_per_60", "nst_all_gsaa_per_60",
        "nst_all_xg_against_per_60", "nst_5v5_gaa", "nst_5v5_gsaa_per_60", "nst_5v5_xg_against_per_60",
        "nst_all_gsaa", "nst_5v5_gsaa", "nst_all_hd_gsaa", "nst_5v5_hd_gsaa",
        "save_pct", "goals_against_avg", "nst_all_toi", "nst_all_goals_against", "games_played"]


def rows(cur):
    cur.execute(f"select player_id, {', '.join(COLS)} from public.goalie_totals_unified order by 1")
    return {r[0]: dict(zip(COLS, r[1:])) for r in cur.fetchall()}


def checks(cur, label):
    r = rows(cur)
    g1 = r[1]
    a, v = expected(1, "all"), expected(1, "5v5")
    ha, hv = expected(1, "all", hd=True), expected(1, "5v5", hd=True)
    games1 = [GAMES[(1, D1)], GAMES[(1, D2)]]
    sa = sum(x["all"][1] for x in games1)
    sv = sum(x["all"][2] for x in games1)
    xga = sum(x["all"][4] for x in games1)
    defects = [
        ("NST all GAA uses minutes x 60", near(g1["nst_all_gaa"], a["gaa"]), f"{g1['nst_all_gaa']} want {a['gaa']}"),
        ("NST 5v5 GAA uses minutes x 60", near(g1["nst_5v5_gaa"], v["gaa"]), f"{g1['nst_5v5_gaa']} want {v['gaa']}"),
        ("NST shots against / 60", near(g1["nst_all_shots_against_per_60"], sa * 60 / a["toi"]),
         f"{g1['nst_all_shots_against_per_60']}"),
        ("NST saves / 60", near(g1["nst_all_saves_per_60"], sv * 60 / a["toi"]), f"{g1['nst_all_saves_per_60']}"),
        ("NST xGA / 60", near(g1["nst_all_xg_against_per_60"], xga * 60 / a["toi"]), f"{g1['nst_all_xg_against_per_60']}"),
        ("aggregate GSAA (all) over the goalie's window", near(g1["nst_all_gsaa"], a["gsaa"]), f"{g1['nst_all_gsaa']} want {a['gsaa']}"),
        ("aggregate GSAA (5v5)", near(g1["nst_5v5_gsaa"], v["gsaa"]), f"{g1['nst_5v5_gsaa']} want {v['gsaa']}"),
        ("aggregate HD GSAA (all)", near(g1["nst_all_hd_gsaa"], ha["gsaa"]), f"{g1['nst_all_hd_gsaa']} want {ha['gsaa']}"),
        ("aggregate HD GSAA (5v5)", near(g1["nst_5v5_hd_gsaa"], hv["gsaa"]), f"{g1['nst_5v5_hd_gsaa']} want {hv['gsaa']}"),
        ("GSAA/60 (all) = GSAA x 60 / minutes", near(g1["nst_all_gsaa_per_60"], a["gsaa60"]), f"{g1['nst_all_gsaa_per_60']} want {a['gsaa60']}"),
        ("GSAA/60 (5v5)", near(g1["nst_5v5_gsaa_per_60"], v["gsaa60"]), f"{g1['nst_5v5_gsaa_per_60']} want {v['gsaa60']}"),
        ("one-game goalie outside the window: GSAA 0 against its own window", near(r[3]["nst_all_gsaa"], 0), f"{r[3]['nst_all_gsaa']}"),
        ("goalie with a game lacking NST rows: rewritten NST values NULL",
         all(r[4][c] is None for c in COLS[:12]), str({c: r[4][c] for c in COLS[:12] if r[4][c] is not None})),
    ]
    controls = [
        ("official SV% and GAA (seconds) unchanged", near(g1["save_pct"], sv / sa) and near(g1["goals_against_avg"], (sa - sv) * 3600 / 7200),
         f"{g1['save_pct']} {g1['goals_against_avg']}"),
        ("NST TOI (minutes) and GA sums unchanged", near(g1["nst_all_toi"], a["toi"]) and g1["nst_all_goals_against"] == sa - sv,
         f"{g1['nst_all_toi']} {g1['nst_all_goals_against']}"),
        ("games played", g1["games_played"] == 2 and r[4]["games_played"] == 2, f"{g1['games_played']} {r[4]['games_played']}"),
    ]
    for name, ok, detail in defects + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name} — {detail}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls]


def types(cur):
    cur.execute("select ordinal_position, column_name, data_type from information_schema.columns"
                " where table_name = 'goalie_totals_unified' order by 1")
    return cur.fetchall()


def snapshot_ok(cur):
    try:
        cur.execute("refresh materialized view public.goalie_totals_unified_snapshot")
        cur.execute("select count(*) from public.goalie_totals_unified_snapshot")
        return cur.fetchone()[0] == 4
    except psycopg2.Error as error:
        print("   ", error.pgerror.strip().splitlines()[0])
        return False


def main():
    tmp = Path(tempfile.mkdtemp(prefix="l4agoalie-"))
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
        print("phase 1: baseline view")
        d0, c0 = checks(cur, "baseline")
        ok &= not any(d0) and all(c0)
        print("phase 2: apply the migration (twice)")
        cur.execute(FIX.read_text())
        cur.execute(FIX.read_text())
        d1, c1 = checks(cur, "fixed")
        ok &= all(d1) and all(c1)
        same = types(cur) == before
        print(f"  {'PASS' if same else 'FAIL'} columns, order and types unchanged")
        snap = snapshot_ok(cur)
        print(f"  {'PASS' if snap else 'FAIL'} dependent snapshot materialized view still refreshes")
        ok &= same and snap
        print("phase 3: rollback")
        cur.execute(ROLLBACK.read_text())
        d2, c2 = checks(cur, "rollback")
        restored = d2 == d0 and c2 == c0 and types(cur) == before
        print(f"  {'PASS' if restored else 'FAIL'} rollback restores the baseline answers")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
