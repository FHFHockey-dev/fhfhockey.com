begin;
set lock_timeout = '5s';

-- FORGE consumes a whole game; the private research queue consumes team/horizon
-- scopes and has a different promotion contract. Reuse its lease/watermark
-- pattern without allowing either worker to claim the other's work.
create table public.forge_game_update_queue (
  game_id bigint primary key references public.games(id),
  version bigint not null default 1,
  claimed_version bigint,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed','cancelled')),
  first_accepted_at timestamptz not null default clock_timestamp(),
  last_accepted_at timestamptz not null default clock_timestamp(),
  source_published_at timestamptz not null,
  received_at timestamptz not null,
  not_before timestamptz not null default clock_timestamp() + interval '30 seconds',
  lease_owner uuid,
  lease_expires_at timestamptz,
  dispatched_at timestamptz,
  completed_at timestamptz,
  published_run_id uuid references public.forge_runs(run_id),
  active_run_id uuid references public.forge_runs(run_id),
  attempt_count integer not null default 0,
  last_error text
);
alter table public.forge_game_update_queue enable row level security;
revoke all on public.forge_game_update_queue from public, anon, authenticated;
grant select, insert, update on public.forge_game_update_queue to service_role;

create function fhfh_internal.enqueue_starter_board_game(p_game_id bigint,p_team_id bigint,p_published_at timestamptz,p_received_at timestamptz) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.games g
    where g.id=p_game_id and g."startTime" > clock_timestamp()
      and (p_team_id is null or p_team_id in (g."homeTeamId",g."awayTeamId"))) then return; end if;
  insert into public.forge_game_update_queue as q(game_id,source_published_at,received_at)
    values(p_game_id,p_published_at,p_received_at)
  on conflict(game_id) do update set
    version=q.version+1, last_accepted_at=clock_timestamp(),
    source_published_at=greatest(q.source_published_at,excluded.source_published_at),
    received_at=greatest(q.received_at,excluded.received_at),
    first_accepted_at=case when q.status in ('succeeded','cancelled') then clock_timestamp() else q.first_accepted_at end,
    -- Repeated news does not keep pushing a pending job into the future.
    not_before=case when q.status in ('succeeded','cancelled') then clock_timestamp()+interval '30 seconds' else q.not_before end,
    status=case when q.status='running' then 'running' else 'pending' end;
