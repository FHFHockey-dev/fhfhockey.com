# FORGE Dashboard Top Adds Ownership Sparkline

## Scope

Sub-task `3.4` completes the ownership-visual layer for the Top Player Adds rail by surfacing Yahoo ownership timeline behavior directly on the cards.

## What Landed

- [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) now renders an ownership trend block on each add card.
- The block includes:
  - a compact `Ownership 5D` label
  - recent ownership-point change in text form
  - a small ownership sparkline driven by the `ownership_timeline`-derived `sparkline` array from [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)

## Rendering Contract

- positive movers render with the dashboard `sparkRise` visual treatment
- negative movers render with `sparkFall`
- empty or missing timeline arrays render a compact fallback instead of a broken chart

This intentionally reuses the existing dashboard spark classes rather than creating a second sparkline styling system.

## Data Contract

The rail does not query `yahoo_players` directly.

Instead:

- [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
  - resolves current ownership
  - resolves recent change
  - returns `sparkline`
- [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
  - merges that ownership record with the projection row
  - passes `ownershipTimeline` through the shared candidate model

## Why This Matters

The PRD requirement was not just to show a static ownership number. The dashboard needs to show:

- how available a player is now
- whether managers are already moving on that player

The sparkline gives that second signal at first glance without forcing a drill-in.

## Verification

[dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx) now covers:

- Top Adds cards still render with the ownership-band filter
- `Ownership 5D` text appears on-card
- a positive ownership-change label is visible for a mocked riser
