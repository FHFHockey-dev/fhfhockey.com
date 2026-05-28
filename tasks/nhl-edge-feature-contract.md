# NHL EDGE Feature Contract

Canonical code: `web/lib/NHL/edgeFeatureContract.ts`.

Raw/provenance archive:

- `public.nhl_edge_stats_daily`

Typed model-ready daily tables:

- `public.nhl_edge_skater_metrics_daily`
- `public.nhl_edge_team_metrics_daily`
- `public.nhl_edge_goalie_metrics_daily`

Leaderboard/display table:

- `public.nhl_edge_skater_shot_location_leaders_daily`

Freshness rule for model use:

- Join typed tables as-of the prediction timestamp.
- Required filter: `snapshot_date <= as_of_date`.
- Default max snapshot age: 14 days.
- Latest views are display conveniences, not historical training joins.

Model-usable grains:

- Skater: `snapshot_date, season_id, game_type, player_id`
- Team: `snapshot_date, season_id, game_type, team_id`
- Goalie: `snapshot_date, season_id, game_type, goalie_id`

Leakage classification:

- EDGE typed tables are `pregame_safe_with_freshness`.
- Same-game or future snapshots are not pregame safe.
- Leaderboards are display/ranking support until a stable as-of top-N feature contract is needed.

First-pass skater fields:

- shot speed, skating speed, burst, distance, shot-location, and zone-time fields.

First-pass team fields:

- shot attempts over 90 mph, team speed/burst/distance fields, shot-location fields, and zone-time fields.

First-pass goalie fields:

- EDGE GAA, games above .900, goal differential per 60, goal support, point percentage, and shot-location save percentages.
