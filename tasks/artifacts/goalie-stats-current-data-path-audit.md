# Goalie Stats Current Data Path Audit (`1.1`)

## Findings

### 1. There is no dedicated goalie route or goalie API surface yet.

- The current landing page route is still the shared player surface at [`web/pages/underlying-stats/playerStats/index.tsx`](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/index.tsx:1).
- The current detail page route is still the shared player detail surface at [`web/pages/underlying-stats/playerStats/[playerId].tsx`](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/[playerId].tsx:1).
- The current public landing API is still `/api/v1/underlying-stats/players` at [`web/pages/api/v1/underlying-stats/players.ts`](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/underlying-stats/players.ts:1).
- The current public detail API is still `/api/v1/underlying-stats/players/[playerId]` at [`web/pages/api/v1/underlying-stats/players/[playerId].ts`](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/underlying-stats/players/[playerId].ts:1).
- The current chart API is still `/api/v1/underlying-stats/players/[playerId]/chart` at [`web/pages/api/v1/underlying-stats/players/[playerId]/chart.ts`](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/underlying-stats/players/[playerId]/chart.ts:1).

### 2. Goalie mode already exists inside the shared player-underlying aggregation engine.

- The shared family resolver already maps `statMode === "goalies"` to `goalieCounts` or `goalieRates` in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:1458).
- That means the goalie branch should be treated as a dedicated route/API specialization over an existing shared engine, not a new metric-computation pipeline.

### 3. Landing, detail, and chart reads all converge on the same shared source-of-truth server module.

- Landing API requests parse the shared filter contract in [`web/lib/underlying-stats/playerStatsQueries.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsQueries.ts:301), then call `buildPlayerStatsLandingAggregationFromState(...)` from [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:4756).
- Detail API requests parse `playerId` plus the shared detail-state contract in [`web/lib/underlying-stats/playerStatsQueries.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsQueries.ts:334), then call `buildPlayerStatsDetailAggregationFromState(...)` in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:4909).
- Chart API requests also stay on the shared landing-state contract and call `buildPlayerStatsLandingChartFromState(...)` in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:4883).

### 4. The current shared landing path already supports the cache -> source games -> persisted summaries -> live-summary fallback flow that the dedicated goalie surface should reuse.

- `buildPlayerStatsLandingAggregationFromState(...)` first checks the shared season aggregate cache, then fetches source games, then resolves persisted summary rows and missing games, then builds aggregation rows, then translates those into API rows in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:4761).
- This is the canonical read path for the future goalie landing route as well.

### 5. The current UI entry points are still the player route namespace, even when the active mode is goalie mode.

- The landing page builds its data requests through `buildPlayerStatsLandingApiPath(...)` from the shared query module in [`web/pages/underlying-stats/playerStats/index.tsx`](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/index.tsx:33).
- The landing page also builds detail links through `buildPlayerStatsDetailHref(...)` from the shared player filters/query helpers in [`web/pages/underlying-stats/playerStats/index.tsx`](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/index.tsx:26).
- The detail page fetches through `buildPlayerStatsDetailApiPath(...)` from the same shared query module in [`web/pages/underlying-stats/playerStats/[playerId].tsx`](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/playerStats/[playerId].tsx:19).

## Current End-to-End Path

### Landing route

1. Shared page route loads at `/underlying-stats/playerStats`.
2. Client state is parsed and normalized with the shared player filter helpers.
3. The page builds a request URL with `buildPlayerStatsLandingApiPath(...)`.
4. `/api/v1/underlying-stats/players` parses the landing request with `parseLandingApiRequest(...)`.
5. The API delegates to `buildPlayerStatsLandingAggregationFromState(...)`.
6. The shared server module:
   - resolves source games
   - fetches persisted summary rows
   - builds live rows for missing games when needed
   - aggregates rows into the active family, including `goalieCounts` or `goalieRates`
   - returns normalized landing rows

### Detail route

1. Shared page route loads at `/underlying-stats/playerStats/[playerId]`.
2. Client state is parsed and normalized with the shared player filter helpers.
3. The page builds a detail request URL with `buildPlayerStatsDetailApiPath(...)`.
4. `/api/v1/underlying-stats/players/[playerId]` parses `playerId` and filter state with `parseDetailApiRequest(...)`.
5. The API delegates to `buildPlayerStatsDetailAggregationFromState(...)`.
6. The shared server module resolves detail source games, summary rows, and final detail aggregation.

### Expanded-row chart route

1. The landing page chart fetch uses the shared player chart route.
2. `/api/v1/underlying-stats/players/[playerId]/chart` parses the chart request with `parseLandingChartApiRequest(...)`.
3. The API delegates to `buildPlayerStatsLandingChartFromState(...)`.
4. The same shared games + summary-row path is reused for chart data.

## Verified Reuse Boundary From This Trace

What already exists and should stay shared:

- request parsing and validation contract shape
- source-game selection
- persisted summary row reads
- live-summary fallback for missing games
- landing aggregation math
- detail aggregation math
- chart-series assembly
- goalie family selection inside shared aggregation

What is missing and should become goalie-specific:

- dedicated `/underlying-stats/goalieStats` landing route
- dedicated `/underlying-stats/goalieStats/[playerId]` detail route
- dedicated `/api/v1/underlying-stats/goalies*` wrappers
- goalie-first query/path builders
- goalie-first page copy, breadcrumbs, defaults, and navigation

## Verified vs Inferred

Verified:

- shared landing API route and parser
- shared detail API route and parser
- shared chart API route and parser
- shared landing/detail/chart aggregation entry points
- goalie family resolution inside the shared aggregation engine
- shared player page namespace still serving goalie mode today

Inferred:

- the dedicated goalie route and API should be wrapper layers over the shared engine rather than a new computation stack
- the current player route should eventually stop being the only public entry point for goalie mode once the dedicated goalie surface is shipped
