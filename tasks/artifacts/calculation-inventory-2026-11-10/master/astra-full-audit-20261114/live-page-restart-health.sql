-- PREPARED ONLY. Requires direct TJ approval; separate from exhausted catalog batches.
-- Target: fhfhockey.com, Supabase fyhftlxokyjtpndbkfse.
-- Restart batch: at most four executions, before remaining observations 1, 16, 31 and 46.
-- One row each; concurrency one; no retries, app rows, query text or writes.
-- Stop if active_others > 5, max_active_seconds > 10, visibility_unknown > 0,
-- or any query error/timeout. Do not start further page loads on a failed check.
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
