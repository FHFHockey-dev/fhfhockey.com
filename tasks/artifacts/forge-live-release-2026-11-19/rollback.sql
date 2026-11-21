-- Roll back the live-run migration (20261119230000). Refuses while a live run is open or after any live publication,
-- because those rows are evidence: stop and reconcile first. The publication migration (20261118135813) is a separate
-- decision; its tables are immutable evidence once used.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
do $$ begin
  if exists (select from forge_pregame_capture.live_runs where terminal_at is null) then raise exception 'live_run_open'; end if;
  if exists (select from forge_pregame_capture.live_runs where revision_id is not null) then raise exception 'live_publication_exists'; end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname like 'forge-live-%';
drop trigger if exists require_live_verdict on forge_pregame_capture.publications;
drop function if exists public.forge_live_capture_begin_v1(text), public.forge_live_capture_finish_v1(bigint, text, uuid, text),
  public.forge_live_publish_begin_v1(text), public.forge_live_publish_finish_v1(bigint, text, uuid, jsonb, text),
  forge_pregame_capture.require_live_verdict_v1(), forge_pregame_capture.live_fire_v1(bigint, text),
  forge_pregame_capture.live_close_v1(bigint), forge_pregame_capture.live_stop_v1(bigint, text), forge_pregame_capture.live_arm_v1(bigint),
  forge_pregame_capture.live_end_v1(bigint, text, text), forge_pregame_capture.live_receipt_v1(bigint);
drop table if exists forge_pregame_capture.live_requests, forge_pregame_capture.live_runs;
commit;
