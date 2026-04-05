# Underlying Stats Landing Page Trend Repair (`1.4`)

Date: 2026-04-05

## Objective

Repair the `/underlying-stats` landing page trend path without changing `/underlying-stats/playerStats` or broadly altering shared `team-ratings` consumers.

## Why a Landing-Only Fallback Was Used

Task `1.3` established that the all-zero `trend10` values are primarily caused upstream:

- `team_power_ratings_daily` history is flattened by carry-forward behavior.
- `web/pages/api/v1/db/update-team-power-ratings.ts` builds the trend baseline from prior stored rows instead of from a fresh 10-game offense baseline.

That means a read-time landing-page correction was needed immediately even before any table backfill or upstream writer change.

## Implemented Path

### New helper

File: `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.ts`

Behavior:

- Fetches the stored daily landing rows via `fetchTeamRatings(date)`.
- Fetches actual game logs for a bounded lookback window.
- Reconstructs per-date team offense ratings from played-game history using existing `power-ratings.ts` math:
  - `calculateEwma`
  - `calculateLeagueMetrics`
  - `calculateZScores`
  - `calculateRawScores`
  - `calculateRawDistribution`
  - `calculateFinalRating`
- Builds actual played-date offense snapshots per team.
- Computes landing-page `trend10` as:

`latest played-date off_rating - average(off_rating across prior up to 10 played-date snapshots)`

- Overlays that repaired trend onto the stored row payload.

### New landing-page API route

File: `/Users/tim/Code/fhfhockey.com/web/pages/api/underlying-stats/team-ratings.ts`

Reason:

- Keeps the fix isolated to the `/underlying-stats` landing page.
- Avoids changing `/api/team-ratings` behavior for any unrelated consumers.

### Landing page wiring

File: `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`

Changes:

- SSR now loads landing-page ratings through `fetchUnderlyingStatsLandingRatings`.
- Client-side date changes now call `/api/underlying-stats/team-ratings`.

## Formula Notes

What was verified:

- The intended page meaning is a comparative trend against recent offense form.
- The existing upstream stored values were incorrect for the current snapshots.
- Existing `power-ratings.ts` math can reconstruct offense ratings from played-game data.

Implementation choice:

- The fallback uses prior played-date offense snapshots rather than prior stored daily rows.
- The baseline window is capped at 10 prior played snapshots.
- If no prior played snapshot exists, trend defaults to `0`.

## Verification

### Unit test

File: `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.test.ts`

Verified:

- Trend is computed against the prior played snapshots.
- Single-snapshot teams return `0`.

### Targeted runtime checks

Verified against local route and API for `2026-04-05`:

- `/api/underlying-stats/team-ratings?date=2026-04-05` returned 32 rows.
- All 32 rows had non-zero repaired `trend10` values.
- Sample repaired values included:
  - `COL -0.13`
  - `CAR 4.53`
  - `WSH -6.87`
  - `DET -2.95`
  - `TBL 4.7`
  - `VGK 6.45`
- SSR HTML for `/underlying-stats?date=2026-04-05` included non-zero `trend10` values in `initialRatings`.

## Known Remaining Limitation

This sub-task does not fix the date-selector truncation. The selector still reflects the raw-row-limited date query and currently exposes only a few recent dates. That remains in scope for task `1.5`.