end; $$;
revoke all on function fhfh_internal.enqueue_starter_board_game(bigint,bigint,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function fhfh_internal.enqueue_starter_board_game(bigint,bigint,timestamptz,timestamptz) to service_role;

create function fhfh_internal.enqueue_starter_board_observation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.accepted then
    perform fhfh_internal.enqueue_starter_board_game(new.game_id,new.team_id,new.observed_at,new.available_at);
  end if;
  return new;
end; $$;
create trigger starter_board_lineup_news after insert on public.player_forecast_lineup_snapshots
  for each row execute function fhfh_internal.enqueue_starter_board_observation();
create trigger starter_board_goalie_news after insert on public.player_forecast_goalie_start_observations
  for each row execute function fhfh_internal.enqueue_starter_board_observation();

create function fhfh_internal.enqueue_starter_board_resolution() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare conflict record;
begin
  select game_id,team_id into conflict from public.player_forecast_observation_conflicts where id=new.conflict_id;
  perform fhfh_internal.enqueue_starter_board_game(conflict.game_id,conflict.team_id,new.resolved_at,new.created_at);
  return new;
end; $$;
create trigger starter_board_reviewed_news after insert on public.player_forecast_conflict_resolutions
  for each row execute function fhfh_internal.enqueue_starter_board_resolution();

create function public.claim_starter_board_jobs(p_owner uuid, p_limit integer default 4, p_game_ids bigint[] default null)
returns setof public.forge_game_update_queue language plpgsql security invoker set search_path='' as $$
begin
  if p_owner is null or p_limit is null or p_limit not between 1 and 16 then raise exception 'Invalid board claim'; end if;
  if p_game_ids is not null and (cardinality(p_game_ids) not between 1 and 16
      or exists(select 1 from unnest(p_game_ids) id where id is null or id<=0)
      or (select count(distinct id) from unnest(p_game_ids) id)<>cardinality(p_game_ids)) then
    raise exception 'Invalid board canary scope'; end if;
  -- Only retire runs belonging to an expired queue lease, never unrelated work.
  update public.forge_runs r set status='failed',updated_at=clock_timestamp(),
    metrics=coalesce(r.metrics,'{}'::jsonb)||'{"board_lease_expired":true}'::jsonb
    from public.forge_game_update_queue q where q.active_run_id=r.run_id
      and q.status='running' and q.lease_expires_at<=clock_timestamp() and r.status='running';
  update public.forge_game_update_queue q set status='cancelled',lease_owner=null,lease_expires_at=null
    from public.games g where g.id=q.game_id and g."startTime" <= clock_timestamp()
      and q.status in ('pending','failed','running');
  return query with candidates as (
    select q.game_id from public.forge_game_update_queue q
    where q.not_before <= clock_timestamp()
      and (p_game_ids is null or q.game_id=any(p_game_ids))
      and (q.status in ('pending','failed') or (q.status='running' and q.lease_expires_at <= clock_timestamp()))
    order by q.first_accepted_at for update skip locked limit p_limit
  ) update public.forge_game_update_queue q set status='running',claimed_version=q.version,
      lease_owner=p_owner,lease_expires_at=clock_timestamp()+interval '210 seconds',
      active_run_id=null,
      dispatched_at=clock_timestamp(),attempt_count=q.attempt_count+1,last_error=null
    from candidates c where q.game_id=c.game_id returning q.*;
end; $$;

create function public.finish_starter_board_job(p_game_id bigint,p_owner uuid,p_run_id uuid,p_error text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
  update public.forge_game_update_queue q set
    status=case when q.version>q.claimed_version then 'pending' when p_error is null then 'succeeded' else 'failed' end,
    not_before=case when q.version>q.claimed_version then clock_timestamp() else clock_timestamp()+interval '30 seconds' end,
    published_run_id=case when p_error is null then p_run_id else q.published_run_id end,
    completed_at=clock_timestamp(),lease_owner=null,lease_expires_at=null,active_run_id=null,last_error=left(p_error,2000)
    where q.game_id=p_game_id and q.lease_owner=p_owner and q.lease_expires_at>clock_timestamp()
      and (p_error is not null or exists(select 1 from public.forge_game_revisions r where r.game_id=p_game_id and r.run_id=p_run_id));
  if not found then raise exception 'Board job lease lost or publication missing'; end if;
end; $$;

-- Disjoint game jobs may run concurrently. Serialize reservation, then refuse
-- overlapping active scopes. Full-slate runs conflict with every game scope.
create function public.begin_forge_game_run(p_date date,p_game_ids bigint[],p_code_version text,p_owner uuid default null,p_version bigint default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('forge:'||p_date::text,0));
  if p_owner is not null then
    if cardinality(p_game_ids)<>1 or p_version is null then raise exception 'Invalid board lease scope'; end if;
    perform 1 from public.forge_game_update_queue q where q.game_id=p_game_ids[1]
      and q.status='running' and q.lease_owner=p_owner and q.claimed_version=p_version
      and q.lease_expires_at>clock_timestamp() for update;
    if not found then raise exception 'Board computation lease lost'; end if;
    if exists(select 1 from public.forge_game_update_queue q where q.game_id=p_game_ids[1] and q.active_run_id is not null) then
      raise exception using errcode='P0002',message='Board lease computation already started';
    end if;
  elsif p_version is not null then raise exception 'Missing board lease owner'; end if;
  if exists(select 1 from public.forge_runs r where r.as_of_date=p_date and r.status='running'
    and coalesce(r.updated_at,r.created_at)>clock_timestamp()-interval '10 minutes'
    and (coalesce(cardinality(p_game_ids),0)=0
      or coalesce(pg_catalog.jsonb_array_length(r.metrics #> '{execution_scope,requested_game_ids}'),0)=0
      or exists(select 1 from pg_catalog.jsonb_array_elements_text(r.metrics #> '{execution_scope,requested_game_ids}') id
        where id::bigint=any(p_game_ids)))) then raise exception 'An overlapping FORGE run is already active'; end if;
  insert into public.forge_runs(as_of_date,status,git_sha,metrics)
    values(p_date,'running',p_code_version,pg_catalog.jsonb_build_object('execution_scope',
      pg_catalog.jsonb_build_object('requested_game_ids',coalesce(pg_catalog.to_jsonb(p_game_ids),'[]'::jsonb)),
      'board_lease',case when p_owner is null then null else pg_catalog.jsonb_build_object('owner',p_owner,'version',p_version) end))
    returning run_id into result;
  if p_owner is not null then update public.forge_game_update_queue set active_run_id=result where game_id=p_game_ids[1]; end if;
  return result;
end; $$;

-- A superseded result cannot displace the last published board. The lease
-- worker will immediately retry using the newer accepted evidence.
create function fhfh_internal.guard_starter_board_publication() returns trigger
language plpgsql security invoker set search_path='' as $$
declare cutoff timestamptz; lease jsonb;
begin
  perform 1 from public.forge_game_update_queue q where q.game_id=new.game_id for update;
  select metrics->'board_lease' into lease from public.forge_runs where run_id=new.run_id;
  if lease is not null and lease<>'null'::jsonb and not exists(select 1 from public.forge_game_update_queue q
    where q.game_id=new.game_id and q.active_run_id=new.run_id and q.status='running'
      and q.lease_owner=(lease->>'owner')::uuid and q.claimed_version=(lease->>'version')::bigint
      and q.lease_expires_at>clock_timestamp()) then raise exception 'Expired worker cannot publish'; end if;
  select (payload->>'inputCutoff')::timestamptz into cutoff
    from public.player_forecast_source_observations where id=new.input_snapshot_id;
  if exists(select 1 from public.forge_game_update_queue q where q.game_id=new.game_id
      and q.last_accepted_at>cutoff) then raise exception 'FORGE inputs superseded by newer accepted evidence'; end if;
  return new;
end; $$;
create trigger starter_board_publication_guard before insert on public.forge_game_revisions
  for each row execute function fhfh_internal.guard_starter_board_publication();

revoke all on function public.claim_starter_board_jobs(uuid,integer,bigint[]) from public,anon,authenticated;
revoke all on function public.finish_starter_board_job(bigint,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.begin_forge_game_run(date,bigint[],text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.claim_starter_board_jobs(uuid,integer,bigint[]) to service_role;
grant execute on function public.finish_starter_board_job(bigint,uuid,uuid,text) to service_role;
grant execute on function public.begin_forge_game_run(date,bigint[],text,uuid,bigint) to service_role;
commit;
