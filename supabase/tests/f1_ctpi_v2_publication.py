#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261113160000_team_ctpi_daily_v2_publication.sql (follow-up lane F1,
CTPI v2 publication). Never applied to a hosted database.

public.team_ctpi_daily is built from the production baseline (20260716112908): table, (season_id, team, date)
primary key, date/team indexes, RLS, the public_read policy and grants; two issued v1 rows.
Defect checks (FAIL before, PASS after): a v2 row for an issued v1 date is stored beside it (upsert on
season_id, team, date, ctpi_version) and the v1 row is unchanged; a v2 row with unknown components is stored;
a v1 insert and a v1 update are refused (55000); an insert without a version is refused (23502); version 3 is
refused (23514); the v1 writer's old conflict target fails closed (42P10).
Controls (PASS before and after): issued v1 rows unchanged; ctpi_raw and ctpi_0_to_100 still NOT NULL (23502);
RLS, policy, grants and the date/team indexes unchanged.
Also: the migration re-applies cleanly after order 56 (components already nullable); a v2 row can be re-upserted;
rollback refuses (55000) while a v2 row is stored and changes nothing; on a database without v2 rows it restores
the starting state except that the five components stay nullable (order 56's change, state unknown).
Run: LC_ALL=C python3 -I supabase/tests/f1_ctpi_v2_publication.py (needs Homebrew postgresql@15 and psycopg2).
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
ORDER56 = ROOT / "supabase/migrations/20260828142331_recent_team_form_nullable_components.sql"
FIX = ROOT / "supabase/migrations/20261113160000_team_ctpi_daily_v2_publication.sql"
ROLLBACK = ROOT / "supabase/tests/f1_ctpi_v2_publication_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55514
T = "team_ctpi_daily"
COMPONENTS = ("offense", "defense", "goaltending", "special_teams", "luck")


def schema():
    table = re.search(rf"CREATE TABLE public\.{T} \(\n.*?\n\);\n", BASE, re.S)
    assert table
    stmts = [table.group(0)]
    for pattern in (rf"ALTER TABLE ONLY public\.{T}\n    ADD CONSTRAINT {T}_pkey PRIMARY KEY \(season_id, team, date\);",
                    rf"CREATE INDEX idx_{T}_date ON public\.{T} USING btree \(date\);",
                    rf"CREATE INDEX idx_{T}_team ON public\.{T} USING btree \(team\);",
                    rf"CREATE POLICY public_read ON public\.{T} FOR SELECT TO anon, authenticated USING \(true\);",
                    rf"ALTER TABLE public\.{T} ENABLE ROW LEVEL SECURITY;",
                    rf"GRANT SELECT ON TABLE public\.{T} TO anon;",
                    rf"GRANT SELECT ON TABLE public\.{T} TO authenticated;",
                    rf"GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public\.{T} TO service_role;"):
        found = re.search(pattern, BASE)
        assert found, pattern
        stmts.append(found.group(0))
    return "\n".join([
        "create schema fhfh_internal;",
        "revoke all on schema fhfh_internal from public, anon, authenticated, service_role;",
        *stmts,
    ])


V1_ROWS = [("MTL", 51.0), ("TOR", 47.5)]


def row_sql(team, date="2026-11-10", score="55", components="0.1", version=None, conflict=None, raw="0.2"):
    cols = "season_id, team, date, computed_at, ctpi_raw, ctpi_0_to_100, offense, defense, goaltending, special_teams, luck, payload"
    formula = "recent-team-form-v2-candidate-2" if version == 2 else "ctpi-formula-v1"
    vals = (f"20262027, '{team}', '{date}', '2026-11-11 10:10+00', {raw}, {score}, " + ", ".join([components] * 5)
            + f", '{{\"formulaVersion\": \"{formula}\"}}'::jsonb")
    if version is not None:
        cols += ", ctpi_version"
        vals += f", {version}"
    sql = f"insert into public.{T} ({cols}) values ({vals})"
    if conflict:
        sql += f" on conflict ({conflict}) do update set ctpi_0_to_100 = excluded.ctpi_0_to_100, payload = excluded.payload"
    return sql


def seed(cur):
    for team, score in V1_ROWS:
        cur.execute(row_sql(team, score=str(score)))


def attempt(cur, sql, keep=False):
    cur.execute("begin")
    try:
        cur.execute(sql)
        return None
    except psycopg2.Error as e:
        return e.pgcode
    finally:
        cur.execute("rollback" if not keep else "commit")


def v1_rows(cur):
    cur.execute(f"select team, date::text, ctpi_0_to_100, payload->>'formulaVersion' from public.{T}"
                " where payload->>'formulaVersion' = 'ctpi-formula-v1' order by team")
    return cur.fetchall()


def state(cur):
    cur.execute("select column_name, data_type, is_nullable, column_default from information_schema.columns"
                " where table_schema = 'public' and table_name = %s order by ordinal_position", (T,))
    cols = cur.fetchall()
    cur.execute(f"select conname, pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint"
                f" where conrelid = 'public.{T}'::regclass order by 1")
    cons = cur.fetchall()
    cur.execute(f"select tgname from pg_catalog.pg_trigger where tgrelid = 'public.{T}'::regclass and not tgisinternal order by 1")
    trig = cur.fetchall()
    cur.execute(f"select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = '{T}' order by 1")
    idx = cur.fetchall()
    cur.execute(f"select polname, polcmd, pg_catalog.pg_get_expr(polqual, polrelid) from pg_catalog.pg_policy"
                f" where polrelid = 'public.{T}'::regclass order by 1")
    pol = cur.fetchall()
    cur.execute(f"select relrowsecurity, relforcerowsecurity, relacl::text from pg_catalog.pg_class where oid = 'public.{T}'::regclass")
    return cols, cons, trig, idx, pol, cur.fetchone()


def has_version(cur):
    cur.execute("select exists (select 1 from information_schema.columns where table_name = %s and column_name = 'ctpi_version')", (T,))
    return cur.fetchone()[0]


def checks(cur, label, start_rows):
    versioned = has_version(cur)
    new_key = "season_id, team, date, ctpi_version"
    # D1: a v2 row for an issued v1 date is stored beside it, and the v1 row is unchanged.
    cur.execute("begin")
    try:
        cur.execute(row_sql("MTL", score="62", version=2, conflict=new_key))
        cur.execute(f"select count(*) from public.{T} where team = 'MTL' and date = '2026-11-10'")
        both = cur.fetchone()[0] == 2 and v1_rows(cur) == start_rows
    except psycopg2.Error:
        both = False
    finally:
        cur.execute("rollback")
    null_components = attempt(cur, row_sql("BOS", components="null", version=2)) if versioned else "42703"
    v1_insert = attempt(cur, row_sql("BOS", version=1)) if versioned else attempt(cur, row_sql("BOS"))
    v1_update = attempt(cur, f"update public.{T} set ctpi_0_to_100 = 99 where team = 'MTL'")
    no_version = attempt(cur, row_sql("BOS"))
    bad_version = attempt(cur, row_sql("BOS", version=3)) if versioned else "42703"
    old_writer = attempt(cur, row_sql("MTL", score="70", conflict="season_id, team, date"))
    defects = [
        ("v2 row for an issued v1 date stored beside it; v1 row unchanged", both, ""),
        ("v2 row with unknown components stored", null_components is None, str(null_components)),
        ("v1 insert refused (55000)", v1_insert == "55000", str(v1_insert)),
        ("v1 update refused (55000)", v1_update == "55000", str(v1_update)),
        ("insert without a version refused (23502)", no_version == "23502", str(no_version)),
        ("version 3 refused (23514)", bad_version == "23514", str(bad_version)),
        ("old v1 writer conflict target fails closed (42P10)", old_writer == "42P10", str(old_writer)),
    ]
    raw_null = attempt(cur, row_sql("BOS", raw="null", version=2 if versioned else None))
    score_null = attempt(cur, row_sql("BOS", score="null", version=2 if versioned else None))
    controls = [
        ("issued v1 rows unchanged", v1_rows(cur) == start_rows, ""),
        ("ctpi_raw and ctpi_0_to_100 still NOT NULL (23502)", (raw_null, score_null) == ("23502", "23502"),
         str((raw_null, score_null))),
    ]
    for name, ok, detail in defects + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name}{' — ' + detail if detail else ''}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls]


