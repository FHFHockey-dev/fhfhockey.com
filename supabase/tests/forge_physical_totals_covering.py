#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261116010000_forge_physical_totals_covering_index.sql (order 155).
Never applied to a hosted database.

Starting state is production's: the baseline wgo_skater_stats table, 20261020211500 and 20261112090000 (order 137).
Rows: the L4a hand fixture plus about 120,000 deterministic pseudo-random rows over 2018-2027. They include null and
zero TOI, null hits and blocks, goalies, games_played 2, off-season and mislabelled dates, so each scope predicate and
the new date range are exercised at their edges.
Checks:
  - A 121-call matrix of (season, cutoff), valid and invalid, null included, gives the same answer (or the same error)
    before and after the migration, and after its rollback.
  - The index exists, is valid and has the exact definition. The header's CONCURRENTLY form builds the same index.
  - With the index, the function's own generic plan (auto_explain, nested) is an Index Only Scan on it.
  - Posture: STABLE, SECURITY INVOKER, search_path '', EXECUTE for service_role only.
  - The header's READBACK md5 is the applied prosrc md5.
  - Rollback restores 137's body (md5 0eec9782543c02db802b021c950ecf6e) and grants.
Run: LC_ALL=C python3 -I supabase/tests/forge_physical_totals_covering.py (needs Homebrew postgresql@15 and psycopg2).
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
M88 = ROOT / "supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql"
M137 = ROOT / "supabase/migrations/20261112090000_guard_forge_league_skater_physical_totals_cutoff.sql"
FIX = ROOT / "supabase/migrations/20261116010000_forge_physical_totals_covering_index.sql"
ROLLBACK = ROOT / "supabase/tests/forge_physical_totals_covering_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55497
FN = "public.forge_league_skater_physical_totals"
IDX = "idx_wgo_skater_stats_gp1_physical"
MD5_137 = "0eec9782543c02db802b021c950ecf6e"
IDX_DEF = ("CREATE INDEX idx_wgo_skater_stats_gp1_physical ON public.wgo_skater_stats USING btree (date) INCLUDE "
           "(season_id, position_code, toi_per_game, hits, blocked_shots) WHERE ((games_played = 1) AND (toi_per_game > "
           "(0)::double precision))")
CONCURRENT = ("create index concurrently if not exists idx_wgo_skater_stats_gp1_physical on public.wgo_skater_stats (date) "
              "include (season_id, position_code, toi_per_game, hits, blocked_shots) "
              "where games_played = 1 and toi_per_game > 0")

HAND = [
    (20262027, "2026-10-08", "C", 1, 1000, 3, 1), (20262027, "2026-10-15", "D", 1, 1400, 2, 4),
    (20262027, "2026-10-25", "L", 1, 900, 5, 0),
    (20252026, "2025-11-01", "L", 1, 1100, 4, 2), (20252026, "2026-04-10", "D", 1, 1500, 1, 3),
    (20242025, "2024-12-01", "R", 1, 950, 2, 1), (20242025, "2025-04-15", "C", 1, 1050, 7, 2),
    (20242025, "2015-03-01", "C", 1, 1000, 50, 50), (20252026, "2025-12-01", "C", 3, 3000, 60, 60),
    (20252026, "2025-12-02", "R", 1, 0, 70, 70), (20252026, "2025-12-03", "G", 1, 3600, 80, 80),
]
# Pseudo-random rows: a date anywhere in 2018-01-01 .. 2027-12-31 (off-season included), a season label that is
# usually right but sometimes the neighbouring season, and edge values in every filtered column.
BULK = """
insert into public.wgo_skater_stats (id, player_id, player_name, date, season_id, position_code, games_played,
  toi_per_game, hits, blocked_shots)
select 1000 + i, 8470000 + i % 1500, 'p', d,
  case when h % 23 = 0 then sy * 10000 + sy + 1 - 10001 else sy * 10000 + sy + 1 end,
  (array['C','L','R','D','G','D'])[1 + h % 6],
  case when h % 41 = 0 then 2 else 1 end,
  case when h % 9 = 0 then null when h % 31 = 0 then 0 when h % 37 = 0 then -5 else 200 + h % 1500 end,
  case when h % 11 = 0 then null else h % 9 end,
  case when h % 13 = 0 then null else h % 5 end
from generate_series(1, 120000) as i
cross join lateral (select (hashint4(i)::bigint % 1000000 + 1000000) as h) as hh
cross join lateral (select date '2018-01-01' + (h % 3652)::int as d) as dd
cross join lateral (select extract(year from d - interval '8 months')::int as sy) as ss
"""
SEASONS = [20262027, 20252026, 20242025, 20232024, 20272028, 20262028, 5, -20262027, 19001901, 29993000, None]
CUTOFFS = ["2026-08-31", "2026-09-01", "2026-10-20", "2026-11-15", "2027-04-15", "2027-08-31", "2027-09-01",
           "2025-10-20", "2024-11-15", "2019-01-01", None]


def ddl(name):
    m = re.search(rf"CREATE TABLE public\.{name} \(\n.*?\n\);\n", BASE, re.S)
    assert m, name
    return m.group(0)


def call(cur, season, cutoff):
    try:
        cur.execute(f"select scope, position_group, player_games, hits, blocks, toi_seconds from {FN}(%s::integer, %s::date)",
                    (season, cutoff))
        return [tuple(r) for r in cur.fetchall()]
    except psycopg2.Error as e:
        return f"ERROR {e.pgcode}"


