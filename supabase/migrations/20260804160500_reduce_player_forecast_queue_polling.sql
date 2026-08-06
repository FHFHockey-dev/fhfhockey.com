begin;

do $$
declare
  existing_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise notice 'player forecast cron update skipped because pg_cron is unavailable';
    return;
  end if;

  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'player-forecasts-queue-drain'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  -- Five-minute observation debounce plus five-minute polling keeps the
  -- maximum normal queue age at ten minutes while avoiding idle requests.
  perform cron.schedule(
    'player-forecasts-queue-drain',
    '*/5 * * * *',
    $job$select fhfh_internal.invoke_player_forecast_endpoint('/api/v1/player-forecasts/jobs/drain?dryRun=true')$job$
  );
end
$$;

commit;
