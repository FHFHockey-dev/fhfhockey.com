# Team Tables And Views

Generated from live Supabase `information_schema` on 2026-05-22.

Tables/views documented: 67.

## Index

- `analytics.vw_nhl_edge_latest_team_metrics` (view)
- `analytics.vw_team_ratings_daily` (view)
- `public.combined_sos` (view)
- `public.dim_team_map` (table)
- `public.external_teams` (table)
- `public.forge_team_game_strength` (table)
- `public.forge_team_projections` (table)
- `public.lineCombinations` (table)
- `public.line_combinations` (table)
- `public.lines_ccc` (table)
- `public.lines_ccc_ifttt_events` (table)
- `public.lines_dfo` (table)
- `public.lines_gdl` (table)
- `public.lines_nhl` (table)
- `public.nhl_edge_team_metrics_daily` (table)
- `public.nhl_standings_details` (table)
- `public.nhl_team_data` (view)
- `public.nst_5v5_team_differentials` (view)
- `public.nst_5v5_team_per_game` (view)
- `public.nst_all_team_differentials` (view)
- `public.nst_all_team_per_game` (view)
- `public.nst_pk_team_differentials` (view)
- `public.nst_pk_team_per_game` (view)
- `public.nst_pp_team_differentials` (view)
- `public.nst_pp_team_per_game` (view)
- `public.nst_team_5v5` (table)
- `public.nst_team_all` (table)
- `public.nst_team_gamelogs_as_counts` (table)
- `public.nst_team_gamelogs_as_rates` (table)
- `public.nst_team_gamelogs_es_counts` (table)
- `public.nst_team_gamelogs_es_rates` (table)
- `public.nst_team_gamelogs_pk_counts` (table)
- `public.nst_team_gamelogs_pk_rates` (table)
- `public.nst_team_gamelogs_pp_counts` (table)
- `public.nst_team_gamelogs_pp_rates` (table)
- `public.nst_team_pk` (table)
- `public.nst_team_pp` (table)
- `public.nst_team_scores_all_strengths` (view)
- `public.nst_team_stats` (table)
- `public.nst_team_stats_ly` (table)
- `public.powerPlayCombinations` (table)
- `public.raw_standings_sos` (table)
- `public.sos_games` (table)
- `public.sos_standings` (table)
- `public.standings` (table)
- `public.teamGameStats` (table)
- `public.team_abbrev_xwalk` (table)
- `public.team_ctpi_daily` (table)
- `public.team_discipline_stats` (table)
- `public.team_franchise_alias` (table)
- `public.team_games` (view)
- `public.team_power_ratings_daily` (table)
- `public.team_power_ratings_daily__new` (table)
- `public.team_season` (table)
- `public.team_summary_years` (table)
- `public.team_underlying_stats_summary` (table)
- `public.teams` (table)
- `public.teamsinfo` (table)
- `public.user_saved_teams` (table)
- `public.vw_active_teams` (view)
- `public.vw_pp_unit_share_recent` (view)
- `public.vw_team_abbrev_norm` (view)
- `public.vw_team_stats_nst_wgo` (view)
- `public.vw_team_strength_state_daily` (view)
- `public.vw_team_strength_state_daily_norm` (view)
- `public.wgo_team_stats` (table)
- `public.wgo_teams` (table)

## `analytics.vw_nhl_edge_latest_team_metrics`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | yes |  |
| `season_id` | bigint | yes |  |
| `game_type` | smallint | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `conference` | text | yes |  |
| `division` | text | yes |  |
| `games_played` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `points` | integer | yes |  |
| `shot_attempts_over_90` | integer | yes |  |
| `shot_attempts_over_90_rank` | integer | yes |  |
| `top_shot_speed_mph` | double precision | yes |  |
| `top_shot_speed_kph` | double precision | yes |  |
| `top_shot_speed_rank` | integer | yes |  |
| `top_shot_speed_league_avg_mph` | double precision | yes |  |
| `bursts_over_22` | integer | yes |  |
| `bursts_over_22_rank` | integer | yes |  |
| `bursts_over_20` | integer | yes |  |
| `bursts_over_20_rank` | integer | yes |  |
| `bursts_over_20_league_avg` | double precision | yes |  |
| `max_skating_speed_mph` | double precision | yes |  |
| `max_skating_speed_kph` | double precision | yes |  |
| `max_skating_speed_rank` | integer | yes |  |
| `max_skating_speed_league_avg_mph` | double precision | yes |  |
| `total_distance_miles` | double precision | yes |  |
| `total_distance_km` | double precision | yes |  |
| `total_distance_rank` | integer | yes |  |
| `total_distance_league_avg_miles` | double precision | yes |  |
| `all_shots` | integer | yes |  |
| `all_goals` | integer | yes |  |
| `all_shooting_pct` | double precision | yes |  |
| `all_shots_rank` | integer | yes |  |
| `all_goals_rank` | integer | yes |  |
| `all_shooting_pct_rank` | integer | yes |  |
| `high_danger_shots` | integer | yes |  |
| `high_danger_goals` | integer | yes |  |
| `high_danger_shooting_pct` | double precision | yes |  |
| `high_danger_shots_rank` | integer | yes |  |
| `high_danger_goals_rank` | integer | yes |  |
| `high_danger_shooting_pct_rank` | integer | yes |  |
| `mid_range_shots` | integer | yes |  |
| `mid_range_goals` | integer | yes |  |
| `mid_range_shooting_pct` | double precision | yes |  |
| `mid_range_shots_rank` | integer | yes |  |
| `mid_range_goals_rank` | integer | yes |  |
| `mid_range_shooting_pct_rank` | integer | yes |  |
| `long_range_shots` | integer | yes |  |
| `long_range_goals` | integer | yes |  |
| `long_range_shooting_pct` | double precision | yes |  |
| `long_range_shots_rank` | integer | yes |  |
| `long_range_goals_rank` | integer | yes |  |
| `long_range_shooting_pct_rank` | integer | yes |  |
| `offensive_zone_pct` | double precision | yes |  |
| `offensive_zone_rank` | integer | yes |  |
| `offensive_zone_league_avg` | double precision | yes |  |
| `offensive_zone_ev_pct` | double precision | yes |  |
| `offensive_zone_ev_rank` | integer | yes |  |
| `offensive_zone_ev_league_avg` | double precision | yes |  |
| `neutral_zone_pct` | double precision | yes |  |
| `neutral_zone_rank` | integer | yes |  |
| `neutral_zone_league_avg` | double precision | yes |  |
| `defensive_zone_pct` | double precision | yes |  |
| `defensive_zone_rank` | integer | yes |  |
| `defensive_zone_league_avg` | double precision | yes |  |
| `source_url` | text | yes |  |
| `raw_payload` | jsonb | yes |  |
| `metadata` | jsonb | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

## `analytics.vw_team_ratings_daily`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_id` | smallint | yes |  |
| `team_abbreviation` | text | yes |  |
| `snapshot_date` | date | yes |  |
| `season_id` | integer | yes |  |
| `offense_rating` | numeric | yes |  |
| `defense_rating` | numeric | yes |  |
| `goalie_rating` | numeric | yes |  |
| `special_rating` | numeric | yes |  |
| `pace_rating` | numeric | yes |  |
| `danger_rating` | numeric | yes |  |
| `discipline_rating` | numeric | yes |  |
| `finishing_rating` | numeric | yes |  |
| `trend10` | numeric | yes |  |
| `variance_flag` | integer | yes |  |
| `components` | jsonb | yes |  |
| `provenance` | jsonb | yes |  |
| `computed_at` | timestamp with time zone | yes |  |

## `public.combined_sos`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_id` | smallint | yes |  |
| `team_name` | text | yes |  |
| `abbreviation` | character | yes |  |
| `past_sos` | numeric | yes |  |
| `future_sos` | numeric | yes |  |

## `public.dim_team_map`

Type: table

Primary key: `team_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_id` | integer | no |  |
| `wgo_abbrev` | text | no |  |
| `nst_abbr` | text | no |  |

## `public.external_teams`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `external_league_id` | uuid | no |  |
| `connected_account_id` | uuid | no |  |
| `user_id` | uuid | no |  |
| `provider` | text | no |  |
| `external_team_key` | text | no |  |
| `team_name` | text | yes |  |
| `team_metadata` | jsonb | no | '{}'::jsonb |
| `roster_snapshot` | jsonb | no | '{}'::jsonb |
| `imported_at` | timestamp with time zone | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.forge_team_game_strength`

Type: table

Primary key: `game_id`, `team_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | no |  |
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
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.forge_team_projections`

Type: table

Primary key: `run_id`, `game_id`, `team_id`, `horizon_games`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `run_id` | uuid | no |  |
| `as_of_date` | date | no |  |
| `horizon_games` | smallint | no |  |
| `game_id` | bigint | no |  |
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
| `uncertainty` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.lineCombinations`

Type: table

Primary key: `gameId`, `teamId`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `gameId` | bigint | no |  |
| `teamId` | smallint | no |  |
| `forwards` | _int8[] | no |  |
| `defensemen` | _int8[] | no |  |
| `goalies` | _int8[] | no |  |

## `public.line_combinations`

Type: table

Primary key: `id`, `date`, `team_name`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no |  |
| `date` | timestamp with time zone | no | (now() AT TIME ZONE 'utc'::text) |
| `team_name` | character varying | no | ''::character varying |
| `forwards` | json | no | '[]'::json |
| `defensemen` | json | no | '[]'::json |
| `goalies` | json | no | '[]'::json |
| `created_at` | timestamp with time zone | no | now() |
| `team_abbreviation` | character varying | no | ''::character varying |
| `source_url` | character varying | no | 'https://twitter.com/fhfhlines'::character varying |

## `public.lines_ccc`

Type: table

