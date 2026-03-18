# Forge Dashboard Sustainable vs Unsustainable Paired View

## Purpose

Sub-task `4.1` replaces the placeholder sustainability split with the real default player-insight pair required by the PRD:

- `Sustainable Risers`
- `Unsustainable Heaters`

## What Changed

- Extended the dashboard sustainability normalizer to preserve the component z-signals:
  - `z_shp`
  - `z_oishp`
  - `z_ipp`
  - `z_ppshp`
- Reworked `web/components/forge-dashboard/SustainabilityCard.tsx` so each side now renders:
  - dashboard-owned paired titles
  - trust/heat badges
  - position tags
  - sustainability score
  - luck-pressure readout
  - short reason text derived from the dominant inflation driver
  - direct drill-ins to `/trends/player/[playerId]`

## UX Contract

- Left column is the trusted side: `Sustainable Risers`
- Right column is the caution side: `Unsustainable Heaters`
- The component remains an L10 snapshot by default
- The card now explains why a player appears sustainable or overheated instead of only exposing raw `S` and `L` numbers

## Notes

- This pass intentionally keeps the same source route:
  - `/api/v1/sustainability/trends`
- It upgrades the dashboard interpretation and card semantics without inventing a second sustainability feed.
- The deeper `Hot / Cold` and `Trending Up / Trending Down` distinctions remain owned by later `4.x` tasks.

## Verification

- `npm test -- --run __tests__/pages/forge/dashboard.test.tsx`
- `npx tsc --noEmit --pretty false`
