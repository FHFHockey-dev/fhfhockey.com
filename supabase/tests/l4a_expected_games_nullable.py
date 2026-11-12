#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261112110000_player_forecast_season_expected_games_nullable.sql
(L15 ticket, rule 5). Never applied to a hosted database.

The two tables are built from their 20260813001304 definitions (foreign keys stripped; they do not bear on
nullability) with that migration's force RLS, revokes, service_role SELECT / INSERT grants and immutability
triggers (fhfh_internal.reject_player_forecast_mutation from 20260802163747).
Defect check (FAIL before, PASS after): an insert with expected_games NULL (expected_starts NULL) is accepted in
both tables.
Controls (PASS before and after): a full row inserts; expected_games 85 and NaN and expected_starts > expected_games
are still rejected (23514). After apply: every other column's type, nullability and default, every constraint, the
triggers, RLS and the ACL equal the starting state; only expected_games' nullability changed.
Rollback: with a NULL row stored it refuses (23502) and changes nothing, and the NULL row cannot be deleted (55000,
append-only). On a second database with no NULL rows it restores the starting state exactly.
Run: LC_ALL=C python3 -I supabase/tests/l4a_expected_games_nullable.py (needs Homebrew postgresql@15 and psycopg2).
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
SRC = (ROOT / "supabase/migrations/20260813001304_player_forecast_season_v3.sql").read_text()
FIX = ROOT / "supabase/migrations/20261112110000_player_forecast_season_expected_games_nullable.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_expected_games_nullable_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55500
AGG, REL = "player_forecast_season_player_aggregates", "player_forecast_season_release_players"
UUID = "00000000-0000-0000-0000-00000000000{}"
OBJ = "'{}'::jsonb"
HASH = "a" * 64


def table_ddl(name):
    m = re.search(rf"create table public\.{name} \(\n.*?\n\);\n", SRC, re.S)
    assert m, name
    return re.sub(r" references public\.\w+\(id\)", "", m.group(0))


def schema():
    return "\n".join([
        "create schema fhfh_internal;",
        "create function fhfh_internal.reject_player_forecast_mutation() returns trigger language plpgsql security invoker"
        " set search_path = '' as $$ begin raise exception using errcode = '55000', message = 'PLAYER_FORECAST_IMMUTABLE_RECORD'; end; $$;",
        table_ddl(AGG), table_ddl(REL),
    ] + [f"create trigger {t}_immutable before update or delete on public.{t} for each row execute function"
         f" fhfh_internal.reject_player_forecast_mutation(); alter table public.{t} enable row level security;"
         f" alter table public.{t} force row level security; revoke all on table public.{t} from public, anon, authenticated, service_role;"
         f" grant select, insert on table public.{t} to service_role;" for t in (AGG, REL)])


def insert(table, n, games, starts="null"):
    if table == AGG:
        return (f"insert into public.{AGG} (run_id, fhfh_player_id, team_id, player_name, position, population, pool_status,"
                " roster_confidence, expected_games, expected_starts, expected_toi, ratings, deployment, model_means, p10, p50, p90,"
                f" component_manifest, provenance, aggregate_hash) values ('{UUID.format(1)}', {n}, 22, 'P{n}', 'G', 'goalie',"
                f" 'verified_active', 0.9, {games}, {starts}, {OBJ}, {OBJ}, {OBJ}, {OBJ}, {OBJ}, {OBJ}, {OBJ}, '[]'::jsonb, {OBJ}, '{HASH}')")
    return (f"insert into public.{REL} (release_id, fhfh_player_id, team_id, player_name, position, population, pool_status,"
            " roster_confidence, expected_games, expected_starts, expected_toi, ratings, deployment, base_values, published_values,"
            f" p10, p50, p90, provenance) values ('{UUID.format(2)}', {n}, 22, 'P{n}', 'G', 'goalie', 'verified_active', 0.9,"
            f" {games}, {starts}, {OBJ}, {OBJ}, {OBJ}, {OBJ}, {OBJ}, {OBJ}, {OBJ}, {OBJ}, {OBJ})")


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
    out = {}
    for t in (AGG, REL):
        cur.execute("select column_name, data_type, is_nullable, column_default from information_schema.columns"
                    " where table_schema = 'public' and table_name = %s order by ordinal_position", (t,))
        cols = cur.fetchall()
        cur.execute("select conname, pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint"
                    f" where conrelid = 'public.{t}'::regclass order by 1")
        cons = cur.fetchall()
        cur.execute("select tgname, pg_catalog.pg_get_triggerdef(oid) from pg_catalog.pg_trigger"
                    f" where tgrelid = 'public.{t}'::regclass order by 1")
        trig = cur.fetchall()
        cur.execute(f"select relrowsecurity, relforcerowsecurity, relacl::text from pg_catalog.pg_class where oid = 'public.{t}'::regclass")
        out[t] = (cols, cons, trig, cur.fetchone())
    return out


