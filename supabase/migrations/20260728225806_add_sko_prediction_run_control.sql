create table public.sko_prediction_run_manifests (
  run_key text primary key,
  owner_token uuid,
  state text not null default 'idle',
  acquired_at timestamptz,
  heartbeat_at timestamptz,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  attempt_count bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint sko_prediction_run_manifests_key_nonempty
    check (length(btrim(run_key)) > 0),
  constraint sko_prediction_run_manifests_state_check
    check (state in ('idle', 'running', 'succeeded', 'failed')),
  constraint sko_prediction_run_manifests_running_owner_check
    check (
      (
        state = 'running'
        and owner_token is not null
        and lease_expires_at is not null
      )
      or (
        state <> 'running'
        and owner_token is null
        and lease_expires_at is null
      )
    )
);

comment on table public.sko_prediction_run_manifests is
  'Service-only SKO compatibility-writer leases and durable latest-run manifests.';

create index sko_prediction_run_manifests_updated_at_idx
  on public.sko_prediction_run_manifests (updated_at desc);

alter table public.sko_prediction_run_manifests enable row level security;

create function public.acquire_sko_prediction_run(
  p_run_key text,
  p_owner_token uuid,
  p_ttl_seconds integer,
  p_metadata jsonb default '{}'::jsonb
) returns table (
  acquired boolean,
  run_key text,
  state text,
  lease_expires_at timestamptz,
  attempt_count bigint
)
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  claimed public.sko_prediction_run_manifests%rowtype;
begin
  if length(btrim(p_run_key)) = 0 then
    raise exception 'run key must be non-empty';
  end if;
  if p_ttl_seconds < 30 or p_ttl_seconds > 86400 then
    raise exception 'lease ttl must be between 30 and 86400 seconds';
  end if;

  insert into public.sko_prediction_run_manifests as manifests (
    run_key,
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
    p_run_key,
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
  on conflict on constraint sko_prediction_run_manifests_pkey do update
  set owner_token = excluded.owner_token,
      state = 'running',
      acquired_at = now(),
      heartbeat_at = now(),
      lease_expires_at = excluded.lease_expires_at,
      completed_at = null,
      last_error = null,
      attempt_count = manifests.attempt_count + 1,
      metadata = excluded.metadata,
      updated_at = now()
  where manifests.state <> 'running'
     or manifests.lease_expires_at <= now()
  returning manifests.* into claimed;

  if claimed.run_key is not null then
    return query
    select true, claimed.run_key, claimed.state, claimed.lease_expires_at,
      claimed.attempt_count;
    return;
  end if;

  return query
  select false, manifests.run_key, manifests.state,
    manifests.lease_expires_at, manifests.attempt_count
  from public.sko_prediction_run_manifests as manifests
  where manifests.run_key = p_run_key;
end;
$$;

create function public.heartbeat_sko_prediction_run(
  p_run_key text,
  p_owner_token uuid,
  p_ttl_seconds integer
) returns boolean
language sql
set search_path to 'public', 'pg_temp'
as $$
  update public.sko_prediction_run_manifests
  set heartbeat_at = now(),
      lease_expires_at = now() + make_interval(secs => p_ttl_seconds),
      updated_at = now()
  where run_key = p_run_key
    and owner_token = p_owner_token
    and state = 'running'
    and lease_expires_at > now()
  returning true;
$$;

create function public.finish_sko_prediction_run(
  p_run_key text,
  p_owner_token uuid,
  p_succeeded boolean,
  p_error text default null,
  p_metadata jsonb default '{}'::jsonb
) returns boolean
language sql
set search_path to 'public', 'pg_temp'
as $$
  update public.sko_prediction_run_manifests
  set owner_token = null,
      state = case when p_succeeded then 'succeeded' else 'failed' end,
      lease_expires_at = null,
      completed_at = now(),
      last_success_at = case when p_succeeded then now() else last_success_at end,
      last_failure_at = case when p_succeeded then last_failure_at else now() end,
      last_error = case
        when p_succeeded then null
        else left(coalesce(p_error, 'unknown failure'), 2000)
      end,
      metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
  where run_key = p_run_key
    and owner_token = p_owner_token
    and state = 'running'
  returning true;
$$;

revoke all on table public.sko_prediction_run_manifests
  from public, anon, authenticated;
grant select, insert, update on table public.sko_prediction_run_manifests
  to service_role;

revoke all on function public.acquire_sko_prediction_run(text, uuid, integer, jsonb)
  from public;
grant execute on function public.acquire_sko_prediction_run(text, uuid, integer, jsonb)
  to service_role;
revoke all on function public.heartbeat_sko_prediction_run(text, uuid, integer)
  from public;
grant execute on function public.heartbeat_sko_prediction_run(text, uuid, integer)
  to service_role;
revoke all on function public.finish_sko_prediction_run(text, uuid, boolean, text, jsonb)
  from public;
grant execute on function public.finish_sko_prediction_run(text, uuid, boolean, text, jsonb)
  to service_role;
