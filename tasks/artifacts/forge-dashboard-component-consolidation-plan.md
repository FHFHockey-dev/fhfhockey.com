# FORGE Dashboard Component Consolidation Plan

Task: `1.4`
Date: `2026-03-14`

## Purpose

Identify the overlapping UI patterns across the current FORGE, Trends, Start Chart, Underlying Stats, Placeholder, and Sandbox surfaces and define which ones should be merged into singular reusable dashboard components.

This artifact also records the styling sources that must govern the merged components:

- [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md)
- [vars.scss](/Users/tim/Code/fhfhockey.com/web/styles/vars.scss)
- [_panel.scss](/Users/tim/Code/fhfhockey.com/web/styles/_panel.scss)

The goal is not only to reduce duplicate code. The goal is to keep the refreshed dashboard contained, coherent, and visually aligned with the FHFH design system.

## Styling Governance

All merged dashboard components should follow:

1. [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md)
   - overall tone: Neon Noir Analytics
   - data-dense terminal posture
   - card strip, panel, typography, and hover-glow rules
2. [vars.scss](/Users/tim/Code/fhfhockey.com/web/styles/vars.scss)
   - color tokens
   - spacing tokens
   - typography tokens
   - breakpoint tokens
   - touch-target and mobile spacing tokens
3. [_panel.scss](/Users/tim/Code/fhfhockey.com/web/styles/_panel.scss)
   - shared panel containers
   - panel title treatment
   - scroll wrappers

Implementation rule:

- merged components should consume these shared styles and tokens instead of inventing one-off visual systems inside dashboard-local SCSS

## Overlap Inventory

### 1. Slate Strip / Matchup Strip / Game Strip

Currently spread across:

