begin;
set lock_timeout = '5s';
set statement_timeout = '60s';

-- Append-only, service-only publication history. Public routes explicitly map
-- safe fields; source transcripts remain in the existing private evidence store.
create table public.forge_game_revisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.forge_runs(run_id),
  game_id bigint not null references public.games(id),
  slate_date date not null,
  input_snapshot_id uuid not null references public.player_forecast_source_observations(id),
  decision_as_of timestamptz not null,
  published_at timestamptz not null default clock_timestamp(),
  payload jsonb not null,
  unique (run_id, game_id)
);
create index forge_game_revisions_slate_idx
  on public.forge_game_revisions(slate_date, game_id, decision_as_of desc, published_at desc);
alter table public.forge_game_revisions enable row level security;
revoke all on public.forge_game_revisions from public, anon, authenticated;
grant select, insert on public.forge_game_revisions to service_role;
create trigger forge_game_revisions_immutable before update or delete
  on public.forge_game_revisions for each row
  execute function fhfh_internal.reject_player_forecast_mutation();

create function public.publish_forge_game_revisions(p_run_id uuid, p_snapshot_id uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  snapshot jsonb;
  cutoff timestamptz;
  inserted_count integer;
begin
  select payload into snapshot from public.player_forecast_source_observations
    where id = p_snapshot_id and provider = 'forge' and dataset_key = 'forge-run-inputs-v1'
      and entity_key = p_run_id::text;
  if snapshot is null or snapshot->>'version' is distinct from 'forge-inputs-v1'
      or snapshot->>'replayClassification' is distinct from 'captured_live'
      or (snapshot->>'horizonGames')::integer is distinct from 1 then
    raise exception 'A captured live one-game input snapshot is required';
  end if;
  cutoff := (snapshot->>'decisionAsOf')::timestamptz;
  if cutoff is null or cutoff > clock_timestamp() or snapshot->>'slateDate' is null
    or snapshot->>'inputCutoff' is null or (snapshot->>'inputCutoff')::timestamptz>cutoff or not exists (
    select 1 from public.forge_runs where run_id = p_run_id and status = 'succeeded'
  ) then raise exception 'Only completed runs with a nonfuture cutoff can publish'; end if;

  insert into public.forge_game_revisions(run_id, game_id, slate_date, input_snapshot_id, decision_as_of, payload)
  select p_run_id, g.id, g.date, p_snapshot_id, cutoff,
    pg_catalog.jsonb_build_object(
      'players', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.player_id)
        from public.forge_player_projections p where p.run_id = p_run_id and p.game_id = g.id and p.horizon_games = 1),
      'teams', (select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) order by t.team_id)
        from public.forge_team_projections t where t.run_id = p_run_id and t.game_id = g.id and t.horizon_games = 1),
      'goalies', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(k) order by k.goalie_id)
        from public.forge_goalie_projections k where k.run_id = p_run_id and k.game_id = g.id and k.horizon_games = 1), '[]'::jsonb),
      'goalieStarts', coalesce((select pg_catalog.jsonb_agg(s) from pg_catalog.jsonb_array_elements(snapshot->'goalieStarts') s
        where (s->>'game_id')::bigint = g.id), '[]'::jsonb),
      'modelMode', snapshot->>'modelMode', 'codeVersion', snapshot->>'codeVersion', 'inputProvenance',snapshot->'inputProvenance',
      'inputCutoff',snapshot->>'inputCutoff','calculatedAt',snapshot->>'capturedAt',
      'evidence',pg_catalog.jsonb_build_object(
        'assertions',coalesce((select pg_catalog.jsonb_agg(e) from pg_catalog.jsonb_array_elements(snapshot #> '{dailyBoardEvidence,assertions}') e where (e->>'gameId')::bigint=g.id),'[]'::jsonb),
        'conflicts',coalesce((select pg_catalog.jsonb_agg(e) from pg_catalog.jsonb_array_elements(snapshot #> '{dailyBoardEvidence,conflicts}') e where (e->>'gameId')::bigint=g.id),'[]'::jsonb)))
  from public.games g
  where g.date = (snapshot->>'slateDate')::date
    and g."startTime" is not null and cutoff < g."startTime"
    and clock_timestamp() < g."startTime"
    and (select count(distinct p.team_id) from public.forge_player_projections p
      where p.run_id = p_run_id and p.game_id = g.id and p.horizon_games = 1
        and p.team_id in (g."homeTeamId", g."awayTeamId")) = 2
    and (select count(distinct t.team_id) from public.forge_team_projections t
      where t.run_id = p_run_id and t.game_id = g.id and t.horizon_games = 1
        and t.team_id in (g."homeTeamId", g."awayTeamId")) = 2
  on conflict (run_id, game_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create function public.read_forge_game_revisions(p_slate_date date)
returns table(id uuid, run_id uuid, game_id bigint, decision_as_of timestamptz, published_at timestamptz, payload jsonb)
language sql stable security invoker set search_path = '' as $$
  with latest as (
    select distinct on (r.game_id) r.* from public.forge_game_revisions r
    where r.slate_date = p_slate_date order by r.game_id,r.decision_as_of desc,r.published_at desc,r.id desc
  )
  select r.id,r.run_id,r.game_id,r.decision_as_of,r.published_at,
    r.payload || pg_catalog.jsonb_build_object('previousRevision',(
      select pg_catalog.jsonb_build_object('id',p.id,'codeVersion',p.payload->>'codeVersion','modelMode',p.payload->>'modelMode',
        'players',p.payload->'players','goalies',p.payload->'goalies')
      from public.forge_game_revisions p where p.game_id=r.game_id and p.slate_date=r.slate_date
        and (p.decision_as_of,p.published_at,p.id)<(r.decision_as_of,r.published_at,r.id)
      order by p.decision_as_of desc,p.published_at desc,p.id desc limit 1))
    from latest r;
$$;
revoke all on function public.publish_forge_game_revisions(uuid, uuid) from public, anon, authenticated;
revoke all on function public.read_forge_game_revisions(date) from public, anon, authenticated;
grant execute on function public.publish_forge_game_revisions(uuid, uuid) to service_role;
grant execute on function public.read_forge_game_revisions(date) to service_role;
commit;
