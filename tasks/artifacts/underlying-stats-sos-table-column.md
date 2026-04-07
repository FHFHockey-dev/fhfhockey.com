# Underlying Stats Landing Page SoS Table Column

Task: `3.3 Add the SoS table column and rendering logic to web/pages/underlying-stats/index.tsx without altering /underlying-stats/playerStats.`

## What changed

- Added a `SoS` column to the landing-page table in `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`.
- Added `formatSos(value)` so the UI renders one decimal place for valid values and `—` for nulls.
- Rendered `team.sos` from the landing-page-specific row payload.
- Added a narrow table cell style in `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss` so `SoS` uses the numeric type system without inheriting the yellow `Power` emphasis.

## Placement

- `SoS` currently sits immediately after `Power` in the table header and row output.
- This was chosen so schedule difficulty stays near the main ranking score while remaining separate from the core offense/defense/pace components.

## Verified vs inferred

Verified:

- The landing-page payload already carried `sos` from task `3.2`, so the new column is reading real data rather than placeholder values.
- The updated page code is consuming `UnderlyingStatsLandingRating[]`, which includes `sos`.

Implementation choice for this step:

- `SoS` currently uses the same one-decimal scan pattern as other numeric overview columns.
- Final display conventions, sorting behavior, and any explanatory labeling are intentionally deferred to task `3.4` and `3.5`.

## Targeted verification

Helper and landing-payload tests:

- `npx vitest run /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.test.ts /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.test.ts`
- Result: passed (`9` tests)

Type check:

- `npx tsc --noEmit --pretty false --project /Users/tim/Code/fhfhockey.com/web/tsconfig.json`
- Result: still fails, but the remaining errors are outside this landing-page scope:
  - `/Users/tim/Code/fhfhockey.com/web/__tests__/pages/underlying-stats/playerStats/[playerId].test.tsx`
  - `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.test.ts`
  - `/Users/tim/Code/fhfhockey.com/web/lib/xg/deploymentContext.test.ts`

The only `SoS`-side type issues surfaced during this step were in `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.ts`, and those were corrected before re-running verification.
