-- Approve, arm and schedule ONE live FORGE pregame run. Run as postgres after the release is READY at :release.
-- psql variables:
--   game        NHL game id (e.g. 2026020358)
--   player      NHL player id of a center on that game (the RSO readers' one-player roster)
--   release     full commit SHA of the deployed production build
--   approver    who approved this run (text)
--   capture_at  cron minute for capture, UTC, >= 70 min before puck drop (e.g. '45 1 20 11 *')
--   publish_at  cron minute for publication, after the T-60 verdict deadline and >= 3 min before puck drop
--   close_at    cron minute just after puck drop (closes anything left as unresolved)
-- Job 408 and every other job are left untouched. One transaction: nothing is armed unless every check passes.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
do $$ begin
  if coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC') then raise exception 'cron_timezone_not_utc'; end if;
  if exists (select from cron.job where jobid = 408 and active) then raise exception 'job_408_must_stay_off'; end if;
  if (select count(*) from vault.decrypted_secrets where name = 'cron_secret') <> 1 then raise exception 'cron_secret_missing'; end if;
  if exists (select from forge_pregame_capture.live_runs where terminal_at is null) then raise exception 'another_live_run_open'; end if;
end $$;
insert into forge_pregame_capture.live_runs (game_id, expected_code_version, slate_date, scheduled_start, player_nhl_id, approved_by)
  select g.id, :'release', g.date, g."startTime", :'player'::bigint, :'approver' from public.games g where g.id = :'game'::bigint;
do $$ begin
  if (select count(*) from forge_pregame_capture.live_runs where terminal_at is null) <> 1 then raise exception 'game_not_found'; end if;
end $$;
select forge_pregame_capture.live_arm_v1(:'game'::bigint);
select cron.schedule(format('forge-live-capture-%s', :'game'), :'capture_at',
  format('select forge_pregame_capture.live_fire_v1(%s, %L)', :'game', 'capture'));
select cron.schedule(format('forge-live-publish-%s', :'game'), :'publish_at',
  format('select forge_pregame_capture.live_fire_v1(%s, %L)', :'game', 'publish'));
select cron.schedule(format('forge-live-close-%s', :'game'), :'close_at',
  format('select forge_pregame_capture.live_close_v1(%s)', :'game'));
do $$ begin
  if exists (select from cron.job where jobid = 408 and active) then raise exception 'job_408_must_stay_off'; end if;
end $$;
commit;
select jobid, jobname, schedule, active, command from cron.job where jobname like 'forge-live-%' order by jobname;
select forge_pregame_capture.live_receipt_v1(:'game'::bigint);
