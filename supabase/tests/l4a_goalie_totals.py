#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261111181000_fix_goalie_totals_nst_units_aggregate_gsaa.sql
(order 135: W2-P0-9, decision 10, rules 13 and 17) and its successor
20261112130000_goalie_totals_unified_regular_season.sql (order 141: decision 69). Never applied to a hosted database
by this script.

Season 20242025, synthetic goalies built through the real source view (vw_goalie_stats_unified_source):
  Goalie 1: two games (Nov 1, Nov 3), NST per-game GSAA deliberately different from the decision-10 value.
  Goalie 2: two games on the same dates. Goalie 3: one game on Nov 10 (outside goalie 1's window, very low SV%).
  Goalie 4: Nov 1 with NST rows, Nov 3 without any NST row.
  Goalie 5 (141): Nov 1 and Nov 3 regular-season games with NST, plus two playoff games (games.type 3): Apr 22
    without any NST row, Apr 24 with NST rows. Goalie 6 (141): one playoff game with NST rows only.
  Defect checks (must FAIL on the baseline view, PASS after):
    - NST GAA / shots / saves / xGA per 60 use minutes x 60 seconds (baseline: minutes read as seconds, 60x).
    - GSAA (all, 5v5, HD all, HD 5v5) = SA x league goals-per-shot over the same season, strength and the
      goalie's first-to-last date - GA (baseline: sum of NST per-game GSAA); goalie 3's game is outside the window.
    - GSAA/60 = aggregate GSAA x 60 / NST minutes.
    - Goalie 4 (one game without NST rows): every rewritten NST value is NULL (rule 13; baseline mixes games).
  141 defect checks (FAIL on baseline and on 135, PASS after 141): goalie 5's GP and official SV% count regular-season
    games only; its NST GAA and GSAA are present and equal the regular-season-only values (league window over
    regular-season games only); the playoff-only goalie 6 has no row.
  Controls (must PASS throughout): official SV%, GAA (seconds), NST TOI/GA sums, games played; goalies 1-4 (all
  regular-season) answer the same under 141 as under 135; column names, order and types unchanged; the dependent
  snapshot materialized view refreshes; the 141 rollback restores the 135 answers and the 135 rollback the baseline.
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
FIX141 = ROOT / "supabase/migrations/20261112130000_goalie_totals_unified_regular_season.sql"
ROLLBACK141 = ROOT / "supabase/tests/l4a_goalie_totals_regular_season_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55496
NST = [f"nst_gamelog_goalie_{s}_{k}" for s in ("5v5", "all", "ev", "pk", "pp") for k in ("counts", "rates")]
D1, D2, D3 = "2024-11-01", "2024-11-03", "2024-11-10"
P1, P2 = "2025-04-22", "2025-04-24"  # playoff dates (games.type 3)

# (goalie, date) -> {strength: (toi_min, sa, sv, nst_per_game_gsaa, xga, hd_sa, hd_sv, nst_per_game_hd_gsaa)}
GAMES = {
    (1, D1): {"all": (60.0, 30, 28, 0.70, 2.5, 8, 7, 0.20), "5v5": (48.0, 22, 21, 0.50, 1.8, 6, 6, 0.60)},
    (1, D2): {"all": (58.5, 20, 16, -2.20, 1.9, 5, 3, -1.10), "5v5": (45.0, 15, 12, -1.80, 1.4, 4, 2, -1.20)},
    (2, D1): {"all": (60.0, 35, 32, 0.10, 3.0, 9, 8, 0.10), "5v5": (50.0, 27, 25, 0.20, 2.2, 7, 6, 0.05)},
    (2, D2): {"all": (60.0, 25, 24, 1.30, 2.0, 6, 6, 0.90), "5v5": (49.0, 19, 19, 1.10, 1.5, 5, 5, 0.70)},
    (3, D3): {"all": (60.0, 40, 30, -6.00, 3.5, 12, 6, -4.00), "5v5": (50.0, 30, 22, -5.00, 2.8, 9, 4, -3.00)},
    (4, D1): {"all": (60.0, 28, 26, 0.40, 2.4, 7, 6, 0.30), "5v5": (47.0, 21, 20, 0.30, 1.7, 5, 5, 0.40)},
    (4, D2): None,
    (5, D1): {"all": (59.0, 26, 24, 0.30, 2.1, 7, 6, 0.10), "5v5": (46.0, 20, 19, 0.40, 1.6, 5, 5, 0.30)},
    (5, D2): {"all": (60.0, 31, 27, -0.90, 2.7, 9, 7, -0.60), "5v5": (49.0, 24, 21, -0.70, 2.0, 7, 5, -0.80)},
}
# Playoff appearances: (5, P1) has no NST row; (5, P2) and (6, P2) do.
PLAYOFF = {
    (5, P1): None,
    (5, P2): {"all": (60.0, 33, 25, -4.00, 3.1, 10, 5, -3.00), "5v5": (50.0, 25, 19, -3.00, 2.4, 8, 4, -2.00)},
    (6, P2): {"all": (60.0, 29, 28, 2.00, 2.2, 8, 8, 1.00), "5v5": (48.0, 22, 22, 1.50, 1.7, 6, 6, 0.80)},
}


def ddl(kind, name):
    m = re.search(rf"CREATE {kind} public\.{name} (?:\(\n.*?\n\);|AS\n.*?;)\n", BASE, re.S)
    assert m, name
    return m.group(0)


def schema():
    enum = re.search(r'CREATE TYPE public\."NHL_Position_Code" AS ENUM \(.*?\);\n', BASE, re.S).group(0)
    parts = ["create role anon; create role authenticated; create role service_role;", enum, ddl("TABLE", "games"),
             ddl("TABLE", "players"), ddl("TABLE", "wgo_goalie_stats")] + [ddl("TABLE", t) for t in NST]
    parts += [ddl("VIEW", "vw_goalie_stats_unified_source"), ddl("VIEW", "goalie_totals_unified"),
              ddl("MATERIALIZED VIEW", "goalie_totals_unified_snapshot")]
    return "\n".join(parts)


def fixture(cur):
    for n, (d, kind) in enumerate([(D1, 2), (D2, 2), (D3, 2), (P1, 3), (P2, 3)], start=1):
        cur.execute('insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values (%s, %s, 20242025, %s, 1, 2)',
                    (n, d, kind))
    for (gid, d), strengths in list(GAMES.items()) + list(PLAYOFF.items()):
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
    g5 = r.get(5, {})
    a5, v5 = expected(5, "all"), expected(5, "5v5")
    reg5 = [GAMES[(5, D1)]["all"], GAMES[(5, D2)]["all"]]
    d141 = [
        ("goalie 5: games played counts regular-season games only", g5.get("games_played") == 2, f"{g5.get('games_played')}"),
        ("goalie 5: official SV% from regular-season games only",
         near(g5.get("save_pct"), sum(x[2] for x in reg5) / sum(x[1] for x in reg5)), f"{g5.get('save_pct')}"),
        ("goalie 5: NST all GAA present, regular season only", near(g5.get("nst_all_gaa"), a5["gaa"]), f"{g5.get('nst_all_gaa')} want {a5['gaa']}"),
        ("goalie 5: NST 5v5 GAA present, regular season only", near(g5.get("nst_5v5_gaa"), v5["gaa"]), f"{g5.get('nst_5v5_gaa')} want {v5['gaa']}"),
        ("goalie 5: GSAA (all) over a regular-season league window", near(g5.get("nst_all_gsaa"), a5["gsaa"]), f"{g5.get('nst_all_gsaa')} want {a5['gsaa']}"),
        ("goalie 5: GSAA (5v5) over a regular-season league window", near(g5.get("nst_5v5_gsaa"), v5["gsaa"]), f"{g5.get('nst_5v5_gsaa')} want {v5['gsaa']}"),
        ("playoff-only goalie 6 has no row", 6 not in r, "present" if 6 in r else "absent"),
    ]
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
    for name, ok, detail in defects + d141 + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name} — {detail}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls], [ok for _, ok, _ in d141]