def matrix(cur):
    return {(s, c): call(cur, s, c) for s in SEASONS for c in CUTOFFS}


def prosrc_md5(cur):
    cur.execute(f"select md5(prosrc) from pg_catalog.pg_proc where oid = '{FN}(integer, date)'::pg_catalog.regprocedure")
    return cur.fetchone()[0]


def posture(cur):
    cur.execute("select provolatile, prosecdef, proconfig, has_function_privilege('anon', p.oid, 'EXECUTE'),"
                " has_function_privilege('authenticated', p.oid, 'EXECUTE'), has_function_privilege('service_role', p.oid, 'EXECUTE'),"
                " exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0)"
                f" from pg_catalog.pg_proc p where p.oid = '{FN}(integer, date)'::pg_catalog.regprocedure")
    return cur.fetchone()


def index_state(cur):
    cur.execute("select pg_get_indexdef(i.indexrelid), i.indisvalid, i.indisready from pg_index i"
                f" where i.indexrelid = to_regclass('public.{IDX}')")
    return cur.fetchone()


def function_plan(conn):
    notices = []
    cur = conn.cursor()
    cur.execute("load 'auto_explain'; set auto_explain.log_min_duration = 0; set auto_explain.log_nested_statements = on;"
                " set client_min_messages = log;")
    conn.notices.clear()
    cur.execute(f"select count(*) from {FN}(20262027, '2026-11-15')")
    cur.fetchall()
    notices = "".join(conn.notices)
    cur.execute("reset client_min_messages; set auto_explain.log_min_duration = -1;")
    return notices


def main():
    tmp = Path(tempfile.mkdtemp(prefix="ptcov-"))
    data, sock = tmp / "data", tmp / "sock"
    sock.mkdir()
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"],
                   env=env, check=True, capture_output=True)
    subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"),
                    "-o", f"-p {PORT} -k {sock} -h '' -c random_page_cost=1.1 -c jit=off", "-w", "start"],
                   env=env, check=True, capture_output=True)
    ok = True

    def check(name, cond, detail=""):
        nonlocal ok
        ok &= bool(cond)
        print(f"  {'PASS' if cond else 'FAIL'} {name}{' — ' + detail if detail else ''}")

    try:
        conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="postgres")
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("create role anon; create role authenticated; create role service_role;")
        cur.execute(ddl("wgo_skater_stats"))
        for i, (s, d, pos, gp, toi, hits, blocks) in enumerate(HAND, start=1):
            cur.execute("insert into public.wgo_skater_stats (id, player_id, player_name, date, season_id, position_code,"
                        " games_played, toi_per_game, hits, blocked_shots) values (%s, %s, 'x', %s, %s, %s, %s, %s, %s, %s)",
                        (i, i, d, s, pos, gp, toi, hits, blocks))
        cur.execute(BULK)
        cur.execute("vacuum analyze public.wgo_skater_stats")
        cur.execute(M88.read_text())
        cur.execute(M137.read_text())
        print("phase 1: production state (137)")
        check(f"local body equals production's 137 readback md5 {MD5_137}", prosrc_md5(cur) == MD5_137)
        before = matrix(cur)
        live = sum(1 for v in before.values() if isinstance(v, list) and any(r[2] for r in v))
        errors = sorted({v for v in before.values() if isinstance(v, str)})
        print(f"  matrix: {len(before)} calls, {live} with non-zero counts, errors {errors or 'none'}")
        check("the matrix exercises real totals (at least 30 calls with non-zero counts)", live >= 30)
        pst = posture(cur)

        print("phase 2: apply 155 (index, then function)")
        cur.execute(FIX.read_text())
        st = index_state(cur)
        check("the index exists, is valid and has the exact definition", st == (IDX_DEF, True, True), str(st))
        after = matrix(cur)
        diff = [k for k in before if before[k] != after[k]]
        check(f"all {len(before)} calls answer exactly as before (including errors)", not diff, str(diff[:3]))
        md5_after = prosrc_md5(cur)
        check(f"the migration header's READBACK names prosrc md5 {md5_after}", f"expect md5 {md5_after}," in FIX.read_text())
        check("STABLE, SECURITY INVOKER, search_path '', EXECUTE for service_role only",
              posture(cur) == ("s", False, ['search_path=""'], False, False, True, False) and posture(cur) == pst, str(posture(cur)))
        cur.execute("vacuum analyze public.wgo_skater_stats")
        plan = function_plan(conn)
        check(f"the function's nested generic plan is an Index Only Scan using {IDX}",
              f"Index Only Scan using {IDX}" in plan, re.sub(r"\s+", " ", plan)[:300] if f"Index Only Scan using {IDX}" not in plan else "")

        print("phase 3: the header's CONCURRENTLY form builds the same index")
        cur.execute(f"drop index public.{IDX}")
        cur.execute("set statement_timeout = '15min'")
        cur.execute(CONCURRENT)
        cur.execute("reset statement_timeout")
        check("concurrent build: same definition, valid and ready", index_state(cur) == (IDX_DEF, True, True), str(index_state(cur)))
        check("answers unchanged after the concurrent rebuild", matrix(cur) == before)

        print("phase 4: rollback")
        cur.execute(ROLLBACK.read_text())
        cur.execute(f"drop index concurrently if exists public.{IDX}")
        check(f"rollback restores the 137 body (md5 {MD5_137}) and grants",
              prosrc_md5(cur) == MD5_137 and posture(cur) == pst)
        check("no index left", index_state(cur) is None)
        check("answers unchanged after rollback", matrix(cur) == before)
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
