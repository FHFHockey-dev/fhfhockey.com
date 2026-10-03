begin;
set lock_timeout = '5s';
set statement_timeout = '60s';
-- The foundation revokes this schema from service_role as well. Invoker RPCs
-- need explicit namespace access; browser roles remain denied.
grant usage on schema fhfh_internal to service_role;

-- Local attempts are private append-only evidence, never remote-drainable jobs.
create unique index forge_local_attempt_run_idx
  on public.player_forecast_source_observations(entity_key)
  where provider='forge' and dataset_key='forge-local-execution-v1';
create index forge_local_attempt_game_idx
  on public.player_forecast_source_observations((payload->>'gameId'))
  where provider='forge' and dataset_key='forge-local-execution-v1';

create function fhfh_internal.lock_forge_execution_scope(p_date date,p_game_ids bigint[])
returns void language plpgsql security invoker set search_path='' as $$
declare game_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('forge:'||p_date::text,0));
  for game_id in select distinct id from (
    select unnest(p_game_ids) id where coalesce(cardinality(p_game_ids),0)>0
    union all select g.id from public.games g where g.date=p_date and coalesce(cardinality(p_game_ids),0)=0
  ) scoped order by id loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('forge-game:'||game_id::text,0));
  end loop;
end; $$;

create function fhfh_internal.active_forge_local_execution(p_game_ids bigint[],p_exclude_run uuid)
returns boolean language sql volatile security invoker set search_path='' as $$
  select exists(select 1 from public.player_forecast_source_observations o
    where o.provider='forge' and o.dataset_key='forge-local-execution-v1'
      and (o.payload->>'gameId')::bigint=any(p_game_ids)
      and (p_exclude_run is null or o.entity_key<>p_exclude_run::text)
      and (o.payload->>'leaseExpiresAt')::timestamptz>clock_timestamp()
      and not exists(select 1 from public.forge_game_revisions r
        where r.run_id=o.entity_key::uuid and r.game_id=(o.payload->>'gameId')::bigint));
$$;

