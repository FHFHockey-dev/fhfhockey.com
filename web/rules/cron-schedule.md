----------------------------------------------------------------------------------
-- Timeline (earliest -> latest)
--
-- - 08:00 UTC / 03:00 EST: update-yahoo-matchup-dates
-- - 08:01 UTC / 03:01 EST: update-all-wgo-skaters
-- - 08:02 UTC / 03:02 EST: update-all-wgo-goalies
-- - 08:04 UTC / 03:04 EST: update-all-wgo-skater-totals
-- - 08:06 UTC / 03:06 EST: daily-refresh-player-unified-matview
-- - 08:07 UTC / 03:07 EST: update-power-play-timeframes
-- - 08:08 UTC / 03:08 EST: update-line-combinations-all
-- - 08:09 UTC / 03:09 EST: update-team-yearly-summary
-- - 08:10 UTC / 03:10 EST: update-nst-gamelog
-- - 08:12 UTC / 03:12 EST: update-standings-details
-- - 08:14 UTC / 03:14 EST: update-all-wgo-goalie-totals
-- - 08:15 UTC / 03:15 EST: update-expected-goals
-- - 08:17 UTC / 03:17 EST: update-yahoo-players
-- - 08:30 UTC / 03:30 EST: update-nst-tables-all
-- - 08:45 UTC / 03:45 EST: update-nst-goalies
-- - 08:50 UTC / 03:50 EST: update-wigo-table-stats
-- - 08:55 UTC / 03:55 EST: sync-yahoo-players-to-sheet
-- - 09:00 UTC / 04:00 EST: update-rolling-player-averages
-- - 09:05 UTC / 04:05 EST: daily-refresh-goalie-unified-matview
-- - 09:10 UTC / 04:10 EST: update-team-ctpi-daily
-- - 09:11 UTC / 04:11 EST: update-team-sos
-- - 09:12 UTC / 04:12 EST: update-team-power-ratings
-- - 09:13 UTC / 04:13 EST: update-team-power-ratings-new
-- - 09:14 UTC / 04:14 EST: update-wgo-teams
-- - 09:15 UTC / 04:15 EST: update-nst-current-season
-- - 09:30 UTC / 04:30 EST: update-goalie-projections-v2
-- - 09:40 UTC / 04:40 EST: RETIRED IN PASS 3 (formerly update-start-chart-projections)
-- - 09:45 UTC / 04:45 EST: ingest-projection-inputs
-- - 09:50 UTC / 04:50 EST: build-forge-derived-v2
-- - 09:55 UTC / 04:55 EST: update-nst-team-daily
-- - 10:00 UTC / 05:00 EST: daily-refresh-matview
-- - 10:05 UTC / 05:05 EST: run-forge-projection-v2
-- - 10:15 UTC / 05:15 EST: refresh-team-power-ratings-daily
-- - 10:20 UTC / 05:20 EST: update-season-stats-current-season
-- - 10:25 UTC / 05:25 EST: update-rolling-games-recent
-- - 10:30 UTC / 05:30 EST: update-sko-stats-full-season
-- - 10:35 UTC / 05:35 EST: update-wgo-averages
-- - 10:40 UTC / 05:40 EST: daily-refresh-player-totals-unified-matview
-- - 10:42 UTC / 05:42 EST: rebuild-sustainability-baselines
-- - 10:43 UTC / 05:43 EST: rebuild-sustainability-priors
-- - 10:44 UTC / 05:44 EST: rebuild-sustainability-window-z-batch-000
-- - 10:45 UTC / 05:45 EST: rebuild-sustainability-window-z-batch-250
-- - 10:46 UTC / 05:46 EST: rebuild-sustainability-window-z-batch-500
-- - 10:47 UTC / 05:47 EST: rebuild-sustainability-window-z-batch-750
-- - 10:48 UTC / 05:48 EST: rebuild-sustainability-score-batch-000
-- - 10:49 UTC / 05:49 EST: rebuild-sustainability-score-batch-250
-- - 10:50 UTC / 05:50 EST: rebuild-sustainability-score-batch-500
-- - 10:51 UTC / 05:51 EST: rebuild-sustainability-score-batch-750
-- - 10:52 UTC / 05:52 EST: rebuild-sustainability-trend-bands-batch-000
-- - 10:53 UTC / 05:53 EST: rebuild-sustainability-trend-bands-batch-250
-- - 10:54 UTC / 05:54 EST: rebuild-sustainability-trend-bands-batch-500
-- - 10:55 UTC / 05:55 EST: rebuild-sustainability-trend-bands-batch-750
-- - 10:56 UTC / 05:56 EST: update-predictions-sko
-- - 11:00 UTC / 06:00 EST: update-power-rankings
-- - 11:05 UTC / 06:05 EST: update-nst-team-daily-incremental
-- - 11:20 UTC / 06:20 EST: update-nst-team-stats-all
-- - 11:30 UTC / 06:30 EST: run-projection-accuracy
-- - 20:51 UTC / 15:51 EST: update-pbp
-- - 21:15 UTC / 16:15 EST: daily-cron-report
--
-- Schedule floor
-- - No active daily cron should run before 08:00 UTC / 03:00 EST.
-- - Remaining retired pre-floor placeholders are limited to the NST/backfill and broken routes that still need dedicated reslotting:
--   update-shift-charts and update-rolling-player-averages (GET).
-- - Active timeline labels below use the actual scheduled job names; broken status is called out in the detailed block notes instead.
-- - Direct NST cron starts now keep at least 15 minutes of separation:
--   08:10 -> 08:30 -> 08:45 -> 09:15 -> 09:55 -> 11:05 -> 11:20 UTC.
--
-- Gap notes
-- - 07:15 UTC / 02:15 EST: retired pre-floor slot for update-games.
----------------------------------------------------------------------------------


