# Forge Dashboard Player Insight Ownership Band

## Scope

This artifact records the `4.4` implementation that keeps dashboard player-discovery sections outside Top Adds on a default `25%` to `50%` ownership band.

## What Landed

### Shared Player Insight Ownership Control

The `Player Insight Core` band now owns a dedicated discovery-ownership control with:

- default band: `25% - 50%`
- adjustable minimum ownership
- adjustable maximum ownership

This control is intentionally separate from the Top Adds rail because it serves a different job:

- Top Adds = broader opportunity scan (`25% - 75%`)
- Player Insight Core = tighter discovery pool (`25% - 50%`)

### Yahoo Ownership Snapshot Route

Added:

- `web/pages/api/v1/transactions/ownership-snapshots.ts`

This route returns the latest Yahoo ownership snapshot for explicit player IDs, using:

- `ownership_timeline` latest value first
- `percent_ownership` as fallback

It is purpose-built for card-level filtering and avoids overloading the Top Adds trend-feed contract.

### Shared Dashboard Ownership Helper

Added:

- `web/lib/dashboard/playerOwnership.ts`

This helper owns:

- season derivation for Yahoo lookups
- cached client fetches for ownership snapshots
- normalization into a playerId-to-ownership map

### Card-Level Behavior

Both:

- `SustainabilityCard.tsx`
- `HotColdCard.tsx`

now:

- fetch ownership snapshots for their current player rows
- filter to the active ownership band
- display ownership directly in row metadata
- degrade cleanly if the ownership snapshot route is unavailable

Degraded behavior is explicit:

- show unfiltered player rows
- surface a warning instead of failing the entire band

## Verification

Regression coverage now proves:

- the Player Insight band defaults to `25% - 50%`
- low-owned rows are hidden by default
- widening the minimum to `0%` reveals previously filtered player rows
