-- Operator artifact. Cancels the one-time official dispatch registered by official-dispatch/SCHEDULE-ONCE.sql.
-- Run it together with pilot-control/DISARM-ROLLBACK.sql: DISARM retires the native permit but never touches cron.job.
-- Addresses the job only by the job ID recorded in the private dispatch row AND its exact name and schedule.
-- Never names any other job ID. Preserves the dispatch row unchanged. Safe to rerun: a second run finds nothing to cancel.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';

do $cancel$
declare
  dispatch record;
  matched integer;
begin
  if pg_catalog.to_regclass('fhfh_internal.blsh_official_dispatch_20261120') is null then
    -- Never registered. A same-named job without its correlation row is unexplained: stop for a human.
    if exists (select 1 from cron.job where jobname = 'blsh-official-once-20261120') then
      raise exception 'official_cancel_unrecorded_job';
    end if;
    raise notice 'official_cancel_nothing_registered';
    return;
  end if;

  execute 'select job_id, disposition, request_id from fhfh_internal.blsh_official_dispatch_20261120 where singleton for update'
    into strict dispatch;

  select count(*) into matched from cron.job
   where jobid = dispatch.job_id and jobname = 'blsh-official-once-20261120' and schedule = '45 12 21 11 *';
  if matched = 1 then
    if not cron.unschedule(dispatch.job_id) then
      raise exception 'official_cancel_unschedule_failed';
    end if;
    raise notice 'official_cancel_unscheduled job_id=% disposition=%', dispatch.job_id, dispatch.disposition;
  else
    raise notice 'official_cancel_no_registration job_id=% disposition=% request_id=%',
      dispatch.job_id, dispatch.disposition, dispatch.request_id;
  end if;

  -- Readback inside the same transaction: no job by that name or that recorded ID remains.
  if exists (select 1 from cron.job where jobname = 'blsh-official-once-20261120' or jobid = dispatch.job_id) then
    raise exception 'official_cancel_residual_job';
  end if;
end $cancel$;
commit;
