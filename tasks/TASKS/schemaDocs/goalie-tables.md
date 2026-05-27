# Goalie Tables And Views

Generated from live Supabase `information_schema` on 2026-05-22.

Tables/views documented: 38.

## Index

- `analytics.vw_nhl_edge_latest_goalie_metrics` (view)
- `public.PROJECTIONS_20252026_CULLEN_GOALIES` (table)
- `public.PROJECTIONS_20252026_DFO_GOALIES` (table)
- `public.PROJECTIONS_20252026_DTZ_GOALIES` (table)
- `public.forge_goalie_game` (table)
- `public.forge_goalie_projections` (table)
- `public.goalie_page_stats` (table)
- `public.goalie_page_weeks` (table)
- `public.goalie_ratings_daily` (table)
- `public.goalie_start_projections` (table)
- `public.goalie_totals_unified` (view)
- `public.goalie_underlying_summary_partitions` (table)
- `public.goalie_weekly_aggregates` (view)
- `public.goaliesGameStats` (table)
- `public.league_averages_goalies` (table)
- `public.league_weekly_goalie_averages` (view)
- `public.nhl_edge_goalie_metrics_daily` (table)
- `public.nst_gamelog_goalie_5v5_counts` (table)
- `public.nst_gamelog_goalie_5v5_rates` (table)
- `public.nst_gamelog_goalie_all_counts` (table)
- `public.nst_gamelog_goalie_all_rates` (table)
- `public.nst_gamelog_goalie_ev_counts` (table)
- `public.nst_gamelog_goalie_ev_rates` (table)
- `public.nst_gamelog_goalie_pk_counts` (table)
- `public.nst_gamelog_goalie_pk_rates` (table)
- `public.nst_gamelog_goalie_pp_counts` (table)
- `public.nst_gamelog_goalie_pp_rates` (table)
- `public.vw_goalie_stats_unified` (view)
- `public.vw_goalie_stats_unified_source` (view)
- `public.wgo_goalie_stats` (table)
- `public.wgo_goalie_stats_per_game` (view)
- `public.wgo_goalie_stats_totals` (table)
- `public.wigo_career` (table)
- `public.wigo_counts` (table)
- `public.wigo_goalies` (view)
- `public.wigo_per_game` (table)
- `public.wigo_rates` (table)
- `public.wigo_recent` (table)

## `analytics.vw_nhl_edge_latest_goalie_metrics`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | yes |  |
| `season_id` | bigint | yes |  |
| `game_type` | smallint | yes |  |
| `goalie_id` | bigint | yes |  |
| `goalie_name` | text | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `games_played` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `goals_against_avg` | double precision | yes |  |
| `save_pct` | double precision | yes |  |
| `edge_goals_against_avg` | double precision | yes |  |
| `edge_goals_against_avg_percentile` | double precision | yes |  |
| `edge_goals_against_avg_league_avg` | double precision | yes |  |
| `games_above_900` | double precision | yes |  |
| `games_above_900_percentile` | double precision | yes |  |
| `games_above_900_league_avg` | double precision | yes |  |
| `goal_differential_per_60` | double precision | yes |  |
| `goal_differential_per_60_percentile` | double precision | yes |  |
| `goal_differential_per_60_league_avg` | double precision | yes |  |
| `goal_support_avg` | double precision | yes |  |
| `goal_support_avg_percentile` | double precision | yes |  |
| `goal_support_avg_league_avg` | double precision | yes |  |
| `point_pct` | double precision | yes |  |
| `point_pct_percentile` | double precision | yes |  |
| `point_pct_league_avg` | double precision | yes |  |
| `all_goals_against` | integer | yes |  |
| `all_saves` | integer | yes |  |
| `all_save_pct` | double precision | yes |  |
| `high_danger_goals_against` | integer | yes |  |
| `high_danger_saves` | integer | yes |  |
| `high_danger_save_pct` | double precision | yes |  |
| `mid_range_goals_against` | integer | yes |  |
| `mid_range_saves` | integer | yes |  |
| `mid_range_save_pct` | double precision | yes |  |
| `long_range_goals_against` | integer | yes |  |
| `long_range_saves` | integer | yes |  |
| `long_range_save_pct` | double precision | yes |  |
| `source_url` | text | yes |  |
| `raw_payload` | jsonb | yes |  |
| `metadata` | jsonb | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

## `public.PROJECTIONS_20252026_CULLEN_GOALIES`

Type: table

Primary key: `upload_batch_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `upload_batch_id` | uuid | no | gen_random_uuid() |
| `player_id` | bigint | yes |  |
| `Goalie` | text | yes |  |
| `Team_Abbreviation` | text | yes |  |
| `Games_Played` | numeric | yes |  |
| `Wins_Goalie` | numeric | yes |  |
| `Goals_Against_Average` | numeric | yes |  |
| `Sv_Pct` | numeric | yes |  |
| `Shutouts_Goalie` | numeric | yes |  |

## `public.PROJECTIONS_20252026_DFO_GOALIES`

Type: table

Primary key: `upload_batch_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `upload_batch_id` | uuid | no | gen_random_uuid() |
| `player_id` | bigint | yes |  |
| `Player_Name` | text | yes |  |
| `Team_Abbreviation` | text | yes |  |
| `Position` | text | yes |  |
| `Games_Started_Goalie` | numeric | yes |  |
| `Wins_Goalie` | numeric | yes |  |
| `Losses_Goalie` | numeric | yes |  |
| `OTL` | numeric | yes |  |
| `Shutouts_Goalie` | numeric | yes |  |
| `Saves_Goalie` | numeric | yes |  |
| `Save_Percentage` | numeric | yes |  |
| `Ga` | numeric | yes |  |
| `Goals_Against_Average` | numeric | yes |  |
| `Sa` | numeric | yes |  |

## `public.PROJECTIONS_20252026_DTZ_GOALIES`

Type: table

Primary key: `upload_batch_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `upload_batch_id` | uuid | no | gen_random_uuid() |
| `player_id` | bigint | yes |  |
| `Player_Name` | text | yes |  |
| `Team_Abbreviation` | text | yes |  |
| `Age` | numeric | yes |  |
| `Position` | text | yes |  |
| `Salary` | text | yes |  |
| `Games_Played` | numeric | yes |  |
| `Wins_Goalie` | numeric | yes |  |
| `Losses_Goalie` | numeric | yes |  |
| `Otl` | numeric | yes |  |
| `Ga` | numeric | yes |  |
| `Sa` | numeric | yes |  |
| `Saves_Goalie` | numeric | yes |  |
| `Save_Percentage` | numeric | yes |  |
| `Goals_Against_Average` | numeric | yes |  |
| `Shutouts_Goalie` | numeric | yes |  |
| `Qs` | numeric | yes |  |
| `Rbs` | numeric | yes |  |
| `Vor` | numeric | yes |  |
| `Rank` | numeric | yes |  |
| `Gp_Org` | numeric | yes |  |
| `Playerid` | text | yes |  |

## `public.forge_goalie_game`

Type: table

Primary key: `game_id`, `goalie_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | no |  |
| `goalie_id` | bigint | no |  |
| `team_id` | smallint | no |  |
| `opponent_team_id` | smallint | yes |  |
| `game_date` | date | no |  |
| `shots_against` | integer | yes |  |
| `goals_allowed` | integer | yes |  |
| `saves` | integer | yes |  |
| `toi_seconds` | integer | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.forge_goalie_projections`

Type: table

Primary key: `run_id`, `game_id`, `goalie_id`, `horizon_games`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `run_id` | uuid | no |  |
| `as_of_date` | date | no |  |
| `horizon_games` | smallint | no |  |
| `game_id` | bigint | no |  |
| `goalie_id` | bigint | no |  |
| `team_id` | smallint | no |  |
| `opponent_team_id` | smallint | no |  |
| `starter_probability` | numeric | yes |  |
| `proj_shots_against` | numeric | yes |  |
| `proj_saves` | numeric | yes |  |
| `proj_goals_allowed` | numeric | yes |  |
| `uncertainty` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `proj_win_prob` | numeric | yes |  |
| `proj_shutout_prob` | numeric | yes |  |

## `public.goalie_page_stats`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('goalie_page_stats_id_seq'::regclass) |
| `player_id` | integer | no |  |
| `week_id` | integer | yes |  |
| `games_played` | integer | yes |  |
| `games_started` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `saves` | integer | yes |  |
| `shots_against` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `shutouts` | integer | yes |  |
| `time_on_ice` | numeric | yes |  |
| `save_pct` | numeric | yes |  |
| `goals_against_average` | numeric | yes |  |
| `team` | character varying | yes |  |
| `goalie_full_name` | character varying | yes |  |

## `public.goalie_page_weeks`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('goalie_page_weeks_id_seq'::regclass) |
| `start_date` | date | no |  |
| `end_date` | date | no |  |

## `public.goalie_ratings_daily`

Type: table

Primary key: `snapshot_date`, `player_id`, `model_name`, `model_version`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `season_id` | integer | no |  |
| `player_id` | bigint | no |  |
| `team_id` | smallint | yes |  |
| `rating_0_to_100` | double precision | no |  |
| `rating_raw` | double precision | no |  |
| `league_rank` | integer | yes |  |
| `percentile` | double precision | yes |  |
| `sample_games` | integer | yes |  |
| `sample_toi_seconds` | double precision | yes |  |
| `model_name` | text | no | 'goalie_rating_v1'::text |
| `model_version` | text | no | 'v1'::text |
| `source_window` | text | no | 'season_to_date'::text |
| `components` | jsonb | no | '{}'::jsonb |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.goalie_start_projections`

Type: table

Primary key: `game_id`, `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | integer | no |  |
| `team_id` | integer | no |  |
| `player_id` | integer | no |  |
| `start_probability` | numeric | yes |  |
| `projected_gsaa_per_60` | numeric | yes |  |
| `confirmed_status` | boolean | yes | false |
| `created_at` | timestamp with time zone | yes | now() |
| `updated_at` | timestamp with time zone | yes | now() |
| `game_date` | date | yes |  |
| `l10_start_pct` | numeric | yes |  |
| `season_start_pct` | numeric | yes |  |
| `games_played` | numeric | yes |  |

## `public.goalie_totals_unified`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `season_id` | integer | yes |  |
| `player_name` | text | yes |  |
| `team_ids` | _int2[] | yes |  |
| `position_code` | text | yes |  |
| `shoots_catches` | text | yes |  |
| `games_played` | bigint | yes |  |
| `games_started` | bigint | yes |  |
| `wins` | bigint | yes |  |
| `losses` | bigint | yes |  |
| `ot_losses` | bigint | yes |  |
| `saves` | bigint | yes |  |
| `goals_against` | bigint | yes |  |
| `shots_against` | bigint | yes |  |
| `time_on_ice` | double precision | yes |  |
| `shutouts` | bigint | yes |  |
| `goals` | bigint | yes |  |
| `assists` | bigint | yes |  |
| `complete_games` | bigint | yes |  |
| `incomplete_games` | bigint | yes |  |
| `quality_starts` | bigint | yes |  |
| `regulation_losses` | bigint | yes |  |
| `regulation_wins` | bigint | yes |  |
| `save_pct` | numeric | yes |  |
| `goals_against_avg` | numeric | yes |  |
| `complete_game_pct` | numeric | yes |  |
| `quality_starts_pct` | numeric | yes |  |
| `shots_against_per_60` | numeric | yes |  |
| `nst_all_toi` | numeric | yes |  |
| `nst_all_shots_against` | bigint | yes |  |
| `nst_all_saves` | bigint | yes |  |
| `nst_all_goals_against` | bigint | yes |  |
| `nst_all_gsaa` | numeric | yes |  |
| `nst_all_xg_against` | numeric | yes |  |
| `nst_all_hd_shots_against` | bigint | yes |  |
| `nst_all_hd_saves` | bigint | yes |  |
| `nst_all_hd_gsaa` | numeric | yes |  |
| `nst_all_rush_attempts_against` | bigint | yes |  |
| `nst_all_rebound_attempts_against` | bigint | yes |  |
| `nst_5v5_toi` | numeric | yes |  |
| `nst_5v5_shots_against` | bigint | yes |  |
| `nst_5v5_saves` | bigint | yes |  |
| `nst_5v5_goals_against` | bigint | yes |  |
| `nst_5v5_gsaa` | numeric | yes |  |
| `nst_5v5_xg_against` | numeric | yes |  |
| `nst_5v5_hd_shots_against` | bigint | yes |  |
| `nst_5v5_hd_saves` | bigint | yes |  |
| `nst_5v5_hd_gsaa` | numeric | yes |  |
| `nst_all_sv_percentage` | numeric | yes |  |
| `nst_all_gaa` | numeric | yes |  |
| `nst_all_shots_against_per_60` | numeric | yes |  |
| `nst_all_saves_per_60` | numeric | yes |  |
| `nst_all_gsaa_per_60` | numeric | yes |  |
| `nst_all_xg_against_per_60` | numeric | yes |  |
| `nst_5v5_sv_percentage` | numeric | yes |  |
| `nst_5v5_gaa` | numeric | yes |  |
| `nst_5v5_gsaa_per_60` | numeric | yes |  |
| `nst_5v5_xg_against_per_60` | numeric | yes |  |
| `nst_5v5_hd_sv_percentage` | numeric | yes |  |
| `has_nst_5v5_counts` | boolean | yes |  |
| `has_nst_5v5_rates` | boolean | yes |  |
| `has_nst_all_counts` | boolean | yes |  |
| `has_nst_all_rates` | boolean | yes |  |
| `has_nst_ev_counts` | boolean | yes |  |
| `has_nst_ev_rates` | boolean | yes |  |
| `has_nst_pk_counts` | boolean | yes |  |
| `has_nst_pk_rates` | boolean | yes |  |
| `has_nst_pp_counts` | boolean | yes |  |
| `has_nst_pp_rates` | boolean | yes |  |
| `materialized_at` | timestamp with time zone | yes |  |

## `public.goalie_underlying_summary_partitions`

Type: table

Primary key: `game_id`, `strength`, `score_state`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | no |  |
| `season_id` | integer | no |  |
| `game_date` | date | no |  |
| `strength` | text | no |  |
| `score_state` | text | no |  |
| `endpoint` | text | no | 'landing'::text |
| `source_url` | text | no |  |
| `shared_source_url` | text | no |  |
| `payload_hash` | text | no |  |
| `payload` | jsonb | no |  |
| `fetched_at` | timestamp with time zone | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.goalie_weekly_aggregates`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `matchup_season` | text | yes |  |
| `week` | integer | yes |  |
| `week_start_date` | date | yes |  |
| `week_end_date` | date | yes |  |
| `goalie_id` | integer | yes |  |
| `goalie_name` | text | yes |  |
| `team` | text | yes |  |
| `goalie_game_season` | integer | yes |  |
| `weekly_gp` | bigint | yes |  |
| `weekly_gs` | bigint | yes |  |
| `weekly_wins` | bigint | yes |  |
| `weekly_losses` | bigint | yes |  |
| `weekly_ot_losses` | bigint | yes |  |
| `weekly_saves` | bigint | yes |  |
| `weekly_sa` | bigint | yes |  |
| `weekly_ga` | bigint | yes |  |
| `weekly_so` | bigint | yes |  |
| `weekly_toi_seconds` | double precision | yes |  |
| `weekly_sv_pct` | numeric | yes |  |
| `weekly_gaa` | numeric | yes |  |
| `weekly_saves_per_60` | numeric | yes |  |
| `weekly_sa_per_60` | numeric | yes |  |

