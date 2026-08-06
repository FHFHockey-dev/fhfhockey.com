create table public.player_forecast_rest_of_season_outputs (
  id uuid primary key default gen_random_uuid(),
  model_artifact_id uuid not null references public.player_forecast_model_artifacts(id),
  season_id bigint not null,
  team_id bigint not null references public.teams(id),
  player_id bigint not null references public.players(id),
  population text not null check (population in ('forward', 'defense', 'goalie')),
  target_key text not null,
  conditioning text not null check (conditioning in ('conditional_playing', 'conditional_start', 'unconditional')),
  cutoff_at timestamptz not null,
  issued_at timestamptz not null,
  schedule_revision_hash text not null,
  remaining_games integer not null check (remaining_games > 0),
  season_to_date_actual numeric not null default 0,
  point_estimate numeric not null check (point_estimate >= 0),
  variance numeric not null check (variance >= 0),
  distribution_kind text not null,
  distribution jsonb not null,
  quantiles jsonb not null,
  component_manifest jsonb not null,
  source_high_watermark timestamptz not null,
  fallback_flags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  unique (
    model_artifact_id,
    player_id,
    target_key,
    conditioning,
    cutoff_at,
    schedule_revision_hash
  ),
  check (btrim(target_key) <> ''),
  check (btrim(schedule_revision_hash) <> ''),
  check (btrim(distribution_kind) <> ''),
  check (jsonb_typeof(quantiles) = 'object'),
  check (jsonb_typeof(component_manifest) = 'array'),
  check (jsonb_array_length(component_manifest) = remaining_games)
);

create index player_forecast_ros_player_history_idx
  on public.player_forecast_rest_of_season_outputs
  (player_id, target_key, conditioning, issued_at desc);
create index player_forecast_ros_team_id_idx
  on public.player_forecast_rest_of_season_outputs (team_id);

alter table public.player_forecast_rest_of_season_outputs enable row level security;
alter table public.player_forecast_rest_of_season_outputs force row level security;

revoke all on table public.player_forecast_rest_of_season_outputs
  from public, anon, authenticated, service_role;
grant select, insert on table public.player_forecast_rest_of_season_outputs
  to service_role;

comment on table public.player_forecast_rest_of_season_outputs is
  'Immutable conditional or unconditional rest-of-season aggregates. Components, schedule identity, and tail fallback provenance remain auditable; full-season display adds season-to-date actuals without redefining raw targets.';
