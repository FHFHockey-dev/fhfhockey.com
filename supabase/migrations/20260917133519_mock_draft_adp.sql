-- Raw mock history is private; only the server may ingest or aggregate it.
create table public.mock_draft_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  league jsonb not null,
  cohort text not null,
  user_seat integer not null,
  tier text not null check (tier in ('free', 'pro')),
  engine_version text not null,
  research_version text,
  created_at timestamptz not null default now(),
  completed boolean not null default false,
  withdrawn boolean not null default false,
  check (user_seat >= 0 and user_seat < (league->>'teamCount')::integer)
);
create index mock_draft_sessions_user_created on public.mock_draft_sessions(user_id, created_at);
create index mock_draft_sessions_cohort_created on public.mock_draft_sessions(cohort, created_at);
create table public.mock_draft_events (
  session_id uuid not null references public.mock_draft_sessions(id) on delete cascade,
  pick integer not null check (pick between 1 and 1600),
  seat integer not null check (seat between 0 and 39),
  player_id bigint not null references public.fhfh_player_identities(id),
  dashboard_player_id text not null,
  source text not null check (source in ('human', 'bot', 'timeout')),
  contributes boolean not null,
  observed_at timestamptz not null default now(),
  primary key (session_id, pick),
  unique (session_id, player_id),
  check (not contributes or source = 'human')
);
create index mock_draft_events_player on public.mock_draft_events(player_id);
alter table public.mock_draft_sessions enable row level security;
alter table public.mock_draft_events enable row level security;
revoke all on public.mock_draft_sessions, public.mock_draft_events from public, anon, authenticated;
grant select, insert, update, delete on public.mock_draft_sessions, public.mock_draft_events to service_role;

create or replace function public.mock_draft_register(p_user uuid, p_input jsonb, p_cohort text, p_pro_allowed boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.mock_draft_sessions; day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 7821));
  select * into existing from public.mock_draft_sessions where id = (p_input->>'id')::uuid;
  if found then
    if existing.user_id <> p_user then raise exception 'not_found'; end if;
    if existing.withdrawn then return jsonb_build_object('registered',true,'withdrawn',true); end if;
    if existing.league <> p_input->'league' or existing.user_seat <> (p_input->>'userSeat')::integer
      or existing.tier <> p_input->>'tier' or existing.engine_version <> p_input->>'engineVersion'
      or existing.research_version is distinct from p_input->>'researchVersion' or existing.cohort <> p_cohort
      then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('registered', true, 'withdrawn', existing.withdrawn);
  end if;
  if p_input->>'tier' = 'pro' and not coalesce(p_pro_allowed,false) then raise exception 'advanced_required'; end if;
  if (select count(*) from public.mock_draft_sessions where user_id = p_user and created_at >= day_start and engine_version <> 'withdrawn') >= 20 then raise exception 'daily_limit'; end if;
  insert into public.mock_draft_sessions(id, user_id, league, cohort, user_seat, tier, engine_version, research_version)
  values ((p_input->>'id')::uuid, p_user, p_input->'league', p_cohort, (p_input->>'userSeat')::integer, p_input->>'tier', p_input->>'engineVersion', p_input->>'researchVersion');
  return jsonb_build_object('registered', true);
end $$;

create or replace function public.mock_draft_ingest(p_user uuid, p_session uuid, p_events jsonb, p_complete boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.mock_draft_sessions; event jsonb; existing public.mock_draft_events; next_pick integer; n integer; total integer; expected_seat integer; pid bigint;
begin
  select * into s from public.mock_draft_sessions where id = p_session and user_id = p_user for update;
  if not found then raise exception 'not_found'; end if;
  if s.withdrawn then raise exception 'withdrawn'; end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) not between 1 and 100 then raise exception 'invalid_events'; end if;
  n := (s.league->>'teamCount')::integer;
  select n * sum(value::integer) into total from jsonb_each_text(s.league->'roster');
  select coalesce(max(pick),0) + 1 into next_pick from public.mock_draft_events where session_id = p_session;
  for event in select value from jsonb_array_elements(p_events) loop
    if (event->>'pick')::integer not between 1 and total then raise exception 'invalid_pick'; end if;
    expected_seat := ((event->>'pick')::integer - 1) % n;
    if (((event->>'pick')::integer - 1) / n) % 2 = 1 then expected_seat := n - expected_seat - 1; end if;
    if expected_seat <> (event->>'seat')::integer
      or (expected_seat = s.user_seat and event->>'source' = 'bot')
      or (expected_seat <> s.user_seat and event->>'source' <> 'bot')
      or ((event->>'contributes')::boolean and event->>'source' <> 'human') then raise exception 'invalid_source'; end if;
    select id into pid from public.fhfh_player_identities where nhl_player_id = (event->>'playerId')::bigint;
    if pid is null then raise exception 'unknown_player'; end if;
    select * into existing from public.mock_draft_events where session_id = p_session and pick = (event->>'pick')::integer;
    if found then
      if existing.player_id <> pid or existing.seat <> expected_seat or existing.source <> event->>'source'
        or existing.contributes <> (event->>'contributes')::boolean then raise exception 'idempotency_conflict'; end if;
    else
      if s.completed or (event->>'pick')::integer <> next_pick then raise exception 'out_of_order'; end if;
      insert into public.mock_draft_events(session_id, pick, seat, player_id, dashboard_player_id, source, contributes)
      values(p_session, next_pick, expected_seat, pid, event->>'playerId', event->>'source', (event->>'contributes')::boolean);
      next_pick := next_pick + 1;
    end if;
  end loop;
  if p_complete then
    if next_pick <> total + 1 then raise exception 'incomplete'; end if;
    update public.mock_draft_sessions set completed = true where id = p_session;
  end if;
  return jsonb_build_object('acceptedThrough', next_pick - 1);
