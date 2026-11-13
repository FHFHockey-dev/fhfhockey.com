#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261113170000_team_sos_daily_v2.sql (follow-up lane F2, SOS v2).
Never applied to a hosted database.

public.sos_standings is built from the production baseline (20260716112908): table, primary key, RLS, the
public_read policy and grants; two issued v1 rows.
Defect checks (FAIL before, PASS after): a v1 insert and a v1 update are refused (55000 SOS_V1_FROZEN);
public.team_sos_daily exists; a v2 row upserts on (season_id, snapshot_date, team_id, sos_version) and re-upserts in
place; another version for the same team and date is stored beside it.
Controls (PASS before and after): issued v1 rows unchanged; sos_standings RLS, policy and grants unchanged.
Also: team_sos_daily refuses a value outside [0, 1] or NaN, support above its fixture count, a snapshot_date that is
not the America/New_York date of cutoff_at, and a non-array opponent list (23514); unknown values may be NULL;
RLS is on, anon may read and may not write (42501); rollback refuses (55000) while a v2 row is stored and changes
nothing, and on a database without v2 rows restores the starting state.
Run: LC_ALL=C python3 -I supabase/tests/f2_team_sos_daily_v2.py (needs Homebrew postgresql@15 and psycopg2).
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
BASE = (ROOT / "supabase/migrations/20260716112908_production_schema_baseline.sql").read_text()
FIX = ROOT / "supabase/migrations/20261113170000_team_sos_daily_v2.sql"
ROLLBACK = ROOT / "supabase/tests/f2_team_sos_daily_v2_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55515
T = "sos_standings"
V2 = "team_sos_daily"


def schema():
    table = re.search(rf"CREATE TABLE public\.{T} \(\n.*?\n\);\n", BASE, re.S)
    assert table
    stmts = [table.group(0)]
    for pattern in (rf"ALTER TABLE ONLY public\.{T}\n    ADD CONSTRAINT {T}_pkey PRIMARY KEY \(season_id, game_date, team_id\);",
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


V1_SQL = (f"insert into public.{T} (season_id, game_date, team_id, team_abbrev, past_opponent_total_wins, "
          "past_opponent_total_losses, past_opponent_total_ot_losses) values ")


def seed(cur):
    cur.execute(V1_SQL + "(20252026, '2026-01-14', 24, 'ANA', 30, 20, 5), (20252026, '2026-01-14', 6, 'BOS', 28, 22, 4)")


def v1_rows(cur):
    cur.execute(f"select season_id, game_date::text, team_id, past_opponent_total_wins from public.{T} order by team_id")
    return cur.fetchall()


def attempt(cur, sql):
    cur.execute("begin")
    try:
        cur.execute(sql)
        return None
    except psycopg2.Error as e:
        return e.pgcode
    finally:
        cur.execute("rollback")


def v2_row(**overrides):
    """Same keys as the writer's TeamSosSnapshotRow (web/lib/trends/teamSosSnapshot.ts)."""
    row = {
        "season_id": 20252026, "snapshot_date": "2026-01-14", "team_id": 24, "team_abbrev": "ANA",
        "sos_version": "descriptive-sos-v2", "past_view": "past-retrospective",
        "cutoff_at": "2026-01-15T03:00:00.001Z",
        "past_fixtures": 2, "pending_fixtures": 2, "future_fixtures": 2,
        "past_direct_supported": 2, "past_indirect_supported": 2,
        "future_direct_supported": 2, "future_indirect_supported": 1,
        "past_direct_win_pct": 0.5, "past_indirect_win_pct": 0.5, "past_direct_points_pct": 0.625,
        "past_indirect_points_pct": 0.6, "future_direct_win_pct": 0.75, "future_indirect_win_pct": None,
        "future_direct_points_pct": 0.875, "future_indirect_points_pct": None,
        "past_opponents": [{"game_id": 2025020101, "opponent": "BOS", "starts_at": "2026-01-10T00:00:00.000Z"}],
        "future_opponents": [], "pending_games": [],
        "evidence": {"actualEndTimesSupplied": False, "schedulesFetched": 32},
    }
    row.update(overrides)
    return row


def upsert_sql(row):
    """What PostgREST runs for upsert(rows, { onConflict }): insert ... on conflict (...) do update."""
    payload = json.dumps(row).replace("'", "''")
    cols = ", ".join(row)
    updates = ", ".join(f"{c} = excluded.{c}" for c in row)
    return (f"insert into public.{V2} ({cols}) select {cols} from jsonb_populate_record(null::public.{V2}, '{payload}'::jsonb) "
            f"on conflict (season_id, snapshot_date, team_id, sos_version) do update set {updates}")


def state(cur):
    cur.execute("select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1")
    tables = cur.fetchall()
    cur.execute("select tablename, policyname, roles::text, cmd from pg_policies where schemaname = 'public' order by 1, 2")
    policies = cur.fetchall()
    cur.execute("select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) "
                "from information_schema.role_table_grants where table_schema = 'public' "
                "and grantee in ('anon', 'authenticated', 'service_role') group by 1, 2 order by 1, 2")
    grants = cur.fetchall()
    cur.execute(f"select tgname from pg_trigger where tgrelid = 'public.{T}'::regclass and not tgisinternal order by 1")
    triggers = cur.fetchall()
    return tables, policies, grants, triggers


def checks(cur, label, rows0):
    v1_insert = attempt(cur, V1_SQL + "(20252026, '2026-01-15', 24, 'ANA', 31, 20, 5)")
    v1_update = attempt(cur, f"update public.{T} set past_opponent_total_wins = 99 where team_id = 24")
    defects = [v1_insert == "55000", v1_update == "55000"]
    controls = [v1_rows(cur) == rows0]
    print(f"  [{label}] v1 insert -> {v1_insert}, v1 update -> {v1_update}, v1 rows unchanged -> {controls[0]}")
    return defects, controls


def connect(sock, db):
    conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname=db)
    conn.autocommit = True
    return conn, conn.cursor()


