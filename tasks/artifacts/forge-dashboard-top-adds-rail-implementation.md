# FORGE Dashboard Top Adds Rail Implementation

## Scope

Sub-task `3.2` replaces the temporary dashboard-owned Top Adds placeholder with a real rail component in the top band of [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx).

## What Landed

- Added [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) as the real right-rail component.
- Replaced the `TopAddsRailShell` usage in [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx).
- Added compact rail controls for:
  - `Tonight`
  - `This Week`
  - adjustable ownership band via `Minimum ownership` and `Maximum ownership` sliders
- Preserved dashboard band-level status plumbing through `onStatusChange(...)`.

## Data Contract

The rail currently merges two existing sources client-side:

- [forge/players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts)
  - supplies projection-oriented skater rows
  - `Tonight` maps to `horizon=1`
  - `This Week` maps to `horizon=5`
- [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
  - supplies current ownership, recent ownership delta, and player metadata
  - was extended to include `playerId` so dashboard merges do not depend only on player-name matching

## Current Ranking Behavior

This sub-task intentionally stops short of the final ranking model from `3.3`.

Current ordering is:

- higher ownership delta first
- projection points as the tie-breaker

This gives the rail a usable real-data ordering without pre-empting the formal ranking-policy task.

## Filter Behavior

- Default ownership band is `25%` to `75%`.
- Shared dashboard position filter remaps the ownership-trend request and the merged projection rows.
- Team filter does not currently narrow the Top Adds rail; the rail remains a fantasy-opportunity surface rather than a team-scoped surface.

## UI Contract

Each add card now exposes:

- rank
- headshot placeholder or player headshot
- player identity
- current ownership
- recent ownership delta
- projected points
- supporting fantasy context:
  - PPP
  - SOG
  - hits + blocks
  - uncertainty

## Follow-On Work

- `3.3` should formalize the ranking formula.
- `3.4` should add the Yahoo ownership timeline sparkline behavior directly into the rail cards.
- `5.4` can layer in true schedule-aware streaming context for `This Week` mode instead of relying only on a longer projection horizon.
