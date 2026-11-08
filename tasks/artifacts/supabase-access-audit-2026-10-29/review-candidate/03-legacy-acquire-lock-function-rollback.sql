-- REVIEW ONLY. Restores the 2026-10-29 PUBLIC and direct browser-role grants.
-- This re-exposes the function; a rollback requires separate authorization.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
GRANT EXECUTE ON FUNCTION public.acquire_lock(text, interval)
  TO PUBLIC, anon, authenticated;
COMMIT;
