-- DRAFT, NOT A FILED MIGRATION. Route runner tables (2026-10-22, claude route-runner session).
-- File under supabase/migrations (renamed to its ledger version) and apply only with TJ's approval.
-- Nothing in this file has been applied anywhere.
--
-- Readers and writers (web/): lib/routeRunner/store.ts through
--   pages/api/v1/db/route-runner-tick.ts            (claim, lease, step bookkeeping, events)
--   pages/api/v1/db/route-runner/jobs.ts            (list latest 50, create)
--   pages/api/v1/db/route-runner/jobs/[id].ts       (job + events after an id, cancel, run now)
-- All three routes are adminOnly (admin bearer or the exact cron bearer) and use the service-role
-- client. No browser access: RLS on, no policies, explicit grants to service_role only
-- (D4 pattern, 20261020224600_data_api_reviewed_object_grants.sql; table shape follows
-- 20261021230025_forge_served_forecast_ledger.sql).
--
-- Contracts: nst_resume (update-nst-gamelog 207 continuation_required / 503 source_down),
-- rolling_resume_from (update-rolling-player-averages nextResumeFrom -> resumeFrom),
-- next_start_date (update-nst-team-daily complete=false / update-nst-goalies stoppedEarly=true,
-- nextStartDate -> startDate), once (any other allowlisted route). The allowlist lives in
-- web/lib/routeRunner/registry.ts; this check constraint only bounds the stored value.
--
-- Rollback (before any job matters): drop table public.route_runner_events; drop table public.route_runner_jobs;
-- (unschedule the pg_cron job in the second block first if it was applied).

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.route_runner_jobs (
  id uuid primary key default gen_random_uuid(),
  route_path text not null check (route_path like '/api/%'),
  initial_query jsonb not null default '{}'::jsonb check (jsonb_typeof(initial_query) = 'object'),
  next_query jsonb not null default '{}'::jsonb check (jsonb_typeof(next_query) = 'object'),
  contract text check (contract in ('nst_resume', 'rolling_resume_from', 'next_start_date', 'once')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'waiting', 'completed', 'failed', 'cancelled')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Earliest time the next step may start (source_down waits); null means now.
  not_before timestamptz,
  -- Held by the tick that is running a step. A `running` job whose lease has
  -- expired was killed mid-step; the next tick counts it in `kills`.
  lease_until timestamptz,
  -- now() is the transaction time, so this equals created_at + 72 hours.
  expires_at timestamptz not null default (now() + interval '72 hours'),
  steps integer not null default 0,
  kills integer not null default 0,
  rows_total bigint not null default 0,
  -- Latest progress for the page: { unit, done, total, stalls, ... }.
  progress jsonb,
  last_status_code integer,
  last_operation_status text,
  last_error text,
  finished_at timestamptz
);

comment on table public.route_runner_jobs is
  'Route runner queue: one row per pasted allowlisted route run; the pg_cron-driven tick runs one step at a time under a lease. Service role only.';

-- Runnable lookup (oldest first) and the pg_cron gate.
create index if not exists route_runner_jobs_active_created_idx
  on public.route_runner_jobs (created_at)
  where status in ('queued', 'running', 'waiting');
-- "Is any lease held?" (global concurrency 1).
create index if not exists route_runner_jobs_lease_idx
  on public.route_runner_jobs (lease_until)
  where lease_until is not null;
-- Admin list: latest 50.
create index if not exists route_runner_jobs_created_desc_idx
  on public.route_runner_jobs (created_at desc);

drop trigger if exists set_updated_at on public.route_runner_jobs;
create trigger set_updated_at before update on public.route_runner_jobs
  for each row execute function public.update_updated_at_column();

create table if not exists public.route_runner_events (
  id bigserial primary key,
  job_id uuid not null references public.route_runner_jobs (id) on delete cascade,
  at timestamptz not null default now(),
  level text not null default 'info' check (level in ('info', 'success', 'warn', 'error')),
  message text not null,
  step integer,
  status_code integer,
  rows integer,
  progress jsonb,
  duration_ms integer
);

comment on table public.route_runner_events is
  'Route runner terminal lines: one row per claim, step result, wait, kill or cancel. Service role only.';

create index if not exists route_runner_events_job_id_id_idx
  on public.route_runner_events (job_id, id);

alter table public.route_runner_jobs enable row level security;
alter table public.route_runner_events enable row level security;

revoke all on table public.route_runner_jobs, public.route_runner_events
from public, anon, authenticated, service_role;
grant select, insert, update on table public.route_runner_jobs, public.route_runner_events to service_role;
revoke all on sequence public.route_runner_events_id_seq from public, anon, authenticated, service_role;
grant usage on sequence public.route_runner_events_id_seq to service_role;


-- ---------------------------------------------------------------------------------------------
-- pg_cron trigger. APPLY WITH TJ'S APPROVAL, separately from the tables above, and only after
-- the release that ships web/pages/api/v1/db/route-runner-tick.ts is live.
--
-- Every minute, call the worker only when a job is runnable AND no job holds an unexpired lease
-- (a step is in flight). Idle or busy minutes make zero Vercel calls. The worker itself also
-- enforces concurrency 1 and claims at most one job per call. Bearer from Vault `cron_secret`,
-- the same lookup as the existing Vault-backed jobs (e.g. update-player-trend-metrics, job 392).
-- The tick answers inside the 240 s maxDuration; 300 s is the existing http timeout convention.
--
-- select cron.schedule(
--   'route-runner-tick',
--   '* * * * *',
--   $$
--     select net.http_get(
--       url := 'https://fhfhockey.com/api/v1/db/route-runner-tick',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || (
--           select decrypted_secret from vault.decrypted_secrets
--           where name = 'cron_secret'
--         )
--       ),
--       timeout_milliseconds := 300000
--     )
--     where exists (
--       select 1 from public.route_runner_jobs
--       where status in ('queued', 'running', 'waiting')
--         and coalesce(not_before, now()) <= now()
--         and coalesce(lease_until, now() - interval '1 second') < now()
--         and expires_at > now()
--     )
--     and not exists (
--       select 1 from public.route_runner_jobs
--       where lease_until > now()
--     );
--   $$
-- );
--
-- Rollback: select cron.unschedule('route-runner-tick');
-- Queued jobs simply stop advancing; they keep their next_query and resume if the job is
-- rescheduled before their expires_at.
--
-- Optional retention (not scheduled): delete finished jobs older than 30 days; events cascade.
-- delete from public.route_runner_jobs
-- where status in ('completed', 'failed', 'cancelled') and finished_at < now() - interval '30 days';
