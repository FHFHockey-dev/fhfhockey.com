-- Analytics contracts for trends, sustainability expansion, predictions,
-- market comparisons, and source provenance/freshness.

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS public.entity_trend_snapshots_daily (
  snapshot_date DATE NOT NULL,
  season_id INTEGER NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  team_id SMALLINT NULL REFERENCES public.teams(id),
  player_id BIGINT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  window_code TEXT NOT NULL,
  recent_value DOUBLE PRECISION NULL,
  baseline_value DOUBLE PRECISION NULL,
  delta_value DOUBLE PRECISION NULL,
  slope_value DOUBLE PRECISION NULL,
  trend_score_0_to_100 DOUBLE PRECISION NULL,
  trend_rank INTEGER NULL,
  percentile DOUBLE PRECISION NULL,
  history_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entity_trend_snapshots_daily_pkey PRIMARY KEY (
    snapshot_date,
    entity_type,
    entity_id,
    metric_key,
    window_code
  ),
  CONSTRAINT entity_trend_snapshots_daily_entity_type_check
    CHECK (entity_type = ANY (ARRAY['team'::text, 'skater'::text, 'goalie'::text])),
  CONSTRAINT entity_trend_snapshots_daily_window_check
    CHECK (char_length(window_code) > 0),
  CONSTRAINT entity_trend_snapshots_daily_metric_check
    CHECK (char_length(metric_key) > 0),
  CONSTRAINT entity_trend_snapshots_daily_percentile_check
    CHECK (percentile IS NULL OR (percentile >= 0 AND percentile <= 1)),
  CONSTRAINT entity_trend_snapshots_daily_trend_score_check
    CHECK (
      trend_score_0_to_100 IS NULL
      OR (trend_score_0_to_100 >= 0 AND trend_score_0_to_100 <= 100)
    )
);

CREATE INDEX IF NOT EXISTS idx_entity_trend_snapshots_daily_entity
  ON public.entity_trend_snapshots_daily (
    entity_type,
    entity_id,
    snapshot_date DESC
  );

CREATE INDEX IF NOT EXISTS idx_entity_trend_snapshots_daily_metric
  ON public.entity_trend_snapshots_daily (
    snapshot_date DESC,
    entity_type,
    metric_key,
    window_code
  );

COMMENT ON TABLE public.entity_trend_snapshots_daily IS
  'Parity-friendly trend snapshots for teams, skaters, and goalies used by /trends.';

CREATE TABLE IF NOT EXISTS public.entity_sustainability_scores_daily (
  snapshot_date DATE NOT NULL,
  season_id INTEGER NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  team_id SMALLINT NULL REFERENCES public.teams(id),
  player_id BIGINT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  metric_scope TEXT NOT NULL DEFAULT 'overall',
  window_code TEXT NOT NULL,
  baseline_value DOUBLE PRECISION NULL,
  recent_value DOUBLE PRECISION NULL,
  expected_value DOUBLE PRECISION NULL,
  z_score DOUBLE PRECISION NULL,
  s_raw DOUBLE PRECISION NOT NULL,
  s_100 DOUBLE PRECISION NOT NULL,
  expectation_state TEXT NOT NULL,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entity_sustainability_scores_daily_pkey PRIMARY KEY (
    snapshot_date,
    entity_type,
    entity_id,
    metric_scope,
    window_code
  ),
  CONSTRAINT entity_sustainability_scores_daily_entity_type_check
    CHECK (entity_type = ANY (ARRAY['team'::text, 'skater'::text, 'goalie'::text])),
  CONSTRAINT entity_sustainability_scores_daily_state_check
    CHECK (
      expectation_state = ANY (
        ARRAY['overperforming'::text, 'stable'::text, 'underperforming'::text]
      )
    ),
  CONSTRAINT entity_sustainability_scores_daily_score_check
    CHECK (s_100 >= 0 AND s_100 <= 100)
);

CREATE INDEX IF NOT EXISTS idx_entity_sustainability_scores_daily_entity
  ON public.entity_sustainability_scores_daily (
    entity_type,
    entity_id,
    snapshot_date DESC
  );

COMMENT ON TABLE public.entity_sustainability_scores_daily IS
  'Cross-entity sustainability scores for teams, skaters, and goalies.';

