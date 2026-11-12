#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261112090000_guard_forge_league_skater_physical_totals_cutoff.sql
(L9a ticket, W2-1 C8). Never applied to a hosted database.

Starting state is production's: the baseline wgo_skater_stats table plus 20261020211500 (order 88, applied).
Fixture rows in wgo_skater_stats (all-situation, games_played = 1 unless noted):
  20262027: 2026-10-08 (C), 2026-10-15 (D) before the 2026-10-20 cutoff; 2026-10-25 (L) after it.
  20252026: 2025-11-01 (L), 2026-04-10 (D).
  20242025: 2024-12-01 (R) and 2025-04-15 (C), the 2025-04 row that a 2026-05-01 cutoff must never count.
  Noise that both bodies reject: a 20242025 row dated 2015-03-01, a games_played = 3 row, a 0-TOI row, a goalie.
Defect checks (FAIL on 20261020211500, PASS after): (20262027, '2026-05-01') and (20262027, '2026-08-31') return the
four zero rows; the 2025-04 row labelled 20242025 is not counted for the 2026-05-01 cutoff.
Controls (PASS before and after): (20262027, '2026-10-20') answers the hand-computed totals and is identical to the
20261020211500 answer; a 2026-09-01 cutoff still returns both prior seasons; an invalid season (20262028, and the
tiny id 5) returns zeros without error. After apply: STABLE, SECURITY INVOKER, search_path '', EXECUTE for
service_role only; prosrc differs from 88 by the one guard line. Rollback restores 88's body (prosrc md5).
Run: LC_ALL=C python3 -I supabase/tests/l4a_physical_totals_cutoff.py (needs Homebrew postgresql@15 and psycopg2).
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
APPLIED = ROOT / "supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql"
FIX = ROOT / "supabase/migrations/20261112090000_guard_forge_league_skater_physical_totals_cutoff.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_physical_totals_cutoff_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55498
FN = "public.forge_league_skater_physical_totals"
MD5_88 = "4d70925bd2a309b78daf0d3e0bf6b01c"
GUARD = "      and p_cutoff >= pg_catalog.make_date(p_season_id / 10000, 9, 1)"

# (season_id, date, position, games_played, toi_per_game, hits, blocked_shots)
ROWS = [
    (20262027, "2026-10-08", "C", 1, 1000, 3, 1), (20262027, "2026-10-15", "D", 1, 1400, 2, 4),
    (20262027, "2026-10-25", "L", 1, 900, 5, 0),
    (20252026, "2025-11-01", "L", 1, 1100, 4, 2), (20252026, "2026-04-10", "D", 1, 1500, 1, 3),
    (20242025, "2024-12-01", "R", 1, 950, 2, 1), (20242025, "2025-04-15", "C", 1, 1050, 7, 2),
    (20242025, "2015-03-01", "C", 1, 1000, 50, 50), (20252026, "2025-12-01", "C", 3, 3000, 60, 60),
    (20252026, "2025-12-02", "R", 1, 0, 70, 70), (20252026, "2025-12-03", "G", 1, 3600, 80, 80),
]
ZEROS = [("prior2", "D", 0, 0, 0, 0.0), ("prior2", "F", 0, 0, 0, 0.0), ("to_date", "D", 0, 0, 0, 0.0), ("to_date", "F", 0, 0, 0, 0.0)]
# Hand-computed answer for (20262027, '2026-10-20'): to_date F = 10-08 C, to_date D = 10-15 D;
# prior2 F = 2025-11-01 L + 2024-12-01 R + 2025-04-15 C; prior2 D = 2026-04-10 D.
OCT20 = [("prior2", "D", 1, 1, 3, 1500.0), ("prior2", "F", 3, 13, 5, 3100.0),
         ("to_date", "D", 1, 2, 4, 1400.0), ("to_date", "F", 1, 3, 1, 1000.0)]
SEP01 = [r if r[0] == "prior2" else (r[0], r[1], 0, 0, 0, 0.0) for r in OCT20]


def ddl(name):
    m = re.search(rf"CREATE TABLE public\.{name} \(\n.*?\n\);\n", BASE, re.S)
    assert m, name
    return m.group(0)


def call(cur, season, cutoff):
    try:
        cur.execute(f"select scope, position_group, player_games, hits, blocks, toi_seconds from {FN}(%s, %s)", (season, cutoff))
        return [tuple(r) for r in cur.fetchall()]
    except psycopg2.Error as e:
        return f"ERROR {e.pgerror.strip() if e.pgerror else e}"


def prosrc(cur):
    cur.execute(f"select md5(prosrc), prosrc from pg_catalog.pg_proc where oid = '{FN}(integer, date)'::pg_catalog.regprocedure")
    return cur.fetchone()


