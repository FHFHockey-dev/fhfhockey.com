# Underlying Stats Landing Page SoS Data-Path Extension

Task: `3.2 Extend the landing-page server/data-fetching path so each team row includes the computed SoS value needed by the UI.`

## What changed

- Extended `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.ts` so landing-page rows now carry `sos`.
- Added `UnderlyingStatsLandingRating = TeamRating & { sos: number | null }`.
- Updated `UnderlyingStatsLandingSnapshot.ratings` to use that landing-page-specific row type.
- Added `mergeUnderlyingStatsLandingRatings()` so repaired `trend10` and computed `sos` are merged in one pure step.
- Added `fetchUnderlyingStatsTeamScheduleStrengthForRatings()` in `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.ts` so the landing fetcher can reuse already-loaded same-date ratings instead of forcing an extra ratings fetch.
- Updated `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx` to consume the landing-page row type without changing shared team-ratings service contracts.

## Data path after the change

SSR and the landing-page API now resolve rows in this order:

1. load same-date landing-page ratings from `team_power_ratings_daily`
2. compute landing-page trend overrides from played-game snapshot history
3. compute same-date `SoS` from `sos_standings` plus current opponent Power Scores
4. merge those values into landing-page rows as:
   - `trend10`
   - `sos`
5. return the augmented rows through `resolveUnderlyingStatsLandingSnapshot()`

This keeps the `SoS` field scoped to the landing page instead of changing `/web/lib/teamRatingsService.ts` or unrelated consumers.

## Verified vs inferred

Verified:

- `fetchUnderlyingStatsLandingRatings('2026-04-05')` now returns `32` rows with non-null `sos` values.
- Sample rows from the live landing fetcher:
  - `NYR`: `trend10 4.5`, `sos 120.72`
  - `TOR`: `trend10 -4.81`, `sos 117.59`
  - `COL`: `trend10 -0.13`, `sos 68.98`

Implementation choices:

- `sos` is nullable at the row level so the UI can render defensively if a future snapshot is missing usable schedule strength data.
- The landing page carries only the final `sos` number in its row payload for now; helper-level diagnostic breakdowns remain internal to the computation layer until the UI explicitly needs them.

## Targeted verification

Unit tests:

- `npx vitest run /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.test.ts /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.test.ts`
- Result: passed (`9` tests)

Live fetcher check:

- loaded `web/.env.local`
- executed `fetchUnderlyingStatsLandingRatings('2026-04-05')`
- result: `32` rows with expected `trend10` and `sos` samples
