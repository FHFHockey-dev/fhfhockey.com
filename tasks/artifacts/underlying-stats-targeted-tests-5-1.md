# Underlying Stats Targeted Test Coverage

Task: `5.1 Add or update targeted unit tests for date loading, trend handling, and SoS computation.`

## What changed

Added a landing-page route test at:

- `/Users/tim/Code/fhfhockey.com/web/__tests__/pages/underlying-stats/index.test.tsx`

This closes the remaining coverage gap between the helper tests and the actual `/underlying-stats` page render/update path.

## Coverage now in place

Date loading:

- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/availableSnapshotDates.test.ts`
- verifies distinct snapshot-date pagination and early source exhaustion

Trend handling:

- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.test.ts`
- verifies repaired trend merge behavior and resolved-date fallback behavior

SoS computation:

- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.test.ts`
- verifies standings component, predictive component, neutral fallback behavior, and final `SoS` blend

Landing-page route/render path:

- `/Users/tim/Code/fhfhockey.com/web/__tests__/pages/underlying-stats/index.test.tsx`
- verifies:
  - snapshot options render from SSR props
  - `SoS` column renders on the landing page
  - repaired trend value renders in the table
  - client date changes call the landing-page API path
  - fetched landing ratings update the rendered table

## Verification

Ran:

- `npx vitest run /Users/tim/Code/fhfhockey.com/web/__tests__/pages/underlying-stats/index.test.tsx /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/availableSnapshotDates.test.ts /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.test.ts /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.test.ts`

Result:

- `4` test files passed
- `13` tests passed
