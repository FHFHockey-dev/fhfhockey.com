-- REVIEW ONLY. Restores the exact browser-role table ACL and policies observed
-- on 2026-10-29, if they still match the recorded pre-change snapshot.
-- This re-exposes operational data; a rollback requires separate authorization.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE POLICY "Enable read access for all users"
  ON public.cron_job_audit AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.cron_job_audit TO anon, authenticated;

CREATE POLICY "Enable read access for all users"
  ON public.job_locks AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.job_locks TO anon, authenticated;

COMMIT;
