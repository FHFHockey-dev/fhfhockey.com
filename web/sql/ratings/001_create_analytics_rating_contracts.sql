-- Analytics rating contracts for the three-pillar rollout.
-- This file does three things:
-- 1. Normalizes existing team ratings into a stable analytics-facing view.
-- 2. Creates first-class daily skater offense / skater defense / goalie rating tables.
-- 3. Exposes one union view so ULS/Trends/Sandbox can read a parity-friendly contract.

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE OR REPLACE VIEW analytics.vw_team_ratings_daily AS
SELECT
  t.id AS team_id,
  r.team_abbreviation,
  r.date AS snapshot_date,
  NULL::integer AS season_id,
  r.off_rating AS offense_rating,
  r.def_rating AS defense_rating,
  r.goalie_rating,
  r.special_rating,
  r.pace_rating,
  r.danger_rating,
  r.discipline_rating,
  r.finishing_rating,
  r.trend10,
  r.variance_flag,
  jsonb_build_object(
    'gf60', r.gf60,
    'ga60', r.ga60,
    'xgf60', r.xgf60,
    'xga60', r.xga60,
    'sf60', r.sf60,
    'sa60', r.sa60,
    'pace60', r.pace60,
    'pp_tier', r.pp_tier,
    'pk_tier', r.pk_tier
  ) AS components,
  jsonb_build_object(
    'source_table', 'team_power_ratings_daily',
    'source_contract', 'analytics.vw_team_ratings_daily'
  ) AS provenance,
  COALESCE(r.created_at, NOW()) AS computed_at
FROM public.team_power_ratings_daily r
LEFT JOIN public.teams t
  ON t.abbreviation = r.team_abbreviation;

COMMENT ON VIEW analytics.vw_team_ratings_daily IS
  'Normalized team-rating contract for analytics surfaces. Uses the existing public.team_power_ratings_daily table as source-of-truth.';

CREATE TABLE IF NOT EXISTS public.skater_offensive_ratings_daily (
  snapshot_date DATE NOT NULL,
  season_id INTEGER NOT NULL,
  player_id BIGINT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id SMALLINT NULL REFERENCES public.teams(id),
  rating_0_to_100 DOUBLE PRECISION NOT NULL,
  rating_raw DOUBLE PRECISION NOT NULL,
  league_rank INTEGER NULL,
  percentile DOUBLE PRECISION NULL,
  sample_games INTEGER NULL,
  sample_toi_seconds DOUBLE PRECISION NULL,
  model_name TEXT NOT NULL DEFAULT 'skater_offense_v1',
  model_version TEXT NOT NULL DEFAULT 'v1',
  source_window TEXT NOT NULL DEFAULT 'season_to_date',
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT skater_offensive_ratings_daily_pkey PRIMARY KEY (
    snapshot_date,
    player_id,
    model_name,
    model_version
  ),
  CONSTRAINT skater_offensive_ratings_daily_rating_check
    CHECK (rating_0_to_100 >= 0 AND rating_0_to_100 <= 100),
  CONSTRAINT skater_offensive_ratings_daily_percentile_check
    CHECK (percentile IS NULL OR (percentile >= 0 AND percentile <= 1)),
  CONSTRAINT skater_offensive_ratings_daily_window_check
    CHECK (char_length(source_window) > 0)
);

