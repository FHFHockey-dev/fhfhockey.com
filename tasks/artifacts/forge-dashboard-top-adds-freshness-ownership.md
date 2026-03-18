# FORGE Dashboard Top Adds Freshness Ownership

## Purpose

This artifact traces the refresh ownership behind Top Adds so the opportunity board is evaluated as one mixed-source chain rather than a single card.

It covers:

- FORGE projection freshness
- Yahoo ownership freshness
- week-mode schedule-context freshness
- ranking-input ownership
- runtime expectations and policy gaps

## Ownership Verdict

- overall ownership clarity: `yellow`
- current operational result for Top Adds: still `red`

The chain is more traceable than the slate chain’s goalie leg, but it is still not healthy enough to be considered trustworthy because the mixed-source freshness policy is incomplete and the latest projection side is already lagging the ownership side.

## Top Adds Sub-Feeds

| Sub-feed | Current owner | Current runtime / policy |
| --- | --- | --- |
| core games and schedule baseline | `update-games` family | only partially explicit in current runbook summary |
| projection execution | [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts) | cron timeout `300000ms`; endpoint default `maxDurationMs = 270000` |
| served player opportunity feed | [players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts) | no explicit dashboard endpoint budget in [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts) |
| Yahoo ownership refresh | [update-yahoo-players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-yahoo-players.ts) | cron timeout `100000ms` |
| ownership trend aggregation | [ownership-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-trends.ts) | cache `s-maxage=300`, but no dashboard freshness policy entry |
| ownership snapshot lookup | [ownership-snapshots.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/transactions/ownership-snapshots.ts) | cache `s-maxage=300`, but no dashboard freshness policy entry |
| week schedule context | [useSchedule.ts](/Users/tim/Code/fhfhockey.com/web/components/GameGrid/utils/useSchedule.ts) via `/api/v1/schedule/[startDate]` | live schedule fetch, no explicit Top Adds freshness/runtime policy |
| ranking inputs | [topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts) | local pure helper, no cron ownership needed |

## Current Scheduled Chain

Documented current jobs from [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md):

- `07:15 UTC` pre-ingestion slot noted for `update-games`
- `08:40 UTC` `update-yahoo-players`
- `10:05 UTC` `run-forge-projection-v2`

Related but not clearly named as Top Adds ownership in the dashboard policy:

- `/api/v1/schedule/[startDate]` for week-mode schedule context
- `expected_goals` reads inside [useSchedule.ts](/Users/tim/Code/fhfhockey.com/web/components/GameGrid/utils/useSchedule.ts)

## Live Freshness Evidence

Projection side:

- latest succeeded FORGE run date: `2026-03-14`
- latest succeeded FORGE run created at: `2026-03-14 10:05:00+00`
- latest projection feed therefore lagged the current audit date `2026-03-15` by one day

Ownership side:

- latest `yahoo_players.last_updated` date: `2026-03-15`
- ownership timelines are populated for `2827` rows and current through the audit date

Result:

- ownership is fresher than projections right now
- the Top Adds rail can therefore mix one-day-old opportunity projections with same-day ownership movement

That is a legitimate mixed-cadence freshness condition.

## Projection Freshness Ownership

[players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/players.ts):

- resolves the latest succeeded run for the requested date
- falls back to the latest earlier succeeded run with player data if the requested date has no data
- exposes `asOfDate`, `requestedDate`, and `fallbackApplied`

This is better than a silent fallback, but it also means the Top Adds rail is explicitly allowed to operate on stale projection data.

Current policy gap:

- [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts) has no Top Adds freshness entry
- Top Adds freshness is therefore not part of the dashboard’s formal freshness audit model

## Yahoo Ownership Freshness Ownership

[update-yahoo-players.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-yahoo-players.ts):

- is scheduled at `08:40 UTC`
- currently runs with a static `?gameId=465`
- writes current ownership snapshots and timeline append data into `yahoo_players`

Operationally:

- the ownership writer is explicit
- the ownership APIs return cacheable JSON with `s-maxage=300`

But there are still ownership-policy gaps:

- the dashboard has no formal freshness threshold for ownership-backed components
- Top Adds only surfaces projection staleness, not ownership staleness

## Week-Mode Schedule Context Ownership

[TopAddsRail.tsx](/Users/tim/Code/fhfhockey.com/web/components/forge-dashboard/TopAddsRail.tsx) uses:

