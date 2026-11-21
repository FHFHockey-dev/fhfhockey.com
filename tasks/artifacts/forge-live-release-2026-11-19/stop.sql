-- Stop one live run immediately: no further capture or publication can start, and its cron jobs are removed.
-- psql variables: game, reason. Safe to repeat. A publication already committed is not undone (see rollback.sql).
\set ON_ERROR_STOP on
select forge_pregame_capture.live_stop_v1(:'game'::bigint, :'reason');
select count(*) as remaining_live_jobs from cron.job where jobname like format('forge-live-%%-%s', :'game');
