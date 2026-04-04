# FORGE Route Click Contract

## Status

- `red`

## Scope Audited

- [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)
- [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
- [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx)
- [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx)
- [HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx)
- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [ForgeRouteNav.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/ForgeRouteNav.tsx)

## Contract Goal

Clicks from the dashboard and landing route should send users to destinations whose data semantics match the originating card:

- opportunity cards -> opportunity drill-ins
- sustainability/trend cards -> trend drill-ins
- team-context cards -> team-context drill-ins
- slate cards -> Start Chart with the same resolved slate context

## Findings By Click Type

### Opportunity Cards

- [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
  - routes to `/forge/player/${playerId}?date=${date}&mode=${mode}`
  - semantic destination is correct
  - date and mode are preserved
- landing-page add preview in [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
  - routes to `/forge/player/${playerId}?date=${date}&mode=tonight`
  - destination is correct
  - but if the preview projections are fallback-driven, the click still carries requested date rather than resolved projection `asOfDate`

Verdict:

- `yellow`

### Sustainability / Trend Cards

- [SustainabilityCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SustainabilityCard.tsx)
  - routes to `/trends/player/${playerId}`
- [HotColdCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/HotColdCard.tsx)
  - routes to `/trends/player/${playerId}`
- landing-page sustainability preview in [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
  - also routes to `/trends/player/${playerId}`

Verdict:

- `green`

These are the cleanest click contracts in the current surface. The destination semantics match the originating cards.

### Team Context Cards

- [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx)
  - spotlight cards route to `/forge/team/${row.teamAbbr}`
  - table links also route to `/forge/team/${row.teamAbbr}`
- no selected dashboard date is preserved

Verdict:

- `red`

The route target is conceptually right, but the missing date continuity means the user can click a team from one dashboard date and land on a different effective date.

### Slate Cards

- [SlateStripCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/SlateStripCard.tsx)
  - focused matchup tile routes to `/start-chart?date=${dateUsed}`
- landing-page slate preview rows in [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
  - route to `/start-chart?date=${slateDateUsed ?? date}`
- but CTA links:
  - landing `Open Start Chart` -> `/start-chart`
  - player/team detail pages also link to `/start-chart` without preserving context

Verdict:

- `yellow`

Row-level slate clicks are good; CTA-level slate clicks are not.

## ForgeRouteNav Findings

[ForgeRouteNav.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/ForgeRouteNav.tsx) is intentionally generic:

- `Dashboard` -> `/forge/dashboard`
- `Start Chart` -> `/start-chart`
- `Trends` -> `/trends`
- `FORGE Landing` -> `/FORGE`
- optional:
  - `Team Detail`
  - `Player Detail`

This keeps the nav simple, but it means route-family context is not preserved by default. The nav is acting like a global switcher, not a contextual continuation surface.

That is acceptable only if the card-level drill-ins preserve context well enough. Right now they do not.

## Overall Status Rationale

The click contract is `red`.

Not because every click is wrong. Several are good.

It is `red` because the current weak points are concentrated in high-value workflow transitions:

- team-context -> team detail
- landing preview -> full dashboard/adds context
- CTA-style transitions into Start Chart and adjacent routes

Those are exactly the paths that are supposed to make the one-page dashboard feel coherent instead of fragmented.

## Required Follow-Ups

- preserve selected `date` when routing from dashboard team cards into `/forge/team/[teamId]`
- preserve resolved preview date where landing-page modules already know it
- decide whether `ForgeRouteNav` should stay a generic global switcher or become partially context-aware
- audit all CTA links separately from row-level drill-ins, because row clicks are healthier than panel actions today
