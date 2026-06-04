-- Registry for in-house NHL xG model artifacts and deployment state.
-- This does not store the artifact body; it stores immutable fingerprints plus
-- approval/deployment metadata so scoring jobs can be audited after promotion.

CREATE TABLE IF NOT EXISTS public.nhl_xg_model_registry (
  model_version text NOT NULL,
  prediction_type text NOT NULL,
  artifact_tag text NOT NULL,
  model_family text NOT NULL,
  feature_family text NULL,
  feature_version integer NOT NULL,
  artifact_uri text NULL,
  artifact_checksum text NOT NULL,
  feature_manifest_hash text NOT NULL,
  calibration_fingerprint text NOT NULL,
  generated_at timestamptz NULL,
  source_commit_sha text NULL,
  season_scope integer NULL,
  train_start_date date NULL,
  train_end_date date NULL,
  validation_start_date date NULL,
  validation_end_date date NULL,
  test_start_date date NULL,
  test_end_date date NULL,
  train_example_count integer NULL,
  validation_example_count integer NULL,
  test_example_count integer NULL,
  approval_status text NOT NULL DEFAULT 'candidate',
  model_approved boolean NOT NULL DEFAULT false,
  deployment_alias text NULL DEFAULT 'candidate',
  is_active boolean NOT NULL DEFAULT false,
  is_champion boolean NOT NULL DEFAULT false,
  selected_features jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  feature_coverage jsonb NULL,
  feature_transforms jsonb NULL,
  calibration_metadata jsonb NULL,
  evaluation_metadata jsonb NULL,
  approval_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  registered_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, prediction_type),
  CONSTRAINT nhl_xg_model_registry_prediction_type_check
    CHECK (prediction_type IN ('shot_goal', 'rebound_creation')),
  CONSTRAINT nhl_xg_model_registry_approval_status_check
    CHECK (approval_status IN ('candidate', 'approved', 'rejected', 'retired')),
  CONSTRAINT nhl_xg_model_registry_train_dates_check
    CHECK (train_start_date IS NULL OR train_end_date IS NULL OR train_start_date <= train_end_date),
  CONSTRAINT nhl_xg_model_registry_validation_dates_check
    CHECK (validation_start_date IS NULL OR validation_end_date IS NULL OR validation_start_date <= validation_end_date),
  CONSTRAINT nhl_xg_model_registry_test_dates_check
    CHECK (test_start_date IS NULL OR test_end_date IS NULL OR test_start_date <= test_end_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nhl_xg_model_registry_active_alias
  ON public.nhl_xg_model_registry (prediction_type, deployment_alias)
  WHERE is_active = true AND deployment_alias IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nhl_xg_model_registry_champion
  ON public.nhl_xg_model_registry (prediction_type)
  WHERE is_champion = true;

CREATE INDEX IF NOT EXISTS idx_nhl_xg_model_registry_status
  ON public.nhl_xg_model_registry (prediction_type, approval_status, model_approved);

COMMENT ON TABLE public.nhl_xg_model_registry IS
  'NHL xG model artifact registry with immutable checksums, feature/calibration fingerprints, approval status, and deployment aliases.';
