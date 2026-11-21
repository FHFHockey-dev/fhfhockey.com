-- The explicit NST cursor lookup has no age cutoff. A miss on the time-first
-- index can scan all jobs and detoast every NST audit to compare its scope.
-- Literal JSON keys and job name let the RPC use this partial index even with
-- a generic plan. The digest keeps keys small, and exact equality checks hits.
--
-- For an approved live rollout, build the same index CONCURRENTLY as a
-- standalone statement and verify its definition and validity. Then apply this
-- migration before releasing the caller. The statement below supports local
-- transactional migrations and skips the prebuilt index if it exists.
create index if not exists cron_job_audit_nst_explicit_scope_idx
  on public.cron_job_audit (pg_catalog.md5(details -> 'nstProgress' ->> 'scope'), run_time desc)
  where job_name = 'update-nst-gamelog';

create function public.read_nst_gamelog_explicit_audit(p_scope text)
returns table (run_time timestamptz, details jsonb)
language sql stable security invoker
set search_path = ''
rows 2
as $$
  select audit.run_time, audit.details
  from public.cron_job_audit as audit
  where audit.job_name = 'update-nst-gamelog'
    and pg_catalog.md5(audit.details -> 'nstProgress' ->> 'scope') = pg_catalog.md5(p_scope)
    and audit.details -> 'nstProgress' ->> 'scope' = p_scope
  order by audit.run_time desc
  limit 2;
$$;

revoke all on function public.read_nst_gamelog_explicit_audit(text) from public, anon, authenticated;
grant execute on function public.read_nst_gamelog_explicit_audit(text) to service_role;
notify pgrst, 'reload schema';
