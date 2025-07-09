-- Manual Training/Validation Job for xFS Model
-- This job can be run manually to train and validate the xFS model using current season data
-- It splits the season in half: trains on first half, validates predictions against second half

SELECT cron.schedule(
    'train-validate-xfs-model', -- Job Name  
    '0 0 1 * *',               -- Monthly on the 1st at midnight (run less frequently)
    $$
        SELECT net.http_post(
            url := 'https://fhfhockey.com/api/v1/db/train-validate-xfs-model',
            headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
            body := '{}'::jsonb,
            timeout_milliseconds := 900000 -- 15 minutes timeout for training/validation
        );
    $$
);

-- To run manually:
-- SELECT net.http_post(
--     url := 'https://fhfhockey.com/api/v1/db/train-validate-xfs-model',
--     headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb,
--     timeout_milliseconds := 900000
-- );

-- To view the job status and logs:
-- SELECT * FROM cron.job WHERE jobname = 'train-validate-xfs-model';

-- To view recent job runs:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'train-validate-xfs-model') ORDER BY start_time DESC LIMIT 10;

-- To unschedule the job if needed:
-- SELECT cron.unschedule('train-validate-xfs-model');