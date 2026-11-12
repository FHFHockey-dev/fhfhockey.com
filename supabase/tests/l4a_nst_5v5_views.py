#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261111181100_add_nst_seasonlong_5v5_views.sql
(L4b ticket: decision 15, W1 P0 #8 radar; decisions 69, rules 5 and 13). Never applied to a hosted database.

Season 20242025 in the 5v5 game-log tables:
  Player 1: two regular-season 5v5 rows (gp 1), one playoff row (games.type 3) and one aggregate row (gp 3 on a
    regular-season date). Only the two regular-season rows count.
  Player 2: two regular-season rows, one with goals unknown -> goals and goals_per_60 NULL, shots known.
  Player 3: one regular-season row with 0 TOI -> per-60 rates NULL, not 0.
Defect checks (FAIL on the baseline, where the views do not exist; PASS after): the radar columns of
nst_seasonlong_5v5_rates and nst_seasonlong_5v5_counts_oi answer the expected values.
Controls (PASS before and after): the es sibling answers unchanged. After apply: column names, order and types equal
the es siblings'; anon / authenticated / service_role can SELECT. Rollback drops the three views and leaves es intact.
Run: LC_ALL=C python3 -I supabase/tests/l4a_nst_5v5_views.py (needs Homebrew postgresql@15 and psycopg2).
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
FIX = ROOT / "supabase/migrations/20261111181100_add_nst_seasonlong_5v5_views.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_nst_5v5_views_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55497
S = 20242025
REG1, REG2, PLAYOFF, REG3 = "2024-11-01", "2024-11-05", "2025-05-01", "2024-11-08"
KINDS = ("counts", "counts_oi", "rates")

# individual: (player, date, gp, toi, goals, total_assists, total_points, shots, ixg, icf, hdcf, hits, pim)
IND = [(1, REG1, 1, 900, 1, 1, 2, 3, 0.4, 6, 2, 2, 2), (1, REG2, 1, 1080, 0, 1, 1, 2, 0.3, 4, 1, 1, 0),
       (1, PLAYOFF, 1, 1200, 2, 0, 2, 5, 0.9, 9, 3, 4, 2), (1, REG3, 3, 3000, 4, 2, 6, 9, 1.5, 20, 6, 5, 4),
       (2, REG1, 1, 960, 1, 0, 1, 2, 0.2, 3, 1, 0, 0), (2, REG2, 1, 1000, None, 1, 1, 4, 0.5, 6, 2, 1, 0),
       (3, REG1, 1, 0, 0, 0, 0, 0, 0.0, 0, 0, 0, 0)]
# on-ice: (player, date, gp, toi, cf, ca, ff, fa, sf, sa, gf, ga, xgf, xga, hdcf, hdca)
OI = [(1, REG1, 1, 900, 15, 10, 11, 8, 8, 6, 2, 1, 0.9, 0.6, 4, 3), (1, REG2, 1, 1080, 14, 16, 10, 12, 7, 9, 1, 1, 0.7, 0.8, 3, 4),
      (1, PLAYOFF, 1, 1200, 30, 5, 20, 4, 15, 3, 5, 0, 2.0, 0.2, 9, 1), (1, REG3, 3, 3000, 50, 50, 40, 40, 30, 30, 4, 4, 3.0, 3.0, 12, 12)]
OI_COLS = ["cf", "ca", "ff", "fa", "sf", "sa", "gf", "ga", "xgf", "xga", "hdcf", "hdca"]


def ddl(kind, name):
    m = re.search(rf"CREATE {kind} public\.{name} (?:\(\n.*?\n\);|AS\n.*?;)\n", BASE, re.S)
    assert m, name
    return m.group(0)


def schema():
    parts = ["create role anon; create role authenticated; create role service_role;", ddl("TABLE", "games")]
    parts += [ddl("TABLE", f"nst_gamelog_{s}_{k}") for s in ("es", "5v5") for k in ("counts", "counts_oi")]
    parts.append("do $$ declare r record; begin for r in select table_name from information_schema.columns"
                 " where table_schema = 'public' and column_name = 'id' and is_nullable = 'NO' loop"
                 " execute format('alter table public.%I alter column id drop not null', r.table_name); end loop; end $$;")
    parts += [ddl("VIEW", f"nst_seasonlong_es_{k}") for k in KINDS]
    # Platform posture since 20261020224500: no default grants on new objects.
    parts.append("alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;")
    return "\n".join(parts)


def fixture(cur):
    for gid, (d, t) in enumerate([(REG1, 2), (REG2, 2), (PLAYOFF, 3), (REG3, 2)], start=1):
        cur.execute('insert into public.games (id, date, "seasonId", type, "homeTeamId", "awayTeamId") values (%s, %s, %s, %s, 1, 2)',
                    (gid, d, S, t))
    for table in ("nst_gamelog_5v5_counts", "nst_gamelog_es_counts"):
        for p, d, gp, toi, g, a, pts, sh, ixg, icf, hdcf, hits, pim in IND:
            cur.execute(f"insert into public.{table} (player_id, date_scraped, season, gp, toi, goals, total_assists, total_points,"
                        " shots, ixg, icf, hdcf, hits, pim) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                        (p, d, S, gp, toi if table.endswith("5v5_counts") else toi * 2, g, a, pts, sh, ixg, icf, hdcf, hits, pim))
    for table in ("nst_gamelog_5v5_counts_oi", "nst_gamelog_es_counts_oi"):
        for row in OI:
            cur.execute(f"insert into public.{table} (player_id, date_scraped, season, gp, toi, {', '.join(OI_COLS)})"
                        f" values (%s, %s, {S}, %s, %s{', %s' * len(OI_COLS)})", row[:1] + row[1:2] + row[2:])


def near(a, b):
    return (a is None and b is None) or (a is not None and b is not None and abs(float(a) - float(b)) < 1e-9)


def fetch(cur, sql):
    try:
        cur.execute(sql)
        return cur.fetchall()
    except psycopg2.Error:
        cur.execute("rollback") if cur.connection.get_transaction_status() else None
        return None


RATE_COLS = ["toi_seconds", "goals_per_60", "total_assists_per_60", "total_points_per_60", "shots_per_60", "ixg_per_60",
             "icf_per_60", "ihdcf_per_60", "hits_per_60", "pim_per_60", "gp", "ipp"]


def checks(cur, label):
    rates = fetch(cur, f"select player_id, {', '.join(RATE_COLS)} from public.nst_seasonlong_5v5_rates where season = {S} order by 1")
    oi = fetch(cur, f"select player_id, toi_seconds_oi, {', '.join(OI_COLS)} from public.nst_seasonlong_5v5_counts_oi"
                    f" where season = {S} order by 1")
    r = {row[0]: dict(zip(RATE_COLS, row[1:])) for row in rates or []}
    o = {row[0]: row[1:] for row in oi or []}
    reg = [x for x in IND if x[0] == 1 and x[1] in (REG1, REG2)]
    toi = sum(x[3] for x in reg)
    per60 = lambda i: sum(x[i] for x in reg) * 3600 / toi  # noqa: E731
    want1 = {"toi_seconds": toi, "goals_per_60": per60(4), "total_assists_per_60": per60(5), "total_points_per_60": per60(6),
             "shots_per_60": per60(7), "ixg_per_60": per60(8), "icf_per_60": per60(9), "ihdcf_per_60": per60(10),
             "hits_per_60": per60(11), "pim_per_60": per60(12), "gp": 2}
    oi_reg = [x for x in OI if x[1] in (REG1, REG2)]
    want_oi = (sum(x[3] for x in oi_reg),) + tuple(sum(x[i] for x in oi_reg) for i in range(4, 16))
    want_ipp = sum(x[6] for x in reg) * 100 / sum(x[10] for x in oi_reg)
    p1 = r.get(1, {})
    defects = [
        ("5v5 rates: regular-season gp = 1 rows only (playoff and aggregate rejected)",
         bool(p1) and all(near(p1[k], v) for k, v in want1.items()), str({k: p1.get(k) for k in want1})),
        ("5v5 counts_oi: radar on-ice columns from regular-season rows only",
         1 in o and all(near(a, b) for a, b in zip(o[1], want_oi)), f"{o.get(1)} want {want_oi}"),
        ("IPP from the 5v5 on-ice GF", bool(p1) and near(p1["ipp"], want_ipp), f"{p1.get('ipp')} want {want_ipp}"),
        ("unknown goals stay unknown (goals_per_60 NULL, shots known)",
         2 in r and r[2]["goals_per_60"] is None and near(r[2]["shots_per_60"], 6 * 3600 / 1960), str(r.get(2))),
        ("zero TOI: per-60 rates NULL, not 0", 3 in r and r[3]["goals_per_60"] is None and r[3]["ixg_per_60"] is None, str(r.get(3))),
    ]
    es = fetch(cur, f"select player_id, toi_seconds, goals_per_60 from public.nst_seasonlong_es_rates where season = {S} order by 1")
    controls = [("es sibling answers unchanged", es == ES_BASE, f"{es}")]
    for name, ok, detail in defects + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name} — {detail}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls]


