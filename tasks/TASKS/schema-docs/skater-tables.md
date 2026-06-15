# Skater Tables And Views

Generated from live Supabase `information_schema` on 2026-05-22.

Tables/views documented: 48.

## Index

- `analytics.vw_nhl_edge_latest_skater_metrics` (view)
- `analytics.vw_player_status_current` (view)
- `analytics.vw_sko_skater_base` (view)
- `analytics.vw_sko_skater_scores` (view)
- `analytics.vw_sko_skater_zscores` (view)
- `public.PROJECTIONS_20252026_AG_SKATERS` (table)
- `public.PROJECTIONS_20252026_CULLEN_SKATERS` (table)
- `public.PROJECTIONS_20252026_DFO_SKATERS` (table)
- `public.PROJECTIONS_20252026_DTZ_Skaters` (table)
- `public.PROJECTIONS_20252026_FHFH_SKATERS` (table)
- `public.PROJECTIONS_20252026_KUBOTA_SKATERS` (table)
- `public.PROJECTIONS_20252026_LAIDLAW_SKATERS` (table)
- `public.forge_player_game_strength` (table)
- `public.forge_player_projections` (table)
- `public.forge_projection_accuracy_player` (table)
- `public.forge_roster_events` (table)
- `public.lineup_player_name_aliases` (table)
- `public.lineup_unresolved_player_names` (table)
- `public.model_player_game_barometers` (table)
- `public.news_feed_item_players` (table)
- `public.nhl_api_game_roster_spots` (table)
- `public.nhl_edge_skater_metrics_daily` (table)
- `public.nhl_edge_skater_shot_location_leaders_daily` (table)
- `public.player_baselines` (table)
- `public.player_name_aliases` (table)
- `public.player_prediction_outputs` (table)
- `public.player_priors_cache` (table)
- `public.player_projections` (table)
- `public.player_status_history` (table)
- `public.player_trend_metrics` (table)
- `public.players` (table)
- `public.rolling_player_game_metrics` (table)
- `public.rosters` (table)
- `public.skater_defensive_ratings_daily` (table)
- `public.skater_offensive_ratings_daily` (table)
- `public.skatersGameStats` (table)
- `public.sko_skater_stats` (table)
- `public.sko_skater_years` (table)
- `public.sustainability_player_priors` (table)
- `public.view_active_player_ids_max_season` (view)
- `public.wgo_skater_stats` (table)
- `public.wgo_skater_stats_per_game` (view)
- `public.wgo_skater_stats_playoffs` (table)
- `public.wgo_skater_stats_totals` (table)
- `public.wgo_skater_stats_totals_ly` (table)
- `public.wgo_skater_stats_totals_playoffs` (table)
- `public.xfs_predictions_10_game` (table)
- `public.xfs_predictions_5_game` (table)

## `analytics.vw_nhl_edge_latest_skater_metrics`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | yes |  |
| `season_id` | bigint | yes |  |
| `game_type` | smallint | yes |  |
| `player_id` | bigint | yes |  |
| `player_name` | text | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `position` | text | yes |  |
| `games_played` | integer | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `points` | integer | yes |  |
| `top_shot_speed_mph` | double precision | yes |  |
| `top_shot_speed_kph` | double precision | yes |  |
| `top_shot_speed_percentile` | double precision | yes |  |
| `top_shot_speed_league_avg_mph` | double precision | yes |  |
| `max_skating_speed_mph` | double precision | yes |  |
| `max_skating_speed_kph` | double precision | yes |  |
| `max_skating_speed_percentile` | double precision | yes |  |
| `max_skating_speed_league_avg_mph` | double precision | yes |  |
| `bursts_over_20` | integer | yes |  |
| `bursts_over_20_percentile` | double precision | yes |  |
| `bursts_over_20_league_avg` | double precision | yes |  |
| `total_distance_miles` | double precision | yes |  |
| `total_distance_km` | double precision | yes |  |
| `total_distance_percentile` | double precision | yes |  |
| `total_distance_league_avg_miles` | double precision | yes |  |
| `max_game_distance_miles` | double precision | yes |  |
| `max_game_distance_km` | double precision | yes |  |
| `max_game_distance_percentile` | double precision | yes |  |
| `max_game_distance_league_avg_miles` | double precision | yes |  |
| `all_shots` | integer | yes |  |
| `all_goals` | integer | yes |  |
| `all_shooting_pct` | double precision | yes |  |
| `high_danger_shots` | integer | yes |  |
| `high_danger_goals` | integer | yes |  |
| `high_danger_shooting_pct` | double precision | yes |  |
| `mid_range_shots` | integer | yes |  |
| `mid_range_goals` | integer | yes |  |
| `mid_range_shooting_pct` | double precision | yes |  |
| `long_range_shots` | integer | yes |  |
| `long_range_goals` | integer | yes |  |
| `long_range_shooting_pct` | double precision | yes |  |
| `offensive_zone_pct` | double precision | yes |  |
| `offensive_zone_percentile` | double precision | yes |  |
| `offensive_zone_league_avg` | double precision | yes |  |
| `offensive_zone_ev_pct` | double precision | yes |  |
| `offensive_zone_ev_percentile` | double precision | yes |  |
| `offensive_zone_ev_league_avg` | double precision | yes |  |
| `neutral_zone_pct` | double precision | yes |  |
| `neutral_zone_percentile` | double precision | yes |  |
| `neutral_zone_league_avg` | double precision | yes |  |
| `defensive_zone_pct` | double precision | yes |  |
| `defensive_zone_percentile` | double precision | yes |  |
| `defensive_zone_league_avg` | double precision | yes |  |
| `source_url` | text | yes |  |
| `raw_payload` | jsonb | yes |  |
| `metadata` | jsonb | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

## `analytics.vw_player_status_current`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `capture_key` | text | yes |  |
| `snapshot_date` | date | yes |  |
| `observed_at` | timestamp with time zone | yes |  |
| `player_id` | bigint | yes |  |
| `player_name` | text | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `status_state` | text | yes |  |
| `raw_status` | text | yes |  |
| `status_detail` | text | yes |  |
| `source_name` | text | yes |  |
| `source_url` | text | yes |  |
| `source_rank` | smallint | yes |  |
| `status_expires_at` | timestamp with time zone | yes |  |
| `display_status` | text | yes |  |
| `display_tone` | text | yes |  |
| `metadata` | jsonb | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

## `analytics.vw_sko_skater_base`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `player_name` | text | yes |  |
| `position_code` | text | yes |  |
| `season_id` | integer | yes |  |
| `game_id` | bigint | yes |  |
| `date` | date | yes |  |
| `shots` | integer | yes |  |
| `toi_per_game` | double precision | yes |  |
| `pp_toi_per_game` | double precision | yes |  |
| `o_zone_fo_percentage` | double precision | yes |  |
| `on_ice_shooting_pct` | double precision | yes |  |
| `shooting_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `ixg_per_60` | numeric | yes |  |

## `analytics.vw_sko_skater_scores`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `position_code` | text | yes |  |
| `season_id` | integer | yes |  |
| `game_id` | bigint | yes |  |
| `date` | date | yes |  |
| `shots_z` | double precision | yes |  |
| `ixg_z` | double precision | yes |  |
| `ixg_per_60_z` | double precision | yes |  |
| `toi_z` | double precision | yes |  |
| `pp_toi_z` | double precision | yes |  |
| `ozfo_z` | double precision | yes |  |
| `onice_sh_z` | double precision | yes |  |
| `shooting_pct_z` | double precision | yes |  |
| `sko_raw` | double precision | yes |  |
| `sko` | double precision | yes |  |

## `analytics.vw_sko_skater_zscores`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `position_code` | text | yes |  |
| `season_id` | integer | yes |  |
| `game_id` | bigint | yes |  |
| `date` | date | yes |  |
| `shots` | integer | yes |  |
| `ixg` | double precision | yes |  |
| `ixg_per_60` | numeric | yes |  |
| `toi_per_game` | double precision | yes |  |
| `pp_toi_per_game` | double precision | yes |  |
| `o_zone_fo_percentage` | double precision | yes |  |
| `on_ice_shooting_pct` | double precision | yes |  |
| `shooting_percentage` | double precision | yes |  |
| `n_games` | bigint | yes |  |
| `w_player` | double precision | yes |  |
| `w_league` | double precision | yes |  |
| `shots_z` | double precision | yes |  |
| `ixg_z` | double precision | yes |  |
| `ixg_per_60_z` | double precision | yes |  |
| `toi_z` | double precision | yes |  |
| `pp_toi_z` | double precision | yes |  |
| `ozfo_z` | double precision | yes |  |
| `onice_sh_z` | double precision | yes |  |
| `shooting_pct_z` | double precision | yes |  |

## `public.PROJECTIONS_20252026_AG_SKATERS`

Type: table

Primary key: `upload_batch_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `upload_batch_id` | uuid | no | gen_random_uuid() |
| `player_id` | bigint | yes |  |
| `Player_Name` | text | yes |  |
| `Team_Abbreviation` | text | yes |  |
| `Games_Played` | numeric | yes |  |
| `Goals` | numeric | yes |  |
| `Assists` | numeric | yes |  |
| `Points` | numeric | yes |  |
| `PP_Points` | numeric | yes |  |
| `Shots_on_Goal` | numeric | yes |  |
| `Hits` | numeric | yes |  |
| `Blocked_Shots` | numeric | yes |  |
| `Penalty_Minutes` | numeric | yes |  |
| `S` | text | yes |  |
| `Time_on_Ice_Per_Game` | numeric | yes |  |

## `public.PROJECTIONS_20252026_CULLEN_SKATERS`

Type: table

Primary key: `upload_batch_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `upload_batch_id` | uuid | no | gen_random_uuid() |
| `player_id` | bigint | yes |  |
| `Player_Name` | text | yes |  |
| `Team_Abbreviation` | text | yes |  |
| `Position` | text | yes |  |
| `Games_Played` | numeric | yes |  |
| `Goals` | numeric | yes |  |
| `Assists` | numeric | yes |  |
| `Points` | numeric | yes |  |
| `Plus_Minus` | numeric | yes |  |
| `PP_Points` | numeric | yes |  |
| `Penalty_Minutes` | numeric | yes |  |
| `Hits` | numeric | yes |  |
| `Blocked_Shots` | numeric | yes |  |
| `Shots_on_Goal` | numeric | yes |  |

## `public.PROJECTIONS_20252026_DFO_SKATERS`

Type: table

Primary key: `upload_batch_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `upload_batch_id` | uuid | no | gen_random_uuid() |
| `player_id` | bigint | yes |  |
| `Player_Name` | text | yes |  |
| `Team_Abbreviation` | text | yes |  |
| `Position` | text | yes |  |
| `Games_Played` | numeric | yes |  |
| `Goals` | numeric | yes |  |
| `Assists` | numeric | yes |  |
| `Points` | numeric | yes |  |
| `Plus_Minus` | numeric | yes |  |
| `Penalty_Minutes` | numeric | yes |  |
| `PP_Goals` | numeric | yes |  |
| `PP_Assists` | numeric | yes |  |
| `PP_Points` | numeric | yes |  |
| `Shots_on_Goal` | numeric | yes |  |
| `Time_on_Ice_Per_Game` | numeric | yes |  |
| `Faceoffs_Won` | numeric | yes |  |
| `Blocked_Shots` | numeric | yes |  |
| `Hits` | numeric | yes |  |

## `public.PROJECTIONS_20252026_DTZ_Skaters`

Type: table

Primary key: `upload_batch_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `upload_batch_id` | uuid | no | gen_random_uuid() |
| `player_id` | bigint | yes |  |
| `Player_Name` | text | yes |  |
| `Age` | numeric | yes |  |
| `Position` | text | yes |  |
| `Team_Abbreviation` | text | yes |  |
| `Salary` | text | yes |  |
| `Toi_Org_Es` | numeric | yes |  |
| `Toi_Org_Pp` | numeric | yes |  |
| `Toi_Org_Pk` | numeric | yes |  |
| `Gp_Org` | numeric | yes |  |
| `Games_Played` | numeric | yes |  |
| `Toi_Es` | numeric | yes |  |
| `Toi_Pp` | numeric | yes |  |
| `Toi_Pk` | numeric | yes |  |
| `Total_Toi` | numeric | yes |  |
| `Goals` | numeric | yes |  |
| `Assists` | numeric | yes |  |
| `Points` | numeric | yes |  |
| `PP_Goals` | numeric | yes |  |
| `PP_Assists` | numeric | yes |  |
| `Pp_Points` | numeric | yes |  |
| `SH_Goals` | numeric | yes |  |
| `SH_Assists` | numeric | yes |  |
| `SH_Points` | numeric | yes |  |
| `Hits` | numeric | yes |  |
| `Blocked_Shots` | numeric | yes |  |
| `Penalty_Minutes` | numeric | yes |  |
| `Faceoffs_Won` | numeric | yes |  |
| `Faceoffs_Lost` | numeric | yes |  |
| `Shots_on_Goal` | numeric | yes |  |
| `Plus_Minus` | numeric | yes |  |
| `Vor` | numeric | yes |  |
| `Rank` | numeric | yes |  |
| `Unadj_Vor` | numeric | yes |  |
| `Playerid` | numeric | yes |  |

## `public.PROJECTIONS_20252026_FHFH_SKATERS`

Type: table

Primary key: `upload_batch_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `upload_batch_id` | uuid | no | gen_random_uuid() |
| `player_id` | bigint | yes |  |
| `Player_Name` | text | yes |  |
| `Position` | text | yes |  |
| `Games_Played` | numeric | yes |  |
| `Time_on_Ice_Per_Game` | numeric | yes |  |
| `PP_TOI` | numeric | yes |  |
| `Goals` | numeric | yes |  |
| `Assists` | numeric | yes |  |
| `Points` | numeric | yes |  |
| `Shots_on_Goal` | numeric | yes |  |
| `S` | numeric | yes |  |
| `PP_Goals` | numeric | yes |  |
| `PP_Assists` | numeric | yes |  |
| `PP_Points` | numeric | yes |  |
| `SH_Goals` | numeric | yes |  |
| `SH_Assists` | numeric | yes |  |
| `SH_Points` | numeric | yes |  |
| `Hits` | numeric | yes |  |
| `Blocked_Shots` | numeric | yes |  |
| `Penalty_Minutes` | numeric | yes |  |

## `public.PROJECTIONS_20252026_KUBOTA_SKATERS`

Type: table

Primary key: `upload_batch_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `upload_batch_id` | uuid | no | gen_random_uuid() |
| `player_id` | bigint | yes |  |
| `Player_Name` | text | yes |  |
| `Team_Abbreviation` | text | yes |  |
| `Position` | text | yes |  |
| `Games_Played` | numeric | yes |  |
| `Goals` | numeric | yes |  |
| `Assists` | numeric | yes |  |
| `Points` | numeric | yes |  |
| `Shots_on_Goal` | numeric | yes |  |
| `Penalty_Minutes` | numeric | yes |  |
| `Plus_Minus` | numeric | yes |  |
| `PP_Goals` | numeric | yes |  |
| `PP_Assists` | numeric | yes |  |
| `PP_Points` | numeric | yes |  |
| `SH_Goals` | numeric | yes |  |
| `SH_Assists` | numeric | yes |  |
| `SH_Points` | numeric | yes |  |
| `Blocked_Shots` | numeric | yes |  |
| `Hits` | numeric | yes |  |
| `Faceoffs_Lost` | numeric | yes |  |
| `Faceoffs_Won` | numeric | yes |  |

## `public.PROJECTIONS_20252026_LAIDLAW_SKATERS`

Type: table

Primary key: `upload_batch_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `upload_batch_id` | uuid | no | gen_random_uuid() |
| `player_id` | bigint | yes |  |
| `Player_Name` | text | yes |  |
| `Games_Played` | numeric | yes |  |
| `Goals` | numeric | yes |  |
| `Assists` | numeric | yes |  |
| `Points` | numeric | yes |  |
| `PP_Points` | numeric | yes |  |
| `Shots_on_Goal` | numeric | yes |  |
| `Hits` | numeric | yes |  |
| `Blocked_Shots` | numeric | yes |  |

## `public.forge_player_game_strength`

Type: table

Primary key: `game_id`, `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | no |  |
| `player_id` | bigint | no |  |
| `team_id` | smallint | no |  |
| `opponent_team_id` | smallint | yes |  |
| `game_date` | date | no |  |
| `toi_es_seconds` | integer | yes |  |
| `toi_pp_seconds` | integer | yes |  |
| `toi_pk_seconds` | integer | yes |  |
| `shots_es` | integer | yes |  |
| `shots_pp` | integer | yes |  |
| `shots_pk` | integer | yes |  |
| `goals_es` | integer | yes |  |
| `goals_pp` | integer | yes |  |
| `goals_pk` | integer | yes |  |
| `assists_es` | integer | yes |  |
| `assists_pp` | integer | yes |  |
| `assists_pk` | integer | yes |  |
| `hits` | integer | yes |  |
| `blocks` | integer | yes |  |
| `pim` | integer | yes |  |
| `plus_minus` | integer | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.forge_player_projections`

Type: table

Primary key: `run_id`, `game_id`, `player_id`, `horizon_games`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `run_id` | uuid | no |  |
| `as_of_date` | date | no |  |
| `horizon_games` | smallint | no |  |
| `game_id` | bigint | no |  |
| `player_id` | bigint | no |  |
| `team_id` | smallint | no |  |
| `opponent_team_id` | smallint | no |  |
| `proj_toi_es_seconds` | integer | yes |  |
| `proj_toi_pp_seconds` | integer | yes |  |
| `proj_toi_pk_seconds` | integer | yes |  |
| `proj_shots_es` | numeric | yes |  |
| `proj_shots_pp` | numeric | yes |  |
| `proj_shots_pk` | numeric | yes |  |
| `proj_goals_es` | numeric | yes |  |
| `proj_goals_pp` | numeric | yes |  |
| `proj_goals_pk` | numeric | yes |  |
| `proj_assists_es` | numeric | yes |  |
| `proj_assists_pp` | numeric | yes |  |
| `proj_assists_pk` | numeric | yes |  |
| `proj_hits` | numeric | yes |  |
| `proj_blocks` | numeric | yes |  |
| `proj_pim` | numeric | yes |  |
| `proj_plus_minus` | numeric | yes |  |
| `uncertainty` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.forge_projection_accuracy_player`

Type: table

Primary key: `date`, `player_id`, `player_type`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `date` | date | no |  |
| `player_id` | bigint | no |  |
| `player_type` | text | no |  |
| `accuracy_avg` | numeric | no |  |
| `mae` | numeric | no |  |
| `rmse` | numeric | no |  |
| `games_count` | integer | no |  |
| `updated_at` | timestamp with time zone | no | now() |

## `public.forge_roster_events`

Type: table

Primary key: `event_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `event_id` | bigint | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `effective_from` | timestamp with time zone | no | now() |
| `effective_to` | timestamp with time zone | yes |  |
| `team_id` | smallint | yes |  |
| `player_id` | bigint | yes |  |
| `event_type` | text | no |  |
| `confidence` | numeric | no | 0.5 |
| `payload` | jsonb | no | '{}'::jsonb |
| `source_text` | text | yes |  |

