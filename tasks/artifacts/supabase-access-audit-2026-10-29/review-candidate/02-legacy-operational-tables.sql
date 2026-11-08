-- REVIEW ONLY: exact object-level proposal; NOT authorized for hosted execution.
-- Precondition: fresh ACL/policy snapshot matches the accompanying review.
-- Confirm no supported anon/authenticated consumers before scheduling.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.cron_job_audit FROM anon, authenticated;
DROP POLICY "Enable read access for all users" ON public.cron_job_audit;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.job_locks FROM anon, authenticated;
DROP POLICY "Enable read access for all users" ON public.job_locks;

COMMIT;
