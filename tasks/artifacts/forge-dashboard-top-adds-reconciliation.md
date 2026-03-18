# FORGE Dashboard Top Adds Reconciliation

## Purpose

This artifact reconciles the Top Adds rail from raw inputs through the rendered cards so the component is judged on what it actually shows, not just whether it renders.

It covers:

- raw FORGE projection input
- raw Yahoo ownership-trend input
- merge behavior in [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
- ranking behavior in [topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts)
- displayed ownership-band filtering and card labels

## Reconciliation Verdict

- overall Top Adds reconciliation: `red`
- ranking and ownership-band behavior for surviving candidates: `green`
- source coverage and opportunity-board completeness: `red`

The rail is internally coherent for the subset of candidates that survives the merge, but the subset itself is not trustworthy enough to call the rendered board accurate.

## Current Render Contract

As currently implemented, Top Adds is not a generic full-league add board.

It is the intersection of:

- latest active-roster FORGE skater projections from [players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts)
- recent Yahoo ownership movers from [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
- optional weekly schedule context from [topAddsScheduleContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsScheduleContext.ts)
- user-selected ownership band in [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)

Then the rail:

- ranks those candidates with [rankTopAddsCandidates(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts)
- slices to the top `6`
- renders compact ownership sparkline treatment only on the first `2` cards

That narrower movement-led contract is partially aligned with the product goal of leading with recent trend strength, but it still depends on the source join being correct and complete. Right now it is not.

## Live Reconciliation Evidence

Using the already-audited latest one-game Top Adds projection surface:

- projected players in latest succeeded run: `263`
- direct `player_id` matches into `yahoo_players`: `0`
- exact normalized-name matches into `yahoo_players`: `249`
- projected players still missing after exact-name fallback: `14`
- total `yahoo_players` rows: `2827`
- [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts) base fetch cap: `2500`
- [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) request limit to ownership trends: `40`

Those facts matter for reconciliation:

- the Top Adds board cannot currently prove stable-ID ownership alignment
- some ownership rows are excluded before trend ranking because of the `2500`-row cap
- the rail is intentionally consuming only a movement-led ownership subset, not the full ownership table

## What Reconciles Cleanly

### Projection Metrics To Ranking Inputs

[players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts) returns:

- `pts`
- `ppp`
- `sog`
- `hit`
- `blk`
- `uncertainty`

[TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) maps those directly into `TopAddsCandidateInput`, and [topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts) uses those same fields in the projection-support and risk terms.

That part of the card is internally consistent.

### Ownership-Band Filtering

The rail applies the ownership band in one place:

- after the ownership merge
- before ranking

The existing dashboard test in [dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx) proves the rendered cards respect the band:

- default `25% - 75%` shows `Mason Lohrei` and `Victor Olofsson`
- `Leo Carlsson` at `81%` is excluded
- tightening max ownership to `35%` removes `Mason Lohrei` and leaves `Victor Olofsson`

So the rail does honor the displayed ownership controls for candidates that actually make it into the merged set.

### Mode Switching And Schedule Term

The same test proves the `This Week` toggle causes the rail to request:

- `/api/v1/forge/players?...horizon=5`

And [topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts) only adds `scheduleContextScore` in week mode.

That is a coherent source-to-UI contract.

### Score Breakdown Labels

The rendered score chips match the helper terms:

- `Trend Wt`
- `Own Wt`
- `Proj Wt`
- `Sched Wt` in week mode
- `Risk`

So a user can at least read the same score terms the helper actually used.

## Reconciliation Failures

### 1. The rendered board is only as complete as the ownership-merge coverage, and that coverage is not healthy

[TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) tries:

1. direct `playerId` merge
2. normalized-name fallback

Live evidence showed the first path is effectively broken:

- `0` direct ID matches on the latest audited projection surface

That means the rendered board is not reconciling projections to ownership through the intended stable identity contract.

### 2. The board can silently omit legitimate candidates before the ownership band even applies

Because [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts):

- truncates the base `yahoo_players` read at `2500`
- then Top Adds only requests `limit=40`

the candidate universe is narrowed before the rail ever applies:

- projection merge
- ownership band
- ranking

So the rendered board can look correct while still omitting candidates that should have been eligible for comparison.

### 3. The main Trend metric label is misleading

The card summary row renders:

- `Trend +7.0%`

But the same card’s ownership-trend block renders:

- `+7.0 pts`

And the source API in [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts) computes:

- `delta = latest - previous`

That is a percentage-point change, not a true percent-change metric.

So the headline `Trend` label is currently mislabeling the same value the lower block labels correctly.

### 4. Forward-group filtering is code-level inconsistent

This is a code-level reconciliation issue rather than a fully live-verified data result.

[TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) sends:

- `pos=F` when the global position filter is forwards

But [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts):

- checks the supplied `pos` against exact Yahoo position tokens derived from `display_position` and `eligible_positions`

That API contract matches tokens like `C`, `LW`, `RW`, `D`, and `G`, while the rail’s local projection filter treats `F` as a grouped semantic.

So the rail and the ownership API are not using the same position contract for forwards. Even without a live failure sample attached yet, that mismatch is real in code and should be treated as a likely undercoverage bug for forward-only mode.

### 5. The rail only warns on projection staleness, not mixed-source drift

[TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) only builds `staleMessage` from:

- `projectionResponse.asOfDate`

It does not show:

- ownership freshness
- ownership/projection drift

That does not change the ranking math, but it does mean the rendered opportunity board can appear more current than its mixed-source inputs actually are.

## Status Rationale

Top Adds does not reconcile cleanly enough to be `green` or `yellow` overall.

What is genuinely `green`:

- the ranking helper is explicit
- the score chips reflect the ranking helper
- ownership-band controls work for candidates that survive the merge
- week mode changes the projection horizon and ranking term correctly

What keeps the overall component `red`:

- the stable-ID merge path is broken in live data
- normalized-name fallback is carrying most of the board
- source truncation can silently exclude candidates
- the main trend metric is mislabeled in the UI
- forward-group filtering is using mismatched position semantics across the rail and the ownership API

That combination means the rendered rail is not yet a trustworthy representation of the intended opportunity board.

## Required Follow-Ups

- repair the projection-to-Yahoo identity contract so Top Adds can merge on a stable key
- remove or correctly paginate the `2500`-row base fetch cap in [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
- decide whether the movement-led `limit=40` subset is the intended Top Adds universe or whether the board should consider a wider ownership-qualified pool
- relabel the headline `Trend` metric as points instead of percent, or compute a true percent-change metric if that is the intended display
- align forward-group filtering between [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) and [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
- add an explicit mixed-source reconciliation check that records:
  - direct ID coverage
  - name-fallback coverage
  - omitted projected players
  - candidate counts before and after the ownership band
