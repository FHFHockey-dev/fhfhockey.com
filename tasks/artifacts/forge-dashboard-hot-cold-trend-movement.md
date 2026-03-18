# Forge Dashboard Hot / Cold and Trend Movement

## Purpose

Sub-task `4.2` replaces the old team-level CTPI streak card with the player-side companion view required by the PRD:

- `Hot / Cold`
- `Trending Up / Trending Down`

This stays distinct from sustainability. The card now answers:

- who is currently hot or cold
- who is accelerating up or down

without reusing the `Sustainable / Unsustainable` language.

## What Changed

- Added `normalizeSkaterTrendResponse(...)` to the dashboard normalizers so the dashboard has a stable contract for `/api/v1/trends/skater-power`.
- Rebuilt `web/components/forge-dashboard/HotColdCard.tsx` around skater trend data instead of team CTPI.
- Added a two-mode card:
  - `Hot / Cold`
  - `Trending Up / Down`
- The card now respects:
  - shared team filter
  - shared skater position filter
- Goalie-only mode now degrades cleanly with a skater-only message instead of pretending the panel still applies.

## Data Contract

- Source: `/api/v1/trends/skater-power`
- Window: `5`
- Position:
  - `forward`
  - `defense`
  - `all`
- Composite interpretation:
  - `Hot / Cold` uses current percentile strength across returned categories
  - `Trending Up / Down` uses recent rank-delta movement across returned categories

## Interaction Contract

- all player rows drill into `/trends/player/[playerId]`
- the tab state changes semantics, titles, and reason text
- this card remains a separate signal family from sustainability

## Verification

- `npm test -- --run __tests__/pages/forge/dashboard.test.tsx`
- `npx tsc --noEmit --pretty false`
