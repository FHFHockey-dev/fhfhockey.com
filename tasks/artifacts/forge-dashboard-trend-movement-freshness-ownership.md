# FORGE Dashboard Trend Movement Freshness Ownership

## Status

- `red`

## Scope Audited

- [skater-power.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/skater-power.ts)
- [player-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/player-trends.ts)
- [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts)
- [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md)
- [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts)

## Ownership Question

This audit asks whether skater trend movement freshness is:

- backed by an explicit writer
- actually represented in the cron/runbook surface
- covered by dashboard freshness and runtime expectations
- safe from mixed-cadence drift once ownership-band filtering is applied

## Current Policy Coverage

Dashboard freshness policy exists in [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts):

- `skater-power`
  - `maxAgeHours = 72`
  - severity `warn`

Runtime budget coverage also exists in [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts):

- `/api/v1/trends/skater-power`
  - `maxPayloadBytes = 280000`
  - `targetP95Ms = 900`

So the dashboard policy layer assumes this is a real maintained trend surface.

## Writer Ownership

The obvious writer for `player_trend_metrics` is [player-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/player-trends.ts):

- `POST`
  - loads skater and goalie unified stats
  - builds trend records through `buildPlayerTrendRecords(...)`
  - upserts into `player_trend_metrics`
- `GET`
  - reads from `player_trend_metrics`

This confirms the source table is not magical or computed inline by the serving route. It has a distinct rebuild surface.

## Cron Ownership Gap

I found no active cron entry in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md) for:

- `/api/v1/trends/player-trends`
- any named `player_trend_metrics` rebuild job

There is only a comment under the dashboard section:

- `https://fhfhockey.com/api/v1/trends/player-trends`

That is documentation residue, not scheduled ownership.

So the movement surface currently has:

- a serving endpoint
- a writer endpoint
- freshness/budget policy

but no explicit scheduled refresh chain tying those together.

## Live Source Evidence

Direct live response from `/api/v1/trends/player-trends?limit=5` returned:

- `success = true`
- rows from:
  - `game_date = 2025-10-16`
  - `updated_at = 2025-10-17T15:27:25.317857+00:00`

Sample returned records included:

- `metric_key = shooting_percentage`
- `metric_key = ixg_total`
- `metric_key = shots_per_60`
- `metric_key = ixg_per_60`
- `metric_key = primary_points_pct`

That is strong evidence that the source table being served by the writer route is materially stale.

## Serving Route Freshness Problem

[skater-power.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/skater-power.ts):

- reads `player_trend_metrics`
- computes rankings and series
- sets:
  - `generatedAt: new Date().toISOString()`

So the serving layer currently:

- does not expose source freshness
- does not expose latest source game date
- does not expose latest source `updated_at`
- does present a fresh-looking `generatedAt`

This is a severe ownership problem because the policy layer cannot audit true trend freshness from the route contract.

## Mixed-Cadence Risk With Ownership Filtering

The movement card also overlays Yahoo ownership through [playerOwnership.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/playerOwnership.ts).

That introduces a second cadence:

- stale or unscheduled `player_trend_metrics`
- plus the already-known Yahoo season-label mismatch

So even if the movement source were repaired, the filtered candidate pool could still be distorted by null ownership values.

## Ownership Verdict

Why this chain is `red`:

- the underlying writer endpoint exists, but it is not represented in cron ownership
- live source evidence from `/api/v1/trends/player-trends` is materially stale
- the serving route manufactures `generatedAt` at request time instead of surfacing source freshness
- dashboard freshness policy relies on that synthetic timestamp
- the ownership-band overlay adds a second unresolved mixed-cadence failure mode

## What Is Working

- the movement surface has an identifiable writer endpoint
- the movement surface has dashboard freshness-policy coverage
- the movement surface has endpoint-budget coverage
- the serving route is operational and returns structured rankings

## What Is Failing

### 1. No explicit cron ownership for the trend writer

The rebuild path for `player_trend_metrics` is not scheduled in the runbook.

### 2. Live source evidence is stale

The writer route’s own read path returned rows from October, which is incompatible with a healthy current-season movement surface.

### 3. Synthetic freshness masks the stale source

`generatedAt` represents request time, not trend-source recency.

### 4. Mixed-cadence ownership overlay remains unresolved

The same Yahoo season mismatch from other player-discovery surfaces still applies here.

## Required Follow-Ups

- add explicit cron/runbook ownership for [player-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/player-trends.ts) or the real writer that is meant to replace it
- surface true `player_trend_metrics` freshness in [skater-power.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/skater-power.ts)
- verify whether the trend table is genuinely stale in storage or whether the writer route is reading the wrong slice/order
- stop using request-time `generatedAt` as the dashboard freshness source for trend movement
- keep both `/api/v1/trends/skater-power` and `/api/v1/trends/player-trends` quarantined until writer ownership and source freshness are real
