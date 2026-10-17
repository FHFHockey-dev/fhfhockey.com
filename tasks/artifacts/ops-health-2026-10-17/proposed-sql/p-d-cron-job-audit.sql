-- P-D: cron_job_audit read path and exposure. PROPOSED ONLY; not executed.
-- Must land through the repository migration authority (supabase/migrations/
-- and migration-authority.json are owned elsewhere). Run outside 07:00-13:00 UTC.

-- Pre-check (read-only): definition, policies, grants.
select polname, polcmd, pg_get_expr(polqual, polrelid) as using_expr,
       array(select rolname from pg_roles r where r.oid = any(polroles)) as roles
from pg_policy where polrelid = 'public.cron_job_audit'::regclass;
select has_table_privilege('anon', 'public.cron_job_audit', 'SELECT') as anon_select,
       has_table_privilege('authenticated', 'public.cron_job_audit', 'SELECT') as auth_select;

-- Change 1: range index for the report's `run_time >= since` reads.
-- CONCURRENTLY cannot run inside a transaction block; run it alone.
create index concurrently if not exists cron_job_audit_run_time_idx
  on public.cron_job_audit (run_time);
-- readback:
select indisvalid from pg_index
where indexrelid = 'public.cron_job_audit_run_time_idx'::regclass;
-- rollback:
-- drop index concurrently if exists public.cron_job_audit_run_time_idx;

-- Change 2: stop anon/authenticated reads (all repository readers use the
-- service role). Confirm first that PostgREST logs show no anon/authenticated
-- GET /rest/v1/cron_job_audit in the last 7 days.
begin;
drop policy if exists "Enable read access for all users" on public.cron_job_audit;
revoke select on public.cron_job_audit from anon, authenticated;
commit;
-- readback: both has_table_privilege checks above return false.
-- rollback:
-- begin;
-- grant select on public.cron_job_audit to anon, authenticated;
-- create policy "Enable read access for all users" on public.cron_job_audit
--   as permissive for select to public using (true);
-- commit;