## `public.goaliesGameStats`

Type: table

Primary key: `playerId`, `gameId`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `playerId` | bigint | no |  |
| `gameId` | bigint | no |  |
| `position` | NHL_Position_Code | no | 'G'::"NHL_Position_Code" |
| `evenStrengthShotsAgainst` | text | no | '0/0'::text |
| `powerPlayShotsAgainst` | text | no | '0/0'::text |
| `shorthandedShotsAgainst` | text | no | '0/0'::text |
| `saveShotsAgainst` | text | no | '0/0'::text |
| `evenStrengthGoalsAgainst` | smallint | no | '0'::smallint |
| `powerPlayGoalsAgainst` | smallint | no | '0'::smallint |
| `shorthandedGoalsAgainst` | smallint | no | '0'::smallint |
| `pim` | smallint | no | '0'::smallint |
| `goalsAgainst` | smallint | no | '0'::smallint |
| `toi` | text | yes | '00:00'::text |
| `created_at` | timestamp with time zone | no | now() |
| `savePctg` | real | yes | '0'::real |

## `public.league_averages_goalies`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('league_averages_id_seq'::regclass) |
| `week_id` | integer | yes |  |
| `games_played` | numeric | yes |  |
| `games_started` | numeric | yes |  |
| `wins` | numeric | yes |  |
| `losses` | numeric | yes |  |
| `ot_losses` | numeric | yes |  |
| `saves` | numeric | yes |  |
| `shots_against` | numeric | yes |  |
| `goals_against` | numeric | yes |  |
| `shutouts` | numeric | yes |  |
| `time_on_ice` | numeric | yes |  |
| `save_pct` | numeric | yes |  |
| `goals_against_average` | numeric | yes |  |

## `public.league_weekly_goalie_averages`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `matchup_season` | text | yes |  |
| `week` | integer | yes |  |
| `total_league_saves` | numeric | yes |  |
| `total_league_sa` | numeric | yes |  |
| `total_league_ga` | numeric | yes |  |
| `total_league_toi_seconds` | double precision | yes |  |
| `avg_league_weekly_gp` | numeric | yes |  |
| `avg_league_weekly_gs` | numeric | yes |  |
| `avg_league_weekly_wins` | numeric | yes |  |
| `avg_league_weekly_losses` | numeric | yes |  |
| `avg_league_weekly_ot_losses` | numeric | yes |  |
| `avg_league_weekly_saves` | numeric | yes |  |
| `avg_league_weekly_sa` | numeric | yes |  |
| `avg_league_weekly_ga` | numeric | yes |  |
| `avg_league_weekly_so` | numeric | yes |  |
| `avg_league_weekly_toi_seconds` | double precision | yes |  |
| `avg_league_weekly_sv_pct` | numeric | yes |  |
| `avg_league_weekly_gaa` | numeric | yes |  |
| `avg_league_weekly_saves_per_60` | numeric | yes |  |
| `avg_league_weekly_sa_per_60` | numeric | yes |  |

## `public.nhl_edge_goalie_metrics_daily`

Type: table

Primary key: `snapshot_date`, `season_id`, `game_type`, `goalie_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `season_id` | bigint | no |  |
| `game_type` | smallint | no | 2 |
| `goalie_id` | bigint | no |  |
| `goalie_name` | text | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `games_played` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `goals_against_avg` | double precision | yes |  |
| `save_pct` | double precision | yes |  |
| `edge_goals_against_avg` | double precision | yes |  |
| `edge_goals_against_avg_percentile` | double precision | yes |  |
| `edge_goals_against_avg_league_avg` | double precision | yes |  |
| `games_above_900` | double precision | yes |  |
| `games_above_900_percentile` | double precision | yes |  |
| `games_above_900_league_avg` | double precision | yes |  |
| `goal_differential_per_60` | double precision | yes |  |
| `goal_differential_per_60_percentile` | double precision | yes |  |
| `goal_differential_per_60_league_avg` | double precision | yes |  |
| `goal_support_avg` | double precision | yes |  |
| `goal_support_avg_percentile` | double precision | yes |  |
| `goal_support_avg_league_avg` | double precision | yes |  |
| `point_pct` | double precision | yes |  |
| `point_pct_percentile` | double precision | yes |  |
| `point_pct_league_avg` | double precision | yes |  |
| `all_goals_against` | integer | yes |  |
| `all_saves` | integer | yes |  |
| `all_save_pct` | double precision | yes |  |
| `high_danger_goals_against` | integer | yes |  |
| `high_danger_saves` | integer | yes |  |
| `high_danger_save_pct` | double precision | yes |  |
| `mid_range_goals_against` | integer | yes |  |
| `mid_range_saves` | integer | yes |  |
| `mid_range_save_pct` | double precision | yes |  |
| `long_range_goals_against` | integer | yes |  |
| `long_range_saves` | integer | yes |  |
| `long_range_save_pct` | double precision | yes |  |
| `source_url` | text | no |  |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | timezone('utc'::text, now()) |
| `updated_at` | timestamp with time zone | no | timezone('utc'::text, now()) |

## `public.nst_gamelog_goalie_5v5_counts`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `team` | text | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | no |  |
| `gp` | integer | yes |  |
| `toi` | numeric | yes |  |
| `shots_against` | integer | yes |  |
| `saves` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `sv_percentage` | numeric | yes |  |
| `gaa` | numeric | yes |  |
| `gsaa` | numeric | yes |  |
| `xg_against` | numeric | yes |  |
| `hd_shots_against` | integer | yes |  |
| `hd_saves` | integer | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa` | numeric | yes |  |
| `md_shots_against` | integer | yes |  |
| `md_saves` | integer | yes |  |
| `md_goals_against` | integer | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa` | numeric | yes |  |
| `ld_shots_against` | integer | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa` | numeric | yes |  |
| `rush_attempts_against` | integer | yes |  |
| `rebound_attempts_against` | integer | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |

## `public.nst_gamelog_goalie_5v5_rates`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `team` | text | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | no |  |
| `gp` | integer | yes |  |
| `toi` | numeric | yes |  |
| `toi_per_gp` | numeric | yes |  |
| `shots_against_per_60` | numeric | yes |  |
| `saves_per_60` | numeric | yes |  |
| `sv_percentage` | numeric | yes |  |
| `gaa` | numeric | yes |  |
| `gsaa_per_60` | numeric | yes |  |
| `xg_against_per_60` | numeric | yes |  |
| `hd_shots_against_per_60` | numeric | yes |  |
| `hd_saves_per_60` | numeric | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa_per_60` | numeric | yes |  |
| `md_shots_against_per_60` | numeric | yes |  |
| `md_saves_per_60` | numeric | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa_per_60` | numeric | yes |  |
| `ld_shots_against_per_60` | numeric | yes |  |
| `ld_saves_per_60` | numeric | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa_per_60` | numeric | yes |  |
| `rush_attempts_against_per_60` | numeric | yes |  |
| `rebound_attempts_against_per_60` | numeric | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |

## `public.nst_gamelog_goalie_all_counts`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `team` | text | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | yes |  |
| `gp` | integer | yes |  |
| `toi` | numeric | yes |  |
| `shots_against` | integer | yes |  |
| `saves` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `sv_percentage` | numeric | yes |  |
| `gaa` | numeric | yes |  |
| `gsaa` | numeric | yes |  |
| `xg_against` | numeric | yes |  |
| `hd_shots_against` | integer | yes |  |
| `hd_saves` | integer | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa` | numeric | yes |  |
| `md_shots_against` | integer | yes |  |
| `md_saves` | integer | yes |  |
| `md_goals_against` | integer | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa` | numeric | yes |  |
| `ld_shots_against` | integer | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa` | numeric | yes |  |
| `rush_attempts_against` | integer | yes |  |
| `rebound_attempts_against` | integer | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |

## `public.nst_gamelog_goalie_all_rates`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `team` | text | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | yes |  |
| `gp` | integer | yes |  |
| `toi` | numeric | yes |  |
| `toi_per_gp` | numeric | yes |  |
| `shots_against_per_60` | numeric | yes |  |
| `saves_per_60` | numeric | yes |  |
| `sv_percentage` | numeric | yes |  |
| `gaa` | numeric | yes |  |
| `gsaa_per_60` | numeric | yes |  |
| `xg_against_per_60` | numeric | yes |  |
| `hd_shots_against_per_60` | numeric | yes |  |
| `hd_saves_per_60` | numeric | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa_per_60` | numeric | yes |  |
| `md_shots_against_per_60` | numeric | yes |  |
| `md_saves_per_60` | numeric | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa_per_60` | numeric | yes |  |
| `ld_shots_against_per_60` | numeric | yes |  |
| `ld_saves_per_60` | numeric | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa_per_60` | numeric | yes |  |
| `rush_attempts_against_per_60` | numeric | yes |  |
| `rebound_attempts_against_per_60` | numeric | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |

## `public.nst_gamelog_goalie_ev_counts`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `team` | text | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | yes |  |
| `gp` | integer | yes |  |
| `toi` | numeric | yes |  |
| `shots_against` | integer | yes |  |
| `saves` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `sv_percentage` | numeric | yes |  |
| `gaa` | numeric | yes |  |
| `gsaa` | numeric | yes |  |
| `xg_against` | numeric | yes |  |
| `hd_shots_against` | integer | yes |  |
| `hd_saves` | integer | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa` | numeric | yes |  |
| `md_shots_against` | integer | yes |  |
| `md_saves` | integer | yes |  |
| `md_goals_against` | integer | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa` | numeric | yes |  |
| `ld_shots_against` | integer | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa` | numeric | yes |  |
| `rush_attempts_against` | integer | yes |  |
| `rebound_attempts_against` | integer | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |

## `public.nst_gamelog_goalie_ev_rates`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `team` | text | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | yes |  |
| `gp` | integer | yes |  |
| `toi` | numeric | yes |  |
| `toi_per_gp` | numeric | yes |  |
| `shots_against_per_60` | numeric | yes |  |
| `saves_per_60` | numeric | yes |  |
| `sv_percentage` | numeric | yes |  |
| `gaa` | numeric | yes |  |
| `gsaa_per_60` | numeric | yes |  |
| `xg_against_per_60` | numeric | yes |  |
| `hd_shots_against_per_60` | numeric | yes |  |
| `hd_saves_per_60` | numeric | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa_per_60` | numeric | yes |  |
| `md_shots_against_per_60` | numeric | yes |  |
| `md_saves_per_60` | numeric | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa_per_60` | numeric | yes |  |
| `ld_shots_against_per_60` | numeric | yes |  |
| `ld_saves_per_60` | numeric | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa_per_60` | numeric | yes |  |
| `rush_attempts_against_per_60` | numeric | yes |  |
| `rebound_attempts_against_per_60` | numeric | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |

## `public.nst_gamelog_goalie_pk_counts`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `team` | text | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | yes |  |
| `gp` | integer | yes |  |
| `toi` | numeric | yes |  |
| `shots_against` | integer | yes |  |
| `saves` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `sv_percentage` | numeric | yes |  |
| `gaa` | numeric | yes |  |
| `gsaa` | numeric | yes |  |
| `xg_against` | numeric | yes |  |
| `hd_shots_against` | integer | yes |  |
| `hd_saves` | integer | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa` | numeric | yes |  |
| `md_shots_against` | integer | yes |  |
| `md_saves` | integer | yes |  |
| `md_goals_against` | integer | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa` | numeric | yes |  |
| `ld_shots_against` | integer | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa` | numeric | yes |  |
| `rush_attempts_against` | integer | yes |  |
| `rebound_attempts_against` | integer | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |

## `public.nst_gamelog_goalie_pk_rates`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `team` | text | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | yes |  |
| `gp` | integer | yes |  |
| `toi` | numeric | yes |  |
| `toi_per_gp` | numeric | yes |  |
| `shots_against_per_60` | numeric | yes |  |
| `saves_per_60` | numeric | yes |  |
| `sv_percentage` | numeric | yes |  |
| `gaa` | numeric | yes |  |
| `gsaa_per_60` | numeric | yes |  |
| `xg_against_per_60` | numeric | yes |  |
| `hd_shots_against_per_60` | numeric | yes |  |
| `hd_saves_per_60` | numeric | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa_per_60` | numeric | yes |  |
| `md_shots_against_per_60` | numeric | yes |  |
| `md_saves_per_60` | numeric | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa_per_60` | numeric | yes |  |
| `ld_shots_against_per_60` | numeric | yes |  |
| `ld_saves_per_60` | numeric | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa_per_60` | numeric | yes |  |
| `rush_attempts_against_per_60` | numeric | yes |  |
| `rebound_attempts_against_per_60` | numeric | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |

## `public.nst_gamelog_goalie_pp_counts`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `team` | text | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | yes |  |
| `gp` | integer | yes |  |
| `toi` | numeric | yes |  |
| `shots_against` | integer | yes |  |
| `saves` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `sv_percentage` | numeric | yes |  |
| `gaa` | numeric | yes |  |
| `gsaa` | numeric | yes |  |
| `xg_against` | numeric | yes |  |
| `hd_shots_against` | integer | yes |  |
| `hd_saves` | integer | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa` | numeric | yes |  |
| `md_shots_against` | integer | yes |  |
| `md_saves` | integer | yes |  |
| `md_goals_against` | integer | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa` | numeric | yes |  |
| `ld_shots_against` | integer | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa` | numeric | yes |  |
| `rush_attempts_against` | integer | yes |  |
| `rebound_attempts_against` | integer | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |

## `public.nst_gamelog_goalie_pp_rates`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `team` | text | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | yes |  |
| `gp` | integer | yes |  |
| `toi` | numeric | yes |  |
| `toi_per_gp` | numeric | yes |  |
| `shots_against_per_60` | numeric | yes |  |
| `saves_per_60` | numeric | yes |  |
| `sv_percentage` | numeric | yes |  |
| `gaa` | numeric | yes |  |
| `gsaa_per_60` | numeric | yes |  |
| `xg_against_per_60` | numeric | yes |  |
| `hd_shots_against_per_60` | numeric | yes |  |
| `hd_saves_per_60` | numeric | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa_per_60` | numeric | yes |  |
| `md_shots_against_per_60` | numeric | yes |  |
| `md_saves_per_60` | numeric | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa_per_60` | numeric | yes |  |
| `ld_shots_against_per_60` | numeric | yes |  |
| `ld_saves_per_60` | numeric | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa_per_60` | numeric | yes |  |
| `rush_attempts_against_per_60` | numeric | yes |  |
| `rebound_attempts_against_per_60` | numeric | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |

## `public.vw_goalie_stats_unified`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `assists` | integer | yes |  |
| `complete_game_pct` | double precision | yes |  |
| `complete_games` | integer | yes |  |
| `date` | date | yes |  |
| `games_played` | integer | yes |  |
| `games_played_days_rest_0` | integer | yes |  |
| `games_played_days_rest_1` | integer | yes |  |
| `games_played_days_rest_2` | integer | yes |  |
| `games_played_days_rest_3` | integer | yes |  |
| `games_played_days_rest_4_plus` | integer | yes |  |
| `games_started` | integer | yes |  |
| `goals` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `goals_against_avg` | double precision | yes |  |
| `has_nst_5v5_counts` | boolean | yes |  |
| `has_nst_5v5_rates` | boolean | yes |  |
| `has_nst_all_counts` | boolean | yes |  |
| `has_nst_all_rates` | boolean | yes |  |
| `has_nst_ev_counts` | boolean | yes |  |
| `has_nst_ev_rates` | boolean | yes |  |
| `has_nst_pk_counts` | boolean | yes |  |
| `has_nst_pk_rates` | boolean | yes |  |
| `has_nst_pp_counts` | boolean | yes |  |
| `has_nst_pp_rates` | boolean | yes |  |
| `incomplete_games` | integer | yes |  |
| `losses` | integer | yes |  |
| `nst_5v5_counts_avg_goal_distance` | numeric | yes |  |
| `nst_5v5_counts_avg_shot_distance` | numeric | yes |  |
| `nst_5v5_counts_gaa` | numeric | yes |  |
| `nst_5v5_counts_goals_against` | integer | yes |  |
| `nst_5v5_counts_gsaa` | numeric | yes |  |
| `nst_5v5_counts_hd_gaa` | numeric | yes |  |
| `nst_5v5_counts_hd_gsaa` | numeric | yes |  |
| `nst_5v5_counts_hd_saves` | integer | yes |  |
| `nst_5v5_counts_hd_shots_against` | integer | yes |  |
| `nst_5v5_counts_hd_sv_percentage` | numeric | yes |  |
| `nst_5v5_counts_ld_gaa` | numeric | yes |  |
| `nst_5v5_counts_ld_gsaa` | numeric | yes |  |
| `nst_5v5_counts_ld_shots_against` | integer | yes |  |
| `nst_5v5_counts_ld_sv_percentage` | numeric | yes |  |
| `nst_5v5_counts_md_gaa` | numeric | yes |  |
| `nst_5v5_counts_md_goals_against` | integer | yes |  |
| `nst_5v5_counts_md_gsaa` | numeric | yes |  |
| `nst_5v5_counts_md_saves` | integer | yes |  |
| `nst_5v5_counts_md_shots_against` | integer | yes |  |
| `nst_5v5_counts_md_sv_percentage` | numeric | yes |  |
| `nst_5v5_counts_rebound_attempts_against` | integer | yes |  |
| `nst_5v5_counts_rush_attempts_against` | integer | yes |  |
| `nst_5v5_counts_saves` | integer | yes |  |
| `nst_5v5_counts_shots_against` | integer | yes |  |
| `nst_5v5_counts_sv_percentage` | numeric | yes |  |
| `nst_5v5_counts_toi` | numeric | yes |  |
| `nst_5v5_counts_xg_against` | numeric | yes |  |
| `nst_5v5_rates_gaa` | numeric | yes |  |
| `nst_5v5_rates_gsaa_per_60` | numeric | yes |  |
| `nst_5v5_rates_hd_gaa` | numeric | yes |  |
| `nst_5v5_rates_hd_gsaa_per_60` | numeric | yes |  |
| `nst_5v5_rates_hd_saves_per_60` | numeric | yes |  |
| `nst_5v5_rates_hd_shots_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_hd_sv_percentage` | numeric | yes |  |
| `nst_5v5_rates_ld_gaa` | numeric | yes |  |
| `nst_5v5_rates_ld_gsaa_per_60` | numeric | yes |  |
| `nst_5v5_rates_ld_saves_per_60` | numeric | yes |  |
| `nst_5v5_rates_ld_shots_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_ld_sv_percentage` | numeric | yes |  |
| `nst_5v5_rates_md_gaa` | numeric | yes |  |
| `nst_5v5_rates_md_gsaa_per_60` | numeric | yes |  |
| `nst_5v5_rates_md_saves_per_60` | numeric | yes |  |
| `nst_5v5_rates_md_shots_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_md_sv_percentage` | numeric | yes |  |
| `nst_5v5_rates_rebound_attempts_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_rush_attempts_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_saves_per_60` | numeric | yes |  |
| `nst_5v5_rates_shots_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_sv_percentage` | numeric | yes |  |
| `nst_5v5_rates_xg_against_per_60` | numeric | yes |  |
| `nst_all_counts_avg_goal_distance` | numeric | yes |  |
| `nst_all_counts_avg_shot_distance` | numeric | yes |  |
| `nst_all_counts_gaa` | numeric | yes |  |
| `nst_all_counts_goals_against` | integer | yes |  |
| `nst_all_counts_gsaa` | numeric | yes |  |
| `nst_all_counts_hd_gaa` | numeric | yes |  |
| `nst_all_counts_hd_gsaa` | numeric | yes |  |
| `nst_all_counts_hd_saves` | integer | yes |  |
| `nst_all_counts_hd_shots_against` | integer | yes |  |
| `nst_all_counts_hd_sv_percentage` | numeric | yes |  |
| `nst_all_counts_ld_gaa` | numeric | yes |  |
| `nst_all_counts_ld_gsaa` | numeric | yes |  |
| `nst_all_counts_ld_shots_against` | integer | yes |  |
| `nst_all_counts_ld_sv_percentage` | numeric | yes |  |
| `nst_all_counts_md_gaa` | numeric | yes |  |
| `nst_all_counts_md_goals_against` | integer | yes |  |
| `nst_all_counts_md_gsaa` | numeric | yes |  |
| `nst_all_counts_md_saves` | integer | yes |  |
| `nst_all_counts_md_shots_against` | integer | yes |  |
| `nst_all_counts_md_sv_percentage` | numeric | yes |  |
| `nst_all_counts_rebound_attempts_against` | integer | yes |  |
| `nst_all_counts_rush_attempts_against` | integer | yes |  |
| `nst_all_counts_saves` | integer | yes |  |
| `nst_all_counts_shots_against` | integer | yes |  |
| `nst_all_counts_sv_percentage` | numeric | yes |  |
| `nst_all_counts_toi` | numeric | yes |  |
| `nst_all_counts_xg_against` | numeric | yes |  |
| `nst_all_rates_gaa` | numeric | yes |  |
| `nst_all_rates_gsaa_per_60` | numeric | yes |  |
| `nst_all_rates_hd_gaa` | numeric | yes |  |
| `nst_all_rates_hd_gsaa_per_60` | numeric | yes |  |
| `nst_all_rates_hd_saves_per_60` | numeric | yes |  |
| `nst_all_rates_hd_shots_against_per_60` | numeric | yes |  |
| `nst_all_rates_hd_sv_percentage` | numeric | yes |  |
| `nst_all_rates_ld_gaa` | numeric | yes |  |
| `nst_all_rates_ld_gsaa_per_60` | numeric | yes |  |
| `nst_all_rates_ld_saves_per_60` | numeric | yes |  |
| `nst_all_rates_ld_shots_against_per_60` | numeric | yes |  |
| `nst_all_rates_ld_sv_percentage` | numeric | yes |  |
| `nst_all_rates_md_gaa` | numeric | yes |  |
| `nst_all_rates_md_gsaa_per_60` | numeric | yes |  |
| `nst_all_rates_md_saves_per_60` | numeric | yes |  |
| `nst_all_rates_md_shots_against_per_60` | numeric | yes |  |
| `nst_all_rates_md_sv_percentage` | numeric | yes |  |
| `nst_all_rates_rebound_attempts_against_per_60` | numeric | yes |  |
| `nst_all_rates_rush_attempts_against_per_60` | numeric | yes |  |
| `nst_all_rates_saves_per_60` | numeric | yes |  |
| `nst_all_rates_shots_against_per_60` | numeric | yes |  |
| `nst_all_rates_sv_percentage` | numeric | yes |  |
| `nst_all_rates_xg_against_per_60` | numeric | yes |  |
| `nst_ev_counts_avg_goal_distance` | numeric | yes |  |
| `nst_ev_counts_avg_shot_distance` | numeric | yes |  |
| `nst_ev_counts_gaa` | numeric | yes |  |
| `nst_ev_counts_goals_against` | integer | yes |  |
| `nst_ev_counts_gsaa` | numeric | yes |  |
| `nst_ev_counts_hd_gaa` | numeric | yes |  |
| `nst_ev_counts_hd_gsaa` | numeric | yes |  |
| `nst_ev_counts_hd_saves` | integer | yes |  |
| `nst_ev_counts_hd_shots_against` | integer | yes |  |
| `nst_ev_counts_hd_sv_percentage` | numeric | yes |  |
| `nst_ev_counts_ld_gaa` | numeric | yes |  |
| `nst_ev_counts_ld_gsaa` | numeric | yes |  |
| `nst_ev_counts_ld_shots_against` | integer | yes |  |
| `nst_ev_counts_ld_sv_percentage` | numeric | yes |  |
| `nst_ev_counts_md_gaa` | numeric | yes |  |
| `nst_ev_counts_md_goals_against` | integer | yes |  |
| `nst_ev_counts_md_gsaa` | numeric | yes |  |
| `nst_ev_counts_md_saves` | integer | yes |  |
| `nst_ev_counts_md_shots_against` | integer | yes |  |
| `nst_ev_counts_md_sv_percentage` | numeric | yes |  |
| `nst_ev_counts_rebound_attempts_against` | integer | yes |  |
| `nst_ev_counts_rush_attempts_against` | integer | yes |  |
| `nst_ev_counts_saves` | integer | yes |  |
| `nst_ev_counts_shots_against` | integer | yes |  |
| `nst_ev_counts_sv_percentage` | numeric | yes |  |
| `nst_ev_counts_toi` | numeric | yes |  |
| `nst_ev_counts_xg_against` | numeric | yes |  |
| `nst_ev_rates_gaa` | numeric | yes |  |
| `nst_ev_rates_gsaa_per_60` | numeric | yes |  |
| `nst_ev_rates_hd_gaa` | numeric | yes |  |
| `nst_ev_rates_hd_gsaa_per_60` | numeric | yes |  |
| `nst_ev_rates_hd_saves_per_60` | numeric | yes |  |
| `nst_ev_rates_hd_shots_against_per_60` | numeric | yes |  |
| `nst_ev_rates_hd_sv_percentage` | numeric | yes |  |
| `nst_ev_rates_ld_gaa` | numeric | yes |  |
| `nst_ev_rates_ld_gsaa_per_60` | numeric | yes |  |
| `nst_ev_rates_ld_saves_per_60` | numeric | yes |  |
| `nst_ev_rates_ld_shots_against_per_60` | numeric | yes |  |
| `nst_ev_rates_ld_sv_percentage` | numeric | yes |  |
| `nst_ev_rates_md_gaa` | numeric | yes |  |
| `nst_ev_rates_md_gsaa_per_60` | numeric | yes |  |
| `nst_ev_rates_md_saves_per_60` | numeric | yes |  |
| `nst_ev_rates_md_shots_against_per_60` | numeric | yes |  |
| `nst_ev_rates_md_sv_percentage` | numeric | yes |  |
| `nst_ev_rates_rebound_attempts_against_per_60` | numeric | yes |  |
| `nst_ev_rates_rush_attempts_against_per_60` | numeric | yes |  |
| `nst_ev_rates_saves_per_60` | numeric | yes |  |
| `nst_ev_rates_shots_against_per_60` | numeric | yes |  |
| `nst_ev_rates_sv_percentage` | numeric | yes |  |
| `nst_ev_rates_xg_against_per_60` | numeric | yes |  |
| `nst_pk_counts_avg_goal_distance` | numeric | yes |  |
| `nst_pk_counts_avg_shot_distance` | numeric | yes |  |
| `nst_pk_counts_gaa` | numeric | yes |  |
| `nst_pk_counts_goals_against` | integer | yes |  |
| `nst_pk_counts_gsaa` | numeric | yes |  |
| `nst_pk_counts_hd_gaa` | numeric | yes |  |
| `nst_pk_counts_hd_gsaa` | numeric | yes |  |
| `nst_pk_counts_hd_saves` | integer | yes |  |
| `nst_pk_counts_hd_shots_against` | integer | yes |  |
| `nst_pk_counts_hd_sv_percentage` | numeric | yes |  |
| `nst_pk_counts_ld_gaa` | numeric | yes |  |
| `nst_pk_counts_ld_gsaa` | numeric | yes |  |
| `nst_pk_counts_ld_shots_against` | integer | yes |  |
| `nst_pk_counts_ld_sv_percentage` | numeric | yes |  |
| `nst_pk_counts_md_gaa` | numeric | yes |  |
| `nst_pk_counts_md_goals_against` | integer | yes |  |
| `nst_pk_counts_md_gsaa` | numeric | yes |  |
| `nst_pk_counts_md_saves` | integer | yes |  |
| `nst_pk_counts_md_shots_against` | integer | yes |  |
| `nst_pk_counts_md_sv_percentage` | numeric | yes |  |
| `nst_pk_counts_rebound_attempts_against` | integer | yes |  |
| `nst_pk_counts_rush_attempts_against` | integer | yes |  |
| `nst_pk_counts_saves` | integer | yes |  |
| `nst_pk_counts_shots_against` | integer | yes |  |
| `nst_pk_counts_sv_percentage` | numeric | yes |  |
| `nst_pk_counts_toi` | numeric | yes |  |
| `nst_pk_counts_xg_against` | numeric | yes |  |
| `nst_pk_rates_gaa` | numeric | yes |  |
| `nst_pk_rates_gsaa_per_60` | numeric | yes |  |
| `nst_pk_rates_hd_gaa` | numeric | yes |  |
| `nst_pk_rates_hd_gsaa_per_60` | numeric | yes |  |
| `nst_pk_rates_hd_saves_per_60` | numeric | yes |  |
| `nst_pk_rates_hd_shots_against_per_60` | numeric | yes |  |
| `nst_pk_rates_hd_sv_percentage` | numeric | yes |  |
| `nst_pk_rates_ld_gaa` | numeric | yes |  |
| `nst_pk_rates_ld_gsaa_per_60` | numeric | yes |  |
| `nst_pk_rates_ld_saves_per_60` | numeric | yes |  |
| `nst_pk_rates_ld_shots_against_per_60` | numeric | yes |  |
| `nst_pk_rates_ld_sv_percentage` | numeric | yes |  |
| `nst_pk_rates_md_gaa` | numeric | yes |  |
| `nst_pk_rates_md_gsaa_per_60` | numeric | yes |  |
| `nst_pk_rates_md_saves_per_60` | numeric | yes |  |
| `nst_pk_rates_md_shots_against_per_60` | numeric | yes |  |
| `nst_pk_rates_md_sv_percentage` | numeric | yes |  |
| `nst_pk_rates_rebound_attempts_against_per_60` | numeric | yes |  |
| `nst_pk_rates_rush_attempts_against_per_60` | numeric | yes |  |
| `nst_pk_rates_saves_per_60` | numeric | yes |  |
| `nst_pk_rates_shots_against_per_60` | numeric | yes |  |
| `nst_pk_rates_sv_percentage` | numeric | yes |  |
| `nst_pk_rates_xg_against_per_60` | numeric | yes |  |
| `nst_pp_counts_avg_goal_distance` | numeric | yes |  |
| `nst_pp_counts_avg_shot_distance` | numeric | yes |  |
| `nst_pp_counts_gaa` | numeric | yes |  |
| `nst_pp_counts_goals_against` | integer | yes |  |
| `nst_pp_counts_gsaa` | numeric | yes |  |
| `nst_pp_counts_hd_gaa` | numeric | yes |  |
| `nst_pp_counts_hd_gsaa` | numeric | yes |  |
| `nst_pp_counts_hd_saves` | integer | yes |  |
| `nst_pp_counts_hd_shots_against` | integer | yes |  |
| `nst_pp_counts_hd_sv_percentage` | numeric | yes |  |
| `nst_pp_counts_ld_gaa` | numeric | yes |  |
| `nst_pp_counts_ld_gsaa` | numeric | yes |  |
| `nst_pp_counts_ld_shots_against` | integer | yes |  |
| `nst_pp_counts_ld_sv_percentage` | numeric | yes |  |
| `nst_pp_counts_md_gaa` | numeric | yes |  |
| `nst_pp_counts_md_goals_against` | integer | yes |  |
| `nst_pp_counts_md_gsaa` | numeric | yes |  |
| `nst_pp_counts_md_saves` | integer | yes |  |
| `nst_pp_counts_md_shots_against` | integer | yes |  |
| `nst_pp_counts_md_sv_percentage` | numeric | yes |  |
| `nst_pp_counts_rebound_attempts_against` | integer | yes |  |
| `nst_pp_counts_rush_attempts_against` | integer | yes |  |
| `nst_pp_counts_saves` | integer | yes |  |
| `nst_pp_counts_shots_against` | integer | yes |  |
| `nst_pp_counts_sv_percentage` | numeric | yes |  |
| `nst_pp_counts_toi` | numeric | yes |  |
| `nst_pp_counts_xg_against` | numeric | yes |  |
| `nst_pp_rates_gaa` | numeric | yes |  |
| `nst_pp_rates_gsaa_per_60` | numeric | yes |  |
| `nst_pp_rates_hd_gaa` | numeric | yes |  |
| `nst_pp_rates_hd_gsaa_per_60` | numeric | yes |  |
| `nst_pp_rates_hd_saves_per_60` | numeric | yes |  |
| `nst_pp_rates_hd_shots_against_per_60` | numeric | yes |  |
| `nst_pp_rates_hd_sv_percentage` | numeric | yes |  |
| `nst_pp_rates_ld_gaa` | numeric | yes |  |
| `nst_pp_rates_ld_gsaa_per_60` | numeric | yes |  |
| `nst_pp_rates_ld_saves_per_60` | numeric | yes |  |
| `nst_pp_rates_ld_shots_against_per_60` | numeric | yes |  |
| `nst_pp_rates_ld_sv_percentage` | numeric | yes |  |
| `nst_pp_rates_md_gaa` | numeric | yes |  |
| `nst_pp_rates_md_gsaa_per_60` | numeric | yes |  |
| `nst_pp_rates_md_saves_per_60` | numeric | yes |  |
| `nst_pp_rates_md_shots_against_per_60` | numeric | yes |  |
| `nst_pp_rates_md_sv_percentage` | numeric | yes |  |
| `nst_pp_rates_rebound_attempts_against_per_60` | numeric | yes |  |
| `nst_pp_rates_rush_attempts_against_per_60` | numeric | yes |  |
| `nst_pp_rates_saves_per_60` | numeric | yes |  |
| `nst_pp_rates_shots_against_per_60` | numeric | yes |  |
| `nst_pp_rates_sv_percentage` | numeric | yes |  |
| `nst_pp_rates_xg_against_per_60` | numeric | yes |  |
| `ot_losses` | integer | yes |  |
| `player_id` | integer | yes |  |
| `player_name` | text | yes |  |
| `position_code` | text | yes |  |
| `quality_start` | integer | yes |  |
| `quality_starts_pct` | double precision | yes |  |
| `regulation_losses` | integer | yes |  |
| `regulation_wins` | integer | yes |  |
| `save_pct` | double precision | yes |  |
| `save_pct_days_rest_0` | double precision | yes |  |
| `save_pct_days_rest_1` | double precision | yes |  |
| `save_pct_days_rest_2` | double precision | yes |  |
| `save_pct_days_rest_3` | double precision | yes |  |
| `save_pct_days_rest_4_plus` | double precision | yes |  |
| `saves` | integer | yes |  |
| `season_id` | integer | yes |  |
| `shoots_catches` | text | yes |  |
| `shots_against` | integer | yes |  |
| `shots_against_per_60` | double precision | yes |  |
| `shutouts` | integer | yes |  |
| `time_on_ice` | double precision | yes |  |
| `wins` | integer | yes |  |
| `team_id` | smallint | yes |  |
| `view_generated_at` | timestamp with time zone | yes |  |
| `wgo_has_season_id` | boolean | yes |  |
| `nst_supported_season` | boolean | yes |  |
| `nst_any_match` | boolean | yes |  |
| `nst_match_status` | text | yes |  |
| `team_id_source` | text | yes |  |

## `public.vw_goalie_stats_unified_source`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `date` | date | yes |  |
| `season_id` | integer | yes |  |
| `team_id` | smallint | yes |  |
| `player_name` | text | yes |  |
| `position_code` | text | yes |  |
| `shoots_catches` | text | yes |  |
| `games_played` | integer | yes |  |
| `games_started` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `save_pct` | double precision | yes |  |
| `saves` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `goals_against_avg` | double precision | yes |  |
| `shots_against` | integer | yes |  |
| `time_on_ice` | double precision | yes |  |
| `shutouts` | integer | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `complete_game_pct` | double precision | yes |  |
| `complete_games` | integer | yes |  |
| `incomplete_games` | integer | yes |  |
| `quality_start` | integer | yes |  |
| `quality_starts_pct` | double precision | yes |  |
| `regulation_losses` | integer | yes |  |
| `regulation_wins` | integer | yes |  |
| `shots_against_per_60` | double precision | yes |  |
| `games_played_days_rest_0` | integer | yes |  |
| `games_played_days_rest_1` | integer | yes |  |
| `games_played_days_rest_2` | integer | yes |  |
| `games_played_days_rest_3` | integer | yes |  |
| `games_played_days_rest_4_plus` | integer | yes |  |
| `save_pct_days_rest_0` | double precision | yes |  |
| `save_pct_days_rest_1` | double precision | yes |  |
| `save_pct_days_rest_2` | double precision | yes |  |
| `save_pct_days_rest_3` | double precision | yes |  |
| `save_pct_days_rest_4_plus` | double precision | yes |  |
| `nst_5v5_counts_toi` | numeric | yes |  |
| `nst_5v5_counts_shots_against` | integer | yes |  |
| `nst_5v5_counts_saves` | integer | yes |  |
| `nst_5v5_counts_goals_against` | integer | yes |  |
| `nst_5v5_counts_sv_percentage` | numeric | yes |  |
| `nst_5v5_counts_gaa` | numeric | yes |  |
| `nst_5v5_counts_gsaa` | numeric | yes |  |
| `nst_5v5_counts_xg_against` | numeric | yes |  |
| `nst_5v5_counts_hd_shots_against` | integer | yes |  |
| `nst_5v5_counts_hd_saves` | integer | yes |  |
| `nst_5v5_counts_hd_sv_percentage` | numeric | yes |  |
| `nst_5v5_counts_hd_gaa` | numeric | yes |  |
| `nst_5v5_counts_hd_gsaa` | numeric | yes |  |
| `nst_5v5_counts_md_shots_against` | integer | yes |  |
| `nst_5v5_counts_md_saves` | integer | yes |  |
| `nst_5v5_counts_md_goals_against` | integer | yes |  |
| `nst_5v5_counts_md_sv_percentage` | numeric | yes |  |
| `nst_5v5_counts_md_gaa` | numeric | yes |  |
| `nst_5v5_counts_md_gsaa` | numeric | yes |  |
| `nst_5v5_counts_ld_shots_against` | integer | yes |  |
| `nst_5v5_counts_ld_sv_percentage` | numeric | yes |  |
| `nst_5v5_counts_ld_gaa` | numeric | yes |  |
| `nst_5v5_counts_ld_gsaa` | numeric | yes |  |
| `nst_5v5_counts_rush_attempts_against` | integer | yes |  |
| `nst_5v5_counts_rebound_attempts_against` | integer | yes |  |
| `nst_5v5_counts_avg_shot_distance` | numeric | yes |  |
| `nst_5v5_counts_avg_goal_distance` | numeric | yes |  |
| `nst_5v5_rates_shots_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_saves_per_60` | numeric | yes |  |
| `nst_5v5_rates_sv_percentage` | numeric | yes |  |
| `nst_5v5_rates_gaa` | numeric | yes |  |
| `nst_5v5_rates_gsaa_per_60` | numeric | yes |  |
| `nst_5v5_rates_xg_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_hd_shots_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_hd_saves_per_60` | numeric | yes |  |
| `nst_5v5_rates_hd_sv_percentage` | numeric | yes |  |
| `nst_5v5_rates_hd_gaa` | numeric | yes |  |
| `nst_5v5_rates_hd_gsaa_per_60` | numeric | yes |  |
| `nst_5v5_rates_md_shots_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_md_saves_per_60` | numeric | yes |  |
| `nst_5v5_rates_md_sv_percentage` | numeric | yes |  |
| `nst_5v5_rates_md_gaa` | numeric | yes |  |
| `nst_5v5_rates_md_gsaa_per_60` | numeric | yes |  |
| `nst_5v5_rates_ld_shots_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_ld_saves_per_60` | numeric | yes |  |
| `nst_5v5_rates_ld_sv_percentage` | numeric | yes |  |
| `nst_5v5_rates_ld_gaa` | numeric | yes |  |
| `nst_5v5_rates_ld_gsaa_per_60` | numeric | yes |  |
| `nst_5v5_rates_rush_attempts_against_per_60` | numeric | yes |  |
| `nst_5v5_rates_rebound_attempts_against_per_60` | numeric | yes |  |
| `nst_all_counts_toi` | numeric | yes |  |
| `nst_all_counts_shots_against` | integer | yes |  |
| `nst_all_counts_saves` | integer | yes |  |
| `nst_all_counts_goals_against` | integer | yes |  |
| `nst_all_counts_sv_percentage` | numeric | yes |  |
| `nst_all_counts_gaa` | numeric | yes |  |
| `nst_all_counts_gsaa` | numeric | yes |  |
| `nst_all_counts_xg_against` | numeric | yes |  |
| `nst_all_counts_hd_shots_against` | integer | yes |  |
| `nst_all_counts_hd_saves` | integer | yes |  |
| `nst_all_counts_hd_sv_percentage` | numeric | yes |  |
| `nst_all_counts_hd_gaa` | numeric | yes |  |
| `nst_all_counts_hd_gsaa` | numeric | yes |  |
| `nst_all_counts_md_shots_against` | integer | yes |  |
| `nst_all_counts_md_saves` | integer | yes |  |
| `nst_all_counts_md_goals_against` | integer | yes |  |
| `nst_all_counts_md_sv_percentage` | numeric | yes |  |
| `nst_all_counts_md_gaa` | numeric | yes |  |
| `nst_all_counts_md_gsaa` | numeric | yes |  |
| `nst_all_counts_ld_shots_against` | integer | yes |  |
| `nst_all_counts_ld_sv_percentage` | numeric | yes |  |
| `nst_all_counts_ld_gaa` | numeric | yes |  |
| `nst_all_counts_ld_gsaa` | numeric | yes |  |
| `nst_all_counts_rush_attempts_against` | integer | yes |  |
| `nst_all_counts_rebound_attempts_against` | integer | yes |  |
| `nst_all_counts_avg_shot_distance` | numeric | yes |  |
| `nst_all_counts_avg_goal_distance` | numeric | yes |  |
| `nst_all_rates_shots_against_per_60` | numeric | yes |  |
| `nst_all_rates_saves_per_60` | numeric | yes |  |
| `nst_all_rates_sv_percentage` | numeric | yes |  |
| `nst_all_rates_gaa` | numeric | yes |  |
| `nst_all_rates_gsaa_per_60` | numeric | yes |  |
| `nst_all_rates_xg_against_per_60` | numeric | yes |  |
| `nst_all_rates_hd_shots_against_per_60` | numeric | yes |  |
| `nst_all_rates_hd_saves_per_60` | numeric | yes |  |
| `nst_all_rates_hd_sv_percentage` | numeric | yes |  |
| `nst_all_rates_hd_gaa` | numeric | yes |  |
| `nst_all_rates_hd_gsaa_per_60` | numeric | yes |  |
| `nst_all_rates_md_shots_against_per_60` | numeric | yes |  |
| `nst_all_rates_md_saves_per_60` | numeric | yes |  |
| `nst_all_rates_md_sv_percentage` | numeric | yes |  |
| `nst_all_rates_md_gaa` | numeric | yes |  |
| `nst_all_rates_md_gsaa_per_60` | numeric | yes |  |
| `nst_all_rates_ld_shots_against_per_60` | numeric | yes |  |
| `nst_all_rates_ld_saves_per_60` | numeric | yes |  |
| `nst_all_rates_ld_sv_percentage` | numeric | yes |  |
| `nst_all_rates_ld_gaa` | numeric | yes |  |
| `nst_all_rates_ld_gsaa_per_60` | numeric | yes |  |
| `nst_all_rates_rush_attempts_against_per_60` | numeric | yes |  |
| `nst_all_rates_rebound_attempts_against_per_60` | numeric | yes |  |
| `nst_ev_counts_toi` | numeric | yes |  |
| `nst_ev_counts_shots_against` | integer | yes |  |
| `nst_ev_counts_saves` | integer | yes |  |
| `nst_ev_counts_goals_against` | integer | yes |  |
| `nst_ev_counts_sv_percentage` | numeric | yes |  |
| `nst_ev_counts_gaa` | numeric | yes |  |
| `nst_ev_counts_gsaa` | numeric | yes |  |
| `nst_ev_counts_xg_against` | numeric | yes |  |
| `nst_ev_counts_hd_shots_against` | integer | yes |  |
| `nst_ev_counts_hd_saves` | integer | yes |  |
| `nst_ev_counts_hd_sv_percentage` | numeric | yes |  |
| `nst_ev_counts_hd_gaa` | numeric | yes |  |
| `nst_ev_counts_hd_gsaa` | numeric | yes |  |
| `nst_ev_counts_md_shots_against` | integer | yes |  |
| `nst_ev_counts_md_saves` | integer | yes |  |
| `nst_ev_counts_md_goals_against` | integer | yes |  |
| `nst_ev_counts_md_sv_percentage` | numeric | yes |  |
| `nst_ev_counts_md_gaa` | numeric | yes |  |
| `nst_ev_counts_md_gsaa` | numeric | yes |  |
| `nst_ev_counts_ld_shots_against` | integer | yes |  |
| `nst_ev_counts_ld_sv_percentage` | numeric | yes |  |
| `nst_ev_counts_ld_gaa` | numeric | yes |  |
| `nst_ev_counts_ld_gsaa` | numeric | yes |  |
| `nst_ev_counts_rush_attempts_against` | integer | yes |  |
| `nst_ev_counts_rebound_attempts_against` | integer | yes |  |
| `nst_ev_counts_avg_shot_distance` | numeric | yes |  |
| `nst_ev_counts_avg_goal_distance` | numeric | yes |  |
| `nst_ev_rates_shots_against_per_60` | numeric | yes |  |
| `nst_ev_rates_saves_per_60` | numeric | yes |  |
| `nst_ev_rates_sv_percentage` | numeric | yes |  |
| `nst_ev_rates_gaa` | numeric | yes |  |
| `nst_ev_rates_gsaa_per_60` | numeric | yes |  |
| `nst_ev_rates_xg_against_per_60` | numeric | yes |  |
| `nst_ev_rates_hd_shots_against_per_60` | numeric | yes |  |
| `nst_ev_rates_hd_saves_per_60` | numeric | yes |  |
| `nst_ev_rates_hd_sv_percentage` | numeric | yes |  |
| `nst_ev_rates_hd_gaa` | numeric | yes |  |
| `nst_ev_rates_hd_gsaa_per_60` | numeric | yes |  |
| `nst_ev_rates_md_shots_against_per_60` | numeric | yes |  |
| `nst_ev_rates_md_saves_per_60` | numeric | yes |  |
| `nst_ev_rates_md_sv_percentage` | numeric | yes |  |
| `nst_ev_rates_md_gaa` | numeric | yes |  |
| `nst_ev_rates_md_gsaa_per_60` | numeric | yes |  |
| `nst_ev_rates_ld_shots_against_per_60` | numeric | yes |  |
| `nst_ev_rates_ld_saves_per_60` | numeric | yes |  |
| `nst_ev_rates_ld_sv_percentage` | numeric | yes |  |
| `nst_ev_rates_ld_gaa` | numeric | yes |  |
| `nst_ev_rates_ld_gsaa_per_60` | numeric | yes |  |
| `nst_ev_rates_rush_attempts_against_per_60` | numeric | yes |  |
| `nst_ev_rates_rebound_attempts_against_per_60` | numeric | yes |  |
| `nst_pk_counts_toi` | numeric | yes |  |
| `nst_pk_counts_shots_against` | integer | yes |  |
| `nst_pk_counts_saves` | integer | yes |  |
| `nst_pk_counts_goals_against` | integer | yes |  |
| `nst_pk_counts_sv_percentage` | numeric | yes |  |
| `nst_pk_counts_gaa` | numeric | yes |  |
| `nst_pk_counts_gsaa` | numeric | yes |  |
| `nst_pk_counts_xg_against` | numeric | yes |  |
| `nst_pk_counts_hd_shots_against` | integer | yes |  |
| `nst_pk_counts_hd_saves` | integer | yes |  |
| `nst_pk_counts_hd_sv_percentage` | numeric | yes |  |
| `nst_pk_counts_hd_gaa` | numeric | yes |  |
| `nst_pk_counts_hd_gsaa` | numeric | yes |  |
| `nst_pk_counts_md_shots_against` | integer | yes |  |
| `nst_pk_counts_md_saves` | integer | yes |  |
| `nst_pk_counts_md_goals_against` | integer | yes |  |
| `nst_pk_counts_md_sv_percentage` | numeric | yes |  |
| `nst_pk_counts_md_gaa` | numeric | yes |  |
| `nst_pk_counts_md_gsaa` | numeric | yes |  |
| `nst_pk_counts_ld_shots_against` | integer | yes |  |
| `nst_pk_counts_ld_sv_percentage` | numeric | yes |  |
| `nst_pk_counts_ld_gaa` | numeric | yes |  |
| `nst_pk_counts_ld_gsaa` | numeric | yes |  |
| `nst_pk_counts_rush_attempts_against` | integer | yes |  |
| `nst_pk_counts_rebound_attempts_against` | integer | yes |  |
| `nst_pk_counts_avg_shot_distance` | numeric | yes |  |
| `nst_pk_counts_avg_goal_distance` | numeric | yes |  |
| `nst_pk_rates_shots_against_per_60` | numeric | yes |  |
| `nst_pk_rates_saves_per_60` | numeric | yes |  |
| `nst_pk_rates_sv_percentage` | numeric | yes |  |
| `nst_pk_rates_gaa` | numeric | yes |  |
| `nst_pk_rates_gsaa_per_60` | numeric | yes |  |
| `nst_pk_rates_xg_against_per_60` | numeric | yes |  |
| `nst_pk_rates_hd_shots_against_per_60` | numeric | yes |  |
| `nst_pk_rates_hd_saves_per_60` | numeric | yes |  |
| `nst_pk_rates_hd_sv_percentage` | numeric | yes |  |
| `nst_pk_rates_hd_gaa` | numeric | yes |  |
| `nst_pk_rates_hd_gsaa_per_60` | numeric | yes |  |
| `nst_pk_rates_md_shots_against_per_60` | numeric | yes |  |
| `nst_pk_rates_md_saves_per_60` | numeric | yes |  |
| `nst_pk_rates_md_sv_percentage` | numeric | yes |  |
| `nst_pk_rates_md_gaa` | numeric | yes |  |
| `nst_pk_rates_md_gsaa_per_60` | numeric | yes |  |
| `nst_pk_rates_ld_shots_against_per_60` | numeric | yes |  |
| `nst_pk_rates_ld_saves_per_60` | numeric | yes |  |
| `nst_pk_rates_ld_sv_percentage` | numeric | yes |  |
| `nst_pk_rates_ld_gaa` | numeric | yes |  |
| `nst_pk_rates_ld_gsaa_per_60` | numeric | yes |  |
| `nst_pk_rates_rush_attempts_against_per_60` | numeric | yes |  |
| `nst_pk_rates_rebound_attempts_against_per_60` | numeric | yes |  |
| `nst_pp_counts_toi` | numeric | yes |  |
| `nst_pp_counts_shots_against` | integer | yes |  |
| `nst_pp_counts_saves` | integer | yes |  |
| `nst_pp_counts_goals_against` | integer | yes |  |
| `nst_pp_counts_sv_percentage` | numeric | yes |  |
| `nst_pp_counts_gaa` | numeric | yes |  |
| `nst_pp_counts_gsaa` | numeric | yes |  |
| `nst_pp_counts_xg_against` | numeric | yes |  |
| `nst_pp_counts_hd_shots_against` | integer | yes |  |
| `nst_pp_counts_hd_saves` | integer | yes |  |
| `nst_pp_counts_hd_sv_percentage` | numeric | yes |  |
| `nst_pp_counts_hd_gaa` | numeric | yes |  |
| `nst_pp_counts_hd_gsaa` | numeric | yes |  |
| `nst_pp_counts_md_shots_against` | integer | yes |  |
| `nst_pp_counts_md_saves` | integer | yes |  |
| `nst_pp_counts_md_goals_against` | integer | yes |  |
| `nst_pp_counts_md_sv_percentage` | numeric | yes |  |
| `nst_pp_counts_md_gaa` | numeric | yes |  |
| `nst_pp_counts_md_gsaa` | numeric | yes |  |
| `nst_pp_counts_ld_shots_against` | integer | yes |  |
| `nst_pp_counts_ld_sv_percentage` | numeric | yes |  |
| `nst_pp_counts_ld_gaa` | numeric | yes |  |
| `nst_pp_counts_ld_gsaa` | numeric | yes |  |
| `nst_pp_counts_rush_attempts_against` | integer | yes |  |
| `nst_pp_counts_rebound_attempts_against` | integer | yes |  |
| `nst_pp_counts_avg_shot_distance` | numeric | yes |  |
| `nst_pp_counts_avg_goal_distance` | numeric | yes |  |
| `nst_pp_rates_shots_against_per_60` | numeric | yes |  |
| `nst_pp_rates_saves_per_60` | numeric | yes |  |
| `nst_pp_rates_sv_percentage` | numeric | yes |  |
| `nst_pp_rates_gaa` | numeric | yes |  |
| `nst_pp_rates_gsaa_per_60` | numeric | yes |  |
| `nst_pp_rates_xg_against_per_60` | numeric | yes |  |
| `nst_pp_rates_hd_shots_against_per_60` | numeric | yes |  |
| `nst_pp_rates_hd_saves_per_60` | numeric | yes |  |
| `nst_pp_rates_hd_sv_percentage` | numeric | yes |  |
| `nst_pp_rates_hd_gaa` | numeric | yes |  |
| `nst_pp_rates_hd_gsaa_per_60` | numeric | yes |  |
| `nst_pp_rates_md_shots_against_per_60` | numeric | yes |  |
| `nst_pp_rates_md_saves_per_60` | numeric | yes |  |
| `nst_pp_rates_md_sv_percentage` | numeric | yes |  |
| `nst_pp_rates_md_gaa` | numeric | yes |  |
| `nst_pp_rates_md_gsaa_per_60` | numeric | yes |  |
| `nst_pp_rates_ld_shots_against_per_60` | numeric | yes |  |
| `nst_pp_rates_ld_saves_per_60` | numeric | yes |  |
| `nst_pp_rates_ld_sv_percentage` | numeric | yes |  |
| `nst_pp_rates_ld_gaa` | numeric | yes |  |
| `nst_pp_rates_ld_gsaa_per_60` | numeric | yes |  |
| `nst_pp_rates_rush_attempts_against_per_60` | numeric | yes |  |
| `nst_pp_rates_rebound_attempts_against_per_60` | numeric | yes |  |
| `has_nst_5v5_counts` | boolean | yes |  |
| `has_nst_5v5_rates` | boolean | yes |  |
| `has_nst_all_counts` | boolean | yes |  |
| `has_nst_all_rates` | boolean | yes |  |
| `has_nst_ev_counts` | boolean | yes |  |
| `has_nst_ev_rates` | boolean | yes |  |
| `has_nst_pk_counts` | boolean | yes |  |
| `has_nst_pk_rates` | boolean | yes |  |
| `has_nst_pp_counts` | boolean | yes |  |
| `has_nst_pp_rates` | boolean | yes |  |
| `materialized_at` | timestamp with time zone | yes |  |

## `public.wgo_goalie_stats`

Type: table

Primary key: `goalie_id`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `goalie_id` | integer | no |  |
| `goalie_name` | text | no |  |
| `date` | date | no |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `games_played` | integer | yes |  |
| `games_started` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `save_pct` | double precision | yes |  |
| `saves` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `goals_against_avg` | double precision | yes |  |
| `shots_against` | integer | yes |  |
| `time_on_ice` | double precision | yes |  |
| `shutouts` | integer | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `complete_game_pct` | double precision | yes |  |
| `complete_games` | integer | yes |  |
| `incomplete_games` | integer | yes |  |
| `quality_start` | integer | yes |  |
| `quality_starts_pct` | double precision | yes |  |
| `regulation_losses` | integer | yes |  |
| `regulation_wins` | integer | yes |  |
| `shots_against_per_60` | double precision | yes |  |
| `games_played_days_rest_0` | integer | yes |  |
| `games_played_days_rest_1` | integer | yes |  |
| `games_played_days_rest_2` | integer | yes |  |
| `games_played_days_rest_3` | integer | yes |  |
| `games_played_days_rest_4_plus` | integer | yes |  |
| `save_pct_days_rest_0` | double precision | yes |  |
| `save_pct_days_rest_1` | double precision | yes |  |
| `save_pct_days_rest_2` | double precision | yes |  |
| `save_pct_days_rest_3` | double precision | yes |  |
| `save_pct_days_rest_4_plus` | double precision | yes |  |
| `season_id` | integer | yes |  |
| `team_abbreviation` | text | yes |  |

## `public.wgo_goalie_stats_per_game`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `goalie_id` | bigint | yes |  |
| `goalie_name` | text | yes |  |
| `season_id` | integer | yes |  |
| `shoots_catches` | text | yes |  |
| `games_played` | integer | yes |  |
| `games_started` | integer | yes |  |
| `percent_games` | numeric | yes |  |
| `wins` | numeric | yes |  |
| `losses` | numeric | yes |  |
| `saves` | numeric | yes |  |
| `shots_against` | numeric | yes |  |
| `shutouts` | numeric | yes |  |
| `quality_start` | numeric | yes |  |
| `goals_against_avg` | numeric | yes |  |
| `save_pct` | numeric | yes |  |
| `team_abbrevs` | text | yes |  |
| `current_team_abbreviation` | text | yes |  |

## `public.wgo_goalie_stats_totals`

Type: table

Primary key: `goalie_id`, `season_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `goalie_id` | bigint | no |  |
| `goalie_name` | text | yes |  |
| `season_id` | integer | no |  |
| `shoots_catches` | text | yes |  |
| `games_played` | integer | yes |  |
| `games_started` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `save_pct` | numeric | yes |  |
| `saves` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `goals_against_avg` | numeric | yes |  |
| `shots_against` | integer | yes |  |
| `time_on_ice` | numeric | yes |  |
| `shutouts` | integer | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `complete_game_pct` | numeric | yes |  |
| `complete_games` | integer | yes |  |
| `incomplete_games` | integer | yes |  |
| `quality_start` | integer | yes |  |
| `quality_starts_pct` | numeric | yes |  |
| `regulation_losses` | integer | yes |  |
| `regulation_wins` | integer | yes |  |
| `shots_against_per_60` | numeric | yes |  |
| `team_abbrevs` | text | yes |  |
| `updated_at` | timestamp with time zone | yes | now() |
| `current_team_abbreviation` | text | yes |  |

