#!/usr/bin/env python3
"""Disposable local PostgreSQL 15 proof for 20261109213000_line_source_observed_at_indexes.sql.

Unix socket only, no hosted credentials. Builds line_source_snapshots and lines_ccc with the columns the review sync
reads (observed_at NOT NULL as in the 20260716112908 baseline, a wide raw_payload and metadata), loads 8,000 rows
each, and checks that the sync's read (newest 500 by observed_at desc) goes from a full scan and sort to an index
scan once the migration applies; that the file runs inside a transaction (plain form) and twice; and that the
CONCURRENTLY form in its header builds valid indexes outside a transaction.
Run: LC_ALL=C python3 -I supabase/tests/line_source_observed_at_indexes.py (needs Homebrew postgresql@15 and psycopg2).
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20261109213000_line_source_observed_at_indexes.sql"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
PORT = 55484
TABLES = ("line_source_snapshots", "lines_ccc")
checks = []

SCHEMA = """
create table public.line_source_snapshots (
  capture_key text primary key, source_key text, observed_at timestamptz default now() not null,
  raw_text text, raw_payload jsonb, metadata jsonb, status text, nhl_filter_status text);
create index line_source_snapshots_status_idx on public.line_source_snapshots (status, nhl_filter_status, observed_at desc);
create table public.lines_ccc (
  capture_key text primary key, observed_at timestamptz default now() not null,
  raw_text text, raw_payload jsonb, metadata jsonb, status text, snapshot_date date);
create index lines_ccc_status_idx on public.lines_ccc (status, snapshot_date desc);
"""


def check(name, ok, detail=""):
    checks.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


def plan(cur, table):
    cur.execute(f"explain select capture_key, raw_payload, metadata from public.{table} order by observed_at desc limit 500")
    return " / ".join(row[0].strip() for row in cur.fetchall())


def main():
    tmp = Path(tempfile.mkdtemp(prefix="lsobs-"))
    data, sock = tmp / "data", tmp / "sock"
    sock.mkdir()
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "HOME", "USER", "TMPDIR")}
    env.update({"LC_ALL": "C", "LANG": "C", "TZ": "UTC"})
    subprocess.run([str(PG / "initdb"), "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"], env=env, check=True, capture_output=True)
    subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-l", str(data / "log"), "-o", f"-p {PORT} -k {sock} -h ''", "-w", "start"], env=env, check=True, capture_output=True)
    try:
        conn = psycopg2.connect(host=str(sock), port=PORT, user="postgres", dbname="postgres")
        with conn.cursor() as cur:
            cur.execute(SCHEMA)
            for table in TABLES:
                cur.execute(f"""insert into public.{table} (capture_key, observed_at, raw_text, raw_payload, metadata, status)
                    select 'k' || g, now() - make_interval(mins => g), repeat('x', 400),
                      jsonb_build_object('text', repeat('p', 3000)), jsonb_build_object('m', repeat('q', 3000)), 'observed'
                    from generate_series(1, 8000) g""")
                cur.execute(f"analyze public.{table}")
            before = {table: plan(cur, table) for table in TABLES}
        conn.commit()
        for table in TABLES:
            check(f"{table}: before, the newest-500 read sorts the whole table", "Sort" in before[table] and "Seq Scan" in before[table], before[table])

        with conn.cursor() as cur:
            cur.execute(MIGRATION.read_text())  # one transaction, as apply_migration runs it
        conn.commit()
        with conn.cursor() as cur:
            for table in TABLES:
                after = plan(cur, table)
                check(f"{table}: after, an index scan on {table}_observed_at_idx with no sort",
                      f"Index Scan using {table}_observed_at_idx" in after and "Sort" not in after, after)
            cur.execute(MIGRATION.read_text())
            check("the file applies a second time (if not exists)", True)
        conn.commit()

        # The CONCURRENTLY form from the header, outside a transaction, on a fresh copy of the indexes.
        conn.autocommit = True
        with conn.cursor() as cur:
            for table in TABLES:
                cur.execute(f"drop index public.{table}_observed_at_idx")
            header = "\n".join(line[3:] for line in MIGRATION.read_text().splitlines() if line.startswith("--   "))
            statements = [s.strip() for s in re.findall(r"create index concurrently.*?;", header, re.S)]
            check("the header has one CONCURRENTLY statement per table", len(statements) == 2, str(len(statements)))
            for statement in statements:
                cur.execute(statement)
            cur.execute("""select count(*) filter (where indisvalid and indisready) from pg_index
                where indexrelid in ('public.line_source_snapshots_observed_at_idx'::regclass, 'public.lines_ccc_observed_at_idx'::regclass)""")
            check("the CONCURRENTLY form builds both indexes valid and ready", cur.fetchone()[0] == 2)
            cur.execute("select indexdef from pg_indexes where indexname like '%observed_at_idx' order by 1")
            defs = [row[0] for row in cur.fetchall()]
            check("index definitions are observed_at DESC", all("(observed_at DESC)" in d for d in defs) and len(defs) == 2, "; ".join(defs))
        conn.close()
    finally:
        subprocess.run([str(PG / "pg_ctl"), "-D", str(data), "-m", "fast", "stop"], env=env, capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)
    failed = [c for c in checks if not c[1]]
    print(f"{len(checks) - len(failed)}/{len(checks)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
