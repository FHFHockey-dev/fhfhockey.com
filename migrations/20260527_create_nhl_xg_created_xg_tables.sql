-- Persisted player created-xG aggregates.
--
-- created_xg is intentionally distinct from shooter ixG. The v1 contract uses
-- inferred expected primary assists plus selected non-shooter transition credit.
-- Rebound-created xG is reserved for the rebound-control task.

CREATE TABLE IF NOT EXISTS public.nhl_xg_player_created_xg_game_aggregates (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  player_id bigint NOT NULL,
  team_id bigint NULL,
  shot_assist_created_xg double precision NOT NULL DEFAULT 0,
  transition_created_xg double precision NOT NULL DEFAULT 0,
  rebound_created_xg double precision NOT NULL DEFAULT 0,
  created_xg double precision NOT NULL DEFAULT 0,
  shot_assist_events integer NOT NULL DEFAULT 0,
  transition_events integer NOT NULL DEFAULT 0,
  rebound_events integer NOT NULL DEFAULT 0,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (model_version, feature_version, game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_player_created_xg_game_player_date
  ON public.nhl_xg_player_created_xg_game_aggregates (
    player_id,
    game_date DESC,
    model_version
  );

CREATE TABLE IF NOT EXISTS public.nhl_xg_player_created_xg_rolling_aggregates (
  model_version text NOT NULL,
  feature_version integer NOT NULL,
  season_id bigint NULL,
  player_id bigint NOT NULL,
  team_id bigint NULL,
  as_of_game_id bigint NOT NULL,
  as_of_game_date date NULL,
  window_games integer NOT NULL,
  games_count integer NOT NULL DEFAULT 0,
  shot_assist_created_xg double precision NOT NULL DEFAULT 0,
  transition_created_xg double precision NOT NULL DEFAULT 0,
  rebound_created_xg double precision NOT NULL DEFAULT 0,
  created_xg double precision NOT NULL DEFAULT 0,
  shot_assist_events integer NOT NULL DEFAULT 0,
  transition_events integer NOT NULL DEFAULT 0,
  rebound_events integer NOT NULL DEFAULT 0,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (
    model_version,
    feature_version,
    player_id,
    as_of_game_id,
    window_games
  )
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_player_created_xg_rolling_player_date
  ON public.nhl_xg_player_created_xg_rolling_aggregates (
    player_id,
    as_of_game_date DESC,
    window_games,
    model_version
  );

COMMENT ON TABLE public.nhl_xg_player_created_xg_game_aggregates IS
  'Player-game created-xG aggregates from inferred shot-assist and non-shooter transition creation credit.';

COMMENT ON TABLE public.nhl_xg_player_created_xg_rolling_aggregates IS
  'Player rolling-window created-xG aggregates with component breakdowns.';
