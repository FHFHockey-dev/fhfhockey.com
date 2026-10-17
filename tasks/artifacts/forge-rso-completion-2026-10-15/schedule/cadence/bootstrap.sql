CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.seasons(id bigint primary key); INSERT INTO public.seasons VALUES(20262027);
CREATE TABLE public.teams(id smallint primary key);
CREATE TABLE public.fhfh_player_identities(id bigint primary key);
create table public.player_forecast_season_queue (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null unique,
  season_id bigint not null references public.seasons(id),
  view_key text not null check (view_key in ('current', 'ros')),
  team_id smallint references public.teams(id),
  opponent_team_id smallint references public.teams(id),
  fhfh_player_id bigint references public.fhfh_player_identities(id),
  reasons text[] not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  first_enqueued_at timestamptz not null,
  last_enqueued_at timestamptz not null,
  not_before timestamptz not null,
  source_high_watermark timestamptz not null,
  claimed_watermark timestamptz,
  processed_watermark timestamptz,
  lease_owner uuid,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  last_error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(scope_key) <> '' and cardinality(reasons) > 0),
  check (jsonb_typeof(metadata) = 'object'),
  check (
    (status = 'running' and lease_owner is not null and lease_expires_at is not null and claimed_watermark is not null)
    or status <> 'running'
  )
);

create or replace function public.enqueue_player_forecast_season_job(
  p_scope_key text,
  p_season_id bigint,
  p_view_key text,
  p_team_id smallint,
  p_opponent_team_id smallint,
  p_fhfh_player_id bigint,
  p_reason text,
  p_source_high_watermark timestamptz,
  p_not_before timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.player_forecast_season_queue
language plpgsql
security invoker
set search_path = ''
as $$
declare
  queued public.player_forecast_season_queue;
begin
  if nullif(pg_catalog.btrim(p_scope_key), '') is null
    or p_season_id is null
    or p_view_key not in ('current', 'ros')
    or nullif(pg_catalog.btrim(p_reason), '') is null
    or p_source_high_watermark is null
    or p_metadata is null
    or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
  then
    raise exception using errcode = '22023', message = 'PLAYER_FORECAST_SEASON_QUEUE_INVALID_ARGUMENT';
  end if;

  insert into public.player_forecast_season_queue (
    scope_key, season_id, view_key, team_id, opponent_team_id, fhfh_player_id,
    reasons, status, first_enqueued_at, last_enqueued_at, not_before,
    source_high_watermark, metadata
  ) values (
    p_scope_key, p_season_id, p_view_key, p_team_id, p_opponent_team_id, p_fhfh_player_id,
    array[p_reason], 'pending', p_source_high_watermark, p_source_high_watermark,
    coalesce(p_not_before, p_source_high_watermark + interval '5 minutes'),
    p_source_high_watermark, p_metadata
  )
  on conflict (scope_key) do update
  set team_id = coalesce(excluded.team_id, public.player_forecast_season_queue.team_id),
      opponent_team_id = coalesce(excluded.opponent_team_id, public.player_forecast_season_queue.opponent_team_id),
      fhfh_player_id = coalesce(excluded.fhfh_player_id, public.player_forecast_season_queue.fhfh_player_id),
      reasons = public.player_forecast_season_queue.reasons || excluded.reasons,
      status = case
        when public.player_forecast_season_queue.status = 'running' then 'running'
        else 'pending'
      end,
      last_enqueued_at = greatest(
        public.player_forecast_season_queue.last_enqueued_at,
        excluded.last_enqueued_at
      ),
      not_before = greatest(
        public.player_forecast_season_queue.not_before,
        excluded.not_before
      ),
      source_high_watermark = greatest(
        public.player_forecast_season_queue.source_high_watermark,
        excluded.source_high_watermark
      ),
      metadata = public.player_forecast_season_queue.metadata || excluded.metadata,
      last_error_code = null,
      last_error_summary = null,
      updated_at = now()
  returning * into queued;

  return queued;
end;
$$;

