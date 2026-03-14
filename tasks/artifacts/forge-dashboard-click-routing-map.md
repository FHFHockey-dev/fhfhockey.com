# FORGE Dashboard Click Routing Map

Task: `1.5`
Date: `2026-03-14`

## Purpose

Define the routing contract for:

- compact nav links
- team logos and team rows
- player headshots and player cards
- slate click targets
- section-specific drill-ins

The goal is to remove ambiguity before implementation so the dashboard does not end up with inconsistent click behavior.

## Route Inventory

### Existing routes to use directly

1. [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
   - route: `/forge/dashboard`
2. [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
   - route: `/FORGE`
3. [start-chart.tsx](/Users/tim/Code/fhfhockey.com/web/pages/start-chart.tsx)
   - route: `/start-chart`
4. [trends/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/index.tsx)
   - route: `/trends`
5. [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)
   - route: `/trends/player/[playerId]`

### New routes implied by the PRD

1. team detail page
   - proposed route: `/forge/team/[teamId]`
2. dashboard-specific player detail page
   - proposed route: `/forge/player/[playerId]`

## Primary Rule

Click behavior must depend on context.

The dashboard should not use one universal player destination.

High-level rule:

1. opportunity-focused player surfaces route to the dashboard-specific player detail page
2. trust- and trend-focused player surfaces route to the trends player page
3. team identity surfaces route to the new team detail page
4. slate-wide drill-ins route to Start Chart or the relevant team detail depending on what was clicked

## Compact Secondary Nav

The compact nav should provide direct access to:

1. `/forge/dashboard`
2. `/FORGE`
3. `/trends`
4. `/start-chart`

If the team detail route is live, it should not appear as a fixed nav item. It should be entered contextually through team clicks.

## Team Click Contract

### Team logos in Team Trend Context

Destination:

- `/forge/team/[teamId]`

Reason:

- the logo is expressing team identity and environment
- the dedicated team detail page is the correct drill-in

### Team rows in Team Trend Context

Destination:

- `/forge/team/[teamId]`

### Team logos inside the slate hero

Destination:

- `/forge/team/[teamId]?date=YYYY-MM-DD`

Reason:

- a logo click should mean “show me that team”
- preserve the active date context when possible

### Team abbreviations or labels on player cards

Destination:

- `/forge/team/[teamId]`

Behavior:

- team badge / abbreviation is a team link
- player headshot / player name remains a player link

## Player Click Contract

### Projection / Opportunity Card

Examples:

- Top Player Adds
- streamer opportunity surfaces
- `Tonight` / `This Week` add boards

Primary destination:

- `/forge/player/[playerId]`

Reason:

- the user is in an actionability context
- they need add/start/stream context more than a full metric lab first

### Sustainability Signal Card

Examples:

- sustainable risers
- unsustainable heaters

Primary destination:

- `/trends/player/[playerId]`

Reason:

- this card is making a trust claim
- the trends player page is the best current surface for explaining why the claim is true

### Streak / Trend Card

Examples:

- hot
- cold
- trending up
- trending down

Primary destination:

- `/trends/player/[playerId]`

Reason:

- short-term movement needs trend drill-in first

### Player headshot behavior

Headshots should follow the card family, not a separate universal route.

Rules:

1. headshot inside `PlayerOpportunityCard`
   - `/forge/player/[playerId]`
2. headshot inside `PlayerSustainabilityCard`
   - `/trends/player/[playerId]`
3. headshot inside `PlayerTrendCard`
   - `/trends/player/[playerId]`

### Player name behavior

Player name should match the primary card destination exactly.

This avoids a confusing state where image and text on the same card lead to different destinations.

## Slate Click Contract

### Whole slate tile background

Destination:

- `/start-chart?date=YYYY-MM-DD`

Reason:

- the tile as a whole represents a game-level drill-in

### Team-specific click target inside a slate tile

Destination:

- `/forge/team/[teamId]?date=YYYY-MM-DD`

### Goalie-specific click target inside a slate tile

Destination:

- if goalie dashboard detail exists later:
  - `/forge/player/[playerId]` for goalie opportunity context
- until then:
  - `/start-chart?date=YYYY-MM-DD`

Initial implementation default:

- treat goalie bars in the slate tile as Start Chart drill-ins unless a dedicated goalie-aware dashboard player detail is explicitly implemented

## Section Header Links

Section headers may expose “open full view” links.

Recommended mappings:

1. Tonight's Slate
   - `/start-chart?date=YYYY-MM-DD`
2. Team Trend Context
   - `/trends`
3. Sustainable / Unsustainable
   - `/trends`
4. Hot / Cold
   - `/trends`
5. Goalie and Risk
   - `/FORGE` initially, or `/start-chart` if the surface is more slate-specific

## Landing Page Preview Contract

For the rebuilt `/FORGE` preview page:

1. slate preview card
   - links to `/forge/dashboard` for the full dashboard
   - may also expose a secondary `Open Start Chart` link
2. Top Adds preview card
   - links to `/forge/dashboard`
3. sustainability preview card
   - links to `/forge/dashboard`

The preview page should funnel users into the main dashboard rather than fragmenting them immediately.

## Fallback Routing Rules

If a destination route is not yet implemented:

1. team clicks
   - temporary fallback: `/trends`
   - but only until `/forge/team/[teamId]` exists
2. opportunity player clicks
   - temporary fallback: `/trends/player/[playerId]`
   - if `/forge/player/[playerId]` is not live yet

Fallbacks are temporary only. They should not replace the intended routing contract in the final product.

## Query State Preservation

Where reasonable, preserve context in links:

1. date
2. active slate mode
3. `Tonight` / `This Week` state for player-add contexts
4. ownership filter range when it materially changes interpretation

Minimum preserved state:

- `date`

Nice-to-have preserved state:

- `mode`
- `team`
- `ownership range`

## Interaction Consistency Rules

1. One click target should mean one concept.
   - team identity opens team detail
   - player identity opens player detail
   - game surface opens slate/game detail
2. Do not let identical-looking targets route to different places in different sections without obvious context.
3. Card-family routing may differ, but it must be internally consistent within that family.
4. Secondary links inside a card can route elsewhere only if their target meaning is explicit.

## Final Routing Summary

### Nav

- `/forge/dashboard`
- `/FORGE`
- `/trends`
- `/start-chart`

### Team identity

- `/forge/team/[teamId]`

### Opportunity player identity

- `/forge/player/[playerId]`

### Sustainability / trend player identity

- `/trends/player/[playerId]`

### Slate tile / game surface

- `/start-chart?date=YYYY-MM-DD`

## Conclusion

The routing model for the refreshed dashboard is:

- context-aware
- family-specific for player cards
- team-specific for logos and team rows
- slate-specific for game tiles

That preserves the product logic:

- opportunity cards go to opportunity detail
- trust cards go to trend detail
- team context goes to team detail