- `useSchedule(...)`
- which calls [lib/NHL/client/index.ts](/Users/tim/Code/fhfhockey.com/web/lib/NHL/client/index.ts)
- which calls `/api/v1/schedule/[startDate]`
- which calls [pages/api/v1/schedule/[startDate].ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/schedule/[startDate].ts)

That week-mode path is not cron-backed in the same way as projections or Yahoo ownership.

It is effectively:

- live NHL schedule fetch
- plus `expected_goals` lookup for odds enrichment inside [useSchedule.ts](/Users/tim/Code/fhfhockey.com/web/components/GameGrid/utils/useSchedule.ts)

This means week-mode Top Adds depends on a hybrid schedule context:

- live external schedule response
- local `expected_goals` enrichment

Current policy gap:

- there is no explicit Top Adds schedule-context freshness rule
- there is no Top Adds endpoint/runtime budget for the schedule path in [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)

## Ranking Input Ownership

[topAddsRanking.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/topAddsRanking.ts) is pure local logic.

Its inputs are:

- ownership delta
- ownership level
- projection points
- PPP
- shots
- hits
- blocks
- uncertainty
- optional week schedule context

This helper does not need cron ownership itself.

But the freshness of its inputs is mixed:

- ownership delta is fresher than projection support right now
- week-mode schedule context is fetched live and not governed by the same freshness policy

So ranking-input freshness is only partially governed even though the ranking code itself is deterministic.

## Runtime Expectations

Explicit current runtime expectations:

- `run-projection-v2`: `300000ms` cron timeout and default route budget `270000ms`
- `update-yahoo-players`: `100000ms` cron timeout
- `/api/v1/transactions/ownership-trends`: cached, but no endpoint budget entry
- `/api/v1/transactions/ownership-snapshots`: cached, but no endpoint budget entry
- `/api/v1/forge/players`: no endpoint budget entry
- `/api/v1/schedule/[startDate]`: cache `max-age=600`, but no dashboard budget entry

This is a real ownership weakness:

- the dashboard has explicit budget policy for slate, goalie, team-context, trend, and sustainability feeds
- it does not yet have the same explicit budget policy for the feeds that power Top Adds

## Ownership Findings

### 1. Top Adds has no formal dashboard freshness policy

[freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts) does not include:

- `/api/v1/forge/players`
- `/api/v1/transactions/ownership-trends`
- `/api/v1/transactions/ownership-snapshots`
- week-mode schedule context

So Top Adds is a first-class dashboard surface without a first-class freshness contract.

### 2. Top Adds has no formal endpoint-budget policy

[perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts) likewise omits the Top Adds-serving routes.

That means there is no explicit dashboard runtime/payload budget protecting:

- the projection feed
- the ownership trend feed
- the ownership snapshot feed
- the schedule feed used in week mode

### 3. Projection and ownership cadences are already drifting

Live data showed:

- latest FORGE run date `2026-03-14`
- latest Yahoo ownership date `2026-03-15`

The component can therefore be operational even while its inputs are out of step by a day.

### 4. Week mode is not owned like the rest of the component

Week mode adds real value, but its schedule context is effectively live-fetched and not described in the current cron/runbook as part of a Top Adds freshness chain.

### 5. The current cron/runbook names the jobs, but not the product surface

Projection and Yahoo jobs are scheduled, but there is no current artifact or policy layer that says:

- what Top Adds requires to be considered current
- whether projection lag or ownership lag is blocking versus cautionary
- whether week-mode schedule lag should degrade the card or the schedule term only

## Freshness-Ownership Verdict

Top Adds ownership clarity does not qualify for `green`.

Why it is not `red` on ownership clarity alone:

- the main projection writer is explicit
- the Yahoo ownership writer is explicit
- the rail exposes projection fallback through `asOfDate`
- the ranking helper is deterministic

Why it stays `yellow`:

- there is no formal freshness policy for the Top Adds surface
- there is no formal endpoint-budget policy for the Top Adds-serving routes
- the projection and ownership legs are already drifting in live data
- week-mode schedule context is only partially owned operationally

## Required Follow-Ups

- add Top Adds sources to [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts) with explicit stale thresholds and mixed-source handling rules
- add `/api/v1/forge/players`, `/api/v1/transactions/ownership-trends`, `/api/v1/transactions/ownership-snapshots`, and schedule-context coverage to [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)
- define whether same-day ownership plus prior-day projection data is acceptable as `yellow` or should block the Top Adds board
- document week-mode schedule-context freshness expectations explicitly, including whether stale `expected_goals` enrichment should degrade only the schedule term or the full card
