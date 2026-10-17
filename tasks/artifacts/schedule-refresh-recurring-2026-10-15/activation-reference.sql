-- REVIEW ONLY. No scheduler registration is authorized by this artifact.
-- Run only after approved candidate release, live duplicate-job reconciliation,
-- target/secret-reference/monitoring approval and FORGE write-owner handback.
-- Requires separately reviewed/applied database-prerequisite.sql semantics and
-- isolated PostgreSQL concurrency/trigger tests. This file does not install DDL.
-- Existing repository convention: pg_cron -> pg_net POST -> production web app.
SELECT cron.schedule(
  'refresh-roster-optimizer-schedule',
  '50 9,21 * * *',
  $$
    SELECT net.http_post(
      url := 'https://fhfhockey.com/api/v1/db/refresh-roster-optimizer-schedule?profile=current-next-v1&dryRun=false',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret'
        ),
        'Content-Type', 'application/json'
      ),
      timeout_milliseconds := 120000
    );
  $$
);
