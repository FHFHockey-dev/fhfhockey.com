-- Persisted pregame-safe schedule/travel/fatigue feature table.
--
-- v1 uses the public games schedule and infers venue timezone from the home
-- team because the current games schema does not include arena/venue metadata.

CREATE TABLE IF NOT EXISTS public.nhl_xg_team_game_travel_fatigue_features (
  travel_fatigue_version text NOT NULL,
  season_id bigint NULL,
  game_id bigint NOT NULL,
  game_date date NULL,
  game_type integer NULL,
  team_id bigint NOT NULL,
  opponent_team_id bigint NULL,
  is_home boolean NOT NULL,
  start_time_utc timestamptz NOT NULL,
  venue_team_id bigint NULL,
  venue_timezone text NULL,
  venue_timezone_source text NOT NULL,
  team_home_timezone text NULL,
  local_puck_drop_date date NULL,
  local_puck_drop_hour double precision NULL,
  team_body_clock_puck_drop_hour double precision NULL,
  body_clock_delta_hours double precision NULL,
  previous_game_id bigint NULL,
  previous_game_start_time_utc timestamptz NULL,
  previous_is_home boolean NULL,
  previous_venue_timezone text NULL,
  hours_since_previous_game double precision NULL,
  rest_days integer NULL,
  is_back_to_back boolean NOT NULL DEFAULT false,
  games_in_last_4_days integer NOT NULL DEFAULT 1,
  games_in_last_7_days integer NOT NULL DEFAULT 1,
  games_in_last_14_days integer NOT NULL DEFAULT 1,
  is_three_in_four boolean NOT NULL DEFAULT false,
  road_trip_game_number integer NOT NULL DEFAULT 0,
  home_stand_game_number integer NOT NULL DEFAULT 0,
  timezone_delta_hours_from_previous_game double precision NULL,
  abs_timezone_delta_hours_from_previous_game double precision NULL,
  travel_direction_from_previous_game text NOT NULL DEFAULT 'unknown',
  next_game_id bigint NULL,
  next_game_start_time_utc timestamptz NULL,
  next_is_home boolean NULL,
  hours_until_next_game double precision NULL,
  is_neutral_site_inferred boolean NOT NULL DEFAULT false,
  source_scope text NOT NULL,
  feature_availability text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (travel_fatigue_version, game_id, team_id),
  CONSTRAINT nhl_xg_team_game_travel_fatigue_timezone_source_check
    CHECK (venue_timezone_source IN ('home_team_inference', 'missing_home_team_timezone')),
  CONSTRAINT nhl_xg_team_game_travel_fatigue_direction_check
    CHECK (travel_direction_from_previous_game IN ('east', 'west', 'none', 'unknown')),
  CONSTRAINT nhl_xg_team_game_travel_fatigue_scope_check
    CHECK (source_scope IN ('schedule_derived')),
  CONSTRAINT nhl_xg_team_game_travel_fatigue_availability_check
    CHECK (feature_availability IN ('pregame_safe'))
);

CREATE INDEX IF NOT EXISTS idx_nhl_xg_team_game_travel_fatigue_team_date
  ON public.nhl_xg_team_game_travel_fatigue_features (
    team_id,
    game_date DESC,
    travel_fatigue_version
  );

CREATE INDEX IF NOT EXISTS idx_nhl_xg_team_game_travel_fatigue_game
  ON public.nhl_xg_team_game_travel_fatigue_features (
    game_id,
    travel_fatigue_version
  );

COMMENT ON TABLE public.nhl_xg_team_game_travel_fatigue_features IS
  'Pregame-safe team-game travel, timezone, circadian, road-trip, and fatigue features derived from the games schedule.';

COMMENT ON COLUMN public.nhl_xg_team_game_travel_fatigue_features.venue_timezone_source IS
  'home_team_inference until a first-class venue/arena timezone source is available.';
