# Underlying Stats Landing Page SoS Final Formula (`2.5`)

Date: 2026-04-05

## Goal

Document the shipped landing-page `SoS` formula in plain language, including:

- how it is computed
- which source tables it depends on
- which parts are directly verified from source data
- which parts are implementation choices based on available inputs

## Final SoS Definition

The landing-page `Strength of Schedule` (`SoS`) score is a `100`-centered opponent-difficulty rating for games already played as of the selected snapshot date.

Higher `SoS` means:

- a team has faced a harder schedule than league average

Lower `SoS` means:

- a team has faced an easier schedule than league average

The final score is split evenly:

`SoS = 0.5 * standings_component_score + 0.5 * predictive_component_score`

## Component 1: Standings-Based Strength

The standings half is built from fresh `sos_standings` rows on the selected snapshot date.

It combines:

1. direct opponent record strength
2. opponent schedule-context strength

### 1A. Direct Opponent Record Strength

For each team:

`direct_opp_point_pct = (2 * past_opponent_total_wins + past_opponent_total_ot_losses) / (2 * (past_opponent_total_wins + past_opponent_total_losses + past_opponent_total_ot_losses))`

Plain language:

- this is the aggregate point percentage of the opponents that team has already faced

### 1B. Opponent Schedule-Context Strength

For each team:

1. read the team’s `past_opponents` list from `sos_standings`
2. count how many times each opponent appears
3. for each opponent, look up that opponent’s own `sos_standings` row on the same snapshot date
4. compute that opponent’s `direct_opp_point_pct`
5. take the weighted average of those opponent values

Plain language:

- this is an OOWP-style context term
- it asks whether the teams you faced also played difficult schedules themselves

### 1C. Standings Raw Score

`standings_raw = 0.75 * direct_opp_point_pct + 0.25 * opp_schedule_context`

Plain language:

- the standings half is mostly driven by opponents’ actual records
- a smaller share comes from second-order opponent schedule context

### 1D. Standings Normalization

`standings_component_score = 100 + 15 * z(standings_raw)`

Plain language:

- league-average schedule strength becomes `100`
- harder-than-average schedules land above `100`
- easier-than-average schedules land below `100`

## Component 2: Predictive / Context Strength

The predictive half is built from current snapshot opponent ratings in `team_power_ratings_daily`.

### 2A. Opponent Current Snapshot Power Score

For each opponent already faced:

`opponent_power_score = computeTeamPowerScore(opponent_snapshot)`

This reuses the landing page’s own team-strength model from:

- `/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.ts`

That score already reflects:

- offense
- defense
- pace
- power-play tier
- penalty-kill tier

### 2B. Predictive Raw Score

For each team:

1. read `past_opponents` from `sos_standings`
2. count how many times each opponent appears
3. look up each opponent’s `team_power_ratings_daily` row for the selected snapshot date
4. compute that opponent’s current landing-page `Power Score`
5. take the weighted average of those opponent Power Scores

Formula:

`predictive_raw = weighted_mean(opponent_power_score, weights = games_faced_vs_opponent)`

Plain language:

- this measures how strong a team’s already-played opponents look in the current landing-page model

### 2C. Predictive Normalization

`predictive_component_score = 100 + 15 * z(predictive_raw)`

Plain language:

- the predictive half uses the same `100`-centered scale as the standings half

## Final Blend

After both components are normalized:

`SoS = 0.5 * standings_component_score + 0.5 * predictive_component_score`

Plain language:

- half of `SoS` comes from opponent record quality and OOWP-style schedule context
- half comes from opponent strength in the landing page’s own current rating model

## What Is Included

Included in the shipped formula:

- opponents’ records
- OOWP-style opponent schedule context
- opponent current snapshot landing-page Power Score

## What Is Explicitly Excluded

Excluded from the shipped formula:

- home/away adjustment
- goal differential adjustment
- rest disadvantage adjustment
- home-rink-advantage adjustment
- separate goalie-only adjustment

Why:

- those inputs were either stale, not part of the landing-page source path, not sufficiently calibrated, or too likely to double count information already captured by the core model

## Why This Formula Fits The Landing Page

This formulation is defensible for the landing page because it is:

- snapshot-aligned
- explainable
- reproducible from live repo/database sources
- internally consistent with the page’s existing Power Score model

It avoids mixing:

- fresh landing-page ratings
- stale standings-detail enrichments
- unrelated projection-only context

## Verified vs Inferred

### Verified

Verified directly in code, schema, or runtime queries:

- `sos_standings` is populated through `2026-04-05`
- `team_power_ratings_daily` is populated through `2026-04-05`
- `sos_standings` contains fresh `past_opponents` lists and aggregate opponent totals
- every opponent in the standings half can be mapped to a same-date `sos_standings` row for second-order context
- `team_power_ratings_daily` contains the fields needed for landing-page `Power Score`
- the proposed standings component produces a useful normalized spread on the live `2026-04-05` snapshot
- the proposed predictive component produces a useful normalized spread on the live `2026-04-05` snapshot
- `team_games.is_home` exists and is populated
- `nhl_standings_details` contains goal differential and home/road fields but is stale through `2026-03-20`
- additive goalie/danger context was tested and did not materially improve the predictive ordering on the live snapshot

### Inferred / Implementation Choices

These are modeling decisions, not stored formulas:

- tying `SoS` to games already played as of the selected snapshot date
- using a `50 / 50` split between standings and predictive halves
- weighting the standings half internally as `75 / 25` between direct record strength and second-order context
- using current snapshot opponent strength instead of as-of-game-date opponent strength for the predictive half
- using the landing page’s `100 + 15 * z(...)` normalization style for both halves
- excluding optional context fields from the shipped formula

## Assumptions

Assumptions carried into implementation:

- the selected snapshot date should represent a current-state audit of the schedule already played, not a historical replay model
- repeated opponents should count proportionally to games faced
- the landing page benefits more from internal consistency and explainability than from adding every available context term
- stale standings enrichment should not be mixed into a fresh snapshot score

## Recommendation For Implementation

Implement `SoS` exactly as documented here:

1. compute the normalized standings component
2. compute the normalized predictive component
3. average them 50/50
4. expose the final score on the landing-page team rows

If richer context is desired later, it should be added only after:

- `nhl_standings_details` freshness is repaired
- any new adjustment is validated as materially additive rather than duplicative
