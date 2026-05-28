-- Persisted first-class QoT/QoC feature tables.
--
-- v1 postgame rows use raw shift overlap from nhl_api_shift_rows and percentile
-- player ratings. Pregame expected QoT/QoC should use separate freshness-guarded
-- lineup source contracts.

CREATE TABLE IF NOT EXISTS public.nhl_xg_qot_qoc_player_game_features (
  qot_qoc_version text NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  player_id bigint NOT NULL,
  team_id bigint NOT NULL,
  source_scope text NOT NULL,
  feature_availability text NOT NULL,
  rating_snapshot_date date NULL,
  toi_overlap_seconds integer NOT NULL DEFAULT 0,
  qot_offensive_percentile double precision NULL,
  qot_defensive_percentile double precision NULL,
  qoc_offensive_percentile double precision NULL,
  qoc_defensive_percentile double precision NULL,
  teammate_count_weighted double precision NOT NULL DEFAULT 0,
  opponent_count_weighted double precision NOT NULL DEFAULT 0,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (qot_qoc_version, game_id, player_id),
  CONSTRAINT nhl_xg_qot_qoc_player_game_source_scope_check
    CHECK (source_scope IN ('postgame_shift_overlap')),
  CONSTRAINT nhl_xg_qot_qoc_player_game_availability_check
    CHECK (feature_availability IN ('postgame_descriptive', 'pregame_safe_with_freshness'))
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_qot_qoc_player_game_player_date
  ON public.nhl_xg_qot_qoc_player_game_features (
    player_id,
    game_date DESC,
    qot_qoc_version
  );

CREATE TABLE IF NOT EXISTS public.nhl_xg_qot_qoc_unit_game_features (
  qot_qoc_version text NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  team_id bigint NOT NULL,
  unit_type text NOT NULL,
  unit_key text NOT NULL,
  player_ids bigint[] NOT NULL,
  source_scope text NOT NULL,
  feature_availability text NOT NULL,
  rating_snapshot_date date NULL,
  toi_overlap_seconds integer NOT NULL DEFAULT 0,
  unit_offensive_percentile double precision NULL,
  unit_defensive_percentile double precision NULL,
  qoc_offensive_percentile double precision NULL,
  qoc_defensive_percentile double precision NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (qot_qoc_version, game_id, team_id, unit_type, unit_key),
  CONSTRAINT nhl_xg_qot_qoc_unit_game_unit_type_check
    CHECK (unit_type IN ('line', 'pair')),
  CONSTRAINT nhl_xg_qot_qoc_unit_game_source_scope_check
    CHECK (source_scope IN ('postgame_shift_overlap')),
  CONSTRAINT nhl_xg_qot_qoc_unit_game_availability_check
    CHECK (feature_availability IN ('postgame_descriptive', 'pregame_safe_with_freshness'))
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_qot_qoc_unit_game_team_date
  ON public.nhl_xg_qot_qoc_unit_game_features (
    team_id,
    game_date DESC,
    unit_type,
    qot_qoc_version
  );

CREATE TABLE IF NOT EXISTS public.nhl_xg_qot_qoc_player_rolling_features (
  qot_qoc_version text NOT NULL,
  season_id bigint NULL,
  player_id bigint NOT NULL,
  team_id bigint NOT NULL,
  as_of_game_id bigint NOT NULL,
  as_of_game_date date NULL,
  window_games integer NOT NULL,
  games_count integer NOT NULL DEFAULT 0,
  source_scope text NOT NULL,
  feature_availability text NOT NULL,
  rating_snapshot_date date NULL,
  toi_overlap_seconds integer NOT NULL DEFAULT 0,
  qot_offensive_percentile double precision NULL,
  qot_defensive_percentile double precision NULL,
  qoc_offensive_percentile double precision NULL,
  qoc_defensive_percentile double precision NULL,
  teammate_count_weighted double precision NOT NULL DEFAULT 0,
  opponent_count_weighted double precision NOT NULL DEFAULT 0,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (qot_qoc_version, player_id, as_of_game_id, window_games),
  CONSTRAINT nhl_xg_qot_qoc_player_rolling_source_scope_check
    CHECK (source_scope IN ('postgame_shift_overlap')),
  CONSTRAINT nhl_xg_qot_qoc_player_rolling_availability_check
    CHECK (feature_availability IN ('postgame_descriptive', 'pregame_safe_with_freshness'))
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_qot_qoc_player_rolling_player_date
  ON public.nhl_xg_qot_qoc_player_rolling_features (
    player_id,
    as_of_game_date DESC,
    window_games,
    qot_qoc_version
  );

COMMENT ON TABLE public.nhl_xg_qot_qoc_player_game_features IS
  'Player-game QoT/QoC features from postgame raw shift overlap and player percentile ratings.';

COMMENT ON TABLE public.nhl_xg_qot_qoc_unit_game_features IS
  'Line/pair game QoT/QoC features from postgame raw shift overlap and player percentile ratings.';

COMMENT ON TABLE public.nhl_xg_qot_qoc_player_rolling_features IS
  'Player rolling-window QoT/QoC features with postgame source and leakage metadata.';