-- Also fence legacy direct inserts and queue reservations, not just the new RPC.
create function fhfh_internal.guard_forge_local_reservation() returns trigger
language plpgsql security invoker set search_path='' as $$
declare game_ids bigint[];
begin
  select array_agg(value::bigint order by value::bigint) into game_ids
    from pg_catalog.jsonb_array_elements_text(coalesce(new.metrics #> '{execution_scope,requested_game_ids}','[]'::jsonb));
  if coalesce(cardinality(game_ids),0)=0 then
    select array_agg(g.id order by g.id) into game_ids from public.games g where g.date=new.as_of_date;
  end if;
  perform fhfh_internal.lock_forge_execution_scope(new.as_of_date,game_ids);
  if fhfh_internal.active_forge_local_execution(game_ids,null) then
    raise exception 'An unexpired local FORGE attempt owns this scope';
  end if;
  return new;
end; $$;
create trigger forge_local_reservation_guard before insert on public.forge_runs
  for each row execute function fhfh_internal.guard_forge_local_reservation();

create function public.inspect_forge_local_attempt(p_operation_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select o.payload || pg_catalog.jsonb_build_object('payloadHash',o.payload_hash,
    'runStatus',(select fr.status from public.forge_runs fr where fr.run_id=o.entity_key::uuid),
    'observedAt',clock_timestamp(),'state',case when r.id is not null then 'issued'
      when (o.payload->>'leaseExpiresAt')::timestamptz<=clock_timestamp() then 'expired'
      else 'active' end,'revisionId',r.id,'inputSnapshotId',r.input_snapshot_id)
  from public.player_forecast_source_observations o
  left join public.forge_game_revisions r on r.run_id=o.entity_key::uuid
    and r.game_id=(o.payload->>'gameId')::bigint
  where o.id=p_operation_id and o.provider='forge' and o.dataset_key='forge-local-execution-v1';
$$;

create function public.begin_forge_local_run(p_operation_id uuid,p_date date,p_game_id bigint,
  p_code_version text,p_expected_revision_id uuid,p_lease_ms integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare existing jsonb; latest uuid; result uuid; reserved_at timestamptz; receipt jsonb;
begin
  if p_operation_id is null or p_date is null or p_game_id is null or p_game_id<=0
    or p_code_version is null or p_code_version !~ '^local:[a-f0-9]{64}$'
    or p_lease_ms is null or p_lease_ms not between 1 and 600000 then
    raise exception 'Invalid local FORGE attempt';
  end if;
  -- Same identity is serialized even when a retry mistakenly changes its game/date.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('forge-operation:'||p_operation_id::text,0));
  perform fhfh_internal.lock_forge_execution_scope(p_date,array[p_game_id]);
  select payload into existing from public.player_forecast_source_observations where id=p_operation_id;
  if found then
    if existing->>'version' is distinct from 'forge-local-attempt-v1'
      or existing->>'operationId' is distinct from p_operation_id::text
      or existing->>'slateDate' is distinct from p_date::text
      or (existing->>'gameId')::bigint is distinct from p_game_id
      or existing->>'codeVersion' is distinct from p_code_version
      or (existing->>'expectedRevisionId')::uuid is distinct from p_expected_revision_id
      or (existing->>'leaseMs')::integer is distinct from p_lease_ms then
      raise exception 'Local FORGE attempt identity changes its immutable intent';
    end if;
    receipt:=public.inspect_forge_local_attempt(p_operation_id);
    if receipt is null then raise exception 'Invalid local FORGE attempt evidence'; end if;
    return receipt||'{"reservation":"existing"}'::jsonb;
  end if;
  if not exists(select 1 from public.games g where g.id=p_game_id and g.date=p_date
    and g."startTime">clock_timestamp()) then raise exception 'Local FORGE game is not an eligible future scope'; end if;
  select r.id into latest from public.forge_game_revisions r where r.game_id=p_game_id
    order by r.published_at desc,r.id desc limit 1;
  if latest is distinct from p_expected_revision_id then raise exception 'Local FORGE prior revision changed'; end if;
  if fhfh_internal.active_forge_local_execution(array[p_game_id],null) then
    raise exception 'An unexpired local FORGE attempt owns this scope';
  end if;
  -- Only retire our expired, permanently fenced reservations; preserve other jobs.
  update public.forge_runs r set status='failed',updated_at=clock_timestamp(),
    metrics=coalesce(r.metrics,'{}'::jsonb)||'{"local_execution_expired":true}'::jsonb
    from public.player_forecast_source_observations o
    where o.provider='forge' and o.dataset_key='forge-local-execution-v1'
      and (o.payload->>'gameId')::bigint=p_game_id and o.entity_key=r.run_id::text
      and (o.payload->>'leaseExpiresAt')::timestamptz<=clock_timestamp() and r.status='running'
      and not exists(select 1 from public.forge_game_revisions issued where issued.run_id=r.run_id and issued.game_id=p_game_id);
  result:=public.begin_forge_game_run(p_date,array[p_game_id],p_code_version);
  reserved_at:=clock_timestamp();
  receipt:=pg_catalog.jsonb_build_object('version','forge-local-attempt-v1','operationId',p_operation_id,
    'runId',result,'slateDate',p_date,'gameId',p_game_id,'codeVersion',p_code_version,
    'expectedRevisionId',p_expected_revision_id,'leaseMs',p_lease_ms,'reservedAt',reserved_at,
    'leaseExpiresAt',reserved_at+p_lease_ms*interval '1 millisecond');
  insert into public.player_forecast_source_observations(id,provider,dataset_key,entity_kind,entity_key,
    observed_at,available_at,payload_hash,payload,metadata)
    values(p_operation_id,'forge','forge-local-execution-v1','forge_execution_attempt',result::text,
      reserved_at,reserved_at,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(receipt::text,'UTF8')),'hex'),
      receipt,'{"hashCodec":"postgres-jsonb-text-sha256-v1"}'::jsonb);
  return public.inspect_forge_local_attempt(p_operation_id)||'{"reservation":"new"}'::jsonb;
end; $$;

create function fhfh_internal.guard_forge_local_publication() returns trigger
language plpgsql security invoker set search_path='' as $$
declare attempt jsonb; latest uuid; game_date date;
begin
  select g.date into game_date from public.games g where g.id=new.game_id;
  perform fhfh_internal.lock_forge_execution_scope(game_date,array[new.game_id]);
  if fhfh_internal.active_forge_local_execution(array[new.game_id],new.run_id) then
    raise exception 'Another local FORGE attempt owns publication';
  end if;
  select o.payload into attempt from public.player_forecast_source_observations o
    where o.provider='forge' and o.dataset_key='forge-local-execution-v1' and o.entity_key=new.run_id::text;
  if found then
    -- Exact publication replay is an ON CONFLICT no-op, not new issuance.
    if exists(select 1 from public.forge_game_revisions r where r.run_id=new.run_id
      and r.game_id=new.game_id and r.input_snapshot_id=new.input_snapshot_id and r.payload=new.payload) then
      return new;
    end if;
    if (attempt->>'leaseExpiresAt')::timestamptz<=clock_timestamp()
      or (attempt->>'gameId')::bigint is distinct from new.game_id
      or (attempt->>'slateDate')::date is distinct from new.slate_date
      or game_date is distinct from new.slate_date
      or attempt->>'codeVersion' is distinct from new.payload->>'codeVersion' then
      raise exception 'Expired or incompatible local FORGE writer cannot publish';
    end if;
    select r.id into latest from public.forge_game_revisions r where r.game_id=new.game_id
      order by r.published_at desc,r.id desc limit 1;
    if latest is distinct from (attempt->>'expectedRevisionId')::uuid then
      raise exception 'Local FORGE publication superseded';
    end if;
  end if;
  return new;
end; $$;
-- PostgreSQL fires same-event triggers alphabetically: take scope locks before
-- the existing queue/news guard, which remains independently required.
create trigger forge_local_publication_guard before insert on public.forge_game_revisions
  for each row execute function fhfh_internal.guard_forge_local_publication();

revoke all on function fhfh_internal.lock_forge_execution_scope(date,bigint[]),
  fhfh_internal.active_forge_local_execution(bigint[],uuid),fhfh_internal.guard_forge_local_reservation(),
  fhfh_internal.guard_forge_local_publication(),public.inspect_forge_local_attempt(uuid),
  public.begin_forge_local_run(uuid,date,bigint,text,uuid,integer) from public,anon,authenticated;
grant execute on function fhfh_internal.lock_forge_execution_scope(date,bigint[]),
  fhfh_internal.active_forge_local_execution(bigint[],uuid),fhfh_internal.guard_forge_local_reservation(),
  fhfh_internal.guard_forge_local_publication(),public.inspect_forge_local_attempt(uuid),
  public.begin_forge_local_run(uuid,date,bigint,text,uuid,integer) to service_role;
commit;
