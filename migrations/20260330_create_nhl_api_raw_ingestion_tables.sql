BEGIN;

CREATE TABLE IF NOT EXISTS nhl_api_game_payloads_raw (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL,
  endpoint TEXT NOT NULL CHECK (
    endpoint IN ('play-by-play', 'boxscore', 'landing', 'shiftcharts')
  ),
  season_id BIGINT NULL,
  game_date DATE NULL,
  source_url TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, endpoint, payload_hash)
);

CREATE INDEX IF NOT EXISTS nhl_api_game_payloads_raw_game_endpoint_idx
  ON nhl_api_game_payloads_raw (game_id, endpoint, fetched_at DESC);

CREATE INDEX IF NOT EXISTS nhl_api_game_payloads_raw_season_date_idx
  ON nhl_api_game_payloads_raw (season_id, game_date DESC, endpoint);

CREATE TABLE IF NOT EXISTS nhl_api_game_roster_spots (
  game_id BIGINT NOT NULL,
  season_id BIGINT NULL,
  game_date DATE NULL,
  team_id BIGINT NOT NULL,
  player_id BIGINT NOT NULL,
  first_name TEXT NULL,
  last_name TEXT NULL,
  sweater_number INTEGER NULL,
  position_code TEXT NULL,
  headshot_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS nhl_api_game_roster_spots_team_player_idx
  ON nhl_api_game_roster_spots (team_id, player_id, game_date DESC);

CREATE INDEX IF NOT EXISTS nhl_api_game_roster_spots_season_game_idx
  ON nhl_api_game_roster_spots (season_id, game_date DESC, game_id);

CREATE TABLE IF NOT EXISTS nhl_api_pbp_events (
  game_id BIGINT NOT NULL,
  season_id BIGINT NULL,
  game_date DATE NULL,
  event_id BIGINT NOT NULL,
  sort_order INTEGER NULL,
  period_number INTEGER NULL,
  period_type TEXT NULL,
  time_in_period TEXT NULL,
  time_remaining TEXT NULL,
  period_seconds_elapsed INTEGER NULL,
  time_remaining_seconds INTEGER NULL,
  situation_code TEXT NULL,
  away_goalie SMALLINT NULL,
  away_skaters SMALLINT NULL,
  home_skaters SMALLINT NULL,
  home_goalie SMALLINT NULL,
  strength_exact TEXT NULL,
  strength_state TEXT NULL,
  home_team_defending_side TEXT NULL,
  type_code INTEGER NULL,
  type_desc_key TEXT NULL,
  event_owner_team_id BIGINT NULL,
  event_owner_side TEXT NULL,
  is_shot_like BOOLEAN NOT NULL DEFAULT FALSE,
  is_goal BOOLEAN NOT NULL DEFAULT FALSE,
  is_penalty BOOLEAN NOT NULL DEFAULT FALSE,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  losing_player_id BIGINT NULL,
  winning_player_id BIGINT NULL,
  shooting_player_id BIGINT NULL,
  scoring_player_id BIGINT NULL,
  goalie_in_net_id BIGINT NULL,
  blocking_player_id BIGINT NULL,
  hitting_player_id BIGINT NULL,
  hittee_player_id BIGINT NULL,
  committed_by_player_id BIGINT NULL,
  drawn_by_player_id BIGINT NULL,
  served_by_player_id BIGINT NULL,
  player_id BIGINT NULL,
  assist1_player_id BIGINT NULL,
  assist2_player_id BIGINT NULL,
  shot_type TEXT NULL,
  penalty_type_code TEXT NULL,
  penalty_desc_key TEXT NULL,
  penalty_duration_minutes INTEGER NULL,
  reason TEXT NULL,
  secondary_reason TEXT NULL,
  x_coord NUMERIC NULL,
  y_coord NUMERIC NULL,
  zone_code TEXT NULL,
  home_score INTEGER NULL,
  away_score INTEGER NULL,
  home_sog INTEGER NULL,
  away_sog INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, event_id)
);

CREATE INDEX IF NOT EXISTS nhl_api_pbp_events_game_sort_idx
  ON nhl_api_pbp_events (game_id, sort_order);

CREATE INDEX IF NOT EXISTS nhl_api_pbp_events_season_date_idx
  ON nhl_api_pbp_events (season_id, game_date DESC, type_desc_key);

CREATE INDEX IF NOT EXISTS nhl_api_pbp_events_owner_idx
  ON nhl_api_pbp_events (event_owner_team_id, game_date DESC);

CREATE INDEX IF NOT EXISTS nhl_api_pbp_events_strength_idx
  ON nhl_api_pbp_events (strength_state, strength_exact, game_date DESC);

CREATE INDEX IF NOT EXISTS nhl_api_pbp_events_shot_like_idx
  ON nhl_api_pbp_events (is_shot_like, game_date DESC, game_id);

CREATE INDEX IF NOT EXISTS nhl_api_pbp_events_details_gin_idx
  ON nhl_api_pbp_events USING GIN (details);

CREATE TABLE IF NOT EXISTS nhl_api_shift_rows (
  game_id BIGINT NOT NULL,
  shift_id BIGINT NOT NULL,
  season_id BIGINT NULL,
  game_date DATE NULL,
  player_id BIGINT NOT NULL,
  team_id BIGINT NOT NULL,
  team_abbrev TEXT NULL,
  team_name TEXT NULL,
  first_name TEXT NULL,
  last_name TEXT NULL,
  period INTEGER NULL,
  shift_number INTEGER NULL,
  start_time TEXT NULL,
  end_time TEXT NULL,
  duration TEXT NULL,
  start_seconds INTEGER NULL,
  end_seconds INTEGER NULL,
  duration_seconds INTEGER NULL,
  type_code INTEGER NULL,
  detail_code INTEGER NULL,
  event_number INTEGER NULL,
  event_description TEXT NULL,
  event_details TEXT NULL,
  hex_value TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, shift_id)
);

CREATE INDEX IF NOT EXISTS nhl_api_shift_rows_game_player_idx
  ON nhl_api_shift_rows (game_id, player_id, period, start_seconds);

CREATE INDEX IF NOT EXISTS nhl_api_shift_rows_game_team_idx
  ON nhl_api_shift_rows (game_id, team_id, period, start_seconds);

CREATE INDEX IF NOT EXISTS nhl_api_shift_rows_season_date_idx
  ON nhl_api_shift_rows (season_id, game_date DESC, team_id);

CREATE OR REPLACE VIEW nhl_api_pbp_shot_events_v1 AS
SELECT
  game_id,
  season_id,
  game_date,
  event_id,
  sort_order,
  period_number,
  period_type,
  time_in_period,
  time_remaining,
  period_seconds_elapsed,
  time_remaining_seconds,
  situation_code,
  away_goalie,
  away_skaters,
  home_skaters,
  home_goalie,
  strength_exact,
  strength_state,
  type_code,
  type_desc_key,
  event_owner_team_id,
  event_owner_side,
  details,
  shooting_player_id,
  scoring_player_id,
  goalie_in_net_id,
  blocking_player_id,
  shot_type,
  reason,
  x_coord,
  y_coord,
  zone_code,
  home_score,
  away_score,
  home_sog,
  away_sog,
  is_goal
FROM nhl_api_pbp_events
WHERE is_shot_like = TRUE;

COMMIT;