def fresh(sock, admin, name):
    admin.execute(f"create database {name}")
    conn, cur = connect(sock, name)
    cur.execute(schema())
    seed(cur)
    return conn, cur


def report(name, good, detail=""):
    print(f"  {'PASS' if good else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}")
    return good


def main():
    tmp = Path(tempfile.mkdtemp(prefix="f2sosv2-"))
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
        ok &= report("v1 writes accepted before (the defect) and rows unchanged by the probes", not any(d0) and all(c0))
        ok &= report("team_sos_daily absent before", attempt(cur, f"select 1 from public.{V2}") == "42P01")

        print("phase 2: apply the migration")
        cur.execute(FIX.read_text())
        d1, c1 = checks(cur, "fixed", rows0)
        ok &= report("v1 insert and update refused (55000); v1 rows unchanged", all(d1) and all(c1))
        st1 = state(cur)
        v1_same = [t for t in st1[0] if t[0] == T] == [t for t in st0[0] if t[0] == T] and \
            [p for p in st1[1] if p[0] == T] == [p for p in st0[1] if p[0] == T] and \
            [g for g in st1[2] if g[0] == T] == [g for g in st0[2] if g[0] == T] and st1[3] == [("sos_standings_v1_frozen",)]
        ok &= report("sos_standings RLS, policy and grants unchanged; freeze trigger added", v1_same, st1[3])
        v2_acl = [t for t in st1[0] if t[0] == V2] == [(V2, True)] and \
            [p for p in st1[1] if p[0] == V2] == [(V2, "public_read", "{anon,authenticated}", "SELECT")] and \
            [g for g in st1[2] if g[0] == V2] == [(V2, "anon", "SELECT"), (V2, "authenticated", "SELECT"),
                                                 (V2, "service_role", "DELETE,INSERT,SELECT,UPDATE")]
        ok &= report("team_sos_daily: RLS on, public_read, anon/authenticated SELECT, service_role CRUD", v2_acl,
                     [x for part in st1[:3] for x in part if x[0] == V2])
        cur.execute("select conname, pg_get_constraintdef(oid) from pg_constraint "
                    f"where conrelid = 'public.{V2}'::regclass and contype = 'p'")
        ok &= report("primary key (season_id, snapshot_date, team_id, sos_version)", cur.fetchall() ==
                     [(f"{V2}_pkey", "PRIMARY KEY (season_id, snapshot_date, team_id, sos_version)")])

        cur.execute(upsert_sql(v2_row()))
        cur.execute(upsert_sql(v2_row(past_fixtures=3, past_direct_supported=3, past_indirect_supported=3)))
        cur.execute(upsert_sql(v2_row(sos_version="descriptive-sos-v3", past_direct_win_pct=0.25)))
        cur.execute(f"select sos_version, past_fixtures, past_direct_win_pct, future_indirect_win_pct, "
                    f"jsonb_array_length(past_opponents) from public.{V2} order by 1")
        stored = cur.fetchall()
        ok &= report("v2 upsert re-upserts in place; another version is stored beside it; NULL stays NULL",
                     stored == [("descriptive-sos-v2", 3, 0.5, None, 1), ("descriptive-sos-v3", 2, 0.25, None, 1)], stored)

        refusals = {
            "win% above 1": attempt(cur, upsert_sql(v2_row(team_id=1, past_direct_win_pct=1.2))),
            "NaN": attempt(cur, upsert_sql(v2_row(team_id=1)).replace("'{", "'{", 1).replace(
                '"past_direct_win_pct": 0.5', '"past_direct_win_pct": "NaN"')),
            "support above fixtures": attempt(cur, upsert_sql(v2_row(team_id=1, past_direct_supported=5))),
            "snapshot_date not the ET date of cutoff": attempt(cur, upsert_sql(v2_row(team_id=1, snapshot_date="2026-01-15"))),
            "opponents not an array": attempt(cur, upsert_sql(v2_row(team_id=1, past_opponents={"BOS": 1}))),
            "unknown past view": attempt(cur, upsert_sql(v2_row(team_id=1, past_view="past"))),
        }
        ok &= report("refused with 23514: " + ", ".join(refusals), set(refusals.values()) == {"23514"}, refusals)

        cur.execute("begin; set local role anon")
        cur.execute(f"select count(*) from public.{V2}")
        anon_read = cur.fetchone()[0] == 2
        cur.execute("rollback")
        cur.execute("begin; set local role anon")
        try:
            cur.execute(upsert_sql(v2_row(team_id=2)))
            anon_write = None
        except psycopg2.Error as e:
            anon_write = e.pgcode
        cur.execute("rollback")
        ok &= report("anon reads (RLS policy) and cannot write (42501)", anon_read and anon_write == "42501", anon_write)

        print("phase 3: rollback with v2 rows stored")
        st_v2 = state(cur)
        try:
            cur.execute(ROLLBACK.read_text())
            refused = None
        except psycopg2.Error as e:
            refused = (e.pgcode, (e.pgerror or "").splitlines()[0])
            cur.execute("rollback") if conn.get_transaction_status() else None
        ok &= report(f"rollback refuses and changes nothing", refused is not None and refused[0] == "55000" and
                     "F2_ROLLBACK_REFUSED" in refused[1] and state(cur) == st_v2, refused)
        conn.close()

        print("phase 4: rollback on a database with no v2 rows")
        conn, cur = fresh(sock, admin, "clean")
        cur.execute(FIX.read_text())
        cur.execute(ROLLBACK.read_text())
        d2, c2 = checks(cur, "rollback", rows0)
        ok &= report("rollback restores the starting state", state(cur) == st0 and d2 == d0 and c2 == c0)
        conn.close()
        admin_conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
