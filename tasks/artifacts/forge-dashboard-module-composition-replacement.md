# Forge Dashboard Module Composition Replacement

## Goal

Remove the remaining dashboard composition that still behaved like a reused legacy module instead of a FORGE-owned section.

## What Changed

- The right-rail `Top Player Adds` slot in [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) no longer mounts [TopMoversCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopMoversCard.tsx).
- The rail was first moved onto a dashboard-owned shell, and is now implemented by [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx). The shell phase mattered because it:
  - preserves the final rail footprint
  - keeps the band-level status wiring intact
  - stops implying that the legacy movers feed is the real Top Adds product

## Why This Was Necessary

The previous rail still imported the old movers composition:

- it fetched `team-ctpi` and `skater-power`
- it exposed `Top Movers` copy and team/skater toggles
- it behaved like a reused trend module rather than a fantasy-adds surface

That contradicted the PRD in two ways:

- the top rail is supposed to become an ownership-aware adds board, not a movers card
- the dashboard shell should stop presenting placeholder legacy modules as if they are the intended final product

## What Was Preserved

- The right-rail layout, spacing, and sticky behavior remain intact.
- The band-level loading/error/stale/empty infrastructure still treats `adds` as a first-class module key.
- [TopMoversCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopMoversCard.tsx) is preserved for reuse elsewhere if needed.

## Result

The top band now has the correct ownership boundary:

- slate hero: real active module
- Top Adds rail: dashboard-owned rail component
- legacy movers logic: no longer part of the main FORGE dashboard composition

This leaves task `3.x` with a clean insertion point for the real ownership-aware `Top Player Adds` implementation.
