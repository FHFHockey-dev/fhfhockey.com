-- PROPOSAL ONLY (managed-signer lane). Stop switch, database side. Cancels the four signer steps registered by
-- AUTOMATE-ONCE.sql, by recorded job ID AND exact name AND schedule; preserves their rows. Then run the reviewed
-- CANCEL-OFFICIAL-ONCE.sql for the 12:45 dispatch, and DISARM-ROLLBACK.sql / SWITCH-OFF.sql as today. Safe to rerun.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';

do $cancel$
declare s record; n integer := 0;
begin
  if pg_catalog.to_regclass('fhfh_internal.blsh_signer_steps_20261122') is null then
    if exists (select 1 from cron.job where jobname like 'blsh-signer-%-20261122') then
      raise exception 'signer_cancel_unrecorded_job';
    end if;
    raise notice 'signer_cancel_nothing_registered';
    return;
  end if;
  for s in execute 'select step, job_id from fhfh_internal.blsh_signer_steps_20261122 order by step for update' loop
    if exists (select 1 from cron.job where jobid = s.job_id and jobname = 'blsh-signer-' || replace(s.step, '_', '-') || '-20261122'
                 and schedule = case s.step when 'rc_sign' then '35 12 23 11 *' when 'rc_post' then '36 12 23 11 *'
                                when 'official_sign' then '41 12 23 11 *' else '42 12 23 11 *' end) then
      if not cron.unschedule(s.job_id) then raise exception 'signer_cancel_unschedule_failed'; end if;
      n := n + 1;
    end if;
  end loop;
  raise notice 'signer_cancel_unscheduled %', n;
  if exists (select 1 from cron.job where jobname like 'blsh-signer-%-20261122') then
    raise exception 'signer_cancel_residual_job';
  end if;
end $cancel$;
commit;