## `public.lineup_player_name_aliases`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `alias` | text | no |  |
| `normalized_alias` | text | no |  |
| `player_id` | integer | no |  |
| `player_name` | text | no |  |
| `team_id` | integer | yes |  |
| `source` | text | no | 'manual'::text |
| `notes` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.lineup_unresolved_player_names`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `dedupe_key` | text | no |  |
| `source` | text | no |  |
| `source_url` | text | yes |  |
| `tweet_id` | text | yes |  |
| `raw_name` | text | no |  |
| `normalized_name` | text | no |  |
| `team_id` | integer | yes |  |
| `team_abbreviation` | text | yes |  |
| `context_text` | text | yes |  |
| `status` | text | no | 'pending'::text |
| `resolved_player_id` | integer | yes |  |
| `resolved_alias_id` | uuid | yes |  |
| `metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.model_player_game_barometers`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('model_player_game_barometers_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `game_id` | bigint | yes |  |
| `game_date` | date | no |  |
| `season_id` | integer | no |  |
| `window_type` | text | no |  |
| `sustainability_score` | integer | no |  |
| `sustainability_score_raw` | double precision | no |  |
| `sustainability_quintile` | smallint | yes |  |
| `status` | text | no |  |
| `model_version` | integer | no |  |
| `config_hash` | text | no |  |
| `components_json` | jsonb | no |  |
| `rookie_status` | boolean | no | false |
| `extreme_flag` | boolean | no | false |
| `created_at` | timestamp with time zone | no | now() |

## `public.news_feed_item_players`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `news_item_id` | uuid | no |  |
| `player_id` | integer | yes |  |
| `player_name` | text | no |  |
| `team_id` | integer | yes |  |
| `role` | text | no | 'subject'::text |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.nhl_api_game_roster_spots`

Type: table

Primary key: `game_id`, `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | no |  |
| `season_id` | bigint | yes |  |
| `game_date` | date | yes |  |
| `team_id` | bigint | no |  |
| `player_id` | bigint | no |  |
| `first_name` | text | yes |  |
| `last_name` | text | yes |  |
| `sweater_number` | integer | yes |  |
| `position_code` | text | yes |  |
| `headshot_url` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `source_play_by_play_hash` | text | no |  |
| `parser_version` | integer | no | 1 |
| `raw_spot` | jsonb | no | '{}'::jsonb |

## `public.nhl_edge_skater_metrics_daily`

Type: table

Primary key: `snapshot_date`, `season_id`, `game_type`, `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `season_id` | bigint | no |  |
| `game_type` | smallint | no | 2 |
| `player_id` | bigint | no |  |
| `player_name` | text | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `position` | text | yes |  |
| `games_played` | integer | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `points` | integer | yes |  |
| `top_shot_speed_mph` | double precision | yes |  |
| `top_shot_speed_kph` | double precision | yes |  |
| `top_shot_speed_percentile` | double precision | yes |  |
| `top_shot_speed_league_avg_mph` | double precision | yes |  |
| `max_skating_speed_mph` | double precision | yes |  |
| `max_skating_speed_kph` | double precision | yes |  |
| `max_skating_speed_percentile` | double precision | yes |  |
| `max_skating_speed_league_avg_mph` | double precision | yes |  |
| `bursts_over_20` | integer | yes |  |
| `bursts_over_20_percentile` | double precision | yes |  |
| `bursts_over_20_league_avg` | double precision | yes |  |
| `total_distance_miles` | double precision | yes |  |
| `total_distance_km` | double precision | yes |  |
| `total_distance_percentile` | double precision | yes |  |
| `total_distance_league_avg_miles` | double precision | yes |  |
| `max_game_distance_miles` | double precision | yes |  |
| `max_game_distance_km` | double precision | yes |  |
| `max_game_distance_percentile` | double precision | yes |  |
| `max_game_distance_league_avg_miles` | double precision | yes |  |
| `all_shots` | integer | yes |  |
| `all_goals` | integer | yes |  |
| `all_shooting_pct` | double precision | yes |  |
| `high_danger_shots` | integer | yes |  |
| `high_danger_goals` | integer | yes |  |
| `high_danger_shooting_pct` | double precision | yes |  |
| `mid_range_shots` | integer | yes |  |
| `mid_range_goals` | integer | yes |  |
| `mid_range_shooting_pct` | double precision | yes |  |
| `long_range_shots` | integer | yes |  |
| `long_range_goals` | integer | yes |  |
| `long_range_shooting_pct` | double precision | yes |  |
| `offensive_zone_pct` | double precision | yes |  |
| `offensive_zone_percentile` | double precision | yes |  |
| `offensive_zone_league_avg` | double precision | yes |  |
| `offensive_zone_ev_pct` | double precision | yes |  |
| `offensive_zone_ev_percentile` | double precision | yes |  |
| `offensive_zone_ev_league_avg` | double precision | yes |  |
| `neutral_zone_pct` | double precision | yes |  |
| `neutral_zone_percentile` | double precision | yes |  |
| `neutral_zone_league_avg` | double precision | yes |  |
| `defensive_zone_pct` | double precision | yes |  |
| `defensive_zone_percentile` | double precision | yes |  |
| `defensive_zone_league_avg` | double precision | yes |  |
| `source_url` | text | no |  |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | timezone('utc'::text, now()) |
| `updated_at` | timestamp with time zone | no | timezone('utc'::text, now()) |

## `public.nhl_edge_skater_shot_location_leaders_daily`

Type: table

Primary key: `snapshot_date`, `season_id`, `game_type`, `metric_key`, `rank_order`, `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `season_id` | bigint | no |  |
| `game_type` | smallint | no | 2 |
| `metric_key` | text | no |  |
| `rank_order` | integer | no |  |
| `player_id` | bigint | no |  |
| `player_name` | text | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `position` | text | yes |  |
| `all_value` | double precision | yes |  |
| `high_danger_value` | double precision | yes |  |
| `mid_range_value` | double precision | yes |  |
| `long_range_value` | double precision | yes |  |
| `source_url` | text | no |  |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | timezone('utc'::text, now()) |
| `updated_at` | timestamp with time zone | no | timezone('utc'::text, now()) |

## `public.player_baselines`

Type: table

Primary key: `player_id`, `snapshot_date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `season_id` | integer | yes |  |
| `snapshot_date` | date | no |  |
| `position_code` | text | yes |  |
| `player_name` | text | yes |  |
| `win_l3` | jsonb | yes |  |
| `win_l5` | jsonb | yes |  |
| `win_l10` | jsonb | yes |  |
| `win_l20` | jsonb | yes |  |
| `win_season_prev` | jsonb | yes |  |
| `win_3yr` | jsonb | yes |  |
| `win_career` | jsonb | yes |  |
| `pp_share_sm` | numeric | yes |  |
| `pp_share_ref` | numeric | yes |  |
| `pp_share_delta` | numeric | yes |  |
| `pp_share_rel` | numeric | yes |  |
| `pp1_flag` | boolean | yes |  |
| `band_widen_factor` | numeric | yes |  |
| `computed_at` | timestamp with time zone | yes | now() |

## `public.player_name_aliases`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('player_name_aliases_id_seq'::regclass) |
| `yahoo_player_name` | text | yes |  |
| `nhl_player_name` | text | yes |  |
| `canonical_name` | text | yes |  |
| `created_at` | timestamp without time zone | yes | now() |
| `updated_at` | timestamp without time zone | yes | now() |

## `public.player_prediction_outputs`

Type: table

Primary key: `snapshot_date`, `player_id`, `model_name`, `model_version`, `prediction_scope`, `metric_key`, `game_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `game_id` | bigint | no |  |
| `player_id` | bigint | no |  |
| `team_id` | smallint | yes |  |
| `opponent_team_id` | smallint | yes |  |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `prediction_scope` | text | no | 'pregame'::text |
| `metric_key` | text | no |  |
| `expected_value` | double precision | yes |  |
| `floor_value` | double precision | yes |  |
| `ceiling_value` | double precision | yes |  |
| `probability_over` | double precision | yes |  |
| `line_value` | double precision | yes |  |
| `components` | jsonb | no | '{}'::jsonb |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.player_priors_cache`

Type: table

Primary key: `player_id`, `season_id`, `stat_code`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `season_id` | integer | no |  |
| `position_code` | text | no |  |
| `stat_code` | text | no |  |
| `successes_blend` | double precision | no |  |
| `trials_blend` | double precision | no |  |
| `post_mean` | double precision | no |  |
| `rookie_status` | boolean | no | false |
| `model_version` | integer | no |  |
| `updated_at` | timestamp with time zone | no | now() |

## `public.player_projections`

Type: table

Primary key: `player_id`, `game_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `game_id` | bigint | no |  |
| `opponent_team_id` | bigint | no |  |
| `proj_goals` | numeric | yes |  |
| `proj_assists` | numeric | yes |  |
| `proj_shots` | numeric | yes |  |
| `proj_pp_points` | numeric | yes |  |
| `proj_hits` | numeric | yes |  |
| `proj_blocks` | numeric | yes |  |
| `proj_pim` | numeric | yes |  |
| `proj_fantasy_points` | numeric | yes |  |
| `matchup_grade` | numeric | yes |  |
| `created_at` | timestamp with time zone | yes | now() |
| `updated_at` | timestamp with time zone | yes | now() |

## `public.player_status_history`

Type: table

Primary key: `capture_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `capture_key` | text | no |  |
| `snapshot_date` | date | no |  |
| `observed_at` | timestamp with time zone | no | now() |
| `player_id` | bigint | yes |  |
| `player_name` | text | no |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `status_state` | text | no |  |
| `raw_status` | text | yes |  |
| `status_detail` | text | yes |  |
| `source_name` | text | no |  |
| `source_url` | text | yes |  |
| `source_rank` | smallint | no | 1 |
| `status_expires_at` | timestamp with time zone | yes |  |
| `metadata` | jsonb | no | '{}'::jsonb |
| `updated_at` | timestamp with time zone | no | now() |

## `public.player_trend_metrics`

Type: table

