-- Idempotent: remove every signed-witness cron job, then prove none is left. Verdicts and targets stay. Run as postgres.
\set ON_ERROR_STOP on
select cron.unschedule(jobid) from cron.job where jobname like 'forge-witness-signed-%';
do $$ begin
  if exists (select from cron.job where jobname like 'forge-witness-signed-%') then raise exception 'signed_job_still_registered'; end if;
end $$;
select count(*) as registered_signed_jobs from cron.job where jobname like 'forge-witness-signed-%';