- [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- existing [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx) via `SlateStripCard`

Shared responsibilities:

- show tonight’s games
- show team identity
- show matchup context
- show goalie probability bars
- support click-through

Problem:

- the same conceptual strip exists in multiple visual and data shapes
- slate context and goalie context are too separated

Merge decision:

- create one shared dashboard component family centered on a `SlateMatchupStrip`
- allow internal variants for compact preview versus full hero

Resulting reusable component targets:

1. `SlateMatchupStrip`
2. `SlateMatchupTile`
3. optional `GoalieProbabilityBar` atom

### 2. Team Power / CTPI / Matchup Context

Currently spread across:

- [underlying-stats/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx)
- [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)
- [trends/placeholder.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/placeholder.tsx)

Shared responsibilities:

- rank team strength
- explain momentum
- expose CTPI or movers
- provide matchup and variance context

Problem:

- team environment is split into separate boards, charts, and summaries
- no singular team-context card model exists

Merge decision:

- create one `TeamContextCard` family that can render:
  - team power
  - CTPI / momentum
  - matchup strength
  - variance warning

Resulting reusable component targets:

1. `TeamContextCard`
2. `TeamContextRail`
3. optional `TeamMetricPill` and `VarianceBadge` atoms

### 3. Projection / Opportunity Player Surfaces

Currently spread across:

- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
- transaction / ownership surfaces

Shared responsibilities:

- surface usable fantasy players
- show projection context
- show ownership
- show matchup utility

Problem:

- player actionability is split between projection surfaces and ownership surfaces
- no unified add/streamer card exists

Merge decision:

- create one `PlayerOpportunityCard` family for Top Adds and related add boards

Resulting reusable component targets:

1. `PlayerOpportunityCard`
2. `OwnershipSpark`
3. optional `OpportunityBadge` / `ScheduleLeveragePill`

### 4. Sustainability / Hot-Cold / Trend Movement

Currently spread across:

- [trendsSandbox.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsSandbox.tsx)
- [trends/placeholder.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/placeholder.tsx)
- [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)

Shared responsibilities:

- communicate movement
- communicate trust or fade risk
- provide short reasoning
- support drill-in

Problem:

- sustainability and trend cards are conceptually related but implemented as separate page-specific ideas
- short-term movement and long-term trust are easy to blur together if not modeled carefully

Merge decision:

- create one trend-signal component family with distinct modes, not one identical card skin

Resulting reusable component targets:

1. `PlayerSustainabilityCard`
2. `PlayerTrendCard`
3. `TrendSignalTabs`
4. optional `SignalReason`, `TrendSpark`, `TrustBadge`

### 5. Search / Drill-in Access

Currently spread across:

- [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)
- [trendsSandbox.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trendsSandbox.tsx)

Shared responsibilities:

- find a player quickly
- route into deeper detail

Problem:

- search behavior is duplicated and page-specific

Merge decision:

- centralize player/team search behavior into reusable dashboard-local controls or shared hooks, but avoid building multiple dashboard-only search components if the existing trends search can be extracted cleanly

### 6. Panel Shells And Section Headers

Currently spread across:

- existing dashboard cards
- trends panels
- FORGE sections
- start-chart panels

Shared responsibilities:

- title + meta
- loading / error / empty treatment
- panel body container

Problem:

- every surface carries its own shell pattern

Merge decision:

- use shared section shells that inherit styling from [_panel.scss](/Users/tim/Code/fhfhockey.com/web/styles/_panel.scss)

Resulting reusable component targets:

1. `DashboardSection`
2. `DashboardSectionHeader`
3. `DashboardSectionState`

## Recommended Component Families

The refreshed dashboard should converge toward this smaller component set:

1. `DashboardSection`
2. `SlateMatchupStrip`
3. `TeamContextCard`
4. `PlayerOpportunityCard`
5. `PlayerSustainabilityCard`
6. `PlayerTrendCard`
7. `GoalieRiskCard`
8. `OwnershipSpark`
9. `TrendSignalTabs`

These are enough to cover the product model without preserving page-specific duplication.

## Components That Should Not Be Merged Too Aggressively

Do not collapse these into one generic card API:

1. `PlayerOpportunityCard`
2. `PlayerSustainabilityCard`
3. `PlayerTrendCard`

Reason:

- they answer different user questions
- they carry different ranking logic
- they route to different destinations

Also do not merge:

- `TeamContextCard` with `SlateMatchupTile`
- `GoalieRiskCard` with general player cards

Those families share styling DNA, but not product purpose.

## Styling Implications Of Consolidation

### Panels

Use:

- `@include panel-container(...)` from [_panel.scss](/Users/tim/Code/fhfhockey.com/web/styles/_panel.scss)
- panel-header styling driven by `@include panel-title(...)`

### Tokens

Use:

- color, spacing, typography, breakpoint, and touch-target tokens from [vars.scss](/Users/tim/Code/fhfhockey.com/web/styles/vars.scss)

### Card Identity

Use the card guidance from [fhfh-styles.md](/Users/tim/Code/fhfhockey.com/fhfh-styles.md):

- accent strips
- layered dark surfaces
- visible borders
- glow on interactive states
- accent font on titles

### Anti-patterns to avoid

1. card families each inventing different spacing systems
2. dashboard-local hard-coded colors that bypass `vars.scss`
3. panel shells redefined inside every component SCSS module
4. one massive "smart card" trying to act like every card type

## File-Structure Recommendation

The refresh should favor a contained dashboard component surface under:

- `web/components/forge-dashboard/`

Suggested grouping:

1. `layout/`
   - section shells
   - rails
   - band wrappers
2. `slate/`
   - slate strip
   - matchup tile
   - goalie bar atoms
3. `team/`
   - team context cards
4. `player/`
   - opportunity cards
   - sustainability cards
   - trend cards
   - ownership sparks
5. `goalie/`
   - goalie risk cards

This keeps the dashboard system contained instead of spreading the new UI across too many unrelated directories.

## Conclusion

The current dashboard-adjacent UI is overlapping in useful ways, but it is too fragmented.

The correct merge strategy is:

- unify slate surfaces
- unify team-context surfaces
- unify opportunity surfaces
- unify trend-signal surfaces
- unify panel shells

while still preserving separate card families for:

- opportunity
- sustainability
- short-term trend movement

That is the right balance between containment and product clarity.
