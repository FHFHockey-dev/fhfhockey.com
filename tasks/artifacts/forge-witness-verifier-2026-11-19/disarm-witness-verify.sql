-- Idempotent: remove every witness verifier cron job still registered, then prove none is left. Other jobs are
-- untouched. Targets and verdicts are immutable receipts and stay. Run as postgres.
\set ON_ERROR_STOP on
select cron.unschedule(jobid) from cron.job where jobname like 'forge-witness-verify-%';
do $$ begin
  if exists (select from cron.job where jobname like 'forge-witness-verify-%') then raise exception 'witness_job_still_registered'; end if;
end $$;
select count(*) as registered_witness_jobs from cron.job where jobname like 'forge-witness-verify-%';
