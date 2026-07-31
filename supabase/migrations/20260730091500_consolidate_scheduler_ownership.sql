-- Consolidate natural writer ownership before the matching application release.
--
-- Rollback metadata:
--   reactivate the named jobs below with cron.alter_job(..., active := true);
--   restore update-yahoo-players' exact prior command from the migration receipt
--   if the self-discovered game scope must be rolled back.

do $$
declare
  job_name text;
  resolved_job_id bigint;
  matching_jobs integer;
  prior_command text;
  canonical_command text;
begin
  if to_regclass('cron.job') is null then
    raise exception 'cron.job is unavailable';
  end if;

  -- The supported schema-only baseline contains no pg_cron row data. Hosted
  -- databases must still satisfy every exact-name assertion below.
  if not exists (select 1 from cron.job) then
    raise notice 'scheduler ownership skipped for data-free baseline replay';
    return;
  end if;

  foreach job_name in array array[
    'run-forge-projection-v2',
    'rebuild-sustainability-priors',
    'rebuild-sustainability-window-z',
    'rebuild-sustainability-score',
    'rebuild-sustainability-trend-bands',
    'sync-yahoo-players-to-sheet'
  ]
  loop
    select count(*), min(jobid)
      into matching_jobs, resolved_job_id
    from cron.job
    where jobname = job_name;

    if matching_jobs <> 1 then
      raise exception 'expected exactly one cron job named %, found %',
        job_name, matching_jobs;
    end if;

    perform cron.alter_job(job_id := resolved_job_id, active := false);
  end loop;

  select count(*), min(jobid), min(command)
    into matching_jobs, resolved_job_id, prior_command
  from cron.job
  where jobname = 'update-yahoo-players';

  if matching_jobs <> 1 then
    raise exception 'expected exactly one cron job named update-yahoo-players, found %',
      matching_jobs;
  end if;
  if position('?gameId=465' in prior_command) = 0 then
    raise exception 'update-yahoo-players command does not contain the expected fixed game scope';
  end if;

  canonical_command := replace(prior_command, '?gameId=465', '');
  if canonical_command = prior_command
     or position('gameId=465' in canonical_command) > 0 then
    raise exception 'could not remove the fixed Yahoo game scope safely';
  end if;

  perform cron.alter_job(
    job_id := resolved_job_id,
    command := canonical_command,
    active := true
  );

  foreach job_name in array array[
    'rebuild-sustainability-baselines',
    'run-forge-projection-v2-weekly',
    'update-yahoo-matchup-dates',
    'update-sko-stats-full-season',
    'update-predictions-sko'
  ]
  loop
    select count(*)
      into matching_jobs
    from cron.job
    where jobname = job_name
      and active;

    if matching_jobs <> 1 then
      raise exception 'expected exactly one retained active cron job named %, found %',
        job_name, matching_jobs;
    end if;
  end loop;
end
$$;