Primary key: `capture_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `capture_key` | text | no |  |
| `snapshot_date` | date | no |  |
| `observed_at` | timestamp with time zone | no | now() |
| `tweet_posted_at` | timestamp with time zone | yes |  |
| `tweet_posted_label` | text | yes |  |
| `game_id` | bigint | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `source` | text | no | 'lines_ccc'::text |
| `source_url` | text | yes |  |
| `source_label` | text | yes |  |
| `source_handle` | text | yes |  |
| `author_name` | text | yes |  |
| `tweet_id` | text | yes |  |
| `tweet_url` | text | yes |  |
| `quoted_tweet_id` | text | yes |  |
| `quoted_tweet_url` | text | yes |  |
| `quoted_author_handle` | text | yes |  |
| `quoted_author_name` | text | yes |  |
| `primary_text_source` | text | yes |  |
| `classification` | text | yes |  |
| `detected_league` | text | yes |  |
| `nhl_filter_status` | text | no | 'accepted'::text |
| `nhl_filter_reason` | text | yes |  |
| `status` | text | no | 'observed'::text |
| `raw_text` | text | yes |  |
| `enriched_text` | text | yes |  |
| `quoted_raw_text` | text | yes |  |
| `quoted_enriched_text` | text | yes |  |
| `keyword_hits` | _text[] | yes |  |
| `matched_player_ids` | _int8[] | yes |  |
| `matched_player_names` | _text[] | yes |  |
| `unmatched_names` | _text[] | yes |  |
| `line_1_player_ids` | _int8[] | yes |  |
| `line_1_player_names` | _text[] | yes |  |
| `line_2_player_ids` | _int8[] | yes |  |
| `line_2_player_names` | _text[] | yes |  |
| `line_3_player_ids` | _int8[] | yes |  |
| `line_3_player_names` | _text[] | yes |  |
| `line_4_player_ids` | _int8[] | yes |  |
| `line_4_player_names` | _text[] | yes |  |
| `pair_1_player_ids` | _int8[] | yes |  |
| `pair_1_player_names` | _text[] | yes |  |
| `pair_2_player_ids` | _int8[] | yes |  |
| `pair_2_player_names` | _text[] | yes |  |
| `pair_3_player_ids` | _int8[] | yes |  |
| `pair_3_player_names` | _text[] | yes |  |
| `goalie_1_player_id` | bigint | yes |  |
| `goalie_1_name` | text | yes |  |
| `goalie_2_player_id` | bigint | yes |  |
| `goalie_2_name` | text | yes |  |
| `scratches_player_ids` | _int8[] | yes |  |
| `scratches_player_names` | _text[] | yes |  |
| `injured_player_ids` | _int8[] | yes |  |
| `injured_player_names` | _text[] | yes |  |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `updated_at` | timestamp with time zone | no | now() |

## `public.lines_ccc_ifttt_events`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `source` | text | no | 'ifttt'::text |
| `source_account` | text | no | 'CcCMiddleton'::text |
| `username` | text | yes |  |
| `text` | text | yes |  |
| `link_to_tweet` | text | yes |  |
| `tweet_id` | text | yes |  |
| `tweet_embed_code` | text | yes |  |
| `tweet_created_at` | timestamp with time zone | yes |  |
| `created_at_label` | text | yes |  |
| `processing_status` | text | no | 'pending'::text |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `received_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.lines_dfo`

Type: table

Primary key: `capture_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `capture_key` | text | no |  |
| `snapshot_date` | date | no |  |
| `observed_at` | timestamp with time zone | no | now() |
| `game_id` | bigint | yes |  |
| `team_id` | bigint | no |  |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `source` | text | no | 'dailyfaceoff'::text |
| `source_url` | text | yes |  |
| `source_label` | text | yes |  |
| `status` | text | no | 'observed'::text |
| `line_1_player_ids` | _int8[] | yes |  |
| `line_1_player_names` | _text[] | yes |  |
| `line_2_player_ids` | _int8[] | yes |  |
| `line_2_player_names` | _text[] | yes |  |
| `line_3_player_ids` | _int8[] | yes |  |
| `line_3_player_names` | _text[] | yes |  |
| `line_4_player_ids` | _int8[] | yes |  |
| `line_4_player_names` | _text[] | yes |  |
| `pair_1_player_ids` | _int8[] | yes |  |
| `pair_1_player_names` | _text[] | yes |  |
| `pair_2_player_ids` | _int8[] | yes |  |
| `pair_2_player_names` | _text[] | yes |  |
| `pair_3_player_ids` | _int8[] | yes |  |
| `pair_3_player_names` | _text[] | yes |  |
| `goalie_1_player_id` | bigint | yes |  |
| `goalie_1_name` | text | yes |  |
| `goalie_2_player_id` | bigint | yes |  |
| `goalie_2_name` | text | yes |  |
| `scratches_player_ids` | _int8[] | yes |  |
| `scratches_player_names` | _text[] | yes |  |
| `injured_player_ids` | _int8[] | yes |  |
| `injured_player_names` | _text[] | yes |  |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `updated_at` | timestamp with time zone | no | now() |

## `public.lines_gdl`

Type: table

Primary key: `capture_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `capture_key` | text | no |  |
| `snapshot_date` | date | no |  |
| `observed_at` | timestamp with time zone | no | now() |
| `game_id` | bigint | yes |  |
| `team_id` | bigint | no |  |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `source` | text | no | 'gamedaytweets'::text |
| `source_url` | text | yes |  |
| `source_label` | text | yes |  |
| `status` | text | no | 'observed'::text |
| `line_1_player_ids` | _int8[] | yes |  |
| `line_1_player_names` | _text[] | yes |  |
| `line_2_player_ids` | _int8[] | yes |  |
| `line_2_player_names` | _text[] | yes |  |
| `line_3_player_ids` | _int8[] | yes |  |
| `line_3_player_names` | _text[] | yes |  |
| `line_4_player_ids` | _int8[] | yes |  |
| `line_4_player_names` | _text[] | yes |  |
| `pair_1_player_ids` | _int8[] | yes |  |
| `pair_1_player_names` | _text[] | yes |  |
| `pair_2_player_ids` | _int8[] | yes |  |
| `pair_2_player_names` | _text[] | yes |  |
| `pair_3_player_ids` | _int8[] | yes |  |
| `pair_3_player_names` | _text[] | yes |  |
| `goalie_1_player_id` | bigint | yes |  |
| `goalie_1_name` | text | yes |  |
| `goalie_2_player_id` | bigint | yes |  |
| `goalie_2_name` | text | yes |  |
| `scratches_player_ids` | _int8[] | yes |  |
| `scratches_player_names` | _text[] | yes |  |
| `injured_player_ids` | _int8[] | yes |  |
| `injured_player_names` | _text[] | yes |  |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `updated_at` | timestamp with time zone | no | now() |
| `tweet_posted_at` | timestamp with time zone | yes |  |

## `public.lines_nhl`

Type: table

Primary key: `capture_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `capture_key` | text | no |  |
| `snapshot_date` | date | no |  |
| `observed_at` | timestamp with time zone | no | now() |
| `game_id` | bigint | yes |  |
| `team_id` | bigint | no |  |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `source` | text | no | 'nhl.com'::text |
| `source_url` | text | yes |  |
| `source_label` | text | yes |  |
| `status` | text | no | 'observed'::text |
| `line_1_player_ids` | _int8[] | yes |  |
| `line_1_player_names` | _text[] | yes |  |
| `line_2_player_ids` | _int8[] | yes |  |
| `line_2_player_names` | _text[] | yes |  |
| `line_3_player_ids` | _int8[] | yes |  |
| `line_3_player_names` | _text[] | yes |  |
| `line_4_player_ids` | _int8[] | yes |  |
| `line_4_player_names` | _text[] | yes |  |
| `pair_1_player_ids` | _int8[] | yes |  |
| `pair_1_player_names` | _text[] | yes |  |
| `pair_2_player_ids` | _int8[] | yes |  |
| `pair_2_player_names` | _text[] | yes |  |
| `pair_3_player_ids` | _int8[] | yes |  |
| `pair_3_player_names` | _text[] | yes |  |
| `goalie_1_player_id` | bigint | yes |  |
| `goalie_1_name` | text | yes |  |
| `goalie_2_player_id` | bigint | yes |  |
| `goalie_2_name` | text | yes |  |
| `scratches_player_ids` | _int8[] | yes |  |
| `scratches_player_names` | _text[] | yes |  |
| `injured_player_ids` | _int8[] | yes |  |
| `injured_player_names` | _text[] | yes |  |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `updated_at` | timestamp with time zone | no | now() |

## `public.nhl_edge_team_metrics_daily`

Type: table

Primary key: `snapshot_date`, `season_id`, `game_type`, `team_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `season_id` | bigint | no |  |
| `game_type` | smallint | no | 2 |
| `team_id` | bigint | no |  |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `conference` | text | yes |  |
| `division` | text | yes |  |
| `games_played` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `points` | integer | yes |  |
| `shot_attempts_over_90` | integer | yes |  |
| `shot_attempts_over_90_rank` | integer | yes |  |
| `top_shot_speed_mph` | double precision | yes |  |
| `top_shot_speed_kph` | double precision | yes |  |
| `top_shot_speed_rank` | integer | yes |  |
| `top_shot_speed_league_avg_mph` | double precision | yes |  |
| `bursts_over_22` | integer | yes |  |
| `bursts_over_22_rank` | integer | yes |  |
| `bursts_over_20` | integer | yes |  |
| `bursts_over_20_rank` | integer | yes |  |
| `bursts_over_20_league_avg` | double precision | yes |  |
| `max_skating_speed_mph` | double precision | yes |  |
| `max_skating_speed_kph` | double precision | yes |  |
| `max_skating_speed_rank` | integer | yes |  |
| `max_skating_speed_league_avg_mph` | double precision | yes |  |
| `total_distance_miles` | double precision | yes |  |
| `total_distance_km` | double precision | yes |  |
| `total_distance_rank` | integer | yes |  |
| `total_distance_league_avg_miles` | double precision | yes |  |
| `all_shots` | integer | yes |  |
| `all_goals` | integer | yes |  |
| `all_shooting_pct` | double precision | yes |  |
| `all_shots_rank` | integer | yes |  |
| `all_goals_rank` | integer | yes |  |
| `all_shooting_pct_rank` | integer | yes |  |
| `high_danger_shots` | integer | yes |  |
| `high_danger_goals` | integer | yes |  |
| `high_danger_shooting_pct` | double precision | yes |  |
| `high_danger_shots_rank` | integer | yes |  |
| `high_danger_goals_rank` | integer | yes |  |
| `high_danger_shooting_pct_rank` | integer | yes |  |
| `mid_range_shots` | integer | yes |  |
| `mid_range_goals` | integer | yes |  |
| `mid_range_shooting_pct` | double precision | yes |  |
| `mid_range_shots_rank` | integer | yes |  |
| `mid_range_goals_rank` | integer | yes |  |
| `mid_range_shooting_pct_rank` | integer | yes |  |
| `long_range_shots` | integer | yes |  |
| `long_range_goals` | integer | yes |  |
| `long_range_shooting_pct` | double precision | yes |  |
| `long_range_shots_rank` | integer | yes |  |
| `long_range_goals_rank` | integer | yes |  |
| `long_range_shooting_pct_rank` | integer | yes |  |
| `offensive_zone_pct` | double precision | yes |  |
| `offensive_zone_rank` | integer | yes |  |
| `offensive_zone_league_avg` | double precision | yes |  |
| `offensive_zone_ev_pct` | double precision | yes |  |
| `offensive_zone_ev_rank` | integer | yes |  |
| `offensive_zone_ev_league_avg` | double precision | yes |  |
| `neutral_zone_pct` | double precision | yes |  |
| `neutral_zone_rank` | integer | yes |  |
| `neutral_zone_league_avg` | double precision | yes |  |
| `defensive_zone_pct` | double precision | yes |  |
| `defensive_zone_rank` | integer | yes |  |
| `defensive_zone_league_avg` | double precision | yes |  |
| `source_url` | text | no |  |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | timezone('utc'::text, now()) |
| `updated_at` | timestamp with time zone | no | timezone('utc'::text, now()) |

## `public.nhl_standings_details`

Type: table

Primary key: `season_id`, `date`, `team_abbrev`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `team_abbrev` | text | no |  |
| `conference_abbrev` | text | yes |  |
| `conference_home_sequence` | integer | yes |  |
| `conference_l10_sequence` | integer | yes |  |
| `conference_name` | text | yes |  |
| `conference_road_sequence` | integer | yes |  |
| `conference_sequence` | integer | yes |  |
| `division_abbrev` | text | yes |  |
| `division_home_sequence` | integer | yes |  |
| `division_l10_sequence` | integer | yes |  |
| `division_name` | text | yes |  |
| `division_road_sequence` | integer | yes |  |
| `division_sequence` | integer | yes |  |
| `game_type_id` | integer | yes |  |
| `games_played` | integer | yes |  |
| `goal_differential` | integer | yes |  |
| `goal_differential_pctg` | numeric | yes |  |
| `goal_against` | integer | yes |  |
| `goal_for` | integer | yes |  |
| `goals_for_pctg` | numeric | yes |  |
| `home_games_played` | integer | yes |  |
| `home_goal_differential` | integer | yes |  |
| `home_goals_against` | integer | yes |  |
| `home_goals_for` | integer | yes |  |
| `home_losses` | integer | yes |  |
| `home_ot_losses` | integer | yes |  |
| `home_points` | integer | yes |  |
| `home_regulation_plus_ot_wins` | integer | yes |  |
| `home_regulation_wins` | integer | yes |  |
| `home_wins` | integer | yes |  |
| `l10_games_played` | integer | yes |  |
| `l10_goal_differential` | integer | yes |  |
| `l10_goals_against` | integer | yes |  |
| `l10_goals_for` | integer | yes |  |
| `l10_losses` | integer | yes |  |
| `l10_ot_losses` | integer | yes |  |
| `l10_points` | integer | yes |  |
| `l10_regulation_plus_ot_wins` | integer | yes |  |
| `l10_regulation_wins` | integer | yes |  |
| `l10_wins` | integer | yes |  |
| `league_home_sequence` | integer | yes |  |
| `league_l10_sequence` | integer | yes |  |
| `league_road_sequence` | integer | yes |  |
| `league_sequence` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `place_name` | text | yes |  |
| `point_pctg` | numeric | yes |  |
| `points` | integer | yes |  |
| `regulation_plus_ot_win_pctg` | numeric | yes |  |
| `regulation_plus_ot_wins` | integer | yes |  |
| `regulation_win_pctg` | numeric | yes |  |
| `regulation_wins` | integer | yes |  |
| `road_games_played` | integer | yes |  |
| `road_goal_differential` | integer | yes |  |
| `road_goals_against` | integer | yes |  |
| `road_goals_for` | integer | yes |  |
| `road_losses` | integer | yes |  |
| `road_ot_losses` | integer | yes |  |
| `road_points` | integer | yes |  |
| `road_regulation_plus_ot_wins` | integer | yes |  |
| `road_regulation_wins` | integer | yes |  |
| `road_wins` | integer | yes |  |
| `shootout_losses` | integer | yes |  |
| `shootout_wins` | integer | yes |  |
| `streak_code` | text | yes |  |
| `streak_count` | integer | yes |  |
| `team_name_default` | text | yes |  |
| `team_name_fr` | text | yes |  |
| `team_common_name` | text | yes |  |
| `waivers_sequence` | integer | yes |  |
| `wildcard_sequence` | integer | yes |  |
| `win_pctg` | numeric | yes |  |
| `wins` | integer | yes |  |

## `public.nhl_team_data`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `season_id` | integer | yes |  |
| `date` | date | yes |  |
| `team_abbrev` | text | yes |  |
| `games_played` | integer | yes |  |
| `win_pctg` | numeric | yes |  |
| `goal_for` | integer | yes |  |
| `goal_against` | integer | yes |  |
| `goal_for_per_game` | numeric | yes |  |
| `goal_against_per_game` | numeric | yes |  |
| `cf_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `xgf_per_game` | numeric | yes |  |
| `xga_per_game` | numeric | yes |  |
| `sf_per_game` | numeric | yes |  |
| `sa_per_game` | numeric | yes |  |

