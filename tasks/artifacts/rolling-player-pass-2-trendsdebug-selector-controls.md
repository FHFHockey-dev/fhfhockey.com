# Rolling Player Pass-2 `trendsDebug.tsx` Selector and Control Implementation

## Purpose

This artifact records the concrete UI control work completed for task `4.4`.

The page no longer behaves like a latest-row-only sustainability workbench. It now exposes the required pass-2 validation selectors and routes them through the read-only validation payload.

## Implemented Control Groups

### Player selector

- player search input
- live suggestion list backed by `players`
- selected-player banner

### Validation scope selectors

- strength selector
- season selector
- optional team selector
- start-date selector
- end-date selector
- focused game-date row selector

### Metric selectors

- metric-family filter
- metric / field selector

### Visibility toggles

- canonical-versus-legacy toggle
- mismatch-only toggle
- stale-only toggle
- support-columns toggle

## How The Controls Behave Today

- player, strength, season, team, date range, game-date row, metric family, and metric all feed the validation route request
- the row selector is populated from stored row history first and falls back to recomputed row history when needed
- the row selector already responds to:
  - mismatch-only filtering
  - stale-only filtering
- the metric selector is populated from the focused row and responds to:
  - metric-family filtering
  - legacy visibility
  - support-field visibility

## Current Validation Payload Wiring

`trendsDebug.tsx` now calls:

- [rolling-player-metrics.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.ts)

with the current selector state for:

- `playerId`
- `season`
- `strength`
- `teamId`
- `gameDate`
- `startDate`
- `endDate`
- `metric`
- `metricFamily`

and always requests:

- stored rows
- recomputed rows
- source rows
- diagnostics

## Current Page Outcome

The page is now structured around validation first:

- validation readiness summary cards
- validation-scope and freshness summaries
- focused metric comparison summary
- selector-state-driven row and metric filtering

The old sustainability workbench inputs remain present, but they now hydrate from the focused validation row instead of a separate latest-row-only rolling query.

## Explicitly Deferred To Later Tasks

Task `4.4` does not yet complete the full validation console. The following remain for later `4.x` work:

- full formula panel
- source-input panel
- rolling-window membership panel
- availability denominator panel
- numerator / denominator panel
- TOI trust panel
- PP context panel
- line context panel
- full diagnostics panel
- stored-vs-reconstructed matrix and copy helpers

Those later tasks now have the required selector and control state available in the page.
