# FORGE Dashboard Team Trend Context Implementation

## Scope

Sub-task `3.5` upgrades Band 2 from a plain team-power table into a fuller team-context surface inside [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx).

## What Landed

The card now combines three inputs:

- [team-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/team-ratings.ts)
  - remains the primary source of power, sub-ratings, and variance
- [team-ctpi.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/team-ctpi.ts)
  - adds CTPI and momentum deltas
- [start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts)
  - adds same-day matchup context via home/away rating snapshots

## UI Changes

Band 2 now has two layers:

1. Spotlight cards
- top visible teams get compact cards
- each card shows:
  - team identity
  - power rank
  - CTPI
  - matchup opponent + edge
  - variance flag
  - momentum change
  - compact CTPI sparkline

2. Expanded table
- the table remains for dense scanning
- added:
  - `CTPI`
  - `Matchup`
- team abbreviation cells now link to `/forge/team/[teamId]` using the current abbreviation route contract

## Matchup Contract

Matchup context is intentionally lightweight for the dashboard:

- use start-chart home/away rating snapshots
- convert those snapshots into the same power-score shape used by the card
- compute `edge = teamPower - opponentPower`

This gives the dashboard an immediately useful “good environment or bad environment tonight?” signal without turning Band 2 into a full Start Chart clone.

## Degraded-State Behavior

The component now treats team power as the primary required source and CTPI / matchup as secondary enrichments.

- if team power fails, the card errors
- if CTPI fails, the card still renders with a warning
- if start-chart matchup context fails, the card still renders with a warning

That keeps Team Trend Context useful even when one secondary source is missing.

## Direct Drill-Ins

Both the spotlight cards and the team abbreviation cells now route to:

- `/forge/team/[teamAbbr]`

This aligns Band 2 with the PRD’s dedicated team-detail direction before the actual team page is fully built.

## Verification

[dashboard.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/dashboard.test.tsx) now covers:

- CTPI rendering in the context band
- matchup edge rendering
- team-detail link presence
- the existing `Top 16` / `Bottom 16` behavior after the new spotlight layer was added
