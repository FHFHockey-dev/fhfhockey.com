-- Persisted in-house NHL xG aggregate tables.
--
-- These aggregates consume only approved shot-goal prediction rows from
-- public.nhl_xg_shot_predictions. Rebound-creation predictions are intentionally
-- excluded from the first xG aggregate contract.

CREATE TABLE IF NOT EXISTS public.nhl_xg_team_game_aggregates (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  team_id bigint NOT NULL,
  opponent_team_id bigint NULL,
  is_home boolean NULL,
  xg_for double precision NOT NULL DEFAULT 0,
  xg_against double precision NOT NULL DEFAULT 0,
  goals_for integer NOT NULL DEFAULT 0,
  goals_against integer NOT NULL DEFAULT 0,
  shot_attempts_for integer NOT NULL DEFAULT 0,
  shot_attempts_against integer NOT NULL DEFAULT 0,
  source_prediction_type text NOT NULL DEFAULT 'shot_goal',
  source_model_approved boolean NOT NULL DEFAULT true,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, feature_version, game_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_team_game_aggregates_team_date
  ON public.nhl_xg_team_game_aggregates (team_id, game_date DESC, model_version);

CREATE TABLE IF NOT EXISTS public.nhl_xg_player_game_aggregates (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  player_id bigint NOT NULL,
  team_id bigint NULL,
  ixg double precision NOT NULL DEFAULT 0,
  goals integer NOT NULL DEFAULT 0,
  shot_attempts integer NOT NULL DEFAULT 0,
  source_prediction_type text NOT NULL DEFAULT 'shot_goal',
  source_model_approved boolean NOT NULL DEFAULT true,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, feature_version, game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_player_game_aggregates_player_date
  ON public.nhl_xg_player_game_aggregates (player_id, game_date DESC, model_version);

CREATE TABLE IF NOT EXISTS public.nhl_xg_goalie_game_aggregates (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  goalie_player_id bigint NOT NULL,
  team_id bigint NULL,
  opponent_team_id bigint NULL,
  xg_against double precision NOT NULL DEFAULT 0,
  goals_against integer NOT NULL DEFAULT 0,
  shots_against integer NOT NULL DEFAULT 0,
  goals_saved_above_expected double precision NOT NULL DEFAULT 0,
  source_prediction_type text NOT NULL DEFAULT 'shot_goal',
  source_model_approved boolean NOT NULL DEFAULT true,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, feature_version, game_id, goalie_player_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_goalie_game_aggregates_goalie_date
  ON public.nhl_xg_goalie_game_aggregates (goalie_player_id, game_date DESC, model_version);

CREATE TABLE IF NOT EXISTS public.nhl_xg_team_rolling_aggregates (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  team_id bigint NOT NULL,
  as_of_game_id bigint NOT NULL,
  as_of_game_date date NULL,
  window_games integer NOT NULL,
  games_count integer NOT NULL DEFAULT 0,
  xg_for double precision NOT NULL DEFAULT 0,
  xg_against double precision NOT NULL DEFAULT 0,
  goals_for integer NOT NULL DEFAULT 0,
  goals_against integer NOT NULL DEFAULT 0,
  shot_attempts_for integer NOT NULL DEFAULT 0,
  shot_attempts_against integer NOT NULL DEFAULT 0,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, feature_version, team_id, as_of_game_id, window_games)
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_team_rolling_aggregates_team_date
  ON public.nhl_xg_team_rolling_aggregates (team_id, as_of_game_date DESC, window_games, model_version);

CREATE TABLE IF NOT EXISTS public.nhl_xg_player_rolling_aggregates (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  player_id bigint NOT NULL,
  team_id bigint NULL,
  as_of_game_id bigint NOT NULL,
  as_of_game_date date NULL,
  window_games integer NOT NULL,
  games_count integer NOT NULL DEFAULT 0,
  ixg double precision NOT NULL DEFAULT 0,
  goals integer NOT NULL DEFAULT 0,
  shot_attempts integer NOT NULL DEFAULT 0,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, feature_version, player_id, as_of_game_id, window_games)
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_player_rolling_aggregates_player_date
  ON public.nhl_xg_player_rolling_aggregates (player_id, as_of_game_date DESC, window_games, model_version);

CREATE TABLE IF NOT EXISTS public.nhl_xg_goalie_rolling_aggregates (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  goalie_player_id bigint NOT NULL,
  team_id bigint NULL,
  as_of_game_id bigint NOT NULL,
  as_of_game_date date NULL,
  window_games integer NOT NULL,
  games_count integer NOT NULL DEFAULT 0,
  xg_against double precision NOT NULL DEFAULT 0,
  goals_against integer NOT NULL DEFAULT 0,
  shots_against integer NOT NULL DEFAULT 0,
  goals_saved_above_expected double precision NOT NULL DEFAULT 0,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, feature_version, goalie_player_id, as_of_game_id, window_games)
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_goalie_rolling_aggregates_goalie_date
  ON public.nhl_xg_goalie_rolling_aggregates (goalie_player_id, as_of_game_date DESC, window_games, model_version);

COMMENT ON TABLE public.nhl_xg_team_game_aggregates IS
  'Team-game in-house xG aggregates from approved shot-goal prediction rows.';

COMMENT ON TABLE public.nhl_xg_player_game_aggregates IS
  'Player-game in-house individual xG aggregates from approved shot-goal prediction rows.';

COMMENT ON TABLE public.nhl_xg_goalie_game_aggregates IS
  'Goalie-game in-house xG-against and goals-saved-above-expected aggregates from approved shot-goal prediction rows.';

COMMENT ON TABLE public.nhl_xg_team_rolling_aggregates IS
  'Team rolling-window in-house xG aggregates over recent team games.';

COMMENT ON TABLE public.nhl_xg_player_rolling_aggregates IS
  'Player rolling-window in-house individual xG aggregates over recent player shooting games.';

COMMENT ON TABLE public.nhl_xg_goalie_rolling_aggregates IS
  'Goalie rolling-window in-house xG-against and goals-saved-above-expected aggregates over recent goalie games.';
