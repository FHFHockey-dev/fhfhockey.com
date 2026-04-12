create table if not exists public.team_underlying_stats_summary (
  game_id bigint not null,
  season_id integer not null,
  game_type integer not null,
  game_date date not null,
  team_id integer not null,
  opponent_team_id integer not null,
  venue text not null,
  is_home boolean not null,
  strength text not null,
  score_state text not null,
  toi_seconds integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  otl integer not null default 0,
  row_wins integer not null default 0,
  points integer not null default 0,
  cf integer not null default 0,
  ca integer not null default 0,
  ff integer not null default 0,
  fa integer not null default 0,
  sf integer not null default 0,
  sa integer not null default 0,
  gf integer not null default 0,
  ga integer not null default 0,
  xgf double precision not null default 0,
  xga double precision not null default 0,
  scf integer not null default 0,
  sca integer not null default 0,
  scsf integer not null default 0,
  scsa integer not null default 0,
  scgf integer not null default 0,
  scga integer not null default 0,
  hdcf integer not null default 0,
  hdca integer not null default 0,
  hdsf integer not null default 0,
  hdsa integer not null default 0,
  hdgf integer not null default 0,
  hdga integer not null default 0,
  mdcf integer not null default 0,
  mdca integer not null default 0,
  mdsf integer not null default 0,
  mdsa integer not null default 0,
  mdgf integer not null default 0,
  mdga integer not null default 0,
  ldcf integer not null default 0,
  ldca integer not null default 0,
  ldsf integer not null default 0,
  ldsa integer not null default 0,
  ldgf integer not null default 0,
  ldga integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_underlying_stats_summary_venue_check
    check (venue in ('home', 'away')),
  constraint team_underlying_stats_summary_pkey
    primary key (game_id, team_id, strength, score_state)
);

create index if not exists team_underlying_stats_summary_season_idx
  on public.team_underlying_stats_summary (season_id, game_type, game_date desc);

create index if not exists team_underlying_stats_summary_team_filters_idx
  on public.team_underlying_stats_summary (
    team_id,
    season_id,
    game_type,
    strength,
    score_state,
    venue,
    game_date desc
  );

create index if not exists team_underlying_stats_summary_opponent_filters_idx
  on public.team_underlying_stats_summary (
    opponent_team_id,
    season_id,
    game_type,
    strength,
    score_state,
    venue,
    game_date desc
  );

create index if not exists team_underlying_stats_summary_strength_state_idx
  on public.team_underlying_stats_summary (
    strength,
    score_state,
    season_id,
    game_type,
    game_date desc
  );