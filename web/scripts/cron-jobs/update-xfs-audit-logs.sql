-- Daily xFS Audit Log Update Cron Job
-- This job runs daily at 7:00 AM UTC (after the prediction generation job)
-- It updates audit log entries with actual performance data to track prediction accuracy

SELECT cron.schedule(
    'update-xfs-audit-logs', -- Job Name
    '00 07 * * *',          -- Daily at 7:00 AM UTC (1 hour after prediction generation)
    $$
        SELECT net.http_post(
            url := 'https://fhfhockey.com/api/v1/db/update-xfs-audit-logs',
            headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
            body := '{}'::jsonb,
            timeout_milliseconds := 300000 -- 5 minutes timeout for audit updates
        );
    $$
);

-- To view the job status and logs:
-- SELECT * FROM cron.job WHERE jobname = 'update-xfs-audit-logs';

-- To view recent job runs:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'update-xfs-audit-logs') ORDER BY start_time DESC LIMIT 10;

-- To unschedule the job if needed:
-- SELECT cron.unschedule('update-xfs-audit-logs');