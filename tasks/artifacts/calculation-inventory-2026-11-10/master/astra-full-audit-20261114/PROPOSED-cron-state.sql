-- PROPOSAL ONLY. Not approved or executed. Project fyhftlxokyjtpndbkfse.
-- Run Q1 alone and inspect it, then one block at a time. Concurrency 1, no retries.
-- Stop if active_others >5, max_active_seconds >10, visibility_unknown >0,
-- any error, missing expected object or row-limit sentinel. Roll back an aborted
-- transaction then stop. No app data, query text, RPC execution or writes.
-- Q1 one row; Q2 four jobs/limit5 sentinel; Q3 at most8 metadata rows.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SELECT
  count(*) FILTER (WHERE state = 'active') AS active_others,
  coalesce(max(greatest(0::numeric, extract(epoch FROM (statement_timestamp() - query_start))))
    FILTER (WHERE state = 'active'), 0) AS max_active_seconds,
  count(*) FILTER (WHERE (state IS NULL AND (backend_type IN ('client backend','parallel worker') OR backend_type IS NULL))
    OR (state = 'active' AND query_start IS NULL)) AS visibility_unknown
FROM pg_catalog.pg_stat_activity
WHERE pid <> pg_catalog.pg_backend_pid();
COMMIT;
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SELECT jobid,schedule,active FROM cron.job WHERE jobid IN (283,305,364,388) ORDER BY jobid LIMIT 5;
COMMIT;
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SELECT j.jobid,d.runid,d.status,d.start_time,d.end_time FROM (VALUES (283::bigint),(305::bigint),(364::bigint),(388::bigint)) j(jobid) LEFT JOIN LATERAL (SELECT runid,status,start_time,end_time FROM cron.job_run_details WHERE jobid=j.jobid ORDER BY runid DESC LIMIT 2) d ON true ORDER BY j.jobid,d.runid;
COMMIT;
