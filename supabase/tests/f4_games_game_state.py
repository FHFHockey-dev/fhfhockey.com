#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261113180000_games_game_state.sql (follow-up lane F4, game finality).
Never applied to a hosted database.

public.games is built from the production baseline (20260716112908): table, primary key, RLS, the read policy,
grants, and the team_games view that reads it; two stored games.
Defect checks (FAIL before, PASS after): the schedule writer's upsert row, with its game state, game schedule state
and observation time, is stored (before: 42703, no column for a game state); a re-upsert moves the state in place
(FUT -> FINAL) and keeps the row's identity.
Controls (PASS before and after): stored game values unchanged; RLS, policy, grants and the team_games view
unchanged; a row without a state (unknown) is still accepted.
Also: unknown NHL states, a state without an observation time and an observation time without a state are refused
(23514); the column adds rewrite no row values; rollback restores the starting state.
Run: LC_ALL=C python3 -I supabase/tests/f4_games_game_state.py (needs Homebrew postgresql@15 and psycopg2).
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
FIX = ROOT / "supabase/migrations/20261113180000_games_game_state.sql"
ROLLBACK = ROOT / "supabase/tests/f4_games_game_state_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55516
T = "games"


def schema():
    stmts = []
    for pattern in (rf"CREATE TABLE public\.{T} \(\n.*?\n\);\n",
                    rf"ALTER TABLE ONLY public\.{T}\n    ADD CONSTRAINT {T}_pkey PRIMARY KEY \(id\);",
                    rf"ALTER TABLE public\.{T} ENABLE ROW LEVEL SECURITY;",
                    rf'CREATE POLICY "Enable read access for all users" ON public\.{T} FOR SELECT TO anon, authenticated USING \(true\);',
                    rf"GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public\.{T} TO anon;",
                    rf"GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public\.{T} TO authenticated;",
                    rf"GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE public\.{T} TO service_role;",
                    r"CREATE VIEW public\.team_games AS\n.*?FROM public\.games;\n"):
        found = re.search(pattern, BASE, re.S)
        assert found, pattern
        stmts.append(found.group(0))
    return "\n".join(stmts)


def seed(cur):
    cur.execute(f'insert into public.{T} (id, date, "seasonId", "startTime", type, created_at, "homeTeamId", "awayTeamId") '
                "values (2025020101, '2025-10-10', 20252026, '2025-10-10T23:00:00Z', 2, '2025-09-01T00:00:00Z', 10, 20), "
                "(2025020102, '2025-10-10', 20252026, '2025-10-11T02:00:00Z', 2, '2025-09-01T00:00:00Z', 30, 40)")


def rows(cur):
    cur.execute(f'select id, date::text, "seasonId", "startTime"::text, type, created_at::text, "homeTeamId", "awayTeamId" '
                f"from public.{T} order by id")
    return cur.fetchall()


def writer_row(**overrides):
    """Same keys as the schedule writer's games row (web/pages/api/v1/db/update-games.ts toGamesRow)."""
    row = {"id": 2025020101, "date": "2025-10-10", "seasonId": 20252026, "startTime": "2025-10-10T23:00:00Z", "type": 2,
           "homeTeamId": 10, "awayTeamId": 20, "game_state": "FUT", "game_schedule_state": "OK",
           "game_state_observed_at": "2025-10-10T03:00:05.000Z"}
    row.update(overrides)
    return row


def upsert_sql(row):
    """What PostgREST runs for upsert(rows) on the primary key: insert ... on conflict (id) do update."""
    payload = json.dumps(row).replace("'", "''")
    cols = ", ".join(f'"{c}"' for c in row)
    updates = ", ".join(f'"{c}" = excluded."{c}"' for c in row)
    return (f"insert into public.{T} ({cols}) select {cols} from jsonb_populate_record(null::public.{T}, '{payload}'::jsonb) "
            f"on conflict (id) do update set {updates}")


def attempt(cur, sql):
    cur.execute("begin")
    try:
        cur.execute(sql)
        return None
    except psycopg2.Error as e:
        return e.pgcode
    finally:
        cur.execute("rollback")


def state(cur):
    cur.execute(f"select rowsecurity from pg_tables where schemaname = 'public' and tablename = '{T}'")
    rls = cur.fetchall()
    cur.execute(f"select policyname, roles::text, cmd from pg_policies where schemaname = 'public' and tablename = '{T}'")
    policies = cur.fetchall()
    cur.execute("select grantee, string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants "
                f"where table_schema = 'public' and table_name = '{T}' and grantee in ('anon', 'authenticated', 'service_role') "
                "group by 1 order by 1")
    grants = cur.fetchall()
    cur.execute("select pg_get_viewdef('public.team_games'::regclass)")
    view = cur.fetchall()
    cur.execute("select column_name, data_type, is_nullable from information_schema.columns "
                f"where table_schema = 'public' and table_name = '{T}' order by ordinal_position")
    columns = cur.fetchall()
    return rls, policies, grants, view, columns


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


