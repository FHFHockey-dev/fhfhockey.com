-- BLSH hosted fixture replay, recut R' (2026-11-21): a copy of the pinned arm-replay-get.sql that takes the run date as a parameter.
-- Same dispatch, table, function and job names as the original (so disarm-replay-get.sql and readback-replay-get.sql apply
-- unchanged). Only the date fuse differs: R' runs the replay on any real UTC day, because on the replay path alone the
-- request-context date gate compares against the slate's logical ingress day 2026-11-20 (the live route keeps the real day).
-- One Supabase Cron firing per stage, each a GET to its own route, dispatched exactly like the planned production BLSH job
-- (base URL from Vault 'site_url', default https://fhfhockey.com; headers from fhfh_internal.require_cron_request_headers();
-- 240 s timeout). Each job records its pg_net request id and unschedules itself; a later tick enqueues nothing.
-- psql variables (all required):
--   run_date          real UTC day of both firings, YYYY-MM-DD. Must be today (UTC) and within 2026-11-20..2026-11-26: the native
--                     plan refuses the 2026-11-19 slate from 2026-11-27T00:00Z (8-day bound in nativeProcessCapturePreparation.ts).
--   schedule_native   'M H D Mo *' on run_date, more than 1 minute from now.
--   schedule_context  'M H D Mo *' on run_date, at least 2 minutes after native and no later than 23:50Z, so both stages and the
--                     context's same-real-day checks finish before 00:00Z.
-- e.g. psql ... -v run_date=2026-11-21 -v schedule_native='30 21 21 11 *' -v schedule_context='32 21 21 11 *' -f arm-replay-get-dated.sql
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '2s';
set local blsh_replay_arm.run_date = :'run_date';
set local blsh_replay_arm.schedule_native = :'schedule_native';
set local blsh_replay_arm.schedule_context = :'schedule_context';
do $$
declare
  v_text text := current_setting('blsh_replay_arm.run_date');
  v_day date; v_native timestamptz; v_context timestamptz; v_fire timestamptz; v_m text[]; v_which text;
begin
  if to_regnamespace('blsh_replay') is null or to_regprocedure('fhfh_internal.require_cron_request_headers()') is null
    or exists (select from cron.job where jobname like 'blsh-replay-%-20261119%')
    or to_regclass('blsh_replay.replay_get_requests') is not null
    or exists (select from blsh_replay.blsh_capture_runs) or exists (select from blsh_replay.receipts)
    or coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC')
    then raise exception 'replay_get_preflight_failed'; end if;
  if v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'replay_get_run_date_invalid'; end if;
  begin v_day := v_text::date; exception when others then raise exception 'replay_get_run_date_invalid'; end;
  if v_day::text <> v_text or v_day <> (pg_catalog.now() at time zone 'UTC')::date
    or v_day < date '2026-11-20' or v_day > date '2026-11-26' then raise exception 'replay_get_run_date_invalid'; end if;
  foreach v_which in array array['native', 'context'] loop
    v_m := pg_catalog.regexp_match(current_setting('blsh_replay_arm.schedule_' || v_which), '^([0-9]{1,2}) ([0-9]{1,2}) ([0-9]{1,2}) ([0-9]{1,2}) [*]$');
    if v_m is null or v_m[1]::int > 59 or v_m[2]::int > 23 or v_m[3]::int <> extract(day from v_day)::int or v_m[4]::int <> extract(month from v_day)::int
      then raise exception 'replay_get_schedule_invalid'; end if;
    v_fire := (v_day + pg_catalog.make_time(v_m[2]::int, v_m[1]::int, 0)) at time zone 'UTC';
    if v_which = 'native' then v_native := v_fire; else v_context := v_fire; end if;
  end loop;
  if v_native <= pg_catalog.now() + interval '1 minute' or v_context < v_native + interval '2 minutes'
    or v_context > (v_day + time '23:50') at time zone 'UTC' then raise exception 'replay_get_schedule_invalid'; end if;
  perform fhfh_internal.require_cron_request_headers();  -- refuses unless exactly one non-empty Vault cron_secret
end $$;

create table blsh_replay.replay_get_requests (
  job_name text primary key check (job_name in ('blsh-replay-native-20261119', 'blsh-replay-context-20261119',
    'blsh-replay-native-20261119-repeat', 'blsh-replay-context-20261119-repeat')),
  jobid bigint not null,
  request_id bigint not null,
  fired_at timestamptz not null default clock_timestamp()
);
revoke all on blsh_replay.replay_get_requests from public;

-- Runs as the scheduling user (postgres), like the production BLSH job. The bearer never appears in cron.job.command or the URL.
create function blsh_replay.replay_get_fire(p_job text, p_path text) returns text
language plpgsql set search_path = '' as $$
declare request bigint; job bigint; base_url text;
begin
  if p_path not in ('/api/v1/db/blsh-replay-native', '/api/v1/db/blsh-replay-context') then raise exception 'replay_path_invalid'; end if;
  perform pg_advisory_xact_lock(hashtext('blsh_replay_get_20261119'));
  select jobid into job from cron.job where jobname = p_job;
  if exists (select from blsh_replay.replay_get_requests where job_name = p_job) then
    if job is not null then perform cron.unschedule(job); end if;
    return 'already_fired';
  end if;
  select pg_catalog.min(ds.decrypted_secret) into base_url from vault.decrypted_secrets as ds where ds.name = 'site_url';
  base_url := pg_catalog.rtrim(coalesce(nullif(pg_catalog.btrim(base_url), ''), 'https://fhfhockey.com'), '/');
  request := net.http_get(url := base_url || p_path, headers := fhfh_internal.require_cron_request_headers(), timeout_milliseconds := 240000);
  insert into blsh_replay.replay_get_requests (job_name, jobid, request_id) values (p_job, job, request);
  perform cron.unschedule(job);
  return 'fired ' || request;
end $$;
revoke all on function blsh_replay.replay_get_fire(text, text) from public;

select cron.schedule('blsh-replay-native-20261119', :'schedule_native',
  $job$select blsh_replay.replay_get_fire('blsh-replay-native-20261119', '/api/v1/db/blsh-replay-native')$job$);
select cron.schedule('blsh-replay-context-20261119', :'schedule_context',
  $job$select blsh_replay.replay_get_fire('blsh-replay-context-20261119', '/api/v1/db/blsh-replay-context')$job$);
commit;
select jobid, jobname, schedule, active, command from cron.job where jobname like 'blsh-replay-%-20261119%' order by jobname;
