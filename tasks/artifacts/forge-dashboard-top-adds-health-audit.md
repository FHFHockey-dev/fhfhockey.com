# FORGE Dashboard Top Adds Health Audit

## Status

- `red`

## Scope Audited

- [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
- [players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts)
- [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
- [ownership-snapshots.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-snapshots.ts)
- [topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts)
- [topAddsScheduleContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsScheduleContext.ts)
- [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)

## Component Intent

Top Adds is supposed to show an ownership-aware opportunity board that combines current FORGE skater projections, recent Yahoo ownership movement, configurable ownership-band filters, and optional week-streaming context.

## Serving Contract

Direct rail path in [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx):

- `/api/v1/forge/players`
- `/api/v1/transactions/ownership-trends`
- `useSchedule(...)` for week mode
- `rankTopAddsCandidates(...)`

Related ownership companion path included in this audit:

- `/api/v1/transactions/ownership-snapshots`
- `fetchOwnershipContextMap(...)` in [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)

## Source Contract

Current Top Adds chain depends on:

- `forge_runs`
- `forge_player_projections`
- `players`
- `teams`
- `rosters`
- `yahoo_players`
- weekly schedule data consumed by `useSchedule(...)`

## Live Source Evidence

Projection side:

- latest succeeded FORGE run date: `2026-03-14`
- latest succeeded run creation date: `2026-03-14`
- latest one-game projection surface: `263` distinct projected players in the latest succeeded run

Ownership side:

- latest `yahoo_players.last_updated` date: `2026-03-15`
- total `yahoo_players` rows: `2827`
- distinct `yahoo_players.player_id` values: `1506`
- season distribution:
  - `season = 2025`: `1494`
  - `season IS NULL`: `1333`
  - `season = 2026`: `0`

Projection-to-ownership identity coverage on the latest Top Adds projection surface:

- projected players: `263`
- direct `player_id` matches into `yahoo_players`: `0`
- exact normalized-name matches into `yahoo_players`: `249`
- projected players missing even an exact normalized-name match: `14`

## Route And Helper Behavior

### Projection Feed

[players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts):

- resolves the latest succeeded FORGE run for the requested date
- falls back to the most recent earlier succeeded run with player data
- returns `asOfDate`, `requestedDate`, and `fallbackApplied`
- filters rows to active roster players

This part of the chain is operationally coherent and at least exposes fallback explicitly.

### Ownership Trends Feed

[ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts):

- computes deltas from `ownership_timeline`
- supports optional position and season filters
- can emit `selectedPlayers` for explicit player ID requests

But it currently has two correctness risks:

1. it hard-limits the base `yahoo_players` fetch to `2500` rows before ranking and filtering
2. it exposes `playerId` as though it were a stable join key for the FORGE projection side, but live data showed `0` direct matches against the latest projection player IDs

### Ownership Snapshots / Shared Ownership Helper

[ownership-snapshots.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-snapshots.ts) and [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts):

- derive the Yahoo season from the date
- request season-scoped ownership snapshot/trend rows

Current mismatch:

- `deriveYahooSeason("2026-03-15")` resolves to `2026`
- current `yahoo_players` data has `0` rows with `season = 2026`

So the shared season-scoped ownership helper model is currently misaligned with the actual `yahoo_players` season labeling.

That does not directly break [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx), because the rail calls `ownership-trends` without a season filter, but it does mean the broader ownership helper layer is not internally consistent.

### Merge Logic In The Rail

[TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx):

- tries to merge ownership rows by `playerId` first
- falls back to normalized player name matching
- then applies the ownership band
- then scores the remaining candidates with [topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts)

Given the live data evidence, this means the rail currently depends almost entirely on normalized-name fallback rather than the intended stable-ID merge path.

## What Is Working

- the projection API exposes stale fallback via `asOfDate`
- the rail surfaces projection staleness with `Top Adds using {asOfDate}`
- ownership-band controls are explicit and configurable
- week mode has a real schedule-context lane through [topAddsScheduleContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsScheduleContext.ts)
- ranking logic is explicit and test-covered in [topAddsRanking.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.test.ts)
- page-level coverage in [dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx) proves:
  - ownership-band filtering
  - mode switching between `Tonight` and `This Week`
  - rail rendering and state changes

## Health Failures

### 1. Ownership trends silently truncate the candidate universe

[ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts) fetches at most `2500` `yahoo_players` rows up front.

Live row count is `2827`.

Because the cap is applied before ranking and filtering:

- some players are silently excluded from the Top Adds opportunity board
- the omission is not visible to the user
- the rail cannot currently prove that it is ranking the full relevant ownership universe

### 2. Stable ID matching is not actually working

The rail treats `playerId` as the preferred merge key, but live evidence showed:

- `263` projected players in the latest one-game FORGE run
- `0` direct matches to `yahoo_players.player_id`

So the intended stable-ID merge path is functionally broken in current data.

### 3. Name fallback is useful, but not trustworthy enough to rescue the contract

Exact normalized-name matching recovered `249` projected players, leaving `14` without even an exact-name match.

That means the Top Adds board can silently miss projected candidates due to ownership-side identity drift.

### 4. The ownership helper layer is internally inconsistent

The shared helper in [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts) assumes a Yahoo season label that does not currently exist in `yahoo_players`.

This is not the direct Top Adds rail path, but it is part of the same dashboard ownership layer named in the task scope.

### 5. The rail only surfaces projection staleness

[TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) builds `staleMessage` from `projectionResponse.asOfDate` only.

It does not currently surface ownership freshness independently, even though the component is fundamentally a mixed-source opportunity board.

## Status Rationale

Top Adds does not qualify for `green` or `yellow`.

Why not `green`:

- mixed-source correctness is not fully provable
- the merge key strategy is not healthy
- the ownership helper model is internally inconsistent

Why not `yellow`:

- a core source-to-UI join path is broken in live data
- the ownership trends feed silently truncates the candidate set
- the component can look coherent while omitting legitimate candidates without warning

Under the scoring model, that is closer to `red` than `yellow`.

## Required Follow-Ups

- fix the projection-to-Yahoo identity contract so Top Adds can merge on a reliable stable key instead of normalized-name fallback
- remove or correctly paginate the `2500`-row hard cap in [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
- reconcile the Yahoo season-labeling model used by [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts) with the actual `yahoo_players.season` values
- decide whether Top Adds should surface ownership freshness separately from projection freshness
- add a reconciliation check that compares the latest projection player set, ownership coverage, direct-ID coverage, fallback name coverage, and omitted-player count