Primary key: `player_id`, `game_date`, `metric_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `season_id` | integer | yes |  |
| `game_date` | date | no |  |
| `position_code` | text | yes |  |
| `metric_type` | text | no |  |
| `metric_key` | text | no |  |
| `metric_label` | text | no |  |
| `raw_value` | numeric | yes |  |
| `average_value` | numeric | yes |  |
| `rolling_avg_3` | numeric | yes |  |
| `rolling_avg_5` | numeric | yes |  |
| `rolling_avg_10` | numeric | yes |  |
| `variance_value` | numeric | yes |  |
| `std_dev_value` | numeric | yes |  |
| `sample_size` | integer | no | 0 |
| `updated_at` | timestamp with time zone | no | now() |

## `public.players`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no |  |
| `firstName` | text | no |  |
| `lastName` | text | no |  |
| `fullName` | text | no |  |
| `position` | NHL_Position_Code | no |  |
| `birthDate` | date | no |  |
| `birthCity` | text | yes |  |
| `birthCountry` | text | yes | 'USA'::text |
| `heightInCentimeters` | smallint | no |  |
| `weightInKilograms` | smallint | no |  |
| `image_url` | text | yes |  |
| `team_id` | smallint | yes |  |
| `sweater_number` | smallint | yes |  |

## `public.rolling_player_game_metrics`

Type: table

Primary key: `player_id`, `game_date`, `strength_state`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `game_date` | date | no |  |
| `game_id` | bigint | yes |  |
| `season` | integer | no |  |
| `team_id` | smallint | yes |  |
| `strength_state` | text | no |  |
| `line_combo_slot` | smallint | yes |  |
| `line_combo_group` | text | yes |  |
| `pp_unit` | smallint | yes |  |
| `games_played` | integer | no | 0 |
| `team_games_played` | integer | no | 0 |
| `gp_pct_total_all` | double precision | yes |  |
| `gp_pct_avg_all` | double precision | yes |  |
| `gp_pct_total_last3` | double precision | yes |  |
| `gp_pct_avg_last3` | double precision | yes |  |
| `gp_pct_total_last5` | double precision | yes |  |
| `gp_pct_avg_last5` | double precision | yes |  |
| `gp_pct_total_last10` | double precision | yes |  |
| `gp_pct_avg_last10` | double precision | yes |  |
| `gp_pct_total_last20` | double precision | yes |  |
| `gp_pct_avg_last20` | double precision | yes |  |
| `toi_seconds_total_all` | double precision | yes |  |
| `toi_seconds_avg_all` | double precision | yes |  |
| `toi_seconds_total_last3` | double precision | yes |  |
| `toi_seconds_avg_last3` | double precision | yes |  |
| `toi_seconds_total_last5` | double precision | yes |  |
| `toi_seconds_avg_last5` | double precision | yes |  |
| `toi_seconds_total_last10` | double precision | yes |  |
| `toi_seconds_avg_last10` | double precision | yes |  |
| `toi_seconds_total_last20` | double precision | yes |  |
| `toi_seconds_avg_last20` | double precision | yes |  |
| `sog_per_60_total_all` | double precision | yes |  |
| `sog_per_60_avg_all` | double precision | yes |  |
| `sog_per_60_total_last3` | double precision | yes |  |
| `sog_per_60_avg_last3` | double precision | yes |  |
| `sog_per_60_total_last5` | double precision | yes |  |
| `sog_per_60_avg_last5` | double precision | yes |  |
| `sog_per_60_total_last10` | double precision | yes |  |
| `sog_per_60_avg_last10` | double precision | yes |  |
| `sog_per_60_total_last20` | double precision | yes |  |
| `sog_per_60_avg_last20` | double precision | yes |  |
| `ixg_per_60_total_all` | double precision | yes |  |
| `ixg_per_60_avg_all` | double precision | yes |  |
| `ixg_per_60_total_last3` | double precision | yes |  |
| `ixg_per_60_avg_last3` | double precision | yes |  |
| `ixg_per_60_total_last5` | double precision | yes |  |
| `ixg_per_60_avg_last5` | double precision | yes |  |
| `ixg_per_60_total_last10` | double precision | yes |  |
| `ixg_per_60_avg_last10` | double precision | yes |  |
| `ixg_per_60_total_last20` | double precision | yes |  |
| `ixg_per_60_avg_last20` | double precision | yes |  |
| `shooting_pct_total_all` | double precision | yes |  |
| `shooting_pct_avg_all` | double precision | yes |  |
| `shooting_pct_total_last3` | double precision | yes |  |
| `shooting_pct_avg_last3` | double precision | yes |  |
| `shooting_pct_total_last5` | double precision | yes |  |
| `shooting_pct_avg_last5` | double precision | yes |  |
| `shooting_pct_total_last10` | double precision | yes |  |
| `shooting_pct_avg_last10` | double precision | yes |  |
| `shooting_pct_total_last20` | double precision | yes |  |
| `shooting_pct_avg_last20` | double precision | yes |  |
| `ixg_total_all` | double precision | yes |  |
| `ixg_avg_all` | double precision | yes |  |
| `ixg_total_last3` | double precision | yes |  |
| `ixg_avg_last3` | double precision | yes |  |
| `ixg_total_last5` | double precision | yes |  |
| `ixg_avg_last5` | double precision | yes |  |
| `ixg_total_last10` | double precision | yes |  |
| `ixg_avg_last10` | double precision | yes |  |
| `ixg_total_last20` | double precision | yes |  |
| `ixg_avg_last20` | double precision | yes |  |
| `primary_points_pct_total_all` | double precision | yes |  |
| `primary_points_pct_avg_all` | double precision | yes |  |
| `primary_points_pct_total_last3` | double precision | yes |  |
| `primary_points_pct_avg_last3` | double precision | yes |  |
| `primary_points_pct_total_last5` | double precision | yes |  |
| `primary_points_pct_avg_last5` | double precision | yes |  |
| `primary_points_pct_total_last10` | double precision | yes |  |
| `primary_points_pct_avg_last10` | double precision | yes |  |
| `primary_points_pct_total_last20` | double precision | yes |  |
| `primary_points_pct_avg_last20` | double precision | yes |  |
| `expected_sh_pct_total_all` | double precision | yes |  |
| `expected_sh_pct_avg_all` | double precision | yes |  |
| `expected_sh_pct_total_last3` | double precision | yes |  |
| `expected_sh_pct_avg_last3` | double precision | yes |  |
| `expected_sh_pct_total_last5` | double precision | yes |  |
| `expected_sh_pct_avg_last5` | double precision | yes |  |
| `expected_sh_pct_total_last10` | double precision | yes |  |
| `expected_sh_pct_avg_last10` | double precision | yes |  |
| `expected_sh_pct_total_last20` | double precision | yes |  |
| `expected_sh_pct_avg_last20` | double precision | yes |  |
| `ipp_total_all` | double precision | yes |  |
| `ipp_avg_all` | double precision | yes |  |
| `ipp_total_last3` | double precision | yes |  |
| `ipp_avg_last3` | double precision | yes |  |
| `ipp_total_last5` | double precision | yes |  |
| `ipp_avg_last5` | double precision | yes |  |
| `ipp_total_last10` | double precision | yes |  |
| `ipp_avg_last10` | double precision | yes |  |
| `ipp_total_last20` | double precision | yes |  |
| `ipp_avg_last20` | double precision | yes |  |
| `iscf_total_all` | double precision | yes |  |
| `iscf_avg_all` | double precision | yes |  |
| `iscf_total_last3` | double precision | yes |  |
| `iscf_avg_last3` | double precision | yes |  |
| `iscf_total_last5` | double precision | yes |  |
| `iscf_avg_last5` | double precision | yes |  |
| `iscf_total_last10` | double precision | yes |  |
| `iscf_avg_last10` | double precision | yes |  |
| `iscf_total_last20` | double precision | yes |  |
| `iscf_avg_last20` | double precision | yes |  |
| `ihdcf_total_all` | double precision | yes |  |
| `ihdcf_avg_all` | double precision | yes |  |
| `ihdcf_total_last3` | double precision | yes |  |
| `ihdcf_avg_last3` | double precision | yes |  |
| `ihdcf_total_last5` | double precision | yes |  |
| `ihdcf_avg_last5` | double precision | yes |  |
| `ihdcf_total_last10` | double precision | yes |  |
| `ihdcf_avg_last10` | double precision | yes |  |
| `ihdcf_total_last20` | double precision | yes |  |
| `ihdcf_avg_last20` | double precision | yes |  |
| `oz_start_pct_total_all` | double precision | yes |  |
| `oz_start_pct_avg_all` | double precision | yes |  |
| `oz_start_pct_total_last3` | double precision | yes |  |
| `oz_start_pct_avg_last3` | double precision | yes |  |
| `oz_start_pct_total_last5` | double precision | yes |  |
| `oz_start_pct_avg_last5` | double precision | yes |  |
| `oz_start_pct_total_last10` | double precision | yes |  |
| `oz_start_pct_avg_last10` | double precision | yes |  |
| `oz_start_pct_total_last20` | double precision | yes |  |
| `oz_start_pct_avg_last20` | double precision | yes |  |
| `pp_share_pct_total_all` | double precision | yes |  |
| `pp_share_pct_avg_all` | double precision | yes |  |
| `pp_share_pct_total_last3` | double precision | yes |  |
| `pp_share_pct_avg_last3` | double precision | yes |  |
| `pp_share_pct_total_last5` | double precision | yes |  |
| `pp_share_pct_avg_last5` | double precision | yes |  |
| `pp_share_pct_total_last10` | double precision | yes |  |
| `pp_share_pct_avg_last10` | double precision | yes |  |
| `pp_share_pct_total_last20` | double precision | yes |  |
| `pp_share_pct_avg_last20` | double precision | yes |  |
| `on_ice_sh_pct_total_all` | double precision | yes |  |
| `on_ice_sh_pct_avg_all` | double precision | yes |  |
| `on_ice_sh_pct_total_last3` | double precision | yes |  |
| `on_ice_sh_pct_avg_last3` | double precision | yes |  |
| `on_ice_sh_pct_total_last5` | double precision | yes |  |
| `on_ice_sh_pct_avg_last5` | double precision | yes |  |
| `on_ice_sh_pct_total_last10` | double precision | yes |  |
| `on_ice_sh_pct_avg_last10` | double precision | yes |  |
| `on_ice_sh_pct_total_last20` | double precision | yes |  |
| `on_ice_sh_pct_avg_last20` | double precision | yes |  |
| `pdo_total_all` | double precision | yes |  |
| `pdo_avg_all` | double precision | yes |  |
| `pdo_total_last3` | double precision | yes |  |
| `pdo_avg_last3` | double precision | yes |  |
| `pdo_total_last5` | double precision | yes |  |
| `pdo_avg_last5` | double precision | yes |  |
| `pdo_total_last10` | double precision | yes |  |
| `pdo_avg_last10` | double precision | yes |  |
| `pdo_total_last20` | double precision | yes |  |
| `pdo_avg_last20` | double precision | yes |  |
| `cf_total_all` | double precision | yes |  |
| `cf_avg_all` | double precision | yes |  |
| `cf_total_last3` | double precision | yes |  |
| `cf_avg_last3` | double precision | yes |  |
| `cf_total_last5` | double precision | yes |  |
| `cf_avg_last5` | double precision | yes |  |
| `cf_total_last10` | double precision | yes |  |
| `cf_avg_last10` | double precision | yes |  |
| `cf_total_last20` | double precision | yes |  |
| `cf_avg_last20` | double precision | yes |  |
| `ca_total_all` | double precision | yes |  |
| `ca_avg_all` | double precision | yes |  |
| `ca_total_last3` | double precision | yes |  |
| `ca_avg_last3` | double precision | yes |  |
| `ca_total_last5` | double precision | yes |  |
| `ca_avg_last5` | double precision | yes |  |
| `ca_total_last10` | double precision | yes |  |
| `ca_avg_last10` | double precision | yes |  |
| `ca_total_last20` | double precision | yes |  |
| `ca_avg_last20` | double precision | yes |  |
| `cf_pct_total_all` | double precision | yes |  |
| `cf_pct_avg_all` | double precision | yes |  |
| `cf_pct_total_last3` | double precision | yes |  |
| `cf_pct_avg_last3` | double precision | yes |  |
| `cf_pct_total_last5` | double precision | yes |  |
| `cf_pct_avg_last5` | double precision | yes |  |
| `cf_pct_total_last10` | double precision | yes |  |
| `cf_pct_avg_last10` | double precision | yes |  |
| `cf_pct_total_last20` | double precision | yes |  |
| `cf_pct_avg_last20` | double precision | yes |  |
| `ff_total_all` | double precision | yes |  |
| `ff_avg_all` | double precision | yes |  |
| `ff_total_last3` | double precision | yes |  |
| `ff_avg_last3` | double precision | yes |  |
| `ff_total_last5` | double precision | yes |  |
| `ff_avg_last5` | double precision | yes |  |
| `ff_total_last10` | double precision | yes |  |
| `ff_avg_last10` | double precision | yes |  |
| `ff_total_last20` | double precision | yes |  |
| `ff_avg_last20` | double precision | yes |  |
| `fa_total_all` | double precision | yes |  |
| `fa_avg_all` | double precision | yes |  |
| `fa_total_last3` | double precision | yes |  |
| `fa_avg_last3` | double precision | yes |  |
| `fa_total_last5` | double precision | yes |  |
| `fa_avg_last5` | double precision | yes |  |
| `fa_total_last10` | double precision | yes |  |
| `fa_avg_last10` | double precision | yes |  |
| `fa_total_last20` | double precision | yes |  |
| `fa_avg_last20` | double precision | yes |  |
| `ff_pct_total_all` | double precision | yes |  |
| `ff_pct_avg_all` | double precision | yes |  |
| `ff_pct_total_last3` | double precision | yes |  |
| `ff_pct_avg_last3` | double precision | yes |  |
| `ff_pct_total_last5` | double precision | yes |  |
| `ff_pct_avg_last5` | double precision | yes |  |
| `ff_pct_total_last10` | double precision | yes |  |
| `ff_pct_avg_last10` | double precision | yes |  |
| `ff_pct_total_last20` | double precision | yes |  |
| `ff_pct_avg_last20` | double precision | yes |  |
| `goals_total_all` | double precision | yes |  |
| `goals_avg_all` | double precision | yes |  |
| `goals_total_last3` | double precision | yes |  |
| `goals_avg_last3` | double precision | yes |  |
| `goals_total_last5` | double precision | yes |  |
| `goals_avg_last5` | double precision | yes |  |
| `goals_total_last10` | double precision | yes |  |
| `goals_avg_last10` | double precision | yes |  |
| `goals_total_last20` | double precision | yes |  |
| `goals_avg_last20` | double precision | yes |  |
| `assists_total_all` | double precision | yes |  |
| `assists_avg_all` | double precision | yes |  |
| `assists_total_last3` | double precision | yes |  |
| `assists_avg_last3` | double precision | yes |  |
| `assists_total_last5` | double precision | yes |  |
| `assists_avg_last5` | double precision | yes |  |
| `assists_total_last10` | double precision | yes |  |
| `assists_avg_last10` | double precision | yes |  |
| `assists_total_last20` | double precision | yes |  |
| `assists_avg_last20` | double precision | yes |  |
| `shots_total_all` | double precision | yes |  |
| `shots_avg_all` | double precision | yes |  |
| `shots_total_last3` | double precision | yes |  |
| `shots_avg_last3` | double precision | yes |  |
| `shots_total_last5` | double precision | yes |  |
| `shots_avg_last5` | double precision | yes |  |
| `shots_total_last10` | double precision | yes |  |
| `shots_avg_last10` | double precision | yes |  |
| `shots_total_last20` | double precision | yes |  |
| `shots_avg_last20` | double precision | yes |  |
| `hits_total_all` | double precision | yes |  |
| `hits_avg_all` | double precision | yes |  |
| `hits_total_last3` | double precision | yes |  |
| `hits_avg_last3` | double precision | yes |  |
| `hits_total_last5` | double precision | yes |  |
| `hits_avg_last5` | double precision | yes |  |
| `hits_total_last10` | double precision | yes |  |
| `hits_avg_last10` | double precision | yes |  |
| `hits_total_last20` | double precision | yes |  |
| `hits_avg_last20` | double precision | yes |  |
| `blocks_total_all` | double precision | yes |  |
| `blocks_avg_all` | double precision | yes |  |
| `blocks_total_last3` | double precision | yes |  |
| `blocks_avg_last3` | double precision | yes |  |
| `blocks_total_last5` | double precision | yes |  |
| `blocks_avg_last5` | double precision | yes |  |
| `blocks_total_last10` | double precision | yes |  |
| `blocks_avg_last10` | double precision | yes |  |
| `blocks_total_last20` | double precision | yes |  |
| `blocks_avg_last20` | double precision | yes |  |
| `pp_points_total_all` | double precision | yes |  |
| `pp_points_avg_all` | double precision | yes |  |
| `pp_points_total_last3` | double precision | yes |  |
| `pp_points_avg_last3` | double precision | yes |  |
| `pp_points_total_last5` | double precision | yes |  |
| `pp_points_avg_last5` | double precision | yes |  |
| `pp_points_total_last10` | double precision | yes |  |
| `pp_points_avg_last10` | double precision | yes |  |
| `pp_points_total_last20` | double precision | yes |  |
| `pp_points_avg_last20` | double precision | yes |  |
| `points_total_all` | double precision | yes |  |
| `points_avg_all` | double precision | yes |  |
| `points_total_last3` | double precision | yes |  |
| `points_avg_last3` | double precision | yes |  |
| `points_total_last5` | double precision | yes |  |
| `points_avg_last5` | double precision | yes |  |
| `points_total_last10` | double precision | yes |  |
| `points_avg_last10` | double precision | yes |  |
| `points_total_last20` | double precision | yes |  |
| `points_avg_last20` | double precision | yes |  |
| `updated_at` | timestamp with time zone | no | now() |
| `hits_per_60_total_all` | numeric | yes |  |
| `hits_per_60_avg_all` | numeric | yes |  |
| `hits_per_60_total_last3` | numeric | yes |  |
| `hits_per_60_avg_last3` | numeric | yes |  |
| `hits_per_60_total_last5` | numeric | yes |  |
| `hits_per_60_avg_last5` | numeric | yes |  |
| `hits_per_60_total_last10` | numeric | yes |  |
| `hits_per_60_avg_last10` | numeric | yes |  |
| `hits_per_60_total_last20` | numeric | yes |  |
| `hits_per_60_avg_last20` | numeric | yes |  |
| `blocks_per_60_total_all` | numeric | yes |  |
| `blocks_per_60_avg_all` | numeric | yes |  |
| `blocks_per_60_total_last3` | numeric | yes |  |
| `blocks_per_60_avg_last3` | numeric | yes |  |
| `blocks_per_60_total_last5` | numeric | yes |  |
| `blocks_per_60_avg_last5` | numeric | yes |  |
| `blocks_per_60_total_last10` | numeric | yes |  |
| `blocks_per_60_avg_last10` | numeric | yes |  |
| `blocks_per_60_total_last20` | numeric | yes |  |
| `blocks_per_60_avg_last20` | numeric | yes |  |
| `gp_pct_avg_season` | double precision | yes |  |
| `gp_pct_avg_3ya` | double precision | yes |  |
| `gp_pct_avg_career` | double precision | yes |  |
| `toi_seconds_avg_season` | double precision | yes |  |
| `toi_seconds_avg_3ya` | double precision | yes |  |
| `toi_seconds_avg_career` | double precision | yes |  |
| `sog_per_60_avg_season` | double precision | yes |  |
| `sog_per_60_avg_3ya` | double precision | yes |  |
| `sog_per_60_avg_career` | double precision | yes |  |
| `ixg_per_60_avg_season` | double precision | yes |  |
| `ixg_per_60_avg_3ya` | double precision | yes |  |
| `ixg_per_60_avg_career` | double precision | yes |  |
| `shooting_pct_avg_season` | double precision | yes |  |
| `shooting_pct_avg_3ya` | double precision | yes |  |
| `shooting_pct_avg_career` | double precision | yes |  |
| `ixg_avg_season` | double precision | yes |  |
| `ixg_avg_3ya` | double precision | yes |  |
| `ixg_avg_career` | double precision | yes |  |
| `primary_points_pct_avg_season` | double precision | yes |  |
| `primary_points_pct_avg_3ya` | double precision | yes |  |
| `primary_points_pct_avg_career` | double precision | yes |  |
| `expected_sh_pct_avg_season` | double precision | yes |  |
| `expected_sh_pct_avg_3ya` | double precision | yes |  |
| `expected_sh_pct_avg_career` | double precision | yes |  |
| `ipp_avg_season` | double precision | yes |  |
| `ipp_avg_3ya` | double precision | yes |  |
| `ipp_avg_career` | double precision | yes |  |
| `iscf_avg_season` | double precision | yes |  |
| `iscf_avg_3ya` | double precision | yes |  |
| `iscf_avg_career` | double precision | yes |  |
| `ihdcf_avg_season` | double precision | yes |  |
| `ihdcf_avg_3ya` | double precision | yes |  |
| `ihdcf_avg_career` | double precision | yes |  |
| `oz_start_pct_avg_season` | double precision | yes |  |
| `oz_start_pct_avg_3ya` | double precision | yes |  |
| `oz_start_pct_avg_career` | double precision | yes |  |
| `pp_share_pct_avg_season` | double precision | yes |  |
| `pp_share_pct_avg_3ya` | double precision | yes |  |
| `pp_share_pct_avg_career` | double precision | yes |  |
| `on_ice_sh_pct_avg_season` | double precision | yes |  |
| `on_ice_sh_pct_avg_3ya` | double precision | yes |  |
| `on_ice_sh_pct_avg_career` | double precision | yes |  |
| `pdo_avg_season` | double precision | yes |  |
| `pdo_avg_3ya` | double precision | yes |  |
| `pdo_avg_career` | double precision | yes |  |
| `cf_avg_season` | double precision | yes |  |
| `cf_avg_3ya` | double precision | yes |  |
| `cf_avg_career` | double precision | yes |  |
| `ca_avg_season` | double precision | yes |  |
| `ca_avg_3ya` | double precision | yes |  |
| `ca_avg_career` | double precision | yes |  |
| `cf_pct_avg_season` | double precision | yes |  |
| `cf_pct_avg_3ya` | double precision | yes |  |
| `cf_pct_avg_career` | double precision | yes |  |
| `ff_avg_season` | double precision | yes |  |
| `ff_avg_3ya` | double precision | yes |  |
| `ff_avg_career` | double precision | yes |  |
| `fa_avg_season` | double precision | yes |  |
| `fa_avg_3ya` | double precision | yes |  |
| `fa_avg_career` | double precision | yes |  |
| `ff_pct_avg_season` | double precision | yes |  |
| `ff_pct_avg_3ya` | double precision | yes |  |
| `ff_pct_avg_career` | double precision | yes |  |
| `goals_avg_season` | double precision | yes |  |
| `goals_avg_3ya` | double precision | yes |  |
| `goals_avg_career` | double precision | yes |  |
| `assists_avg_season` | double precision | yes |  |
| `assists_avg_3ya` | double precision | yes |  |
| `assists_avg_career` | double precision | yes |  |
| `shots_avg_season` | double precision | yes |  |
| `shots_avg_3ya` | double precision | yes |  |
| `shots_avg_career` | double precision | yes |  |
| `hits_avg_season` | double precision | yes |  |
| `hits_avg_3ya` | double precision | yes |  |
| `hits_avg_career` | double precision | yes |  |
| `blocks_avg_season` | double precision | yes |  |
| `blocks_avg_3ya` | double precision | yes |  |
| `blocks_avg_career` | double precision | yes |  |
| `pp_points_avg_season` | double precision | yes |  |
| `pp_points_avg_3ya` | double precision | yes |  |
| `pp_points_avg_career` | double precision | yes |  |
| `points_avg_season` | double precision | yes |  |
| `points_avg_3ya` | double precision | yes |  |
| `points_avg_career` | double precision | yes |  |
| `hits_per_60_avg_season` | numeric | yes |  |
| `hits_per_60_avg_3ya` | numeric | yes |  |
| `hits_per_60_avg_career` | numeric | yes |  |
| `blocks_per_60_avg_season` | numeric | yes |  |
| `blocks_per_60_avg_3ya` | numeric | yes |  |
| `blocks_per_60_avg_career` | numeric | yes |  |
| `season_games_played` | integer | yes |  |
| `season_team_games_available` | integer | yes |  |
| `three_year_games_played` | integer | yes |  |
| `three_year_team_games_available` | integer | yes |  |
| `career_games_played` | integer | yes |  |
| `career_team_games_available` | integer | yes |  |
| `games_played_last3_team_games` | integer | yes |  |
| `team_games_available_last3` | integer | yes |  |
| `games_played_last5_team_games` | integer | yes |  |
| `team_games_available_last5` | integer | yes |  |
| `games_played_last10_team_games` | integer | yes |  |
| `team_games_available_last10` | integer | yes |  |
| `games_played_last20_team_games` | integer | yes |  |
| `team_games_available_last20` | integer | yes |  |
| `gp_semantic_type` | text | yes |  |
| `season_participation_pct` | double precision | yes |  |
| `three_year_participation_pct` | double precision | yes |  |
| `career_participation_pct` | double precision | yes |  |
| `participation_pct_last3_team_games` | double precision | yes |  |
| `participation_pct_last5_team_games` | double precision | yes |  |
| `participation_pct_last10_team_games` | double precision | yes |  |
| `participation_pct_last20_team_games` | double precision | yes |  |
| `season_participation_games` | integer | yes |  |
| `three_year_participation_games` | integer | yes |  |
| `career_participation_games` | integer | yes |  |
| `participation_games_last3_team_games` | integer | yes |  |
| `participation_games_last5_team_games` | integer | yes |  |
| `participation_games_last10_team_games` | integer | yes |  |
| `participation_games_last20_team_games` | integer | yes |  |
| `shooting_pct_all` | double precision | yes |  |
| `shooting_pct_last3` | double precision | yes |  |
| `shooting_pct_last5` | double precision | yes |  |
| `shooting_pct_last10` | double precision | yes |  |
| `shooting_pct_last20` | double precision | yes |  |
| `shooting_pct_season` | double precision | yes |  |
| `shooting_pct_3ya` | double precision | yes |  |
| `shooting_pct_career` | double precision | yes |  |
| `primary_points_pct_all` | double precision | yes |  |
| `primary_points_pct_last3` | double precision | yes |  |
| `primary_points_pct_last5` | double precision | yes |  |
| `primary_points_pct_last10` | double precision | yes |  |
| `primary_points_pct_last20` | double precision | yes |  |
| `primary_points_pct_season` | double precision | yes |  |
| `primary_points_pct_3ya` | double precision | yes |  |
| `primary_points_pct_career` | double precision | yes |  |
| `expected_sh_pct_all` | double precision | yes |  |
| `expected_sh_pct_last3` | double precision | yes |  |
| `expected_sh_pct_last5` | double precision | yes |  |
| `expected_sh_pct_last10` | double precision | yes |  |
| `expected_sh_pct_last20` | double precision | yes |  |
| `expected_sh_pct_season` | double precision | yes |  |
| `expected_sh_pct_3ya` | double precision | yes |  |
| `expected_sh_pct_career` | double precision | yes |  |
| `ipp_all` | double precision | yes |  |
| `ipp_last3` | double precision | yes |  |
| `ipp_last5` | double precision | yes |  |
| `ipp_last10` | double precision | yes |  |
| `ipp_last20` | double precision | yes |  |
| `ipp_season` | double precision | yes |  |
| `ipp_3ya` | double precision | yes |  |
| `ipp_career` | double precision | yes |  |
| `on_ice_sh_pct_all` | double precision | yes |  |
| `on_ice_sh_pct_last3` | double precision | yes |  |
| `on_ice_sh_pct_last5` | double precision | yes |  |
| `on_ice_sh_pct_last10` | double precision | yes |  |
| `on_ice_sh_pct_last20` | double precision | yes |  |
| `on_ice_sh_pct_season` | double precision | yes |  |
| `on_ice_sh_pct_3ya` | double precision | yes |  |
| `on_ice_sh_pct_career` | double precision | yes |  |
| `oz_start_pct_all` | double precision | yes |  |
| `oz_start_pct_last3` | double precision | yes |  |
| `oz_start_pct_last5` | double precision | yes |  |
| `oz_start_pct_last10` | double precision | yes |  |
| `oz_start_pct_last20` | double precision | yes |  |
| `oz_start_pct_season` | double precision | yes |  |
| `oz_start_pct_3ya` | double precision | yes |  |
| `oz_start_pct_career` | double precision | yes |  |
| `pp_share_pct_all` | double precision | yes |  |
| `pp_share_pct_last3` | double precision | yes |  |
| `pp_share_pct_last5` | double precision | yes |  |
| `pp_share_pct_last10` | double precision | yes |  |
| `pp_share_pct_last20` | double precision | yes |  |
| `pp_share_pct_season` | double precision | yes |  |
| `pp_share_pct_3ya` | double precision | yes |  |
| `pp_share_pct_career` | double precision | yes |  |
| `cf_pct_all` | double precision | yes |  |
| `cf_pct_last3` | double precision | yes |  |
| `cf_pct_last5` | double precision | yes |  |
| `cf_pct_last10` | double precision | yes |  |
| `cf_pct_last20` | double precision | yes |  |
| `cf_pct_season` | double precision | yes |  |
| `cf_pct_3ya` | double precision | yes |  |
| `cf_pct_career` | double precision | yes |  |
| `ff_pct_all` | double precision | yes |  |
| `ff_pct_last3` | double precision | yes |  |
| `ff_pct_last5` | double precision | yes |  |
| `ff_pct_last10` | double precision | yes |  |
| `ff_pct_last20` | double precision | yes |  |
| `ff_pct_season` | double precision | yes |  |
| `ff_pct_3ya` | double precision | yes |  |
| `ff_pct_career` | double precision | yes |  |
| `pdo_all` | double precision | yes |  |
| `pdo_last3` | double precision | yes |  |
| `pdo_last5` | double precision | yes |  |
| `pdo_last10` | double precision | yes |  |
| `pdo_last20` | double precision | yes |  |
| `pdo_season` | double precision | yes |  |
| `pdo_3ya` | double precision | yes |  |
| `pdo_career` | double precision | yes |  |
| `sog_per_60_all` | double precision | yes |  |
| `sog_per_60_last3` | double precision | yes |  |
| `sog_per_60_last5` | double precision | yes |  |
| `sog_per_60_last10` | double precision | yes |  |
| `sog_per_60_last20` | double precision | yes |  |
| `sog_per_60_season` | double precision | yes |  |
| `sog_per_60_3ya` | double precision | yes |  |
| `sog_per_60_career` | double precision | yes |  |
| `ixg_per_60_all` | double precision | yes |  |
| `ixg_per_60_last3` | double precision | yes |  |
| `ixg_per_60_last5` | double precision | yes |  |
| `ixg_per_60_last10` | double precision | yes |  |
| `ixg_per_60_last20` | double precision | yes |  |
| `ixg_per_60_season` | double precision | yes |  |
| `ixg_per_60_3ya` | double precision | yes |  |
| `ixg_per_60_career` | double precision | yes |  |
| `hits_per_60_all` | double precision | yes |  |
| `hits_per_60_last3` | double precision | yes |  |
| `hits_per_60_last5` | double precision | yes |  |
| `hits_per_60_last10` | double precision | yes |  |
| `hits_per_60_last20` | double precision | yes |  |
| `hits_per_60_season` | double precision | yes |  |
| `hits_per_60_3ya` | double precision | yes |  |
| `hits_per_60_career` | double precision | yes |  |
| `blocks_per_60_all` | double precision | yes |  |
| `blocks_per_60_last3` | double precision | yes |  |
| `blocks_per_60_last5` | double precision | yes |  |
| `blocks_per_60_last10` | double precision | yes |  |
| `blocks_per_60_last20` | double precision | yes |  |
| `blocks_per_60_season` | double precision | yes |  |
| `blocks_per_60_3ya` | double precision | yes |  |
| `blocks_per_60_career` | double precision | yes |  |
| `shooting_pct_goals_season` | integer | yes |  |
| `shooting_pct_shots_season` | integer | yes |  |
| `shooting_pct_goals_3ya` | integer | yes |  |
| `shooting_pct_shots_3ya` | integer | yes |  |
| `shooting_pct_goals_career` | integer | yes |  |
| `shooting_pct_shots_career` | integer | yes |  |
| `expected_sh_pct_ixg_season` | double precision | yes |  |
| `expected_sh_pct_shots_season` | integer | yes |  |
| `expected_sh_pct_ixg_3ya` | double precision | yes |  |
| `expected_sh_pct_shots_3ya` | integer | yes |  |
| `expected_sh_pct_ixg_career` | double precision | yes |  |
| `expected_sh_pct_shots_career` | integer | yes |  |
| `cf_pct_cf_season` | integer | yes |  |
| `cf_pct_ca_season` | integer | yes |  |
| `cf_pct_cf_3ya` | integer | yes |  |
| `cf_pct_ca_3ya` | integer | yes |  |
| `cf_pct_cf_career` | integer | yes |  |
| `cf_pct_ca_career` | integer | yes |  |
| `ff_pct_ff_season` | integer | yes |  |
| `ff_pct_fa_season` | integer | yes |  |
| `ff_pct_ff_3ya` | integer | yes |  |
| `ff_pct_fa_3ya` | integer | yes |  |
| `ff_pct_ff_career` | integer | yes |  |
| `ff_pct_fa_career` | integer | yes |  |
| `sog_per_60_shots_season` | integer | yes |  |
| `sog_per_60_toi_seconds_season` | double precision | yes |  |
| `sog_per_60_shots_3ya` | integer | yes |  |
| `sog_per_60_toi_seconds_3ya` | double precision | yes |  |
| `sog_per_60_shots_career` | integer | yes |  |
| `sog_per_60_toi_seconds_career` | double precision | yes |  |
| `ixg_per_60_ixg_season` | double precision | yes |  |
| `ixg_per_60_toi_seconds_season` | double precision | yes |  |
| `ixg_per_60_ixg_3ya` | double precision | yes |  |
| `ixg_per_60_toi_seconds_3ya` | double precision | yes |  |
| `ixg_per_60_ixg_career` | double precision | yes |  |
| `ixg_per_60_toi_seconds_career` | double precision | yes |  |
| `hits_per_60_hits_season` | integer | yes |  |
| `hits_per_60_toi_seconds_season` | double precision | yes |  |
| `hits_per_60_hits_3ya` | integer | yes |  |
| `hits_per_60_toi_seconds_3ya` | double precision | yes |  |
| `hits_per_60_hits_career` | integer | yes |  |
| `hits_per_60_toi_seconds_career` | double precision | yes |  |
| `blocks_per_60_blocks_season` | integer | yes |  |
| `blocks_per_60_toi_seconds_season` | double precision | yes |  |
| `blocks_per_60_blocks_3ya` | integer | yes |  |
| `blocks_per_60_toi_seconds_3ya` | double precision | yes |  |
| `blocks_per_60_blocks_career` | integer | yes |  |
| `blocks_per_60_toi_seconds_career` | double precision | yes |  |
| `primary_points_pct_primary_points_all` | integer | yes |  |
| `primary_points_pct_points_all` | integer | yes |  |
| `primary_points_pct_primary_points_last3` | integer | yes |  |
| `primary_points_pct_points_last3` | integer | yes |  |
| `primary_points_pct_primary_points_last5` | integer | yes |  |
| `primary_points_pct_points_last5` | integer | yes |  |
| `primary_points_pct_primary_points_last10` | integer | yes |  |
| `primary_points_pct_points_last10` | integer | yes |  |
| `primary_points_pct_primary_points_last20` | integer | yes |  |
| `primary_points_pct_points_last20` | integer | yes |  |
| `primary_points_pct_primary_points_season` | integer | yes |  |
| `primary_points_pct_points_season` | integer | yes |  |
| `primary_points_pct_primary_points_3ya` | integer | yes |  |
| `primary_points_pct_points_3ya` | integer | yes |  |
| `primary_points_pct_primary_points_career` | integer | yes |  |
| `primary_points_pct_points_career` | integer | yes |  |
| `ipp_points_all` | integer | yes |  |
| `ipp_on_ice_goals_for_all` | integer | yes |  |
| `ipp_points_last3` | integer | yes |  |
| `ipp_on_ice_goals_for_last3` | integer | yes |  |
| `ipp_points_last5` | integer | yes |  |
| `ipp_on_ice_goals_for_last5` | integer | yes |  |
| `ipp_points_last10` | integer | yes |  |
| `ipp_on_ice_goals_for_last10` | integer | yes |  |
| `ipp_points_last20` | integer | yes |  |
| `ipp_on_ice_goals_for_last20` | integer | yes |  |
| `ipp_points_season` | integer | yes |  |
| `ipp_on_ice_goals_for_season` | integer | yes |  |
| `ipp_points_3ya` | integer | yes |  |
| `ipp_on_ice_goals_for_3ya` | integer | yes |  |
| `ipp_points_career` | integer | yes |  |
| `ipp_on_ice_goals_for_career` | integer | yes |  |
| `on_ice_sh_pct_goals_for_all` | integer | yes |  |
| `on_ice_sh_pct_shots_for_all` | integer | yes |  |
| `on_ice_sh_pct_goals_for_last3` | integer | yes |  |
| `on_ice_sh_pct_shots_for_last3` | integer | yes |  |
| `on_ice_sh_pct_goals_for_last5` | integer | yes |  |
| `on_ice_sh_pct_shots_for_last5` | integer | yes |  |
| `on_ice_sh_pct_goals_for_last10` | integer | yes |  |
| `on_ice_sh_pct_shots_for_last10` | integer | yes |  |
| `on_ice_sh_pct_goals_for_last20` | integer | yes |  |
| `on_ice_sh_pct_shots_for_last20` | integer | yes |  |
| `on_ice_sh_pct_goals_for_season` | integer | yes |  |
| `on_ice_sh_pct_shots_for_season` | integer | yes |  |
| `on_ice_sh_pct_goals_for_3ya` | integer | yes |  |
| `on_ice_sh_pct_shots_for_3ya` | integer | yes |  |
| `on_ice_sh_pct_goals_for_career` | integer | yes |  |
| `on_ice_sh_pct_shots_for_career` | integer | yes |  |
| `pdo_goals_for_all` | integer | yes |  |
| `pdo_shots_for_all` | integer | yes |  |
| `pdo_goals_against_all` | integer | yes |  |
| `pdo_shots_against_all` | integer | yes |  |
| `pdo_goals_for_last3` | integer | yes |  |
| `pdo_shots_for_last3` | integer | yes |  |
| `pdo_goals_against_last3` | integer | yes |  |
| `pdo_shots_against_last3` | integer | yes |  |
| `pdo_goals_for_last5` | integer | yes |  |
| `pdo_shots_for_last5` | integer | yes |  |
| `pdo_goals_against_last5` | integer | yes |  |
| `pdo_shots_against_last5` | integer | yes |  |
| `pdo_goals_for_last10` | integer | yes |  |
| `pdo_shots_for_last10` | integer | yes |  |
| `pdo_goals_against_last10` | integer | yes |  |
| `pdo_shots_against_last10` | integer | yes |  |
| `pdo_goals_for_last20` | integer | yes |  |
| `pdo_shots_for_last20` | integer | yes |  |
| `pdo_goals_against_last20` | integer | yes |  |
| `pdo_shots_against_last20` | integer | yes |  |
| `pdo_goals_for_season` | integer | yes |  |
| `pdo_shots_for_season` | integer | yes |  |
| `pdo_goals_against_season` | integer | yes |  |
| `pdo_shots_against_season` | integer | yes |  |
| `pdo_goals_for_3ya` | integer | yes |  |
| `pdo_shots_for_3ya` | integer | yes |  |
| `pdo_goals_against_3ya` | integer | yes |  |
| `pdo_shots_against_3ya` | integer | yes |  |
| `pdo_goals_for_career` | integer | yes |  |
| `pdo_shots_for_career` | integer | yes |  |
| `pdo_goals_against_career` | integer | yes |  |
| `pdo_shots_against_career` | integer | yes |  |
| `oz_start_pct_off_zone_starts_all` | integer | yes |  |
| `oz_start_pct_def_zone_starts_all` | integer | yes |  |
| `oz_start_pct_neutral_zone_starts_all` | integer | yes |  |
| `oz_start_pct_off_zone_starts_last3` | integer | yes |  |
| `oz_start_pct_def_zone_starts_last3` | integer | yes |  |
| `oz_start_pct_neutral_zone_starts_last3` | integer | yes |  |
| `oz_start_pct_off_zone_starts_last5` | integer | yes |  |
| `oz_start_pct_def_zone_starts_last5` | integer | yes |  |
| `oz_start_pct_neutral_zone_starts_last5` | integer | yes |  |
| `oz_start_pct_off_zone_starts_last10` | integer | yes |  |
| `oz_start_pct_def_zone_starts_last10` | integer | yes |  |
| `oz_start_pct_neutral_zone_starts_last10` | integer | yes |  |
| `oz_start_pct_off_zone_starts_last20` | integer | yes |  |
| `oz_start_pct_def_zone_starts_last20` | integer | yes |  |
| `oz_start_pct_neutral_zone_starts_last20` | integer | yes |  |
| `oz_start_pct_off_zone_starts_season` | integer | yes |  |
| `oz_start_pct_def_zone_starts_season` | integer | yes |  |
| `oz_start_pct_neutral_zone_starts_season` | integer | yes |  |
| `oz_start_pct_off_zone_starts_3ya` | integer | yes |  |
| `oz_start_pct_def_zone_starts_3ya` | integer | yes |  |
| `oz_start_pct_neutral_zone_starts_3ya` | integer | yes |  |
| `oz_start_pct_off_zone_starts_career` | integer | yes |  |
| `oz_start_pct_def_zone_starts_career` | integer | yes |  |
| `oz_start_pct_neutral_zone_starts_career` | integer | yes |  |
| `pp_share_pct_player_pp_toi_all` | double precision | yes |  |
| `pp_share_pct_team_pp_toi_all` | double precision | yes |  |
| `pp_share_pct_player_pp_toi_last3` | double precision | yes |  |
| `pp_share_pct_team_pp_toi_last3` | double precision | yes |  |
| `pp_share_pct_player_pp_toi_last5` | double precision | yes |  |
| `pp_share_pct_team_pp_toi_last5` | double precision | yes |  |
| `pp_share_pct_player_pp_toi_last10` | double precision | yes |  |
| `pp_share_pct_team_pp_toi_last10` | double precision | yes |  |
| `pp_share_pct_player_pp_toi_last20` | double precision | yes |  |
| `pp_share_pct_team_pp_toi_last20` | double precision | yes |  |
| `pp_share_pct_player_pp_toi_season` | double precision | yes |  |
| `pp_share_pct_team_pp_toi_season` | double precision | yes |  |
| `pp_share_pct_player_pp_toi_3ya` | double precision | yes |  |
| `pp_share_pct_team_pp_toi_3ya` | double precision | yes |  |
| `pp_share_pct_player_pp_toi_career` | double precision | yes |  |
| `pp_share_pct_team_pp_toi_career` | double precision | yes |  |
| `season_availability_pct` | double precision | yes |  |
| `three_year_availability_pct` | double precision | yes |  |
| `career_availability_pct` | double precision | yes |  |
| `availability_pct_last3_team_games` | double precision | yes |  |
| `availability_pct_last5_team_games` | double precision | yes |  |
| `availability_pct_last10_team_games` | double precision | yes |  |
| `availability_pct_last20_team_games` | double precision | yes |  |
| `on_ice_sv_pct_total_all` | double precision | yes |  |
| `on_ice_sv_pct_avg_all` | double precision | yes |  |
| `on_ice_sv_pct_total_last3` | double precision | yes |  |
| `on_ice_sv_pct_avg_last3` | double precision | yes |  |
| `on_ice_sv_pct_total_last5` | double precision | yes |  |
| `on_ice_sv_pct_avg_last5` | double precision | yes |  |
| `on_ice_sv_pct_total_last10` | double precision | yes |  |
| `on_ice_sv_pct_avg_last10` | double precision | yes |  |
| `on_ice_sv_pct_total_last20` | double precision | yes |  |
| `on_ice_sv_pct_avg_last20` | double precision | yes |  |
| `on_ice_sv_pct_avg_season` | double precision | yes |  |
| `on_ice_sv_pct_avg_3ya` | double precision | yes |  |
| `on_ice_sv_pct_avg_career` | double precision | yes |  |
| `on_ice_sv_pct_all` | double precision | yes |  |
| `on_ice_sv_pct_last3` | double precision | yes |  |
| `on_ice_sv_pct_last5` | double precision | yes |  |
| `on_ice_sv_pct_last10` | double precision | yes |  |
| `on_ice_sv_pct_last20` | double precision | yes |  |
| `on_ice_sv_pct_season` | double precision | yes |  |
| `on_ice_sv_pct_3ya` | double precision | yes |  |
| `on_ice_sv_pct_career` | double precision | yes |  |
| `oz_starts_total_all` | double precision | yes |  |
| `oz_starts_avg_all` | double precision | yes |  |
| `oz_starts_total_last3` | double precision | yes |  |
| `oz_starts_avg_last3` | double precision | yes |  |
| `oz_starts_total_last5` | double precision | yes |  |
| `oz_starts_avg_last5` | double precision | yes |  |
| `oz_starts_total_last10` | double precision | yes |  |
| `oz_starts_avg_last10` | double precision | yes |  |
| `oz_starts_total_last20` | double precision | yes |  |
| `oz_starts_avg_last20` | double precision | yes |  |
| `oz_starts_avg_season` | double precision | yes |  |
| `oz_starts_avg_3ya` | double precision | yes |  |
| `oz_starts_avg_career` | double precision | yes |  |
| `dz_starts_total_all` | double precision | yes |  |
| `dz_starts_avg_all` | double precision | yes |  |
| `dz_starts_total_last3` | double precision | yes |  |
| `dz_starts_avg_last3` | double precision | yes |  |
| `dz_starts_total_last5` | double precision | yes |  |
| `dz_starts_avg_last5` | double precision | yes |  |
| `dz_starts_total_last10` | double precision | yes |  |
| `dz_starts_avg_last10` | double precision | yes |  |
| `dz_starts_total_last20` | double precision | yes |  |
| `dz_starts_avg_last20` | double precision | yes |  |
| `dz_starts_avg_season` | double precision | yes |  |
| `dz_starts_avg_3ya` | double precision | yes |  |
| `dz_starts_avg_career` | double precision | yes |  |
| `nz_starts_total_all` | double precision | yes |  |
| `nz_starts_avg_all` | double precision | yes |  |
| `nz_starts_total_last3` | double precision | yes |  |
| `nz_starts_avg_last3` | double precision | yes |  |
| `nz_starts_total_last5` | double precision | yes |  |
| `nz_starts_avg_last5` | double precision | yes |  |
| `nz_starts_total_last10` | double precision | yes |  |
| `nz_starts_avg_last10` | double precision | yes |  |
| `nz_starts_total_last20` | double precision | yes |  |
| `nz_starts_avg_last20` | double precision | yes |  |
| `nz_starts_avg_season` | double precision | yes |  |
| `nz_starts_avg_3ya` | double precision | yes |  |
| `nz_starts_avg_career` | double precision | yes |  |
| `oi_gf_total_all` | double precision | yes |  |
| `oi_gf_avg_all` | double precision | yes |  |
| `oi_gf_total_last3` | double precision | yes |  |
| `oi_gf_avg_last3` | double precision | yes |  |
| `oi_gf_total_last5` | double precision | yes |  |
| `oi_gf_avg_last5` | double precision | yes |  |
| `oi_gf_total_last10` | double precision | yes |  |
| `oi_gf_avg_last10` | double precision | yes |  |
| `oi_gf_total_last20` | double precision | yes |  |
| `oi_gf_avg_last20` | double precision | yes |  |
| `oi_gf_avg_season` | double precision | yes |  |
| `oi_gf_avg_3ya` | double precision | yes |  |
| `oi_gf_avg_career` | double precision | yes |  |
| `oi_ga_total_all` | double precision | yes |  |
| `oi_ga_avg_all` | double precision | yes |  |
| `oi_ga_total_last3` | double precision | yes |  |
| `oi_ga_avg_last3` | double precision | yes |  |
| `oi_ga_total_last5` | double precision | yes |  |
| `oi_ga_avg_last5` | double precision | yes |  |
| `oi_ga_total_last10` | double precision | yes |  |
| `oi_ga_avg_last10` | double precision | yes |  |
| `oi_ga_total_last20` | double precision | yes |  |
| `oi_ga_avg_last20` | double precision | yes |  |
| `oi_ga_avg_season` | double precision | yes |  |
| `oi_ga_avg_3ya` | double precision | yes |  |
| `oi_ga_avg_career` | double precision | yes |  |
| `oi_sf_total_all` | double precision | yes |  |
| `oi_sf_avg_all` | double precision | yes |  |
| `oi_sf_total_last3` | double precision | yes |  |
| `oi_sf_avg_last3` | double precision | yes |  |
| `oi_sf_total_last5` | double precision | yes |  |
| `oi_sf_avg_last5` | double precision | yes |  |
| `oi_sf_total_last10` | double precision | yes |  |
| `oi_sf_avg_last10` | double precision | yes |  |
| `oi_sf_total_last20` | double precision | yes |  |
| `oi_sf_avg_last20` | double precision | yes |  |
| `oi_sf_avg_season` | double precision | yes |  |
| `oi_sf_avg_3ya` | double precision | yes |  |
| `oi_sf_avg_career` | double precision | yes |  |
| `oi_sa_total_all` | double precision | yes |  |
| `oi_sa_avg_all` | double precision | yes |  |
| `oi_sa_total_last3` | double precision | yes |  |
| `oi_sa_avg_last3` | double precision | yes |  |
| `oi_sa_total_last5` | double precision | yes |  |
| `oi_sa_avg_last5` | double precision | yes |  |
| `oi_sa_total_last10` | double precision | yes |  |
| `oi_sa_avg_last10` | double precision | yes |  |
| `oi_sa_total_last20` | double precision | yes |  |
| `oi_sa_avg_last20` | double precision | yes |  |
| `oi_sa_avg_season` | double precision | yes |  |
| `oi_sa_avg_3ya` | double precision | yes |  |
| `oi_sa_avg_career` | double precision | yes |  |
| `goals_per_60_total_all` | double precision | yes |  |
| `goals_per_60_avg_all` | double precision | yes |  |
| `goals_per_60_total_last3` | double precision | yes |  |
| `goals_per_60_avg_last3` | double precision | yes |  |
| `goals_per_60_total_last5` | double precision | yes |  |
| `goals_per_60_avg_last5` | double precision | yes |  |
| `goals_per_60_total_last10` | double precision | yes |  |
| `goals_per_60_avg_last10` | double precision | yes |  |
| `goals_per_60_total_last20` | double precision | yes |  |
| `goals_per_60_avg_last20` | double precision | yes |  |
| `goals_per_60_avg_season` | double precision | yes |  |
| `goals_per_60_avg_3ya` | double precision | yes |  |
| `goals_per_60_avg_career` | double precision | yes |  |
| `goals_per_60_all` | double precision | yes |  |
| `goals_per_60_last3` | double precision | yes |  |
| `goals_per_60_last5` | double precision | yes |  |
| `goals_per_60_last10` | double precision | yes |  |
| `goals_per_60_last20` | double precision | yes |  |
| `goals_per_60_season` | double precision | yes |  |
| `goals_per_60_3ya` | double precision | yes |  |
| `goals_per_60_career` | double precision | yes |  |
| `goals_per_60_goals_season` | integer | yes |  |
| `goals_per_60_toi_seconds_season` | double precision | yes |  |
| `goals_per_60_goals_3ya` | integer | yes |  |
| `goals_per_60_toi_seconds_3ya` | double precision | yes |  |
| `goals_per_60_goals_career` | integer | yes |  |
| `goals_per_60_toi_seconds_career` | double precision | yes |  |
| `assists_per_60_total_all` | double precision | yes |  |
| `assists_per_60_avg_all` | double precision | yes |  |
| `assists_per_60_total_last3` | double precision | yes |  |
| `assists_per_60_avg_last3` | double precision | yes |  |
| `assists_per_60_total_last5` | double precision | yes |  |
| `assists_per_60_avg_last5` | double precision | yes |  |
| `assists_per_60_total_last10` | double precision | yes |  |
| `assists_per_60_avg_last10` | double precision | yes |  |
| `assists_per_60_total_last20` | double precision | yes |  |
| `assists_per_60_avg_last20` | double precision | yes |  |
| `assists_per_60_avg_season` | double precision | yes |  |
| `assists_per_60_avg_3ya` | double precision | yes |  |
| `assists_per_60_avg_career` | double precision | yes |  |
| `assists_per_60_all` | double precision | yes |  |
| `assists_per_60_last3` | double precision | yes |  |
| `assists_per_60_last5` | double precision | yes |  |
| `assists_per_60_last10` | double precision | yes |  |
| `assists_per_60_last20` | double precision | yes |  |
| `assists_per_60_season` | double precision | yes |  |
| `assists_per_60_3ya` | double precision | yes |  |
| `assists_per_60_career` | double precision | yes |  |
| `assists_per_60_assists_season` | integer | yes |  |
| `assists_per_60_toi_seconds_season` | double precision | yes |  |
| `assists_per_60_assists_3ya` | integer | yes |  |
| `assists_per_60_toi_seconds_3ya` | double precision | yes |  |
| `assists_per_60_assists_career` | integer | yes |  |
| `assists_per_60_toi_seconds_career` | double precision | yes |  |
| `primary_assists_per_60_total_all` | double precision | yes |  |
| `primary_assists_per_60_avg_all` | double precision | yes |  |
| `primary_assists_per_60_total_last3` | double precision | yes |  |
| `primary_assists_per_60_avg_last3` | double precision | yes |  |
| `primary_assists_per_60_total_last5` | double precision | yes |  |
| `primary_assists_per_60_avg_last5` | double precision | yes |  |
| `primary_assists_per_60_total_last10` | double precision | yes |  |
| `primary_assists_per_60_avg_last10` | double precision | yes |  |
| `primary_assists_per_60_total_last20` | double precision | yes |  |
| `primary_assists_per_60_avg_last20` | double precision | yes |  |
| `primary_assists_per_60_avg_season` | double precision | yes |  |
| `primary_assists_per_60_avg_3ya` | double precision | yes |  |
| `primary_assists_per_60_avg_career` | double precision | yes |  |
| `primary_assists_per_60_all` | double precision | yes |  |
| `primary_assists_per_60_last3` | double precision | yes |  |
| `primary_assists_per_60_last5` | double precision | yes |  |
| `primary_assists_per_60_last10` | double precision | yes |  |
| `primary_assists_per_60_last20` | double precision | yes |  |
| `primary_assists_per_60_season` | double precision | yes |  |
| `primary_assists_per_60_3ya` | double precision | yes |  |
| `primary_assists_per_60_career` | double precision | yes |  |
| `primary_assists_per_60_primary_assists_season` | integer | yes |  |
| `primary_assists_per_60_toi_seconds_season` | double precision | yes |  |
| `primary_assists_per_60_primary_assists_3ya` | integer | yes |  |
| `primary_assists_per_60_toi_seconds_3ya` | double precision | yes |  |
| `primary_assists_per_60_primary_assists_career` | integer | yes |  |
| `primary_assists_per_60_toi_seconds_career` | double precision | yes |  |
| `secondary_assists_per_60_total_all` | double precision | yes |  |
| `secondary_assists_per_60_avg_all` | double precision | yes |  |
| `secondary_assists_per_60_total_last3` | double precision | yes |  |
| `secondary_assists_per_60_avg_last3` | double precision | yes |  |
| `secondary_assists_per_60_total_last5` | double precision | yes |  |
| `secondary_assists_per_60_avg_last5` | double precision | yes |  |
| `secondary_assists_per_60_total_last10` | double precision | yes |  |
| `secondary_assists_per_60_avg_last10` | double precision | yes |  |
| `secondary_assists_per_60_total_last20` | double precision | yes |  |
| `secondary_assists_per_60_avg_last20` | double precision | yes |  |
| `secondary_assists_per_60_avg_season` | double precision | yes |  |
| `secondary_assists_per_60_avg_3ya` | double precision | yes |  |
| `secondary_assists_per_60_avg_career` | double precision | yes |  |
| `secondary_assists_per_60_all` | double precision | yes |  |
| `secondary_assists_per_60_last3` | double precision | yes |  |
| `secondary_assists_per_60_last5` | double precision | yes |  |
| `secondary_assists_per_60_last10` | double precision | yes |  |
| `secondary_assists_per_60_last20` | double precision | yes |  |
| `secondary_assists_per_60_season` | double precision | yes |  |
| `secondary_assists_per_60_3ya` | double precision | yes |  |
| `secondary_assists_per_60_career` | double precision | yes |  |
| `secondary_assists_per_60_secondary_assists_season` | integer | yes |  |
| `secondary_assists_per_60_toi_seconds_season` | double precision | yes |  |
| `secondary_assists_per_60_secondary_assists_3ya` | integer | yes |  |
| `secondary_assists_per_60_toi_seconds_3ya` | double precision | yes |  |
| `secondary_assists_per_60_secondary_assists_career` | integer | yes |  |
| `secondary_assists_per_60_toi_seconds_career` | double precision | yes |  |
| `pp_share_of_team` | double precision | yes |  |
| `pp_unit_usage_index` | double precision | yes |  |
| `pp_unit_relative_toi` | double precision | yes |  |
| `pp_vs_unit_avg` | double precision | yes |  |
| `primary_assists_avg_3ya` | double precision | yes |  |
| `primary_assists_avg_all` | double precision | yes |  |
| `primary_assists_avg_career` | double precision | yes |  |
| `primary_assists_avg_last10` | double precision | yes |  |
| `primary_assists_avg_last20` | double precision | yes |  |
| `primary_assists_avg_last3` | double precision | yes |  |
| `primary_assists_avg_last5` | double precision | yes |  |
| `primary_assists_avg_season` | double precision | yes |  |
| `primary_assists_total_all` | double precision | yes |  |
| `primary_assists_total_last10` | double precision | yes |  |
| `primary_assists_total_last20` | double precision | yes |  |
| `primary_assists_total_last3` | double precision | yes |  |
| `primary_assists_total_last5` | double precision | yes |  |
| `secondary_assists_avg_3ya` | double precision | yes |  |
| `secondary_assists_avg_all` | double precision | yes |  |
| `secondary_assists_avg_career` | double precision | yes |  |
| `secondary_assists_avg_last10` | double precision | yes |  |
| `secondary_assists_avg_last20` | double precision | yes |  |
| `secondary_assists_avg_last3` | double precision | yes |  |
| `secondary_assists_avg_last5` | double precision | yes |  |
| `secondary_assists_avg_season` | double precision | yes |  |
| `secondary_assists_total_all` | double precision | yes |  |
| `secondary_assists_total_last10` | double precision | yes |  |
| `secondary_assists_total_last20` | double precision | yes |  |
| `secondary_assists_total_last3` | double precision | yes |  |
| `secondary_assists_total_last5` | double precision | yes |  |
| `penalties_drawn_total_all` | double precision | yes |  |
| `penalties_drawn_avg_all` | double precision | yes |  |
| `penalties_drawn_total_last3` | double precision | yes |  |
| `penalties_drawn_avg_last3` | double precision | yes |  |
| `penalties_drawn_total_last5` | double precision | yes |  |
| `penalties_drawn_avg_last5` | double precision | yes |  |
| `penalties_drawn_total_last10` | double precision | yes |  |
| `penalties_drawn_avg_last10` | double precision | yes |  |
| `penalties_drawn_total_last20` | double precision | yes |  |
| `penalties_drawn_avg_last20` | double precision | yes |  |
| `penalties_drawn_avg_season` | double precision | yes |  |
| `penalties_drawn_avg_3ya` | double precision | yes |  |
| `penalties_drawn_avg_career` | double precision | yes |  |
| `penalties_drawn_per_60_total_all` | double precision | yes |  |
| `penalties_drawn_per_60_avg_all` | double precision | yes |  |
| `penalties_drawn_per_60_total_last3` | double precision | yes |  |
| `penalties_drawn_per_60_avg_last3` | double precision | yes |  |
| `penalties_drawn_per_60_total_last5` | double precision | yes |  |
| `penalties_drawn_per_60_avg_last5` | double precision | yes |  |
| `penalties_drawn_per_60_total_last10` | double precision | yes |  |
| `penalties_drawn_per_60_avg_last10` | double precision | yes |  |
| `penalties_drawn_per_60_total_last20` | double precision | yes |  |
| `penalties_drawn_per_60_avg_last20` | double precision | yes |  |
| `penalties_drawn_per_60_avg_season` | double precision | yes |  |
| `penalties_drawn_per_60_avg_3ya` | double precision | yes |  |
| `penalties_drawn_per_60_avg_career` | double precision | yes |  |
| `penalties_drawn_per_60_all` | double precision | yes |  |
| `penalties_drawn_per_60_last3` | double precision | yes |  |
| `penalties_drawn_per_60_last5` | double precision | yes |  |
| `penalties_drawn_per_60_last10` | double precision | yes |  |
| `penalties_drawn_per_60_last20` | double precision | yes |  |
| `penalties_drawn_per_60_season` | double precision | yes |  |
| `penalties_drawn_per_60_3ya` | double precision | yes |  |
| `penalties_drawn_per_60_career` | double precision | yes |  |
| `penalties_drawn_per_60_penalties_drawn_season` | integer | yes |  |
| `penalties_drawn_per_60_toi_seconds_season` | double precision | yes |  |
| `penalties_drawn_per_60_penalties_drawn_3ya` | integer | yes |  |
| `penalties_drawn_per_60_toi_seconds_3ya` | double precision | yes |  |
| `penalties_drawn_per_60_penalties_drawn_career` | integer | yes |  |
| `penalties_drawn_per_60_toi_seconds_career` | double precision | yes |  |
| `pp_toi_seconds_total_all` | double precision | yes |  |
| `pp_toi_seconds_avg_all` | double precision | yes |  |
| `pp_toi_seconds_total_last3` | double precision | yes |  |
| `pp_toi_seconds_avg_last3` | double precision | yes |  |
| `pp_toi_seconds_total_last5` | double precision | yes |  |
| `pp_toi_seconds_avg_last5` | double precision | yes |  |
| `pp_toi_seconds_total_last10` | double precision | yes |  |
| `pp_toi_seconds_avg_last10` | double precision | yes |  |
| `pp_toi_seconds_total_last20` | double precision | yes |  |
| `pp_toi_seconds_avg_last20` | double precision | yes |  |
| `pp_toi_seconds_avg_season` | double precision | yes |  |
| `pp_toi_seconds_avg_3ya` | double precision | yes |  |
| `pp_toi_seconds_avg_career` | double precision | yes |  |

## `public.rosters`

Type: table

Primary key: `playerId`, `seasonId`, `teamId`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `playerId` | bigint | no |  |
| `seasonId` | bigint | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `teamId` | smallint | no |  |
| `sweaterNumber` | smallint | no |  |
| `is_current` | boolean | no | true |
| `ended_at` | timestamp with time zone | yes |  |

## `public.skater_defensive_ratings_daily`

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
| `model_name` | text | no | 'skater_defense_v1'::text |
| `model_version` | text | no | 'v1'::text |
| `source_window` | text | no | 'season_to_date'::text |
| `components` | jsonb | no | '{}'::jsonb |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.skater_offensive_ratings_daily`

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
| `model_name` | text | no | 'skater_offense_v1'::text |
| `model_version` | text | no | 'v1'::text |
| `source_window` | text | no | 'season_to_date'::text |
| `components` | jsonb | no | '{}'::jsonb |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.skatersGameStats`

Type: table

Primary key: `playerId`, `gameId`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `playerId` | bigint | no |  |
| `gameId` | bigint | no |  |
| `position` | NHL_Position_Code | no | 'L'::"NHL_Position_Code" |
| `goals` | smallint | no | '0'::smallint |
| `assists` | smallint | no | '0'::smallint |
| `points` | smallint | no | '0'::smallint |
| `plusMinus` | smallint | no | '0'::smallint |
| `pim` | smallint | no | '0'::smallint |
| `hits` | smallint | no | '0'::smallint |
| `blockedShots` | smallint | no | '0'::smallint |
| `powerPlayGoals` | smallint | no | '0'::smallint |
| `powerPlayPoints` | smallint | no | '0'::smallint |
| `shorthandedGoals` | smallint | no | '0'::smallint |
| `shPoints` | smallint | no | '0'::smallint |
| `shots` | smallint | no | '0'::smallint |
| `faceoffs` | text | no | '0/0'::text |
| `faceoffWinningPctg` | real | no | '0'::real |
| `toi` | text | no | '00:00'::text |
| `powerPlayToi` | text | no | '00:00'::text |
| `shorthandedToi` | text | no | '00:00'::text |
| `created_at` | timestamp with time zone | no | now() |

## `public.sko_skater_stats`

Type: table

Primary key: `player_id`, `date`, `season_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | character varying | no |  |
| `date` | date | no |  |
| `season_id` | integer | no |  |
| `position_code` | character varying | yes |  |
| `games_played` | integer | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `points` | integer | yes |  |
| `shots` | integer | yes |  |
| `shooting_percentage` | double precision | yes |  |
| `time_on_ice` | integer | yes |  |
| `on_ice_shooting_pct` | double precision | yes |  |
| `zone_start_pct` | double precision | yes |  |
| `pp_toi_pct_per_game` | double precision | yes |  |
| `es_goals_for` | integer | yes |  |
| `pp_goals_for` | integer | yes |  |
| `sh_goals_for` | integer | yes |  |
| `total_primary_assists` | integer | yes |  |
| `total_secondary_assists` | integer | yes |  |
| `ipp` | double precision | yes |  |
| `sog_per_60` | double precision | yes |  |
| `assists_5v5` | integer | yes |  |
| `assists_per_60_5v5` | double precision | yes |  |
| `primary_assists_5v5` | integer | yes |  |
| `primary_assists_per_60_5v5` | double precision | yes |  |
| `secondary_assists_5v5` | integer | yes |  |
| `secondary_assists_per_60_5v5` | double precision | yes |  |

