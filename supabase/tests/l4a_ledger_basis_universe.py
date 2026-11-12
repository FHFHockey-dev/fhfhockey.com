#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261112100000_add_forge_ledger_forecast_basis_and_universe.sql
(L10 ticket, decisions 41 and 78). Never applied to a hosted database.

Starting state is production's: the ledger from 20261021230025 (order 97) and 20261022181002 (order 99), with one
settled row already in it.
Defect checks (FAIL before, PASS after): the ledger stores both declared bases and rejects any other with a CHECK
violation; the universe table takes a full row, upserts on (served_date, player_id, game_id), bumps updated_at on
update, and rejects a bad player_class or a missing season_id; its RLS, policies, ACL and per-role privileges equal
the ledger's.
Controls (PASS before and after): the existing ledger row is unchanged (its forecast_basis reads NULL after),
the ledger's source CHECK still rejects a bad source, the scoreboard view answers the same, the ledger ACL is
unchanged. Rollback: the universe table is gone and the ledger's columns and constraints equal the starting state.
Run: LC_ALL=C python3 -I supabase/tests/l4a_ledger_basis_universe.py (needs Homebrew postgresql@15 and psycopg2).
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
LEDGER = [MIG / "20261021230025_forge_served_forecast_ledger.sql", MIG / "20261022181002_forge_served_forecast_ledger_market_source.sql"]
FIX = MIG / "20261112100000_add_forge_ledger_forecast_basis_and_universe.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_ledger_basis_universe_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55499
L = "public.forge_served_forecast_ledger"
U = "public.forge_served_forecast_universe"
LEDGER_REQ = "served_date, season_id, player_id, game_id, source, player_class, team_id, opponent_team_id, is_home, scheduled_at"
ROLES = ("anon", "authenticated", "service_role")
PRIVS = ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER")


def attempt(cur, sql, params=None):
    """Run sql in a transaction that is always rolled back; return None on success or the SQLSTATE."""
    cur.execute("begin")
    try:
        cur.execute(sql, params)
        return None
    except psycopg2.Error as e:
        return e.pgcode
    finally:
        cur.execute("rollback")


def one(cur, sql):
    try:
        cur.execute(sql)
        return cur.fetchall()
    except psycopg2.Error as e:
        return f"ERROR {e.pgcode}"


def ledger_row(source, basis_col="", basis_val=""):
    return (f"insert into {L} ({LEDGER_REQ}{basis_col}) values ('2026-11-12', 20262027, 8478402, 2026020250, '{source}',"
            f" 'skater', 22, 10, true, '2026-11-13 00:00+00'{basis_val})")


def acl(cur, table):
    cur.execute("select relrowsecurity, relforcerowsecurity, (select count(*) from pg_catalog.pg_policy p where p.polrelid = c.oid),"
                " pg_catalog.array_to_string(relacl, ',') from pg_catalog.pg_class c where c.oid = to_regclass(%s)", (table,))
    row = cur.fetchone()
    cur.execute("select r, p, has_table_privilege(r, %s, p) from unnest(%s::text[]) r, unnest(%s::text[]) p order by 1, 2",
                (table, list(ROLES), list(PRIVS))) if row else None
    return (row, cur.fetchall()) if row else None


def shape(cur):
    cur.execute("select column_name, data_type, is_nullable, column_default from information_schema.columns"
                " where table_schema = 'public' and table_name = 'forge_served_forecast_ledger' order by ordinal_position")
    cols = cur.fetchall()
    cur.execute(f"select conname, pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint where conrelid = '{L}'::regclass order by 1")
    return cols, cur.fetchall()


def universe_checks(cur):
    full = (f"insert into {U} (served_date, season_id, player_id, game_id, player_class, team_id, dressed, receipt, settled_at)"
            " values ('2026-11-12', 20262027, 8478402, 2026020250, 'skater', 22, null, null, null)")
    upsert = (full + " on conflict (served_date, player_id, game_id) do update set dressed = true,"
              " receipt = '{\"boxscore\": \"2026020250\"}'::jsonb, settled_at = now()")
    ins = attempt(cur, full + "; " + upsert)
    bad_class = attempt(cur, full.replace("'skater'", "'skaterx'"))
    no_season = attempt(cur, full.replace("20262027", "null"))
    bumped = False
    if ins is None:
        cur.execute(full)
        cur.execute(f"update {U} set dressed = true where player_id = 8478402")
        cur.execute(f"select updated_at > created_at, dressed from {U} where player_id = 8478402")
        bumped = cur.fetchone() == (True, True)
        cur.execute(f"delete from {U}")
    return ins, bad_class, no_season, bumped


