#!/usr/bin/env python3
"""Disposable PostgreSQL 15 validation of the RE-DATED BLSH pilot operator SQL (capture 2026-11-22, source 2026-11-21)
against the four real BLSH migrations plus the forward re-date migration 20261120143000 (not applied anywhere else).

No TCP listener, no inherited PG* environment, no network. pg_cron, pg_net, Vault and Supabase storage are stubs.
Byte-exact runs use the pinned files on the real database clock (valid before 2026-11-22 12:05Z).
Runs inside the pilot window use copies whose only change is pg_catalog.clock_timestamp() -> fixture.wall_clock();
they are labelled "shifted" below.
"""
from hashlib import sha256
from pathlib import Path
import re
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
PREV = HERE.parents[1] / "live-readiness-2026-11-19"
PG = Path("/opt/homebrew/opt/postgresql@15/bin")
MIGRATIONS = {  # release order; the first four from RELEASE-PINS.md / PRODUCTION-DEPLOY-RECEIPT.md, the fifth is new
    "20261116000000_blsh_native_capture_v6.sql": "4e896a891d02543a5a500597c7ce97d745e6a724d1c5100de1a7a2e8c9250c70",
    "20261116000100_blsh_request_context_v1.sql": "920e3430a89d1c91ac5899f52a2a606563d6e6f700f77e1750dbf5511089642b",
    "20261118131414_blsh_request_context_custody.sql": "db35ba0993d110a10dc2a7eb9e54b5b39cf7ed7415d14b3522283b2cb62b8e9f",
    "20261118155445_blsh_official_pilot.sql": "dd204d114dd83befab28cc17477f77a80ab8f40c96edbcdf27eb9759a2adc220",
    "20261120143000_blsh_official_pilot_redate_20261121.sql": "ce14c532f1b9169e52a310e7a3affb29c27b37a00f0bcf08e022de539e7f0f7b",
}
ORIGINAL_MIGRATIONS = list(MIGRATIONS)[:4]
PINNED = {
    "INSTALL": (HERE / "INSTALL.sql", "e51a9a967b8b72f8cdb9178f6f933ed80bdfd1cf6d28e1255fd532654297bc87"),
    "ARM": (HERE / "ARM.sql", "d28d1ef9bad47cf0eb0d66028e3150f2d91fced9d56bb4b8154ea455436f0f31"),
    "DISARM": (HERE / "DISARM-ROLLBACK.sql", "513b28b5a82d58389a5b3df1de42265cc63e7928b76d3eedc6d27d95478fa30e"),
    "SCHEDULE": (HERE / "SCHEDULE-ONCE.sql", "600699bae9fb9a064fceea6563c662676388cdb7fbd4c9d24a41db5e93f49bf1"),
    "CANCEL": (HERE / "CANCEL-OFFICIAL-ONCE.sql", "a9b39d83cd2ae033cd6827bffcfbe2dc9b88bc69842dcfd4c3147b98d55cc81c"),
    "SWITCHOFF": (PREV / "SWITCH-OFF.sql", "19abbc7f23ec69df490dd5ca4bd226353c421fe72bdf51460ad155c6f5c0ed33"),
}
PINS = {"release_sha": "a" * 40, "deployment_id": "dpl_ReviewedFixture"}
DEPLOYMENT = '{"deploymentId":"dpl_ReviewedFixture","gitCommitSha":"' + "a" * 40 + '"}'
STUBS = """
create role anon; create role authenticated; create role service_role bypassrls login;
create schema storage; create schema cron; create schema net; create schema vault; create schema fhfh_internal;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text,metadata jsonb,owner uuid);
alter table storage.objects enable row level security;
-- pg_cron shape: jobid sequence, active flag, name unique per user. Seed the live BLSH jobs and an unrelated 408.
create table cron.job(jobid bigserial primary key,schedule text not null,command text not null,nodename text default 'localhost',
  nodeport int default 5432,database text default 'postgres',username text default 'postgres',active boolean not null default true,jobname text unique);
insert into cron.job(jobid,jobname,schedule,command) values
 (404,'blsh-native-capture','5 12 * * *','select fhfh_internal.invoke_blsh_endpoint(''/api/v1/db/blsh-native-capture'')'),
 (405,'blsh-native-capture-backup','20 12 * * *','select fhfh_internal.invoke_blsh_endpoint(''/api/v1/db/blsh-native-capture'')'),
 (406,'blsh-native-capture-watchdog','50 12 * * *','select public.blsh_capture_watchdog_v1()'),
 (407,'blsh-native-capture-watchdog-assert','52 12 * * *','select public.blsh_capture_watchdog_assert_v1()'),
 (408,'unrelated-job-408','0 13 * * *','select 1');
select setval('cron.job_jobid_seq', 408);
create function cron.schedule(text,text,text) returns bigint language sql as
  $$ insert into cron.job(jobname,schedule,command) values ($1,$2,$3) returning jobid $$;
create function cron.unschedule(bigint) returns boolean language plpgsql as $$
begin delete from cron.job where jobid=$1; if not found then raise exception 'could not find valid entry for job %', $1; end if; return true; end $$;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create function fhfh_internal.require_cron_request_headers() returns jsonb language sql as $$select '{"Authorization":"fixture"}'::jsonb$$;
create table net.queue(id bigserial primary key,url text,headers jsonb,timeout_ms int);
create function net.http_get(url text,headers jsonb,timeout_milliseconds int) returns bigint language sql as
  $$ insert into net.queue(url,headers,timeout_ms) values ($1,$2,$3) returning id $$;
create schema fixture;
create function fixture.wall_clock() returns timestamptz language sql volatile as $$select current_setting('fixture.at')::timestamptz$$;
"""
SNAPSHOT = r"""
select json_build_object(
 'jobs_404_408', (select json_agg(row_to_json(j) order by jobid) from cron.job j where jobid between 404 and 408),
 'pilot_jobs_active', (select count(*) from cron.job where jobname like 'blsh-official-once-%' and active),
 'all_jobs', (select json_agg(jobid order by jobid) from cron.job),
 'raw_enabled', (select enabled from public.blsh_capture_control where singleton),
 'enabled_def_sha', encode(sha256(convert_to(pg_get_functiondef('public.blsh_capture_enabled_v1()'::regprocedure),'UTF8')),'hex'),
 'permit_table', to_regclass('public.blsh_pilot_20261122') is not null,
 'permit_rows', case when to_regclass('public.blsh_pilot_20261122') is null then null
   else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.blsh_pilot_20261122', false, true, '')))[1]::text end,
 'claim_trigger', (select count(*) from pg_trigger where tgname='blsh_pilot_claim_20261122'),
 'claim_function', to_regprocedure('public.blsh_pilot_claim_20261122()') is not null,
 'dispatch_table', to_regclass('fhfh_internal.blsh_official_dispatch_20261121') is not null,
 'native_runs', (select count(*) from public.blsh_capture_runs),
 'net_queue', (select count(*) from net.queue))::text
"""
BASELINE_ENABLED_SHA = "8dfa681a7e3e1439b6a47f4e2dc9b9e2aeab431251234f8939e01928b1a4a923"
results = []


