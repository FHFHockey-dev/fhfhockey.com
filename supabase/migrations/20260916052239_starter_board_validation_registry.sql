begin;
set lock_timeout='5s';

create table public.forge_board_releases (
  id uuid primary key default gen_random_uuid(),
  release_key text not null unique check(length(release_key) between 1 and 80),
  code_version text not null check(length(code_version) between 1 and 128),
  model_identity text not null check(length(model_identity) between 1 and 80),
  evaluation_version text not null check(length(evaluation_version) between 1 and 80),
  policy_hash text not null check(policy_hash ~ '^[a-f0-9]{64}$'),
  policy jsonb not null check(jsonb_typeof(policy)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create table public.forge_board_release_activations (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references public.forge_board_releases(id),
  reason text not null check(length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default clock_timestamp()
);
create index forge_board_active_release on public.forge_board_release_activations(created_at desc,id desc);
create table public.forge_board_live_slates (
  slate_date date primary key,
  release_id uuid not null references public.forge_board_releases(id),
  revision_id uuid not null references public.forge_game_revisions(id),
  visibility_id uuid not null references public.forge_board_visibility_observations(id),
  first_visible_at timestamptz not null
);
create table public.forge_board_validation_reviews (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.forge_board_releases(id),
  kind text not null check(kind in ('weekly','day14','day30')),
  report_hash text not null unique check(report_hash ~ '^[a-f0-9]{64}$'),
  report jsonb not null check(jsonb_typeof(report)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create index forge_board_reviews_release on public.forge_board_validation_reviews(release_id,created_at desc,id desc);
do $$ declare name text; begin
  foreach name in array array['forge_board_releases','forge_board_release_activations','forge_board_live_slates','forge_board_validation_reviews'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('revoke all on public.%I from public,anon,authenticated',name);
    execute format('grant select,insert on public.%I to service_role',name);
    execute format('create trigger %I before update or delete on public.%I for each row execute function fhfh_internal.reject_player_forecast_mutation()',name||'_immutable',name);
  end loop;
end $$;

create function public.activate_starter_board_release(p_release_id uuid,p_reason text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
  -- Null deactivates disclosure tracking. It does not delete past evidence or
  -- change serving flags, model coefficients, scheduler state or deployments.
  insert into public.forge_board_release_activations(release_id,reason) values(p_release_id,p_reason) returning id into result;
  return result;
end $$;

create function fhfh_internal.record_starter_board_live_slate() returns trigger
language plpgsql security invoker set search_path='' as $$
declare active_release uuid;
begin
  select release_id into active_release from public.forge_board_release_activations order by created_at desc,id desc limit 1;
  if active_release is not null then
    insert into public.forge_board_live_slates(slate_date,release_id,revision_id,visibility_id,first_visible_at)
      select r.slate_date,active_release,r.id,new.id,new.observed_at
      from public.forge_game_revisions r join public.games g on g.id=r.game_id
      join public.forge_board_releases release on release.id=active_release
      where r.id=new.revision_id and g.type=2 and g."startTime">new.observed_at
        and r.slate_date=(new.observed_at at time zone 'America/New_York')::date
        and r.payload->>'codeVersion'=release.code_version
        and exists(select 1 from fhfh_internal.current_starter_board_revisions(r.slate_date) selected where selected.id=r.id)
      on conflict(slate_date) do nothing;
  end if;
  return new;
end $$;
create trigger starter_board_live_slate after insert on public.forge_board_visibility_observations
  for each row execute function fhfh_internal.record_starter_board_live_slate();

create function fhfh_internal.guard_starter_board_review() returns trigger
language plpgsql security invoker set search_path='' as $$
declare release public.forge_board_releases; started date; report_at timestamptz; minimum_day integer;
begin
  select * into strict release from public.forge_board_releases where id=new.release_id;
  select min(slate_date) into started from public.forge_board_live_slates;
  report_at:=(new.report->>'asOf')::timestamptz;
  if new.report->>'contractVersion' is distinct from 'starter-board-review-v1'
    or new.report->>'evaluationVersion' is distinct from release.evaluation_version
    or new.report->>'policyHash' is distinct from release.policy_hash
    or report_at is null or report_at>clock_timestamp() then raise exception 'Review does not match frozen release policy'; end if;
  minimum_day:=case new.kind when 'day14' then 14 when 'day30' then 30 else 1 end;
  if started is null or (report_at at time zone 'America/New_York')::date-started+1<minimum_day then
    raise exception 'Review milestone has not begun or is not due'; end if;
  if new.report->>'windowStart' is null or new.report->>'windowEnd' is null
    or (new.report->>'windowStart')::date<started
    or (new.report->>'windowStart')::date>(new.report->>'windowEnd')::date
    or (new.report->>'windowEnd')::date>(report_at at time zone 'America/New_York')::date
    or new.report->>'evidenceClass' is distinct from 'captured_live' or new.report->>'gameType' is distinct from 'regular_season' then
    raise exception 'Published live review requires prospective regular-season evidence'; end if;
  return new;
end $$;
create trigger starter_board_review_guard before insert on public.forge_board_validation_reviews
  for each row execute function fhfh_internal.guard_starter_board_review();

create function public.read_starter_board_validation() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('release',to_jsonb(r),'startedOn',(select min(slate_date) from public.forge_board_live_slates),
    'liveRegularSlates',(select count(*) from public.forge_board_live_slates),
    'reviews',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc,v.id desc) from (
      select * from public.forge_board_validation_reviews where release_id=r.id order by created_at desc,id desc limit 20
    ) v),'[]'::jsonb))
  from (select release_id from public.forge_board_release_activations order by created_at desc,id desc limit 1) active
  left join public.forge_board_releases r on r.id=active.release_id;
$$;
revoke all on function public.activate_starter_board_release(uuid,text) from public,anon,authenticated;
revoke all on function public.read_starter_board_validation() from public,anon,authenticated;
revoke all on function fhfh_internal.record_starter_board_live_slate() from public,anon,authenticated;
revoke all on function fhfh_internal.guard_starter_board_review() from public,anon,authenticated;
grant execute on function public.activate_starter_board_release(uuid,text) to service_role;
grant execute on function public.read_starter_board_validation() to service_role;
commit;
