-- Applied with explicit user approval on 2026-11-12; verified 14:48:20 UTC.
-- Execution receipt: CRON-APPLIED.json. Historical SQL retained; do not rerun.
-- Target: Supabase fyhftlxokyjtpndbkfse, existing pg_cron jobs 16 and 305.
-- Observed UTC order: relationships 07:45 -> inputs 09:45 -> derived 09:50.
-- Proposed UTC order: inputs 09:45 -> relationships 09:55 -> derived 10:05.
-- Leaves commands, authentication, activation and other schedules intact.
-- Vercel's configured route limit is 240 seconds; these gaps are 10 minutes.
-- A gap is not a completion guarantee; manifest/CAS gates remain mandatory.
BEGIN;
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = 16 AND jobname = 'update-shift-charts'
      AND schedule = '45 7 * * *' AND active
      AND command LIKE '%/api/v1/db/update-shifts%'
  ) OR NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = 363 AND jobname = 'ingest-projection-inputs'
      AND schedule = '45 9 * * *' AND active
      AND command LIKE '%/api/v1/db/ingest-projection-inputs%'
  ) OR NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = 305 AND jobname = 'build-forge-derived-v2'
      AND schedule = '50 09 * * *' AND active
      AND command LIKE '%/api/v1/db/build-projection-derived-v2%'
  ) THEN
    RAISE EXCEPTION 'Shift pipeline schedule changed since triage; re-inspect before applying';
  END IF;
END;
$check$;
SELECT cron.alter_job(16, schedule := '55 9 * * *');
SELECT cron.alter_job(305, schedule := '05 10 * * *');
COMMIT;

-- All three jobs were verified and the local cron-schedule inventory updated.
-- Rollback, only if needed/authorized: job 16 -> '45 7 * * *'; job 305 -> '50 09 * * *'.
-- That restores the old inversion; it is not a data correction.
