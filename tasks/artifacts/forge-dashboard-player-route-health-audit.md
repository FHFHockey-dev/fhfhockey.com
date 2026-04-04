# FORGE Player Route Health Audit

## Status

- `red`

## Scope Audited

- [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/player/[playerId].tsx)
- [TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx)
- [ForgeRouteNav.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/ForgeRouteNav.tsx)
- [players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts)
- [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)
- [topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts)

## Route Intent

The player drill-in is supposed to be the dashboard-owned destination for projection/opportunity cards. It should extend the Top Adds contract with more ownership and schedule context without dropping the user straight into the trends stack.

## Serving Contract

The route currently composes player detail from:

- `/api/v1/forge/players?date={date}&horizon={1|5}`
- `fetchOwnershipContextMap([playerId], date, 5)`
- [useTeamSchedule.ts](/Users/tim/Code/fhfhockey.com/web/hooks/useTeamSchedule.ts)

It renders:

- projection snapshot
- ownership snapshot and recent change
- add score
- upcoming team schedule
- drill-ins to trends, team detail, dashboard, and Start Chart

## Live Evidence

Live route evidence already captured for the underlying player-opportunity feed:

- `/api/v1/forge/players?date=2026-03-27&horizon=1`
  - `requestedDate = 2026-03-27`
  - `asOfDate = 2026-03-25`
  - `fallbackApplied = true`

That means the player route is currently inheriting a fallback-driven projection chain before the page renders any player-specific interpretation.

## Alignment With Top Adds

### Good

- the route uses the correct source family for opportunity cards
- it does **not** incorrectly mix sustainability or trend-movement semantics into the opportunity page
- ownership degradation is explicit:
  - if ownership context fails, projection detail stays visible and a message is shown
- `mode` is preserved in the page nav and header chip

### Weak

- the route recomputes `Add Score` with:
  - `scheduleGamesRemaining: null`
  - `scheduleOffNightsRemaining: null`
  - `scheduleLabel: null`
- that means `scheduleContextScore` is effectively absent even in `week` mode
- the dashboard Top Adds rail does include schedule-context enrichment in week mode
- so the player route is not actually scoring from the same full contract as the card that sent the user there

This is a real drill-in mismatch, not just a simplified presentation choice.

## Routing Integrity

### Good

- invalid player IDs fail locally
- the page keeps the user in a projection/opportunity context first
- there is a clear escape hatch to `/trends/player/[playerId]` for deeper signal analysis

### Weak

- `Team Detail` links drop the current `date` and `mode`
- `Dashboard` and `Start Chart` links also drop the originating context
- the route nav preserves `playerHref`, but the adjacent drill-in actions do not preserve the same context
- if a player falls out of the current opportunity set, the route hard-fails with “Player not found in the current FORGE opportunity set”
  - that is coherent technically
  - but brittle operationally for a drill-in surface reached from a stale or fallback preview

## Degraded / Fallback Behavior

Safe:

- projection fallback is surfaced when `asOfDate !== requested date`
- ownership failures degrade without blanking the route
- schedule failures degrade locally in the schedule section

Unsafe:

- the route presents one `Add Score` number that can diverge from dashboard week-mode ranking semantics
- projection fallback can combine with context-dropping drill-ins, making it harder for users to understand what snapshot they are still looking at
- the route has no route-level summary explaining that the score is being computed from a reduced contract relative to the originating Top Adds rail

## Observability

Useful current coverage:

- [player/[playerId].test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/player/[playerId].test.tsx)
  - covers basic rendering
  - covers ownership-unavailable degradation

Gaps:

- no test currently verifies week-mode score consistency with the dashboard rail
- no test verifies context preservation across player-detail drill-ins
- no test verifies behavior when a player link resolves from a fallback `asOfDate`

## Status Rationale

The player route is `red`.

It is closer to healthy than some other audited surfaces because its semantic intent is cleaner: it is clearly an opportunity page, not a mixed metrics page.

But it still fails the route-family standard because:

- it inherits a currently unhealthy projection chain
- it recomputes Top Adds score from a reduced contract
- it drops date/mode context on adjacent drill-ins

That is enough drift to keep it out of `yellow`.

## Required Follow-Ups

- align player-detail `Add Score` with the full Top Adds scoring contract, especially for `week` mode
- preserve `date` and `mode` when routing to adjacent team/dashboard/start-chart views
- decide whether player-detail hard-failure for “not in current opportunity set” should degrade more gracefully when the underlying projection feed is fallback-driven
- add verification that a player clicked from Top Adds sees the same scoring semantics after drilling in
