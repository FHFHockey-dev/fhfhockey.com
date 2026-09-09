-- Keep one owner for each NST workload and stop invoking the quarantined
-- rolling-games stub. Names are guarded so this migration cannot disable an
-- unexpected scheduler row silently.

do $migration$
declare
  target_job record;
  target_name text;
begin
  foreach target_name in array array[
    'update-nst-tables-all',
    'update-nst-team-daily',
    'update-rolling-games-recent'
  ]
  loop
    if (select count(*) from cron.job where jobname = target_name) <> 1 then
      raise exception 'Expected exactly one cron job named %', target_name;
    end if;

    select jobid, active
      into target_job
      from cron.job
      where jobname = target_name;

    if target_job.active then
      perform cron.alter_job(
        job_id := target_job.jobid,
        active := false
      );
    end if;
  end loop;

  if (
    select count(*)
    from cron.job
    where jobname = 'update-nst-team-daily-incremental'
  ) <> 1 then
    raise exception 'Expected exactly one cron job named update-nst-team-daily-incremental';
  end if;

  select jobid, active
    into target_job
    from cron.job
    where jobname = 'update-nst-team-daily-incremental';

  perform cron.alter_job(
    job_id := target_job.jobid,
    schedule := '55 9 * * *',
    active := true
  );
end
$migration$;
