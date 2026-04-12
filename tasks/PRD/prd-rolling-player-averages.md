# Rolling Player Rolling Averages PRD

## Context
- Build a Next.js API endpoint that assembles per-game skater (and goalie when applicable) data, calculates rolling aggregates/rates for key performance metrics, and persists the per-player per-date results into a new Supabase table.
- Endpoint should mirror the Supabase connection/upsert approach used in `web/pages/api/v1/db/update-nst-goalies.ts`.
- Rolling windows start at each player's earliest available game and accumulate forward day-by-day, recomputing aggregates after every game.

## Objectives
- Define and document the exact source column for each required metric across the specified Supabase tables.
- Propose schema for the new rolling averages table, including partitioning strategy (e.g., player/date uniqueness) and metadata columns.
- Implement data fetch + transformation pipeline for skaters (goalie scope to be confirmed).
- Ensure solution scales to include NST even-strength / PP / PK variants (structures mirror the all-strength tables).

## Data Source Inventory (WIP)
- `nst_gamelog_as_counts`, `_rates`, `_counts_oi`, `_rates_oi` and their EV/PP/PK counterparts.
- `wgo_skater_stats`, `wgo_skater_stats_totals` for PP metrics and supplementary counting stats.
- `lineCombinations` and `powerPlayCombinations` for deployment context.
- Team schedule/games table for GP% denominator; confirm best source (`games`, derived views).

## Metric Mapping (Draft)
| Metric | Source Table(s) | Column(s) | Notes |
| --- | --- | --- | --- |
| Shots on goal per 60 | `nst_gamelog_as_rates` (+ `nst_gamelog_{es,pp,pk}_rates`) | `shots_per_60` | NST gamelog provides per-60 for each strength; we will aggregate across strengths as needed. |
| Individual expected goals per 60 | Same as above | `ixg_per_60` | All-strength by default; situational variants available. |
| Shooting percentage | `nst_gamelog_as_counts` (+ situational `*_counts`) | `sh_percentage` | Direct NST field; double-check definition vs. goals/shots. |
| Individual expected goals | `nst_gamelog_as_counts` | `ixg` | Raw NST ixG per game. |
| Primary points percentage | `nst_gamelog_as_counts` | `goals`, `first_assists`, `total_points` | Computed: `(goals + first_assists) / total_points` where denominator > 0. |
| Expected shooting percentage | `nst_gamelog_as_counts` | `ixg`, `shots` | Computed: `ixg / shots` (guard against zero shots). |
| IPP | `nst_gamelog_as_counts` | `ipp` | Already supplied by NST as decimal percentage. |
| Individual scoring chances for | `nst_gamelog_as_counts` | `iscfs` | Confirm NST column equals individual SCF (naming uses plural). |
| Individual high danger chances for | `nst_gamelog_as_counts` | `hdcf` | Treat NST `HDCF` column as iHDCF for rolling metrics. |
| Time on ice | `nst_gamelog_as_counts` | `toi` | Seconds; convert to minutes for rates. |
| Power play TOI | `nst_gamelog_pp_counts` | `toi` | PP-only seconds from situational table. |
| Offensive zone start percentage | `nst_gamelog_as_counts_oi` | `off_zone_start_pct` | On-ice deployment metric. |
| Power play share | `powerPlayCombinations` | `percentageOfPP` | Percent of team PP time for player in each game. |
| Line combination assignment | `lineCombinations` | `forwards`, `defensemen` arrays | Need helper to locate player within unit arrays. |
| Power play unit | `powerPlayCombinations` | `unit` | Maps player to PP1/PP2 etc. |
| On-ice shooting percentage | `nst_gamelog_as_counts_oi` | `on_ice_sh_pct` | Pair with `on_ice_sv_pct` for PDO calc. |
| PDO | `nst_gamelog_as_counts_oi` | `pdo` | Provided directly; equals on-ice SH% + SV%. |
| Corsi metrics | `nst_gamelog_as_counts_oi` | `cf`, `ca`, `cf_pct` | Use per-game counts + derived percentages. |
| Fenwick metrics | `nst_gamelog_as_counts_oi` | `ff`, `fa`, `ff_pct` | Same structure as Corsi. |
| Goals | `nst_gamelog_as_counts` | `goals` | Raw per-game totals. |
| Assists | `nst_gamelog_as_counts` | `total_assists`, `first_assists`, `second_assists` | Total + breakdown columns available. |
| Shots on goal | `nst_gamelog_as_counts` | `shots` | Raw counts. |
| Hits | `nst_gamelog_as_counts` | `hits` | — |
| Blocked shots | `nst_gamelog_as_counts` | `shots_blocked` | — |
| Power play points | `wgo_skater_stats` | `pp_points` | War-on-ice feed includes PP scoring at per-game grain. |
| Points | `nst_gamelog_as_counts` | `total_points` | Raw counts. |
| GP percentage | `nst_gamelog_as_counts`, `games` | `gp` (player) + team game count | Computed: cumulative player GP / team games through date. |