## `public.nst_5v5_team_differentials`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | integer | yes |  |
| `w_per_game` | numeric | yes |  |
| `l_per_game` | numeric | yes |  |
| `otl_per_game` | numeric | yes |  |
| `points_per_game` | numeric | yes |  |
| `toi_per_game_diff` | numeric | yes |  |
| `cf_per_game_diff` | numeric | yes |  |
| `ca_per_game_diff` | numeric | yes |  |
| `ff_per_game_diff` | numeric | yes |  |
| `fa_per_game_diff` | numeric | yes |  |
| `sf_per_game_diff` | numeric | yes |  |
| `sa_per_game_diff` | numeric | yes |  |
| `gf_per_game_diff` | numeric | yes |  |
| `ga_per_game_diff` | numeric | yes |  |
| `xgf_per_game_diff` | double precision | yes |  |
| `xga_per_game_diff` | double precision | yes |  |
| `scf_per_game_diff` | numeric | yes |  |
| `sca_per_game_diff` | numeric | yes |  |
| `hdcf_per_game_diff` | numeric | yes |  |
| `hdca_per_game_diff` | numeric | yes |  |
| `hdsf_per_game_diff` | numeric | yes |  |
| `hdsa_per_game_diff` | numeric | yes |  |
| `hdgf_per_game_diff` | numeric | yes |  |
| `hdga_per_game_diff` | numeric | yes |  |
| `cf_pct_diff` | double precision | yes |  |
| `ff_pct_diff` | double precision | yes |  |
| `sf_pct_diff` | double precision | yes |  |
| `gf_pct_diff` | double precision | yes |  |
| `xgf_pct_diff` | double precision | yes |  |
| `scf_pct_diff` | double precision | yes |  |
| `hdcf_pct_diff` | double precision | yes |  |
| `hdsf_pct_diff` | double precision | yes |  |
| `hdgf_pct_diff` | double precision | yes |  |
| `sh_pct_diff` | double precision | yes |  |
| `sv_pct_diff` | double precision | yes |  |
| `pdo_diff` | numeric | yes |  |

## `public.nst_5v5_team_per_game`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | integer | yes |  |
| `toi_per_game` | numeric | yes |  |
| `w_per_game` | numeric | yes |  |
| `l_per_game` | numeric | yes |  |
| `otl_per_game` | numeric | yes |  |
| `points_per_game` | numeric | yes |  |
| `cf_per_game` | numeric | yes |  |
| `ca_per_game` | numeric | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_per_game` | numeric | yes |  |
| `fa_per_game` | numeric | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_per_game` | numeric | yes |  |
| `sa_per_game` | numeric | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_per_game` | numeric | yes |  |
| `ga_per_game` | numeric | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_per_game` | numeric | yes |  |
| `xga_per_game` | numeric | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_per_game` | numeric | yes |  |
| `sca_per_game` | numeric | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_per_game` | numeric | yes |  |
| `hdca_per_game` | numeric | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf_per_game` | numeric | yes |  |
| `hdsa_per_game` | numeric | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf_per_game` | numeric | yes |  |
| `hdga_per_game` | numeric | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |

## `public.nst_all_team_differentials`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | integer | yes |  |
| `w_per_game` | numeric | yes |  |
| `l_per_game` | numeric | yes |  |
| `otl_per_game` | numeric | yes |  |
| `points_per_game` | numeric | yes |  |
| `toi_per_game_diff` | numeric | yes |  |
| `cf_per_game_diff` | numeric | yes |  |
| `ca_per_game_diff` | numeric | yes |  |
| `ff_per_game_diff` | numeric | yes |  |
| `fa_per_game_diff` | numeric | yes |  |
| `sf_per_game_diff` | numeric | yes |  |
| `sa_per_game_diff` | numeric | yes |  |
| `gf_per_game_diff` | numeric | yes |  |
| `ga_per_game_diff` | numeric | yes |  |
| `xgf_per_game_diff` | double precision | yes |  |
| `xga_per_game_diff` | double precision | yes |  |
| `scf_per_game_diff` | numeric | yes |  |
| `sca_per_game_diff` | numeric | yes |  |
| `hdcf_per_game_diff` | numeric | yes |  |
| `hdca_per_game_diff` | numeric | yes |  |
| `hdsf_per_game_diff` | numeric | yes |  |
| `hdsa_per_game_diff` | numeric | yes |  |
| `hdgf_per_game_diff` | numeric | yes |  |
| `hdga_per_game_diff` | numeric | yes |  |
| `cf_pct_diff` | double precision | yes |  |
| `ff_pct_diff` | double precision | yes |  |
| `sf_pct_diff` | double precision | yes |  |
| `gf_pct_diff` | double precision | yes |  |
| `xgf_pct_diff` | double precision | yes |  |
| `scf_pct_diff` | double precision | yes |  |
| `hdcf_pct_diff` | double precision | yes |  |
| `hdsf_pct_diff` | double precision | yes |  |
| `hdgf_pct_diff` | double precision | yes |  |
| `sh_pct_diff` | double precision | yes |  |
| `sv_pct_diff` | double precision | yes |  |
| `pdo_diff` | numeric | yes |  |

## `public.nst_all_team_per_game`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | integer | yes |  |
| `toi_per_game` | numeric | yes |  |
| `w_per_game` | numeric | yes |  |
| `l_per_game` | numeric | yes |  |
| `otl_per_game` | numeric | yes |  |
| `points_per_game` | numeric | yes |  |
| `cf_per_game` | numeric | yes |  |
| `ca_per_game` | numeric | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_per_game` | numeric | yes |  |
| `fa_per_game` | numeric | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_per_game` | numeric | yes |  |
| `sa_per_game` | numeric | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_per_game` | numeric | yes |  |
| `ga_per_game` | numeric | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_per_game` | numeric | yes |  |
| `xga_per_game` | numeric | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_per_game` | numeric | yes |  |
| `sca_per_game` | numeric | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_per_game` | numeric | yes |  |
| `hdca_per_game` | numeric | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf_per_game` | numeric | yes |  |
| `hdsa_per_game` | numeric | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf_per_game` | numeric | yes |  |
| `hdga_per_game` | numeric | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |

## `public.nst_pk_team_differentials`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | integer | yes |  |
| `w_per_game` | numeric | yes |  |
| `l_per_game` | numeric | yes |  |
| `otl_per_game` | numeric | yes |  |
| `points_per_game` | numeric | yes |  |
| `toi_per_game_diff` | numeric | yes |  |
| `cf_per_game_diff` | numeric | yes |  |
| `ca_per_game_diff` | numeric | yes |  |
| `ff_per_game_diff` | numeric | yes |  |
| `fa_per_game_diff` | numeric | yes |  |
| `sf_per_game_diff` | numeric | yes |  |
| `sa_per_game_diff` | numeric | yes |  |
| `gf_per_game_diff` | numeric | yes |  |
| `ga_per_game_diff` | numeric | yes |  |
| `xgf_per_game_diff` | double precision | yes |  |
| `xga_per_game_diff` | double precision | yes |  |
| `scf_per_game_diff` | numeric | yes |  |
| `sca_per_game_diff` | numeric | yes |  |
| `hdcf_per_game_diff` | numeric | yes |  |
| `hdca_per_game_diff` | numeric | yes |  |
| `hdsf_per_game_diff` | numeric | yes |  |
| `hdsa_per_game_diff` | numeric | yes |  |
| `hdgf_per_game_diff` | numeric | yes |  |
| `hdga_per_game_diff` | numeric | yes |  |
| `cf_pct_diff` | double precision | yes |  |
| `ff_pct_diff` | double precision | yes |  |
| `sf_pct_diff` | double precision | yes |  |
| `gf_pct_diff` | double precision | yes |  |
| `xgf_pct_diff` | double precision | yes |  |
| `scf_pct_diff` | double precision | yes |  |
| `hdcf_pct_diff` | double precision | yes |  |
| `hdsf_pct_diff` | double precision | yes |  |
| `hdgf_pct_diff` | double precision | yes |  |
| `sh_pct_diff` | double precision | yes |  |
| `sv_pct_diff` | double precision | yes |  |
| `pdo_diff` | numeric | yes |  |