## `public.wigo_career`

Type: table

Primary key: `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `last_updated` | timestamp with time zone | no | now() |
| `std_gp` | integer | yes |  |
| `std_atoi` | double precision | yes |  |
| `std_pptoi` | double precision | yes |  |
| `std_pp_pct` | double precision | yes |  |
| `std_g` | integer | yes |  |
| `std_a` | integer | yes |  |
| `std_pts` | integer | yes |  |
| `std_pts1_pct` | double precision | yes |  |
| `std_sog` | integer | yes |  |
| `std_s_pct` | double precision | yes |  |
| `std_ixg` | double precision | yes |  |
| `std_ipp` | double precision | yes |  |
| `std_oi_sh_pct` | double precision | yes |  |
| `std_ozs_pct` | double precision | yes |  |
| `std_icf` | integer | yes |  |
| `std_ppg` | integer | yes |  |
| `std_ppa` | integer | yes |  |
| `std_ppp` | integer | yes |  |
| `std_hit` | integer | yes |  |
| `std_blk` | integer | yes |  |
| `std_pim` | integer | yes |  |
| `std_g_per_60` | double precision | yes |  |
| `std_a_per_60` | double precision | yes |  |
| `std_pts_per_60` | double precision | yes |  |
| `std_pts1_per_60` | double precision | yes |  |
| `std_sog_per_60` | double precision | yes |  |
| `std_ixg_per_60` | double precision | yes |  |
| `std_icf_per_60` | double precision | yes |  |
| `std_ihdcf_per_60` | double precision | yes |  |
| `std_iscf_per_60` | double precision | yes |  |
| `std_ppg_per_60` | double precision | yes |  |
| `std_ppa_per_60` | double precision | yes |  |
| `std_ppp_per_60` | double precision | yes |  |
| `std_hit_per_60` | double precision | yes |  |
| `std_blk_per_60` | double precision | yes |  |
| `std_pim_per_60` | double precision | yes |  |
| `ly_gp` | integer | yes |  |
| `ly_atoi` | double precision | yes |  |
| `ly_pptoi` | double precision | yes |  |
| `ly_pp_pct` | double precision | yes |  |
| `ly_g` | integer | yes |  |
| `ly_a` | integer | yes |  |
| `ly_pts` | integer | yes |  |
| `ly_pts1_pct` | double precision | yes |  |
| `ly_sog` | integer | yes |  |
| `ly_s_pct` | double precision | yes |  |
| `ly_ixg` | double precision | yes |  |
| `ly_ipp` | double precision | yes |  |
| `ly_oi_sh_pct` | double precision | yes |  |
| `ly_ozs_pct` | double precision | yes |  |
| `ly_icf` | integer | yes |  |
| `ly_ppg` | integer | yes |  |
| `ly_ppa` | integer | yes |  |
| `ly_ppp` | integer | yes |  |
| `ly_hit` | integer | yes |  |
| `ly_blk` | integer | yes |  |
| `ly_pim` | integer | yes |  |
| `ly_g_per_60` | double precision | yes |  |
| `ly_a_per_60` | double precision | yes |  |
| `ly_pts_per_60` | double precision | yes |  |
| `ly_pts1_per_60` | double precision | yes |  |
| `ly_sog_per_60` | double precision | yes |  |
| `ly_ixg_per_60` | double precision | yes |  |
| `ly_icf_per_60` | double precision | yes |  |
| `ly_ihdcf_per_60` | double precision | yes |  |
| `ly_iscf_per_60` | double precision | yes |  |
| `ly_ppg_per_60` | double precision | yes |  |
| `ly_ppa_per_60` | double precision | yes |  |
| `ly_ppp_per_60` | double precision | yes |  |
| `ly_hit_per_60` | double precision | yes |  |
| `ly_blk_per_60` | double precision | yes |  |
| `ly_pim_per_60` | double precision | yes |  |
| `ya3_seasons_used` | integer | yes |  |
| `ya3_gp` | double precision | yes |  |
| `ya3_atoi` | double precision | yes |  |
| `ya3_pptoi` | double precision | yes |  |
| `ya3_pp_pct` | double precision | yes |  |
| `ya3_g` | double precision | yes |  |
| `ya3_a` | double precision | yes |  |
| `ya3_pts` | double precision | yes |  |
| `ya3_pts1_pct` | double precision | yes |  |
| `ya3_sog` | double precision | yes |  |
| `ya3_s_pct` | double precision | yes |  |
| `ya3_ixg` | double precision | yes |  |
| `ya3_ipp` | double precision | yes |  |
| `ya3_oi_sh_pct` | double precision | yes |  |
| `ya3_ozs_pct` | double precision | yes |  |
| `ya3_icf` | double precision | yes |  |
| `ya3_ppg` | double precision | yes |  |
| `ya3_ppa` | double precision | yes |  |
| `ya3_ppp` | double precision | yes |  |
| `ya3_hit` | double precision | yes |  |
| `ya3_blk` | double precision | yes |  |
| `ya3_pim` | double precision | yes |  |
| `ya3_g_per_60` | double precision | yes |  |
| `ya3_a_per_60` | double precision | yes |  |
| `ya3_pts_per_60` | double precision | yes |  |
| `ya3_pts1_per_60` | double precision | yes |  |
| `ya3_sog_per_60` | double precision | yes |  |
| `ya3_ixg_per_60` | double precision | yes |  |
| `ya3_icf_per_60` | double precision | yes |  |
| `ya3_ihdcf_per_60` | double precision | yes |  |
| `ya3_iscf_per_60` | double precision | yes |  |
| `ya3_ppg_per_60` | double precision | yes |  |
| `ya3_ppa_per_60` | double precision | yes |  |
| `ya3_ppp_per_60` | double precision | yes |  |
| `ya3_hit_per_60` | double precision | yes |  |
| `ya3_blk_per_60` | double precision | yes |  |
| `ya3_pim_per_60` | double precision | yes |  |
| `ca_seasons_used` | integer | yes |  |
| `ca_gp` | double precision | yes |  |
| `ca_atoi` | double precision | yes |  |
| `ca_pptoi` | double precision | yes |  |
| `ca_pp_pct` | double precision | yes |  |
| `ca_g` | double precision | yes |  |
| `ca_a` | double precision | yes |  |
| `ca_pts` | double precision | yes |  |
| `ca_pts1_pct` | double precision | yes |  |
| `ca_sog` | double precision | yes |  |
| `ca_s_pct` | double precision | yes |  |
| `ca_ixg` | double precision | yes |  |
| `ca_ipp` | double precision | yes |  |
| `ca_oi_sh_pct` | double precision | yes |  |
| `ca_ozs_pct` | double precision | yes |  |
| `ca_icf` | double precision | yes |  |
| `ca_ppg` | double precision | yes |  |
| `ca_ppa` | double precision | yes |  |
| `ca_ppp` | double precision | yes |  |
| `ca_hit` | double precision | yes |  |
| `ca_blk` | double precision | yes |  |
| `ca_pim` | double precision | yes |  |
| `ca_g_per_60` | double precision | yes |  |
| `ca_a_per_60` | double precision | yes |  |
| `ca_pts_per_60` | double precision | yes |  |
| `ca_pts1_per_60` | double precision | yes |  |
| `ca_sog_per_60` | double precision | yes |  |
| `ca_ixg_per_60` | double precision | yes |  |
| `ca_icf_per_60` | double precision | yes |  |
| `ca_ihdcf_per_60` | double precision | yes |  |
| `ca_iscf_per_60` | double precision | yes |  |
| `ca_ppg_per_60` | double precision | yes |  |
| `ca_ppa_per_60` | double precision | yes |  |
| `ca_ppp_per_60` | double precision | yes |  |
| `ca_hit_per_60` | double precision | yes |  |
| `ca_blk_per_60` | double precision | yes |  |
| `ca_pim_per_60` | double precision | yes |  |

## `public.wigo_counts`

Type: table

Primary key: `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `updated_at` | timestamp with time zone | no | now() |
| `gp_ca` | integer | yes |  |
| `gp_3ya` | integer | yes |  |
| `gp_ly` | integer | yes |  |
| `gp_std` | integer | yes |  |
| `gp_l20` | integer | yes |  |
| `gp_l10` | integer | yes |  |
| `gp_l5` | integer | yes |  |
| `toi_ca` | double precision | yes |  |
| `toi_3ya` | double precision | yes |  |
| `toi_ly` | double precision | yes |  |
| `toi_std` | double precision | yes |  |
| `toi_l20` | double precision | yes |  |
| `toi_l10` | double precision | yes |  |
| `toi_l5` | double precision | yes |  |
| `pptoi_ca` | double precision | yes |  |
| `pptoi_3ya` | double precision | yes |  |
| `pptoi_ly` | double precision | yes |  |
| `pptoi_std` | double precision | yes |  |
| `pptoi_l20` | double precision | yes |  |
| `pptoi_l10` | double precision | yes |  |
| `pptoi_l5` | double precision | yes |  |
| `pp_pct_ca` | double precision | yes |  |
| `pp_pct_3ya` | double precision | yes |  |
| `pp_pct_ly` | double precision | yes |  |
| `pp_pct_std` | double precision | yes |  |
| `pp_pct_l20` | double precision | yes |  |
| `pp_pct_l10` | double precision | yes |  |
| `pp_pct_l5` | double precision | yes |  |
| `g_ca` | double precision | yes |  |
| `g_3ya` | double precision | yes |  |
| `g_ly` | integer | yes |  |
| `g_std` | integer | yes |  |
| `g_l20` | integer | yes |  |
| `g_l10` | integer | yes |  |
| `g_l5` | integer | yes |  |
| `a_ca` | double precision | yes |  |
| `a_3ya` | double precision | yes |  |
| `a_ly` | integer | yes |  |
| `a_std` | integer | yes |  |
| `a_l20` | integer | yes |  |
| `a_l10` | integer | yes |  |
| `a_l5` | integer | yes |  |
| `pts_ca` | double precision | yes |  |
| `pts_3ya` | double precision | yes |  |
| `pts_ly` | integer | yes |  |
| `pts_std` | integer | yes |  |
| `pts_l20` | integer | yes |  |
| `pts_l10` | integer | yes |  |
| `pts_l5` | integer | yes |  |
| `a1_ca` | double precision | yes |  |
| `a1_3ya` | double precision | yes |  |
| `a1_ly` | integer | yes |  |
| `a1_std` | integer | yes |  |
| `a1_l20` | integer | yes |  |
| `a1_l10` | integer | yes |  |
| `a1_l5` | integer | yes |  |
| `a2_ca` | double precision | yes |  |
| `a2_3ya` | double precision | yes |  |
| `a2_ly` | integer | yes |  |
| `a2_std` | integer | yes |  |
| `a2_l20` | integer | yes |  |
| `a2_l10` | integer | yes |  |
| `a2_l5` | integer | yes |  |
| `pts1_ca` | double precision | yes |  |
| `pts1_3ya` | double precision | yes |  |
| `pts1_ly` | integer | yes |  |
| `pts1_std` | integer | yes |  |
| `pts1_l20` | integer | yes |  |
| `pts1_l10` | integer | yes |  |
| `pts1_l5` | integer | yes |  |
| `pts1_pct_ca` | double precision | yes |  |
| `pts1_pct_3ya` | double precision | yes |  |
| `pts1_pct_ly` | double precision | yes |  |
| `pts1_pct_std` | double precision | yes |  |
| `pts1_pct_l20` | double precision | yes |  |
| `pts1_pct_l10` | double precision | yes |  |
| `pts1_pct_l5` | double precision | yes |  |
| `sog_ca` | double precision | yes |  |
| `sog_3ya` | double precision | yes |  |
| `sog_ly` | integer | yes |  |
| `sog_std` | integer | yes |  |
| `sog_l20` | integer | yes |  |
| `sog_l10` | integer | yes |  |
| `sog_l5` | integer | yes |  |
| `sh_pct_ca` | double precision | yes |  |
| `sh_pct_3ya` | double precision | yes |  |
| `sh_pct_ly` | double precision | yes |  |
| `sh_pct_std` | double precision | yes |  |
| `sh_pct_l20` | double precision | yes |  |
| `sh_pct_l10` | double precision | yes |  |
| `sh_pct_l5` | double precision | yes |  |
| `ixg_ca` | double precision | yes |  |
| `ixg_3ya` | double precision | yes |  |
| `ixg_ly` | double precision | yes |  |
| `ixg_std` | double precision | yes |  |
| `ixg_l20` | double precision | yes |  |
| `ixg_l10` | double precision | yes |  |
| `ixg_l5` | double precision | yes |  |
| `ipp_ca` | double precision | yes |  |
| `ipp_3ya` | double precision | yes |  |
| `ipp_ly` | double precision | yes |  |
| `ipp_std` | double precision | yes |  |
| `ipp_l20` | double precision | yes |  |
| `ipp_l10` | double precision | yes |  |
| `ipp_l5` | double precision | yes |  |
| `oish_pct_ca` | double precision | yes |  |
| `oish_pct_3ya` | double precision | yes |  |
| `oish_pct_ly` | double precision | yes |  |
| `oish_pct_std` | double precision | yes |  |
| `oish_pct_l20` | double precision | yes |  |
| `oish_pct_l10` | double precision | yes |  |
| `oish_pct_l5` | double precision | yes |  |
| `ozs_pct_ca` | double precision | yes |  |
| `ozs_pct_3ya` | double precision | yes |  |
| `ozs_pct_ly` | double precision | yes |  |
| `ozs_pct_std` | double precision | yes |  |
| `ozs_pct_l20` | double precision | yes |  |
| `ozs_pct_l10` | double precision | yes |  |
| `ozs_pct_l5` | double precision | yes |  |
| `icf_ca` | double precision | yes |  |
| `icf_3ya` | double precision | yes |  |
| `icf_ly` | double precision | yes |  |
| `icf_std` | double precision | yes |  |
| `icf_l20` | double precision | yes |  |
| `icf_l10` | double precision | yes |  |
| `icf_l5` | double precision | yes |  |
| `ppg_ca` | double precision | yes |  |
| `ppg_3ya` | double precision | yes |  |
| `ppg_ly` | integer | yes |  |
| `ppg_std` | integer | yes |  |
| `ppg_l20` | integer | yes |  |
| `ppg_l10` | integer | yes |  |
| `ppg_l5` | integer | yes |  |
| `ppa_ca` | double precision | yes |  |
| `ppa_3ya` | double precision | yes |  |
| `ppa_ly` | integer | yes |  |
| `ppa_std` | integer | yes |  |
| `ppa_l20` | integer | yes |  |
| `ppa_l10` | integer | yes |  |
| `ppa_l5` | integer | yes |  |
| `ppa1_ca` | double precision | yes |  |
| `ppa1_3ya` | double precision | yes |  |
| `ppa1_ly` | integer | yes |  |
| `ppa1_std` | integer | yes |  |
| `ppa1_l20` | integer | yes |  |
| `ppa1_l10` | integer | yes |  |
| `ppa1_l5` | integer | yes |  |
| `ppa2_ca` | double precision | yes |  |
| `ppa2_3ya` | double precision | yes |  |
| `ppa2_ly` | integer | yes |  |
| `ppa2_std` | integer | yes |  |
| `ppa2_l20` | integer | yes |  |
| `ppa2_l10` | integer | yes |  |
| `ppa2_l5` | integer | yes |  |
| `ppp_ca` | double precision | yes |  |
| `ppp_3ya` | double precision | yes |  |
| `ppp_ly` | integer | yes |  |
| `ppp_std` | integer | yes |  |
| `ppp_l20` | integer | yes |  |
| `ppp_l10` | integer | yes |  |
| `ppp_l5` | integer | yes |  |
| `hit_ca` | double precision | yes |  |
| `hit_3ya` | double precision | yes |  |
| `hit_ly` | integer | yes |  |
| `hit_std` | integer | yes |  |
| `hit_l20` | integer | yes |  |
| `hit_l10` | integer | yes |  |
| `hit_l5` | integer | yes |  |
| `blk_ca` | double precision | yes |  |
| `blk_3ya` | double precision | yes |  |
| `blk_ly` | integer | yes |  |
| `blk_std` | integer | yes |  |
| `blk_l20` | integer | yes |  |
| `blk_l10` | integer | yes |  |
| `blk_l5` | integer | yes |  |
| `pim_ca` | double precision | yes |  |
| `pim_3ya` | double precision | yes |  |
| `pim_ly` | integer | yes |  |
| `pim_std` | integer | yes |  |
| `pim_l20` | integer | yes |  |
| `pim_l10` | integer | yes |  |
| `pim_l5` | integer | yes |  |

