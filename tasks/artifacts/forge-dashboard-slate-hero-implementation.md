# Forge Dashboard Slate Hero Implementation

## Goal

Turn the top-band slate strip into a real slate-first hero instead of a narrow horizontal list.

## What Changed

- [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx) now uses a focused-matchup hero layout:
  - top summary chips
  - selected matchup focus panel
  - team snapshots with team-power inputs
  - starter-lane blocks with probability and GSAA/60 context
  - clickable game tiles underneath for matchup switching
- [normalizers.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/normalizers.ts) now preserves richer `start-chart` fields:
  - game date
  - home/away team ratings
  - richer goalie rows including `projected_gsaa_per_60`, `confirmed_status`, and `percent_ownership`

## Source Patterns Reused

From [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx):
- game selection behavior
- matchup-first layout
- team-rating context
- goalie probability emphasis

From [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx):
- starter-confidence framing
- goalie risk / confidence language
- stronger hero emphasis for the top-of-page decision surface

## Result

The top band now behaves like a slate command surface:

- scan the slate
- focus one matchup
- compare team context
- see likely starters
- jump to Start Chart for the deeper slate workflow

This keeps the top band aligned with the PRD without waiting for the later Top Adds implementation.