## `public.nst_pk_team_per_game`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | integer | yes |  |
| `toi_per_game` | numeric | yes |  |
| `w_per_game` | numeric | yes |  |
| `l_per_game` | numeric | yes |  |
| `otl_per_game` | numeric | yes |  |
| `points_per_game` | numeric | yes |  |
| `cf_per_game` | numeric | yes |  |
| `ca_per_game` | numeric | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_per_game` | numeric | yes |  |
| `fa_per_game` | numeric | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_per_game` | numeric | yes |  |
| `sa_per_game` | numeric | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_per_game` | numeric | yes |  |
| `ga_per_game` | numeric | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_per_game` | numeric | yes |  |
| `xga_per_game` | numeric | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_per_game` | numeric | yes |  |
| `sca_per_game` | numeric | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_per_game` | numeric | yes |  |
| `hdca_per_game` | numeric | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf_per_game` | numeric | yes |  |
| `hdsa_per_game` | numeric | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf_per_game` | numeric | yes |  |
| `hdga_per_game` | numeric | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |

## `public.nst_pp_team_differentials`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | integer | yes |  |
| `w_per_game` | numeric | yes |  |
| `l_per_game` | numeric | yes |  |
| `otl_per_game` | numeric | yes |  |
| `points_per_game` | numeric | yes |  |
| `toi_per_game_diff` | numeric | yes |  |
| `cf_per_game_diff` | numeric | yes |  |
| `ca_per_game_diff` | numeric | yes |  |
| `ff_per_game_diff` | numeric | yes |  |
| `fa_per_game_diff` | numeric | yes |  |
| `sf_per_game_diff` | numeric | yes |  |
| `sa_per_game_diff` | numeric | yes |  |
| `gf_per_game_diff` | numeric | yes |  |
| `ga_per_game_diff` | numeric | yes |  |
| `xgf_per_game_diff` | double precision | yes |  |
| `xga_per_game_diff` | double precision | yes |  |
| `scf_per_game_diff` | numeric | yes |  |
| `sca_per_game_diff` | numeric | yes |  |
| `hdcf_per_game_diff` | numeric | yes |  |
| `hdca_per_game_diff` | numeric | yes |  |
| `hdsf_per_game_diff` | numeric | yes |  |
| `hdsa_per_game_diff` | numeric | yes |  |
| `hdgf_per_game_diff` | numeric | yes |  |
| `hdga_per_game_diff` | numeric | yes |  |
| `cf_pct_diff` | double precision | yes |  |
| `ff_pct_diff` | double precision | yes |  |
| `sf_pct_diff` | double precision | yes |  |
| `gf_pct_diff` | double precision | yes |  |
| `xgf_pct_diff` | double precision | yes |  |
| `scf_pct_diff` | double precision | yes |  |
| `hdcf_pct_diff` | double precision | yes |  |
| `hdsf_pct_diff` | double precision | yes |  |
| `hdgf_pct_diff` | double precision | yes |  |
| `sh_pct_diff` | double precision | yes |  |
| `sv_pct_diff` | double precision | yes |  |
| `pdo_diff` | numeric | yes |  |

## `public.nst_pp_team_per_game`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | integer | yes |  |
| `toi_per_game` | numeric | yes |  |
| `w_per_game` | numeric | yes |  |
| `l_per_game` | numeric | yes |  |
| `otl_per_game` | numeric | yes |  |
| `points_per_game` | numeric | yes |  |
| `cf_per_game` | numeric | yes |  |
| `ca_per_game` | numeric | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_per_game` | numeric | yes |  |
| `fa_per_game` | numeric | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_per_game` | numeric | yes |  |
| `sa_per_game` | numeric | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_per_game` | numeric | yes |  |
| `ga_per_game` | numeric | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_per_game` | numeric | yes |  |
| `xga_per_game` | numeric | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_per_game` | numeric | yes |  |
| `sca_per_game` | numeric | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_per_game` | numeric | yes |  |
| `hdca_per_game` | numeric | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf_per_game` | numeric | yes |  |
| `hdsa_per_game` | numeric | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf_per_game` | numeric | yes |  |
| `hdga_per_game` | numeric | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |

## `public.nst_team_5v5`

Type: table

Primary key: `team_abbreviation`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |
| `w` | integer | yes |  |
| `l` | integer | yes |  |
| `otl` | integer | yes |  |
| `points` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |
| `date` | date | no |  |
| `situation` | text | no | 'all'::text |
| `created_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |

## `public.nst_team_all`

Type: table

Primary key: `team_abbreviation`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |
| `w` | integer | yes |  |
| `l` | integer | yes |  |
| `otl` | integer | yes |  |
| `points` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |
| `date` | date | no |  |
| `situation` | text | no | 'all'::text |
| `created_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |

## `public.nst_team_gamelogs_as_counts`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_team_gamelogs_as_counts_id_seq'::regclass) |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `situation` | text | no | 'all'::text |
| `gp` | integer | yes |  |
| `toi_seconds` | integer | yes |  |
| `toi_per_gp_seconds` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `otl` | integer | yes |  |
| `row_wins` | integer | yes |  |
| `points` | integer | yes |  |
| `point_pct` | double precision | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scsf` | integer | yes |  |
| `scsa` | integer | yes |  |
| `scsf_pct` | double precision | yes |  |
| `scsf_per_60` | double precision | yes |  |
| `scsa_per_60` | double precision | yes |  |
| `scgf` | integer | yes |  |
| `scga` | integer | yes |  |
| `scgf_pct` | double precision | yes |  |
| `scgf_per_60` | double precision | yes |  |
| `scga_per_60` | double precision | yes |  |
| `scsh_pct` | double precision | yes |  |
| `scsv_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdsf_per_60` | double precision | yes |  |
| `hdsa_per_60` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdsh_pct` | double precision | yes |  |
| `hdsv_pct` | double precision | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdsf` | integer | yes |  |
| `mdsa` | integer | yes |  |
| `mdsf_pct` | double precision | yes |  |
| `mdsf_per_60` | double precision | yes |  |
| `mdsa_per_60` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdsh_pct` | double precision | yes |  |
| `mdsv_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldsf` | integer | yes |  |
| `ldsa` | integer | yes |  |
| `ldsf_pct` | double precision | yes |  |
| `ldsf_per_60` | double precision | yes |  |
| `ldsa_per_60` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldsh_pct` | double precision | yes |  |
| `ldsv_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `created_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |

## `public.nst_team_gamelogs_as_rates`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_team_gamelogs_as_counts_id_seq'::regclass) |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `situation` | text | no | 'all'::text |
| `gp` | integer | yes |  |
| `toi_seconds` | integer | yes |  |
| `toi_per_gp_seconds` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `otl` | integer | yes |  |
| `row_wins` | integer | yes |  |
| `points` | integer | yes |  |
| `point_pct` | double precision | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scsf` | integer | yes |  |
| `scsa` | integer | yes |  |
| `scsf_pct` | double precision | yes |  |
| `scsf_per_60` | double precision | yes |  |
| `scsa_per_60` | double precision | yes |  |
| `scgf` | integer | yes |  |
| `scga` | integer | yes |  |
| `scgf_pct` | double precision | yes |  |
| `scgf_per_60` | double precision | yes |  |
| `scga_per_60` | double precision | yes |  |
| `scsh_pct` | double precision | yes |  |
| `scsv_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdsf_per_60` | double precision | yes |  |
| `hdsa_per_60` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdsh_pct` | double precision | yes |  |
| `hdsv_pct` | double precision | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdsf` | integer | yes |  |
| `mdsa` | integer | yes |  |
| `mdsf_pct` | double precision | yes |  |
| `mdsf_per_60` | double precision | yes |  |
| `mdsa_per_60` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdsh_pct` | double precision | yes |  |
| `mdsv_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldsf` | integer | yes |  |
| `ldsa` | integer | yes |  |
| `ldsf_pct` | double precision | yes |  |
| `ldsf_per_60` | double precision | yes |  |
| `ldsa_per_60` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldsh_pct` | double precision | yes |  |
| `ldsv_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `created_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |

## `public.nst_team_gamelogs_es_counts`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_team_gamelogs_as_counts_id_seq'::regclass) |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `situation` | text | no | '5v5'::text |
| `gp` | integer | yes |  |
| `toi_seconds` | integer | yes |  |
| `toi_per_gp_seconds` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `otl` | integer | yes |  |
| `row_wins` | integer | yes |  |
| `points` | integer | yes |  |
| `point_pct` | double precision | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scsf` | integer | yes |  |
| `scsa` | integer | yes |  |
| `scsf_pct` | double precision | yes |  |
| `scsf_per_60` | double precision | yes |  |
| `scsa_per_60` | double precision | yes |  |
| `scgf` | integer | yes |  |
| `scga` | integer | yes |  |
| `scgf_pct` | double precision | yes |  |
| `scgf_per_60` | double precision | yes |  |
| `scga_per_60` | double precision | yes |  |
| `scsh_pct` | double precision | yes |  |
| `scsv_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdsf_per_60` | double precision | yes |  |
| `hdsa_per_60` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdsh_pct` | double precision | yes |  |
| `hdsv_pct` | double precision | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdsf` | integer | yes |  |
| `mdsa` | integer | yes |  |
| `mdsf_pct` | double precision | yes |  |
| `mdsf_per_60` | double precision | yes |  |
| `mdsa_per_60` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdsh_pct` | double precision | yes |  |
| `mdsv_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldsf` | integer | yes |  |
| `ldsa` | integer | yes |  |
| `ldsf_pct` | double precision | yes |  |
| `ldsf_per_60` | double precision | yes |  |
| `ldsa_per_60` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldsh_pct` | double precision | yes |  |
| `ldsv_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `created_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |

## `public.nst_team_gamelogs_es_rates`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_team_gamelogs_as_counts_id_seq'::regclass) |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `situation` | text | no | '5v5'::text |
| `gp` | integer | yes |  |
| `toi_seconds` | integer | yes |  |
| `toi_per_gp_seconds` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `otl` | integer | yes |  |
| `row_wins` | integer | yes |  |
| `points` | integer | yes |  |
| `point_pct` | double precision | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scsf` | integer | yes |  |
| `scsa` | integer | yes |  |
| `scsf_pct` | double precision | yes |  |
| `scsf_per_60` | double precision | yes |  |
| `scsa_per_60` | double precision | yes |  |
| `scgf` | integer | yes |  |
| `scga` | integer | yes |  |
| `scgf_pct` | double precision | yes |  |
| `scgf_per_60` | double precision | yes |  |
| `scga_per_60` | double precision | yes |  |
| `scsh_pct` | double precision | yes |  |
| `scsv_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdsf_per_60` | double precision | yes |  |
| `hdsa_per_60` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdsh_pct` | double precision | yes |  |
| `hdsv_pct` | double precision | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdsf` | integer | yes |  |
| `mdsa` | integer | yes |  |
| `mdsf_pct` | double precision | yes |  |
| `mdsf_per_60` | double precision | yes |  |
| `mdsa_per_60` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdsh_pct` | double precision | yes |  |
| `mdsv_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldsf` | integer | yes |  |
| `ldsa` | integer | yes |  |
| `ldsf_pct` | double precision | yes |  |
| `ldsf_per_60` | double precision | yes |  |
| `ldsa_per_60` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldsh_pct` | double precision | yes |  |
| `ldsv_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `created_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |

