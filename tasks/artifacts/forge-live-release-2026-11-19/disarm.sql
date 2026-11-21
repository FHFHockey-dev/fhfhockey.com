-- Remove every forge-live job (all games) and prove none remain. Job 408 and other jobs are untouched. Idempotent.
\set ON_ERROR_STOP on
select cron.unschedule(jobid) from cron.job where jobname like 'forge-live-%';
do $$ begin
  if exists (select from cron.job where jobname like 'forge-live-%') then raise exception 'live_jobs_remain'; end if;
  if exists (select from cron.job where jobid = 408 and active) then raise exception 'job_408_active'; end if;
end $$;
select count(*) as forge_live_jobs from cron.job where jobname like 'forge-live-%';
