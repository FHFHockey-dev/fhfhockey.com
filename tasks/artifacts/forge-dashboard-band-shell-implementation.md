# Forge Dashboard Band Shell Implementation

## Scope

- Task: `2.1`
- Page: [web/pages/forge/dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
- Styles: [web/styles/ForgeDashboard.module.scss](/Users/tim/Code/fhfhockey.com/web/styles/ForgeDashboard.module.scss)

## What Changed

- Replaced the old isolated-card grid composition with the PRD-aligned band structure.
- Kept the existing data cards in place as implementation anchors while changing the layout around them.
- Preserved the global date, team, and position state plus drift-warning behavior.
- Kept quick links visible while the dedicated compact nav is still pending in task `2.2`.

## Current Dashboard Bands

1. `Tonight's Slate`
   - Uses the existing `SlateStripCard` as the dominant top-band surface.
   - Adds a right-rail placeholder for `Top Player Adds` using the current `TopMoversCard` footprint.
2. `Team Trend Context`
   - Uses the existing `TeamPowerCard` inside a dedicated second band.
3. `Player Insight Core`
   - Places `SustainabilityCard` and `HotColdCard` side by side as separate signal families.
4. `Goalie and Risk`
   - Keeps goalie decision support in its own lower band via `GoalieRiskCard`.

## Layout Notes

- Added section-band shell styling with band headers, eyebrow labels, summaries, and responsive band layouts.
- Added dedicated layout classes for:
  - top-band hero plus rail
  - team context band
  - player insight band
  - goalie band
- Mobile behavior currently stacks the top band and the insight band vertically.

## Intentionally Deferred

- The real `Top Player Adds` rail logic belongs to task `3.0`.
- Shared nav/control refinements belong to task `2.2`.
- Shared loading/error/stale wrappers across all bands belong to task `2.4`.