## `public.wigo_goalies`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `goalie_id` | integer | yes |  |
| `goalie_name` | text | yes |  |
| `date` | date | yes |  |
| `team` | text | yes |  |
| `season` | integer | yes |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `games_played` | integer | yes |  |
| `games_started` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `saves` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `shots_against` | integer | yes |  |
| `shutouts` | integer | yes |  |
| `goals_scored_by_goalie` | integer | yes |  |
| `assists_by_goalie` | integer | yes |  |
| `complete_games` | integer | yes |  |
| `incomplete_games` | integer | yes |  |
| `quality_start` | integer | yes |  |
| `regulation_losses` | integer | yes |  |
| `regulation_wins` | integer | yes |  |
| `save_percentage` | double precision | yes |  |
| `gaa` | double precision | yes |  |
| `time_on_ice_seconds` | double precision | yes |  |
| `complete_game_pct` | double precision | yes |  |
| `quality_starts_pct` | double precision | yes |  |
| `games_played_days_rest_0` | integer | yes |  |
| `games_played_days_rest_1` | integer | yes |  |
| `games_played_days_rest_2` | integer | yes |  |
| `games_played_days_rest_3` | integer | yes |  |
| `games_played_days_rest_4_plus` | integer | yes |  |
| `save_pct_days_rest_0` | double precision | yes |  |
| `save_pct_days_rest_1` | double precision | yes |  |
| `save_pct_days_rest_2` | double precision | yes |  |
| `save_pct_days_rest_3` | double precision | yes |  |
| `save_pct_days_rest_4_plus` | double precision | yes |  |
| `gsaa` | numeric | yes |  |
| `xg_against` | numeric | yes |  |
| `hd_shots_against` | integer | yes |  |
| `hd_saves` | integer | yes |  |
| `hd_sv_percentage` | numeric | yes |  |
| `hd_gaa` | numeric | yes |  |
| `hd_gsaa` | numeric | yes |  |
| `md_shots_against` | integer | yes |  |
| `md_saves` | integer | yes |  |
| `md_goals_against` | integer | yes |  |
| `md_sv_percentage` | numeric | yes |  |
| `md_gaa` | numeric | yes |  |
| `md_gsaa` | numeric | yes |  |
| `ld_shots_against` | integer | yes |  |
| `ld_sv_percentage` | numeric | yes |  |
| `ld_gaa` | numeric | yes |  |
| `ld_gsaa` | numeric | yes |  |
| `rush_attempts_against` | integer | yes |  |
| `rebound_attempts_against` | integer | yes |  |
| `avg_shot_distance` | numeric | yes |  |
| `avg_goal_distance` | numeric | yes |  |
| `toi_per_gp` | numeric | yes |  |
| `shots_against_per_60` | numeric | yes |  |
| `saves_per_60` | numeric | yes |  |
| `gsaa_per_60` | numeric | yes |  |
| `xg_against_per_60` | numeric | yes |  |
| `hd_shots_against_per_60` | numeric | yes |  |
| `hd_saves_per_60` | numeric | yes |  |
| `hd_gsaa_per_60` | numeric | yes |  |
| `md_shots_against_per_60` | numeric | yes |  |
| `md_saves_per_60` | numeric | yes |  |
| `md_gsaa_per_60` | numeric | yes |  |
| `ld_shots_against_per_60` | numeric | yes |  |
| `ld_saves_per_60` | numeric | yes |  |
| `ld_gsaa_per_60` | numeric | yes |  |
| `rush_attempts_against_per_60` | numeric | yes |  |
| `rebound_attempts_against_per_60` | numeric | yes |  |

