-- Game prediction model contracts.
--
-- These tables complement the existing latest-serving tables
-- (`game_prediction_outputs`, `player_prediction_outputs`) with append-only
-- history, immutable feature snapshots, model version metadata, and segmented
-- evaluation metrics.

CREATE TABLE IF NOT EXISTS public.game_prediction_feature_snapshots (
  feature_snapshot_id UUID NOT NULL DEFAULT gen_random_uuid(),
  game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  prediction_scope TEXT NOT NULL DEFAULT 'pregame',
  prediction_cutoff_at TIMESTAMPTZ NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_set_version TEXT NOT NULL,
  home_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  away_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  source_cutoffs JSONB NOT NULL DEFAULT '{}'::jsonb,
  feature_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  fallback_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_prediction_feature_snapshots_pkey PRIMARY KEY (feature_snapshot_id),
  CONSTRAINT game_prediction_feature_snapshots_scope_check
    CHECK (prediction_scope = ANY (ARRAY['pregame'::text, 'in_game'::text])),
  CONSTRAINT game_prediction_feature_snapshots_teams_check
    CHECK (home_team_id <> away_team_id),
  CONSTRAINT game_prediction_feature_snapshots_cutoff_check
    CHECK (computed_at >= prediction_cutoff_at)
);

CREATE INDEX IF NOT EXISTS idx_game_prediction_feature_snapshots_game_cutoff
  ON public.game_prediction_feature_snapshots (game_id, prediction_cutoff_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_prediction_feature_snapshots_model
  ON public.game_prediction_feature_snapshots (
    model_name,
    model_version,
    feature_set_version,
    snapshot_date DESC
  );

COMMENT ON TABLE public.game_prediction_feature_snapshots IS
  'Immutable game-prediction feature payloads, source cutoffs, and fallback metadata captured before prediction persistence.';

CREATE TABLE IF NOT EXISTS public.game_prediction_history (
  prediction_id UUID NOT NULL DEFAULT gen_random_uuid(),
  feature_snapshot_id UUID NOT NULL REFERENCES public.game_prediction_feature_snapshots(feature_snapshot_id) ON DELETE RESTRICT,
  run_id UUID NULL REFERENCES public.forge_runs(run_id),
  snapshot_date DATE NOT NULL,
  game_id BIGINT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  prediction_scope TEXT NOT NULL DEFAULT 'pregame',
  prediction_cutoff_at TIMESTAMPTZ NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_set_version TEXT NOT NULL,
  home_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  away_team_id SMALLINT NOT NULL REFERENCES public.teams(id),
  home_win_probability DOUBLE PRECISION NOT NULL,
  away_win_probability DOUBLE PRECISION NOT NULL,
  home_expected_goals DOUBLE PRECISION NULL,
  away_expected_goals DOUBLE PRECISION NULL,
  total_expected_goals DOUBLE PRECISION NULL,
  spread_projection DOUBLE PRECISION NULL,
  predicted_winner_team_id SMALLINT NULL REFERENCES public.teams(id),
  confidence_label TEXT NULL,
  top_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_prediction_history_pkey PRIMARY KEY (prediction_id),
  CONSTRAINT game_prediction_history_scope_check
    CHECK (prediction_scope = ANY (ARRAY['pregame'::text, 'in_game'::text])),
  CONSTRAINT game_prediction_history_probability_check
    CHECK (
      home_win_probability >= 0
      AND home_win_probability <= 1
      AND away_win_probability >= 0
      AND away_win_probability <= 1
      AND abs((home_win_probability + away_win_probability) - 1) <= 0.000001
    ),
  CONSTRAINT game_prediction_history_teams_check
    CHECK (home_team_id <> away_team_id),
  CONSTRAINT game_prediction_history_winner_check
    CHECK (
      predicted_winner_team_id IS NULL
      OR predicted_winner_team_id = home_team_id
      OR predicted_winner_team_id = away_team_id
    ),
  CONSTRAINT game_prediction_history_cutoff_check
    CHECK (computed_at >= prediction_cutoff_at)
);

CREATE INDEX IF NOT EXISTS idx_game_prediction_history_latest_public
  ON public.game_prediction_history (
    game_id,
    prediction_scope,
    model_name,
    model_version,
    computed_at DESC
  )
  WHERE is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_game_prediction_history_model_date
  ON public.game_prediction_history (
    model_name,
    model_version,
    feature_set_version,
    snapshot_date DESC
  );

CREATE INDEX IF NOT EXISTS idx_game_prediction_history_run
  ON public.game_prediction_history (run_id)
  WHERE run_id IS NOT NULL;

COMMENT ON TABLE public.game_prediction_history IS
  'Append-only game-prediction history for honest backtests, repeated same-day pregame refreshes, and model evaluation.';

CREATE TABLE IF NOT EXISTS public.game_prediction_model_versions (
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_set_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate',
  algorithm TEXT NOT NULL,
  training_run_id UUID NULL REFERENCES public.forge_runs(run_id),
  trained_at TIMESTAMPTZ NULL,
  training_start_date DATE NULL,
  training_end_date DATE NULL,
  validation_start_date DATE NULL,
  validation_end_date DATE NULL,
  promoted_at TIMESTAMPTZ NULL,
  retired_at TIMESTAMPTZ NULL,
  git_sha TEXT NULL,
  hyperparameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  training_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  calibration_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_audit_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_prediction_model_versions_pkey PRIMARY KEY (
    model_name,
    model_version,
    feature_set_version
  ),
  CONSTRAINT game_prediction_model_versions_status_check
    CHECK (status = ANY (ARRAY['candidate'::text, 'production'::text, 'retired'::text, 'rejected'::text])),
  CONSTRAINT game_prediction_model_versions_dates_check
    CHECK (
      training_start_date IS NULL
      OR training_end_date IS NULL
      OR training_start_date <= training_end_date
    )
);

CREATE INDEX IF NOT EXISTS idx_game_prediction_model_versions_status
  ON public.game_prediction_model_versions (status, model_name, model_version);

COMMENT ON TABLE public.game_prediction_model_versions IS
  'Game-prediction model/version metadata, promotion state, training windows, and validation summaries.';

CREATE TABLE IF NOT EXISTS public.game_prediction_model_metrics (
  metric_id UUID NOT NULL DEFAULT gen_random_uuid(),
  run_id UUID NULL REFERENCES public.forge_runs(run_id),
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  feature_set_version TEXT NOT NULL,
  evaluation_start_date DATE NOT NULL,
  evaluation_end_date DATE NOT NULL,
  segment_key TEXT NOT NULL DEFAULT 'overall',
  segment_value TEXT NOT NULL DEFAULT 'all',
  evaluated_games INTEGER NOT NULL,
  log_loss DOUBLE PRECISION NULL,
  brier_score DOUBLE PRECISION NULL,
  accuracy DOUBLE PRECISION NULL,
  auc DOUBLE PRECISION NULL,
  calibration JSONB NOT NULL DEFAULT '{}'::jsonb,
  coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_prediction_model_metrics_pkey PRIMARY KEY (metric_id),
  CONSTRAINT game_prediction_model_metrics_model_fkey
    FOREIGN KEY (model_name, model_version, feature_set_version)
    REFERENCES public.game_prediction_model_versions (
      model_name,
      model_version,
      feature_set_version
    )
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT game_prediction_model_metrics_window_check
    CHECK (evaluation_start_date <= evaluation_end_date),
  CONSTRAINT game_prediction_model_metrics_games_check
    CHECK (evaluated_games >= 0),
  CONSTRAINT game_prediction_model_metrics_probability_metric_check
    CHECK (
      (brier_score IS NULL OR brier_score >= 0)
      AND (log_loss IS NULL OR log_loss >= 0)
      AND (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 1))
      AND (auc IS NULL OR (auc >= 0 AND auc <= 1))
    ),
  CONSTRAINT game_prediction_model_metrics_unique_segment UNIQUE (
    model_name,
    model_version,
    feature_set_version,
    evaluation_start_date,
    evaluation_end_date,
    segment_key,
    segment_value
  )
);

CREATE INDEX IF NOT EXISTS idx_game_prediction_model_metrics_model_window
  ON public.game_prediction_model_metrics (
    model_name,
    model_version,
    feature_set_version,
    evaluation_end_date DESC
  );

COMMENT ON TABLE public.game_prediction_model_metrics IS
  'Segmented game-prediction evaluation metrics by model, feature set, date range, and segment.';
