-- Game prediction accountability and walk-forward backtest contracts.
--
-- These tables make model accountability auditable without mutating the live
-- serving table. The dashboard can also derive the same shapes directly from
-- game_prediction_history when these tables are not populated yet.

CREATE TABLE IF NOT EXISTS public.game_prediction_backtest_runs (
  backtest_run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_set_version TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  training_start_date DATE NOT NULL,
  training_end_date DATE NOT NULL,
  replay_start_date DATE NOT NULL,
  replay_end_date DATE NOT NULL,
  training_games INTEGER NOT NULL,
  replay_games INTEGER NOT NULL,
  retrain_cadence_games INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'completed',
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_artifacts JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_prediction_backtest_runs_pkey PRIMARY KEY (backtest_run_id),
  CONSTRAINT game_prediction_backtest_runs_model_fkey
    FOREIGN KEY (model_name, model_version, feature_set_version)
    REFERENCES public.game_prediction_model_versions (
      model_name,
      model_version,
      feature_set_version
    )
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT game_prediction_backtest_runs_status_check
    CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])),
  CONSTRAINT game_prediction_backtest_runs_window_check
    CHECK (
      training_start_date <= training_end_date
      AND replay_start_date <= replay_end_date
      AND training_end_date < replay_start_date
    ),
  CONSTRAINT game_prediction_backtest_runs_count_check
    CHECK (training_games >= 0 AND replay_games >= 0 AND retrain_cadence_games > 0)
);

CREATE INDEX IF NOT EXISTS idx_game_prediction_backtest_runs_model_season
  ON public.game_prediction_backtest_runs (
    model_name,
    model_version,
    feature_set_version,
    season_id,
    completed_at DESC
  );

CREATE TABLE IF NOT EXISTS public.game_prediction_accountability_games (
  accountability_game_id UUID NOT NULL DEFAULT gen_random_uuid(),
  backtest_run_id UUID NULL REFERENCES public.game_prediction_backtest_runs(backtest_run_id) ON DELETE CASCADE,
  prediction_id UUID NULL REFERENCES public.game_prediction_history(prediction_id) ON DELETE SET NULL,
  game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_set_version TEXT NOT NULL,
  home_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  away_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  open_home_win_probability DOUBLE PRECISION NOT NULL,
  low_home_win_probability DOUBLE PRECISION NOT NULL,
  high_home_win_probability DOUBLE PRECISION NOT NULL,
  final_home_win_probability DOUBLE PRECISION NOT NULL,
  actual_home_win_probability DOUBLE PRECISION NOT NULL,
  prediction_count INTEGER NOT NULL,
  predicted_winner_team_id SMALLINT NULL REFERENCES public.teams(id),
  actual_winner_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  predicted_winner_correct BOOLEAN NOT NULL,
  home_score SMALLINT NOT NULL,
  away_score SMALLINT NOT NULL,
  probability_spread DOUBLE PRECISION NOT NULL,
  final_prediction_cutoff_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_prediction_accountability_games_pkey PRIMARY KEY (accountability_game_id),
  CONSTRAINT game_prediction_accountability_games_model_fkey
    FOREIGN KEY (model_name, model_version, feature_set_version)
    REFERENCES public.game_prediction_model_versions (
      model_name,
      model_version,
      feature_set_version
    )
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT game_prediction_accountability_games_probability_check
    CHECK (
      open_home_win_probability >= 0 AND open_home_win_probability <= 1
      AND low_home_win_probability >= 0 AND low_home_win_probability <= 1
      AND high_home_win_probability >= 0 AND high_home_win_probability <= 1
      AND final_home_win_probability >= 0 AND final_home_win_probability <= 1
      AND actual_home_win_probability IN (0, 1)
      AND low_home_win_probability <= high_home_win_probability
      AND probability_spread >= 0
    ),
  CONSTRAINT game_prediction_accountability_games_prediction_count_check
    CHECK (prediction_count > 0),
  CONSTRAINT game_prediction_accountability_games_winner_check
    CHECK (
      actual_winner_team_id = home_team_id
      OR actual_winner_team_id = away_team_id
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_prediction_accountability_games_live_unique
  ON public.game_prediction_accountability_games (
    game_id,
    model_name,
    model_version,
    feature_set_version
  )
  WHERE backtest_run_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_prediction_accountability_games_backtest_unique
  ON public.game_prediction_accountability_games (
    backtest_run_id,
    game_id,
    model_name,
    model_version,
    feature_set_version
  )
  WHERE backtest_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_game_prediction_accountability_games_model_date
  ON public.game_prediction_accountability_games (
    model_name,
    model_version,
    feature_set_version,
    snapshot_date
  );

CREATE TABLE IF NOT EXISTS public.game_prediction_accountability_daily (
  accountability_daily_id UUID NOT NULL DEFAULT gen_random_uuid(),
  backtest_run_id UUID NULL REFERENCES public.game_prediction_backtest_runs(backtest_run_id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_set_version TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  evaluated_games INTEGER NOT NULL,
  correct_games INTEGER NOT NULL,
  wrong_games INTEGER NOT NULL,
  cumulative_accuracy DOUBLE PRECISION NULL,
  rolling_10_accuracy DOUBLE PRECISION NULL,
  rolling_25_accuracy DOUBLE PRECISION NULL,
  rolling_50_accuracy DOUBLE PRECISION NULL,
  brier_score DOUBLE PRECISION NULL,
  log_loss DOUBLE PRECISION NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_prediction_accountability_daily_pkey PRIMARY KEY (accountability_daily_id),
  CONSTRAINT game_prediction_accountability_daily_model_fkey
    FOREIGN KEY (model_name, model_version, feature_set_version)
    REFERENCES public.game_prediction_model_versions (
      model_name,
      model_version,
      feature_set_version
    )
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT game_prediction_accountability_daily_count_check
    CHECK (
      evaluated_games >= 0
      AND correct_games >= 0
      AND wrong_games >= 0
      AND correct_games + wrong_games = evaluated_games
    ),
  CONSTRAINT game_prediction_accountability_daily_metric_check
    CHECK (
      (cumulative_accuracy IS NULL OR (cumulative_accuracy >= 0 AND cumulative_accuracy <= 1))
      AND (rolling_10_accuracy IS NULL OR (rolling_10_accuracy >= 0 AND rolling_10_accuracy <= 1))
      AND (rolling_25_accuracy IS NULL OR (rolling_25_accuracy >= 0 AND rolling_25_accuracy <= 1))
      AND (rolling_50_accuracy IS NULL OR (rolling_50_accuracy >= 0 AND rolling_50_accuracy <= 1))
      AND (brier_score IS NULL OR brier_score >= 0)
      AND (log_loss IS NULL OR log_loss >= 0)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_prediction_accountability_daily_live_unique
  ON public.game_prediction_accountability_daily (
    model_name,
    model_version,
    feature_set_version,
    as_of_date
  )
  WHERE backtest_run_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_prediction_accountability_daily_backtest_unique
  ON public.game_prediction_accountability_daily (
    backtest_run_id,
    model_name,
    model_version,
    feature_set_version,
    as_of_date
  )
  WHERE backtest_run_id IS NOT NULL;