## `public.wigo_per_game`

Type: table

Primary key: `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `updated_at` | timestamp with time zone | no | now() |
| `atoi_ca` | double precision | yes |  |
| `atoi_3ya` | double precision | yes |  |
| `atoi_ly` | double precision | yes |  |
| `atoi_std` | double precision | yes |  |
| `atoi_l20` | double precision | yes |  |
| `atoi_l10` | double precision | yes |  |
| `atoi_l5` | double precision | yes |  |
| `pptoi_ca` | double precision | yes |  |
| `pptoi_3ya` | double precision | yes |  |
| `pptoi_ly` | double precision | yes |  |
| `pptoi_std` | double precision | yes |  |
| `pptoi_l20` | double precision | yes |  |
| `pptoi_l10` | double precision | yes |  |
| `pptoi_l5` | double precision | yes |  |
| `g_per_game_ca` | double precision | yes |  |
| `g_per_game_3ya` | double precision | yes |  |
| `g_per_game_ly` | double precision | yes |  |
| `g_per_game_std` | double precision | yes |  |
| `g_per_game_l20` | double precision | yes |  |
| `g_per_game_l10` | double precision | yes |  |
| `g_per_game_l5` | double precision | yes |  |
| `a_per_game_ca` | double precision | yes |  |
| `a_per_game_3ya` | double precision | yes |  |
| `a_per_game_ly` | double precision | yes |  |
| `a_per_game_std` | double precision | yes |  |
| `a_per_game_l20` | double precision | yes |  |
| `a_per_game_l10` | double precision | yes |  |
| `a_per_game_l5` | double precision | yes |  |
| `pts_per_game_ca` | double precision | yes |  |
| `pts_per_game_3ya` | double precision | yes |  |
| `pts_per_game_ly` | double precision | yes |  |
| `pts_per_game_std` | double precision | yes |  |
| `pts_per_game_l20` | double precision | yes |  |
| `pts_per_game_l10` | double precision | yes |  |
| `pts_per_game_l5` | double precision | yes |  |
| `pts1_per_game_ca` | double precision | yes |  |
| `pts1_per_game_3ya` | double precision | yes |  |
| `pts1_per_game_ly` | double precision | yes |  |
| `pts1_per_game_std` | double precision | yes |  |
| `pts1_per_game_l20` | double precision | yes |  |
| `pts1_per_game_l10` | double precision | yes |  |
| `pts1_per_game_l5` | double precision | yes |  |
| `sog_per_game_ca` | double precision | yes |  |
| `sog_per_game_3ya` | double precision | yes |  |
| `sog_per_game_ly` | double precision | yes |  |
| `sog_per_game_std` | double precision | yes |  |
| `sog_per_game_l20` | double precision | yes |  |
| `sog_per_game_l10` | double precision | yes |  |
| `sog_per_game_l5` | double precision | yes |  |
| `ixg_per_game_ca` | double precision | yes |  |
| `ixg_per_game_3ya` | double precision | yes |  |
| `ixg_per_game_ly` | double precision | yes |  |
| `ixg_per_game_std` | double precision | yes |  |
| `ixg_per_game_l20` | double precision | yes |  |
| `ixg_per_game_l10` | double precision | yes |  |
| `ixg_per_game_l5` | double precision | yes |  |
| `ppg_per_game_ca` | double precision | yes |  |
| `ppg_per_game_3ya` | double precision | yes |  |
| `ppg_per_game_ly` | double precision | yes |  |
| `ppg_per_game_std` | double precision | yes |  |
| `ppg_per_game_l20` | double precision | yes |  |
| `ppg_per_game_l10` | double precision | yes |  |
| `ppg_per_game_l5` | double precision | yes |  |
| `ppa_per_game_ca` | double precision | yes |  |
| `ppa_per_game_3ya` | double precision | yes |  |
| `ppa_per_game_ly` | double precision | yes |  |
| `ppa_per_game_std` | double precision | yes |  |
| `ppa_per_game_l20` | double precision | yes |  |
| `ppa_per_game_l10` | double precision | yes |  |
| `ppa_per_game_l5` | double precision | yes |  |
| `ppp_per_game_ca` | double precision | yes |  |
| `ppp_per_game_3ya` | double precision | yes |  |
| `ppp_per_game_ly` | double precision | yes |  |
| `ppp_per_game_std` | double precision | yes |  |
| `ppp_per_game_l20` | double precision | yes |  |
| `ppp_per_game_l10` | double precision | yes |  |
| `ppp_per_game_l5` | double precision | yes |  |
| `hit_per_game_ca` | double precision | yes |  |
| `hit_per_game_3ya` | double precision | yes |  |
| `hit_per_game_ly` | double precision | yes |  |
| `hit_per_game_std` | double precision | yes |  |
| `hit_per_game_l20` | double precision | yes |  |
| `hit_per_game_l10` | double precision | yes |  |
| `hit_per_game_l5` | double precision | yes |  |
| `blk_per_game_ca` | double precision | yes |  |
| `blk_per_game_3ya` | double precision | yes |  |
| `blk_per_game_ly` | double precision | yes |  |
| `blk_per_game_std` | double precision | yes |  |
| `blk_per_game_l20` | double precision | yes |  |
| `blk_per_game_l10` | double precision | yes |  |
| `blk_per_game_l5` | double precision | yes |  |
| `pim_per_game_ca` | double precision | yes |  |
| `pim_per_game_3ya` | double precision | yes |  |
| `pim_per_game_ly` | double precision | yes |  |
| `pim_per_game_std` | double precision | yes |  |
| `pim_per_game_l20` | double precision | yes |  |
| `pim_per_game_l10` | double precision | yes |  |
| `pim_per_game_l5` | double precision | yes |  |

## `public.wigo_rates`

Type: table

Primary key: `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `updated_at` | timestamp with time zone | no | now() |
| `g_per_60_ca` | double precision | yes |  |
| `g_per_60_3ya` | double precision | yes |  |
| `g_per_60_ly` | double precision | yes |  |
| `g_per_60_std` | double precision | yes |  |
| `g_per_60_l20` | double precision | yes |  |
| `g_per_60_l10` | double precision | yes |  |
| `g_per_60_l5` | double precision | yes |  |
| `a_per_60_ca` | double precision | yes |  |
| `a_per_60_3ya` | double precision | yes |  |
| `a_per_60_ly` | double precision | yes |  |
| `a_per_60_std` | double precision | yes |  |
| `a_per_60_l20` | double precision | yes |  |
| `a_per_60_l10` | double precision | yes |  |
| `a_per_60_l5` | double precision | yes |  |
| `pts_per_60_ca` | double precision | yes |  |
| `pts_per_60_3ya` | double precision | yes |  |
| `pts_per_60_ly` | double precision | yes |  |
| `pts_per_60_std` | double precision | yes |  |
| `pts_per_60_l20` | double precision | yes |  |
| `pts_per_60_l10` | double precision | yes |  |
| `pts_per_60_l5` | double precision | yes |  |
| `pts1_per_60_ca` | double precision | yes |  |
| `pts1_per_60_3ya` | double precision | yes |  |
| `pts1_per_60_ly` | double precision | yes |  |
| `pts1_per_60_std` | double precision | yes |  |
| `pts1_per_60_l20` | double precision | yes |  |
| `pts1_per_60_l10` | double precision | yes |  |
| `pts1_per_60_l5` | double precision | yes |  |
| `sog_per_60_ca` | double precision | yes |  |
| `sog_per_60_3ya` | double precision | yes |  |
| `sog_per_60_ly` | double precision | yes |  |
| `sog_per_60_std` | double precision | yes |  |
| `sog_per_60_l20` | double precision | yes |  |
| `sog_per_60_l10` | double precision | yes |  |
| `sog_per_60_l5` | double precision | yes |  |
| `ixg_per_60_ca` | double precision | yes |  |
| `ixg_per_60_3ya` | double precision | yes |  |
| `ixg_per_60_ly` | double precision | yes |  |
| `ixg_per_60_std` | double precision | yes |  |
| `ixg_per_60_l20` | double precision | yes |  |
| `ixg_per_60_l10` | double precision | yes |  |
| `ixg_per_60_l5` | double precision | yes |  |
| `icf_per_60_ca` | double precision | yes |  |
| `icf_per_60_3ya` | double precision | yes |  |
| `icf_per_60_ly` | double precision | yes |  |
| `icf_per_60_std` | double precision | yes |  |
| `icf_per_60_l20` | double precision | yes |  |
| `icf_per_60_l10` | double precision | yes |  |
| `icf_per_60_l5` | double precision | yes |  |
| `ppg_per_60_ca` | double precision | yes |  |
| `ppg_per_60_3ya` | double precision | yes |  |
| `ppg_per_60_ly` | double precision | yes |  |
| `ppg_per_60_std` | double precision | yes |  |
| `ppg_per_60_l20` | double precision | yes |  |
| `ppg_per_60_l10` | double precision | yes |  |
| `ppg_per_60_l5` | double precision | yes |  |
| `ppa_per_60_ca` | double precision | yes |  |
| `ppa_per_60_3ya` | double precision | yes |  |
| `ppa_per_60_ly` | double precision | yes |  |
| `ppa_per_60_std` | double precision | yes |  |
| `ppa_per_60_l20` | double precision | yes |  |
| `ppa_per_60_l10` | double precision | yes |  |
| `ppa_per_60_l5` | double precision | yes |  |
| `ppp_per_60_ca` | double precision | yes |  |
| `ppp_per_60_3ya` | double precision | yes |  |
| `ppp_per_60_ly` | double precision | yes |  |
| `ppp_per_60_std` | double precision | yes |  |
| `ppp_per_60_l20` | double precision | yes |  |
| `ppp_per_60_l10` | double precision | yes |  |
| `ppp_per_60_l5` | double precision | yes |  |
| `ppg_per_60pp_ca` | double precision | yes |  |
| `ppg_per_60pp_3ya` | double precision | yes |  |
| `ppg_per_60pp_ly` | double precision | yes |  |
| `ppg_per_60pp_std` | double precision | yes |  |
| `ppg_per_60pp_l20` | double precision | yes |  |
| `ppg_per_60pp_l10` | double precision | yes |  |
| `ppg_per_60pp_l5` | double precision | yes |  |
| `ppa_per_60pp_ca` | double precision | yes |  |
| `ppa_per_60pp_3ya` | double precision | yes |  |
| `ppa_per_60pp_ly` | double precision | yes |  |
| `ppa_per_60pp_std` | double precision | yes |  |
| `ppa_per_60pp_l20` | double precision | yes |  |
| `ppa_per_60pp_l10` | double precision | yes |  |
| `ppa_per_60pp_l5` | double precision | yes |  |
| `ppp_per_60pp_ca` | double precision | yes |  |
| `ppp_per_60pp_3ya` | double precision | yes |  |
| `ppp_per_60pp_ly` | double precision | yes |  |
| `ppp_per_60pp_std` | double precision | yes |  |
| `ppp_per_60pp_l20` | double precision | yes |  |
| `ppp_per_60pp_l10` | double precision | yes |  |
| `ppp_per_60pp_l5` | double precision | yes |  |
| `hit_per_60_ca` | double precision | yes |  |
| `hit_per_60_3ya` | double precision | yes |  |
| `hit_per_60_ly` | double precision | yes |  |
| `hit_per_60_std` | double precision | yes |  |
| `hit_per_60_l20` | double precision | yes |  |
| `hit_per_60_l10` | double precision | yes |  |
| `hit_per_60_l5` | double precision | yes |  |
| `blk_per_60_ca` | double precision | yes |  |
| `blk_per_60_3ya` | double precision | yes |  |
| `blk_per_60_ly` | double precision | yes |  |
| `blk_per_60_std` | double precision | yes |  |
| `blk_per_60_l20` | double precision | yes |  |
| `blk_per_60_l10` | double precision | yes |  |
| `blk_per_60_l5` | double precision | yes |  |
| `pim_per_60_ca` | double precision | yes |  |
| `pim_per_60_3ya` | double precision | yes |  |
| `pim_per_60_ly` | double precision | yes |  |
| `pim_per_60_std` | double precision | yes |  |
| `pim_per_60_l20` | double precision | yes |  |
| `pim_per_60_l10` | double precision | yes |  |
| `pim_per_60_l5` | double precision | yes |  |

