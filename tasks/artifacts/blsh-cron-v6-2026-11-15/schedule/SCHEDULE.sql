-- BLSH native capture v6: pg_cron schedule (DESIGN.md §6, §7, §8). NOT a migration.
-- Deliberately outside supabase/migrations/ so `db push` can never apply it. Running it needs TJ's
-- separate approval AFTER: the capture route is deployed, 20261116000000_blsh_native_capture_v6.sql
-- is applied, and the first approved deployment probe has passed. Setting
-- blsh_capture_control.enabled = true is a further, separate approval.
--
-- Slots (UTC): capture 12:05 and backup 12:20 (15 min apart: NST_MIN_CRON_BURST_GAP_MS is 10 min);
-- watchdog mark 12:50; watchdog assert 12:52. All before the 13:00 cron-report.

begin;

create or replace function fhfh_internal.invoke_blsh_endpoint(p_path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  request_id bigint;
begin
  if p_path is null or p_path !~ '^/api/v1/db/blsh-native-capture$' then
    raise exception using errcode = '22023', message = 'BLSH_CRON_PATH_INVALID';
  end if;
  select pg_catalog.min(ds.decrypted_secret) into base_url from vault.decrypted_secrets as ds where ds.name = 'site_url';
  base_url := pg_catalog.rtrim(coalesce(nullif(pg_catalog.btrim(base_url), ''), 'https://fhfhockey.com'), '/');
  select net.http_post(
    url := base_url || p_path,
    body := '{}'::jsonb,
    headers := fhfh_internal.require_cron_request_headers() || '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 240000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function fhfh_internal.invoke_blsh_endpoint(text) from public, anon, authenticated, service_role;

select cron.schedule('blsh-native-capture', '5 12 * * *',
  $job$select fhfh_internal.invoke_blsh_endpoint('/api/v1/db/blsh-native-capture')$job$);
select cron.schedule('blsh-native-capture-backup', '20 12 * * *',
  $job$select fhfh_internal.invoke_blsh_endpoint('/api/v1/db/blsh-native-capture')$job$);
select cron.schedule('blsh-native-capture-watchdog', '50 12 * * *',
  $job$select public.blsh_capture_watchdog_v1()$job$);
select cron.schedule('blsh-native-capture-watchdog-assert', '52 12 * * *',
  $job$select public.blsh_capture_watchdog_assert_v1()$job$);

commit;

-- Read back (expect 4 rows, active):
--   select jobid, jobname, schedule, active from cron.job where jobname like 'blsh-native-capture%' order by jobname;
--
-- Rollback (kill switch first: instant, no deploy):
--   update public.blsh_capture_control set enabled = false, updated_at = now();
--   select cron.unschedule(jobid) from cron.job where jobname in ('blsh-native-capture', 'blsh-native-capture-backup',
--     'blsh-native-capture-watchdog', 'blsh-native-capture-watchdog-assert');
--   drop function fhfh_internal.invoke_blsh_endpoint(text);
