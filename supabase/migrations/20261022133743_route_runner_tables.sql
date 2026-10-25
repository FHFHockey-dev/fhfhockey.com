-- Migration authority order 98: route_runner_tables (long-run route runner queue).
-- Release R21. Applied 2026-10-22 as ledger version 20261022133743, before the R21 deploy, by explicit TJ approval.
-- Source: tasks/artifacts/route-runner/route_runner_tables.sql (tables block, SQL unchanged; its
-- commented pg_cron block is scheduled separately after the deploy and recorded in
-- tasks/TASKS/cron-operations/cron-schedule.md).
-- Readers and writers (web/): lib/routeRunner/store.ts through
--   pages/api/v1/db/route-runner-tick.ts            (claim, lease, step bookkeeping, events)
--   pages/api/v1/db/route-runner/jobs.ts            (list latest 50, create)
--   pages/api/v1/db/route-runner/jobs/[id].ts       (job + events after an id, cancel, run now)
-- All three routes are adminOnly (admin bearer or the exact cron bearer) and use the service-role
-- client. No browser access: RLS on, no policies, explicit grants to service_role only
-- (D4 pattern, 20261020224600_data_api_reviewed_object_grants.sql).
-- Rollback (unschedule the route-runner-tick pg_cron job first):
--   drop table public.route_runner_events; drop table public.route_runner_jobs;

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
