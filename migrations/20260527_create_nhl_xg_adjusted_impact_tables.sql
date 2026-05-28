-- Persisted adjusted-impact baseline outputs.
--
-- v1 fits a regularized linear baseline over sparse on-ice shot-xG design rows.
-- It is intentionally a baseline before fuller RAPM variants.

CREATE TABLE IF NOT EXISTS public.nhl_xg_adjusted_impact_model_runs (
  adjusted_model_version text NOT NULL,
  target_family text NOT NULL,
  source_model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  model_family text NOT NULL,
  iterations integer NOT NULL,
  learning_rate double precision NOT NULL,
  l2 double precision NOT NULL,
  intercept double precision NOT NULL,
  training_rows integer NOT NULL,
  training_players integer NOT NULL,
  context_features integer NOT NULL,
  mean_response double precision NOT NULL,
  mse double precision NOT NULL,
  context_estimates jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (adjusted_model_version, target_family, feature_version)
);

CREATE TABLE IF NOT EXISTS public.nhl_xg_adjusted_player_impacts (
  adjusted_model_version text NOT NULL,
  target_family text NOT NULL,
  source_model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  player_id bigint NOT NULL,
  coefficient double precision NOT NULL,
  standard_error_approx double precision NOT NULL,
  offensive_rows integer NOT NULL DEFAULT 0,
  defensive_rows integer NOT NULL DEFAULT 0,
  total_rows integer NOT NULL DEFAULT 0,
  model_family text NOT NULL,
  l2 double precision NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (
    adjusted_model_version,
    target_family,
    feature_version,
    player_id
  )
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_adjusted_player_impacts_player
  ON public.nhl_xg_adjusted_player_impacts (
    player_id,
    target_family,
    adjusted_model_version
  );

CREATE INDEX IF NOT EXISTS idx_nhl_xg_adjusted_player_impacts_rank
  ON public.nhl_xg_adjusted_player_impacts (
    target_family,
    adjusted_model_version,
    coefficient DESC
  );

COMMENT ON TABLE public.nhl_xg_adjusted_impact_model_runs IS
  'Adjusted-impact baseline model run metadata for in-house xG differential designs.';

COMMENT ON TABLE public.nhl_xg_adjusted_player_impacts IS
  'Player adjusted-impact coefficients from regularized in-house xG differential baseline models.';
