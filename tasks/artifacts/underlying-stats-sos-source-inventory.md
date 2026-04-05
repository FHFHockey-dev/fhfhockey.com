# Underlying Stats Landing Page SoS Source Inventory (`2.1`)

Date: 2026-04-05

## Goal

Inventory the schedule, standings, and team-strength inputs that are actually available for a landing-page `SoS` calculation, and separate:

- verified current sources
- verified stale or empty sources
- legacy sources that exist but do not fit the current landing-page model well

## Verified Runtime Inventory

### `games`

Verified via runtime query:

- row count: `28288`
- latest row date: `2026-04-16`

Available fields:

- `date`
- `seasonId`
- `homeTeamId`
- `awayTeamId`
- `type`

Usefulness:

- good schedule backbone
- supports opponent identification
- supports past-vs-future segmentation by selected snapshot date
- does **not** include results, rest, travel, or direct home/away team-opponent rows without transformation

### `team_games`

Verified via runtime query:

- row count: `56576`
- latest row date: `2026-04-16`

Available fields:

- `date`
- `team_id`
- `opponent_team_id`
- `is_home`

Usefulness:

- more convenient than raw `games` for team-centric schedule math
- directly supports home/away tagging
- useful if the final `SoS` formula wants a home/road adjustment

### `team_power_ratings_daily`

Verified via runtime query:

- row count: `5683`
- latest row date: `2026-04-05`
- latest snapshot row count: `32`

Available fields relevant to `SoS`:

- `off_rating`
- `def_rating`
- `pace_rating`
- `xgf60`
- `xga60`
- `gf60`
- `ga60`
- `sf60`
- `sa60`
- `pace60`
- `goalie_rating`
- `danger_rating`
- `special_rating`
- `discipline_rating`
- `pp_tier`
- `pk_tier`
- `variance_flag`

Usefulness:

- strongest verified predictive/context source for the landing page
- aligned with the actual `/underlying-stats` ranking model
- suitable for opponent play-driving and quality context
- does **not** include team IDs, home/away splits, rest days, or explicit schedule-strength fields

### `nhl_standings_details`

Verified via runtime query:

- row count: `11552`
- latest row date: `2026-03-20`
- latest snapshot row count: `32`

Available fields relevant to `SoS`:

- `wins`
- `losses`
- `ot_losses`
- `points`
- `point_pctg`
- `win_pctg`
- `goal_differential`
- `goal_differential_pctg`
- `goal_for`
- `goal_against`
- `l10_wins`
- `l10_losses`
- `l10_ot_losses`
- `home_wins`
- `home_losses`
- `home_ot_losses`
- `road_wins`
- `road_losses`
- `road_ot_losses`

Usefulness:

- very good standings/detail schema on paper
- includes the best verified record-based and split-based fields
- **current freshness is not sufficient** for the landing page as of this audit

Freshness problem:

- landing-page ratings snapshot is current through `2026-04-05`
- `nhl_standings_details` is only current through `2026-03-20`
- that is a `16`-day lag

Conclusion:

- useful as a field inventory reference
- not safe as the sole live standings source for snapshot-aligned `SoS` on `2026-04-05`

### `sos_standings`

Verified via runtime query:

- row count: `11936`
- latest row date: `2026-04-05`
- latest snapshot row count: `32`

Available fields relevant to `SoS`:

- `team_point_pct`
- `team_win_pct`
- `team_wins`
- `team_losses`
- `team_ot_losses`
- `past_opponent_total_wins`
- `past_opponent_total_losses`
- `past_opponent_total_ot_losses`
- `future_opponent_total_wins`
- `future_opponent_total_losses`
- `future_opponent_total_ot_losses`
- `past_opponents` JSON
- `future_opponents` JSON

Verified sample:

- `COL` on `2026-04-05` has a populated `past_opponents` list and populated `future_opponents` list through `2026-04-16`

Usefulness:

- best verified standings-style source that is fresh enough for the landing page right now
- supports opponent-record aggregation directly
- supports OWP-style past-schedule strength without recomputing every opponent chain from scratch
- supports future schedule context if needed later

Limitations:

- no explicit OOWP field
- no direct goal differential field
- no direct home/away split field
- opponent lists are abbreviation/date JSON, so richer joins require extra work

### `sos_games`

Verified via runtime query:

- row count: `0`

Conclusion:

- not usable for the landing-page `SoS` implementation in its current state

## Legacy or Weak-Fit Existing SoS Sources

### `combined_sos`

Verified via runtime query:

- row count: `62`
- sample row includes legacy club `QUE`
- sample `COL` row shows `past_sos: 0.65`, `future_sos: 0`