## `public.nst_team_gamelogs_pk_counts`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_team_gamelogs_as_counts_id_seq'::regclass) |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `situation` | text | no | 'pk'::text |
| `gp` | integer | yes |  |
| `toi_seconds` | integer | yes |  |
| `toi_per_gp_seconds` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `otl` | integer | yes |  |
| `row_wins` | integer | yes |  |
| `points` | integer | yes |  |
| `point_pct` | double precision | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scsf` | integer | yes |  |
| `scsa` | integer | yes |  |
| `scsf_pct` | double precision | yes |  |
| `scsf_per_60` | double precision | yes |  |
| `scsa_per_60` | double precision | yes |  |
| `scgf` | integer | yes |  |
| `scga` | integer | yes |  |
| `scgf_pct` | double precision | yes |  |
| `scgf_per_60` | double precision | yes |  |
| `scga_per_60` | double precision | yes |  |
| `scsh_pct` | double precision | yes |  |
| `scsv_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdsf_per_60` | double precision | yes |  |
| `hdsa_per_60` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdsh_pct` | double precision | yes |  |
| `hdsv_pct` | double precision | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdsf` | integer | yes |  |
| `mdsa` | integer | yes |  |
| `mdsf_pct` | double precision | yes |  |
| `mdsf_per_60` | double precision | yes |  |
| `mdsa_per_60` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdsh_pct` | double precision | yes |  |
| `mdsv_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldsf` | integer | yes |  |
| `ldsa` | integer | yes |  |
| `ldsf_pct` | double precision | yes |  |
| `ldsf_per_60` | double precision | yes |  |
| `ldsa_per_60` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldsh_pct` | double precision | yes |  |
| `ldsv_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `created_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |

## `public.nst_team_gamelogs_pk_rates`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_team_gamelogs_as_counts_id_seq'::regclass) |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `situation` | text | no | 'pk'::text |
| `gp` | integer | yes |  |
| `toi_seconds` | integer | yes |  |
| `toi_per_gp_seconds` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `otl` | integer | yes |  |
| `row_wins` | integer | yes |  |
| `points` | integer | yes |  |
| `point_pct` | double precision | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scsf` | integer | yes |  |
| `scsa` | integer | yes |  |
| `scsf_pct` | double precision | yes |  |
| `scsf_per_60` | double precision | yes |  |
| `scsa_per_60` | double precision | yes |  |
| `scgf` | integer | yes |  |
| `scga` | integer | yes |  |
| `scgf_pct` | double precision | yes |  |
| `scgf_per_60` | double precision | yes |  |
| `scga_per_60` | double precision | yes |  |
| `scsh_pct` | double precision | yes |  |
| `scsv_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdsf_per_60` | double precision | yes |  |
| `hdsa_per_60` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdsh_pct` | double precision | yes |  |
| `hdsv_pct` | double precision | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdsf` | integer | yes |  |
| `mdsa` | integer | yes |  |
| `mdsf_pct` | double precision | yes |  |
| `mdsf_per_60` | double precision | yes |  |
| `mdsa_per_60` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdsh_pct` | double precision | yes |  |
| `mdsv_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldsf` | integer | yes |  |
| `ldsa` | integer | yes |  |
| `ldsf_pct` | double precision | yes |  |
| `ldsf_per_60` | double precision | yes |  |
| `ldsa_per_60` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldsh_pct` | double precision | yes |  |
| `ldsv_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `created_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |

## `public.nst_team_gamelogs_pp_counts`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_team_gamelogs_as_counts_id_seq'::regclass) |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `situation` | text | no | 'pp'::text |
| `gp` | integer | yes |  |
| `toi_seconds` | integer | yes |  |
| `toi_per_gp_seconds` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `otl` | integer | yes |  |
| `row_wins` | integer | yes |  |
| `points` | integer | yes |  |
| `point_pct` | double precision | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scsf` | integer | yes |  |
| `scsa` | integer | yes |  |
| `scsf_pct` | double precision | yes |  |
| `scsf_per_60` | double precision | yes |  |
| `scsa_per_60` | double precision | yes |  |
| `scgf` | integer | yes |  |
| `scga` | integer | yes |  |
| `scgf_pct` | double precision | yes |  |
| `scgf_per_60` | double precision | yes |  |
| `scga_per_60` | double precision | yes |  |
| `scsh_pct` | double precision | yes |  |
| `scsv_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdsf_per_60` | double precision | yes |  |
| `hdsa_per_60` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdsh_pct` | double precision | yes |  |
| `hdsv_pct` | double precision | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdsf` | integer | yes |  |
| `mdsa` | integer | yes |  |
| `mdsf_pct` | double precision | yes |  |
| `mdsf_per_60` | double precision | yes |  |
| `mdsa_per_60` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdsh_pct` | double precision | yes |  |
| `mdsv_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldsf` | integer | yes |  |
| `ldsa` | integer | yes |  |
| `ldsf_pct` | double precision | yes |  |
| `ldsf_per_60` | double precision | yes |  |
| `ldsa_per_60` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldsh_pct` | double precision | yes |  |
| `ldsv_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `created_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |

## `public.nst_team_gamelogs_pp_rates`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_team_gamelogs_as_counts_id_seq'::regclass) |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `situation` | text | no | 'pp'::text |
| `gp` | integer | yes |  |
| `toi_seconds` | integer | yes |  |
| `toi_per_gp_seconds` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `otl` | integer | yes |  |
| `row_wins` | integer | yes |  |
| `points` | integer | yes |  |
| `point_pct` | double precision | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scsf` | integer | yes |  |
| `scsa` | integer | yes |  |
| `scsf_pct` | double precision | yes |  |
| `scsf_per_60` | double precision | yes |  |
| `scsa_per_60` | double precision | yes |  |
| `scgf` | integer | yes |  |
| `scga` | integer | yes |  |
| `scgf_pct` | double precision | yes |  |
| `scgf_per_60` | double precision | yes |  |
| `scga_per_60` | double precision | yes |  |
| `scsh_pct` | double precision | yes |  |
| `scsv_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdsf_per_60` | double precision | yes |  |
| `hdsa_per_60` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdsh_pct` | double precision | yes |  |
| `hdsv_pct` | double precision | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdsf` | integer | yes |  |
| `mdsa` | integer | yes |  |
| `mdsf_pct` | double precision | yes |  |
| `mdsf_per_60` | double precision | yes |  |
| `mdsa_per_60` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdsh_pct` | double precision | yes |  |
| `mdsv_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldsf` | integer | yes |  |
| `ldsa` | integer | yes |  |
| `ldsf_pct` | double precision | yes |  |
| `ldsf_per_60` | double precision | yes |  |
| `ldsa_per_60` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldsh_pct` | double precision | yes |  |
| `ldsv_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `created_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | no | CURRENT_TIMESTAMP |

## `public.nst_team_pk`

Type: table

Primary key: `team_abbreviation`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |
| `w` | integer | yes |  |
| `l` | integer | yes |  |
| `otl` | integer | yes |  |
| `points` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |
| `date` | date | no |  |
| `situation` | text | no | 'all'::text |
| `created_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |

## `public.nst_team_pp`

Type: table

Primary key: `team_abbreviation`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |
| `w` | integer | yes |  |
| `l` | integer | yes |  |
| `otl` | integer | yes |  |
| `points` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |
| `date` | date | no |  |
| `situation` | text | no | 'all'::text |
| `created_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |

## `public.nst_team_scores_all_strengths`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | integer | yes |  |
| `w_per_game` | numeric | yes |  |
| `l_per_game` | numeric | yes |  |
| `otl_per_game` | numeric | yes |  |
| `points_per_game` | numeric | yes |  |
| `att_score_all` | double precision | yes |  |
| `def_score_all` | double precision | yes |  |
| `att_score_5v5` | double precision | yes |  |
| `def_score_5v5` | double precision | yes |  |
| `att_score_pp` | double precision | yes |  |
| `def_score_pp` | double precision | yes |  |
| `att_score_pk` | double precision | yes |  |
| `def_score_pk` | double precision | yes |  |

## `public.nst_team_stats`

Type: table

Primary key: `team_abbreviation`, `season`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `gp` | integer | yes |  |
| `toi` | bigint | yes |  |
| `w` | integer | yes |  |
| `l` | integer | yes |  |
| `otl` | integer | yes |  |
| `points` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |
| `season` | integer | no |  |
| `situation` | text | no | 'all'::text |
| `created_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |
| `updated_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |

## `public.nst_team_stats_ly`

Type: table

Primary key: `team_abbreviation`, `season`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | no |  |
| `team_name` | text | no |  |
| `gp` | integer | yes |  |
| `toi` | bigint | yes |  |
| `w` | integer | yes |  |
| `l` | integer | yes |  |
| `otl` | integer | yes |  |
| `points` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | integer | yes |  |
| `hdsa` | integer | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |
| `season` | integer | no |  |
| `situation` | text | no | 'all'::text |
| `created_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |
| `updated_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |

## `public.powerPlayCombinations`

Type: table

Primary key: `gameId`, `playerId`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `gameId` | bigint | no |  |
| `playerId` | bigint | no |  |
| `unit` | smallint | no | '1'::smallint |
| `percentageOfPP` | numeric | no | '0'::numeric |
| `PPTOI` | integer | no | 0 |
| `created_at` | timestamp with time zone | no | now() |
| `pp_unit_usage_index` | double precision | yes |  |
| `pp_unit_relative_toi` | integer | yes |  |
| `pp_vs_unit_avg` | double precision | yes |  |
| `pp_share_of_team` | double precision | yes |  |

## `public.raw_standings_sos`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('raw_standings_sos_id_seq'::regclass) |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `team_id` | integer | no |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `point_pctg` | double precision | yes |  |
| `points` | integer | yes |  |
| `wins` | integer | yes |  |

## `public.sos_games`

Type: table

Primary key: `season_id`, `game_date`, `team_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `season_id` | integer | no |  |
| `game_date` | date | no |  |
| `team_id` | integer | no |  |
| `team_name` | character varying | yes |  |
| `team_abbrev` | character varying | yes |  |
| `team_wins` | integer | yes |  |
| `team_losses` | integer | yes |  |
| `team_ot_losses` | integer | yes |  |
| `team_points` | integer | yes |  |
| `team_point_pct` | numeric | yes |  |
| `team_win_pct` | numeric | yes |  |
| `team_games_played` | integer | yes |  |
| `past_opponents` | jsonb | yes |  |
| `future_opponents` | jsonb | yes |  |
| `past_opponent_total_wins` | integer | yes | 0 |
| `past_opponent_total_losses` | integer | yes | 0 |
| `past_opponent_total_ot_losses` | integer | yes | 0 |
| `future_opponent_total_wins` | integer | yes | 0 |
| `future_opponent_total_losses` | integer | yes | 0 |
| `future_opponent_total_ot_losses` | integer | yes | 0 |

## `public.sos_standings`

Type: table

Primary key: `season_id`, `game_date`, `team_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `season_id` | integer | no |  |
| `game_date` | date | no |  |
| `team_id` | integer | no |  |
| `team_name` | character varying | yes |  |
| `team_abbrev` | character varying | yes |  |
| `team_wins` | integer | yes |  |
| `team_losses` | integer | yes |  |
| `team_ot_losses` | integer | yes |  |
| `team_points` | integer | yes |  |
| `team_point_pct` | numeric | yes |  |
| `team_win_pct` | numeric | yes |  |
| `team_games_played` | integer | yes |  |
| `past_opponents` | jsonb | yes |  |
| `future_opponents` | jsonb | yes |  |
| `past_opponent_total_wins` | integer | yes | 0 |
| `past_opponent_total_losses` | integer | yes | 0 |
| `past_opponent_total_ot_losses` | integer | yes | 0 |
| `future_opponent_total_wins` | integer | yes | 0 |
| `future_opponent_total_losses` | integer | yes | 0 |
| `future_opponent_total_ot_losses` | integer | yes | 0 |

