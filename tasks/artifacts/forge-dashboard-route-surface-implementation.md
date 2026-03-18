# FORGE Dashboard Route Surface Implementation

## Scope

This artifact closes task-list phase `6.0`:

- `6.1` Rebuild `web/pages/FORGE.tsx` as a slim preview landing page
- `6.2` Create the dedicated team detail route
- `6.3` Implement card-type-specific player destinations
- `6.4` Build the dashboard-specific player detail route
- `6.5` Ensure nav and clickable elements provide equal access to dashboard subviews

## FORGE Landing

`web/pages/FORGE.tsx` now acts as a preview gateway, not the legacy all-in-one surface.

It provides:

- slate preview
- Top Adds preview
- sustainability preview
- direct path into the full dashboard

It also degrades locally when one preview feed is stale or unavailable rather than collapsing the entire route.

## Team Detail Route

`/forge/team/[teamId]` is now the default team drill-in surface for dashboard team clicks.

The route consolidates:

- team power
- CTPI / momentum
- same-day matchup edge
- schedule and record context
- links into adjacent views like Start Chart, Trends, and Underlying Stats

This gives the dashboard a true team-specific destination instead of dropping users into a generic listing page.

## Player Destination Split

Player destinations now follow card semantics instead of one universal route.

### Opportunity / projection cards

Route to:

- `/forge/player/[playerId]`

Reason:

- those clicks need projection, ownership, and add-context follow-through

### Sustainability / trend cards

Route to:

- `/trends/player/[playerId]`

Reason:

- those clicks need the existing metric-family and trend-history deep dive

## Dashboard-Specific Player Detail

`/forge/player/[playerId]` now exists specifically for opportunity-card drill-ins.

It focuses on:

- projection
- ownership
- add score
- team schedule context
- links to adjacent views including Trends Player Page and Team Detail

This is intentionally not a duplicate of the trends player page.

## Equal-Access Navigation

The compact route-nav contract is now active across the FORGE route family.

`ForgeRouteNav.tsx` provides direct access to:

- Dashboard
- Start Chart
- Trends
- Team Detail
- Player Detail
- FORGE Landing

Where a route-specific destination is not available yet, the nav disables it explicitly instead of linking somewhere misleading.

In addition to the compact nav, route-level action links preserve equal access from the body content itself.

## Verification Surface

The route-surface behavior is covered by:

- `web/__tests__/pages/FORGE.test.tsx`
- `web/__tests__/pages/forge/team/[teamId].test.tsx`
- `web/__tests__/pages/forge/player/[playerId].test.tsx`
- `web/__tests__/pages/forge/dashboard.test.tsx`
