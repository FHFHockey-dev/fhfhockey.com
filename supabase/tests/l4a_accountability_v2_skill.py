#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261113090000_player_forecast_accountability_v2_skill.sql
(owner decision 135). Never applied to a hosted database.

public.player_forecast_accountability_revisions is built from 20260802163747 (foreign keys stripped; they do not
bear on this column) with its force RLS, revoke, service_role SELECT / INSERT grant and append-only trigger, and one
existing (v1) row.
Defect checks (FAIL before, PASS after): a v2 settlement row stores a negative skill (-0.35), 0 and 1; NULL
v2_skill is accepted; 1.2 and NaN are rejected (23514).
Controls (PASS before and after): the existing row is unchanged (v2_skill reads NULL after); composite_skill_score is
still NOT NULL (23502) and 0-100 (120 rejected, 23514); updates are still rejected (55000); every other column,
constraint, trigger, RLS flag and ACL is unchanged.
Rollback: refuses (55000) while a v2_skill is stored and changes nothing; on a second database with no v2 values it
restores the starting state exactly.
Run: LC_ALL=C python3 -I supabase/tests/l4a_accountability_v2_skill.py (needs Homebrew postgresql@15 and psycopg2).
"""
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
SRC = (ROOT / "supabase/migrations/20260802163747_add_player_forecast_foundation.sql").read_text()
FIX = ROOT / "supabase/migrations/20261113090000_player_forecast_accountability_v2_skill.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_accountability_v2_skill_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55502
T = "player_forecast_accountability_revisions"
ARTIFACT = "00000000-0000-0000-0000-000000000001"


def schema():
    m = re.search(rf"create table public\.{T} \(\n.*?\n\);\n", SRC, re.S)
    assert m
    table = re.sub(r" references public\.\w+\(id\)", "", m.group(0))
    return "\n".join([
        "create schema fhfh_internal;",
        "create function fhfh_internal.reject_player_forecast_mutation() returns trigger language plpgsql security invoker"
        " set search_path = '' as $$ begin raise exception using errcode = '55000', message = 'PLAYER_FORECAST_IMMUTABLE_RECORD'; end; $$;",
        table,
        f"create trigger {T}_immutable before update or delete on public.{T} for each row execute function"
        " fhfh_internal.reject_player_forecast_mutation();",
        f"alter table public.{T} enable row level security; alter table public.{T} force row level security;",
        f"revoke all on table public.{T} from public, anon, authenticated, service_role;",
        f"grant select, insert on table public.{T} to service_role;",
    ])


def insert(key, composite="50", v2=None):
    cols = "slate_date, checkpoint_key, checkpoint_order, model_artifact_id, scoring_version, settlement_status, evaluated_forecasts, composite_skill_score, metrics, baseline_metrics, evaluated_at"
    vals = (f"'2026-11-10', '{key}', 0, '{ARTIFACT}', 'player-forecast-skill-v2', 'final', 12, {composite},"
            " '{}'::jsonb, '{}'::jsonb, '2026-11-11 00:00+00'")
    if v2 is not None:
        cols += ", v2_skill"
        vals += f", {v2}"
    return f"insert into public.{T} ({cols}) values ({vals})"


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
    cur.execute("select column_name, data_type, is_nullable, column_default from information_schema.columns"
                " where table_schema = 'public' and table_name = %s order by ordinal_position", (T,))
    cols = cur.fetchall()
    cur.execute(f"select conname, pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint where conrelid = 'public.{T}'::regclass order by 1")
    cons = cur.fetchall()
    cur.execute(f"select tgname, pg_catalog.pg_get_triggerdef(oid) from pg_catalog.pg_trigger where tgrelid = 'public.{T}'::regclass order by 1")
    trig = cur.fetchall()
    cur.execute(f"select relrowsecurity, relforcerowsecurity, relacl::text from pg_catalog.pg_class where oid = 'public.{T}'::regclass")
    return cols, cons, trig, cur.fetchone()


def existing(cur):
    cur.execute(f"select checkpoint_key, composite_skill_score, evaluated_forecasts, scoring_version from public.{T} where checkpoint_key = 'v1-row'")
    return cur.fetchall()


def checks(cur, label, start_row):
    stores = [attempt(cur, insert(f"k{i}", v2=v)) for i, v in enumerate(("-0.35", "0", "1"))]
    null_ok = attempt(cur, insert("knull", v2="null"))
    bad = [attempt(cur, insert(f"b{i}", v2=v)) for i, v in enumerate(("1.2", "'NaN'::numeric"))]
    defects = [
        ("v2 rows store skill -0.35, 0 and 1", stores == [None] * 3, str(stores)),
        ("NULL v2_skill accepted", null_ok is None, str(null_ok)),
        ("v2_skill 1.2 and NaN rejected (23514)", bad == ["23514", "23514"], str(bad)),
    ]
    cur.execute("select exists (select 1 from information_schema.columns where table_name = %s and column_name = 'v2_skill')", (T,))
    if cur.fetchone()[0]:
        cur.execute(f"select v2_skill from public.{T} where checkpoint_key = 'v1-row'")
        v2_of_existing = cur.fetchall()
    else:
        v2_of_existing = [(None,)]  # column absent
    controls = [
        ("existing row unchanged; its v2_skill reads NULL", existing(cur) == start_row and v2_of_existing == [(None,)], str(v2_of_existing)),
        ("composite_skill_score still NOT NULL (23502)", attempt(cur, insert("c1", composite="null")) == "23502", ""),
        ("composite_skill_score still 0-100 (120 rejected, 23514)", attempt(cur, insert("c2", composite="120")) == "23514", ""),
        ("updates still rejected (55000)", attempt(cur, f"update public.{T} set evaluated_forecasts = 13") == "55000", ""),
    ]
    for name, ok, detail in defects + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name}{' — ' + detail if detail else ''}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls]


def connect(sock, db):
    conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname=db)
    conn.autocommit = True
    return conn, conn.cursor()


def main():
    tmp = Path(tempfile.mkdtemp(prefix="l4av2skill-"))
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
        cur.execute(insert("v1-row", composite="61").replace("player-forecast-skill-v2", "player-forecast-skill-v1"))
        st0, row0 = state(cur), existing(cur)
        print("phase 1: starting state (20260802163747)")
        d0, c0 = checks(cur, "before", row0)
        ok &= not any(d0) and all(c0)

        print("phase 2: apply the migration")
        cur.execute(FIX.read_text())
        d1, c1 = checks(cur, "fixed", row0)
        ok &= all(d1) and all(c1)
        st1 = state(cur)
        extra = [c for c in st1[0] if c[0] not in {x[0] for x in st0[0]}]
        added = extra == [("v2_skill", "numeric", "YES", None)] and st1[0][:len(st0[0])] == st0[0]
        cons = [c for c in st1[1] if c not in st0[1]]
        rest = cons == [("player_forecast_accountability_revisions_v2_skill_check",
                         "CHECK (((v2_skill IS NULL) OR ((v2_skill <= (1)::numeric) AND (v2_skill <> 'NaN'::numeric))))")] \
            and all(c in st1[1] for c in st0[1]) and st1[2:] == st0[2:]
        print(f"  {'PASS' if added else 'FAIL'} one column added at the end: v2_skill numeric, nullable — {extra}")
        print(f"  {'PASS' if rest else 'FAIL'} only the v2_skill CHECK added; other constraints, triggers, RLS and ACL unchanged — {cons}")
        ok &= added and rest

        print("phase 3: rollback with a v2_skill stored")
        cur.execute(insert("v2-row", v2="-0.2"))
        try:
            cur.execute(ROLLBACK.read_text())
            refused = None
        except psycopg2.Error as e:
            refused = (e.pgcode, (e.pgerror or "").splitlines()[0])
            cur.execute("rollback") if conn.get_transaction_status() else None
        r_ok = refused is not None and refused[0] == "55000" and "L4A_ROLLBACK_REFUSED" in refused[1] and state(cur) == st1
        print(f"  {'PASS' if r_ok else 'FAIL'} rollback refuses ({refused}) and changes nothing")
        ok &= r_ok
        conn.close()

        print("phase 4: rollback on a database with no v2 values")
        conn, cur = connect(sock, "clean")
        cur.execute(schema())
        cur.execute(insert("v1-row", composite="61").replace("player-forecast-skill-v2", "player-forecast-skill-v1"))
        cur.execute(FIX.read_text())
        cur.execute(ROLLBACK.read_text())
        d2, c2 = checks(cur, "rollback", row0)
        clean = state(cur) == st0 and d2 == d0 and c2 == c0
        print(f"  {'PASS' if clean else 'FAIL'} rollback drops v2_skill and restores the exact starting state")
        ok &= clean
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