## `public.wigo_recent`

Type: table

Primary key: `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `last_updated` | timestamp with time zone | no | now() |
| `l5_gp` | integer | yes |  |
| `l5_atoi` | double precision | yes |  |
| `l5_pptoi` | double precision | yes |  |
| `l5_pp_pct` | double precision | yes |  |
| `l5_g` | integer | yes |  |
| `l5_a` | integer | yes |  |
| `l5_pts` | integer | yes |  |
| `l5_pts1_pct` | double precision | yes |  |
| `l5_sog` | integer | yes |  |
| `l5_s_pct` | double precision | yes |  |
| `l5_ixg` | double precision | yes |  |
| `l5_ipp` | double precision | yes |  |
| `l5_oi_sh_pct` | double precision | yes |  |
| `l5_ozs_pct` | double precision | yes |  |
| `l5_icf` | integer | yes |  |
| `l5_ppg` | integer | yes |  |
| `l5_ppa` | integer | yes |  |
| `l5_ppp` | integer | yes |  |
| `l5_hit` | integer | yes |  |
| `l5_blk` | integer | yes |  |
| `l5_pim` | integer | yes |  |
| `l5_g_per_60` | double precision | yes |  |
| `l5_a_per_60` | double precision | yes |  |
| `l5_pts_per_60` | double precision | yes |  |
| `l5_pts1_per_60` | double precision | yes |  |
| `l5_sog_per_60` | double precision | yes |  |
| `l5_ixg_per_60` | double precision | yes |  |
| `l5_icf_per_60` | double precision | yes |  |
| `l5_ihdcf_per_60` | double precision | yes |  |
| `l5_iscf_per_60` | double precision | yes |  |
| `l5_ppg_per_60` | double precision | yes |  |
| `l5_ppa_per_60` | double precision | yes |  |
| `l5_ppp_per_60` | double precision | yes |  |
| `l5_hit_per_60` | double precision | yes |  |
| `l5_blk_per_60` | double precision | yes |  |
| `l5_pim_per_60` | double precision | yes |  |
| `l10_gp` | integer | yes |  |
| `l10_atoi` | double precision | yes |  |
| `l10_pptoi` | double precision | yes |  |
| `l10_pp_pct` | double precision | yes |  |
| `l10_g` | integer | yes |  |
| `l10_a` | integer | yes |  |
| `l10_pts` | integer | yes |  |
| `l10_pts1_pct` | double precision | yes |  |
| `l10_sog` | integer | yes |  |
| `l10_s_pct` | double precision | yes |  |
| `l10_ixg` | double precision | yes |  |
| `l10_ipp` | double precision | yes |  |
| `l10_oi_sh_pct` | double precision | yes |  |
| `l10_ozs_pct` | double precision | yes |  |
| `l10_icf` | integer | yes |  |
| `l10_ppg` | integer | yes |  |
| `l10_ppa` | integer | yes |  |
| `l10_ppp` | integer | yes |  |
| `l10_hit` | integer | yes |  |
| `l10_blk` | integer | yes |  |
| `l10_pim` | integer | yes |  |
| `l10_g_per_60` | double precision | yes |  |
| `l10_a_per_60` | double precision | yes |  |
| `l10_pts_per_60` | double precision | yes |  |
| `l10_pts1_per_60` | double precision | yes |  |
| `l10_sog_per_60` | double precision | yes |  |
| `l10_ixg_per_60` | double precision | yes |  |
| `l10_icf_per_60` | double precision | yes |  |
| `l10_ihdcf_per_60` | double precision | yes |  |
| `l10_iscf_per_60` | double precision | yes |  |
| `l10_ppg_per_60` | double precision | yes |  |
| `l10_ppa_per_60` | double precision | yes |  |
| `l10_ppp_per_60` | double precision | yes |  |
| `l10_hit_per_60` | double precision | yes |  |
| `l10_blk_per_60` | double precision | yes |  |
| `l10_pim_per_60` | double precision | yes |  |
| `l20_gp` | integer | yes |  |
| `l20_atoi` | double precision | yes |  |
| `l20_pptoi` | double precision | yes |  |
| `l20_pp_pct` | double precision | yes |  |
| `l20_g` | integer | yes |  |
| `l20_a` | integer | yes |  |
| `l20_pts` | integer | yes |  |
| `l20_pts1_pct` | double precision | yes |  |
| `l20_sog` | integer | yes |  |
| `l20_s_pct` | double precision | yes |  |
| `l20_ixg` | double precision | yes |  |
| `l20_ipp` | double precision | yes |  |
| `l20_oi_sh_pct` | double precision | yes |  |
| `l20_ozs_pct` | double precision | yes |  |
| `l20_icf` | integer | yes |  |
| `l20_ppg` | integer | yes |  |
| `l20_ppa` | integer | yes |  |
| `l20_ppp` | integer | yes |  |
| `l20_hit` | integer | yes |  |
| `l20_blk` | integer | yes |  |
| `l20_pim` | integer | yes |  |
| `l20_g_per_60` | double precision | yes |  |
| `l20_a_per_60` | double precision | yes |  |
| `l20_pts_per_60` | double precision | yes |  |
| `l20_pts1_per_60` | double precision | yes |  |
| `l20_sog_per_60` | double precision | yes |  |
| `l20_ixg_per_60` | double precision | yes |  |
| `l20_icf_per_60` | double precision | yes |  |
| `l20_ihdcf_per_60` | double precision | yes |  |
| `l20_iscf_per_60` | double precision | yes |  |
| `l20_ppg_per_60` | double precision | yes |  |
| `l20_ppa_per_60` | double precision | yes |  |
| `l20_ppp_per_60` | double precision | yes |  |
| `l20_hit_per_60` | double precision | yes |  |
| `l20_blk_per_60` | double precision | yes |  |
| `l20_pim_per_60` | double precision | yes |  |
