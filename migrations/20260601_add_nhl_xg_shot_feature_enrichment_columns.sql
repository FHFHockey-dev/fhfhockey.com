-- Add persisted training-time enrichment fields to the shot-feature contract.
-- These columns mirror fields already present in feature_payload so future xG
-- artifacts can audit and select them without relying on training-only joins.

ALTER TABLE public.nhl_xg_shot_features
  ADD COLUMN IF NOT EXISTS shooter_roster_position text NULL,
  ADD COLUMN IF NOT EXISTS shooter_position_group text NULL,
  ADD COLUMN IF NOT EXISTS is_defenseman_shooter boolean NULL,
  ADD COLUMN IF NOT EXISTS shooter_handedness text NULL,
  ADD COLUMN IF NOT EXISTS goalie_catch_hand text NULL,
  ADD COLUMN IF NOT EXISTS shooter_goalie_handedness_matchup text NULL,
  ADD COLUMN IF NOT EXISTS owner_forward_count_on_ice integer NULL,
  ADD COLUMN IF NOT EXISTS owner_defense_count_on_ice integer NULL,
  ADD COLUMN IF NOT EXISTS opponent_forward_count_on_ice integer NULL,
  ADD COLUMN IF NOT EXISTS opponent_defense_count_on_ice integer NULL,
  ADD COLUMN IF NOT EXISTS owner_goalie_on_ice boolean NULL,
  ADD COLUMN IF NOT EXISTS opponent_goalie_on_ice boolean NULL,
  ADD COLUMN IF NOT EXISTS owner_skater_deployment_bucket text NULL,
  ADD COLUMN IF NOT EXISTS opponent_skater_deployment_bucket text NULL,
  ADD COLUMN IF NOT EXISTS skater_role_matchup_bucket text NULL;

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_features_shooter_position
  ON public.nhl_xg_shot_features (shooter_position_group, game_date DESC)
  WHERE shooter_position_group IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nhl_xg_shot_features_deployment_bucket
  ON public.nhl_xg_shot_features (
    owner_skater_deployment_bucket,
    opponent_skater_deployment_bucket,
    game_date DESC
  )
  WHERE owner_skater_deployment_bucket IS NOT NULL
    AND opponent_skater_deployment_bucket IS NOT NULL;