def connect(sock, db):
    conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname=db)
    conn.autocommit = True
    return conn, conn.cursor()


def fresh(sock, admin, name, order56=False):
    admin.execute(f"create database {name}")
    conn, cur = connect(sock, name)
    cur.execute(schema())
    if order56:
        cur.execute(ORDER56.read_text())
    seed(cur)
    return conn, cur


def main():
    tmp = Path(tempfile.mkdtemp(prefix="f1ctpiv2-"))
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
        admin_conn, admin = connect(sock, "postgres")
        admin.execute("create role anon; create role authenticated; create role service_role")

        conn, cur = fresh(sock, admin, "main")
        st0, rows0 = state(cur), v1_rows(cur)
        print("phase 1: starting state (production baseline 20260716112908)")
        d0, c0 = checks(cur, "before", rows0)
        ok &= not any(d0) and all(c0)

        print("phase 2: apply the migration")
        cur.execute(FIX.read_text())
        d1, c1 = checks(cur, "fixed", rows0)
        ok &= all(d1) and all(c1)
        st1 = state(cur)
        nullable = all(c[2] == "YES" for c in st1[0] if c[0] in COMPONENTS)
        version_col = [c for c in st1[0] if c[0] == "ctpi_version"] == [("ctpi_version", "smallint", "NO", None)]
        cons = dict(st1[1])
        key = cons.get(f"{T}_pkey") == "PRIMARY KEY (season_id, team, date, ctpi_version)" and \
            cons.get(f"{T}_ctpi_version_check") == "CHECK ((ctpi_version = ANY (ARRAY[1, 2])))" and len(cons) == 2
        rest = st1[2] == [(f"{T}_v1_frozen",)] and st1[3][0] == st0[3][0] and st1[3][1] == st0[3][1] \
            and st1[4:] == st0[4:]
        cur.execute(f"select ctpi_version, count(*) from public.{T} group by 1")
        labelled = cur.fetchall() == [(1, len(V1_ROWS))]
        for name, good, detail in [
            ("components nullable", nullable, ""),
            ("ctpi_version smallint NOT NULL, no default", version_col, ""),
            ("key (season_id, team, date, ctpi_version) and CHECK (1, 2)", key, str(cons)),
            ("trigger added; date/team indexes, policy, RLS and grants unchanged", rest, str(st1[2:])),
            ("existing rows labelled v1", labelled, ""),
        ]:
            print(f"  {'PASS' if good else 'FAIL'} {name}{' — ' + detail if detail else ''}")
            ok &= good
        cur.execute(row_sql("MTL", score="62", version=2, conflict="season_id, team, date, ctpi_version"))
        cur.execute(row_sql("MTL", score="63", version=2, conflict="season_id, team, date, ctpi_version"))
        cur.execute(f"select ctpi_version, ctpi_0_to_100 from public.{T} where team = 'MTL' order by 1")
        reupsert = cur.fetchall() == [(1, 51.0), (2, 63.0)]
        print(f"  {'PASS' if reupsert else 'FAIL'} a v2 row re-upserts in place; the v1 row stays 51")
        ok &= reupsert

        print("phase 3: rollback with a v2 row stored")
        st_v2 = state(cur)
        try:
            cur.execute(ROLLBACK.read_text())
            refused = None
        except psycopg2.Error as e:
            refused = (e.pgcode, (e.pgerror or "").splitlines()[0])
            cur.execute("rollback") if conn.get_transaction_status() else None
        r_ok = refused is not None and refused[0] == "55000" and "F1_ROLLBACK_REFUSED" in refused[1] and state(cur) == st_v2
        print(f"  {'PASS' if r_ok else 'FAIL'} rollback refuses ({refused}) and changes nothing")
        ok &= r_ok
        conn.close()

        print("phase 4: migration after order 56 (components already nullable)")
        conn, cur = fresh(sock, admin, "after56", order56=True)
        try:
            cur.execute(FIX.read_text())
            d56, c56 = checks(cur, "after56", rows0)
            good = all(d56) and all(c56)
        except psycopg2.Error as e:
            print(f"  FAIL apply after order 56: {e.pgcode} {e.pgerror}")
            good = False
        print(f"  {'PASS' if good else 'FAIL'} re-applies cleanly after order 56")
        ok &= good
        conn.close()

        print("phase 5: rollback on a database with no v2 rows")
        conn, cur = fresh(sock, admin, "clean")
        cur.execute(FIX.read_text())
        cur.execute(ROLLBACK.read_text())
        st2 = state(cur)
        d2, c2 = checks(cur, "rollback", rows0)
        nulls_kept = [c for c in st2[0] if c[0] in COMPONENTS] == \
            [(c[0], c[1], "YES", c[3]) for c in st0[0] if c[0] in COMPONENTS]
        same_else = [c for c in st2[0] if c[0] not in COMPONENTS] == [c for c in st0[0] if c[0] not in COMPONENTS] \
            and st2[1:] == st0[1:]
        clean = nulls_kept and same_else and d2 == d0 and c2 == c0
        print(f"  {'PASS' if clean else 'FAIL'} rollback restores the starting state; components stay nullable")
        ok &= clean
        conn.close()
        admin_conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
