-- Persisted rebound-control outputs.
--
-- Expected rebounds use approved rebound_creation predictions. Freeze/covered-puck
-- counts are label-only until a separate approved freeze model exists.

CREATE TABLE IF NOT EXISTS public.nhl_xg_rebound_control_team_game_aggregates (
  rebound_model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  team_id bigint NOT NULL,
  opponent_team_id bigint NULL,
  is_home boolean NULL,
  expected_rebounds_for double precision NOT NULL DEFAULT 0,
  expected_rebounds_against double precision NOT NULL DEFAULT 0,
  actual_rebounds_for integer NOT NULL DEFAULT 0,
  actual_rebounds_against integer NOT NULL DEFAULT 0,
  goalie_freezes_for integer NOT NULL DEFAULT 0,
  goalie_freezes_against integer NOT NULL DEFAULT 0,
  covered_pucks_for integer NOT NULL DEFAULT 0,
  covered_pucks_against integer NOT NULL DEFAULT 0,
  no_danger_continuations_for integer NOT NULL DEFAULT 0,
  no_danger_continuations_against integer NOT NULL DEFAULT 0,
  rebound_source_shots_for integer NOT NULL DEFAULT 0,
  rebound_source_shots_against integer NOT NULL DEFAULT 0,
  source_prediction_type text NOT NULL,
  source_model_approved boolean NOT NULL DEFAULT true,
  freeze_model_status text NOT NULL,
  confidence text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (rebound_model_version, feature_version, game_id, team_id),
  CONSTRAINT nhl_xg_rebound_control_team_prediction_type_check
    CHECK (source_prediction_type IN ('rebound_creation')),
  CONSTRAINT nhl_xg_rebound_control_team_freeze_status_check
    CHECK (freeze_model_status IN ('label_only_no_approved_model')),
  CONSTRAINT nhl_xg_rebound_control_team_confidence_check
    CHECK (confidence IN ('model', 'label_only'))
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_rebound_control_team_date
  ON public.nhl_xg_rebound_control_team_game_aggregates (
    team_id,
    game_date DESC,
    rebound_model_version
  );

CREATE TABLE IF NOT EXISTS public.nhl_xg_rebound_control_player_game_aggregates (
  rebound_model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  player_id bigint NOT NULL,
  team_id bigint NULL,
  expected_rebounds_created double precision NOT NULL DEFAULT 0,
  actual_rebounds_created integer NOT NULL DEFAULT 0,
  goalie_freezes_created integer NOT NULL DEFAULT 0,
  no_danger_continuations integer NOT NULL DEFAULT 0,
  rebound_source_shots integer NOT NULL DEFAULT 0,
  source_prediction_type text NOT NULL,
  source_model_approved boolean NOT NULL DEFAULT true,
  confidence text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (rebound_model_version, feature_version, game_id, player_id),
  CONSTRAINT nhl_xg_rebound_control_player_prediction_type_check
    CHECK (source_prediction_type IN ('rebound_creation')),
  CONSTRAINT nhl_xg_rebound_control_player_confidence_check
    CHECK (confidence IN ('model'))
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_rebound_control_player_date
  ON public.nhl_xg_rebound_control_player_game_aggregates (
    player_id,
    game_date DESC,
    rebound_model_version
  );

CREATE TABLE IF NOT EXISTS public.nhl_xg_rebound_control_goalie_game_aggregates (
  rebound_model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  goalie_player_id bigint NOT NULL,
  team_id bigint NULL,
  opponent_team_id bigint NULL,
  expected_rebounds_allowed double precision NOT NULL DEFAULT 0,
  actual_rebounds_allowed integer NOT NULL DEFAULT 0,
  rebound_control_saved_above_expected double precision NOT NULL DEFAULT 0,
  actual_goalie_freezes integer NOT NULL DEFAULT 0,
  actual_covered_pucks integer NOT NULL DEFAULT 0,
  no_danger_continuations_allowed integer NOT NULL DEFAULT 0,
  rebound_source_shots_against integer NOT NULL DEFAULT 0,
  source_prediction_type text NOT NULL,
  source_model_approved boolean NOT NULL DEFAULT true,
  freeze_model_status text NOT NULL,
  confidence text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (rebound_model_version, feature_version, game_id, goalie_player_id),
  CONSTRAINT nhl_xg_rebound_control_goalie_prediction_type_check
    CHECK (source_prediction_type IN ('rebound_creation')),
  CONSTRAINT nhl_xg_rebound_control_goalie_freeze_status_check
    CHECK (freeze_model_status IN ('label_only_no_approved_model')),
  CONSTRAINT nhl_xg_rebound_control_goalie_confidence_check
    CHECK (confidence IN ('model'))
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_rebound_control_goalie_date
  ON public.nhl_xg_rebound_control_goalie_game_aggregates (
    goalie_player_id,
    game_date DESC,
    rebound_model_version
  );

COMMENT ON TABLE public.nhl_xg_rebound_control_team_game_aggregates IS
  'Team-game rebound-control outputs from approved rebound_creation predictions and label-only freeze/covered-puck outcomes.';

COMMENT ON TABLE public.nhl_xg_rebound_control_player_game_aggregates IS
  'Player-game expected and actual rebound creation outputs from approved rebound_creation predictions.';

COMMENT ON TABLE public.nhl_xg_rebound_control_goalie_game_aggregates IS
  'Goalie-game rebound-control outputs, including expected rebounds allowed and rebound-control saved above expected.';