## `public.standings`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('standings_id_seq'::regclass) |
| `season_id` | integer | no |  |
| `date` | date | no |  |
| `team_id` | integer | no |  |
| `games_played` | integer | yes |  |
| `game_type_id` | integer | yes |  |
| `goal_differential` | integer | yes |  |
| `goal_differential_pctg` | double precision | yes |  |
| `goal_against` | integer | yes |  |
| `goal_for` | integer | yes |  |
| `goals_for_pctg` | double precision | yes |  |
| `home_games_played` | integer | yes |  |
| `home_goals_against` | integer | yes |  |
| `home_goals_for` | integer | yes |  |
| `home_losses` | integer | yes |  |
| `home_ot_losses` | integer | yes |  |
| `home_points` | integer | yes |  |
| `home_regulation_plus_ot_wins` | integer | yes |  |
| `home_regulation_wins` | integer | yes |  |
| `home_wins` | integer | yes |  |
| `l10_games_played` | integer | yes |  |
| `l10_goal_differential` | integer | yes |  |
| `l10_goals_against` | integer | yes |  |
| `l10_goals_for` | integer | yes |  |
| `l10_losses` | integer | yes |  |
| `l10_ot_losses` | integer | yes |  |
| `l10_points` | integer | yes |  |
| `l10_regulation_plus_ot_wins` | integer | yes |  |
| `l10_regulation_wins` | integer | yes |  |
| `l10_wins` | integer | yes |  |
| `league_home_sequence` | integer | yes |  |
| `league_l10_sequence` | integer | yes |  |
| `league_road_sequence` | integer | yes |  |
| `league_sequence` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `point_pctg` | double precision | yes |  |
| `points` | integer | yes |  |
| `regulation_plus_ot_win_pctg` | double precision | yes |  |
| `regulation_plus_ot_wins` | integer | yes |  |
| `regulation_win_pctg` | double precision | yes |  |
| `regulation_wins` | integer | yes |  |
| `road_games_played` | integer | yes |  |
| `road_goal_differential` | integer | yes |  |
| `road_goals_against` | integer | yes |  |
| `road_goals_for` | integer | yes |  |
| `road_losses` | integer | yes |  |
| `road_ot_losses` | integer | yes |  |
| `road_points` | integer | yes |  |
| `road_regulation_plus_ot_wins` | integer | yes |  |
| `road_regulation_wins` | integer | yes |  |
| `road_wins` | integer | yes |  |
| `shootout_losses` | integer | yes |  |
| `shootout_wins` | integer | yes |  |
| `streak_code` | character varying | yes |  |
| `streak_count` | integer | yes |  |
| `team_name_default` | character varying | yes |  |
| `team_common_name_default` | character varying | yes |  |
| `team_abbrev_default` | character varying | yes |  |
| `ties` | integer | yes |  |
| `win_pctg` | double precision | yes |  |
| `wins` | integer | yes |  |

## `public.teamGameStats`

Type: table

Primary key: `gameId`, `teamId`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `gameId` | bigint | no |  |
| `teamId` | smallint | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `score` | smallint | no | '0'::smallint |
| `sog` | smallint | no | '0'::smallint |
| `faceoffPctg` | real | no | '0'::real |
| `pim` | smallint | no | '0'::smallint |
| `powerPlayConversion` | text | no | '0/0'::text |
| `hits` | smallint | no | '0'::smallint |
| `blockedShots` | smallint | no | '0'::smallint |
| `giveaways` | smallint | no | '0'::smallint |
| `takeaways` | smallint | no | '0'::smallint |
| `powerPlay` | text | no | '0/0'::text |
| `powerPlayToi` | text | no | '00:00'::text |

## `public.team_abbrev_xwalk`

Type: table

Primary key: `season_id`, `team_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `season_id` | bigint | no |  |
| `team_id` | smallint | no |  |
| `nst_abbrev` | text | no |  |

## `public.team_ctpi_daily`

Type: table

Primary key: `season_id`, `team`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `season_id` | integer | no |  |
| `team` | text | no |  |
| `date` | date | no |  |
| `computed_at` | timestamp with time zone | no | now() |
| `ctpi_raw` | double precision | no |  |
| `ctpi_0_to_100` | double precision | no |  |
| `offense` | double precision | no |  |
| `defense` | double precision | no |  |
| `goaltending` | double precision | no |  |
| `special_teams` | double precision | no |  |
| `luck` | double precision | no |  |
| `payload` | jsonb | no |  |

## `public.team_discipline_stats`

Type: table

Primary key: `team_id`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_id` | integer | no |  |
| `date` | date | no |  |
| `season_id` | integer | no |  |
| `times_shorthanded_per_60` | numeric | yes |  |
| `times_powerplay_per_60` | numeric | yes |  |
| `penalties_taken_per_60` | numeric | yes |  |
| `penalties_drawn_per_60` | numeric | yes |  |
| `toi_shorthanded_per_game` | numeric | yes |  |
| `hits_taken_per_60` | numeric | yes |  |
| `shots_blocked_by_opponent_per_60` | numeric | yes |  |
| `created_at` | timestamp with time zone | yes | now() |
| `updated_at` | timestamp with time zone | yes | now() |

## `public.team_franchise_alias`

Type: table

Primary key: `franchise_key`, `abbrev`, `season_start`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `franchise_key` | text | no |  |
| `abbrev` | text | no |  |
| `season_start` | integer | no |  |
| `season_end` | integer | no |  |
| `nhl_team_id` | integer | yes |  |

## `public.team_games`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | yes |  |
| `date` | date | yes |  |
| `team_id` | smallint | yes |  |
| `opponent_team_id` | smallint | yes |  |
| `is_home` | boolean | yes |  |

## `public.team_power_ratings_daily`

Type: table

Primary key: `team_abbreviation`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | no |  |
| `date` | date | no |  |
| `off_rating` | numeric | yes |  |
| `def_rating` | numeric | yes |  |
| `pace_rating` | numeric | yes |  |
| `xgf60` | numeric | yes |  |
| `gf60` | numeric | yes |  |
| `sf60` | numeric | yes |  |
| `xga60` | numeric | yes |  |
| `ga60` | numeric | yes |  |
| `sa60` | numeric | yes |  |
| `pace60` | numeric | yes |  |
| `trend10` | numeric | yes |  |
| `pp_tier` | integer | yes |  |
| `pk_tier` | integer | yes |  |
| `finishing_rating` | numeric | yes |  |
| `goalie_rating` | numeric | yes |  |
| `danger_rating` | numeric | yes |  |
| `special_rating` | numeric | yes |  |
| `discipline_rating` | numeric | yes |  |
| `variance_flag` | integer | yes |  |
| `created_at` | timestamp with time zone | yes | now() |

## `public.team_power_ratings_daily__new`

Type: table

Primary key: `team_abbreviation`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | no |  |
| `date` | date | no |  |
| `off_rating` | numeric | yes |  |
| `def_rating` | numeric | yes |  |
| `pace_rating` | numeric | yes |  |
| `xgf60` | numeric | yes |  |
| `gf60` | numeric | yes |  |
| `sf60` | numeric | yes |  |
| `xga60` | numeric | yes |  |
| `ga60` | numeric | yes |  |
| `sa60` | numeric | yes |  |
| `pace60` | numeric | yes |  |
| `trend10` | numeric | yes |  |
| `pp_tier` | integer | yes |  |
| `pk_tier` | integer | yes |  |
| `finishing_rating` | numeric | yes |  |
| `goalie_rating` | numeric | yes |  |
| `danger_rating` | numeric | yes |  |
| `special_rating` | numeric | yes |  |
| `discipline_rating` | numeric | yes |  |
| `variance_flag` | integer | yes |  |
| `created_at` | timestamp with time zone | yes | now() |

## `public.team_season`

Type: table

Primary key: `teamId`, `seasonId`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `teamId` | smallint | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `seasonId` | bigint | no |  |

## `public.team_summary_years`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('team_summary_years_id_seq'::regclass) |
| `season_id` | integer | no |  |
| `team_id` | integer | no |  |
| `team_full_name` | text | no |  |
| `games_played` | integer | yes |  |
| `wins` | integer | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `points` | integer | yes |  |
| `goals_for` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `goals_for_per_game` | double precision | yes |  |
| `goals_against_per_game` | double precision | yes |  |
| `shots_for_per_game` | double precision | yes |  |
| `shots_against_per_game` | double precision | yes |  |
| `faceoff_win_pct` | double precision | yes |  |
| `penalty_kill_pct` | double precision | yes |  |
| `penalty_kill_net_pct` | double precision | yes |  |
| `power_play_pct` | double precision | yes |  |
| `power_play_net_pct` | double precision | yes |  |
| `regulation_and_ot_wins` | integer | yes |  |
| `point_pct` | double precision | yes |  |
| `updated_at` | timestamp with time zone | no | now() |

## `public.team_underlying_stats_summary`

Type: table

Primary key: `game_id`, `team_id`, `strength`, `score_state`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | no |  |
| `season_id` | integer | no |  |
| `game_type` | integer | no |  |
| `game_date` | date | no |  |
| `team_id` | integer | no |  |
| `opponent_team_id` | integer | no |  |
| `venue` | text | no |  |
| `is_home` | boolean | no |  |
| `strength` | text | no |  |
| `score_state` | text | no |  |
| `toi_seconds` | integer | no | 0 |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `wins` | integer | no | 0 |
| `losses` | integer | no | 0 |
| `otl` | integer | no | 0 |
| `row_wins` | integer | no | 0 |
| `points` | integer | no | 0 |
| `cf` | integer | no | 0 |
| `ca` | integer | no | 0 |
| `ff` | integer | no | 0 |
| `fa` | integer | no | 0 |
| `sf` | integer | no | 0 |
| `sa` | integer | no | 0 |
| `gf` | integer | no | 0 |
| `ga` | integer | no | 0 |
| `xgf` | double precision | no | 0 |
| `xga` | double precision | no | 0 |
| `scf` | integer | no | 0 |
| `sca` | integer | no | 0 |
| `scsf` | integer | no | 0 |
| `scsa` | integer | no | 0 |
| `scgf` | integer | no | 0 |
| `scga` | integer | no | 0 |
| `hdcf` | integer | no | 0 |
| `hdca` | integer | no | 0 |
| `hdsf` | integer | no | 0 |
| `hdsa` | integer | no | 0 |
| `hdgf` | integer | no | 0 |
| `hdga` | integer | no | 0 |
| `mdcf` | integer | no | 0 |
| `mdca` | integer | no | 0 |
| `mdsf` | integer | no | 0 |
| `mdsa` | integer | no | 0 |
| `mdgf` | integer | no | 0 |
| `mdga` | integer | no | 0 |
| `ldcf` | integer | no | 0 |
| `ldca` | integer | no | 0 |
| `ldsf` | integer | no | 0 |
| `ldsa` | integer | no | 0 |
| `ldgf` | integer | no | 0 |
| `ldga` | integer | no | 0 |