Concerns:

- row count exceeds the current 32-team league footprint
- includes legacy franchises
- exposes only opaque `past_sos` / `future_sos` outputs
- `future_sos` was `0` for `COL` despite `sos_standings` showing non-empty future opponents on `2026-04-05`

Conclusion:

- not trustworthy enough for the new landing-page `SoS`

### `power_rankings_store`

Verified via runtime query:

- latest sampled date: `2025-06-24`
- contains `l_ten_pts_pct`, `sos_past`, `sos_future`, and aggregate opponent record strings

Concerns:

- stale relative to the current landing snapshot date
- belongs to the older `power_rankings` ecosystem, not the current `/underlying-stats` model

Conclusion:

- should not be the primary SoS source for the landing page

### `power_rankings`

Verified via runtime query:

- row count: `32`
- exposes only `team_id`, `team_name`, `abbreviation`, and `power_score`

Conclusion:

- current and populated, but model-aligned to legacy power-rankings pages rather than the landing page’s current `computeTeamPowerScore()` path
- not the preferred predictive source for `/underlying-stats`

## Existing Code Paths and What They Imply

### `web/pages/statsPlaceholder.tsx`

Verified from source code:

- computes past and future SoS as simple opponent winning percentage:
  - `wins / (wins + losses + ot_losses)`
- depends on `sosStandingsPerTeam`

Conclusion:

- useful precedent for a basic standings-only SoS
- too narrow for the requested 50/50 record-plus-predictive formulation

### `web/lib/supabase/Upserts/fetchPowerRankings.js`

Verified from source code:

- contains `calculateSoSForTeam()`
- uses `games` plus `power_rankings_store.l_ten_pts_pct`
- separates past and future opponents

Conclusion:

- useful as a structural reference for opponent extraction
- not a good direct source for the landing page because it depends on the old `power_rankings_store` model

### `web/lib/supabase/Upserts/fetchSoSgameLog.js`

Verified from source code:

- populates `sos_standings`
- uses NHL standings snapshots and club schedule data

Conclusion:

- this is the clearest provenance trail for why `sos_standings` is a viable existing SoS-support table
- provenance from code is verified
- day-to-day runtime correctness of every row is inferred from that ingestion path, not fully re-audited here

## Inventory by Requested SoS Input Type

### Opponents’ records

Verified available:

- yes
- best live choice right now: `sos_standings`
- richer but stale choice: `nhl_standings_details`

### Opponent SoS / OWP / OOWP-style context

Verified available:

- partial yes
- `sos_standings` directly supports OWP-style aggregate opponent record strength
- explicit OOWP is **not** materialized in the verified current sources

### Goal differential

Verified available:

- yes in `nhl_standings_details`
- but that source is stale as of `2026-04-05`

### Underlying play-driving metrics

Verified available:

- yes in `team_power_ratings_daily`

### Home/away splits

Verified available:

- yes through `team_games.is_home`
- yes through `nhl_standings_details` home/road record fields
- no direct home/road split fields in `team_power_ratings_daily`

### Rest disadvantage

Verified available in the landing-page source set:

- no

Notes:

- rest signals do exist elsewhere in the projections pipeline
- they are not part of the verified current landing-page source path

### Home rink advantage differences

Verified available:

- partial only
- home/away game flags exist
- no standalone calibrated team-level home-rink-advantage metric was verified in the landing-page sources

### Expected goaltending quality

Verified available:

- partial yes
- `goalie_rating` exists in `team_power_ratings_daily`
- no verified schedule-specific projected starter quality field was included in this source inventory

## Recommended Source Baseline For Next Steps

Based on verified availability as of `2026-04-05`:

- standings-based `SoS` should start from `sos_standings`, not `nhl_standings_details`
- predictive/context `SoS` should start from `team_power_ratings_daily`
- opponent extraction can use `team_games` or `games`, with `team_games` being the cleaner shape if home/away tagging is needed
- `combined_sos`, `power_rankings_store`, and `power_rankings` should be treated as legacy references, not primary landing-page inputs

## Verified vs Inferred

Verified:

- runtime row counts
- latest available dates
- latest snapshot row counts
- sample field presence for `games`, `team_games`, `team_power_ratings_daily`, `nhl_standings_details`, `sos_standings`, `sos_games`, `combined_sos`, `power_rankings`, and `power_rankings_store`
- source-code existence of legacy SoS calculation paths

Inferred:

- `sos_standings` row semantics are inferred from its ingestion code in `fetchSoSgameLog.js`
- exact per-row correctness of historical `sos_standings` aggregates was not fully re-audited in this sub-task