def checks(cur, label, base_oct20):
    may1, aug31, oct20 = call(cur, 20262027, "2026-05-01"), call(cur, 20262027, "2026-08-31"), call(cur, 20262027, "2026-10-20")
    prior_f = next((r for r in may1 if r[:2] == ("prior2", "F")), None) if isinstance(may1, list) else None
    defects = [
        ("(20262027, '2026-05-01') returns the four zero rows", may1 == ZEROS, str(may1)),
        ("(20262027, '2026-08-31') returns the four zero rows", aug31 == ZEROS, str(aug31)),
        ("the 2025-04 row labelled 20242025 is not counted for the 2026-05-01 cutoff",
         prior_f is not None and prior_f[3] < 7, f"prior2 F = {prior_f}"),
    ]
    sep1 = call(cur, 20262027, "2026-09-01")
    controls = [
        ("(20262027, '2026-10-20') answers the hand-computed totals", oct20 == OCT20, str(oct20)),
        ("(20262027, '2026-10-20') is identical to the 20261020211500 answer", oct20 == base_oct20, "same" if oct20 == base_oct20 else str(base_oct20)),
        ("(20262027, '2026-09-01') still returns both prior seasons", sep1 == SEP01, str(sep1)),
        ("invalid season (20262028) returns zeros", call(cur, 20262028, "2026-10-20") == ZEROS, ""),
        ("tiny invalid id (5) returns zeros without error", call(cur, 5, "2026-10-20") == ZEROS, str(call(cur, 5, "2026-10-20"))),
    ]
    for name, ok, detail in defects + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name}{' — ' + detail if detail else ''}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls]


def posture(cur):
    cur.execute("select provolatile, prosecdef, proconfig, has_function_privilege('anon', p.oid, 'EXECUTE'),"
                " has_function_privilege('authenticated', p.oid, 'EXECUTE'), has_function_privilege('service_role', p.oid, 'EXECUTE'),"
                " exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0)"
                f" from pg_catalog.pg_proc p where p.oid = '{FN}(integer, date)'::pg_catalog.regprocedure")
    return cur.fetchone()


def main():
    tmp = Path(tempfile.mkdtemp(prefix="l4aphys-"))
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
        cur.execute("create role anon; create role authenticated; create role service_role;")
        cur.execute(ddl("wgo_skater_stats"))
        for i, (s, d, pos, gp, toi, hits, blocks) in enumerate(ROWS, start=1):
            cur.execute("insert into public.wgo_skater_stats (id, player_id, player_name, date, season_id, position_code,"
                        " games_played, toi_per_game, hits, blocked_shots) values (%s, %s, 'x', %s, %s, %s, %s, %s, %s, %s)",
                        (i, i, d, s, pos, gp, toi, hits, blocks))
        cur.execute(APPLIED.read_text())
        md5_before, src_before = prosrc(cur)
        print(f"phase 1: production state (20261020211500); prosrc md5 {md5_before}")
        same88 = md5_before == MD5_88
        print(f"  {'PASS' if same88 else 'FAIL'} local body equals production's readback md5 {MD5_88}")
        base_oct20 = call(cur, 20262027, "2026-10-20")
        d0, c0 = checks(cur, "88", base_oct20)
        ok &= same88 and not any(d0) and all(c0)

        print("phase 2: apply the successor")
        cur.execute(FIX.read_text())
        d1, c1 = checks(cur, "fixed", base_oct20)
        ok &= all(d1) and all(c1)
        md5_after, src_after = prosrc(cur)
        one_line = src_after.replace(GUARD + "\n", "", 1) == src_before and src_after.count(GUARD) == 1
        print(f"  {'PASS' if one_line else 'FAIL'} prosrc differs from 88 by the one guard line; new md5 {md5_after}")
        header_md5 = f"expect md5 {md5_after}," in FIX.read_text()
        print(f"  {'PASS' if header_md5 else 'FAIL'} the migration's READBACK names that md5")
        pst = posture(cur)
        good = pst == ("s", False, ['search_path=""'], False, False, True, False)
        print(f"  {'PASS' if good else 'FAIL'} STABLE, SECURITY INVOKER, search_path '', EXECUTE service_role only — {pst}")
        ok &= one_line and header_md5 and good

        print("phase 3: rollback")
        cur.execute(ROLLBACK.read_text())
        d2, c2 = checks(cur, "rollback", base_oct20)
        restored = prosrc(cur)[0] == MD5_88 and d2 == d0 and c2 == c0 and posture(cur) == pst
        print(f"  {'PASS' if restored else 'FAIL'} rollback restores the 20261020211500 body (md5 {MD5_88}) and grants")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
