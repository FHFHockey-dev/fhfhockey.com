-- First-class market odds snapshots for game prediction accountability.
--
-- Rows are append-only source observations. They are eligible as model
-- features only when captured_at is before both the prediction cutoff and puck
-- drop; code-level feature builders enforce that as-of rule.

CREATE TABLE IF NOT EXISTS public.game_prediction_market_odds_snapshots (
  odds_snapshot_id UUID NOT NULL DEFAULT gen_random_uuid(),
  game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  espn_game_id TEXT NULL,
  provider TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  requested_date DATE NOT NULL,
  game_date DATE NOT NULL,
  event_start_at TIMESTAMPTZ NULL,
  home_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  away_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  home_team_abbreviation TEXT NOT NULL,
  away_team_abbreviation TEXT NOT NULL,
  home_moneyline INTEGER NOT NULL,
  away_moneyline INTEGER NOT NULL,
  home_market_no_vig_probability DOUBLE PRECISION NULL,
  away_market_no_vig_probability DOUBLE PRECISION NULL,
  market_overround DOUBLE PRECISION NULL,
  home_spread_line DOUBLE PRECISION NULL,
  home_spread_odds INTEGER NULL,
  away_spread_line DOUBLE PRECISION NULL,
  away_spread_odds INTEGER NULL,
  total_line DOUBLE PRECISION NULL,
  over_odds INTEGER NULL,
  under_odds INTEGER NULL,
  source_url TEXT NOT NULL,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_prediction_market_odds_snapshots_pkey PRIMARY KEY (odds_snapshot_id),
  CONSTRAINT game_prediction_market_odds_snapshots_teams_check
    CHECK (home_team_id <> away_team_id),
  CONSTRAINT game_prediction_market_odds_snapshots_moneyline_check
    CHECK (home_moneyline <> 0 AND away_moneyline <> 0),
  CONSTRAINT game_prediction_market_odds_snapshots_no_vig_check
    CHECK (
      (
        home_market_no_vig_probability IS NULL
        AND away_market_no_vig_probability IS NULL
      )
      OR (
        home_market_no_vig_probability >= 0
        AND home_market_no_vig_probability <= 1
        AND away_market_no_vig_probability >= 0
        AND away_market_no_vig_probability <= 1
        AND abs(
          (home_market_no_vig_probability + away_market_no_vig_probability) - 1
        ) <= 0.00001
      )
    ),
  CONSTRAINT game_prediction_market_odds_snapshots_overround_check
    CHECK (market_overround IS NULL OR market_overround > -0.05),
  CONSTRAINT game_prediction_market_odds_snapshots_provider_check
    CHECK (length(trim(provider)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_game_prediction_market_odds_snapshots_game_capture
  ON public.game_prediction_market_odds_snapshots (game_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_prediction_market_odds_snapshots_provider
  ON public.game_prediction_market_odds_snapshots (
    provider,
    game_date,
    captured_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_game_prediction_market_odds_snapshots_teams_date
  ON public.game_prediction_market_odds_snapshots (
    game_date,
    away_team_id,
    home_team_id,
    captured_at DESC
  );

ALTER TABLE public.game_prediction_market_odds_snapshots ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.game_prediction_market_odds_snapshots IS
  'Append-only pregame market odds observations for prediction baselines, source freshness, and candidate model features.';

COMMENT ON COLUMN public.game_prediction_market_odds_snapshots.captured_at IS
  'Observation time from the ingestion job. Feature builders must require this to be before prediction cutoff and puck drop.';