## Proposed Rolling Table (Draft)
- Table name idea: `rolling_player_game_metrics`.
- Natural key: (`player_id`, `game_date`, `strength_state`), where `strength_state` ∈ {`all`, `ev`, `pp`, `pk`}.
- Core columns:
  - `player_id` (bigint, FK → `players.id`)
  - `season` (integer)
  - `team_id` (smallint, nullable if traded on date)
  - `game_date` (date)
  - `strength_state` (text)
  - `team_games_played` (integer cumulative through `game_date` to support GP%).
  - `games_played` (integer cumulative through `game_date` for the player).
  - `toi_seconds` (integer cumulative per strength state).
  - Metric outputs include both cumulative aggregates and rolling windows (3/5/10/20 games) for each rate/count feature: `sog_per_60`, `ixg_per_60`, `shooting_pct`, `ixg`, `primary_points_pct`, `expected_sh_pct`, `ipp`, `iscf`, `ihdcf`, `oz_start_pct`, `pp_share_pct`, `on_ice_sh_pct`, `pdo`, `cf`, `ca`, `cf_pct`, `ff`, `fa`, `ff_pct`, `goals`, `assists`, `shots`, `hits`, `blocks`, `pp_points`, `points`, `gp_pct`.
  - Derived deployment metadata per game: `line_combo_slot` (1-4 for forwards, 1-3 for defense pair, null otherwise), `pp_unit` (1/2/... from `powerPlayCombinations.unit`), `pp_share_pct` (rolling + cumulative).
  - `updated_at` (timestamp with time zone default `now()`).
- Indices to add: `(player_id, game_date DESC)`, `(season, team_id, game_date)`.
- Store raw cumulative totals alongside rate/percentage windows to allow re-derivation and audit of final values.

### Rolling Window Layout
- For each metric `X`, create columns:
  - `X_total_all` (cumulative through `game_date` for current strength state).
  - `X_avg_all` or `X_rate_all` depending on metric type (per-60/percentage).
  - `X_avg_last3`, `X_avg_last5`, `X_avg_last10`, `X_avg_last20`.
  - Equivalent `total_lastN` where helpful for count-based features (e.g., goals, assists, shots).
- GP% definition: `games_played / team_games_played` computed for cumulative and each rolling window (window games played ÷ team games in the same period).

### Deployment Data Handling
- `lineCombinations`: determine player's slot by searching `forwards`, `defensemen`, or `goalies` arrays. Forwards mapped in groups of three (indices 0-2 → line 1, 3-5 → line 2, etc.); defensemen in pairs (0-1 → pair 1, 2-3 → pair 2, etc.). Store slot number and position context.
- `powerPlayCombinations`: per-game `percentageOfPP` feeds PP share and `unit` identifies PP1/PP2.

## Task Tracker
- [x] Metric source confirmation & formula notes (current focus).
- [x] Design new Supabase table schema for rolling outputs.
- [x] Define transformation flow (data fetch ordering, joins, rolling algorithm).
- [x] Implement Next.js API endpoint, leveraging shared utilities where possible.
- [ ] Add validation/logging & update cron orchestration (if required).

## Open Questions
- Determine expectations for goalie coverage in this first iteration.

## Implementation Notes (In Progress)
- Supabase upsert worker (`web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`) generates cumulative and 3/5/10/20-game rolling aggregates for all strength states (all/EV/PP/PK) and writes to `rolling_player_game_metrics` (upsert on `player_id, game_date, strength_state`).
- API entrypoint (`web/pages/api/v1/db/update-rolling-player-averages.ts`) exposes POST endpoint with optional `playerId`, `season`, `startDate`, `endDate` filters.
- Team GP% leverages cumulative counts built from `games`; window GP% uses differential counts between rolling window endpoints.
- Power-play share metrics are only retained for `strength_state` values `all` and `pp` to avoid misleading data in EV/PK rows.
- Supabase fetches now retry with exponential backoff and are processed sequentially per strength to avoid transient `fetch failed` errors; batches are upserted after each player.
- WGO per-game data supplies fallback TOI and shot-based rates when NST gamelog rows are missing; on-ice/IPP style metrics remain null until source data exists. Logging highlights missing NST coverage per player/strength.
