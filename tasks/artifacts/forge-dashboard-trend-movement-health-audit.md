# FORGE Dashboard Trend Movement Health Audit

## Status

- `red`

## Scope Audited

- [HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx)
- [skater-power.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/skater-power.ts)
- [normalizers.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)
- [playerInsightContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerInsightContext.ts)
- [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)

## Component Intent

Trend movement is supposed to show:

- `Hot / Cold`
- `Trending Up / Down`

as a short-term skater-only surface that complements sustainability without pretending to be a trust verdict.

## Serving Contract

[HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx):

- fetches `/api/v1/trends/skater-power`
- normalizes the payload through [normalizeSkaterTrendResponse(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)
- derives two modes from the same payload:
  - `hotCold`
  - `movement`
- overlays the shared ownership band through [fetchOwnershipContextMap(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)
- filters by:
  - skater position only
  - shared team filter
  - ownership band

## Source Contract

Current movement chain depends on:

- `player_trend_metrics`
- `players`
- shared Yahoo ownership routes through:
  - `/api/v1/transactions/ownership-snapshots`
  - `/api/v1/transactions/ownership-trends`

## Live API Evidence

Direct live response from `/api/v1/trends/skater-power?position=all&window=5&limit=8`:

- `seasonId = 20252026`
- `generatedAt = 2026-03-28T01:18:57.822Z`
- `positionGroup = all`
- `windowSize = 5`
- categories returned:
  - `shotsPer60`
  - `ixgPer60`
  - `timeOnIce`
  - `powerPlayTime`

Sample live ranking evidence:

- `shotsPer60`
  - `Mika Zibanejad`
    - `percentile = 100`
    - `gp = 6`
    - `delta = 0`
  - `Miles Wood`
    - `percentile = 100`
    - `gp = 3`
    - `delta = 67`
- `ixgPer60`
  - `Mark Scheifele`
    - `percentile = 100`
    - `gp = 4`
    - `delta = 0`
- `timeOnIce`
  - `Roman Josi`
    - `percentile = 100`
    - `gp = 5`
    - `delta = 15`

So the route is operational and returns structurally rich data.

## What Is Working

### 1. The product semantics stay separate from sustainability

[HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx) explicitly presents this surface as:

- short-term only
- not a trust verdict

[playerInsightContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerInsightContext.ts) reinforces that separation through:

- `describePlayerSignalFrame("shortTerm")`
- `describeTrendBand(...)`

This is aligned with the intended product framing.

### 2. Position and team filtering are coherent

The component:

- maps goalie mode to a skater-only degraded message
- uses team filtering after metadata hydration
- keeps hot/cold and movement modes on the same player pool

That behavior is straightforward and defensible.

### 3. The normalizer preserves the key movement fields

[normalizeSkaterTrendResponse(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts) preserves:

- `generatedAt`
- category rankings
- per-player series
- `playerMetadata`

The normalization layer is not obviously introducing drift.

## Health Failures

### 1. `generatedAt` is request time, not source freshness

[skater-power.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/skater-power.ts) sets:

- `generatedAt: new Date().toISOString()`

That is not the freshness timestamp of `player_trend_metrics`.

It means the route can look current whenever it is requested, even if the underlying trend rows are stale.

### 2. The dashboard stale-warning logic is built on synthetic freshness

[HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx) marks the feed stale only if:

- `Date.now() - new Date(payload.generatedAt) > 36h`

But because `generatedAt` is stamped at request time, that warning is effectively tied to route availability, not source freshness.

So the component currently lacks a trustworthy stale-state signal.

### 3. Ownership overlay has the same live mismatch as other player discovery surfaces

[playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts) still uses the same Yahoo season derivation that is already failing in other audits.

That means this surface can also:

- receive `null` ownership values
- keep the ownership band active
- silently suppress valid trend rows

### 4. There is no explicit source-date or snapshot-date contract in the API

Unlike sustainability, this route does not expose:

- source snapshot date
- source max game date
- source freshness status
- fallback metadata

So even when the payload shape is rich, the component cannot prove the movement surface is current.

### 5. Current observability is weaker than the UI suggests

The card shows:

- `Skater 5G • {generatedDate}`

which reads like source recency.

But that date is just the request-time date slice of `generatedAt`, not a validated source timestamp.

That is a misleading observability surface.

## Status Rationale

Why this is not `green`:

- source freshness is not actually represented in the route contract
- stale warnings are derived from synthetic request-time metadata
- ownership-band filtering remains untrustworthy

Why this is not `yellow`:

- the component currently presents a current-looking date without proving source recency
- degraded-state behavior does not distinguish stale source data from healthy current data
- the discovery-band filter can still suppress legitimate rows silently

Under the scoring model, that keeps the movement surface `red`.

## Required Follow-Ups

- expose true source recency for `player_trend_metrics` instead of request-time `generatedAt`
- decide whether the route should return:
  - latest source game date
  - latest source materialization timestamp
  - or both
- update [HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx) so stale-state behavior keys off true source freshness
- fix the shared Yahoo season mapping in [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)
- keep `/api/v1/trends/skater-power` quarantined until source-recency metadata is trustworthy
