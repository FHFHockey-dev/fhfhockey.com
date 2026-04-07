# Underlying Stats Landing Page SoS Helper Implementation

Task: `3.1 Add or extend a dedicated helper that computes landing-page SoS from the selected snapshot date and the verified source inputs.`

## What was implemented

- Added `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.ts`.
- Added `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.test.ts`.

The new helper keeps the landing-page `SoS` logic isolated from unrelated routes and shared rating consumers. It does not change `/underlying-stats/playerStats`.

## Helper behavior

`fetchUnderlyingStatsTeamScheduleStrength(date)`:

- validates the requested snapshot date
- reads same-date `sos_standings` rows
- reads same-date landing-page team ratings from `team_power_ratings_daily` via `fetchTeamRatings(date)`
- computes all team-level `SoS` values in one pass
- caches the computed result for the existing team-ratings TTL window

`computeUnderlyingStatsTeamScheduleStrength({ date, ratings, scheduleRows })`:

- derives each team's direct opponent point percentage from:
  - `past_opponent_total_wins`
  - `past_opponent_total_losses`
  - `past_opponent_total_ot_losses`
- parses `past_opponents` and counts repeated opponents as played-game weights
- computes the indirect standings context by averaging each opponent's own direct opponent point percentage, weighted by games faced
- computes the predictive raw score by averaging opponents' current snapshot landing-page Power Scores, weighted by games faced
- normalizes standings raw scores and predictive raw scores independently onto the landing-page `100 + 15*z` scale
- blends the two normalized components `50/50` into final `SoS`
- falls back to neutral `100` component scores when a team lacks usable schedule history

## Verified vs inferred

Verified:

- `sos_standings` is populated for the `2026-04-05` landing-page snapshot.
- `past_opponents` contains enough opponent history to weight repeated matchups.
- `team_power_ratings_daily` and `fetchTeamRatings(date)` provide the opponent snapshots needed for the predictive half.
- `computeTeamPowerScore()` is the landing-page ranking primitive and includes special-teams tier adjustments, so the helper uses that exact formula.

Implementation choices:

- indirect standings context is opponent-weighted by repeated appearances in `past_opponents`
- missing raw inputs normalize to neutral `100`
- the helper returns extra diagnostics per team:
  - `standingsComponentScore`
  - `predictiveComponentScore`
  - `standingsRaw`
  - `predictiveRaw`
  - `directOpponentPointPct`
  - `opponentScheduleContext`
  - opponent-game counts

## Targeted verification

Unit coverage:

- `npx vitest run /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.test.ts`
- Result: passed (`4` tests)

Live snapshot sanity check:

- Loaded `web/.env.local`
- Ran the helper directly for `2026-04-05`
- Result: `32` teams returned

Sample live outputs from `2026-04-05`:

- Highest `SoS`:
  - `NYR 120.72`
  - `NJD 119.15`
  - `TOR 117.59`
  - `FLA 116.98`
  - `PHI 115.13`
- Lowest `SoS`:
  - `ANA 84.16`
  - `VGK 82.44`
  - `EDM 77.96`
  - `CGY 76.47`
  - `COL 68.98`

These live rankings are directionally consistent with the previously documented standings-component and predictive-component distributions from task `2.0`.