## `public.sko_skater_years`

Type: table

Primary key: `player_id`, `season`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | character varying | yes |  |
| `season` | integer | no |  |
| `position_code` | character varying | yes |  |
| `games_played` | integer | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `points` | integer | yes |  |
| `shots` | integer | yes |  |
| `shooting_percentage` | numeric | yes |  |
| `time_on_ice` | integer | yes |  |
| `on_ice_shooting_pct` | numeric | yes |  |
| `zone_start_pct` | numeric | yes |  |
| `pp_toi_pct_per_game` | numeric | yes |  |
| `es_goals_for` | integer | yes |  |
| `pp_goals_for` | integer | yes |  |
| `sh_goals_for` | integer | yes |  |
| `total_primary_assists` | integer | yes |  |
| `total_secondary_assists` | integer | yes |  |
| `ipp` | numeric | yes |  |
| `sog_per_60` | numeric | yes |  |

## `public.sustainability_player_priors`

Type: table

Primary key: `player_id`, `season_id`, `position_group`, `stat_code`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `season_id` | integer | no |  |
| `position_group` | text | no |  |
| `stat_code` | text | no |  |
| `successes_blend` | numeric | no |  |
| `trials_blend` | numeric | no |  |
| `post_alpha` | double precision | no |  |
| `post_beta` | double precision | no |  |
| `post_mean` | double precision | no |  |
| `post_var` | double precision | no |  |
| `n_effective` | numeric | no |  |
| `computed_at` | timestamp with time zone | no | now() |

