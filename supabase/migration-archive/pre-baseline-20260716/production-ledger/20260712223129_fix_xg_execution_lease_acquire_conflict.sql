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

revoke all on function public.acquire_xg_execution_lease(text, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.acquire_xg_execution_lease(text, uuid, integer, jsonb) to service_role;
;
