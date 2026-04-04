# FORGE Dashboard Sustainability Health Audit

## Status

- `red`

## Scope Audited

- [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx)
- [trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/trends.ts)
- [normalizers.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)
- [playerInsightContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerInsightContext.ts)
- [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)

## Component Intent

Sustainability is supposed to show:

- `Sustainable Risers`
- `Unsustainable Heaters`

using current sustainability snapshots, explanation-language helpers, and the shared dashboard ownership-discovery band.

## Serving Contract

[SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx):

- fetches `/api/v1/sustainability/trends` twice:
  - `direction=hot`
  - `direction=cold`
- normalizes each response through [normalizeSustainabilityResponse(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts)
- requests ownership overlay through [fetchOwnershipContextMap(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)
- filters rows through the shared `25% - 50%` ownership band unless ownership lookup throws

## Source Contract

Current sustainability chain depends on:

- `sustainability_scores`
- `player_baselines`
- shared Yahoo ownership routes through:
  - `/api/v1/transactions/ownership-snapshots`
  - `/api/v1/transactions/ownership-trends`

## Live Source Evidence

### Sustainability Source Tables

Live table evidence:

- latest `sustainability_scores.snapshot_date`: `2026-03-27`
- latest `player_baselines.snapshot_date`: `2026-03-27`

But the current `l10` snapshot history has a real hole:

- `2026-03-07`: `634` `l10` rows
- `2026-03-08` through `2026-03-17`: `0` `l10` rows
- `2026-03-26`: `648` `l10` rows
- `2026-03-27`: `649` `l10` rows

So the route’s fallback from `2026-03-15` to `2026-03-07` is not arbitrary. It is reflecting an actual source gap.

### Sustainability API

Direct live response from `/api/v1/sustainability/trends?snapshot_date=2026-03-15&window_code=l10&pos=all&direction=hot&limit=8`:

- requested snapshot: `2026-03-15`
- returned snapshot: `2026-03-07`
- row count: `8`
- sample hot row:
  - `player_id = 8479324`
  - `player_name = Ryan Lindgren`
  - `s_100 = 0`
  - `luck_pressure = 72.513657`

Direct live response from the `cold` leg for the same request:

- requested snapshot: `2026-03-15`
- returned snapshot: `2026-03-07`
- row count: `8`
- sample cold row:
  - `player_id = 8475760`
  - `player_name = Nick Bjugstad`
  - `s_100 = 100`
  - `luck_pressure = -19.301988`

So the API is operational, but the snapshot it is returning for a March 15 dashboard request is materially stale.

### Ownership Overlay

Live ownership helper evidence for the same two player IDs:

- `/api/v1/transactions/ownership-snapshots?playerIds=8475760,8479324&season=2026`
  - both players returned `ownership = null`
- `/api/v1/transactions/ownership-trends?playerIds=8475760,8479324&season=2026&window=5&includeFlat=1`
  - `selectedPlayers = []`

This is the same Yahoo season-label mismatch already surfaced elsewhere in the dashboard audit:

- the helper asks for `season=2026`
- live Yahoo ownership rows are not labeled that way

## Route And Helper Behavior

### Sustainability Route

[trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/trends.ts):

- accepts `snapshot_date`, `window_code`, `pos`, `direction`, `limit`
- resolves the nearest available snapshot at or before the requested date
- joins `player_baselines` for `player_name` and `position_code`
- computes `luck_pressure` from stored `components.weights.luck`
- sorts by `luck_pressure`
  - descending for `hot`
  - ascending for `cold`

This route is logically coherent.

The issue is not the sorting logic. It is the age and continuity of the underlying snapshots.

### Sustainability Normalizer

[normalizeSustainabilityResponse(...)](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts):

- preserves `snapshot_date`
- preserves `s_100`
- preserves `luck_pressure`
- preserves the four z-component fields used for explanation copy

This layer is straightforward and not obviously introducing drift.

### Explanation Layer

[playerInsightContext.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerInsightContext.ts):

- derives band titles and explanation language from `luck_pressure`
- clearly distinguishes:
  - `Trustworthy`
  - `Overheated`
  - `Short-term only`

The explanation layer is deterministic and aligned with the intended product framing.

### Ownership Overlay And Filtering

[SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx):

- fetches ownership for all sustainability player IDs
- only shows rows inside the shared ownership band
- treats the band as active unless the ownership request throws

This is the most important dashboard-side failure:

- if ownership lookup succeeds structurally but returns `null` ownership values
- no `ownershipWarning` is raised
- `withinOwnershipBand(...)` returns `false`
- the rows are silently filtered out

So the component can render an empty sustainability surface even while valid sustainability rows exist.

## What Is Working

- the sustainability route returns a structured stale fallback snapshot instead of failing
- the dashboard already surfaces that stale fallback through:
  - `Showing nearest available snapshot (...)`
- explanation language is explicit and test-covered
- the dashboard tests already verify:
  - stale snapshot fallback rendering
  - `Sustainable Risers` / `Unsustainable Heaters` labels
  - trust / overheated explanation copy
  - trends-player drill-in links
  - intended ownership-band behavior under mocked ownership data

## Health Failures

### 1. The source snapshot chain has a real mid-March hole for `l10`

This is the main source failure.

The dashboard request for `2026-03-15` is forced back to `2026-03-07` because there are no `l10` rows at all from `2026-03-08` through `2026-03-17`.

That means the component is stale by source reality, not just by a serving bug.

### 2. The ownership overlay is currently misaligned with live Yahoo data

The shared ownership helper still requests Yahoo `season=2026`, which currently returns:

- `ownership = null`
- empty selected-player trend rows

So the sustainability component’s ownership/discovery layer is not trustworthy against live data.

### 3. Silent empty-state risk from null ownership values

[SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx) only disables the ownership filter if the ownership request throws.

But in the current live mismatch:

- the request succeeds
- the returned ownership values are null
- rows are filtered out anyway

That is a dangerous degraded-state behavior because the card can look empty for the wrong reason.

### 4. The component’s health is mixed even when the stale snapshot warning appears

The stale snapshot warning is useful, but it only covers the sustainability leg.

The card still overlays the ownership band using a broken season-label assumption, which means:

- stale sustainability snapshot
- plus potentially broken ownership filtering

can combine into a misleadingly sparse or empty panel.

## Status Rationale

Sustainability does not qualify for `yellow`.

Why it is not `green`:

- the requested March snapshot currently resolves to March 7
- the ownership overlay is not aligned with live Yahoo data

Why it is not `yellow`:

- there is a real source gap for `l10` snapshots
- the component has a silent null-ownership filtering failure mode
- the discovery-band overlay can suppress valid sustainability rows without warning

Under the scoring model, that keeps the component `red`.

## Required Follow-Ups

- investigate why `l10` sustainability snapshots are missing from `2026-03-08` through `2026-03-17`
- decide whether a gap that large should:
  - remain a stale fallback
  - degrade the panel more aggressively
  - or block the panel entirely
- fix the shared Yahoo season mapping used by [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)
- change [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx) so null ownership coverage does not silently behave like a legitimate band exclusion
- add an explicit reconciliation check for:
  - requested snapshot date
  - resolved snapshot date
  - ownership coverage rate for visible sustainability candidates
  - count of rows lost solely because ownership was null
