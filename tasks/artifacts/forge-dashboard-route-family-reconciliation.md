# FORGE Route Family Reconciliation

## Status

- `red`

## Routes Reconciled

- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [team/[teamId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/team/[teamId].tsx)
- [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/player/[playerId].tsx)
- dashboard entry points in:
  - [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
  - [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx)
  - [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
  - [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx)
  - [HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx)
  - [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)

## Reconciliation Goal

The route family is healthy only if:

- dashboard cards lead to semantically matching destinations
- route-level dates remain honest to the source dates actually rendered
- preview routes do not imply a stronger contract than the full route behind them can support

## Final Reconciled Findings

### Landing Route

- preview-to-dashboard reconciliation: `red`
- biggest failure:
  - mixed-date previews are not normalized into one honest route-level health story
- most important mismatch:
  - Top Adds preview can be fallback-driven while the page still reads as broadly current

### Team Route

- drill-in reconciliation: `red`
- biggest failure:
  - stale CTPI is masked by a current team-ratings date chip
- most important mismatch:
  - dashboard team clicks do not preserve selected dashboard date

### Player Route

- drill-in reconciliation: `red`
- biggest failure:
  - player-detail `Add Score` is computed from a reduced contract versus the originating Top Adds rail
- most important mismatch:
  - week-mode schedule context is not carried into the score even though the source card can use it

### Sustainability / Trend Drill-Ins

- click semantics: `green`
- player signal cards route to the trends player page, which matches the originating card family better than trying to overload the FORGE player route

### Slate Drill-Ins

- row-level slate routing: `yellow`
- CTA-level slate routing: `red`
- biggest mismatch:
  - row clicks preserve date, but several CTA links do not

## Route-Family Failure Modes

The route family is not failing from one single bug. It is failing from the same repeated pattern:

1. row-level routes are usually more faithful than panel-level CTAs
2. selected dashboard date is often lost when leaving the page
3. routes anchor visible date labels to one sub-feed while hiding staleness in another
4. preview routes use the same labels as full routes even when they only carry a reduced contract

## Operational Consequence

Users can currently do all of the following:

- click a team from one dashboard date and land on a different effective date
- click a landing-page add preview backed by fallback projections and land on a player route that still speaks in current-date terms
- move from a slate preview row with preserved date into a CTA that drops that same date

That is enough route drift to undermine trust in the route family even when the underlying page layouts render correctly.

## Final Status Rationale

The FORGE route family remains `red` after reconciliation.

The strongest working part is the player-signal card routing into the trends stack.

The weakest parts are:

- landing-route mixed-date preview honesty
- dashboard team-click date continuity
- player-route score-contract continuity
- CTA-level context preservation

Until those are corrected, the route family is not a trustworthy extension of the dashboard.

## Required Follow-Ups

- normalize route-level date disclosure so mixed-feed pages do not imply one unified current snapshot
- preserve dashboard-selected date in team-detail and relevant Start Chart drill-ins
- align player-detail scoring semantics with Top Adds rail semantics
- distinguish preview labels from full-route labels when the preview is intentionally reduced
