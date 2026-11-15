#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261115210000_ranking_publications.sql (Claude rankings lane, TJ
2026-11-15). Never applied to a hosted database.

The migration runs as a NON-superuser owner (as Supabase's postgres role is), with anon, authenticated and
service_role (BYPASSRLS) and Supabase-style default privileges that grant ALL on new public tables to all three, so
the revoke is tested against real grants rather than an empty ACL.

Shape: columns, types, nullability and defaults; the primary key; the reader index; the comment; the owner.
Checks: the complete check refuses a complete marker without completed_at, with a null or mismatched row count, or a
null or mismatched entity count; the column checks refuse a bad surface, status or strength and a negative window size
or expected row count; the primary key refuses a duplicate publication. Grants: anon, authenticated and PUBLIC have no
table privilege; service_role has exactly SELECT, INSERT and UPDATE (no DELETE, TRUNCATE, REFERENCES or TRIGGER).
RLS is on with no policy and no trigger: a role granted SELECT without BYPASSRLS sees no rows. Rollback drops the table,
its index and row type, and the migration then applies again cleanly.
Run: LC_ALL=C /usr/local/bin/python3 -I supabase/tests/ranking_publications.py
"""
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20261115210000_ranking_publications.sql"
ROLLBACK = ROOT / "supabase/tests/ranking_publications_rollback.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55547
TABLE = "public.ranking_publications"
PRIVILEGES = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]

SETUP = """
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role supa_owner login nosuperuser; grant create on database postgres to supa_owner;
grant create, usage on schema public to supa_owner; grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role supa_owner in schema public grant all on tables to anon, authenticated, service_role;
"""

# (column, type, not null, default)
COLUMNS = [
    ("surface", "text", True, None),
    ("season_id", "integer", True, None),
    ("snapshot_date", "date", True, None),
    ("strength_state", "text", True, None),
    ("window_type", "text", True, None),
    ("window_size", "integer", True, None),
    ("peer_group_type", "text", True, None),
    ("peer_group_key", "text", True, None),
    ("metric_set", "text[]", True, "'{}'::text[]"),
    ("min_gp", "integer", False, None),
    ("min_toi_seconds", "integer", False, None),
    ("methodology_version", "text", True, None),
    ("status", "text", True, None),
    ("expected_rows", "integer", True, "0"),
    ("db_written_rows", "integer", False, None),
    ("expected_entities", "integer", False, None),
    ("written_entities", "integer", False, None),
    ("started_at", "timestamp with time zone", True, "now()"),
    ("completed_at", "timestamp with time zone", False, None),
    ("updated_at", "timestamp with time zone", True, "now()"),
]
KEY = ["surface", "season_id", "snapshot_date", "strength_state", "window_type", "window_size", "peer_group_type", "peer_group_key"]

failures = []


def check(name, condition):
    print(("PASS " if condition else "FAIL ") + name)
    if not condition:
        failures.append(name)


def marker(**overrides):
    row = {
        "surface": "entity_metric_rankings", "season_id": 20262027, "snapshot_date": "2026-11-14", "strength_state": "5v5",
        "window_type": "season", "window_size": 0, "peer_group_type": "position", "peer_group_key": "F",
        "metric_set": ["ixg_per_60", "points_per_60"], "methodology_version": "v1", "status": "complete",
        "expected_rows": 1200, "db_written_rows": 1200, "expected_entities": 600, "written_entities": 600,
        "completed_at": "2026-11-15T21:00:00Z",
    }
    row.update(overrides)
    return row


def insert(cur, row):
    cols = list(row)
    cur.execute(f"insert into {TABLE} ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))})", [row[c] for c in cols])


def run(sock):
    admin = psycopg2.connect(host=sock, port=PORT, user="postgres", dbname="postgres")
    admin.autocommit = True
    acur = admin.cursor()
    acur.execute(SETUP)
    sql = MIGRATION.read_text()
    check("migration is ASCII only", all(ord(c) < 128 for c in sql))
    owner = psycopg2.connect(host=sock, port=PORT, user="supa_owner", dbname="postgres")
    owner.autocommit = True
    owner.cursor().execute(sql)
    check("applies as a non-superuser owner", True)

    acur.execute("select a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_get_expr(d.adbin, d.adrelid) "
                 "from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum "
                 "where a.attrelid = %s::regclass and a.attnum > 0 and not a.attisdropped order by a.attnum", (TABLE,))
    check("table exists with the exact columns, types, nullability and defaults", acur.fetchall() == COLUMNS)
    acur.execute("select array_agg(a.attname order by k.ord) from pg_constraint c cross join unnest(c.conkey) with ordinality k(attnum, ord) "
                 "join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum where c.conrelid = %s::regclass and c.contype = 'p'", (TABLE,))
    check("primary key is surface + season + date + strength + window + peer group, in that order", acur.fetchone()[0] == KEY)
    acur.execute("select pg_get_indexdef('public.ranking_publications_reader_idx'::regclass)")
    check("reader index on (season_id, strength_state, status, snapshot_date desc)",
          acur.fetchone()[0].endswith("USING btree (season_id, strength_state, status, snapshot_date DESC)"))
    acur.execute("select c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner), obj_description(c.oid, 'pg_class'), "
                 "(select count(*) from pg_policy p where p.polrelid = c.oid), "
                 "(select count(*) from pg_trigger t where t.tgrelid = c.oid and not t.tgisinternal) "
                 "from pg_class c where c.oid = %s::regclass", (TABLE,))
    rls, force_rls, owner_name, comment, policies, triggers = acur.fetchone()
    check("RLS enabled (not forced), no policy, no trigger", rls and not force_rls and policies == 0 and triggers == 0)
    check("owned by the non-superuser owner; comment says both surfaces must be complete",
          owner_name == "supa_owner" and comment is not None and "both surfaces are complete" in comment)

    for role in ["anon", "authenticated", "public"]:
        acur.execute("select " + ", ".join(f"has_table_privilege(%s, %s, '{p}')" for p in PRIVILEGES), [role, TABLE] * len(PRIVILEGES))
        check(f"{role} has no table privilege (despite the default ALL grant)", not any(acur.fetchone()))
    acur.execute("select " + ", ".join(f"has_table_privilege('service_role', %s, '{p}')" for p in PRIVILEGES), [TABLE] * len(PRIVILEGES))
    check("service_role has exactly SELECT, INSERT, UPDATE",
          [p for p, ok in zip(PRIVILEGES, acur.fetchone()) if ok] == ["SELECT", "INSERT", "UPDATE"])
    acur.execute("select array_agg(distinct pg_get_userbyid(x.grantee)::text order by pg_get_userbyid(x.grantee)::text) "
                 "from pg_class c cross join aclexplode(c.relacl) x where c.oid = %s::regclass", (TABLE,))
    check("ACL grantees are only the owner and service_role", acur.fetchone()[0] == ["service_role", "supa_owner"])

    cur = admin.cursor()

    def attempt(name, statements, expect, role="service_role"):
        """expect: None for success, or (sqlstate, fragment) for a refusal."""
        cur.execute("begin")
        try:
            cur.execute(f"set local role {role}")
            for statement in statements:
                statement(cur)
            check(name, expect is None)
        except psycopg2.Error as error:
            check(name, expect is not None and error.pgcode == expect[0] and expect[1] in str(error))
        finally:
            cur.execute("rollback")

    complete_check = ("23514", "ranking_publications_complete_check")
    column_check = ("23514", "violates check constraint")
    attempt("service_role inserts a complete marker", [lambda c: insert(c, marker())], None)
    attempt("service_role inserts writing, then updates it to complete with matching counts",
            [lambda c: insert(c, marker(status="writing", db_written_rows=None, written_entities=None, completed_at=None)),
             lambda c: c.execute(f"update {TABLE} set status = 'complete', db_written_rows = 1200, written_entities = 600, "
                                 "completed_at = now(), updated_at = now() where peer_group_key = 'F'"),
             lambda c: c.execute(f"select status from {TABLE}")], None)
    attempt("a writing marker may carry partial counts and no completed_at",
            [lambda c: insert(c, marker(status="writing", db_written_rows=300, written_entities=None, completed_at=None))], None)
    attempt("a complete composites marker with an empty metric set and zero rows is allowed",
            [lambda c: insert(c, marker(surface="skater_composite_ratings", metric_set=[], expected_rows=0, db_written_rows=0,
                                        expected_entities=0, written_entities=0))], None)
    attempt("complete check refuses mismatched row counts", [lambda c: insert(c, marker(db_written_rows=1100))], complete_check)
    attempt("complete check refuses mismatched entity counts", [lambda c: insert(c, marker(written_entities=599))], complete_check)
    attempt("complete check refuses a missing completed_at", [lambda c: insert(c, marker(completed_at=None))], complete_check)
    attempt("complete check refuses a null db_written_rows", [lambda c: insert(c, marker(db_written_rows=None))], complete_check)
    attempt("complete check refuses a null written_entities", [lambda c: insert(c, marker(written_entities=None))], complete_check)
    attempt("complete check refuses a null expected_entities",
            [lambda c: insert(c, marker(expected_entities=None, written_entities=None))], complete_check)
    attempt("complete check refuses an update to complete with mismatched counts",
            [lambda c: insert(c, marker(status="writing", db_written_rows=1100, completed_at=None)),
             lambda c: c.execute(f"update {TABLE} set status = 'complete', completed_at = now()")], complete_check)
    attempt("refuses a bad status", [lambda c: insert(c, marker(status="failed"))], column_check)
    attempt("refuses a bad surface", [lambda c: insert(c, marker(surface="goalie_ratings"))], column_check)
    attempt("refuses a bad strength state", [lambda c: insert(c, marker(strength_state="4v4"))], column_check)
    attempt("refuses a negative window size", [lambda c: insert(c, marker(window_size=-1))], column_check)
    attempt("refuses a negative expected_rows",
            [lambda c: insert(c, marker(status="writing", expected_rows=-1, db_written_rows=None, completed_at=None))], column_check)
    attempt("primary key refuses a duplicate publication",
            [lambda c: insert(c, marker()), lambda c: insert(c, marker(status="writing", completed_at=None))],
            ("23505", "ranking_publications_pkey"))
    attempt("same publication on another surface or peer group is a separate marker",
            [lambda c: insert(c, marker()), lambda c: insert(c, marker(surface="skater_composite_ratings")),
             lambda c: insert(c, marker(peer_group_key="D"))], None)

    denied = ("42501", "permission denied for table ranking_publications")
    attempt("service_role cannot delete", [lambda c: c.execute(f"delete from {TABLE}")], denied)
    attempt("service_role cannot truncate", [lambda c: c.execute(f"truncate {TABLE}")], denied)
    attempt("anon cannot select", [lambda c: c.execute(f"select * from {TABLE}")], denied, role="anon")
    attempt("anon cannot insert", [lambda c: insert(c, marker())], denied, role="anon")
    attempt("authenticated cannot select", [lambda c: c.execute(f"select * from {TABLE}")], denied, role="authenticated")
    attempt("authenticated cannot update", [lambda c: c.execute(f"update {TABLE} set status = 'writing'")], denied, role="authenticated")

    # RLS as the second layer: grant SELECT to authenticated inside a rolled-back transaction; with no policy it sees nothing.
    cur.execute("begin")
    insert(cur, marker())
    cur.execute(f"grant select on {TABLE} to authenticated")
    cur.execute("set local role authenticated")
    cur.execute(f"select count(*) from {TABLE}")
    hidden = cur.fetchone()[0]
    cur.execute("reset role")
    cur.execute("set local role service_role")
    cur.execute(f"select count(*) from {TABLE}")
    seen = cur.fetchone()[0]
    cur.execute("rollback")
    check("RLS: a granted non-bypass role sees 0 rows; service_role (BYPASSRLS) sees the row", hidden == 0 and seen == 1)

    owner.cursor().execute(ROLLBACK.read_text())
    acur.execute("select (select count(*) from pg_class where relname like 'ranking_publications%%'), "
                 "(select count(*) from pg_type where typname like '%%ranking_publications%%')")
    check("rollback drops the table, its primary key and reader index, and its row type", acur.fetchone() == (0, 0))
    owner.cursor().execute(sql)
    acur.execute("select has_table_privilege('service_role', %s, 'INSERT') and not has_table_privilege('anon', %s, 'SELECT')", (TABLE, TABLE))
    check("after rollback the migration applies again cleanly with the same grants", acur.fetchone()[0])
    owner.cursor().execute(ROLLBACK.read_text())
    owner.cursor().execute(ROLLBACK.read_text())
    check("rollback is idempotent (drop if exists)", True)
    owner.close()
    admin.close()


def main():
    with tempfile.TemporaryDirectory(dir="/tmp") as tmp:
        data = Path(tmp) / "data"
        subprocess.run([PG / "initdb", "-D", data, "-U", "postgres", "-A", "trust", "--no-sync"], check=True, capture_output=True)
        server = subprocess.Popen([PG / "postgres", "-D", data, "-p", str(PORT), "-k", tmp, "-c", "listen_addresses=", "-c", "fsync=off"],
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                try:
                    psycopg2.connect(host=tmp, port=PORT, user="postgres", dbname="postgres").close()
                    break
                except psycopg2.OperationalError:
                    time.sleep(0.1)
            run(tmp)
        finally:
            server.kill()
            server.wait()
    print(f"{'FAILED' if failures else 'OK'}: {len(failures)} failure(s)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
