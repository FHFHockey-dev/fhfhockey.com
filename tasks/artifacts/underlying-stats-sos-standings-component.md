# Underlying Stats Landing Page SoS Standings Component (`2.2`)

Date: 2026-04-05

## Goal

Define the standings-based 50% of landing-page `SoS` using only verified available inputs, and specify exactly how that raw value will be normalized for table display.

## Chosen Source

Primary source:

- `sos_standings`

Reason:

- it is current through the landing-page snapshot date (`2026-04-05`)
- it already contains opponent aggregate record totals
- it also contains a fresh row for every opponent on the same snapshot date, which allows an OOWP-style second-order context term without relying on stale `nhl_standings_details`

Excluded as primary inputs for this component:

- `nhl_standings_details`
  - richer fields, but stale through `2026-03-20`
- `combined_sos`
  - opaque and not trustworthy enough
- `power_rankings_store`
  - legacy model and stale

## Standings Component Definition

The standings half of `SoS` will be built from two terms:

1. direct opponent record strength
2. opponent schedule-context strength

This keeps the component grounded in:

- opponents’ records
- OWP / OOWP-style context

without introducing stale or speculative sources.

## Term 1: Direct Opponent Record Strength

For each team on the selected snapshot date, compute:

`direct_opp_point_pct = (2 * past_opponent_total_wins + past_opponent_total_ot_losses) / (2 * (past_opponent_total_wins + past_opponent_total_losses + past_opponent_total_ot_losses))`

Inputs:

- `past_opponent_total_wins`
- `past_opponent_total_losses`
- `past_opponent_total_ot_losses`

Source:

- `sos_standings`

Interpretation:

- this is a weighted opponent point percentage based on the aggregate records of opponents already faced
- repeated opponents are naturally weighted more heavily because the aggregate totals reflect the played schedule

Why point percentage instead of win percentage:

- it respects NHL overtime-loss standings value
- it better matches standings strength than pure wins / games

## Term 2: Opponent Schedule-Context Strength

For each team on the selected snapshot date:

1. read `past_opponents` from `sos_standings`
2. count how many times each opponent abbreviation appears
3. for each opponent abbreviation, look up that opponent’s own `sos_standings` row on the same snapshot date
4. compute that opponent’s `direct_opp_point_pct`
5. average those opponent context values, weighted by how many times the team has faced each opponent

Formula:

`opp_schedule_context = weighted_mean(opponent_direct_opp_point_pct, weights = games_faced_vs_opponent)`

Where:

`opponent_direct_opp_point_pct = (2 * opponent_past_wins + opponent_past_ot_losses) / (2 * opponent_past_games)`

Interpretation:

- this is an OOWP-style context proxy
- it answers whether the teams you have faced also played hard schedules themselves

Why this term is included:

- the user explicitly asked for opponent schedule / OWP / OOWP-style context
- `sos_standings` is fresh enough to support this directly

Why it is not the dominant term:

- it is a second-order signal
- it is less direct than the opponents’ own records

## Combined Standings Raw Score

The standings raw score is:

`standings_raw = 0.75 * direct_opp_point_pct + 0.25 * opp_schedule_context`

Weighting rationale:

- `75%` on direct opponent record strength keeps the standings component anchored to the most direct schedule-difficulty signal
- `25%` on the OOWP-style context term adds second-order schedule quality without letting indirect context dominate

This is intentionally not a 50/50 split inside the standings half. The overall `SoS` is already split 50/50 between:

- standings strength
- predictive/context strength

Within the standings half, the direct record signal should remain primary.

## Normalization

To keep `SoS` visually consistent with the landing page’s existing metric language, normalize `standings_raw` across all 32 teams on the selected snapshot date using the same league-centered pattern used by the power-ratings model:

`standings_component_score = 100 + 15 * z(standings_raw)`

Expanded:

`standings_component_score = 100 + 15 * ((standings_raw - league_mean_standings_raw) / league_stddev_standings_raw)`

Edge case:

- if league standard deviation is `0`, the standings component score is `100`

Why this normalization was chosen:

- it matches the landing page’s existing rating scale conventions from `power-ratings.ts`
- it keeps league average at `100`
- it makes the standings half easy to blend later with the predictive half

## Live Snapshot Check

Using the proposed formula on `2026-04-05`:

- league mean raw standings score: `0.5634167409432116`
- league stddev raw standings score: `0.003602006387370872`

Sample top standings-component teams after normalization:

- `FLA 127.96`
- `TOR 124.23`
- `NYR 122.43`
- `NJD 118.89`
- `OTT 114.76`

Sample bottom standings-component teams after normalization:

- `MIN 80.76`
- `SEA 79.62`
- `CGY 79.43`
- `ANA 77.03`
- `EDM 73.21`

This confirms the raw score has enough spread to be useful once normalized.

## Verified vs Inferred

Verified:

- `sos_standings` is populated through `2026-04-05`
- `past_opponents` contains repeated opponent abbreviations with dates
- every team has a same-date `sos_standings` row that can be reused for second-order context
- the proposed raw score and normalization produce a sensible spread on the live snapshot

Inferred / implementation choice:

- the `75% / 25%` direct-vs-indirect split is a design choice, not a stored formula
- using the opponent row’s own `direct_opp_point_pct` as an OOWP-style context proxy is a derived formulation from available fresh data

## Recommendation Carried Forward

For task `2.3` and later implementation:

- use this normalized standings component as exactly one half of final `SoS`
- compute it per selected snapshot date
- keep the output on the landing page’s `100`-centered scale