def check(label, condition, detail=""):
    results.append(("PASS" if condition else "FAIL") + " " + label + (f" [{detail}]" if detail and not condition else ""))
    if not condition:
        raise AssertionError(label + " " + str(detail))


def main():
    # 1. Pins of the exact bytes under test.
    for name, digest in MIGRATIONS.items():
        check(f"migration {name} sha256 matches release pin",
              sha256((ROOT / "supabase/migrations" / name).read_bytes()).hexdigest() == digest)
    for name, (path, digest) in PINNED.items():
        if digest:
            check(f"{path.name} sha256 matches its pin", sha256(path.read_bytes()).hexdigest() == digest)
    # 2. Static: no operator file addresses jobs 404-408 by ID outside comments.
    for name, (path, _) in PINNED.items():
        code = "\n".join(line.split("--", 1)[0] for line in path.read_text().splitlines())
        check(f"{path.name} names no job ID 404-408 in code", not re.search(r"\b40[4-8]\b", code))

    with tempfile.TemporaryDirectory(prefix="blsh-live-", dir="/tmp") as root:  # short path: unix-socket length limit
        env = {"PATH": str(PG) + ":/usr/bin:/bin", "LC_ALL": "C", "HOME": root}
        data = Path(root) / "data"

        def pg(*args):
            return subprocess.run(args, env=env, check=True, capture_output=True, timeout=60)

        pg(PG / "initdb", "-D", data, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8", "--no-sync")
        pg(PG / "pg_ctl", "-D", data, "-l", Path(root) / "log", "-o", f"-k {root} -c listen_addresses=''", "-w", "start")
        try:
            run(root, env)
        finally:
            pg(PG / "pg_ctl", "-D", data, "-m", "immediate", "-w", "stop")
    print("\n".join(results))
    print(f"ALL {len(results)} CHECKS PASSED")


def run(root, env):
    def sql(db, statement, *, at=None, role="postgres", pins=PINS, error=None):
        cli = [PG / "psql", "-XAtq", "-h", root, "-U", role, "-d", db, "-v", "ON_ERROR_STOP=1"]
        for k, v in pins.items():
            cli += ["-v", f"{k}={v}"]
        prefix = f"set fixture.at = '{at}';\n" if at else ""
        r = subprocess.run(cli, input=prefix + statement, env=env, text=True, capture_output=True, timeout=30)
        if error:
            assert r.returncode != 0 and error in r.stderr, (error, r.stdout, r.stderr)
        else:
            assert r.returncode == 0, r.stderr
        return r.stdout.strip()

    def exact(name):
        return PINNED[name][0].read_text()

    def shifted(name):
        body = exact(name)
        assert "fixture." not in body
        return body.replace("pg_catalog.clock_timestamp()", "fixture.wall_clock()")

    def snap(db):
        import json
        return json.loads(sql(db, SNAPSHOT))

    # Template database: stubs + the four real migrations in release order.
    sql("postgres", "create database tmpl")
    sql("tmpl", STUBS)
    for name in MIGRATIONS:
        body = (ROOT / "supabase/migrations" / name).read_text()
        # 154 defines SQL functions over source tables this disposable DB does not have; they are never called here.
        prefix = "set check_function_bodies = off;\n" if name.startswith("20261116000100") else ""
        sql("tmpl", prefix + body)
    check("four real BLSH migrations plus the forward re-date migration applied on PostgreSQL 15", sql("tmpl", "show server_version").startswith("15."),
          sql("tmpl", "show server_version"))
    check("migration 153 switch function matches INSTALL's guard hash", snap("tmpl")["enabled_def_sha"] == BASELINE_ENABLED_SHA)

    def fresh(db):
        sql("postgres", f"create database {db} template tmpl")
        return snap(db)

    # 3. Byte-exact cycle on the real clock (today is before the 12:05Z start).
    s0 = fresh("exact")
    check("baseline: raw switch off, no permit, jobs 404-408 seeded, zero pilot jobs",
          s0["raw_enabled"] is False and not s0["permit_table"] and len(s0["jobs_404_408"]) == 5 and s0["pilot_jobs_active"] == 0)
    sql("exact", exact("INSTALL"))
    s1 = snap("exact")
    check("INSTALL (exact bytes): permit row, trigger, function; switch still off",
          s1["permit_rows"] == "1" and s1["claim_trigger"] == 1 and s1["claim_function"] and s1["raw_enabled"] is False)
    sql("exact", exact("INSTALL"), error="pilot_migration_153_definition_mismatch")
    check("INSTALL rerun fails closed (installed window function no longer matches 153) and leaves state identical",
          snap("exact") == s1)
    sql("exact", exact("ARM"))
    s2 = snap("exact")
    check("ARM (exact bytes): raw on, effective off outside the window",
          s2["raw_enabled"] is True and sql("exact", "select public.blsh_capture_enabled_v1()") == "f")
    sql("exact", exact("ARM"), error="pilot_not_armable")
    check("ARM rerun fails closed and leaves state identical", snap("exact") == s2)
    sql("exact", exact("ARM"), pins={**PINS, "deployment_id": "dpl_Wrong"}, error="pilot_not_armable")
    sql("exact", exact("DISARM"))
    s3 = snap("exact")
    check("DISARM (exact bytes) returns to baseline: switch off, original function, permit removed", s3 == s0, (s3, s0))
    sql("exact", exact("DISARM"), error="does not exist")
    check("DISARM rerun fails closed (nothing to drop) and leaves baseline intact", snap("exact") == s0)
    sql("exact", exact("INSTALL"))
    sql("exact", exact("DISARM"))
    check("cycle is repeatable: INSTALL accepts the restored function, DISARM returns to baseline", snap("exact") == s0)

    # 4. Shifted full sequence: INSTALL -> ARM -> claim -> SCHEDULE-ONCE -> DISARM -> CANCEL.
    def to_scheduleable(db):
        sql(db, shifted("INSTALL"), at="2026-11-22 11:00:00+00")
        sql(db, shifted("ARM"), at="2026-11-22 12:00:00+00")
        claimed = sql(db, f"select public.blsh_capture_claim_v1('native-v6','2026-11-21','{DEPLOYMENT}') ->> 'claimed'",
                      role="service_role", at="2026-11-22 12:05:30+00")
        check(f"[{db}] shifted claim at 12:05:30 inside the permit", claimed == "true")
        sql(db, f"select public.blsh_capture_claim_v1('native-v6','2026-11-21','{DEPLOYMENT}') ->> 'claimed'",
                     role="service_role", at="2026-11-22 12:20:00+00", error="BLSH capture is disabled")
        # Fixture only: mark the native and context packets complete (replica mode bypasses custody triggers).
        sql(db, """set session_replication_role = replica;
          update public.blsh_capture_runs set state='packet_complete_pending_review', closed_at=claimed_at, manifest_sha256=repeat('c',64);
          insert into public.blsh_context_runs(source_date,native_run_id,native_manifest_sha256,state,closed_at,manifest_sha256)
            select source_date, run_id, manifest_sha256, 'packet_complete_pending_review', claimed_at, repeat('d',64) from public.blsh_capture_runs;
          insert into vault.decrypted_secrets values ('blsh_official_grant_20261121','fixture-grant');""")

    base = fresh("seq")
    to_scheduleable("seq")
    sql("seq", shifted("SCHEDULE"), at="2026-11-22 12:34:59+00", error="official_pilot_preflight_refused")
    sql("seq", shifted("SCHEDULE"), at="2026-11-22 12:40:00+00")
    s4 = snap("seq")
    job = sql("seq", "select jobid||'|'||jobname||'|'||schedule||'|'||active from cron.job where jobname like 'blsh-official-once-%'")
    check("SCHEDULE-ONCE (shifted) registers one job above 408 with the exact name and schedule",
          job == "409|blsh-official-once-20261121|45 12 22 11 *|true" and s4["pilot_jobs_active"] == 1, job)
    check("dispatch row records the returned job ID",
          sql("seq", "select job_id||'|'||disposition from fhfh_internal.blsh_official_dispatch_20261121") == "409|registered")
    sql("seq", shifted("SCHEDULE"), at="2026-11-22 12:40:00+00", error="official_pilot_preflight_refused")
    check("SCHEDULE-ONCE rerun fails closed and leaves state identical", snap("seq") == s4)
    sql("seq", shifted("DISARM"), at="2026-11-22 12:41:00+00")
    s5 = snap("seq")
    check("FINDING: DISARM alone leaves the one-time official job active (it never touches cron.job)",
          s5["pilot_jobs_active"] == 1 and s5["raw_enabled"] is False and not s5["permit_table"])
    sql("seq", shifted("CANCEL"), at="2026-11-22 12:41:30+00")
    s6 = snap("seq")
    check("DISARM + CANCEL leaves zero active BLSH pilot jobs; native claim and dispatch row retained",
          s6["pilot_jobs_active"] == 0 and s6["native_runs"] == 1 and s6["dispatch_table"]
          and sql("seq", "select job_id||'|'||disposition from fhfh_internal.blsh_official_dispatch_20261121") == "409|registered")
    sql("seq", shifted("CANCEL"), at="2026-11-22 12:42:00+00")
    check("CANCEL rerun is a no-op and leaves state identical", snap("seq") == s6)
    check("jobs 404-408 byte-identical after the whole sequence", s6["jobs_404_408"] == base["jobs_404_408"])
    check("only job 409 was ever added and it is gone", s6["all_jobs"] == base["all_jobs"])

    # 4b. Job fires at 12:45 (shifted): one queued GET, self-unscheduled; DISARM + CANCEL then still zero.
    fresh("fired")
    to_scheduleable("fired")
    sql("fired", shifted("SCHEDULE"), at="2026-11-22 12:40:00+00")
    command = sql("fired", "select command from cron.job where jobname='blsh-official-once-20261121'")
    sql("fired", command, at="2026-11-22 12:45:10+00")
    sql("fired", command, at="2026-11-22 12:45:20+00")
    sf = snap("fired")
    check("firing queues exactly one GET and unschedules itself",
          sf["net_queue"] == 1 and sf["pilot_jobs_active"] == 0
          and sql("fired", "select disposition from fhfh_internal.blsh_official_dispatch_20261121") == "queued")
    sql("fired", shifted("DISARM"), at="2026-11-22 12:50:00+00")
    sql("fired", shifted("CANCEL"), at="2026-11-22 12:50:10+00")
    check("after a fired dispatch, DISARM + CANCEL leave zero pilot jobs and 404-408 intact",
          snap("fired")["pilot_jobs_active"] == 0 and snap("fired")["jobs_404_408"] == base["jobs_404_408"])

    # 4c. CANCEL with nothing registered (pilot stopped before 12:35).
    fresh("never")
    sql("never", exact("CANCEL"))
    check("CANCEL with no dispatch table succeeds as a no-op", snap("never")["pilot_jobs_active"] == 0)
    sql("never", "select cron.schedule('blsh-official-once-20261121','45 12 22 11 *','select 1')")
    sql("never", exact("CANCEL"), error="official_cancel_unrecorded_job")
    check("CANCEL refuses an unrecorded same-name job (human decision) and leaves it", snap("never")["pilot_jobs_active"] == 1)

    # 5. Hazard: raw switch on without an installed permit. DISARM's DROP fails and rolls back its own switch-off.
    fresh("partial")
    sql("partial", "update public.blsh_capture_control set enabled = true where singleton")
    sql("partial", exact("DISARM"), error="does not exist")
    check("FINDING: DISARM without an installed permit fails and leaves the raw switch ON",
          snap("partial")["raw_enabled"] is True)
    sql("partial", exact("SWITCHOFF"))
    sp = snap("partial")
    check("SWITCH-OFF clears raw and effective switch without DDL or cron access",
          sp["raw_enabled"] is False and sql("partial", "select public.blsh_capture_enabled_v1()") == "f"
          and sp["jobs_404_408"] == base["jobs_404_408"])
    sql("partial", exact("SWITCHOFF"))
    check("SWITCH-OFF rerun is a no-op", snap("partial")["raw_enabled"] is False)


    # 6. Re-date proofs: forward migration guards, new window accepted, retired window and wrong slates refused.
    check("forward migration: source-date check now 2026-11-21",
          sql("tmpl", "select pg_get_constraintdef(oid) from pg_constraint where conname='blsh_official_runs_source_date_check'")
          == "CHECK ((source_date = '2026-11-21'::date))")
    redated_sha = sql("tmpl", "select encode(sha256(convert_to(pg_get_functiondef("
                      "'public.blsh_official_claim_v1(date,uuid,text,text,text,text,integer[])'::regprocedure),'UTF8')),'hex')")
    check("forward migration: claim function replaced (PostgreSQL 15 definition sha256 recorded)",
          redated_sha != "5893416fdcb334659cefb8e6873da4b88426f91bfda92bcf1b81cfbb86fba2c1", redated_sha)
    results[-1] += " " + redated_sha
    check("forward migration: execute grant on the claim function kept: service_role plus the owner only",
          sql("tmpl", "select string_agg(grantee::regrole::text, ',' order by grantee::regrole::text) from aclexplode((select proacl from pg_proc "
              "where oid='public.blsh_official_claim_v1(date,uuid,text,text,text,text,integer[])'::regprocedure)) where privilege_type='EXECUTE'")
          in ("postgres,service_role", "service_role,postgres"))
    forward = (ROOT / "supabase/migrations" / list(MIGRATIONS)[4]).read_text()
    sql("postgres", "create database again template tmpl")
    sql("again", forward, error="official_redate_definition_mismatch")
    check("forward migration rerun fails closed (definition already re-dated)", True)
    sql("postgres", "create database old")
    sql("old", STUBS.replace("create role anon; create role authenticated; create role service_role bypassrls login;\n", ""))  # roles are cluster-wide
    for name in ORIGINAL_MIGRATIONS:
        prefix = "set check_function_bodies = off;\n" if name.startswith("20261116000100") else ""
        sql("old", prefix + (ROOT / "supabase/migrations" / name).read_text())
    sql("old", """set session_replication_role = replica;
      insert into public.blsh_capture_runs(run_id,pipeline,source_date,state) values ('00000000-0000-4000-8000-0000000000aa','native-v6','2026-11-20','claimed');
      insert into public.blsh_official_runs(source_date,native_run_id,native_manifest_sha256,deployment_id,git_commit_sha,schedule_sha256,game_ids)
        values ('2026-11-20','00000000-0000-4000-8000-0000000000aa',repeat('a',64),'dpl_x',repeat('b',40),repeat('c',64),'{2026020301}');""")
    sql("old", forward, error="official_redate_runs_exist")
    check("forward migration refuses when any official run exists (and changes nothing)",
          sql("old", "select pg_get_constraintdef(oid) from pg_constraint where conname='blsh_official_runs_source_date_check'")
          == "CHECK ((source_date = '2026-11-20'::date))")
    for bad in ("2026-11-20", "2026-11-22"):
        sql("tmpl", f"select public.blsh_official_claim_v1('{bad}','00000000-0000-4000-8000-0000000000aa',repeat('a',64),'dpl_x',"
                    "repeat('b',40),repeat('c',64),'{2026020301}')", role="service_role", error="official_binding_invalid")
    check("official claim refuses the retired slate 2026-11-20 and the wrong slate 2026-11-22", True)

    def refused_claim(db, day, at, label):
        before = sql(db, "select count(*) from public.blsh_capture_runs")
        r = subprocess.run([PG / "psql", "-XAtq", "-h", root, "-U", "service_role", "-d", db, "-v", "ON_ERROR_STOP=1"],
                           input=f"set fixture.at = '{at}';\nselect public.blsh_capture_claim_v1('native-v6','{day}','{DEPLOYMENT}') ->> 'claimed';",
                           env=env, text=True, capture_output=True, timeout=30)
        reason = (r.stderr.strip().splitlines() or ["?"])[0]
        check(label + f" ({reason})", r.returncode != 0 and sql(db, "select count(*) from public.blsh_capture_runs") == before)

    fresh("newwin")
    sql("newwin", shifted("INSTALL"), at="2026-11-21 11:00:00+00")
    sql("newwin", shifted("ARM"), at="2026-11-21 11:30:00+00")
    refused_claim("newwin", "2026-11-20", "2026-11-21 12:05:30+00", "native: retired window (capture 2026-11-21 12:05:30, slate 2026-11-20) refused")
    refused_claim("newwin", "2026-11-20", "2026-11-22 12:05:30+00", "native: retired slate 2026-11-20 inside the new window refused")
    refused_claim("newwin", "2026-11-22", "2026-11-22 12:05:30+00", "native: wrong slate 2026-11-22 inside the new window refused")
    refused_claim("newwin", "2026-11-21", "2026-11-22 12:04:59.999+00", "native: new slate one millisecond before the window refused")
    refused_claim("newwin", "2026-11-21", "2026-11-22 12:07:00+00", "native: new slate at the 12:07:00 window end refused")
    check("native: new window accepts slate 2026-11-21 at 12:05:00.000 exactly",
          sql("newwin", f"select public.blsh_capture_claim_v1('native-v6','2026-11-21','{DEPLOYMENT}') ->> 'claimed'",
              role="service_role", at="2026-11-22 12:05:00+00") == "true")
    fresh("late")
    sql("late", shifted("INSTALL"), at="2026-11-22 12:05:00+00", error="pilot_install_after_primary_start")
    check("re-dated INSTALL refuses at or after 2026-11-22 12:05:00", not snap("late")["permit_table"])
    fresh("early")
    to_scheduleable("early")
    sql("early", shifted("SCHEDULE"), at="2026-11-21 12:40:00+00", error="official_pilot_preflight_refused")
    check("re-dated SCHEDULE-ONCE refuses in the retired 2026-11-21 window", snap("early")["pilot_jobs_active"] == 0)

if __name__ == "__main__":
    main()