ES_BASE = None


def shape(cur, strength):
    cur.execute("select table_name, ordinal_position, column_name, data_type from information_schema.columns"
                " where table_schema = 'public' and table_name in %s order by 1, 2",
                (tuple(f"nst_seasonlong_{strength}_{k}" for k in KINDS),))
    return [(t.replace(f"_{strength}_", "_X_"), n, c, d) for t, n, c, d in cur.fetchall()]


def grants_ok(cur):
    cur.execute("select bool_and(has_table_privilege(r, format('public.nst_seasonlong_5v5_%s', k), 'SELECT'))"
                " from unnest(array['anon','authenticated','service_role']) r, unnest(array['counts','counts_oi','rates']) k")
    return cur.fetchone()[0] is True


def main():
    global ES_BASE
    tmp = Path(tempfile.mkdtemp(prefix="l4a5v5-"))
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
        cur.execute(f"select player_id, toi_seconds, goals_per_60 from public.nst_seasonlong_es_rates where season = {S} order by 1")
        ES_BASE = cur.fetchall()
        print("phase 1: baseline (no 5v5 season views)")
        d0, c0 = checks(cur, "baseline")
        ok &= not any(d0) and all(c0)
        print("phase 2: apply the migration")
        cur.execute(FIX.read_text())
        d1, c1 = checks(cur, "fixed")
        ok &= all(d1) and all(c1)
        same = shape(cur, "5v5") == shape(cur, "es")
        print(f"  {'PASS' if same else 'FAIL'} column names, order and types equal the es siblings'")
        g = grants_ok(cur)
        print(f"  {'PASS' if g else 'FAIL'} anon, authenticated and service_role can SELECT the three views")
        ok &= same and g
        print("phase 3: rollback")
        cur.execute(ROLLBACK.read_text())
        d2, c2 = checks(cur, "rollback")
        gone = shape(cur, "5v5") == []
        restored = d2 == d0 and c2 == c0 and gone
        print(f"  {'PASS' if restored else 'FAIL'} rollback drops the three views; es unchanged")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
