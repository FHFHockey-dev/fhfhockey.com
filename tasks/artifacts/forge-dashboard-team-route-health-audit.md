# FORGE Team Route Health Audit

## Status

- `red`

## Scope Audited

- [team/[teamId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/team/[teamId].tsx)
- [TeamPowerCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TeamPowerCard.tsx)
- [ForgeRouteNav.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/ForgeRouteNav.tsx)
- [team-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/team-ratings.ts)
- [team-ctpi.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/team-ctpi.ts)
- [start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts)

## Route Intent

The team drill-in is supposed to be the dashboard’s deeper extension of Team Trend Context. A user clicking a team from the dashboard should land on a page that preserves the same team-level meaning, explains the same metrics, and makes any stale or missing sub-feeds obvious.

## Serving Contract

The route currently composes team detail from:

- `/api/team-ratings?date={selectedDate}`
- `/api/v1/trends/team-ctpi`
- `/api/v1/start-chart?date={selectedDate}`
- [useTeamSchedule.ts](/Users/tim/Code/fhfhockey.com/web/hooks/useTeamSchedule.ts)

It then renders:

- power score / trend
- CTPI / momentum
- matchup edge
- sub-ratings
- upcoming schedule and team record

## Live Evidence

Live source evidence checked on `2026-03-27`:

- `/api/team-ratings?date=2026-03-27`
  - `NJD.date = 2026-03-27`
  - `NJD.trend10 = 0`
- `/api/v1/trends/team-ctpi`
  - `generatedAt = 2026-03-28T01:34:01.404Z`
  - `NJD.sparkSeries` ends on `2025-11-07`
  - `NJD.ctpi_0_to_100 = 43.4032348643742`
- team-detail links from the dashboard currently use:
  - `/forge/team/${row.teamAbbr}`
  - no `date` query is preserved from the dashboard selection

This means the route can currently show:

- a current ratings date
- a current-looking page header
- a materially stale CTPI series and momentum value

without one honest route-level warning that the CTPI leg is stale.

## Routing Integrity

### Good

- unknown teams fail locally with `Unknown team.`
- the page keeps a stable team identity contract through `teamId`
- the route nav correctly exposes dashboard, trends, start-chart, and landing access

### Weak

- dashboard team clicks do not preserve the selected dashboard date
- the route therefore defaults to `todayEt`, not “the date the user just clicked from”
- the `Back to Dashboard` link also drops the originating date/team context
- the team route is acting like a generic current-state page, not a faithful drill-in from the clicked dashboard context

## Alignment With Team Trend Context

What aligns:

- same core source families as the dashboard team band
- same shared helper math for:
  - team power score
  - CTPI delta
  - slate matchup edge

What does not align:

- the dashboard band at least has band-level stale/error aggregation
- the team route uses `resolvedDate = teamRating.date`, which masks stale CTPI recency
- the route treats CTPI as available if any row exists, even if the spark series is months old
- the route does not distinguish:
  - “CTPI missing”
  - “CTPI present but stale”

## Degraded / Fallback Behavior

Current degraded behavior is insufficient.

Safe:

- missing ratings, CTPI, or matchup edge each add a contextual message
- the route can still render partial detail instead of hard-failing unnecessarily

Unsafe:

- stale CTPI is not surfaced as stale
- the page date chip is tied to ratings freshness only
- the route can therefore imply that all displayed team context is current when only one leg is
- off-slate teams frequently show no matchup edge, but the route gives no stronger framing that this is an expected same-day limitation rather than a broken metric

## Observability

Useful current coverage:

- [team/[teamId].test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/forge/team/[teamId].test.tsx)
  - covers base rendering
  - covers missing CTPI and missing matchup-edge notices
- shared helper coverage in [teamContext.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/teamContext.test.ts)

Gaps:

- no test currently covers stale-but-present CTPI on the team route
- no test verifies dashboard-selected date continuity into the team drill-in
- no route-level health contract summarizes mixed-cadence team context the way the audit model requires

## Status Rationale

The team route is `red`.

The main reasons are:

- it inherits the already-red CTPI chain
- it hides that staleness behind a current ratings date chip
- it loses dashboard date context on drill-in

So even though the route renders and partially degrades, it does not yet meet the requirement of being a trustworthy extension of Team Trend Context.

## Required Follow-Ups

- preserve dashboard-selected date when routing from Team Trend Context into `/forge/team/[teamId]`
- add stale-CTPI detection based on source spark recency, not request-time metadata
- separate `resolved ratings date` from `resolved CTPI date` so the route cannot silently imply a single current snapshot
- decide whether same-day matchup edge should remain:
  - a same-day-only metric with explicit wording, or
  - be expanded to a more durable team-context view for off-slate teams
