begin;
set lock_timeout='5s';

create table public.forge_game_selection_events (
  id uuid primary key default gen_random_uuid(),
  game_id bigint not null references public.games(id),
  revision_id uuid references public.forge_game_revisions(id),
  reason text not null check(length(btrim(reason)) between 1 and 500),
  actor_id uuid,
  created_at timestamptz not null default clock_timestamp()
);
create index forge_game_selection_latest on public.forge_game_selection_events(game_id,created_at desc,id desc);
create table public.forge_final_pregame_revisions (
  game_id bigint primary key references public.games(id),
  revision_id uuid not null references public.forge_game_revisions(id),
  scheduled_start_at timestamptz not null,
  frozen_at timestamptz not null default clock_timestamp()
);
create table public.forge_board_visibility_observations (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.forge_game_revisions(id),
  probe_id uuid not null,
  observed_at timestamptz not null default clock_timestamp(),
  unique(revision_id,probe_id)
);
create table public.forge_board_news_events (
  id uuid primary key default gen_random_uuid(),
  game_id bigint not null references public.games(id),
  queue_version bigint not null,
  source_kind text not null check(source_kind in ('lineup','goalie','review')),
  observation_id uuid not null,
  source_published_at timestamptz not null,
  received_at timestamptz not null,
  accepted_at timestamptz not null,
  unique(source_kind,observation_id,game_id)
);
create index forge_board_news_by_game on public.forge_board_news_events(game_id,accepted_at);
create table public.forge_board_dispatch_observations (
  id uuid primary key default gen_random_uuid(),
  game_id bigint not null references public.games(id),
  queue_version bigint not null,
  lease_owner uuid not null,
  dispatched_at timestamptz not null,
  lease_expires_at timestamptz not null,
  unique(game_id,lease_owner)
);
do $$ declare name text; begin
  foreach name in array array['forge_game_selection_events','forge_final_pregame_revisions','forge_board_visibility_observations','forge_board_news_events','forge_board_dispatch_observations'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on public.%I from public,anon,authenticated',name);
    execute format('grant select,insert on public.%I to service_role',name);
    execute format('create trigger %I before update or delete on public.%I for each row execute function fhfh_internal.reject_player_forecast_mutation()',name||'_immutable',name);
  end loop;
end $$;

create or replace function fhfh_internal.enqueue_starter_board_observation() returns trigger
language plpgsql security invoker set search_path='' as $$
declare prior_version bigint;
begin
  if new.accepted then
    select version into prior_version from public.forge_game_update_queue where game_id=new.game_id;
    perform fhfh_internal.enqueue_starter_board_game(new.game_id,new.team_id,new.observed_at,new.available_at);
    insert into public.forge_board_news_events(game_id,queue_version,source_kind,observation_id,source_published_at,received_at,accepted_at)
      select q.game_id,q.version,case when tg_table_name='player_forecast_lineup_snapshots' then 'lineup' else 'goalie' end,
        new.id,new.observed_at,new.available_at,q.last_accepted_at
      from public.forge_game_update_queue q where q.game_id=new.game_id and q.version>coalesce(prior_version,0)
      on conflict do nothing;
  end if;
  return new;
end $$;

create or replace function fhfh_internal.enqueue_starter_board_resolution() returns trigger
language plpgsql security invoker set search_path='' as $$
declare conflict record; prior_version bigint;
begin
  select game_id,team_id into conflict from public.player_forecast_observation_conflicts where id=new.conflict_id;
  select version into prior_version from public.forge_game_update_queue where game_id=conflict.game_id;
  perform fhfh_internal.enqueue_starter_board_game(conflict.game_id,conflict.team_id,new.resolved_at,new.created_at);
  insert into public.forge_board_news_events(game_id,queue_version,source_kind,observation_id,source_published_at,received_at,accepted_at)
    select q.game_id,q.version,'review',new.id,new.resolved_at,new.created_at,q.last_accepted_at
      from public.forge_game_update_queue q where q.game_id=conflict.game_id and q.version>coalesce(prior_version,0)
      on conflict do nothing;
  return new;
end $$;

create function fhfh_internal.record_starter_board_dispatch() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status='running' and new.lease_owner is distinct from old.lease_owner then
    insert into public.forge_board_dispatch_observations(game_id,queue_version,lease_owner,dispatched_at,lease_expires_at)
      values(new.game_id,new.claimed_version,new.lease_owner,new.dispatched_at,new.lease_expires_at);
  end if;
  return new;
end $$;
create trigger starter_board_dispatch_history after update on public.forge_game_update_queue
  for each row execute function fhfh_internal.record_starter_board_dispatch();

create function public.select_starter_board_revision(p_game_id bigint,p_revision_id uuid,p_reason text,p_actor_id uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare event_id uuid;
begin
  perform 1 from public.games where id=p_game_id and "startTime">clock_timestamp() for update;
  if not found or exists(select 1 from public.forge_final_pregame_revisions where game_id=p_game_id) then
    raise exception 'Final pregame predictions cannot be reselected'; end if;
  if p_revision_id is not null and not exists(select 1 from public.forge_game_revisions where id=p_revision_id and game_id=p_game_id) then
    raise exception 'Revision does not belong to this game'; end if;
  insert into public.forge_game_selection_events(game_id,revision_id,reason,actor_id)
    values(p_game_id,p_revision_id,p_reason,p_actor_id) returning id into event_id;
  return event_id;
end $$;

create function fhfh_internal.current_starter_board_revisions(p_date date)
returns setof public.forge_game_revisions language sql stable security invoker set search_path='' as $$
  select chosen.* from (
    select distinct on(game_id) * from public.forge_game_revisions where slate_date=p_date
      order by game_id,decision_as_of desc,published_at desc,id desc
  ) latest
  left join public.forge_final_pregame_revisions frozen on frozen.game_id=latest.game_id
  left join lateral(select revision_id from public.forge_game_selection_events where game_id=latest.game_id
    order by created_at desc,id desc limit 1) selection on true
  join public.forge_game_revisions chosen on chosen.id=coalesce(frozen.revision_id,selection.revision_id,latest.id);
$$;

create function public.freeze_starter_board_pregame(p_date date)
returns integer language plpgsql security invoker set search_path='' as $$
declare inserted_count integer;
begin
  insert into public.forge_final_pregame_revisions(game_id,revision_id,scheduled_start_at)
    select r.game_id,r.id,g."startTime" from fhfh_internal.current_starter_board_revisions(p_date) r
    join public.games g on g.id=r.game_id where g."startTime"<=clock_timestamp()
    on conflict(game_id) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

create or replace function public.read_forge_game_revisions(p_slate_date date)
returns table(id uuid,run_id uuid,game_id bigint,decision_as_of timestamptz,published_at timestamptz,payload jsonb)
language sql stable security invoker set search_path='' as $$
  select r.id,r.run_id,r.game_id,r.decision_as_of,r.published_at,
    r.payload||pg_catalog.jsonb_build_object('previousRevision',(
      select pg_catalog.jsonb_build_object('id',p.id,'codeVersion',p.payload->>'codeVersion','modelMode',p.payload->>'modelMode',
        'players',p.payload->'players','goalies',p.payload->'goalies')
      from public.forge_game_revisions p where p.game_id=r.game_id and p.slate_date=r.slate_date
        and (p.decision_as_of,p.published_at,p.id)<(r.decision_as_of,r.published_at,r.id)
      order by p.decision_as_of desc,p.published_at desc,p.id desc limit 1))
    from fhfh_internal.current_starter_board_revisions(p_slate_date) r;
$$;

create function public.record_starter_board_visibility(p_probe_id uuid,p_revision_ids uuid[])
returns integer language plpgsql security invoker set search_path='' as $$
declare inserted_count integer;
begin
  if p_probe_id is null or coalesce(cardinality(p_revision_ids),0) not between 1 and 16 then raise exception 'Invalid board probe'; end if;
  -- A delayed/stale browser observation is retained too: it is the evidence of
  -- what the browser actually rendered, not a claim about the latest selection.
  insert into public.forge_board_visibility_observations(revision_id,probe_id)
    select id,p_probe_id from public.forge_game_revisions where id=any(p_revision_ids)
    on conflict(revision_id,probe_id) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

revoke all on function public.select_starter_board_revision(bigint,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.freeze_starter_board_pregame(date) from public,anon,authenticated;
revoke all on function fhfh_internal.current_starter_board_revisions(date) from public,anon,authenticated;
grant execute on function public.select_starter_board_revision(bigint,uuid,text,uuid) to service_role;
grant execute on function public.freeze_starter_board_pregame(date) to service_role;
grant execute on function fhfh_internal.current_starter_board_revisions(date) to service_role;
revoke all on function public.record_starter_board_visibility(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.record_starter_board_visibility(uuid,uuid[]) to service_role;
revoke all on function fhfh_internal.record_starter_board_dispatch() from public,anon,authenticated;
commit;