def checks(cur, label, start):
    both = [attempt(cur, ledger_row("native", ", forecast_basis", f", '{b}'")) for b in ("unconditional", "conditional_dressed")]
    bad = attempt(cur, ledger_row("native", ", forecast_basis", ", 'bogus'"))
    u = acl(cur, U)
    ins, bad_class, no_season, bumped = universe_checks(cur) if u else ("absent",) * 3 + (False,)
    lg = acl(cur, L)
    same_acl = bool(u) and u[0][:3] == lg[0][:3] and u[1] == lg[1] and \
        u[0][3].replace("forge_served_forecast_universe", "") == lg[0][3].replace("forge_served_forecast_ledger", "")
    defects = [
        ("ledger stores 'unconditional' and 'conditional_dressed'", both == [None, None], str(both)),
        ("ledger rejects forecast_basis 'bogus' with a CHECK violation (23514)", bad == "23514", str(bad)),
        ("universe takes a full row and upserts on (served_date, player_id, game_id)", ins is None, str(ins)),
        ("universe set_updated_at trigger bumps updated_at on update", bumped, str(bumped)),
        ("universe rejects player_class 'skaterx' (23514) and a null season_id (23502)",
         (bad_class, no_season) == ("23514", "23502"), f"{bad_class}, {no_season}"),
        ("universe RLS, policies, ACL and per-role privileges equal the ledger's", same_acl, f"{u and u[0]} vs {lg[0]}"),
    ]
    existing = one(cur, f"select served_date, source, act_goals, settled_at is not null, dressed from {L} order by source")
    basis = one(cur, f"select forecast_basis from {L}")
    controls = [
        ("existing ledger row unchanged", existing == start["row"], str(existing)),
        ("existing row's forecast_basis is NULL (or the column is absent)", basis in ([(None,)], "ERROR 42703"), str(basis)),
        ("ledger source CHECK still rejects 'bogus_source'", attempt(cur, ledger_row("bogus_source")) == "23514", ""),
        ("scoreboard view answers the same", one(cur, "select * from public.forge_served_forecast_scoreboard_daily") == start["view"], ""),
        ("ledger ACL and privileges unchanged", lg == start["acl"], ""),
    ]
    for name, ok, detail in defects + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name}{' — ' + detail if detail else ''}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls]


def main():
    tmp = Path(tempfile.mkdtemp(prefix="l4aledger-"))
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
        m = re.search(r"CREATE FUNCTION public\.update_updated_at_column\(\) RETURNS trigger\n.*?\$\$;\n", BASE, re.S)
        cur.execute(m.group(0))
        # Platform posture since 20261020224500: no default grants on new objects.
        cur.execute("alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;")
        for f in LEDGER:
            cur.execute("begin; " + f.read_text() + "\ncommit;")
        cur.execute(f"insert into {L} ({LEDGER_REQ}, exp_goals, act_goals, dressed, settled_at) values ('2026-11-10', 20262027,"
                    " 8478402, 2026020230, 'bridge_exact', 'skater', 22, 10, true, '2026-11-11 00:00+00', 0.4, 1, true, now())")
        start = {"row": one(cur, f"select served_date, source, act_goals, settled_at is not null, dressed from {L} order by source"),
                 "view": one(cur, "select * from public.forge_served_forecast_scoreboard_daily"), "acl": acl(cur, L)}
        shape0 = shape(cur)
        print("phase 1: production state (orders 97 and 99)")
        d0, c0 = checks(cur, "before", start)
        ok &= not any(d0) and all(c0)
        print("phase 2: apply the migration")
        cur.execute(FIX.read_text())
        d1, c1 = checks(cur, "fixed", start)
        ok &= all(d1) and all(c1)
        cur.execute("select pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint"
                    " where conname = 'forge_served_forecast_ledger_forecast_basis_check'")
        cdef = cur.fetchone()[0]
        good = "forecast_basis" in cdef and "'unconditional'::text" in cdef and "'conditional_dressed'::text" in cdef
        print(f"  {'PASS' if good else 'FAIL'} READBACK constraint name and definition — {cdef}")
        ok &= good
        print("phase 3: rollback")
        cur.execute(ROLLBACK.read_text())
        d2, c2 = checks(cur, "rollback", start)
        restored = d2 == d0 and c2 == c0 and shape(cur) == shape0 and acl(cur, U) is None
        print(f"  {'PASS' if restored else 'FAIL'} rollback drops the universe table and restores the ledger's columns and constraints")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