## `public.teams`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | smallint | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `name` | text | no |  |
| `abbreviation` | character | no |  |

## `public.teamsinfo`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('teamsinfo_id_seq'::regclass) |
| `name` | text | no |  |
| `abbreviation` | text | no |  |
| `short_name` | text | no |  |
| `location` | text | yes |  |
| `primary_color` | text | no |  |
| `secondary_color` | text | no |  |
| `jersey_color` | text | no |  |
| `accent_color` | text | no |  |
| `alt_color` | text | yes |  |
| `franchise_id` | integer | no |  |
| `nst_abbr` | text | yes |  |
| `light_color` | text | yes |  |
| `dark_color` | text | yes |  |

## `public.user_saved_teams`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `name` | text | no |  |
| `source_type` | text | no | 'manual'::text |
| `provider` | text | yes |  |
| `external_team_key` | text | yes |  |
| `external_league_key` | text | yes |  |
| `roster_json` | jsonb | no | '{}'::jsonb |
| `settings_snapshot` | jsonb | no | '{}'::jsonb |
| `is_default` | boolean | no | false |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.vw_active_teams`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_id` | smallint | yes |  |
| `app_abbrev` | character | yes |  |
| `season_id` | bigint | yes |  |

## `public.vw_pp_unit_share_recent`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `team_abbrev` | character | yes |  |
| `p_pp1` | numeric | yes |  |
| `pp_share_recent` | double precision | yes |  |
| `pp_toi60_recent` | double precision | yes |  |
| `pct_share_avg` | double precision | yes |  |

## `public.vw_team_abbrev_norm`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `franchise_key` | text | yes |  |
| `abbrev` | text | yes |  |
| `season_start` | integer | yes |  |
| `season_end` | integer | yes |  |

## `public.vw_team_stats_nst_wgo`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_id` | integer | yes |  |
| `team_abbreviation` | text | yes |  |
| `date` | date | yes |  |
| `row_id` | text | yes |  |
| `nst_team_abbreviation` | text | yes |  |
| `nst_team_name` | text | yes |  |
| `nst_gp` | integer | yes |  |
| `nst_toi` | integer | yes |  |
| `nst_w` | integer | yes |  |
| `nst_l` | integer | yes |  |
| `nst_otl` | integer | yes |  |
| `nst_points` | integer | yes |  |
| `nst_cf` | integer | yes |  |
| `nst_ca` | integer | yes |  |
| `nst_cf_pct` | double precision | yes |  |
| `nst_ff` | integer | yes |  |
| `nst_fa` | integer | yes |  |
| `nst_ff_pct` | double precision | yes |  |
| `nst_sf` | integer | yes |  |
| `nst_sa` | integer | yes |  |
| `nst_sf_pct` | double precision | yes |  |
| `nst_gf` | integer | yes |  |
| `nst_ga` | integer | yes |  |
| `nst_gf_pct` | double precision | yes |  |
| `nst_xgf` | double precision | yes |  |
| `nst_xga` | double precision | yes |  |
| `nst_xgf_pct` | double precision | yes |  |
| `nst_scf` | integer | yes |  |
| `nst_sca` | integer | yes |  |
| `nst_scf_pct` | double precision | yes |  |
| `nst_hdcf` | integer | yes |  |
| `nst_hdca` | integer | yes |  |
| `nst_hdcf_pct` | double precision | yes |  |
| `nst_hdsf` | integer | yes |  |
| `nst_hdsa` | integer | yes |  |
| `nst_hdsf_pct` | double precision | yes |  |
| `nst_hdgf` | integer | yes |  |
| `nst_hdga` | integer | yes |  |
| `nst_hdgf_pct` | double precision | yes |  |
| `nst_sh_pct` | double precision | yes |  |
| `nst_sv_pct` | double precision | yes |  |
| `nst_pdo` | numeric | yes |  |
| `nst_date` | date | yes |  |
| `nst_situation` | text | yes |  |
| `nst_created_at` | timestamp without time zone | yes |  |
| `nst_updated_at` | timestamp without time zone | yes |  |
| `wgo_id` | integer | yes |  |
| `wgo_team_id` | integer | yes |  |
| `wgo_franchise_name` | text | yes |  |
| `wgo_date` | date | yes |  |
| `wgo_games_played` | integer | yes |  |
| `wgo_goals_against` | integer | yes |  |
| `wgo_goals_against_per_game` | double precision | yes |  |
| `wgo_goals_for` | integer | yes |  |
| `wgo_goals_for_per_game` | double precision | yes |  |
| `wgo_losses` | integer | yes |  |
| `wgo_ot_losses` | integer | yes |  |
| `wgo_penalty_kill_net_pct` | double precision | yes |  |
| `wgo_penalty_kill_pct` | double precision | yes |  |
| `wgo_point_pct` | double precision | yes |  |
| `wgo_points` | integer | yes |  |
| `wgo_power_play_net_pct` | double precision | yes |  |
| `wgo_power_play_pct` | double precision | yes |  |
| `wgo_regulation_and_ot_wins` | integer | yes |  |
| `wgo_shots_against_per_game` | double precision | yes |  |
| `wgo_shots_for_per_game` | double precision | yes |  |
| `wgo_wins` | integer | yes |  |
| `wgo_wins_in_regulation` | integer | yes |  |
| `wgo_wins_in_shootout` | integer | yes |  |
| `wgo_faceoff_win_pct` | double precision | yes |  |
| `wgo_blocked_shots` | integer | yes |  |
| `wgo_blocked_shots_per_60` | double precision | yes |  |
| `wgo_empty_net_goals` | integer | yes |  |
| `wgo_giveaways` | integer | yes |  |
| `wgo_giveaways_per_60` | double precision | yes |  |
| `wgo_hits` | integer | yes |  |
| `wgo_hits_per_60` | double precision | yes |  |
| `wgo_missed_shots` | integer | yes |  |
| `wgo_sat_pct` | double precision | yes |  |
| `wgo_takeaways` | integer | yes |  |
| `wgo_takeaways_per_60` | double precision | yes |  |
| `wgo_time_on_ice_per_game_5v5` | double precision | yes |  |
| `wgo_bench_minor_penalties` | integer | yes |  |
| `wgo_game_misconducts` | integer | yes |  |
| `wgo_major_penalties` | integer | yes |  |
| `wgo_match_penalties` | integer | yes |  |
| `wgo_minor_penalties` | integer | yes |  |
| `wgo_misconduct_penalties` | integer | yes |  |
| `wgo_net_penalties` | integer | yes |  |
| `wgo_net_penalties_per_60` | double precision | yes |  |
| `wgo_penalties` | integer | yes |  |
| `wgo_penalties_drawn_per_60` | double precision | yes |  |
| `wgo_penalties_taken_per_60` | double precision | yes |  |
| `wgo_penalty_minutes` | integer | yes |  |
| `wgo_penalty_seconds_per_game` | double precision | yes |  |
| `wgo_total_penalties_drawn` | integer | yes |  |
| `wgo_pk_net_goals` | integer | yes |  |
| `wgo_pk_net_goals_per_game` | double precision | yes |  |
| `wgo_pp_goals_against` | integer | yes |  |
| `wgo_pp_goals_against_per_game` | double precision | yes |  |
| `wgo_sh_goals_for` | integer | yes |  |
| `wgo_sh_goals_for_per_game` | double precision | yes |  |
| `wgo_times_shorthanded` | integer | yes |  |
| `wgo_times_shorthanded_per_game` | double precision | yes |  |
| `wgo_power_play_goals_for` | integer | yes |  |
| `wgo_pp_goals_per_game` | double precision | yes |  |
| `wgo_pp_net_goals` | integer | yes |  |
| `wgo_pp_net_goals_per_game` | double precision | yes |  |
| `wgo_pp_opportunities` | integer | yes |  |
| `wgo_pp_opportunities_per_game` | double precision | yes |  |
| `wgo_pp_time_on_ice_per_game` | double precision | yes |  |
| `wgo_sh_goals_against` | integer | yes |  |
| `wgo_sh_goals_against_per_game` | double precision | yes |  |
| `wgo_goals_4v3` | integer | yes |  |
| `wgo_goals_5v3` | integer | yes |  |
| `wgo_goals_5v4` | integer | yes |  |
| `wgo_opportunities_4v3` | integer | yes |  |
| `wgo_opportunities_5v3` | integer | yes |  |
| `wgo_opportunities_5v4` | integer | yes |  |
| `wgo_overall_power_play_pct` | double precision | yes |  |
| `wgo_pp_pct_4v3` | double precision | yes |  |
| `wgo_pp_pct_5v3` | double precision | yes |  |
| `wgo_pp_pct_5v4` | double precision | yes |  |
| `wgo_toi_4v3` | double precision | yes |  |
| `wgo_toi_5v3` | double precision | yes |  |
| `wgo_toi_5v4` | double precision | yes |  |
| `wgo_toi_pp` | double precision | yes |  |
| `wgo_goals_against_3v4` | integer | yes |  |
| `wgo_goals_against_3v5` | integer | yes |  |
| `wgo_goals_against_4v5` | integer | yes |  |
| `wgo_overall_penalty_kill_pct` | double precision | yes |  |
| `wgo_pk_3v4_pct` | double precision | yes |  |
| `wgo_pk_3v5_pct` | double precision | yes |  |
| `wgo_pk_4v5_pct` | double precision | yes |  |
| `wgo_toi_3v4` | double precision | yes |  |
| `wgo_toi_3v5` | double precision | yes |  |
| `wgo_toi_4v5` | double precision | yes |  |
| `wgo_toi_shorthanded` | double precision | yes |  |
| `wgo_times_shorthanded_3v4` | integer | yes |  |
| `wgo_times_shorthanded_3v5` | integer | yes |  |
| `wgo_times_shorthanded_4v5` | integer | yes |  |
| `wgo_sat_against` | integer | yes |  |
| `wgo_sat_behind` | integer | yes |  |
| `wgo_sat_close` | integer | yes |  |
| `wgo_sat_for` | integer | yes |  |
| `wgo_sat_tied` | integer | yes |  |
| `wgo_sat_total` | integer | yes |  |
| `wgo_shots_5v5` | integer | yes |  |
| `wgo_usat_against` | integer | yes |  |
| `wgo_usat_ahead` | integer | yes |  |
| `wgo_usat_behind` | integer | yes |  |
| `wgo_usat_close` | integer | yes |  |
| `wgo_usat_for` | integer | yes |  |
| `wgo_usat_tied` | integer | yes |  |
| `wgo_usat_total` | integer | yes |  |
| `wgo_goals_for_percentage` | double precision | yes |  |
| `wgo_sat_percentage` | double precision | yes |  |
| `wgo_sat_pct_ahead` | double precision | yes |  |
| `wgo_sat_pct_behind` | double precision | yes |  |
| `wgo_sat_pct_close` | double precision | yes |  |
| `wgo_sat_pct_tied` | double precision | yes |  |
| `wgo_save_pct_5v5` | double precision | yes |  |
| `wgo_shooting_pct_5v5` | double precision | yes |  |
| `wgo_shooting_plus_save_pct_5v5` | double precision | yes |  |
| `wgo_usat_pct` | double precision | yes |  |
| `wgo_usat_pct_ahead` | double precision | yes |  |
| `wgo_usat_pct_behind` | double precision | yes |  |
| `wgo_usat_pct_close` | double precision | yes |  |
| `wgo_usat_pct_tied` | double precision | yes |  |
| `wgo_zone_start_pct_5v5` | double precision | yes |  |
| `wgo_d_zone_faceoff_pct` | double precision | yes |  |
| `wgo_d_zone_faceoffs` | integer | yes |  |
| `wgo_ev_faceoff_pct` | double precision | yes |  |
| `wgo_ev_faceoffs` | integer | yes |  |
| `wgo_neutral_zone_faceoff_pct` | double precision | yes |  |
| `wgo_neutral_zone_faceoffs` | integer | yes |  |
| `wgo_o_zone_faceoff_pct` | double precision | yes |  |
| `wgo_o_zone_faceoffs` | integer | yes |  |
| `wgo_pp_faceoff_pct` | double precision | yes |  |
| `wgo_pp_faceoffs` | integer | yes |  |
| `wgo_sh_faceoff_pct` | double precision | yes |  |
| `wgo_sh_faceoffs` | integer | yes |  |
| `wgo_total_faceoffs` | integer | yes |  |
| `wgo_d_zone_fol` | integer | yes |  |
| `wgo_d_zone_fow` | integer | yes |  |
| `wgo_d_zone_fo` | integer | yes |  |
| `wgo_ev_fo` | integer | yes |  |
| `wgo_ev_fol` | integer | yes |  |
| `wgo_ev_fow` | integer | yes |  |
| `wgo_faceoffs_lost` | integer | yes |  |
| `wgo_faceoffs_won` | integer | yes |  |
| `wgo_neutral_zone_fol` | integer | yes |  |
| `wgo_neutral_zone_fow` | integer | yes |  |
| `wgo_neutral_zone_fo` | integer | yes |  |
| `wgo_o_zone_fol` | integer | yes |  |
| `wgo_o_zone_fow` | integer | yes |  |
| `wgo_o_zone_fo` | integer | yes |  |
| `wgo_pp_fol` | integer | yes |  |
| `wgo_pp_fow` | integer | yes |  |
| `wgo_sh_fol` | integer | yes |  |
| `wgo_sh_fow` | integer | yes |  |
| `wgo_season_id` | integer | yes |  |
| `wgo_game_id` | bigint | yes |  |
| `wgo_opponent_id` | integer | yes |  |

