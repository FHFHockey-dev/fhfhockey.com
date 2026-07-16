create table if not exists public.xg_execution_leases (
  lease_key text primary key,
  owner_token uuid null,
  state text not null default 'idle',
  acquired_at timestamptz null,
  heartbeat_at timestamptz null,
  lease_expires_at timestamptz null,
  completed_at timestamptz null,
  last_success_at timestamptz null,
  last_failure_at timestamptz null,
  last_error text null,
  attempt_count bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint xg_execution_leases_key_nonempty check (length(btrim(lease_key)) > 0),
  constraint xg_execution_leases_state_check check (state in ('idle', 'running', 'succeeded', 'failed')),
  constraint xg_execution_leases_running_owner_check check (
    (state = 'running' and owner_token is not null and lease_expires_at is not null)
    or (state <> 'running' and owner_token is null and lease_expires_at is null)
  )
);

create index if not exists xg_execution_leases_running_expiry_idx
  on public.xg_execution_leases (lease_expires_at)
  where state = 'running';

alter table public.xg_execution_leases enable row level security;
revoke all on table public.xg_execution_leases from public, anon, authenticated;
grant select, insert, update on table public.xg_execution_leases to service_role;

create or replace function public.acquire_xg_execution_lease(
  p_lease_key text,
  p_owner_token uuid,
  p_ttl_seconds integer,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  acquired boolean,
  lease_key text,
  state text,
  lease_expires_at timestamptz,
  current_owner_token uuid
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  claimed public.xg_execution_leases%rowtype;
begin
  if length(btrim(p_lease_key)) = 0 then
    raise exception 'lease key must be non-empty';
  end if;
  if p_ttl_seconds < 30 or p_ttl_seconds > 86400 then
    raise exception 'lease ttl must be between 30 and 86400 seconds';
  end if;

  insert into public.xg_execution_leases as leases (
    lease_key,
    owner_token,
    state,
    acquired_at,
    heartbeat_at,
    lease_expires_at,
    completed_at,
    last_error,
    attempt_count,
    metadata,
    updated_at
  ) values (
    p_lease_key,
    p_owner_token,
    'running',
    now(),
    now(),
    now() + make_interval(secs => p_ttl_seconds),
    null,
    null,
    1,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict on constraint xg_execution_leases_pkey do update
  set owner_token = excluded.owner_token,
      state = 'running',
      acquired_at = now(),
      heartbeat_at = now(),
      lease_expires_at = excluded.lease_expires_at,
      completed_at = null,
      last_error = null,
      attempt_count = leases.attempt_count + 1,
      metadata = excluded.metadata,
      updated_at = now()
  where leases.state <> 'running'
     or leases.lease_expires_at <= now()
  returning leases.* into claimed;

  if claimed.lease_key is not null then
    return query select true, claimed.lease_key, claimed.state, claimed.lease_expires_at, claimed.owner_token;
    return;
  end if;

  return query
  select false, leases.lease_key, leases.state, leases.lease_expires_at, leases.owner_token
  from public.xg_execution_leases as leases
  where leases.lease_key = p_lease_key;
end;
$$;

create or replace function public.heartbeat_xg_execution_lease(
  p_lease_key text,
  p_owner_token uuid,
  p_ttl_seconds integer
)
returns boolean
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.xg_execution_leases
  set heartbeat_at = now(),
      lease_expires_at = now() + make_interval(secs => p_ttl_seconds),
      updated_at = now()
  where lease_key = p_lease_key
    and owner_token = p_owner_token
    and state = 'running'
    and lease_expires_at > now()
  returning true;
$$;

create or replace function public.finish_xg_execution_lease(
  p_lease_key text,
  p_owner_token uuid,
  p_succeeded boolean,
  p_error text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.xg_execution_leases
  set owner_token = null,
      state = case when p_succeeded then 'succeeded' else 'failed' end,
      lease_expires_at = null,
      completed_at = now(),
      last_success_at = case when p_succeeded then now() else last_success_at end,
      last_failure_at = case when p_succeeded then last_failure_at else now() end,
      last_error = case when p_succeeded then null else left(coalesce(p_error, 'unknown failure'), 2000) end,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
  where lease_key = p_lease_key
    and owner_token = p_owner_token
    and state = 'running'
  returning true;
$$;

revoke all on function public.acquire_xg_execution_lease(text, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.heartbeat_xg_execution_lease(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.finish_xg_execution_lease(text, uuid, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.acquire_xg_execution_lease(text, uuid, integer, jsonb) to service_role;
grant execute on function public.heartbeat_xg_execution_lease(text, uuid, integer) to service_role;
grant execute on function public.finish_xg_execution_lease(text, uuid, boolean, text, jsonb) to service_role;

comment on table public.xg_execution_leases is
  'Cross-instance xG job leases with owner-safe stale recovery and durable success/failure telemetry.';
