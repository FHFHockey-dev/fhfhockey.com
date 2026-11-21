-- Idempotent: remove only the sandbox job if still registered, then prove it is gone. Other cron jobs are untouched.
\set ON_ERROR_STOP on
select cron.unschedule(jobid) from cron.job where jobname = 'forge-sandbox-get-2099020991';
do $$ begin
  if exists (select from cron.job where jobname like 'forge-sandbox%') then raise exception 'sandbox_job_still_registered'; end if;
end $$;
select count(*) as registered_sandbox_jobs from cron.job where jobname like 'forge-sandbox%';