end $$;

create or replace function public.mock_draft_withdraw(p_user uuid, p_session uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  -- The session row remains as a tombstone, preserving both the daily cap and withdrawal on retries.
  -- A withdrawal arriving before offline registration must also prevent later resurrection.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 7821));
  insert into public.mock_draft_sessions(id,user_id,league,cohort,user_seat,tier,engine_version,withdrawn)
  values(p_session,p_user,'{"teamCount":2,"season":"withdrawn","roster":{"C":1}}','withdrawn',0,'free','withdrawn',true)
  on conflict(id) do nothing;
  update public.mock_draft_sessions set withdrawn = true where id = p_session and user_id = p_user;
  if not found then raise exception 'not_found'; end if;
  delete from public.mock_draft_events where session_id = p_session;
  return jsonb_build_object('withdrawn', true);
end $$;

create or replace function public.mock_draft_adp(p_season text, p_cohort text, p_tier text, p_completed boolean, p_search text, p_position text, p_page integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
with eligible as (
  select e.*, s.user_id from public.mock_draft_events e join public.mock_draft_sessions s on s.id = e.session_id
  where not s.withdrawn and e.source = 'human' and e.seat = s.user_seat and e.contributes
    and e.observed_at >= now() - interval '30 days' and s.league->>'season' = p_season
    and s.cohort = p_cohort and (p_tier = 'all' or s.tier = p_tier) and (not p_completed or s.completed)
), weighted as (
  select *, 1.0 / count(*) over (partition by player_id, user_id) as weight from eligible
), users as (
  select player_id, user_id, avg(pick) as mean_pick from eligible group by player_id, user_id
), means as (
  select player_id, avg(mean_pick) as adp, count(*) as contributors from users group by player_id
), distribution as (
  select player_id, pick, sum(weight) as weight from weighted group by player_id, pick
), cumulative as (
  select *, sum(weight) over (partition by player_id order by pick) / sum(weight) over (partition by player_id) as fraction from distribution
), quantiles as (
  select player_id, min(pick) filter(where fraction >= 0.25) as low,
    min(pick) filter(where fraction >= 0.5) as median, min(pick) filter(where fraction >= 0.75) as high
    from cumulative group by player_id
), counts as (
  select player_id, count(*) as selections, max(observed_at) as last_observed from eligible group by player_id
), rows as (
  select i.nhl_player_id::text as "playerId", i.canonical_name as name, coalesce(i.canonical_position::text, '') as position,
    case when m.contributors >= 5 then m.adp end as adp,
    case when m.contributors >= 5 then q.median end as median,
    case when m.contributors >= 5 then q.low end as low,
    case when m.contributors >= 5 then q.high end as high,
    c.selections, m.contributors, c.last_observed as "lastObserved"
  from means m join quantiles q using(player_id) join counts c using(player_id)
    join public.fhfh_player_identities i on i.id = m.player_id
  where (p_search = '' or position(lower(p_search) in lower(i.canonical_name)) > 0)
    and (p_position = '' or p_position = any(regexp_split_to_array(coalesce(i.canonical_position::text, ''), '[/, ]+')))
), page as (select * from rows order by adp nulls last, name limit 50 offset (greatest(1, p_page)-1)*50),
cohorts as (select distinct cohort as key, league from public.mock_draft_sessions
  where not withdrawn and league->>'season' = p_season and created_at >= now() - interval '30 days')
select jsonb_build_object('rows', coalesce((select jsonb_agg(to_jsonb(page)) from page), '[]'::jsonb),
  'total', (select count(*) from rows), 'cohorts', coalesce((select jsonb_agg(to_jsonb(cohorts)) from cohorts), '[]'::jsonb));
$$;

revoke all on function public.mock_draft_register(uuid,jsonb,text,boolean), public.mock_draft_ingest(uuid,uuid,jsonb,boolean), public.mock_draft_withdraw(uuid,uuid), public.mock_draft_adp(text,text,text,boolean,text,text,integer) from public, anon, authenticated;
grant execute on function public.mock_draft_register(uuid,jsonb,text,boolean), public.mock_draft_ingest(uuid,uuid,jsonb,boolean), public.mock_draft_withdraw(uuid,uuid), public.mock_draft_adp(text,text,text,boolean,text,text,integer) to service_role;
