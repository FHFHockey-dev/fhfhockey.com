-- REVIEW ONLY: separately gated because PUBLIC means all PostgreSQL roles.
-- Confirm every non-service consumer before considering hosted execution.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
REVOKE EXECUTE ON FUNCTION public.acquire_lock(text, interval)
  FROM PUBLIC, anon, authenticated;
COMMIT;