----------------------------------------------------------------------------------
-- 03:00 EST Floor Cluster And Remaining Legacy Holds
----------------------------------------------------------------------------------

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-yahoo-matchup-dates',
--     '00 8 * * *', -- 08:00 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-yahoo-weeks?game_key=nhl',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 240000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:10 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:10 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||   16 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- WORKING 1/6/26
-- SELECT cron.schedule(
--     'update-nst-gamelog',
--     '10 8 * * *', -- 08:10 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-gamelog',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:01 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:01 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-skaters',
--     '01 8 * * *', -- 08:01 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-wgo-skaters?action=all',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:02 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:02 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-goalies',
--     '02 8 * * *', -- 08:02 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-wgo-goalies?action=all',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:04 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:04 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-skater-totals',
--     '04 8 * * *', -- 08:04 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-wgo-totals?season=current',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- STATUS: 404 NOT FOUND
-- SELECT cron.schedule(
--     'update-shift-charts',
--     '45 7 * * *', -- 07:45 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-shifts?action=all',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-rolling-player-averages',
--     '45 7 * * *', -- 07:45 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-rolling-player-averages',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:06 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:06 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-player-unified-matview',
--     '06 8 * * *', -- 08:06 UTC
--     'REFRESH MATERIALIZED VIEW player_stats_unified;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:07 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:07 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-power-play-timeframes',
--     '07 8 * * *', -- 08:07 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/powerPlayTimeFrame?gameId=all',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:08 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:08 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-line-combinations-all',
--     '08 8 * * *', -- 08:08 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-line-combinations',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:09 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:09 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    1 URL    |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-yearly-summary',
--     '09 8 * * *', -- 08:09 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-yearly-summary',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    4 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-tables-all',
--     '30 8 * * *', -- 08:30 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/Teams/nst-team-stats?date=all',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:12 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:12 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-standings-details',
--     '12 8 * * *', -- 08:12 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-standings-details?date=all',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:14 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:14 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-goalie-totals',
--     '14 8 * * *', -- 08:14 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-wgo-goalie-totals',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-expected-goals',
--     '15 8 * * *', -- 08:15 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-expected-goals?date=all',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||   10 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-goalies',
--     '45 8 * * *', -- 08:45 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-goalies',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:17 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:17 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-yahoo-players',
--     '17 8 * * *', -- 08:17 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-yahoo-players?gameId=465',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    4 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-current-season',
--     '15 9 * * *', -- 09:15 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-current-season',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-wigo-table-stats',
--     '50 8 * * *', -- 08:50 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/calculate-wigo-stats',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'sync-yahoo-players-to-sheet',
--     '55 8 * * *', -- 08:55 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/internal/sync-yahoo-players-to-sheet?gameId=465',
--             headers := '{"Authorization":"Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-rolling-player-averages',
--     '00 9 * * *', -- 09:00 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/update-rolling-player-averages',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-goalie-unified-matview',
--     '05 9 * * *', -- 09:05 UTC
--     'REFRESH MATERIALIZED VIEW goalie_stats_unified;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:10 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:10 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-ctpi-daily',
--     '10 9 * * *', -- 09:10 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-ctpi-daily',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:11 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:11 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-sos',
--     '11 9 * * *', -- 09:11 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-sos',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 240000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:12 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:12 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-power-ratings',
--     '12 9 * * *', -- 09:12 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-power-ratings',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:13 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:13 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- DISABLED IN PASS 3:
-- Keep this historical schedule snippet only until the legacy route stub
-- and audit artifacts are fully retired.

-- SELECT cron.schedule(
--     'update-team-power-ratings-new',
--     '13 9 * * *', -- 09:13 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-power-ratings-new',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-goalie-projections-v2',
--     '30 9 * * *', -- 09:30 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/update-goalie-projections-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:14 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:14 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-wgo-teams',
--     '14 9 * * *', -- 09:14 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/run-fetch-wgo-data',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- RETIRED IN PASS 3:
-- `update-start-chart-projections` was removed after `/api/v1/start-chart`
-- and the other surviving skater readers were moved to canonical
-- `forge_player_projections`. There is no replacement cron job because the
-- legacy `player_projections` materializer no longer has live readers.

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'ingest-projection-inputs',
--     '45 9 * * *', -- 09:45 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/ingest-projection-inputs',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- 09:50 UTC (after rolling averages + goalie starts)
-- SELECT cron.schedule(
--     'build-forge-derived-v2',
--     '50 9 * * *', -- 09:50 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/build-projection-derived-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    8 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-team-daily',
--     '55 9 * * *', -- 09:55 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-team-daily',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-matview',
--     '0 10 * * *', -- 10:00 UTC
--     'REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- 10:05 UTC (after derived tables are built)
-- SELECT cron.schedule(
--     'run-forge-projection-v2',
--     '05 10 * * *', -- 10:05 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/run-projection-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--   'refresh-team-power-ratings-daily',
--   '15 10 * * *', -- 10:15 UTC
--   $$
--     WITH s AS (
--       SELECT *
--       FROM public.seasons
--       ORDER BY id DESC
--       LIMIT 1
--     )
--     SELECT public.refresh_team_power_ratings(
--       (SELECT startDate FROM s),
--       LEAST(
--         (now() AT TIME ZONE 'America/New_York')::date,
--         (SELECT regularSeasonEndDate FROM s)
--       )
--     );
--   $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:20 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-season-stats-current-season',
--     '20 10 * * *', -- 10:20 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-season-stats',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:25 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:25 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- DISABLED IN PASS 3:
-- Keep this historical schedule snippet only until the legacy route stub
-- and audit artifacts are fully retired.

-- SELECT cron.schedule(
--     'update-rolling-games-recent',
--     '25 10 * * *', -- 10:25 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-rolling-games?date=recent',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-sko-stats-full-season',
--     '30 10 * * *', -- 10:30 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-sko-stats',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:35 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:35 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-wgo-averages',
--     '35 10 * * *', -- 10:35 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-wgo-averages',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-player-totals-unified-matview',
--     '40 10 * * *', -- 10:40 UTC
--     'REFRESH MATERIALIZED VIEW player_totals_unified;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:42 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:42 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-baselines',
--     '42 10 * * *', -- 10:42 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/sustainability/rebuild-baselines',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:43 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:43 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-priors',
--     '43 10 * * *', -- 10:43 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-priors?season=current',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:44 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:44 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-window-z-batch-000',
--     '44 10 * * *', -- 10:44 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-window-z?season=current&offset=0&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-window-z-batch-250',
--     '45 10 * * *', -- 10:45 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-window-z?season=current&offset=250&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:46 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:46 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-window-z-batch-500',
--     '46 10 * * *', -- 10:46 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-window-z?season=current&offset=500&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:47 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:47 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-window-z-batch-750',
--     '47 10 * * *', -- 10:47 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-window-z?season=current&offset=750&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:48 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:48 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-score-batch-000',
--     '48 10 * * *', -- 10:48 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-score?season=current&offset=0&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:49 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:49 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-score-batch-250',
--     '49 10 * * *', -- 10:49 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-score?season=current&offset=250&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-score-batch-500',
--     '50 10 * * *', -- 10:50 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-score?season=current&offset=500&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:51 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:51 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-score-batch-750',
--     '51 10 * * *', -- 10:51 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-score?season=current&offset=750&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:52 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:52 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-trend-bands-batch-000',
--     '52 10 * * *', -- 10:52 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-trend-bands?offset=0&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:53 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:53 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-trend-bands-batch-250',
--     '53 10 * * *', -- 10:53 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-trend-bands?offset=250&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:54 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:54 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-trend-bands-batch-500',
--     '54 10 * * *', -- 10:54 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-trend-bands?offset=500&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'rebuild-sustainability-trend-bands-batch-750',
--     '55 10 * * *', -- 10:55 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/sustainability/rebuild-trend-bands?offset=750&limit=250',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:56 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:56 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-predictions-sko',
--     '56 10 * * *', -- 10:56 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/ml/update-predictions-sko',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- DISABLED IN PASS 3:
-- Keep this historical schedule snippet only until the legacy route stub
-- and audit artifacts are fully retired.

-- SELECT cron.schedule(
--     'update-power-rankings',
--     '00 11 * * *', -- 11:00 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-power-rankings',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-team-daily-incremental',
--     '05 11 * * *', -- 11:05 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-team-daily',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:20 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-team-stats-all',
--     '20 11 * * *', -- 11:20 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/Teams/nst-team-stats',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'run-projection-accuracy',
--     '30 11 * * *', -- 11:30 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/run-projection-accuracy?projectionOffsetDays=0',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  20:51 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  15:51 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- NOT WORKING
-- SELECT cron.schedule(
--     'update-pbp',
--     '51 20 * * *', -- 20:51 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-PbP?gameId=recent',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  21:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  16:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-cron-report',
--     '15 21 * * *', -- 21:15 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/cron-report',
--             headers := '{"Authorization":"Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- NEED TO ADD
--
-- Static dashboard-critical URLs that are not currently scheduled above:
--
-- Core FORGE preflight inputs:
-- - https://fhfhockey.com/api/v1/db/update-seasons
-- - https://fhfhockey.com/api/v1/db/update-teams
-- - https://fhfhockey.com/api/v1/db/update-games
-- - https://fhfhockey.com/api/v1/db/update-players
--
-- Dashboard trend refresh:
-- - https://fhfhockey.com/api/v1/trends/player-trends
--
-- Notes:
-- - Sustainability rebuild follow-ups and player_totals_unified refresh are now
--   scheduled above using static cron-safe defaults.