def nullability(st):
    return {t: next(c[2] for c in st[t][0] if c[0] == "expected_games") for t in st}


def checks(cur, label):
    nulls = [attempt(cur, insert(t, 9, "null")) for t in (AGG, REL)]
    defects = [("NULL expected_games accepted in both tables", nulls == [None, None], str(nulls))]
    controls = []
    for t in (AGG, REL):
        short = "aggregates" if t == AGG else "release_players"
        controls += [
            (f"{short}: full row inserts", attempt(cur, insert(t, 1, 70, 60)) is None, ""),
            (f"{short}: expected_games 85 rejected", attempt(cur, insert(t, 2, 85)) == "23514", ""),
            (f"{short}: expected_games NaN rejected", attempt(cur, insert(t, 3, "'NaN'::numeric")) == "23514", ""),
            (f"{short}: expected_starts > expected_games rejected", attempt(cur, insert(t, 4, 50, 60)) == "23514", ""),
        ]
    for name, ok, detail in defects + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name}{' — ' + detail if detail else ''}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls]


def connect(sock, db):
    conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname=db)
    conn.autocommit = True
    return conn, conn.cursor()


def main():
    tmp = Path(tempfile.mkdtemp(prefix="l4aeg-"))
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
        conn, cur = connect(sock, "postgres")
        cur.execute("create role anon; create role authenticated; create role service_role")
        cur.execute("create database clean")
        cur.execute(schema())
        st0 = state(cur)
        print("phase 1: starting state (20260813001304)")
        d0, c0 = checks(cur, "before")
        ok &= not any(d0) and all(c0)

        print("phase 2: apply the migration")
        cur.execute(FIX.read_text())
        d1, c1 = checks(cur, "fixed")
        ok &= all(d1) and all(c1)
        st1 = state(cur)
        flipped = nullability(st0) == {AGG: "NO", REL: "NO"} and nullability(st1) == {AGG: "YES", REL: "YES"}
        strip = lambda st: {t: ([c for c in st[t][0] if c[0] != "expected_games"],) + st[t][1:] for t in st}  # noqa: E731
        rest = strip(st1) == strip(st0) and all(
            [c[:2] + c[3:] for c in st1[t][0] if c[0] == "expected_games"] == [c[:2] + c[3:] for c in st0[t][0] if c[0] == "expected_games"]
            for t in st0)
        print(f"  {'PASS' if flipped else 'FAIL'} expected_games nullability NO -> YES in both tables")
        print(f"  {'PASS' if rest else 'FAIL'} every other column, constraint, trigger, RLS flag and ACL unchanged")
        ok &= flipped and rest

        print("phase 3: rollback with a NULL row stored")
        cur.execute(insert(AGG, 10, "null"))
        try:
            cur.execute(ROLLBACK.read_text())
            refused = None
        except psycopg2.Error as e:
            refused = (e.pgcode, (e.pgerror or "").splitlines()[0])
            cur.execute("rollback") if conn.get_transaction_status() else None
        unchanged = state(cur) == st1
        no_delete = attempt(cur, f"delete from public.{AGG} where expected_games is null")
        r_ok = refused is not None and refused[0] == "23502" and "L4A_ROLLBACK_REFUSED" in refused[1] and unchanged and no_delete == "55000"
        print(f"  {'PASS' if r_ok else 'FAIL'} rollback refuses ({refused}), changes nothing, and the NULL row cannot be deleted ({no_delete})")
        ok &= r_ok
        conn.close()

        print("phase 4: rollback on a database with no NULL rows")
        conn, cur = connect(sock, "clean")
        cur.execute(schema())
        cur.execute(FIX.read_text())
        cur.execute(insert(AGG, 20, 70, 60))
        cur.execute(insert(REL, 20, 70, 60))
        cur.execute(ROLLBACK.read_text())
        back = state(cur) == st0
        d2, c2 = checks(cur, "rollback")
        clean = back and d2 == d0 and c2 == c0
        print(f"  {'PASS' if clean else 'FAIL'} rollback restores NOT NULL and the exact starting state"
              f"{'' if clean else f' — state {back}, checks {d2 == d0} {c2 == c0}'}")
        ok &= clean
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
