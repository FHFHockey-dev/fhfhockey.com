# Rolling Player Pass-2 `trendsDebug.tsx` Server Path Implementation

## Purpose

This artifact records the concrete implementation completed for task `4.3`.

The pass-2 validation console now has a dedicated read-only server-side path instead of relying on browser-side Supabase joins and page-local reconstruction.

## Implemented Files

- [rolling-player-metrics.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.ts)
- [rolling-player-metrics.test.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/debug/rolling-player-metrics.test.ts)
- [rollingPlayerValidationPayload.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts)
- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)

## Implemented Route Contract

### Route

- `GET /api/v1/debug/rolling-player-metrics`
- `HEAD /api/v1/debug/rolling-player-metrics`

### Required query params

- `playerId`
- `season`

### Supported optional query params

- `strength`
- `teamId`
- `gameId`
- `gameDate`
- `startDate`
- `endDate`
- `metric`
- `metricFamily`
- `includeStoredRows`
- `includeRecomputedRows`
- `includeSourceRows`
- `includeDiagnostics`

## Implemented Payload Sections

- `generatedAt`
- `request`
- `selected`
- `readiness`
- `stored`
- `recomputed`
- `sourceRows`
- `diagnostics`
- `comparisons`

## Current Data Sources Used By The Payload

- stored rolling rows from `rolling_player_game_metrics`
- player identity from `players`
- recomputed rows from `recomputePlayerRowsForValidation(...)`
- raw and merged source rows from the new `fetchPlayerValidationSourceData(...)` helper, which reuses the rolling pipeline’s existing:
  - WGO row spine fetch
  - NST counts / rates / on-ice fetches
  - PP-combination fetches
  - line-combination fetches
  - merged game-record construction
  - coverage summaries
  - source-tail freshness summaries

## Readiness Behavior Implemented

The payload now classifies the selected validation scope as:

- `READY`
- `READY_WITH_CAUTIONS`
- `BLOCKED`

Current blocker and caution derivation includes:

- recompute failure
- NST counts tail lag
- NST rates tail lag
- NST on-ice counts tail lag
- PP builder tail lag
- line-combination tail lag
- unknown game IDs
- coverage warnings
- suspicious-output warnings
- empty stored-row scope
- empty recomputed-row scope

The payload also returns `nextRecommendedAction` so the page can tell the user what to refresh or fix next.

## Intentional Scope Limits For Task 4.3

This task establishes the canonical server-side data path but does not yet complete every payload section proposed in the design artifact.

The following sections are intentionally left as `null` for now and are expected to be expanded during later `4.x` tasks:

- `contracts`
- `formulas`
- `windows`
- `helpers`

The route currently supports one selected metric diff in `comparisons.focusedRow.selectedMetric`, but it does not yet provide:

- full formula metadata
- rolling-window membership snapshots
- copy-helper strings
- family-wide diff matrices
- UI-oriented panel shaping beyond the core validation sections

## Why This Shape Is Correct For Pass 2

- The route is read-only.
- The route is server-side and avoids browser recompute logic.
- The helper reuses the rolling pipeline’s actual source fetch and merge semantics instead of inventing a second debug-only contract.
- The response already contains the minimum evidence needed for the next `trendsDebug.tsx` implementation steps:
  - stored row history
  - recomputed row history
  - selected-strength source rows
  - freshness and coverage diagnostics
  - readiness classification
  - focused-row metric comparison

## Test Coverage Added

- route method handling
- required query-param validation
- request parsing and selector normalization
- read-only success response shape
- `HEAD` handling without payload execution

## Pass-2 Follow-On Implications

This server path is now the canonical backend surface for:

- selector wiring in `4.4`
- validation panels in `4.5`
- copy helpers in `4.6`
- expanded route and UI test coverage in `4.7`
- debug-surface backlog capture in `4.8`
