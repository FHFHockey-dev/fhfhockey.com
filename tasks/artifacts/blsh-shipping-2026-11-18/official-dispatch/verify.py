"""Offline pg_cron/pg_net transaction rehearsal, with loopback network disabled."""
from pathlib import Path
import os
import subprocess
import tempfile

SQL = Path(__file__).with_name("SCHEDULE-ONCE.sql").read_text()
PG = Path(os.getenv("PG_BINDIR", "/opt/homebrew/opt/postgresql@15/bin"))
SCHEMA = """
create schema cron; create schema net; create schema vault; create schema fhfh_internal;
create role anon; create role authenticated; create role service_role;
create table cron.job (jobid bigserial primary key,jobname text unique,schedule text,command text);
create function cron.schedule(text,text,text) returns bigint language sql as $$
  insert into cron.job(jobname,schedule,command) values ($1,$2,$3) returning jobid $$;
create function cron.unschedule(bigint) returns boolean language sql as $$
  delete from cron.job where jobid=$1 returning true $$;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create function fhfh_internal.require_cron_request_headers() returns jsonb language sql as
  $$select '{"Authorization":"fixture"}'::jsonb$$;
create table net.queue(id bigserial primary key,url text,headers jsonb,timeout_ms int);
create function net.http_get(url text,headers jsonb,timeout_milliseconds int) returns bigint language sql as $$
  insert into net.queue(url,headers,timeout_ms) values ($1,$2,$3) returning id $$;
create table public.blsh_official_runs(source_date date);
create table public.blsh_capture_runs(run_id int,source_date date,manifest_sha256 text,pruned_at timestamptz,state text);
create table public.blsh_context_runs(native_run_id int,source_date date,native_manifest_sha256 text,state text);
insert into vault.decrypted_secrets values ('blsh_official_grant_20261120','fixture-grant');
insert into public.blsh_capture_runs values (1,'2026-11-20','fixture',null,'packet_complete_pending_review');
insert into public.blsh_context_runs values (1,'2026-11-20','fixture','packet_complete_pending_review');
"""
with tempfile.TemporaryDirectory(prefix="blsh-dispatch-", dir="/tmp") as root:
    env = {"PATH": str(PG) + ":/usr/bin:/bin", "LC_ALL": "C", "HOME": root}
    data = Path(root, "data")
    def run(*args, **kw):
        return subprocess.run(args, capture_output=True, text=True, env=env, timeout=40, **kw)
    def query(db, statement, expect_ok=True):
        result = run(PG/"psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-h", root, "-U", "postgres", db, input=statement)
        assert (result.returncode == 0) == expect_ok, result.stderr
        return result.stdout.strip()
    run(PG/"initdb", "-D", data, "-U", "postgres", "-A", "trust", "--no-locale", "--no-sync", check=True)
    run(PG/"pg_ctl", "-D", data, "-l", Path(root, "log"), "-o", f"-k {root} -c listen_addresses=''", "-w", "start", check=True)
    try:
        query("postgres", SCHEMA)
        # The psql script itself accepts no clock input. Substitute the DB wall clock only in fixture copies.
        script = SQL.replace("pg_catalog.clock_timestamp()", "current_setting('fixture.now')::timestamptz")
        cases = [("normal", "2026-11-21 12:45:35Z", "queued"), ("late", "2026-11-21 12:46Z", "expired"),
                 ("later_year", "2027-11-21 12:45Z", "expired"), ("missing_grant", "2026-11-21 12:45Z", "refused"),
                 ("net_failure", "2026-11-21 12:45Z", "enqueue_failed")]
        for db, clock, outcome in cases:
            query("postgres", f"create database {db} template postgres")
            query(db, "set fixture.now='2026-11-21 12:45Z';\n" + script, expect_ok=False)
            query(db, "set fixture.now='2026-11-21 12:44Z';\n" + script)
            command = query(db, "select command from cron.job")
            if db == "missing_grant": query(db, "delete from vault.decrypted_secrets")
            if db == "net_failure": query(db, "alter table net.queue add check (false)")
            fire = f"set fixture.now='{clock}';\n" + command
            query(db, fire)
            query(db, fire)
            assert query(db, "select count(*) from cron.job") == "0"
            assert query(db, "select disposition from fhfh_internal.blsh_official_dispatch_20261120") == outcome
            assert query(db, "select count(*) from net.queue") == ("1" if outcome == "queued" else "0")
            if outcome == "queued":
                assert query(db, """select request_id=id and url='https://fhfhockey.com/api/v1/db/blsh-official-boxscores'
                    and timeout_ms=240000 and headers->>'x-blsh-official-grant'='fixture-grant' and headers->>'Authorization'='fixture'
                    from net.queue cross join fhfh_internal.blsh_official_dispatch_20261120""") == "t"
        print("PASS one queued GET with durable HTTP ID, duplicate suppressed, registration cutoff, late/next-year expiry, missing grant, rejected enqueue, self-unscheduling")
    finally:
        run(PG/"pg_ctl", "-D", data, "-m", "immediate", "-w", "stop", check=True)