## `public.view_active_player_ids_max_season`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `player_name` | text | yes |  |

## `public.wgo_skater_stats`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('wgo_skater_stats_id_seq'::regclass) |
| `player_id` | integer | no |  |
| `player_name` | text | no |  |
| `date` | date | no |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `games_played` | integer | yes |  |
| `points` | integer | yes |  |
| `points_per_game` | double precision | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `shots` | integer | yes |  |
| `shooting_percentage` | double precision | yes |  |
| `plus_minus` | integer | yes |  |
| `ot_goals` | integer | yes |  |
| `gw_goals` | integer | yes |  |
| `pp_points` | integer | yes |  |
| `fow_percentage` | double precision | yes |  |
| `toi_per_game` | double precision | yes |  |
| `blocked_shots` | integer | yes |  |
| `blocks_per_60` | double precision | yes |  |
| `empty_net_assists` | integer | yes |  |
| `empty_net_goals` | integer | yes |  |
| `empty_net_points` | integer | yes |  |
| `first_goals` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `hits` | integer | yes |  |
| `hits_per_60` | double precision | yes |  |
| `missed_shot_crossbar` | integer | yes |  |
| `missed_shot_goal_post` | integer | yes |  |
| `missed_shot_over_net` | integer | yes |  |
| `missed_shot_short_side` | integer | yes |  |
| `missed_shot_wide_of_net` | integer | yes |  |
| `missed_shots` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `d_zone_fo_percentage` | double precision | yes |  |
| `d_zone_faceoffs` | integer | yes |  |
| `ev_faceoff_percentage` | double precision | yes |  |
| `ev_faceoffs` | integer | yes |  |
| `n_zone_fo_percentage` | double precision | yes |  |
| `n_zone_faceoffs` | integer | yes |  |
| `o_zone_fo_percentage` | double precision | yes |  |
| `o_zone_faceoffs` | integer | yes |  |
| `pp_faceoff_percentage` | double precision | yes |  |
| `pp_faceoffs` | integer | yes |  |
| `sh_faceoff_percentage` | double precision | yes |  |
| `sh_faceoffs` | integer | yes |  |
| `total_faceoffs` | integer | yes |  |
| `d_zone_fol` | integer | yes |  |
| `d_zone_fow` | integer | yes |  |
| `ev_fol` | integer | yes |  |
| `ev_fow` | integer | yes |  |
| `n_zone_fol` | integer | yes |  |
| `n_zone_fow` | integer | yes |  |
| `o_zone_fol` | integer | yes |  |
| `o_zone_fow` | integer | yes |  |
| `pp_fol` | integer | yes |  |
| `pp_fow` | integer | yes |  |
| `sh_fol` | integer | yes |  |
| `sh_fow` | integer | yes |  |
| `total_fol` | integer | yes |  |
| `total_fow` | integer | yes |  |
| `es_goal_diff` | integer | yes |  |
| `es_goals_against` | integer | yes |  |
| `es_goals_for` | integer | yes |  |
| `es_goals_for_percentage` | double precision | yes |  |
| `es_toi_per_game` | double precision | yes |  |
| `pp_goals_against` | integer | yes |  |
| `pp_goals_for` | integer | yes |  |
| `pp_toi_per_game` | double precision | yes |  |
| `sh_goals_against` | integer | yes |  |
| `sh_goals_for` | integer | yes |  |
| `sh_toi_per_game` | double precision | yes |  |
| `game_misconduct_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `match_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `net_penalties` | integer | yes |  |
| `net_penalties_per_60` | double precision | yes |  |
| `penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `penalties_taken_per_60` | double precision | yes |  |
| `penalty_minutes` | integer | yes |  |
| `penalty_minutes_per_toi` | double precision | yes |  |
| `penalty_seconds_per_game` | double precision | yes |  |
| `pp_goals_against_per_60` | double precision | yes |  |
| `sh_assists` | integer | yes |  |
| `sh_goals` | integer | yes |  |
| `sh_points` | integer | yes |  |
| `sh_goals_per_60` | double precision | yes |  |
| `sh_individual_sat_for` | integer | yes |  |
| `sh_individual_sat_per_60` | double precision | yes |  |
| `sh_points_per_60` | double precision | yes |  |
| `sh_primary_assists` | integer | yes |  |
| `sh_primary_assists_per_60` | double precision | yes |  |
| `sh_secondary_assists` | integer | yes |  |
| `sh_secondary_assists_per_60` | double precision | yes |  |
| `sh_shooting_percentage` | double precision | yes |  |
| `sh_shots` | integer | yes |  |
| `sh_shots_per_60` | double precision | yes |  |
| `sh_time_on_ice` | integer | yes |  |
| `sh_time_on_ice_pct_per_game` | double precision | yes |  |
| `pp_assists` | integer | yes |  |
| `pp_goals` | integer | yes |  |
| `pp_goals_for_per_60` | double precision | yes |  |
| `pp_goals_per_60` | double precision | yes |  |
| `pp_individual_sat_for` | integer | yes |  |
| `pp_individual_sat_per_60` | double precision | yes |  |
| `pp_points_per_60` | double precision | yes |  |
| `pp_primary_assists` | integer | yes |  |
| `pp_primary_assists_per_60` | double precision | yes |  |
| `pp_secondary_assists` | integer | yes |  |
| `pp_secondary_assists_per_60` | double precision | yes |  |
| `pp_shooting_percentage` | double precision | yes |  |
| `pp_shots` | integer | yes |  |
| `pp_shots_per_60` | double precision | yes |  |
| `pp_toi` | integer | yes |  |
| `pp_toi_pct_per_game` | double precision | yes |  |
| `goals_pct` | double precision | yes |  |
| `faceoff_pct_5v5` | double precision | yes |  |
| `individual_sat_for_per_60` | double precision | yes |  |
| `individual_shots_for_per_60` | double precision | yes |  |
| `on_ice_shooting_pct` | double precision | yes |  |
| `sat_pct` | double precision | yes |  |
| `toi_per_game_5v5` | double precision | yes |  |
| `usat_pct` | double precision | yes |  |
| `zone_start_pct` | double precision | yes |  |
| `sat_against` | integer | yes |  |
| `sat_ahead` | integer | yes |  |
| `sat_behind` | integer | yes |  |
| `sat_close` | integer | yes |  |
| `sat_for` | integer | yes |  |
| `sat_tied` | integer | yes |  |
| `sat_total` | integer | yes |  |
| `usat_against` | integer | yes |  |
| `usat_ahead` | integer | yes |  |
| `usat_behind` | integer | yes |  |
| `usat_close` | integer | yes |  |
| `usat_for` | integer | yes |  |
| `usat_tied` | integer | yes |  |
| `usat_total` | integer | yes |  |
| `sat_percentage` | double precision | yes |  |
| `sat_percentage_ahead` | double precision | yes |  |
| `sat_percentage_behind` | double precision | yes |  |
| `sat_percentage_close` | double precision | yes |  |
| `sat_percentage_tied` | double precision | yes |  |
| `sat_relative` | double precision | yes |  |
| `shooting_percentage_5v5` | double precision | yes |  |
| `skater_save_pct_5v5` | double precision | yes |  |
| `skater_shooting_plus_save_pct_5v5` | double precision | yes |  |
| `usat_percentage` | double precision | yes |  |
| `usat_percentage_ahead` | double precision | yes |  |
| `usat_percentage_behind` | double precision | yes |  |
| `usat_percentage_close` | double precision | yes |  |
| `usat_percentage_tied` | double precision | yes |  |
| `usat_relative` | double precision | yes |  |
| `zone_start_pct_5v5` | double precision | yes |  |
| `assists_5v5` | integer | yes |  |
| `assists_per_60_5v5` | double precision | yes |  |
| `goals_5v5` | integer | yes |  |
| `goals_per_60_5v5` | double precision | yes |  |
| `net_minor_penalties_per_60` | double precision | yes |  |
| `o_zone_start_pct_5v5` | double precision | yes |  |
| `on_ice_shooting_pct_5v5` | double precision | yes |  |
| `points_5v5` | integer | yes |  |
| `points_per_60_5v5` | double precision | yes |  |
| `primary_assists_5v5` | integer | yes |  |
| `primary_assists_per_60_5v5` | double precision | yes |  |
| `sat_relative_5v5` | double precision | yes |  |
| `secondary_assists_5v5` | integer | yes |  |
| `secondary_assists_per_60_5v5` | double precision | yes |  |
| `assists_per_game` | double precision | yes |  |
| `blocks_per_game` | double precision | yes |  |
| `goals_per_game` | double precision | yes |  |
| `hits_per_game` | double precision | yes |  |
| `penalty_minutes_per_game` | double precision | yes |  |
| `primary_assists_per_game` | double precision | yes |  |
| `secondary_assists_per_game` | double precision | yes |  |
| `shots_per_game` | double precision | yes |  |
| `total_primary_assists` | integer | yes |  |
| `total_secondary_assists` | integer | yes |  |
| `goals_backhand` | integer | yes |  |
| `goals_bat` | integer | yes |  |
| `goals_between_legs` | integer | yes |  |
| `goals_cradle` | integer | yes |  |
| `goals_deflected` | integer | yes |  |
| `goals_poke` | integer | yes |  |
| `goals_slap` | integer | yes |  |
| `goals_snap` | integer | yes |  |
| `goals_tip_in` | integer | yes |  |
| `goals_wrap_around` | integer | yes |  |
| `goals_wrist` | integer | yes |  |
| `shooting_pct_backhand` | double precision | yes |  |
| `shooting_pct_bat` | double precision | yes |  |
| `shooting_pct_between_legs` | double precision | yes |  |
| `shooting_pct_cradle` | double precision | yes |  |
| `shooting_pct_deflected` | double precision | yes |  |
| `shooting_pct_poke` | double precision | yes |  |
| `shooting_pct_slap` | double precision | yes |  |
| `shooting_pct_snap` | double precision | yes |  |
| `shooting_pct_tip_in` | double precision | yes |  |
| `shooting_pct_wrap_around` | double precision | yes |  |
| `shooting_pct_wrist` | double precision | yes |  |
| `shots_on_net_backhand` | integer | yes |  |
| `shots_on_net_bat` | integer | yes |  |
| `shots_on_net_between_legs` | integer | yes |  |
| `shots_on_net_cradle` | integer | yes |  |
| `shots_on_net_deflected` | integer | yes |  |
| `shots_on_net_poke` | integer | yes |  |
| `shots_on_net_slap` | integer | yes |  |
| `shots_on_net_snap` | integer | yes |  |
| `shots_on_net_tip_in` | integer | yes |  |
| `shots_on_net_wrap_around` | integer | yes |  |
| `shots_on_net_wrist` | integer | yes |  |
| `ev_time_on_ice` | integer | yes |  |
| `ev_time_on_ice_per_game` | double precision | yes |  |
| `ot_time_on_ice` | integer | yes |  |
| `ot_time_on_ice_per_game` | double precision | yes |  |
| `shifts` | integer | yes |  |
| `shifts_per_game` | double precision | yes |  |
| `time_on_ice_per_shift` | double precision | yes |  |
| `birth_city` | text | yes |  |
| `birth_date` | text | yes |  |
| `current_team_abbreviation` | text | yes |  |
| `current_team_name` | text | yes |  |
| `draft_overall` | integer | yes |  |
| `draft_round` | integer | yes |  |
| `draft_year` | integer | yes |  |
| `first_season_for_game_type` | integer | yes |  |
| `nationality_code` | text | yes |  |
| `weight` | integer | yes |  |
| `height` | integer | yes |  |
| `birth_country` | text | yes |  |
| `season_id` | integer | yes |  |
| `game_id` | bigint | yes |  |
| `team_abbrev` | text | yes |  |
| `opponent_team_abbrev` | text | yes |  |
| `home_road` | character | yes |  |
| `ev_goals` | integer | yes |  |
| `ev_points` | integer | yes |  |

## `public.wgo_skater_stats_per_game`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `player_name` | text | yes |  |
| `season` | text | yes |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `games_played` | integer | yes |  |
| `current_team_abbreviation` | text | yes |  |
| `percent_games` | numeric | yes |  |
| `points` | numeric | yes |  |
| `goals` | numeric | yes |  |
| `assists` | numeric | yes |  |
| `shots` | numeric | yes |  |
| `ot_goals` | numeric | yes |  |
| `gw_goals` | numeric | yes |  |
| `pp_points` | numeric | yes |  |
| `blocked_shots` | numeric | yes |  |
| `empty_net_goals` | numeric | yes |  |
| `empty_net_points` | numeric | yes |  |
| `giveaways` | numeric | yes |  |
| `hits` | numeric | yes |  |
| `missed_shots` | numeric | yes |  |
| `takeaways` | numeric | yes |  |
| `d_zone_faceoffs` | numeric | yes |  |
| `ev_faceoffs` | numeric | yes |  |
| `n_zone_faceoffs` | numeric | yes |  |
| `o_zone_faceoffs` | numeric | yes |  |
| `pp_faceoffs` | numeric | yes |  |
| `sh_faceoffs` | numeric | yes |  |
| `total_faceoffs` | numeric | yes |  |
| `d_zone_fol` | numeric | yes |  |
| `d_zone_fow` | numeric | yes |  |
| `ev_fol` | numeric | yes |  |
| `ev_fow` | numeric | yes |  |
| `n_zone_fol` | numeric | yes |  |
| `n_zone_fow` | numeric | yes |  |
| `o_zone_fol` | numeric | yes |  |
| `o_zone_fow` | numeric | yes |  |
| `pp_fol` | numeric | yes |  |
| `pp_fow` | numeric | yes |  |
| `sh_fol` | numeric | yes |  |
| `sh_fow` | numeric | yes |  |
| `total_fol` | numeric | yes |  |
| `total_fow` | numeric | yes |  |
| `es_goals_against` | numeric | yes |  |
| `es_goals_for` | numeric | yes |  |
| `pp_goals_against` | numeric | yes |  |
| `pp_goals_for` | numeric | yes |  |
| `sh_goals_against` | numeric | yes |  |
| `sh_goals_for` | numeric | yes |  |
| `game_misconduct_penalties` | numeric | yes |  |
| `major_penalties` | numeric | yes |  |
| `match_penalties` | numeric | yes |  |
| `minor_penalties` | numeric | yes |  |
| `misconduct_penalties` | numeric | yes |  |
| `penalties` | numeric | yes |  |
| `penalties_drawn` | numeric | yes |  |
| `penalty_minutes` | numeric | yes |  |
| `sh_assists` | numeric | yes |  |
| `sh_goals` | numeric | yes |  |
| `sh_points` | numeric | yes |  |
| `sh_primary_assists` | numeric | yes |  |
| `sh_secondary_assists` | numeric | yes |  |
| `sh_individual_sat_for` | numeric | yes |  |
| `sh_shots` | numeric | yes |  |
| `pp_assists` | numeric | yes |  |
| `pp_goals` | numeric | yes |  |
| `pp_individual_sat_for` | numeric | yes |  |
| `pp_primary_assists` | numeric | yes |  |
| `pp_secondary_assists` | numeric | yes |  |
| `pp_shots` | numeric | yes |  |
| `sat_against` | numeric | yes |  |
| `sat_for` | numeric | yes |  |
| `sat_total` | numeric | yes |  |
| `usat_against` | numeric | yes |  |
| `usat_for` | numeric | yes |  |
| `usat_total` | numeric | yes |  |
| `assists_5v5` | numeric | yes |  |
| `goals_5v5` | numeric | yes |  |
| `points_5v5` | numeric | yes |  |
| `primary_assists_5v5` | numeric | yes |  |
| `secondary_assists_5v5` | numeric | yes |  |
| `total_primary_assists` | numeric | yes |  |
| `total_secondary_assists` | numeric | yes |  |
| `toi_per_game` | double precision | yes |  |
| `pp_toi_per_game` | double precision | yes |  |
| `pp_toi_pct_per_game` | double precision | yes |  |

## `public.wgo_skater_stats_playoffs`

Type: table

Primary key: `player_id`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `date` | date | no |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `games_played` | integer | yes |  |
| `points` | integer | yes |  |
| `points_per_game` | double precision | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `shots` | integer | yes |  |
| `shooting_percentage` | double precision | yes |  |
| `plus_minus` | integer | yes |  |
| `ot_goals` | integer | yes |  |
| `gw_goals` | integer | yes |  |
| `pp_points` | integer | yes |  |
| `fow_percentage` | double precision | yes |  |
| `toi_per_game` | double precision | yes |  |
| `birth_date` | text | yes |  |
| `current_team_abbreviation` | text | yes |  |
| `current_team_name` | text | yes |  |
| `birth_city` | text | yes |  |
| `birth_country` | text | yes |  |
| `height` | integer | yes |  |
| `weight` | integer | yes |  |
| `draft_year` | integer | yes |  |
| `draft_round` | integer | yes |  |
| `draft_overall` | integer | yes |  |
| `first_season_for_game_type` | integer | yes |  |
| `nationality_code` | text | yes |  |
| `blocked_shots` | integer | yes |  |
| `blocks_per_60` | double precision | yes |  |
| `empty_net_goals` | integer | yes |  |
| `empty_net_points` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `hits` | integer | yes |  |
| `hits_per_60` | double precision | yes |  |
| `missed_shots` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `d_zone_fo_percentage` | numeric | yes |  |
| `d_zone_faceoffs` | integer | yes |  |
| `ev_faceoff_percentage` | numeric | yes |  |
| `ev_faceoffs` | integer | yes |  |
| `n_zone_fo_percentage` | numeric | yes |  |
| `n_zone_faceoffs` | integer | yes |  |
| `o_zone_fo_percentage` | numeric | yes |  |
| `o_zone_faceoffs` | integer | yes |  |
| `pp_faceoff_percentage` | numeric | yes |  |
| `pp_faceoffs` | integer | yes |  |
| `sh_faceoff_percentage` | numeric | yes |  |
| `sh_faceoffs` | integer | yes |  |
| `total_faceoffs` | integer | yes |  |
| `d_zone_fol` | integer | yes |  |
| `d_zone_fow` | integer | yes |  |
| `ev_fol` | integer | yes |  |
| `ev_fow` | integer | yes |  |
| `n_zone_fol` | integer | yes |  |
| `n_zone_fow` | integer | yes |  |
| `o_zone_fol` | integer | yes |  |
| `o_zone_fow` | integer | yes |  |
| `pp_fol` | integer | yes |  |
| `pp_fow` | integer | yes |  |
| `sh_fol` | integer | yes |  |
| `sh_fow` | integer | yes |  |
| `total_fol` | integer | yes |  |
| `total_fow` | integer | yes |  |
| `es_goals_against` | integer | yes |  |
| `es_goals_for` | integer | yes |  |
| `es_goals_for_percentage` | numeric | yes |  |
| `es_toi_per_game` | text | yes |  |
| `pp_goals_against` | integer | yes |  |
| `pp_goals_for` | integer | yes |  |
| `pp_toi_per_game` | text | yes |  |
| `sh_goals_against` | integer | yes |  |
| `sh_goals_for` | integer | yes |  |
| `sh_toi_per_game` | text | yes |  |
| `game_misconduct_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `match_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `penalties_drawn_per_60` | numeric | yes |  |
| `penalties_taken_per_60` | numeric | yes |  |
| `penalty_minutes` | integer | yes |  |
| `penalty_seconds_per_game` | numeric | yes |  |
| `pp_goals_against_per_60` | numeric | yes |  |
| `sh_assists` | integer | yes |  |
| `sh_goals` | integer | yes |  |
| `sh_points` | integer | yes |  |
| `sh_goals_per_60` | numeric | yes |  |
| `sh_individual_sat_for` | integer | yes |  |
| `sh_individual_sat_per_60` | numeric | yes |  |
| `sh_points_per_60` | numeric | yes |  |
| `sh_primary_assists` | integer | yes |  |
| `sh_primary_assists_per_60` | numeric | yes |  |
| `sh_secondary_assists` | integer | yes |  |
| `sh_secondary_assists_per_60` | numeric | yes |  |
| `sh_shooting_percentage` | numeric | yes |  |
| `sh_shots` | integer | yes |  |
| `sh_shots_per_60` | numeric | yes |  |
| `sh_time_on_ice` | text | yes |  |
| `sh_time_on_ice_pct_per_game` | numeric | yes |  |
| `pp_assists` | integer | yes |  |
| `pp_goals` | integer | yes |  |
| `pp_goals_for_per_60` | numeric | yes |  |
| `pp_goals_per_60` | numeric | yes |  |
| `pp_individual_sat_for` | integer | yes |  |
| `pp_individual_sat_per_60` | numeric | yes |  |
| `pp_points_per_60` | numeric | yes |  |
| `pp_primary_assists` | integer | yes |  |
| `pp_primary_assists_per_60` | numeric | yes |  |
| `pp_secondary_assists` | integer | yes |  |
| `pp_secondary_assists_per_60` | numeric | yes |  |
| `pp_shooting_percentage` | numeric | yes |  |
| `pp_shots` | integer | yes |  |
| `pp_shots_per_60` | numeric | yes |  |
| `pp_toi` | text | yes |  |
| `pp_toi_pct_per_game` | numeric | yes |  |
| `goals_pct` | numeric | yes |  |
| `faceoff_pct_5v5` | numeric | yes |  |
| `individual_sat_for_per_60` | numeric | yes |  |
| `individual_shots_for_per_60` | numeric | yes |  |
| `on_ice_shooting_pct` | numeric | yes |  |
| `sat_pct` | numeric | yes |  |
| `toi_per_game_5v5` | text | yes |  |
| `usat_pct` | numeric | yes |  |
| `zone_start_pct` | numeric | yes |  |
| `sat_against` | integer | yes |  |
| `sat_ahead` | integer | yes |  |
| `sat_behind` | integer | yes |  |
| `sat_close` | integer | yes |  |
| `sat_for` | integer | yes |  |
| `sat_tied` | integer | yes |  |
| `sat_total` | integer | yes |  |
| `usat_against` | integer | yes |  |
| `usat_ahead` | integer | yes |  |
| `usat_behind` | integer | yes |  |
| `usat_close` | integer | yes |  |
| `usat_for` | integer | yes |  |
| `usat_tied` | integer | yes |  |
| `usat_total` | integer | yes |  |
| `sat_percentage` | numeric | yes |  |
| `sat_percentage_ahead` | numeric | yes |  |
| `sat_percentage_behind` | numeric | yes |  |
| `sat_percentage_close` | numeric | yes |  |
| `sat_percentage_tied` | numeric | yes |  |
| `sat_relative` | numeric | yes |  |
| `shooting_percentage_5v5` | numeric | yes |  |
| `skater_save_pct_5v5` | numeric | yes |  |
| `skater_shooting_plus_save_pct_5v5` | numeric | yes |  |
| `usat_percentage` | numeric | yes |  |
| `usat_percentage_ahead` | numeric | yes |  |
| `usat_percentage_behind` | numeric | yes |  |
| `usat_percentage_close` | numeric | yes |  |
| `usat_percentage_tied` | numeric | yes |  |
| `usat_relative` | numeric | yes |  |
| `zone_start_pct_5v5` | numeric | yes |  |
| `assists_5v5` | integer | yes |  |
| `assists_per_60_5v5` | numeric | yes |  |
| `goals_5v5` | integer | yes |  |
| `goals_per_60_5v5` | numeric | yes |  |
| `o_zone_start_pct_5v5` | numeric | yes |  |
| `on_ice_shooting_pct_5v5` | numeric | yes |  |
| `points_5v5` | integer | yes |  |
| `points_per_60_5v5` | numeric | yes |  |
| `primary_assists_5v5` | integer | yes |  |
| `primary_assists_per_60_5v5` | numeric | yes |  |
| `sat_relative_5v5` | numeric | yes |  |
| `secondary_assists_5v5` | integer | yes |  |
| `secondary_assists_per_60_5v5` | numeric | yes |  |
| `total_primary_assists` | integer | yes |  |
| `total_secondary_assists` | integer | yes |  |
| `goals_backhand` | integer | yes |  |
| `goals_bat` | integer | yes |  |
| `goals_between_legs` | integer | yes |  |
| `goals_cradle` | integer | yes |  |
| `goals_deflected` | integer | yes |  |
| `goals_poke` | integer | yes |  |
| `goals_slap` | integer | yes |  |
| `goals_snap` | integer | yes |  |
| `goals_tip_in` | integer | yes |  |
| `goals_wrap_around` | integer | yes |  |
| `goals_wrist` | integer | yes |  |
| `shots_on_net_backhand` | integer | yes |  |
| `shots_on_net_bat` | integer | yes |  |
| `shots_on_net_between_legs` | integer | yes |  |
| `shots_on_net_cradle` | integer | yes |  |
| `shots_on_net_deflected` | integer | yes |  |
| `shots_on_net_poke` | integer | yes |  |
| `shots_on_net_slap` | integer | yes |  |
| `shots_on_net_snap` | integer | yes |  |
| `shots_on_net_tip_in` | integer | yes |  |
| `shots_on_net_wrap_around` | integer | yes |  |
| `shots_on_net_wrist` | integer | yes |  |
| `ev_time_on_ice` | text | yes |  |
| `ev_time_on_ice_per_game` | text | yes |  |
| `ot_time_on_ice` | text | yes |  |
| `ot_time_on_ice_per_game` | text | yes |  |
| `shifts` | integer | yes |  |
| `shifts_per_game` | numeric | yes |  |
| `time_on_ice_per_shift` | text | yes |  |
| `updated_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |
| `empty_net_assists` | integer | yes |  |
| `first_goals` | integer | yes |  |
| `missed_shot_crossbar` | integer | yes |  |
| `missed_shot_goal_post` | integer | yes |  |
| `missed_shot_over_net` | integer | yes |  |
| `missed_shot_short_side` | integer | yes |  |
| `missed_shot_wide_of_net` | integer | yes |  |
| `net_penalties` | integer | yes |  |
| `net_penalties_per_60` | double precision | yes |  |
| `penalty_minutes_per_toi` | double precision | yes |  |
| `es_goal_diff` | integer | yes |  |
| `assists_per_game` | double precision | yes |  |
| `blocks_per_game` | double precision | yes |  |
| `goals_per_game` | double precision | yes |  |
| `hits_per_game` | double precision | yes |  |
| `penalty_minutes_per_game` | double precision | yes |  |
| `primary_assists_per_game` | double precision | yes |  |
| `secondary_assists_per_game` | double precision | yes |  |
| `shots_per_game` | double precision | yes |  |
| `shooting_pct_backhand` | double precision | yes |  |
| `shooting_pct_bat` | double precision | yes |  |
| `shooting_pct_between_legs` | double precision | yes |  |
| `shooting_pct_cradle` | double precision | yes |  |
| `shooting_pct_deflected` | double precision | yes |  |
| `shooting_pct_poke` | double precision | yes |  |
| `shooting_pct_slap` | double precision | yes |  |
| `shooting_pct_snap` | double precision | yes |  |
| `shooting_pct_tip_in` | double precision | yes |  |
| `shooting_pct_wrap_around` | double precision | yes |  |
| `shooting_pct_wrist` | double precision | yes |  |
| `net_minor_penalties_per_60` | double precision | yes |  |
| `season_id` | integer | yes |  |
| `ev_goals` | integer | yes |  |
| `ev_points` | integer | yes |  |
| `game_id` | integer | yes |  |
| `home_road` | text | yes |  |
| `opponent_team_abbrev` | text | yes |  |
| `team_abbrev` | text | yes |  |

