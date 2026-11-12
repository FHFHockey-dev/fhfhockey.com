#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261112120000_add_predictions_sko_vdp_view.sql
(L20 ticket, decision 134, model v0.4; rule 21). Never applied to a hosted database.

predictions_sko is built from the baseline (table, touch trigger, RLS, "Predictions read access" policy, grants)
plus 20260729205048 (five-column PK, read grants). Fixture: baseline-moving-average v0.1-v0.4 rows, another model's
v0.4 row, and v0.4 rows with NaN, Infinity and NULL stability_cv.
Defect checks (FAIL before, where the view does not exist; PASS after): stability_sd equals stability_cv for
baseline-moving-average v0.2-v0.4 and is NULL for v0.1, another model, NaN, Infinity and NULL; vdp equals sko on every
row; anon reads the view through the table's policy; the view is security_invoker (a role with SELECT on the view
but not the table is refused) and anon / authenticated / service_role hold SELECT on it.
Controls (PASS before, after and after rollback): every stored row is byte-identical, the table's columns,
constraints, policies, ACL and relfilenode (no rewrite) are unchanged.
Rollback drops only the view.
Run: LC_ALL=C python3 -I supabase/tests/l4a_predictions_sko_vdp.py (needs Homebrew postgresql@15 and psycopg2).
"""
import math
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
HISTORY = MIG / "20260729205048_preserve_sko_model_history.sql"
FIX = MIG / "20261112120000_add_predictions_sko_vdp_view.sql"
ROLLBACK = ROOT / "supabase/tests/l4a_predictions_sko_vdp_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55501
BMA = "baseline-moving-average"
# (player_id, model_name, model_version, stability_cv, sko, expected stability_sd)
ROWS = [(1, BMA, "v0.1", 0.5, 3.0, None), (2, BMA, "v0.2", 0.6, 3.1, 0.6), (3, BMA, "v0.3", 0.7, 3.2, 0.7),
        (4, BMA, "v0.4", 0.8, 3.3, 0.8), (5, "other-model", "v0.4", 0.9, 3.4, None),
        (6, BMA, "v0.4", float("nan"), 3.5, None), (7, BMA, "v0.4", None, None, None),
        (8, BMA, "v0.4", float("inf"), 3.6, None)]


def grab(pattern):
    m = re.search(pattern, BASE, re.S)
    assert m, pattern
    return m.group(0)


def schema():
    return "\n".join([
        "create role anon; create role authenticated; create role service_role; create role outsider;",
        grab(r"CREATE FUNCTION public\.touch_updated_at\(\) RETURNS trigger\n.*?end \$\$;\n"),
        grab(r"CREATE TABLE public\.predictions_sko \(\n.*?\n\);\n"),
        "ALTER TABLE ONLY public.predictions_sko ADD CONSTRAINT predictions_sko_pk PRIMARY KEY (player_id, as_of_date, horizon_games);",
        grab(r"CREATE TRIGGER predictions_sko_touch [^\n]*\n"),
        grab(r'CREATE POLICY "Predictions read access" ON public\.predictions_sko [^\n]*\n'),
        "ALTER TABLE public.predictions_sko ENABLE ROW LEVEL SECURITY;",
        *re.findall(r"GRANT [^\n]* ON TABLE public\.predictions_sko TO \w+;", BASE),
        # Platform posture since 20261020224500: no default grants on new objects.
        "alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;",
    ])


def same(a, b):
    if a is None or b is None:
        return a is None and b is None
    return (math.isnan(a) and math.isnan(b)) or a == b


def fetch(cur, sql, role=None):
    try:
        cur.execute("begin")
        if role:
            cur.execute(f"set local role {role}")
        cur.execute(sql)
        return cur.fetchall()
    except psycopg2.Error as e:
        return f"ERROR {e.pgcode}"
    finally:
        cur.execute("rollback")


def table_state(cur):
    rows = fetch(cur, "select md5(string_agg(p::text, '|' order by player_id)) from public.predictions_sko p")
    cols = fetch(cur, "select column_name, data_type, is_nullable, column_default from information_schema.columns"
                      " where table_schema = 'public' and table_name = 'predictions_sko' order by ordinal_position")
    cons = fetch(cur, "select conname, pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint"
                      " where conrelid = 'public.predictions_sko'::regclass order by 1")
    pol = fetch(cur, "select polname, polcmd, polroles::regrole[]::text, pg_catalog.pg_get_expr(polqual, polrelid)"
                     " from pg_catalog.pg_policy where polrelid = 'public.predictions_sko'::regclass")
    rel = fetch(cur, "select relrowsecurity, relacl::text, relfilenode from pg_catalog.pg_class"
                     " where oid = 'public.predictions_sko'::regclass")
    return rows, cols, cons, pol, rel


def checks(cur, label, start):
    got = fetch(cur, "select player_id, stability_sd, vdp, sko from public.predictions_sko_vdp order by player_id")
    by = {r[0]: r[1:] for r in got} if isinstance(got, list) else {}
    sd_ok = len(by) == len(ROWS) and all(same(by[p][0], want) for p, *_, want in ROWS)
    vdp_ok = len(by) == len(ROWS) and all(same(by[p][1], by[p][2]) for p in by)
    anon = fetch(cur, "select count(*) from public.predictions_sko_vdp", role="anon")
    outsider = fetch(cur, "select count(*) from public.predictions_sko_vdp", role="outsider")
    grants = fetch(cur, "select bool_and(has_table_privilege(r, 'public.predictions_sko_vdp', 'SELECT'))"
                        " from unnest(array['anon', 'authenticated', 'service_role']) r")
    defects = [
        ("stability_sd = stability_cv for BMA v0.2-v0.4, NULL for v0.1 / other model / NaN / Infinity / NULL", sd_ok,
         str({p: by.get(p, (None,))[0] for p in by}) if by else str(got)),
        ("vdp = sko on every row", vdp_ok, ""),
        ("anon reads the view through the table's RLS policy", anon == [(len(ROWS),)], str(anon)),
        ("security_invoker: a role with view SELECT but no table SELECT is refused", outsider == "ERROR 42501", str(outsider)),
        ("anon, authenticated and service_role hold SELECT on the view", grants == [(True,)], str(grants)),
    ]
    st = table_state(cur)
    controls = [
        ("stored rows byte-identical", st[0] == start[0], ""),
        ("table columns, constraints and policies unchanged", st[1:4] == start[1:4], ""),
        ("table RLS, ACL and relfilenode unchanged (no rewrite)", st[4] == start[4], ""),
    ]
    for name, ok, detail in defects + controls:
        print(f"  [{label}] {'PASS' if ok else 'FAIL'} {name}{' — ' + detail if detail else ''}")
    return [ok for _, ok, _ in defects], [ok for _, ok, _ in controls]


def main():
    tmp = Path(tempfile.mkdtemp(prefix="l4avdp-"))
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
        cur.execute(HISTORY.read_text())
        for p, model, version, cv, sko, _ in ROWS:
            cur.execute("insert into public.predictions_sko (player_id, as_of_date, horizon_games, pred_points, stability_cv, sko,"
                        " model_name, model_version) values (%s, '2026-11-10', 5, 1.0, %s, %s, %s, %s)", (p, cv, sko, model, version))
        start = table_state(cur)
        print("phase 1: starting state (baseline + 20260729205048)")
        d0, c0 = checks(cur, "before", start)
        ok &= not any(d0) and all(c0)
        print("phase 2: apply the migration")
        cur.execute(FIX.read_text())
        cur.execute("grant select on public.predictions_sko_vdp to outsider")
        d1, c1 = checks(cur, "fixed", start)
        ok &= all(d1) and all(c1)
        cur.execute("select array_agg(attname order by attnum) from pg_catalog.pg_attribute"
                    " where attrelid = 'public.predictions_sko_vdp'::regclass and attnum > 0")
        vcols = cur.fetchone()[0]
        tcols = [c[0] for c in start[1]]
        shape = vcols == tcols + ["stability_sd", "vdp"]
        print(f"  {'PASS' if shape else 'FAIL'} view columns = every table column in order, then stability_sd, vdp")
        ok &= shape
        print("phase 3: rollback")
        cur.execute(ROLLBACK.read_text())
        d2, c2 = checks(cur, "rollback", start)
        cur.execute("select to_regclass('public.predictions_sko_vdp')")
        gone = cur.fetchone()[0] is None
        restored = gone and d2 == d0 and c2 == c0
        print(f"  {'PASS' if restored else 'FAIL'} rollback drops only the view; table untouched")
        ok &= restored
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
    print("RESULT", "OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
