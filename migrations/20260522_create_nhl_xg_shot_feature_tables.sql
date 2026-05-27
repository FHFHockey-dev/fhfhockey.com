-- Persisted in-house NHL xG feature and prediction tables.
--
-- The feature table stores high-value typed columns for filtering plus the full
-- versioned feature payload from nhlShotFeatureBuilder.ts. The prediction table
-- is model-versioned and supports separate shot-goal and rebound-creation tasks.

CREATE TABLE IF NOT EXISTS public.nhl_xg_shot_features (
  feature_version integer NOT NULL,
  game_id bigint NOT NULL,
  event_id bigint NOT NULL,
  season_id bigint NULL,
  game_date date NULL,
  event_index integer NULL,
  sort_order integer NULL,
  period_number integer NULL,
  period_type text NULL,
  game_seconds_elapsed integer NULL,
  period_seconds_elapsed integer NULL,
  event_owner_team_id bigint NULL,
  event_owner_side text NULL,
  strength_state text NULL,
  strength_exact text NULL,
  shot_event_type text NULL,
  is_goal boolean NOT NULL DEFAULT false,
  is_own_goal boolean NOT NULL DEFAULT false,
  is_shot_on_goal boolean NOT NULL DEFAULT false,
  is_missed_shot boolean NOT NULL DEFAULT false,
  is_blocked_shot boolean NOT NULL DEFAULT false,
  is_unblocked_shot_attempt boolean NOT NULL DEFAULT false,
  shooter_player_id bigint NULL,
  shooting_player_id bigint NULL,
  scoring_player_id bigint NULL,
  goalie_in_net_id bigint NULL,
  shot_type text NULL,
  zone_code text NULL,
  raw_x double precision NULL,
  raw_y double precision NULL,
  normalized_x double precision NULL,
  normalized_y double precision NULL,
  shot_distance_feet double precision NULL,
  shot_angle_degrees double precision NULL,
  previous_event_id bigint NULL,
  previous_event_type_desc_key text NULL,
  previous_event_team_id bigint NULL,
  previous_event_same_team boolean NULL,
  time_since_previous_event_seconds double precision NULL,
  distance_from_previous_event double precision NULL,
  is_rebound_shot boolean NOT NULL DEFAULT false,
  rebound_source_event_id bigint NULL,
  rebound_time_delta_seconds double precision NULL,
  rebound_distance_from_source double precision NULL,
  rebound_lateral_displacement_feet double precision NULL,
  rebound_distance_delta_feet double precision NULL,
  rebound_angle_change_degrees double precision NULL,
  creates_rebound boolean NOT NULL DEFAULT false,
  is_rush_shot boolean NOT NULL DEFAULT false,
  rush_source_event_id bigint NULL,
  rush_time_since_source_seconds double precision NULL,
  is_flurry_shot boolean NOT NULL DEFAULT false,
  flurry_sequence_id text NULL,
  flurry_shot_index integer NULL,
  flurry_shot_count integer NULL,
  miss_reason_bucket text NULL,
  is_short_side_miss boolean NOT NULL DEFAULT false,
  owner_power_play_age_seconds double precision NULL,
  shooter_shift_age_seconds double precision NULL,
  east_west_movement_feet double precision NULL,
  north_south_movement_feet double precision NULL,
  crossed_royal_road boolean NULL,
  is_penalty_shot_event boolean NOT NULL DEFAULT false,
  is_shootout_event boolean NOT NULL DEFAULT false,
  is_delayed_penalty_event boolean NOT NULL DEFAULT false,
  is_empty_net_event boolean NOT NULL DEFAULT false,
  is_overtime_event boolean NOT NULL DEFAULT false,
  has_rare_manpower boolean NOT NULL DEFAULT false,
  feature_payload jsonb NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (feature_version, game_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_features_season_date
  ON public.nhl_xg_shot_features (season_id, game_date DESC, game_id);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_features_training_cohort
  ON public.nhl_xg_shot_features (
    feature_version,
    is_unblocked_shot_attempt,
    is_penalty_shot_event,
    is_shootout_event,
    game_date DESC
  );

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_features_shooter
  ON public.nhl_xg_shot_features (shooter_player_id, game_date DESC)
  WHERE shooter_player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_features_goalie
  ON public.nhl_xg_shot_features (goalie_in_net_id, game_date DESC)
  WHERE goalie_in_net_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_features_owner
  ON public.nhl_xg_shot_features (event_owner_team_id, game_date DESC)
  WHERE event_owner_team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_features_payload_gin
  ON public.nhl_xg_shot_features USING gin (feature_payload);

CREATE TABLE IF NOT EXISTS public.nhl_xg_shot_predictions (
  model_version text NOT NULL,
  prediction_type text NOT NULL,
  feature_version integer NOT NULL,
  game_id bigint NOT NULL,
  event_id bigint NOT NULL,
  season_id bigint NULL,
  game_date date NULL,
  event_owner_team_id bigint NULL,
  shooter_player_id bigint NULL,
  goalie_in_net_id bigint NULL,
  shot_event_type text NULL,
  label boolean NULL,
  xg double precision NOT NULL,
  raw_probability double precision NOT NULL,
  calibrated_probability double precision NULL,
  model_family text NOT NULL,
  model_artifact_tag text NOT NULL,
  model_artifact_path text NULL,
  model_approved boolean NOT NULL DEFAULT false,
  feature_payload_hash text NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, prediction_type, game_id, event_id),
  CONSTRAINT nhl_xg_shot_predictions_prediction_type_check
    CHECK (prediction_type IN ('shot_goal', 'rebound_creation')),
  CONSTRAINT nhl_xg_shot_predictions_probability_check
    CHECK (
      raw_probability >= 0 AND raw_probability <= 1
      AND xg >= 0 AND xg <= 1
      AND (calibrated_probability IS NULL OR (
        calibrated_probability >= 0 AND calibrated_probability <= 1
      ))
    )
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_predictions_feature_lookup
  ON public.nhl_xg_shot_predictions (feature_version, game_id, event_id);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_predictions_season_date
  ON public.nhl_xg_shot_predictions (season_id, game_date DESC, model_version);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_predictions_shooter
  ON public.nhl_xg_shot_predictions (shooter_player_id, game_date DESC)
  WHERE shooter_player_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_predictions_goalie
  ON public.nhl_xg_shot_predictions (goalie_in_net_id, game_date DESC)
  WHERE goalie_in_net_id IS NOT NULL;

COMMENT ON TABLE public.nhl_xg_shot_features IS
  'Versioned in-house NHL xG shot feature rows derived from normalized NHL play-by-play and shift rows.';

COMMENT ON TABLE public.nhl_xg_shot_predictions IS
  'Versioned in-house NHL xG shot and rebound prediction rows produced from persisted shot features.';