CREATE INDEX IF NOT EXISTS idx_skater_offensive_ratings_daily_player
  ON public.skater_offensive_ratings_daily (player_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_skater_offensive_ratings_daily_team
  ON public.skater_offensive_ratings_daily (team_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_skater_offensive_ratings_daily_rank
  ON public.skater_offensive_ratings_daily (snapshot_date DESC, league_rank ASC);

COMMENT ON TABLE public.skater_offensive_ratings_daily IS
  'First-class season-to-date skater offensive rating snapshots for ULS and Trends.';

CREATE TABLE IF NOT EXISTS public.skater_defensive_ratings_daily (
  snapshot_date DATE NOT NULL,
  season_id INTEGER NOT NULL,
  player_id BIGINT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id SMALLINT NULL REFERENCES public.teams(id),
  rating_0_to_100 DOUBLE PRECISION NOT NULL,
  rating_raw DOUBLE PRECISION NOT NULL,
  league_rank INTEGER NULL,
  percentile DOUBLE PRECISION NULL,
  sample_games INTEGER NULL,
  sample_toi_seconds DOUBLE PRECISION NULL,
  model_name TEXT NOT NULL DEFAULT 'skater_defense_v1',
  model_version TEXT NOT NULL DEFAULT 'v1',
  source_window TEXT NOT NULL DEFAULT 'season_to_date',
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT skater_defensive_ratings_daily_pkey PRIMARY KEY (
    snapshot_date,
    player_id,
    model_name,
    model_version
  ),
  CONSTRAINT skater_defensive_ratings_daily_rating_check
    CHECK (rating_0_to_100 >= 0 AND rating_0_to_100 <= 100),
  CONSTRAINT skater_defensive_ratings_daily_percentile_check
    CHECK (percentile IS NULL OR (percentile >= 0 AND percentile <= 1)),
  CONSTRAINT skater_defensive_ratings_daily_window_check
    CHECK (char_length(source_window) > 0)
);

CREATE INDEX IF NOT EXISTS idx_skater_defensive_ratings_daily_player
  ON public.skater_defensive_ratings_daily (player_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_skater_defensive_ratings_daily_team
  ON public.skater_defensive_ratings_daily (team_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_skater_defensive_ratings_daily_rank
  ON public.skater_defensive_ratings_daily (snapshot_date DESC, league_rank ASC);

COMMENT ON TABLE public.skater_defensive_ratings_daily IS
  'First-class season-to-date skater defensive rating snapshots for ULS and Trends.';

CREATE TABLE IF NOT EXISTS public.goalie_ratings_daily (
  snapshot_date DATE NOT NULL,
  season_id INTEGER NOT NULL,
  player_id BIGINT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id SMALLINT NULL REFERENCES public.teams(id),
  rating_0_to_100 DOUBLE PRECISION NOT NULL,
  rating_raw DOUBLE PRECISION NOT NULL,
  league_rank INTEGER NULL,
  percentile DOUBLE PRECISION NULL,
  sample_games INTEGER NULL,
  sample_toi_seconds DOUBLE PRECISION NULL,
  model_name TEXT NOT NULL DEFAULT 'goalie_rating_v1',
  model_version TEXT NOT NULL DEFAULT 'v1',
  source_window TEXT NOT NULL DEFAULT 'season_to_date',
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT goalie_ratings_daily_pkey PRIMARY KEY (
    snapshot_date,
    player_id,
    model_name,
    model_version
  ),
  CONSTRAINT goalie_ratings_daily_rating_check
    CHECK (rating_0_to_100 >= 0 AND rating_0_to_100 <= 100),
  CONSTRAINT goalie_ratings_daily_percentile_check
    CHECK (percentile IS NULL OR (percentile >= 0 AND percentile <= 1)),
  CONSTRAINT goalie_ratings_daily_window_check
    CHECK (char_length(source_window) > 0)
);

CREATE INDEX IF NOT EXISTS idx_goalie_ratings_daily_player
  ON public.goalie_ratings_daily (player_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_goalie_ratings_daily_team
  ON public.goalie_ratings_daily (team_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_goalie_ratings_daily_rank
  ON public.goalie_ratings_daily (snapshot_date DESC, league_rank ASC);

COMMENT ON TABLE public.goalie_ratings_daily IS
  'First-class season-to-date goalie rating snapshots for ULS and Trends.';

CREATE OR REPLACE VIEW analytics.vw_entity_ratings_daily AS
SELECT
  'team'::text AS entity_type,
  team_id::bigint AS entity_id,
  team_id,
  NULL::bigint AS player_id,
  snapshot_date,
  season_id,
  team_abbreviation AS team_abbrev,
  offense_rating AS offense_rating_0_to_100,
  defense_rating AS defense_rating_0_to_100,
  goalie_rating AS goalie_rating_0_to_100,
  NULL::double precision AS overall_rating_0_to_100,
  NULL::integer AS league_rank,
  NULL::double precision AS percentile,
  'team_power_ratings_daily'::text AS source_table,
  components,
  provenance,
  computed_at
FROM analytics.vw_team_ratings_daily

UNION ALL

SELECT
  'skater_offense'::text AS entity_type,
  player_id AS entity_id,
  team_id,
  player_id,
  snapshot_date,
  season_id,
  NULL::text AS team_abbrev,
  rating_0_to_100 AS offense_rating_0_to_100,
  NULL::double precision AS defense_rating_0_to_100,
  NULL::double precision AS goalie_rating_0_to_100,
  NULL::double precision AS overall_rating_0_to_100,
  league_rank,
  percentile,
  'skater_offensive_ratings_daily'::text AS source_table,
  components,
  provenance,
  computed_at
FROM public.skater_offensive_ratings_daily

UNION ALL

SELECT
  'skater_defense'::text AS entity_type,
  player_id AS entity_id,
  team_id,
  player_id,
  snapshot_date,
  season_id,
  NULL::text AS team_abbrev,
  NULL::double precision AS offense_rating_0_to_100,
  rating_0_to_100 AS defense_rating_0_to_100,
  NULL::double precision AS goalie_rating_0_to_100,
  NULL::double precision AS overall_rating_0_to_100,
  league_rank,
  percentile,
  'skater_defensive_ratings_daily'::text AS source_table,
  components,
  provenance,
  computed_at
FROM public.skater_defensive_ratings_daily

UNION ALL

SELECT
  'goalie'::text AS entity_type,
  player_id AS entity_id,
  team_id,
  player_id,
  snapshot_date,
  season_id,
  NULL::text AS team_abbrev,
  NULL::double precision AS offense_rating_0_to_100,
  NULL::double precision AS defense_rating_0_to_100,
  rating_0_to_100 AS goalie_rating_0_to_100,
  NULL::double precision AS overall_rating_0_to_100,
  league_rank,
  percentile,
  'goalie_ratings_daily'::text AS source_table,
  components,
  provenance,
  computed_at
FROM public.goalie_ratings_daily;

COMMENT ON VIEW analytics.vw_entity_ratings_daily IS
  'Parity-friendly union contract for team, skater offense, skater defense, and goalie ratings.';