CREATE TABLE IF NOT EXISTS public.entity_sustainability_bands_daily (
  snapshot_date DATE NOT NULL,
  season_id INTEGER NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  team_id SMALLINT NULL REFERENCES public.teams(id),
  player_id BIGINT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  window_code TEXT NOT NULL,
  baseline DOUBLE PRECISION NULL,
  ewma DOUBLE PRECISION NULL,
  value DOUBLE PRECISION NOT NULL,
  ci_lower DOUBLE PRECISION NOT NULL,
  ci_upper DOUBLE PRECISION NOT NULL,
  z_score DOUBLE PRECISION NULL,
  percentile DOUBLE PRECISION NULL,
  exposure DOUBLE PRECISION NULL,
  distribution JSONB NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entity_sustainability_bands_daily_pkey PRIMARY KEY (
    snapshot_date,
    entity_type,
    entity_id,
    metric_key,
    window_code
  ),
  CONSTRAINT entity_sustainability_bands_daily_entity_type_check
    CHECK (entity_type = ANY (ARRAY['team'::text, 'skater'::text, 'goalie'::text])),
  CONSTRAINT entity_sustainability_bands_daily_band_check
    CHECK (ci_lower <= ci_upper)
);

COMMENT ON TABLE public.entity_sustainability_bands_daily IS
  'Cross-entity sustainability threshold bands for teams, skaters, and goalies.';

CREATE TABLE IF NOT EXISTS public.game_prediction_outputs (
  snapshot_date DATE NOT NULL,
  game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prediction_scope TEXT NOT NULL DEFAULT 'pregame',
  home_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  away_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  home_win_probability DOUBLE PRECISION NULL,
  away_win_probability DOUBLE PRECISION NULL,
  home_expected_goals DOUBLE PRECISION NULL,
  away_expected_goals DOUBLE PRECISION NULL,
  total_expected_goals DOUBLE PRECISION NULL,
  spread_projection DOUBLE PRECISION NULL,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_prediction_outputs_pkey PRIMARY KEY (
    snapshot_date,
    game_id,
    model_name,
    model_version,
    prediction_scope
  ),
  CONSTRAINT game_prediction_outputs_scope_check
    CHECK (prediction_scope = ANY (ARRAY['pregame'::text, 'in_game'::text]))
);

COMMENT ON TABLE public.game_prediction_outputs IS
  'Model outputs for game-level probabilities and expected results.';

CREATE TABLE IF NOT EXISTS public.player_prediction_outputs (
  snapshot_date DATE NOT NULL,
  game_id BIGINT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id SMALLINT NULL REFERENCES public.teams(id),
  opponent_team_id SMALLINT NULL REFERENCES public.teams(id),
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prediction_scope TEXT NOT NULL DEFAULT 'pregame',
  metric_key TEXT NOT NULL,
  expected_value DOUBLE PRECISION NULL,
  floor_value DOUBLE PRECISION NULL,
  ceiling_value DOUBLE PRECISION NULL,
  probability_over DOUBLE PRECISION NULL,
  line_value DOUBLE PRECISION NULL,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_prediction_outputs_pkey PRIMARY KEY (
    snapshot_date,
    player_id,
    model_name,
    model_version,
    prediction_scope,
    metric_key,
    game_id
  ),
  CONSTRAINT player_prediction_outputs_scope_check
    CHECK (prediction_scope = ANY (ARRAY['pregame'::text, 'daily'::text, 'rolling'::text]))
);

COMMENT ON TABLE public.player_prediction_outputs IS
  'Model outputs for player-level projection and prop-ready expectations.';

CREATE TABLE IF NOT EXISTS public.market_prices_daily (
  snapshot_date DATE NOT NULL,
  game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  market_type TEXT NOT NULL,
  sportsbook_key TEXT NOT NULL,
  outcome_key TEXT NOT NULL,
  line_value DOUBLE PRECISION NULL,
  price_american INTEGER NULL,
  implied_probability DOUBLE PRECISION NULL,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_rank SMALLINT NOT NULL DEFAULT 1,
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  source_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  freshness_expires_at TIMESTAMPTZ NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT market_prices_daily_pkey PRIMARY KEY (
    snapshot_date,
    game_id,
    market_type,
    sportsbook_key,
    outcome_key
  ),
  CONSTRAINT market_prices_daily_probability_check
    CHECK (
      implied_probability IS NULL OR (implied_probability >= 0 AND implied_probability <= 1)
    )
);

COMMENT ON TABLE public.market_prices_daily IS
  'Game-level market prices and lines with source freshness metadata.';