## `public.wgo_skater_stats_totals`

Type: table

Primary key: `player_id`, `season`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `season` | text | no |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `games_played` | integer | yes |  |
| `points` | integer | yes |  |
| `points_per_game` | double precision | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `shots` | integer | yes |  |
| `shooting_percentage` | double precision | yes |  |
| `plus_minus` | integer | yes |  |
| `ot_goals` | integer | yes |  |
| `gw_goals` | integer | yes |  |
| `pp_points` | integer | yes |  |
| `fow_percentage` | double precision | yes |  |
| `toi_per_game` | double precision | yes |  |
| `blocked_shots` | integer | yes |  |
| `blocks_per_60` | double precision | yes |  |
| `empty_net_goals` | integer | yes |  |
| `empty_net_points` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `hits` | integer | yes |  |
| `hits_per_60` | double precision | yes |  |
| `missed_shots` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `d_zone_fo_percentage` | double precision | yes |  |
| `d_zone_faceoffs` | integer | yes |  |
| `ev_faceoff_percentage` | double precision | yes |  |
| `ev_faceoffs` | integer | yes |  |
| `n_zone_fo_percentage` | double precision | yes |  |
| `n_zone_faceoffs` | integer | yes |  |
| `o_zone_fo_percentage` | double precision | yes |  |
| `o_zone_faceoffs` | integer | yes |  |
| `pp_faceoff_percentage` | double precision | yes |  |
| `pp_faceoffs` | integer | yes |  |
| `sh_faceoff_percentage` | double precision | yes |  |
| `sh_faceoffs` | integer | yes |  |
| `total_faceoffs` | integer | yes |  |
| `d_zone_fol` | integer | yes |  |
| `d_zone_fow` | integer | yes |  |
| `ev_fol` | integer | yes |  |
| `ev_fow` | integer | yes |  |
| `n_zone_fol` | integer | yes |  |
| `n_zone_fow` | integer | yes |  |
| `o_zone_fol` | integer | yes |  |
| `o_zone_fow` | integer | yes |  |
| `pp_fol` | integer | yes |  |
| `pp_fow` | integer | yes |  |
| `sh_fol` | integer | yes |  |
| `sh_fow` | integer | yes |  |
| `total_fol` | integer | yes |  |
| `total_fow` | integer | yes |  |
| `es_goals_against` | integer | yes |  |
| `es_goals_for` | integer | yes |  |
| `es_goals_for_percentage` | double precision | yes |  |
| `es_toi_per_game` | double precision | yes |  |
| `pp_goals_against` | integer | yes |  |
| `pp_goals_for` | integer | yes |  |
| `pp_toi_per_game` | double precision | yes |  |
| `sh_goals_against` | integer | yes |  |
| `sh_goals_for` | integer | yes |  |
| `sh_toi_per_game` | double precision | yes |  |
| `game_misconduct_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `match_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `penalties_taken_per_60` | double precision | yes |  |
| `penalty_minutes` | integer | yes |  |
| `penalty_minutes_per_toi` | double precision | yes |  |
| `penalty_seconds_per_game` | double precision | yes |  |
| `pp_goals_against_per_60` | double precision | yes |  |
| `sh_assists` | integer | yes |  |
| `sh_goals` | integer | yes |  |
| `sh_points` | integer | yes |  |
| `sh_goals_per_60` | double precision | yes |  |
| `sh_individual_sat_for` | integer | yes |  |
| `sh_individual_sat_per_60` | double precision | yes |  |
| `sh_points_per_60` | double precision | yes |  |
| `sh_primary_assists` | integer | yes |  |
| `sh_primary_assists_per_60` | double precision | yes |  |
| `sh_secondary_assists` | integer | yes |  |
| `sh_secondary_assists_per_60` | double precision | yes |  |
| `sh_shooting_percentage` | double precision | yes |  |
| `sh_shots` | integer | yes |  |
| `sh_shots_per_60` | double precision | yes |  |
| `sh_time_on_ice` | integer | yes |  |
| `sh_time_on_ice_pct_per_game` | double precision | yes |  |
| `pp_assists` | integer | yes |  |
| `pp_goals` | integer | yes |  |
| `pp_goals_for_per_60` | double precision | yes |  |
| `pp_goals_per_60` | double precision | yes |  |
| `pp_individual_sat_for` | integer | yes |  |
| `pp_individual_sat_per_60` | double precision | yes |  |
| `pp_points_per_60` | double precision | yes |  |
| `pp_primary_assists` | integer | yes |  |
| `pp_primary_assists_per_60` | double precision | yes |  |
| `pp_secondary_assists` | integer | yes |  |
| `pp_secondary_assists_per_60` | double precision | yes |  |
| `pp_shooting_percentage` | double precision | yes |  |
| `pp_shots` | integer | yes |  |
| `pp_shots_per_60` | double precision | yes |  |
| `pp_toi` | integer | yes |  |
| `pp_toi_pct_per_game` | double precision | yes |  |
| `goals_pct` | double precision | yes |  |
| `faceoff_pct_5v5` | double precision | yes |  |
| `individual_sat_for_per_60` | double precision | yes |  |
| `individual_shots_for_per_60` | double precision | yes |  |
| `on_ice_shooting_pct` | double precision | yes |  |
| `sat_pct` | double precision | yes |  |
| `toi_per_game_5v5` | double precision | yes |  |
| `usat_pct` | double precision | yes |  |
| `zone_start_pct` | double precision | yes |  |
| `sat_against` | integer | yes |  |
| `sat_ahead` | integer | yes |  |
| `sat_behind` | integer | yes |  |
| `sat_close` | integer | yes |  |
| `sat_for` | integer | yes |  |
| `sat_tied` | integer | yes |  |
| `sat_total` | integer | yes |  |
| `usat_against` | integer | yes |  |
| `usat_ahead` | integer | yes |  |
| `usat_behind` | integer | yes |  |
| `usat_close` | integer | yes |  |
| `usat_for` | integer | yes |  |
| `usat_tied` | integer | yes |  |
| `usat_total` | integer | yes |  |
| `sat_percentage` | double precision | yes |  |
| `sat_percentage_ahead` | double precision | yes |  |
| `sat_percentage_behind` | double precision | yes |  |
| `sat_percentage_close` | double precision | yes |  |
| `sat_percentage_tied` | double precision | yes |  |
| `sat_relative` | double precision | yes |  |
| `shooting_percentage_5v5` | double precision | yes |  |
| `skater_save_pct_5v5` | double precision | yes |  |
| `skater_shooting_plus_save_pct_5v5` | double precision | yes |  |
| `usat_percentage` | double precision | yes |  |
| `usat_percentage_ahead` | double precision | yes |  |
| `usat_percentage_behind` | double precision | yes |  |
| `usat_percentage_close` | double precision | yes |  |
| `usat_percentage_tied` | double precision | yes |  |
| `usat_relative` | double precision | yes |  |
| `zone_start_pct_5v5` | double precision | yes |  |
| `assists_5v5` | integer | yes |  |
| `assists_per_60_5v5` | double precision | yes |  |
| `goals_5v5` | integer | yes |  |
| `goals_per_60_5v5` | double precision | yes |  |
| `o_zone_start_pct_5v5` | double precision | yes |  |
| `on_ice_shooting_pct_5v5` | double precision | yes |  |
| `points_5v5` | integer | yes |  |
| `points_per_60_5v5` | double precision | yes |  |
| `primary_assists_5v5` | integer | yes |  |
| `primary_assists_per_60_5v5` | double precision | yes |  |
| `sat_relative_5v5` | double precision | yes |  |
| `secondary_assists_5v5` | integer | yes |  |
| `secondary_assists_per_60_5v5` | double precision | yes |  |
| `total_primary_assists` | integer | yes |  |
| `total_secondary_assists` | integer | yes |  |
| `goals_backhand` | integer | yes |  |
| `goals_bat` | integer | yes |  |
| `goals_between_legs` | integer | yes |  |
| `goals_cradle` | integer | yes |  |
| `goals_deflected` | integer | yes |  |
| `goals_poke` | integer | yes |  |
| `goals_slap` | integer | yes |  |
| `goals_snap` | integer | yes |  |
| `goals_tip_in` | integer | yes |  |
| `goals_wrap_around` | integer | yes |  |
| `goals_wrist` | integer | yes |  |
| `shots_on_net_backhand` | integer | yes |  |
| `shots_on_net_bat` | integer | yes |  |
| `shots_on_net_between_legs` | integer | yes |  |
| `shots_on_net_cradle` | integer | yes |  |
| `shots_on_net_deflected` | integer | yes |  |
| `shots_on_net_poke` | integer | yes |  |
| `shots_on_net_slap` | integer | yes |  |
| `shots_on_net_snap` | integer | yes |  |
| `shots_on_net_tip_in` | integer | yes |  |
| `shots_on_net_wrap_around` | integer | yes |  |
| `shots_on_net_wrist` | integer | yes |  |
| `ev_time_on_ice` | integer | yes |  |
| `ev_time_on_ice_per_game` | double precision | yes |  |
| `ot_time_on_ice` | integer | yes |  |
| `ot_time_on_ice_per_game` | double precision | yes |  |
| `shifts` | integer | yes |  |
| `shifts_per_game` | double precision | yes |  |
| `time_on_ice_per_shift` | double precision | yes |  |
| `birth_city` | text | yes |  |
| `birth_date` | text | yes |  |
| `current_team_abbreviation` | text | yes |  |
| `current_team_name` | text | yes |  |
| `draft_overall` | integer | yes |  |
| `draft_round` | integer | yes |  |
| `draft_year` | integer | yes |  |
| `first_season_for_game_type` | integer | yes |  |
| `nationality_code` | text | yes |  |
| `weight` | integer | yes |  |
| `height` | integer | yes |  |
| `birth_country` | text | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

