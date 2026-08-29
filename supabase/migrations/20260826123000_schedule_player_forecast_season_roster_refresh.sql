create or replace function fhfh_internal.register_player_forecast_season_cron(
  p_dry_run boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_job_id bigint;
  roster_path text;
  drain_path text;
  daily_path text;
begin
  if pg_catalog.to_regclass('cron.job') is null then
    raise exception using
      errcode = '55000',
      message = 'PLAYER_FORECAST_SEASON_PG_CRON_UNAVAILABLE';
  end if;

  for existing_job_id in
    select jobid
    from cron.job
    where jobname in (
      'player-forecasts-season-roster-refresh',
      'player-forecasts-season-queue-drain',
      'player-forecasts-season-daily-release'
    )
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  roster_path := '/api/v1/player-forecasts/jobs/season-roster?dryRun='
    || pg_catalog.lower(p_dry_run::text);
  drain_path := '/api/v1/player-forecasts/jobs/season-drain?dryRun='
    || pg_catalog.lower(p_dry_run::text);
  daily_path := '/api/v1/player-forecasts/jobs/season-daily?dryRun='
    || pg_catalog.lower(p_dry_run::text);

  perform cron.schedule(
    'player-forecasts-season-roster-refresh',
    '30 9 * * *',
    pg_catalog.format(
      'select fhfh_internal.invoke_player_forecast_endpoint(%L)',
      roster_path
    )
  );
  perform cron.schedule(
    'player-forecasts-season-queue-drain',
    '*/5 * * * *',
    pg_catalog.format(
      'select fhfh_internal.invoke_player_forecast_season_endpoint_if_due(%L)',
      drain_path
    )
  );
  perform cron.schedule(
    'player-forecasts-season-daily-release',
    '0 10 * * *',
    pg_catalog.format(
      'select fhfh_internal.invoke_player_forecast_endpoint(%L)',
      daily_path
    )
  );
end;
$$;

