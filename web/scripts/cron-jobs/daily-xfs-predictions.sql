-- Daily xFS Prediction Generation Cron Job
-- This job runs daily at 6:00 AM UTC to generate xFS predictions for all active players
-- It calls the API endpoint that processes players in batches and creates both 5-game and 10-game predictions

SELECT cron.schedule(
    'generate-daily-xfs-predictions', -- Job Name
    '00 06 * * *',                   -- Daily at 6:00 AM UTC
    $$
        SELECT net.http_post(
            url := 'https://fhfhockey.com/api/v1/db/generate-xfs-predictions',
            headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
            body := '{}'::jsonb,
            timeout_milliseconds := 600000 -- 10 minutes timeout for processing all players
        );
    $$
);

-- To view the job status and logs:
-- SELECT * FROM cron.job WHERE jobname = 'generate-daily-xfs-predictions';

-- To view recent job runs:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-daily-xfs-predictions') ORDER BY start_time DESC LIMIT 10;

-- To unschedule the job if needed:
-- SELECT cron.unschedule('generate-daily-xfs-predictions');