## `public.wgo_skater_stats_totals_ly`

Type: table

Primary key: `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `season` | text | yes |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `games_played` | integer | yes |  |
| `points` | integer | yes |  |
| `points_per_game` | double precision | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `shots` | integer | yes |  |
| `shooting_percentage` | double precision | yes |  |
| `plus_minus` | integer | yes |  |
| `ot_goals` | integer | yes |  |
| `gw_goals` | integer | yes |  |
| `pp_points` | integer | yes |  |
| `fow_percentage` | double precision | yes |  |
| `toi_per_game` | double precision | yes |  |
| `blocked_shots` | integer | yes |  |
| `blocks_per_60` | double precision | yes |  |
| `empty_net_goals` | integer | yes |  |
| `empty_net_points` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `hits` | integer | yes |  |
| `hits_per_60` | double precision | yes |  |
| `missed_shots` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `d_zone_fo_percentage` | double precision | yes |  |
| `d_zone_faceoffs` | integer | yes |  |
| `ev_faceoff_percentage` | double precision | yes |  |
| `ev_faceoffs` | integer | yes |  |
| `n_zone_fo_percentage` | double precision | yes |  |
| `n_zone_faceoffs` | integer | yes |  |
| `o_zone_fo_percentage` | double precision | yes |  |
| `o_zone_faceoffs` | integer | yes |  |
| `pp_faceoff_percentage` | double precision | yes |  |
| `pp_faceoffs` | integer | yes |  |
| `sh_faceoff_percentage` | double precision | yes |  |
| `sh_faceoffs` | integer | yes |  |
| `total_faceoffs` | integer | yes |  |
| `d_zone_fol` | integer | yes |  |
| `d_zone_fow` | integer | yes |  |
| `ev_fol` | integer | yes |  |
| `ev_fow` | integer | yes |  |
| `n_zone_fol` | integer | yes |  |
| `n_zone_fow` | integer | yes |  |
| `o_zone_fol` | integer | yes |  |
| `o_zone_fow` | integer | yes |  |
| `pp_fol` | integer | yes |  |
| `pp_fow` | integer | yes |  |
| `sh_fol` | integer | yes |  |
| `sh_fow` | integer | yes |  |
| `total_fol` | integer | yes |  |
| `total_fow` | integer | yes |  |
| `es_goals_against` | integer | yes |  |
| `es_goals_for` | integer | yes |  |
| `es_goals_for_percentage` | double precision | yes |  |
| `es_toi_per_game` | double precision | yes |  |
| `pp_goals_against` | integer | yes |  |
| `pp_goals_for` | integer | yes |  |
| `pp_toi_per_game` | double precision | yes |  |
| `sh_goals_against` | integer | yes |  |
| `sh_goals_for` | integer | yes |  |
| `sh_toi_per_game` | double precision | yes |  |
| `game_misconduct_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `match_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `penalties_taken_per_60` | double precision | yes |  |
| `penalty_minutes` | integer | yes |  |
| `penalty_minutes_per_toi` | double precision | yes |  |
| `penalty_seconds_per_game` | double precision | yes |  |
| `pp_goals_against_per_60` | double precision | yes |  |
| `sh_assists` | integer | yes |  |
| `sh_goals` | integer | yes |  |
| `sh_points` | integer | yes |  |
| `sh_goals_per_60` | double precision | yes |  |
| `sh_individual_sat_for` | integer | yes |  |
| `sh_individual_sat_per_60` | double precision | yes |  |
| `sh_points_per_60` | double precision | yes |  |
| `sh_primary_assists` | integer | yes |  |
| `sh_primary_assists_per_60` | double precision | yes |  |
| `sh_secondary_assists` | integer | yes |  |
| `sh_secondary_assists_per_60` | double precision | yes |  |
| `sh_shooting_percentage` | double precision | yes |  |
| `sh_shots` | integer | yes |  |
| `sh_shots_per_60` | double precision | yes |  |
| `sh_time_on_ice` | integer | yes |  |
| `sh_time_on_ice_pct_per_game` | double precision | yes |  |
| `pp_assists` | integer | yes |  |
| `pp_goals` | integer | yes |  |
| `pp_goals_for_per_60` | double precision | yes |  |
| `pp_goals_per_60` | double precision | yes |  |
| `pp_individual_sat_for` | integer | yes |  |
| `pp_individual_sat_per_60` | double precision | yes |  |
| `pp_points_per_60` | double precision | yes |  |
| `pp_primary_assists` | integer | yes |  |
| `pp_primary_assists_per_60` | double precision | yes |  |
| `pp_secondary_assists` | integer | yes |  |
| `pp_secondary_assists_per_60` | double precision | yes |  |
| `pp_shooting_percentage` | double precision | yes |  |
| `pp_shots` | integer | yes |  |
| `pp_shots_per_60` | double precision | yes |  |
| `pp_toi` | integer | yes |  |
| `pp_toi_pct_per_game` | double precision | yes |  |
| `goals_pct` | double precision | yes |  |
| `faceoff_pct_5v5` | double precision | yes |  |
| `individual_sat_for_per_60` | double precision | yes |  |
| `individual_shots_for_per_60` | double precision | yes |  |
| `on_ice_shooting_pct` | double precision | yes |  |
| `sat_pct` | double precision | yes |  |
| `toi_per_game_5v5` | double precision | yes |  |
| `usat_pct` | double precision | yes |  |
| `zone_start_pct` | double precision | yes |  |
| `sat_against` | integer | yes |  |
| `sat_ahead` | integer | yes |  |
| `sat_behind` | integer | yes |  |
| `sat_close` | integer | yes |  |
| `sat_for` | integer | yes |  |
| `sat_tied` | integer | yes |  |
| `sat_total` | integer | yes |  |
| `usat_against` | integer | yes |  |
| `usat_ahead` | integer | yes |  |
| `usat_behind` | integer | yes |  |
| `usat_close` | integer | yes |  |
| `usat_for` | integer | yes |  |
| `usat_tied` | integer | yes |  |
| `usat_total` | integer | yes |  |
| `sat_percentage` | double precision | yes |  |
| `sat_percentage_ahead` | double precision | yes |  |
| `sat_percentage_behind` | double precision | yes |  |
| `sat_percentage_close` | double precision | yes |  |
| `sat_percentage_tied` | double precision | yes |  |
| `sat_relative` | double precision | yes |  |
| `shooting_percentage_5v5` | double precision | yes |  |
| `skater_save_pct_5v5` | double precision | yes |  |
| `skater_shooting_plus_save_pct_5v5` | double precision | yes |  |
| `usat_percentage` | double precision | yes |  |
| `usat_percentage_ahead` | double precision | yes |  |
| `usat_percentage_behind` | double precision | yes |  |
| `usat_percentage_close` | double precision | yes |  |
| `usat_percentage_tied` | double precision | yes |  |
| `usat_relative` | double precision | yes |  |
| `zone_start_pct_5v5` | double precision | yes |  |
| `assists_5v5` | integer | yes |  |
| `assists_per_60_5v5` | double precision | yes |  |
| `goals_5v5` | integer | yes |  |
| `goals_per_60_5v5` | double precision | yes |  |
| `o_zone_start_pct_5v5` | double precision | yes |  |
| `on_ice_shooting_pct_5v5` | double precision | yes |  |
| `points_5v5` | integer | yes |  |
| `points_per_60_5v5` | double precision | yes |  |
| `primary_assists_5v5` | integer | yes |  |
| `primary_assists_per_60_5v5` | double precision | yes |  |
| `sat_relative_5v5` | double precision | yes |  |
| `secondary_assists_5v5` | integer | yes |  |
| `secondary_assists_per_60_5v5` | double precision | yes |  |
| `total_primary_assists` | integer | yes |  |
| `total_secondary_assists` | integer | yes |  |
| `goals_backhand` | integer | yes |  |
| `goals_bat` | integer | yes |  |
| `goals_between_legs` | integer | yes |  |
| `goals_cradle` | integer | yes |  |
| `goals_deflected` | integer | yes |  |
| `goals_poke` | integer | yes |  |
| `goals_slap` | integer | yes |  |
| `goals_snap` | integer | yes |  |
| `goals_tip_in` | integer | yes |  |
| `goals_wrap_around` | integer | yes |  |
| `goals_wrist` | integer | yes |  |
| `shots_on_net_backhand` | integer | yes |  |
| `shots_on_net_bat` | integer | yes |  |
| `shots_on_net_between_legs` | integer | yes |  |
| `shots_on_net_cradle` | integer | yes |  |
| `shots_on_net_deflected` | integer | yes |  |
| `shots_on_net_poke` | integer | yes |  |
| `shots_on_net_slap` | integer | yes |  |
| `shots_on_net_snap` | integer | yes |  |
| `shots_on_net_tip_in` | integer | yes |  |
| `shots_on_net_wrap_around` | integer | yes |  |
| `shots_on_net_wrist` | integer | yes |  |
| `ev_time_on_ice` | integer | yes |  |
| `ev_time_on_ice_per_game` | double precision | yes |  |
| `ot_time_on_ice` | integer | yes |  |
| `ot_time_on_ice_per_game` | double precision | yes |  |
| `shifts` | integer | yes |  |
| `shifts_per_game` | double precision | yes |  |
| `time_on_ice_per_shift` | double precision | yes |  |
| `assists_per_game` | double precision | yes |  |
| `blocks_per_game` | double precision | yes |  |
| `goals_per_game` | double precision | yes |  |
| `hits_per_game` | double precision | yes |  |
| `penalty_minutes_per_game` | double precision | yes |  |
| `primary_assists_per_game` | double precision | yes |  |
| `secondary_assists_per_game` | double precision | yes |  |
| `shots_per_game` | double precision | yes |  |

## `public.wgo_skater_stats_totals_playoffs`

Type: table

Primary key: `player_id`, `season`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `season` | text | no |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `games_played` | integer | yes |  |
| `points` | integer | yes |  |
| `points_per_game` | double precision | yes |  |
| `goals` | integer | yes |  |
| `assists` | integer | yes |  |
| `shots` | integer | yes |  |
| `shooting_percentage` | double precision | yes |  |
| `plus_minus` | integer | yes |  |
| `ot_goals` | integer | yes |  |
| `gw_goals` | integer | yes |  |
| `pp_points` | integer | yes |  |
| `fow_percentage` | double precision | yes |  |
| `toi_per_game` | double precision | yes |  |
| `blocked_shots` | integer | yes |  |
| `blocks_per_60` | double precision | yes |  |
| `empty_net_goals` | integer | yes |  |
| `empty_net_points` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `hits` | integer | yes |  |
| `hits_per_60` | double precision | yes |  |
| `missed_shots` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `d_zone_fo_percentage` | double precision | yes |  |
| `d_zone_faceoffs` | integer | yes |  |
| `ev_faceoff_percentage` | double precision | yes |  |
| `ev_faceoffs` | integer | yes |  |
| `n_zone_fo_percentage` | double precision | yes |  |
| `n_zone_faceoffs` | integer | yes |  |
| `o_zone_fo_percentage` | double precision | yes |  |
| `o_zone_faceoffs` | integer | yes |  |
| `pp_faceoff_percentage` | double precision | yes |  |
| `pp_faceoffs` | integer | yes |  |
| `sh_faceoff_percentage` | double precision | yes |  |
| `sh_faceoffs` | integer | yes |  |
| `total_faceoffs` | integer | yes |  |
| `d_zone_fol` | integer | yes |  |
| `d_zone_fow` | integer | yes |  |
| `ev_fol` | integer | yes |  |
| `ev_fow` | integer | yes |  |
| `n_zone_fol` | integer | yes |  |
| `n_zone_fow` | integer | yes |  |
| `o_zone_fol` | integer | yes |  |
| `o_zone_fow` | integer | yes |  |
| `pp_fol` | integer | yes |  |
| `pp_fow` | integer | yes |  |
| `sh_fol` | integer | yes |  |
| `sh_fow` | integer | yes |  |
| `total_fol` | integer | yes |  |
| `total_fow` | integer | yes |  |
| `es_goals_against` | integer | yes |  |
| `es_goals_for` | integer | yes |  |
| `es_goals_for_percentage` | double precision | yes |  |
| `es_toi_per_game` | double precision | yes |  |
| `pp_goals_against` | integer | yes |  |
| `pp_goals_for` | integer | yes |  |
| `pp_toi_per_game` | double precision | yes |  |
| `sh_goals_against` | integer | yes |  |
| `sh_goals_for` | integer | yes |  |
| `sh_toi_per_game` | double precision | yes |  |
| `game_misconduct_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `match_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `penalties_taken_per_60` | double precision | yes |  |
| `penalty_minutes` | integer | yes |  |
| `penalty_minutes_per_toi` | double precision | yes |  |
| `penalty_seconds_per_game` | double precision | yes |  |
| `pp_goals_against_per_60` | double precision | yes |  |
| `sh_assists` | integer | yes |  |
| `sh_goals` | integer | yes |  |
| `sh_points` | integer | yes |  |
| `sh_goals_per_60` | double precision | yes |  |
| `sh_individual_sat_for` | integer | yes |  |
| `sh_individual_sat_per_60` | double precision | yes |  |
| `sh_points_per_60` | double precision | yes |  |
| `sh_primary_assists` | integer | yes |  |
| `sh_primary_assists_per_60` | double precision | yes |  |
| `sh_secondary_assists` | integer | yes |  |
| `sh_secondary_assists_per_60` | double precision | yes |  |
| `sh_shooting_percentage` | double precision | yes |  |
| `sh_shots` | integer | yes |  |
| `sh_shots_per_60` | double precision | yes |  |
| `sh_time_on_ice` | integer | yes |  |
| `sh_time_on_ice_pct_per_game` | double precision | yes |  |
| `pp_assists` | integer | yes |  |
| `pp_goals` | integer | yes |  |
| `pp_goals_for_per_60` | double precision | yes |  |
| `pp_goals_per_60` | double precision | yes |  |
| `pp_individual_sat_for` | integer | yes |  |
| `pp_individual_sat_per_60` | double precision | yes |  |
| `pp_points_per_60` | double precision | yes |  |
| `pp_primary_assists` | integer | yes |  |
| `pp_primary_assists_per_60` | double precision | yes |  |
| `pp_secondary_assists` | integer | yes |  |
| `pp_secondary_assists_per_60` | double precision | yes |  |
| `pp_shooting_percentage` | double precision | yes |  |
| `pp_shots` | integer | yes |  |
| `pp_shots_per_60` | double precision | yes |  |
| `pp_toi` | integer | yes |  |
| `pp_toi_pct_per_game` | double precision | yes |  |
| `goals_pct` | double precision | yes |  |
| `faceoff_pct_5v5` | double precision | yes |  |
| `individual_sat_for_per_60` | double precision | yes |  |
| `individual_shots_for_per_60` | double precision | yes |  |
| `on_ice_shooting_pct` | double precision | yes |  |
| `sat_pct` | double precision | yes |  |
| `toi_per_game_5v5` | double precision | yes |  |
| `usat_pct` | double precision | yes |  |
| `zone_start_pct` | double precision | yes |  |
| `sat_against` | integer | yes |  |
| `sat_ahead` | integer | yes |  |
| `sat_behind` | integer | yes |  |
| `sat_close` | integer | yes |  |
| `sat_for` | integer | yes |  |
| `sat_tied` | integer | yes |  |
| `sat_total` | integer | yes |  |
| `usat_against` | integer | yes |  |
| `usat_ahead` | integer | yes |  |
| `usat_behind` | integer | yes |  |
| `usat_close` | integer | yes |  |
| `usat_for` | integer | yes |  |
| `usat_tied` | integer | yes |  |
| `usat_total` | integer | yes |  |
| `sat_percentage` | double precision | yes |  |
| `sat_percentage_ahead` | double precision | yes |  |
| `sat_percentage_behind` | double precision | yes |  |
| `sat_percentage_close` | double precision | yes |  |
| `sat_percentage_tied` | double precision | yes |  |
| `sat_relative` | double precision | yes |  |
| `shooting_percentage_5v5` | double precision | yes |  |
| `skater_save_pct_5v5` | double precision | yes |  |
| `skater_shooting_plus_save_pct_5v5` | double precision | yes |  |
| `usat_percentage` | double precision | yes |  |
| `usat_percentage_ahead` | double precision | yes |  |
| `usat_percentage_behind` | double precision | yes |  |
| `usat_percentage_close` | double precision | yes |  |
| `usat_percentage_tied` | double precision | yes |  |
| `usat_relative` | double precision | yes |  |
| `zone_start_pct_5v5` | double precision | yes |  |
| `assists_5v5` | integer | yes |  |
| `assists_per_60_5v5` | double precision | yes |  |
| `goals_5v5` | integer | yes |  |
| `goals_per_60_5v5` | double precision | yes |  |
| `o_zone_start_pct_5v5` | double precision | yes |  |
| `on_ice_shooting_pct_5v5` | double precision | yes |  |
| `points_5v5` | integer | yes |  |
| `points_per_60_5v5` | double precision | yes |  |
| `primary_assists_5v5` | integer | yes |  |
| `primary_assists_per_60_5v5` | double precision | yes |  |
| `sat_relative_5v5` | double precision | yes |  |
| `secondary_assists_5v5` | integer | yes |  |
| `secondary_assists_per_60_5v5` | double precision | yes |  |
| `total_primary_assists` | integer | yes |  |
| `total_secondary_assists` | integer | yes |  |
| `goals_backhand` | integer | yes |  |
| `goals_bat` | integer | yes |  |
| `goals_between_legs` | integer | yes |  |
| `goals_cradle` | integer | yes |  |
| `goals_deflected` | integer | yes |  |
| `goals_poke` | integer | yes |  |
| `goals_slap` | integer | yes |  |
| `goals_snap` | integer | yes |  |
| `goals_tip_in` | integer | yes |  |
| `goals_wrap_around` | integer | yes |  |
| `goals_wrist` | integer | yes |  |
| `shots_on_net_backhand` | integer | yes |  |
| `shots_on_net_bat` | integer | yes |  |
| `shots_on_net_between_legs` | integer | yes |  |
| `shots_on_net_cradle` | integer | yes |  |
| `shots_on_net_deflected` | integer | yes |  |
| `shots_on_net_poke` | integer | yes |  |
| `shots_on_net_slap` | integer | yes |  |
| `shots_on_net_snap` | integer | yes |  |
| `shots_on_net_tip_in` | integer | yes |  |
| `shots_on_net_wrap_around` | integer | yes |  |
| `shots_on_net_wrist` | integer | yes |  |
| `ev_time_on_ice` | integer | yes |  |
| `ev_time_on_ice_per_game` | double precision | yes |  |
| `ot_time_on_ice` | integer | yes |  |
| `ot_time_on_ice_per_game` | double precision | yes |  |
| `shifts` | integer | yes |  |
| `shifts_per_game` | double precision | yes |  |
| `time_on_ice_per_shift` | double precision | yes |  |
| `birth_city` | text | yes |  |
| `birth_date` | text | yes |  |
| `current_team_abbreviation` | text | yes |  |
| `current_team_name` | text | yes |  |
| `draft_overall` | integer | yes |  |
| `draft_round` | integer | yes |  |
| `draft_year` | integer | yes |  |
| `first_season_for_game_type` | integer | yes |  |
| `nationality_code` | text | yes |  |
| `weight` | integer | yes |  |
| `height` | integer | yes |  |
| `birth_country` | text | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

## `public.xfs_predictions_10_game`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('xfs_predictions_10_game_id_seq'::regclass) |
| `player_id` | integer | no |  |
| `prediction_date` | date | no |  |
| `game_date` | date | no |  |
| `xfs_score` | numeric | no |  |
| `min_xfs` | numeric | no |  |
| `max_xfs` | numeric | no |  |
| `confidence_interval` | numeric | yes | 0.0 |
| `created_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |
| `player_name` | text | yes |  |

## `public.xfs_predictions_5_game`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('xfs_predictions_5_game_id_seq'::regclass) |
| `player_id` | integer | no |  |
| `prediction_date` | date | no |  |
| `game_date` | date | no |  |
| `xfs_score` | numeric | no |  |
| `min_xfs` | numeric | no |  |
| `max_xfs` | numeric | no |  |
| `confidence_interval` | numeric | yes | 0.0 |
| `created_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |
| `player_name` | text | yes |  |