def types(cur):
    cur.execute("select ordinal_position, column_name, data_type from information_schema.columns"
                " where table_name = 'goalie_totals_unified' order by 1")
    return cur.fetchall()


def snapshot_ok(cur):
    try:
        cur.execute("refresh materialized view public.goalie_totals_unified_snapshot")
        cur.execute("select count(*) from public.goalie_totals_unified_snapshot")
        return cur.fetchone()[0] == len(rows(cur))
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
        d0, c0, n0 = checks(cur, "baseline")
        base_rows = rows(cur)
        ok &= not any(d0) and all(c0) and not any(n0)
        print("phase 2: apply 135 (production state since 2026-11-12)")
        cur.execute(FIX.read_text())
        d1, c1, n1 = checks(cur, "135")
        rows135 = rows(cur)
        ok &= all(d1) and all(c1) and not any(n1)
        print("phase 3: apply 141 (twice)")
        cur.execute(FIX141.read_text())
        cur.execute(FIX141.read_text())
        d2, c2, n2 = checks(cur, "141")
        ok &= all(d2) and all(c2) and all(n2)
        rows141 = rows(cur)
        kept = all(rows141[g] == rows135[g] for g in (1, 2, 3, 4))
        print(f"  {'PASS' if kept else 'FAIL'} goalies 1-4 (regular season only) answer the same as under 135")
        same = types(cur) == before
        print(f"  {'PASS' if same else 'FAIL'} columns, order and types unchanged")
        snap = snapshot_ok(cur)
        print(f"  {'PASS' if snap else 'FAIL'} dependent snapshot materialized view still refreshes")
        ok &= kept and same and snap
        print("phase 4: 141 rollback")
        cur.execute(ROLLBACK141.read_text())
        back135 = rows(cur) == rows135 and types(cur) == before
        print(f"  {'PASS' if back135 else 'FAIL'} 141 rollback restores the 135 answers")
        print("phase 5: 135 rollback")
        cur.execute(ROLLBACK.read_text())
        d3, c3, n3 = checks(cur, "rollback")
        restored = d3 == d0 and c3 == c0 and n3 == n0 and rows(cur) == base_rows and types(cur) == before
        print(f"  {'PASS' if restored else 'FAIL'} 135 rollback restores the baseline answers")
        ok &= back135 and restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