def checks(cur, label):
    """Defects: the writer's state row stores, and a later observation replaces it in place."""
    first = attempt(cur, upsert_sql(writer_row()))
    cur.execute("begin")
    moved = None
    try:
        cur.execute(upsert_sql(writer_row()))
        cur.execute(upsert_sql(writer_row(game_state="FINAL", game_state_observed_at="2025-10-11T03:00:04.000Z")))
        cur.execute(f"select id, game_state, game_state_observed_at::text, count(*) over () from public.{T} where id = 2025020101")
        moved = cur.fetchall()
    except psycopg2.Error as e:
        moved = e.pgcode
    finally:
        cur.execute("rollback")
    unknown = attempt(cur, upsert_sql({k: v for k, v in writer_row(id=2025020199).items() if not k.startswith("game_")}))
    print(f"  [{label}] state upsert -> {first}, re-upsert -> {moved}, unknown-state row -> {unknown}")
    return [first is None, moved == [(2025020101, "FINAL", "2025-10-11 03:00:04+00", 1)]], [unknown is None]


def main():
    tmp = Path(tempfile.mkdtemp(prefix="f4gamestate-"))
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
        admin.execute("alter system set timezone = 'UTC'")
        admin.execute("select pg_reload_conf()")

        conn, cur = fresh(sock, admin, "main")
        st0, rows0 = state(cur), rows(cur)
        print("phase 1: starting state (production baseline 20260716112908)")
        d0, c0 = checks(cur, "before")
        ok &= report("state upsert refused before (the defect: no column for a game state); unknown-state row accepted",
                     not any(d0) and all(c0) and rows(cur) == rows0)

        print("phase 2: apply the migration")
        cur.execute(FIX.read_text())
        ok &= report("stored game values unchanged by the column adds", rows(cur) == rows0)
        cur.execute(f"select count(*) from public.{T} where game_state is not null or game_schedule_state is not null "
                    "or game_state_observed_at is not null")
        ok &= report("every stored game starts with an unknown state (NULL)", cur.fetchone()[0] == 0)
        d1, c1 = checks(cur, "fixed")
        ok &= report("writer row stores its state; a later observation replaces it in place; unknown-state row accepted",
                     all(d1) and all(c1) and rows(cur) == rows0)
        st1 = state(cur)
        ok &= report("RLS, policy, grants and team_games view unchanged", st1[:4] == st0[:4])
        added = [c for c in st1[4] if c not in st0[4]]
        ok &= report("three nullable columns added", added == [("game_state", "text", "YES"), ("game_schedule_state", "text", "YES"),
                                                               ("game_state_observed_at", "timestamp with time zone", "YES")], added)
        refusals = {
            "unknown game state": attempt(cur, upsert_sql(writer_row(game_state="FINAL_OT"))),
            "lower-case game state": attempt(cur, upsert_sql(writer_row(game_state="final"))),
            "unknown schedule state": attempt(cur, upsert_sql(writer_row(game_schedule_state="POSTPONED"))),
            "state without observation time": attempt(cur, upsert_sql(writer_row(game_state_observed_at=None))),
            "observation time without state": attempt(cur, upsert_sql(writer_row(game_state=None, game_schedule_state=None))),
        }
        ok &= report("refused with 23514: " + ", ".join(refusals), set(refusals.values()) == {"23514"}, refusals)
        accepted = {
            "schedule state only (game state unknown)": attempt(cur, upsert_sql(writer_row(game_state=None, game_schedule_state="PPD"))),
            "game state only (schedule state unknown)": attempt(cur, upsert_sql(writer_row(game_schedule_state=None))),
        }
        ok &= report("accepted: " + ", ".join(accepted), set(accepted.values()) == {None}, accepted)
        conn.close()

        print("phase 3: rollback")
        conn, cur = fresh(sock, admin, "clean")
        cur.execute(FIX.read_text())
        cur.execute(upsert_sql(writer_row(game_state="OFF")))
        cur.execute(ROLLBACK.read_text())
        ok &= report("rollback restores the starting columns, policy, grants and view", state(cur) == st0)
        conn.close()
        admin_conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
