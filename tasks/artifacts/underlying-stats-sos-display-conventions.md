# Underlying Stats Landing Page SoS Display Conventions

Task: `3.4 Decide on the table formatting, sorting behavior, and display conventions for SoS so it scans cleanly next to the existing metrics.`

## Decision

The landing-page table should:

- remain sorted by `Power`, not by `SoS`
- display `SoS` with one decimal place
- render `SoS` as a compact 100-centered pill
- use the existing normalized-metric thresholds:
  - `>= 105` positive
  - `<= 95` negative
  - otherwise neutral

## Why

Verified page context:

- `/underlying-stats` is still a team power-rankings surface, not a pure schedule-strength leaderboard.
- `Power` already drives row order through `computeTeamPowerScore()` in `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`.
- `SoS` is also a 100-centered league-relative metric, so it benefits from the same quick positive/negative/neutral scan language already used by component ratings.

Implementation choices:

- `SoS` should not inherit the yellow primary-score styling from `Power`, because that would overstate its role in the page hierarchy.
- `SoS` should not stay as plain monochrome text, because that wastes the fact that the metric is already normalized around `100`.
- `SoS` should not introduce client-side table sorting in this step; that would expand scope beyond a display-convention decision.

## What changed

- Added `getSosClass(value)` in `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`.
- Rendered `SoS` inside a dedicated pill with the existing positive/negative/neutral classes in `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`.
- Added a narrow `.sosPill` style and centered `SoS` cell treatment in `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss`.
- Added a header/cell `title="Strength of Schedule"` so the abbreviation is not opaque before the explanatory copy update in task `3.5`.

## Targeted verification

Unit tests:

- `npx vitest run /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.test.ts /Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.test.ts`
- Result: passed (`9` tests)

Type check:

- `npx tsc --noEmit --pretty false --project /Users/tim/Code/fhfhockey.com/web/tsconfig.json`
- Result: still fails, but only in pre-existing out-of-scope files:
  - `/Users/tim/Code/fhfhockey.com/web/__tests__/pages/underlying-stats/playerStats/[playerId].test.tsx`
  - `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.test.ts`
  - `/Users/tim/Code/fhfhockey.com/web/lib/xg/deploymentContext.test.ts`

No new `SoS`-side type errors remained after the helper typing fix from the prior step.
