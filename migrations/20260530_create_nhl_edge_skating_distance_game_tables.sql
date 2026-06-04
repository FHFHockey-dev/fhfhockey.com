-- Typed NHL Edge last-10 skating-distance game rows.
--
-- The source endpoint remains a season-to-date public EDGE detail payload.
-- These tables normalize the embedded recent game rows so trend/fatigue models
-- can join on concrete game_id rows instead of parsing JSON payloads.

CREATE TABLE IF NOT EXISTS public.nhl_edge_skater_skating_distance_games_daily (
  snapshot_date date NOT NULL,
  season_id bigint NOT NULL,
  game_type smallint NOT NULL DEFAULT 2,
  player_id bigint NOT NULL,
  player_name text NULL,
  team_id bigint NULL,
  team_abbreviation text NULL,
  position text NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  player_on_home_team boolean NULL,
  home_team_abbreviation text NULL,
  away_team_abbreviation text NULL,
  toi_all_seconds integer NULL,
  distance_skated_all_miles double precision NULL,
  distance_skated_all_km double precision NULL,
  toi_even_seconds integer NULL,
  distance_skated_even_miles double precision NULL,
  distance_skated_even_km double precision NULL,
  toi_pp_seconds integer NULL,
  distance_skated_pp_miles double precision NULL,
  distance_skated_pp_km double precision NULL,
  toi_pk_seconds integer NULL,
  distance_skated_pk_miles double precision NULL,
  distance_skated_pk_km double precision NULL,
  game_center_link text NULL,
  source_url text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (snapshot_date, season_id, game_type, player_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_edge_skater_distance_games_player
  ON public.nhl_edge_skater_skating_distance_games_daily (
    player_id,
    game_date DESC,
    snapshot_date DESC
  );

CREATE INDEX IF NOT EXISTS idx_nhl_edge_skater_distance_games_team
  ON public.nhl_edge_skater_skating_distance_games_daily (
    team_id,
    team_abbreviation,
    game_date DESC
  );

CREATE TABLE IF NOT EXISTS public.nhl_edge_team_skating_distance_games_daily (
  snapshot_date date NOT NULL,
  season_id bigint NOT NULL,
  game_type smallint NOT NULL DEFAULT 2,
  team_id bigint NOT NULL,
  team_abbreviation text NULL,
  team_name text NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  is_home_team boolean NULL,
  home_team_abbreviation text NULL,
  away_team_abbreviation text NULL,
  toi_all_seconds integer NULL,
  distance_skated_all_miles double precision NULL,
  distance_skated_all_km double precision NULL,
  toi_even_seconds integer NULL,
  distance_skated_even_miles double precision NULL,
  distance_skated_even_km double precision NULL,
  toi_pp_seconds integer NULL,
  distance_skated_pp_miles double precision NULL,
  distance_skated_pp_km double precision NULL,
  toi_pk_seconds integer NULL,
  distance_skated_pk_miles double precision NULL,
  distance_skated_pk_km double precision NULL,
  game_center_link text NULL,
  source_url text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (snapshot_date, season_id, game_type, team_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_edge_team_distance_games_team
  ON public.nhl_edge_team_skating_distance_games_daily (
    team_id,
    game_date DESC,
    snapshot_date DESC
  );

CREATE OR REPLACE VIEW analytics.vw_nhl_edge_latest_skater_skating_distance_games AS
SELECT DISTINCT ON (player_id, game_type, game_id)
  *
FROM public.nhl_edge_skater_skating_distance_games_daily
ORDER BY player_id, game_type, game_id, snapshot_date DESC, updated_at DESC;

CREATE OR REPLACE VIEW analytics.vw_nhl_edge_latest_team_skating_distance_games AS
SELECT DISTINCT ON (team_id, game_type, game_id)
  *
FROM public.nhl_edge_team_skating_distance_games_daily
ORDER BY team_id, game_type, game_id, snapshot_date DESC, updated_at DESC;

COMMENT ON TABLE public.nhl_edge_skater_skating_distance_games_daily IS
  'Typed daily NHL Edge skater last-10 skating-distance game rows derived from skater-skating-distance-detail payloads.';

COMMENT ON TABLE public.nhl_edge_team_skating_distance_games_daily IS
  'Typed daily NHL Edge team last-10 skating-distance game rows derived from team-skating-distance-detail payloads.';
