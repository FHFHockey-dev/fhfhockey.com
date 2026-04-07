# Goalie Stats Reuse Boundary (`1.5`)

## Decision

The dedicated goalie surface should be a wrapper product surface over the existing shared player-underlying pipeline, not a second ingestion or aggregation system.

This means:

- shared ingest stays shared
- shared summary snapshots stay shared
- shared aggregation math stays shared
- shared summary refresh jobs stay shared
- dedicated goalie route/API/query/filter/page code becomes goalie-specific

## What Stays Shared

These parts are already canonical and should remain the single source of truth for both the player and dedicated goalie surfaces.

### Data ingest and summary refresh

- raw NHL Gamecenter ingest in [`web/pages/api/v1/db/update-player-underlying-stats.ts`](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-player-underlying-stats.ts:1)
- summary-only refresh in [`web/pages/api/v1/db/update-player-underlying-summaries.ts`](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-player-underlying-summaries.ts:1)
- shared summary refresh helper in [`web/lib/underlying-stats/playerStatsSummaryRefresh.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsSummaryRefresh.ts:1)

Why:

- these paths already rebuild goalie summary rows
- they already invalidate shared caches
- introducing goalie-only maintenance routes would create duplicate operational paths

### Shared summary snapshot and aggregation engine

- source-game selection
- persisted summary row loading
- live-summary fallback for missing games
- landing aggregation math
- detail aggregation math
- chart-series assembly
- goalie metrics and row families

Primary source:

- [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:1)

Why:

- goalie counts/rates metrics already exist
- the current read stack already uses this module for landing, detail, and chart reads
- forking metric math would create drift between player and goalie surfaces

### Shared low-level filter semantics

Keep shared:

- season range
- season type
- supported strength states
- venue
- minimum TOI semantics
- mutually exclusive scope contract
- date range
- player game range
- team game range
- trade-mode semantics

Primary sources:

- [`web/lib/underlying-stats/playerStatsTypes.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsTypes.ts:1)
- [`web/lib/underlying-stats/playerStatsFilters.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.ts:1)

Why:

- the dedicated goalie surface should not invent a second incompatible filter model
- most of the required goalie filter semantics are already real and tested

### Shared wide-table primitives where useful

Potential shared UI building blocks:

- [`web/components/underlying-stats/PlayerStatsTable.tsx`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/PlayerStatsTable.tsx:1)
- [`web/components/underlying-stats/playerStatsColumns.ts`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/playerStatsColumns.ts:1)
- selected pieces of [`web/components/underlying-stats/PlayerStatsFilters.tsx`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/PlayerStatsFilters.tsx:1)

Why:

- wide-table behavior, sticky headers, staged loading, and existing metric formatting should not be rebuilt from scratch unless the goalie route needs a targeted specialization

## What Becomes Goalie-Specific

These parts should become dedicated goalie surface code, even when they delegate internally to the shared pipeline.

### Routes

- `web/pages/underlying-stats/goalieStats/index.tsx`
- `web/pages/underlying-stats/goalieStats/[playerId].tsx`

Why:

- the product framing must be goalie-first
- current player routes are the wrong public namespace for a dedicated goalie workflow

### Public read APIs

- `web/pages/api/v1/underlying-stats/goalies.ts`
- `web/pages/api/v1/underlying-stats/goalies/[playerId].ts`
- `web/pages/api/v1/underlying-stats/goalies/[playerId]/chart.ts`

Why:

- public API naming should match the goalie product surface
- these routes can stay thin wrappers over shared aggregation entry points

### Goalie query/filter wrapper layer

- `web/lib/underlying-stats/goalieStatsQueries.ts`
- `web/lib/underlying-stats/goalieStatsFilters.ts`
- optional `web/lib/underlying-stats/goalieStatsTypes.ts`
- optional `web/lib/underlying-stats/goalieStatsServer.ts`

Why:

- the dedicated goalie surface needs stable, shareable URLs independent of the player route namespace
- default state should be goalie-first, not on-ice skater-first
- the wrapper can also narrow or gate unsupported shared contract values

### Goalie-specific page IA and copy

Should become dedicated:

- page copy
- breadcrumbs
- metadata cards
- table family labels
- empty/error/loading states
- drill-down link behavior

Why:

- the current player surface is still explicitly player-oriented even when `statMode=goalies`

### Goalie UI-level table decisions

Should be handled at the goalie route/table layer:

- leftmost `Rank` column
- exact PRD label alignment for goalie headers
- goalie-specific default sort if product changes it
- removal of skater-oriented controls like position filter

Why:

- these are presentation and IA concerns, not shared metric-computation concerns

## Gaps That Must Be Resolved Before The Dedicated Goalie Surface Can Promise Full PRD Coverage

These are shared-pipeline limitations, not route/UI gaps.

### Shared score-state gap

- current landing aggregation only supports `allScores`
- non-`allScores` values are exposed in the contract/UI but are not actually implemented

Primary source:

- [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:2556)

### Shared strength-support gap

- current landing aggregation only supports:
  - `allStrengths`
  - `evenStrength`
  - `fiveOnFive`
  - `powerPlay`
  - `penaltyKill`
- requested goalie strengths not yet supported:
  - `fiveOnFourPP`
  - `fourOnFivePK`
  - `threeOnThree`
  - `withEmptyNet`
  - `againstEmptyNet`

Primary source:

- [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:1468)

### Cache-warm nuance

- current optional warm step prewarms the default shared landing state, not an explicit goalie state

Primary source:

- [`web/lib/underlying-stats/playerStatsSummaryRefresh.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsSummaryRefresh.ts:111)

This is a performance concern, not a correctness blocker.

## Recommended Build Order From This Boundary

1. Keep the existing shared summary pipeline untouched as the canonical math/data path.
2. Add dedicated goalie query/filter/server wrappers that delegate to shared logic.
3. Add dedicated goalie landing and detail routes plus dedicated goalie API wrappers.
4. Reuse existing goalie counts/rates metrics and narrow the public goalie promise to the subset already supported by the shared engine.
5. Separately decide whether to expand the shared engine for full score-state and extra-strength support before exposing those options in the dedicated goalie UI.

## Verified vs Inferred

Verified:

- shared read path already computes goalie rows
- shared refresh path already rebuilds goalie summaries
- shared column families already cover required goalie metrics
- shared filter semantics already cover season type, venue, minimum TOI, date range, game range, and team-game range
- some requested score and strength states are still unsupported in the shared landing engine

Inferred:

- the cleanest architecture is a dedicated goalie wrapper surface over the current shared system
- the goalie project should avoid deeper shared-pipeline changes unless they are needed to close the known score/strength support gaps