CREATE TABLE IF NOT EXISTS public.prop_market_prices_daily (
  snapshot_date DATE NOT NULL,
  game_id BIGINT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  market_type TEXT NOT NULL,
  sportsbook_key TEXT NOT NULL,
  outcome_key TEXT NOT NULL,
  line_value DOUBLE PRECISION NULL,
  price_american INTEGER NULL,
  implied_probability DOUBLE PRECISION NULL,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_rank SMALLINT NOT NULL DEFAULT 1,
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  source_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  freshness_expires_at TIMESTAMPTZ NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prop_market_prices_daily_pkey PRIMARY KEY (
    snapshot_date,
    player_id,
    market_type,
    sportsbook_key,
    outcome_key,
    game_id
  ),
  CONSTRAINT prop_market_prices_daily_probability_check
    CHECK (
      implied_probability IS NULL OR (implied_probability >= 0 AND implied_probability <= 1)
    )
);

COMMENT ON TABLE public.prop_market_prices_daily IS
  'Player prop prices with sportsbook provenance and freshness fields.';

CREATE TABLE IF NOT EXISTS public.model_market_flags_daily (
  snapshot_date DATE NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  game_id BIGINT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  market_type TEXT NOT NULL,
  sportsbook_key TEXT NULL,
  flag_type TEXT NOT NULL,
  edge_value DOUBLE PRECISION NULL,
  confidence_0_to_100 DOUBLE PRECISION NULL,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT model_market_flags_daily_pkey PRIMARY KEY (
    snapshot_date,
    entity_type,
    entity_id,
    model_name,
    model_version,
    market_type,
    flag_type,
    game_id
  ),
  CONSTRAINT model_market_flags_daily_entity_type_check
    CHECK (entity_type = ANY (ARRAY['game'::text, 'player'::text, 'team'::text])),
  CONSTRAINT model_market_flags_daily_confidence_check
    CHECK (
      confidence_0_to_100 IS NULL
      OR (confidence_0_to_100 >= 0 AND confidence_0_to_100 <= 100)
    )
);

COMMENT ON TABLE public.model_market_flags_daily IS
  'Model-vs-market edge flags for game and player surfaces.';

CREATE TABLE IF NOT EXISTS public.source_provenance_snapshots (
  snapshot_date DATE NOT NULL,
  source_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id BIGINT NOT NULL,
  game_id BIGINT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_url TEXT NULL,
  source_rank SMALLINT NOT NULL DEFAULT 1,
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'observed',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  freshness_expires_at TIMESTAMPTZ NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT source_provenance_snapshots_pkey PRIMARY KEY (
    snapshot_date,
    source_type,
    entity_type,
    entity_id,
    source_name,
    game_id
  ),
  CONSTRAINT source_provenance_snapshots_entity_type_check
    CHECK (
      entity_type = ANY (
        ARRAY['team'::text, 'player'::text, 'goalie'::text, 'game'::text]
      )
    ),
  CONSTRAINT source_provenance_snapshots_status_check
    CHECK (
      status = ANY (
        ARRAY['observed'::text, 'stale'::text, 'superseded'::text, 'rejected'::text]
      )
    )
);

COMMENT ON TABLE public.source_provenance_snapshots IS
  'Normalized source/freshness registry for lineups, goalie starts, injuries, odds, props, and model inputs.';

CREATE OR REPLACE VIEW analytics.vw_entity_sustainability_scores AS
SELECT
  'skater'::text AS entity_type,
  s.player_id AS entity_id,
  NULL::smallint AS team_id,
  s.player_id,
  s.snapshot_date,
  s.season_id,
  'overall'::text AS metric_scope,
  s.window_code,
  NULL::double precision AS baseline_value,
  NULL::double precision AS recent_value,
  NULL::double precision AS expected_value,
  NULL::double precision AS z_score,
  s.s_raw,
  s.s_100,
  CASE
    WHEN s.s_raw >= 0.75 THEN 'overperforming'
    WHEN s.s_raw <= -0.75 THEN 'underperforming'
    ELSE 'stable'
  END AS expectation_state,
  s.components,
  '{}'::jsonb AS provenance,
  s.computed_at
FROM public.sustainability_scores s

UNION ALL

SELECT
  entity_type,
  entity_id,
  team_id,
  player_id,
  snapshot_date,
  season_id,
  metric_scope,
  window_code,
  baseline_value,
  recent_value,
  expected_value,
  z_score,
  s_raw,
  s_100,
  expectation_state,
  components,
  provenance,
  computed_at
FROM public.entity_sustainability_scores_daily;

COMMENT ON VIEW analytics.vw_entity_sustainability_scores IS
  'Bridge view that keeps existing skater sustainability scores readable while new cross-entity contracts come online.';
