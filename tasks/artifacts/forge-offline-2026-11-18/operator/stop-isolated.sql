\set ON_ERROR_STOP on
begin;
select pg_advisory_xact_lock(hashtext('forge_pregame_hosted_dispatch'),1);
select cron.alter_job(jobid,active:=false) from cron.job where jobname in
  ('forge-isolated-dispatch-2099020991','forge-isolated-watch-2099020991') and username=current_user and active;
select forge_pregame_capture.hosted_end_v2(2099020991,'unresolved','operator_stop')
  where exists(select from forge_pregame_capture.hosted_runs where game_id=2099020991 and armed_at is not null and terminal_at is null);
commit;
select forge_pregame_capture.hosted_receipt_v2(2099020991);
