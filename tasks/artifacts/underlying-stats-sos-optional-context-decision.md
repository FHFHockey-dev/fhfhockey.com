# Underlying Stats Landing Page SoS Optional Context Decision (`2.4`)

Date: 2026-04-05

## Goal

Decide whether optional context inputs should be included in the shipped landing-page `SoS` formula, or explicitly excluded as unsupported / not defensible enough right now.

## Decision Summary

For the shipped landing-page `SoS` formula:

- do **not** include home/away adjustment
- do **not** include goal differential adjustment
- do **not** include rest disadvantage adjustment
- do **not** include home-rink-advantage adjustment
- do **not** include separate expected-goaltending adjustment

These inputs are either:

- stale
- not in the current landing-page source path
- insufficiently calibrated for this page
- or too likely to double count information already represented in the chosen core formula

## Input-By-Input Decision

### Home/Away

Verified available:

- yes, via `team_games.is_home`

Why it is not included now:

- a home/away flag alone is not enough to justify a calibrated difficulty adjustment
- the fresh landing-page sources do not provide a matching current home/road opponent-strength model
- the richer home/road record fields live in `nhl_standings_details`, which is stale through `2026-03-20`

Conclusion:

- supported enough to track
- not supported well enough to ship as a core `SoS` adjustment

### Goal Differential

Verified available:

- yes, in `nhl_standings_details`

Why it is not included now:

- that source is stale by `16` days relative to the landing-page snapshot date `2026-04-05`
- using it in the shipped formula would mix fresh schedule/power data with stale opponent-quality data

Conclusion:

- exclude from the shipped formula
- reconsider only after standings-details freshness is repaired

### Rest Disadvantage

Verified available in this repo:

- partial only, inside the projections pipeline / metadata layer

Why it is not included now:

- no verified landing-page source table provides historical rest context for every already-played opponent game in the selected snapshot
- borrowing rest effects from the projections system would cross models and introduce a different forecasting context into a snapshot-audit table

Conclusion:

- exclude from the shipped formula

### Home Rink Advantage Differences

Verified available:

- no standalone calibrated team-level home-rink advantage metric was verified in the landing-page source set

Why it is not included now:

- `team_games.is_home` gives game location, but not a defensible per-team home-rink-strength coefficient
- inventing a generic home bonus would be a placeholder, not a verified model

Conclusion:

- exclude from the shipped formula

### Expected Goaltending Quality

Verified available:

- partial yes, via `team_power_ratings_daily.goalie_rating`

Why it is not included now:

- the predictive half already uses opponent current snapshot Power Score, which is the landing page’s chosen opponent-strength model
- a live `2026-04-05` test of an additive context blend such as:
  - `0.8 * power + 0.1 * goalie + 0.1 * danger`
  barely changed league ordering
- promoting goalie context into the core predictive half would add complexity without a clear measured benefit
- it would also move the predictive half away from the clean “opponent strength in the current landing-page model” definition

Conclusion:

- exclude from the shipped core formula
- keep as a candidate for future secondary analysis only

## Why Exclusion Is The Defensible Choice

The requested `SoS` formula should be:

- current
- snapshot-consistent
- explainable
- reproducible from the repo’s live sources

The chosen core formula already satisfies those goals by using:

- fresh `sos_standings` for the standings half
- fresh `team_power_ratings_daily` plus landing-page `Power Score` for the predictive half

Adding optional context right now would mostly increase model surface area faster than it would increase confidence.

## Shipped Formula Boundary

The shipped landing-page `SoS` should therefore include only:

- standings-based strength:
  - direct opponent point percentage
  - OOWP-style opponent schedule context
- predictive/context strength:
  - weighted average opponent current snapshot Power Score

It should explicitly exclude:

- home/away
- goal differential
- rest disadvantage
- home-rink advantage
- separate goalie adjustment

## Verified vs Inferred

Verified:

- `team_games.is_home` exists and is populated
- `nhl_standings_details` contains goal-differential and home/road split fields but is stale
- rest-day fields exist in projection code paths, not in the verified landing-page source path
- `goalie_rating` exists for all 32 teams on `2026-04-05`
- tested additive goalie/danger context barely changed the predictive ordering on the live snapshot

Inferred / implementation choice:

- excluding home/away without a calibrated home-strength coefficient is a modeling choice
- excluding goalie context despite field availability is a simplicity / anti-double-counting choice

## Recommendation Carried Forward

For task `2.5` and implementation:

- state these exclusions explicitly in the formula documentation
- do not silently omit them
- treat stale `nhl_standings_details` freshness as a separate follow-up if richer standings context is desired later
