# Forge Dashboard Team Context Contract Alignment

## Purpose

Sub-task `3.6` closes the contract gap between the dashboard hero/team-context bands and the existing source surfaces in:

- `web/pages/api/team-ratings.ts`
- `web/pages/trends/index.tsx`
- `web/pages/start-chart.tsx`
- `web/pages/underlying-stats/index.tsx`

## What Changed

- Added `web/lib/dashboard/teamContext.ts` as the shared owner for:
  - team power score calculation
  - special-team tier normalization
  - CTPI spark delta interpretation
  - slate matchup-edge mapping
- Rewired `TeamPowerCard.tsx` to consume the shared helper instead of recomputing power scores and matchup edges locally.
- Rewired `SlateStripCard.tsx` to consume the same team-context contract and expose a `Power Edge` summary for the focused matchup.
- Rewired `trends/index.tsx` and `underlying-stats/index.tsx` to use the same `computeTeamPowerScore(...)` helper instead of their own page-local copies.
- Aligned `start-chart.tsx` onto the shared `TeamPowerSnapshot` type so the dashboard hero and start-chart page speak the same rating-shape language.

## Why It Matters

Before this pass, the same conceptual team-power logic was split across the dashboard, Trends, and Underlying Stats with slight differences in local helper code. That made the top-band hero vulnerable to drifting away from the team-context table and the existing source pages.

After this pass:

- one score formula governs team power
- one matchup-edge interpretation governs slate context
- one CTPI-delta contract governs trend momentum

This keeps the dashboard bands consistent with the source pages they are adapting rather than letting each card invent its own team-context math.

## Verification

- `npm test -- --run web/lib/dashboard/teamContext.test.ts web/__tests__/pages/forge/dashboard.test.tsx`
- `npx tsc --noEmit --pretty false`
