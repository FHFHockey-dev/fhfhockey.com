# FORGE Route Family Health Audit

## Status

- `red`

## Scope Audited

- [FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx)
- [ForgeRouteNav.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/ForgeRouteNav.tsx)
- [dashboard.tsx](/Users/tim/Code/fhfhockey.com/web/pages/forge/dashboard.tsx)
- [start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts)
- [players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts)
- [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts)
- [trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/trends.ts)

## Component Intent

The landing page is supposed to be a slim, trustworthy gateway into the full FORGE dashboard. It should preview the same decision surfaces users will see after drilling in, while preserving enough date and contract context that the click-through destinations do not change meaning unexpectedly.

## Serving Contract

[FORGE.tsx](/Users/tim/Code/fhfhockey.com/web/pages/FORGE.tsx) currently fetches five live preview legs on load:

- `/api/v1/start-chart?date={todayEt}`
- `/api/v1/forge/players?date={todayEt}&horizon=1`
- `/api/v1/transactions/ownership-trends?window=5&limit=40`
- `/api/v1/sustainability/trends?...direction=cold`
- `/api/v1/sustainability/trends?...direction=hot`

It then derives three preview panels:

- `Slate Preview`
- `Top Player Adds`
- `Sustainability Preview`

## Preview-To-Dashboard Consistency Findings

### Slate Preview

- the preview uses the same Start Chart route as the dashboard slate band
- row links correctly carry `/start-chart?date={slateDateUsed ?? date}`
- but the footer action link is just `/start-chart`
- that drops the resolved preview date and weakens route continuity compared with the clicked preview rows

### Top Adds Preview

- the preview reuses the same projection and ownership sources as the dashboard adds band
- but it does **not** reuse the dashboard's full interaction model:
  - no `Tonight / This Week` mode
  - no adjustable ownership sliders
  - no schedule-context enrichment
  - no ownership snapshot overlay
- the preview is therefore a reduced, hard-coded `25% - 75% owned tonight-style` slice rather than a faithful miniature of the full Top Adds rail

### Sustainability Preview

- the preview reuses the same sustainability route family as the dashboard insight band
- but it collapses the dashboard's richer interpretation into:
  - `Trustworthy`
  - `Overheated`
  - raw `S` and `Pressure` values
- it does not preserve:
  - the dashboard ownership band
  - explanation language
  - expected-band framing
  - reason text
- this makes the preview directionally related to the dashboard, but not semantically equivalent

## Live Evidence

Live route evidence captured on `2026-03-27` / `2026-03-28`:

| Route | Requested date | Resolved date / freshness signal | Key finding |
| --- | --- | --- | --- |
| `/api/v1/start-chart?date=2026-03-27` | `2026-03-27` | `dateUsed = 2026-03-27` | slate preview leg was current on the audited day |
| `/api/v1/forge/players?date=2026-03-27&horizon=1` | `2026-03-27` | `asOfDate = 2026-03-25`, `fallbackApplied = true` | adds preview is fallback-driven |
| `/api/v1/transactions/ownership-trends?window=5&limit=40` | n/a | `generatedAt = 2026-03-28T01:30:55.722Z` | ownership preview leg was current, but still inherits the previously audited merge/truncation problems |
| `/api/v1/sustainability/trends?...direction=cold` | `2026-03-27` | `snapshot_date = 2026-03-27` | trustworthy preview leg was current |
| `/api/v1/sustainability/trends?...direction=hot` | `2026-03-27` | `snapshot_date = 2026-03-27` | overheated preview leg was current |

This means the live landing page is currently mixing:

- current slate preview
- fallback-driven Top Adds preview
- current sustainability preview

while still presenting all three modules inside one unified preview surface.

## Route Integrity Findings

### Good

- the page uses `Promise.allSettled(...)`, so one preview failure does not automatically blank the entire landing page
- panel-level warning and notice copy exists for all three previews
- the compact nav in [ForgeRouteNav.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/ForgeRouteNav.tsx) gives direct access to the full dashboard and subpages
- the preview rows themselves mostly route according to their intended semantics

### Weak

- the landing page has one top-level `error` banner, but no normalized route-family health contract of its own
- preview dates are not normalized across modules:
  - header chip prefers `slateDateUsed ?? date`
  - adds freshness comes from `players.asOfDate`
  - sustainability freshness comes from `snapshot_date`
- the route therefore lacks one honest page-level “these previews are from mixed dates” summary
- the Top Adds preview player links use `?date=${date}` even when the preview data came from `asOfDate`
- the `Open Start Chart` CTA loses the resolved preview date entirely

## Degraded / Fallback Behavior

Current behavior is partially safe, but not healthy enough for `green` or `yellow`.

Safe:

- slate fallback warning is explicit when `dateUsed !== requested date`
- Top Adds fallback warning is explicit when `asOfDate !== requested date`
- sustainability fallback warning is explicit when `snapshot_date !== requested date`
- partial preview failures degrade to notices instead of blanking the route

Unsafe:

- the route has no page-level mixed-cadence warning even when the three modules resolve to different effective dates
- the landing page can therefore look broadly current while its strongest “add” module is fallback-driven
- preview drill-ins do not consistently preserve the resolved preview context
- the page inherits already-red component chains without surfacing that the route as a whole is only as healthy as its weakest preview leg

## Observability

Useful current coverage:

- [FORGE.test.tsx](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/FORGE.test.tsx)
  - covers base rendering
  - covers fallback warning copy
  - covers partial preview failure handling
- the landing route uses shared dashboard helpers instead of bespoke fetch code for:
  - Start Chart normalization
  - sustainability normalization
  - Top Adds ranking

Gaps:

- no automated check verifies that preview drill-ins preserve resolved preview context
- no automated check verifies that landing-page previews and the full dashboard agree on effective date and semantics
- no route-level health contract aggregates mixed preview freshness into one status

## Status Rationale

The landing page is `red`.

That is not because the route is broken in a simple technical sense. It does render, it degrades partially, and it is test-covered.

It is `red` because:

- it previews component families that are already unhealthy
- one of its three core preview legs is currently fallback-driven in live data
- it does not present a normalized mixed-date health summary
- several drill-ins weaken or drop the preview context users just saw

That combination fails the route-family requirement that the preview surface remain consistent with the full dashboard and route users into semantically matching destinations.

## Required Follow-Ups

- add a route-family mixed-cadence warning when preview modules resolve to different effective dates
- preserve resolved preview dates in landing-page drill-ins where the preview already knows the resolved date
- decide whether the landing page should expose Top Adds as:
  - a faithful miniature of the dashboard rail, or
  - an explicitly simplified preview with different labels
- add explicit preview-to-dashboard reconciliation checks so the landing page cannot drift silently from the full dashboard semantics
- treat `/api/v1/forge/players` as a quarantined preview dependency until the fallback/staleness story is healthy enough for the adds preview to be trusted