## `public.vw_team_strength_state_daily`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbrev` | text | yes |  |
| `date` | date | yes |  |
| `state` | text | yes |  |
| `xgf60` | double precision | yes |  |
| `xga60` | double precision | yes |  |
| `cf60` | double precision | yes |  |
| `ca60` | double precision | yes |  |
| `scf60` | double precision | yes |  |
| `sca60` | double precision | yes |  |
| `hdcf60` | double precision | yes |  |
| `hdca60` | double precision | yes |  |
| `sf60` | double precision | yes |  |
| `sa60` | double precision | yes |  |

## `public.vw_team_strength_state_daily_norm`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `date` | date | yes |  |
| `team_id` | smallint | yes |  |
| `nst_abbrev` | text | yes |  |
| `state` | text | yes |  |
| `xgf60` | double precision | yes |  |
| `xga60` | double precision | yes |  |
| `cf60` | double precision | yes |  |
| `ca60` | double precision | yes |  |
| `scf60` | double precision | yes |  |
| `sca60` | double precision | yes |  |
| `hdcf60` | double precision | yes |  |
| `hdca60` | double precision | yes |  |
| `sf60` | double precision | yes |  |
| `sa60` | double precision | yes |  |

## `public.wgo_team_stats`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('wgo_team_stats_id_seq'::regclass) |
| `team_id` | integer | yes |  |
| `franchise_name` | text | no |  |
| `date` | date | no |  |
| `games_played` | integer | yes |  |
| `goals_against` | integer | yes |  |
| `goals_against_per_game` | double precision | yes |  |
| `goals_for` | integer | yes |  |
| `goals_for_per_game` | double precision | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `penalty_kill_net_pct` | double precision | yes |  |
| `penalty_kill_pct` | double precision | yes |  |
| `point_pct` | double precision | yes |  |
| `points` | integer | yes |  |
| `power_play_net_pct` | double precision | yes |  |
| `power_play_pct` | double precision | yes |  |
| `regulation_and_ot_wins` | integer | yes |  |
| `shots_against_per_game` | double precision | yes |  |
| `shots_for_per_game` | double precision | yes |  |
| `wins` | integer | yes |  |
| `wins_in_regulation` | integer | yes |  |
| `wins_in_shootout` | integer | yes |  |
| `faceoff_win_pct` | double precision | yes |  |
| `blocked_shots` | integer | yes |  |
| `blocked_shots_per_60` | double precision | yes |  |
| `empty_net_goals` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `hits` | integer | yes |  |
| `hits_per_60` | double precision | yes |  |
| `missed_shots` | integer | yes |  |
| `sat_pct` | double precision | yes |  |
| `takeaways` | integer | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `time_on_ice_per_game_5v5` | double precision | yes |  |
| `bench_minor_penalties` | integer | yes |  |
| `game_misconducts` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `match_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `net_penalties` | integer | yes |  |
| `net_penalties_per_60` | double precision | yes |  |
| `penalties` | integer | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `penalties_taken_per_60` | double precision | yes |  |
| `penalty_minutes` | integer | yes |  |
| `penalty_seconds_per_game` | double precision | yes |  |
| `total_penalties_drawn` | integer | yes |  |
| `pk_net_goals` | integer | yes |  |
| `pk_net_goals_per_game` | double precision | yes |  |
| `pp_goals_against` | integer | yes |  |
| `pp_goals_against_per_game` | double precision | yes |  |
| `sh_goals_for` | integer | yes |  |
| `sh_goals_for_per_game` | double precision | yes |  |
| `times_shorthanded` | integer | yes |  |
| `times_shorthanded_per_game` | double precision | yes |  |
| `power_play_goals_for` | integer | yes |  |
| `pp_goals_per_game` | double precision | yes |  |
| `pp_net_goals` | integer | yes |  |
| `pp_net_goals_per_game` | double precision | yes |  |
| `pp_opportunities` | integer | yes |  |
| `pp_opportunities_per_game` | double precision | yes |  |
| `pp_time_on_ice_per_game` | double precision | yes |  |
| `sh_goals_against` | integer | yes |  |
| `sh_goals_against_per_game` | double precision | yes |  |
| `goals_4v3` | integer | yes |  |
| `goals_5v3` | integer | yes |  |
| `goals_5v4` | integer | yes |  |
| `opportunities_4v3` | integer | yes |  |
| `opportunities_5v3` | integer | yes |  |
| `opportunities_5v4` | integer | yes |  |
| `overall_power_play_pct` | double precision | yes |  |
| `pp_pct_4v3` | double precision | yes |  |
| `pp_pct_5v3` | double precision | yes |  |
| `pp_pct_5v4` | double precision | yes |  |
| `toi_4v3` | double precision | yes |  |
| `toi_5v3` | double precision | yes |  |
| `toi_5v4` | double precision | yes |  |
| `toi_pp` | double precision | yes |  |
| `goals_against_3v4` | integer | yes |  |
| `goals_against_3v5` | integer | yes |  |
| `goals_against_4v5` | integer | yes |  |
| `overall_penalty_kill_pct` | double precision | yes |  |
| `pk_3v4_pct` | double precision | yes |  |
| `pk_3v5_pct` | double precision | yes |  |
| `pk_4v5_pct` | double precision | yes |  |
| `toi_3v4` | double precision | yes |  |
| `toi_3v5` | double precision | yes |  |
| `toi_4v5` | double precision | yes |  |
| `toi_shorthanded` | double precision | yes |  |
| `times_shorthanded_3v4` | integer | yes |  |
| `times_shorthanded_3v5` | integer | yes |  |
| `times_shorthanded_4v5` | integer | yes |  |
| `sat_against` | integer | yes |  |
| `sat_behind` | integer | yes |  |
| `sat_close` | integer | yes |  |
| `sat_for` | integer | yes |  |
| `sat_tied` | integer | yes |  |
| `sat_total` | integer | yes |  |
| `shots_5v5` | integer | yes |  |
| `usat_against` | integer | yes |  |
| `usat_ahead` | integer | yes |  |
| `usat_behind` | integer | yes |  |
| `usat_close` | integer | yes |  |
| `usat_for` | integer | yes |  |
| `usat_tied` | integer | yes |  |
| `usat_total` | integer | yes |  |
| `goals_for_percentage` | double precision | yes |  |
| `sat_percentage` | double precision | yes |  |
| `sat_pct_ahead` | double precision | yes |  |
| `sat_pct_behind` | double precision | yes |  |
| `sat_pct_close` | double precision | yes |  |
| `sat_pct_tied` | double precision | yes |  |
| `save_pct_5v5` | double precision | yes |  |
| `shooting_pct_5v5` | double precision | yes |  |
| `shooting_plus_save_pct_5v5` | double precision | yes |  |
| `usat_pct` | double precision | yes |  |
| `usat_pct_ahead` | double precision | yes |  |
| `usat_pct_behind` | double precision | yes |  |
| `usat_pct_close` | double precision | yes |  |
| `usat_pct_tied` | double precision | yes |  |
| `zone_start_pct_5v5` | double precision | yes |  |
| `d_zone_faceoff_pct` | double precision | yes |  |
| `d_zone_faceoffs` | integer | yes |  |
| `ev_faceoff_pct` | double precision | yes |  |
| `ev_faceoffs` | integer | yes |  |
| `neutral_zone_faceoff_pct` | double precision | yes |  |
| `neutral_zone_faceoffs` | integer | yes |  |
| `o_zone_faceoff_pct` | double precision | yes |  |
| `o_zone_faceoffs` | integer | yes |  |
| `pp_faceoff_pct` | double precision | yes |  |
| `pp_faceoffs` | integer | yes |  |
| `sh_faceoff_pct` | double precision | yes |  |
| `sh_faceoffs` | integer | yes |  |
| `total_faceoffs` | integer | yes |  |
| `d_zone_fol` | integer | yes |  |
| `d_zone_fow` | integer | yes |  |
| `d_zone_fo` | integer | yes |  |
| `ev_fo` | integer | yes |  |
| `ev_fol` | integer | yes |  |
| `ev_fow` | integer | yes |  |
| `faceoffs_lost` | integer | yes |  |
| `faceoffs_won` | integer | yes |  |
| `neutral_zone_fol` | integer | yes |  |
| `neutral_zone_fow` | integer | yes |  |
| `neutral_zone_fo` | integer | yes |  |
| `o_zone_fol` | integer | yes |  |
| `o_zone_fow` | integer | yes |  |
| `o_zone_fo` | integer | yes |  |
| `pp_fol` | integer | yes |  |
| `pp_fow` | integer | yes |  |
| `sh_fol` | integer | yes |  |
| `sh_fow` | integer | yes |  |
| `season_id` | integer | yes |  |
| `game_id` | bigint | yes |  |
| `opponent_id` | integer | yes |  |

## `public.wgo_teams`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('wgo_teams_id_seq'::regclass) |
| `franchise_id` | integer | no |  |
| `franchise_name` | text | no |  |
