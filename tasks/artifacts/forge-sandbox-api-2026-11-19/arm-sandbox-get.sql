-- One Supabase Cron firing of the FORGE sandbox GET, in the shape of WGO's update-wgo-skater-stats job (job 9):
-- net.http_get to the production route with the existing Vault 'cron_secret' as a Bearer header. The fired-once
-- function records the request id and unschedules its own job; any later tick enqueues nothing.
-- psql variable: schedule (one cron minute in UTC, e.g. '41 20 19 11 *'). Touches no other job.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '2s';
do $$ begin
  if to_regnamespace('forge_sandbox_capture') is null
    or exists (select from cron.job where jobname = 'forge-sandbox-get-2099020991')
    or to_regclass('forge_sandbox_capture.sandbox_get_requests') is not null
    or exists (select from forge_sandbox_capture.sandbox_runs)
    or coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC')
    or (select count(*) from vault.decrypted_secrets where name = 'cron_secret') <> 1
    then raise exception 'sandbox_get_preflight_failed'; end if;
end $$;

create table forge_sandbox_capture.sandbox_get_requests (
  job_name text primary key check (job_name = 'forge-sandbox-get-2099020991'),
  jobid bigint not null,
  request_id bigint not null,
  fired_at timestamptz not null default clock_timestamp()
);
revoke all on forge_sandbox_capture.sandbox_get_requests from public;

-- Runs as the scheduling user (postgres), like job 9, so it can read Vault and call pg_net. The bearer never
-- appears in cron.job.command or in the URL.
create function forge_sandbox_capture.sandbox_get_fire_2099020991() returns text
language plpgsql set search_path = '' as $$
declare request bigint; job bigint;
begin
  perform pg_advisory_xact_lock(hashtext('forge_sandbox_get_2099020991'));
  select jobid into job from cron.job where jobname = 'forge-sandbox-get-2099020991';
  if exists (select from forge_sandbox_capture.sandbox_get_requests) then
    if job is not null then perform cron.unschedule(job); end if;
    return 'already_fired';
  end if;
  request := net.http_get(url := 'https://fhfhockey.com/api/v1/db/forge-sandbox-run',
    headers := ('{}'::jsonb || jsonb_build_object('Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))),
    timeout_milliseconds := 240000);
  insert into forge_sandbox_capture.sandbox_get_requests (job_name, jobid, request_id) values ('forge-sandbox-get-2099020991', job, request);
  perform cron.unschedule(job);
  return 'fired ' || request;
end $$;
revoke all on function forge_sandbox_capture.sandbox_get_fire_2099020991() from public;

select cron.schedule('forge-sandbox-get-2099020991', :'schedule', 'select forge_sandbox_capture.sandbox_get_fire_2099020991()');
commit;
select jobid, jobname, schedule, active, command from cron.job where jobname = 'forge-sandbox-get-2099020991';
