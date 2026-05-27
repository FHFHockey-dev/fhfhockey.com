# NHL Edge Tables

These tables support NHL Edge ingestion. `nhl_edge_stats_daily` is the raw prospective archive. The typed tables added in `migrations/20260522_create_nhl_edge_metric_tables.sql` expose stable metric columns for analytics and trends.

## Raw Snapshot

### `nhl_edge_stats_daily`

Stores one raw public NHL Edge payload per snapshot date, season, game type, endpoint family, endpoint variant, entity type, and entity id.

Key columns:

| Column | Purpose |
| --- | --- |
| `snapshot_date` | Date the public Edge payload was captured. |
| `season_id` | NHL season id such as `20252026`. |
| `game_type` | NHL game type, usually `2` for regular season or `3` for playoffs. |
| `entity_type` | `skater`, `team`, or `goalie`. |
| `entity_id` | NHL player or team id. |
| `endpoint_family` | Source endpoint family such as `skater-detail`, `team-detail`, `goalie-detail`, or `skater-shot-location-top-10`. |
| `endpoint_variant` | Variant for leaderboard endpoints, such as `goals`, `sog`, or `shooting-pctg`. |
| `payload` | Full raw JSON payload from NHL Edge. |
| `metadata` | Local extraction metadata. |

## Typed Skater Metrics

### `nhl_edge_skater_metrics_daily`

Derived from `skater-detail/{playerId}/{seasonId}/{gameType}` payloads.

Primary key: `(snapshot_date, season_id, game_type, player_id)`.

Metric families:

| Family | Columns |
| --- | --- |
| Identity | `player_id`, `player_name`, `team_id`, `team_abbreviation`, `position` |
| Box score | `games_played`, `goals`, `assists`, `points` |
| Shot speed | `top_shot_speed_mph`, `top_shot_speed_kph`, `top_shot_speed_percentile`, `top_shot_speed_league_avg_mph` |
| Skating speed | `max_skating_speed_mph`, `max_skating_speed_kph`, `max_skating_speed_percentile`, `max_skating_speed_league_avg_mph`, `bursts_over_20`, `bursts_over_20_percentile`, `bursts_over_20_league_avg` |
| Distance | `total_distance_miles`, `total_distance_km`, `total_distance_percentile`, `total_distance_league_avg_miles`, `max_game_distance_miles`, `max_game_distance_km`, `max_game_distance_percentile`, `max_game_distance_league_avg_miles` |
| Shot locations | `all_*`, `high_danger_*`, `mid_range_*`, `long_range_*` shots, goals, and shooting percentage |
| Zone time | `offensive_zone_*`, `offensive_zone_ev_*`, `neutral_zone_*`, `defensive_zone_*` |

## Typed Team Metrics

### `nhl_edge_team_metrics_daily`

Derived from `team-detail/{teamId}/{seasonId}/{gameType}` payloads.

Primary key: `(snapshot_date, season_id, game_type, team_id)`.

Metric families:

| Family | Columns |
| --- | --- |
| Identity | `team_id`, `team_abbreviation`, `team_name`, `conference`, `division` |
| Record | `games_played`, `wins`, `losses`, `ot_losses`, `points` |
| Shot speed | `shot_attempts_over_90`, `top_shot_speed_*` |
| Skating speed | `bursts_over_22`, `bursts_over_20`, `max_skating_speed_*` |
| Distance | `total_distance_*` |
| Shot locations | `all_*`, `high_danger_*`, `mid_range_*`, `long_range_*` shots, goals, shooting percentage, and ranks |
| Zone time | `offensive_zone_*`, `offensive_zone_ev_*`, `neutral_zone_*`, `defensive_zone_*` |

## Typed Goalie Metrics

### `nhl_edge_goalie_metrics_daily`

Derived from `goalie-detail/{goalieId}/{seasonId}/{gameType}` payloads.

Primary key: `(snapshot_date, season_id, game_type, goalie_id)`.

Metric families:

| Family | Columns |
| --- | --- |
| Identity | `goalie_id`, `goalie_name`, `team_id`, `team_abbreviation` |
| Record | `games_played`, `wins`, `losses`, `ot_losses`, `goals_against_avg`, `save_pct` |
| Edge stats | `edge_goals_against_avg_*`, `games_above_900_*`, `goal_differential_per_60_*`, `goal_support_avg_*`, `point_pct_*` |
| Save locations | `all_*`, `high_danger_*`, `mid_range_*`, `long_range_*` goals against, saves, and save percentage |

## Typed Leaderboards

### `nhl_edge_skater_shot_location_leaders_daily`

Derived from `skater-shot-location-top-10/all/{metric}/all/{seasonId}/{gameType}` payloads.

Primary key: `(snapshot_date, season_id, game_type, metric_key, rank_order, player_id)`.

Supported `metric_key` values in the current endpoint: `goals`, `sog`, `shooting-pctg`.

## Latest Views

The migration also creates:

| View | Purpose |
| --- | --- |
| `analytics.vw_nhl_edge_latest_skater_metrics` | Latest typed Edge skater row per player and game type. |
| `analytics.vw_nhl_edge_latest_team_metrics` | Latest typed Edge team row per team and game type. |
| `analytics.vw_nhl_edge_latest_goalie_metrics` | Latest typed Edge goalie row per goalie and game type. |
