-- Typed NHL Edge metric tables.
--
-- public.nhl_edge_stats_daily remains the raw/provenance archive. These tables
-- expose stable typed metrics for analytics, trends, and projection features.

CREATE TABLE IF NOT EXISTS public.nhl_edge_skater_metrics_daily (
  snapshot_date date NOT NULL,
  season_id bigint NOT NULL,
  game_type smallint NOT NULL DEFAULT 2,
  player_id bigint NOT NULL,
  player_name text NULL,
  team_id bigint NULL,
  team_abbreviation text NULL,
  position text NULL,
  games_played integer NULL,
  goals integer NULL,
  assists integer NULL,
  points integer NULL,
  top_shot_speed_mph double precision NULL,
  top_shot_speed_kph double precision NULL,
  top_shot_speed_percentile double precision NULL,
  top_shot_speed_league_avg_mph double precision NULL,
  max_skating_speed_mph double precision NULL,
  max_skating_speed_kph double precision NULL,
  max_skating_speed_percentile double precision NULL,
  max_skating_speed_league_avg_mph double precision NULL,
  bursts_over_20 integer NULL,
  bursts_over_20_percentile double precision NULL,
  bursts_over_20_league_avg double precision NULL,
  total_distance_miles double precision NULL,
  total_distance_km double precision NULL,
  total_distance_percentile double precision NULL,
  total_distance_league_avg_miles double precision NULL,
  max_game_distance_miles double precision NULL,
  max_game_distance_km double precision NULL,
  max_game_distance_percentile double precision NULL,
  max_game_distance_league_avg_miles double precision NULL,
  all_shots integer NULL,
  all_goals integer NULL,
  all_shooting_pct double precision NULL,
  high_danger_shots integer NULL,
  high_danger_goals integer NULL,
  high_danger_shooting_pct double precision NULL,
  mid_range_shots integer NULL,
  mid_range_goals integer NULL,
  mid_range_shooting_pct double precision NULL,
  long_range_shots integer NULL,
  long_range_goals integer NULL,
  long_range_shooting_pct double precision NULL,
  offensive_zone_pct double precision NULL,
  offensive_zone_percentile double precision NULL,
  offensive_zone_league_avg double precision NULL,
  offensive_zone_ev_pct double precision NULL,
  offensive_zone_ev_percentile double precision NULL,
  offensive_zone_ev_league_avg double precision NULL,
  neutral_zone_pct double precision NULL,
  neutral_zone_percentile double precision NULL,
  neutral_zone_league_avg double precision NULL,
  defensive_zone_pct double precision NULL,
  defensive_zone_percentile double precision NULL,
  defensive_zone_league_avg double precision NULL,
  source_url text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (snapshot_date, season_id, game_type, player_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_edge_skater_metrics_daily_player
  ON public.nhl_edge_skater_metrics_daily (player_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_nhl_edge_skater_metrics_daily_team
  ON public.nhl_edge_skater_metrics_daily (team_id, team_abbreviation, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS public.nhl_edge_team_metrics_daily (
  snapshot_date date NOT NULL,
  season_id bigint NOT NULL,
  game_type smallint NOT NULL DEFAULT 2,
  team_id bigint NOT NULL,
  team_abbreviation text NULL,
  team_name text NULL,
  conference text NULL,
  division text NULL,
  games_played integer NULL,
  wins integer NULL,
  losses integer NULL,
  ot_losses integer NULL,
  points integer NULL,
  shot_attempts_over_90 integer NULL,
  shot_attempts_over_90_rank integer NULL,
  top_shot_speed_mph double precision NULL,
  top_shot_speed_kph double precision NULL,
  top_shot_speed_rank integer NULL,
  top_shot_speed_league_avg_mph double precision NULL,
  bursts_over_22 integer NULL,
  bursts_over_22_rank integer NULL,
  bursts_over_20 integer NULL,
  bursts_over_20_rank integer NULL,
  bursts_over_20_league_avg double precision NULL,
  max_skating_speed_mph double precision NULL,
  max_skating_speed_kph double precision NULL,
  max_skating_speed_rank integer NULL,
  max_skating_speed_league_avg_mph double precision NULL,
  total_distance_miles double precision NULL,
  total_distance_km double precision NULL,
  total_distance_rank integer NULL,
  total_distance_league_avg_miles double precision NULL,
  all_shots integer NULL,
  all_goals integer NULL,
  all_shooting_pct double precision NULL,
  all_shots_rank integer NULL,
  all_goals_rank integer NULL,
  all_shooting_pct_rank integer NULL,
  high_danger_shots integer NULL,
  high_danger_goals integer NULL,
  high_danger_shooting_pct double precision NULL,
  high_danger_shots_rank integer NULL,
  high_danger_goals_rank integer NULL,
  high_danger_shooting_pct_rank integer NULL,
  mid_range_shots integer NULL,
  mid_range_goals integer NULL,
  mid_range_shooting_pct double precision NULL,
  mid_range_shots_rank integer NULL,
  mid_range_goals_rank integer NULL,
  mid_range_shooting_pct_rank integer NULL,
  long_range_shots integer NULL,
  long_range_goals integer NULL,
  long_range_shooting_pct double precision NULL,
  long_range_shots_rank integer NULL,
  long_range_goals_rank integer NULL,
  long_range_shooting_pct_rank integer NULL,
  offensive_zone_pct double precision NULL,
  offensive_zone_rank integer NULL,
  offensive_zone_league_avg double precision NULL,
  offensive_zone_ev_pct double precision NULL,
  offensive_zone_ev_rank integer NULL,
  offensive_zone_ev_league_avg double precision NULL,
  neutral_zone_pct double precision NULL,
  neutral_zone_rank integer NULL,
  neutral_zone_league_avg double precision NULL,
  defensive_zone_pct double precision NULL,
  defensive_zone_rank integer NULL,
  defensive_zone_league_avg double precision NULL,
  source_url text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (snapshot_date, season_id, game_type, team_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_edge_team_metrics_daily_team
  ON public.nhl_edge_team_metrics_daily (team_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS public.nhl_edge_goalie_metrics_daily (
  snapshot_date date NOT NULL,
  season_id bigint NOT NULL,
  game_type smallint NOT NULL DEFAULT 2,
  goalie_id bigint NOT NULL,
  goalie_name text NULL,
  team_id bigint NULL,
  team_abbreviation text NULL,
  games_played integer NULL,
  wins integer NULL,
  losses integer NULL,
  ot_losses integer NULL,
  goals_against_avg double precision NULL,
  save_pct double precision NULL,
  edge_goals_against_avg double precision NULL,
  edge_goals_against_avg_percentile double precision NULL,
  edge_goals_against_avg_league_avg double precision NULL,
  games_above_900 double precision NULL,
  games_above_900_percentile double precision NULL,
  games_above_900_league_avg double precision NULL,
  goal_differential_per_60 double precision NULL,
  goal_differential_per_60_percentile double precision NULL,
  goal_differential_per_60_league_avg double precision NULL,
  goal_support_avg double precision NULL,
  goal_support_avg_percentile double precision NULL,
  goal_support_avg_league_avg double precision NULL,
  point_pct double precision NULL,
  point_pct_percentile double precision NULL,
  point_pct_league_avg double precision NULL,
  all_goals_against integer NULL,
  all_saves integer NULL,
  all_save_pct double precision NULL,
  high_danger_goals_against integer NULL,
  high_danger_saves integer NULL,
  high_danger_save_pct double precision NULL,
  mid_range_goals_against integer NULL,
  mid_range_saves integer NULL,
  mid_range_save_pct double precision NULL,
  long_range_goals_against integer NULL,
  long_range_saves integer NULL,
  long_range_save_pct double precision NULL,
  source_url text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (snapshot_date, season_id, game_type, goalie_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_edge_goalie_metrics_daily_goalie
  ON public.nhl_edge_goalie_metrics_daily (goalie_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_nhl_edge_goalie_metrics_daily_team
  ON public.nhl_edge_goalie_metrics_daily (team_id, team_abbreviation, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS public.nhl_edge_skater_shot_location_leaders_daily (
  snapshot_date date NOT NULL,
  season_id bigint NOT NULL,
  game_type smallint NOT NULL DEFAULT 2,
  metric_key text NOT NULL,
  rank_order integer NOT NULL,
  player_id bigint NOT NULL,
  player_name text NULL,
  team_id bigint NULL,
  team_abbreviation text NULL,
  position text NULL,
  all_value double precision NULL,
  high_danger_value double precision NULL,
  mid_range_value double precision NULL,
  long_range_value double precision NULL,
  source_url text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (snapshot_date, season_id, game_type, metric_key, rank_order, player_id)
);

CREATE INDEX IF NOT EXISTS idx_nhl_edge_skater_shot_location_leaders_daily_metric
  ON public.nhl_edge_skater_shot_location_leaders_daily (
    snapshot_date DESC,
    metric_key,
    rank_order
  );

CREATE OR REPLACE VIEW analytics.vw_nhl_edge_latest_skater_metrics AS
SELECT DISTINCT ON (player_id, game_type)
  *
FROM public.nhl_edge_skater_metrics_daily
ORDER BY player_id, game_type, snapshot_date DESC, updated_at DESC;

CREATE OR REPLACE VIEW analytics.vw_nhl_edge_latest_team_metrics AS
SELECT DISTINCT ON (team_id, game_type)
  *
FROM public.nhl_edge_team_metrics_daily
ORDER BY team_id, game_type, snapshot_date DESC, updated_at DESC;

CREATE OR REPLACE VIEW analytics.vw_nhl_edge_latest_goalie_metrics AS
SELECT DISTINCT ON (goalie_id, game_type)
  *
FROM public.nhl_edge_goalie_metrics_daily
ORDER BY goalie_id, game_type, snapshot_date DESC, updated_at DESC;

COMMENT ON TABLE public.nhl_edge_skater_metrics_daily IS
  'Typed daily NHL Edge skater snapshots derived from public Edge skater-detail payloads.';

COMMENT ON TABLE public.nhl_edge_team_metrics_daily IS
  'Typed daily NHL Edge team snapshots derived from public Edge team-detail payloads.';

COMMENT ON TABLE public.nhl_edge_goalie_metrics_daily IS
  'Typed daily NHL Edge goalie snapshots derived from public Edge goalie-detail payloads.';

COMMENT ON TABLE public.nhl_edge_skater_shot_location_leaders_daily IS
  'Daily NHL Edge skater shot-location top-10 leaderboard snapshots.';
