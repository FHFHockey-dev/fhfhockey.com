# Operator Runbook

Date: `2026-03-14`
Task: `5.5`

## Purpose

Answer the three operator questions directly:

1. what runs overnight
2. what runs in the daily incremental path
3. what the minimal cron / job surface is for keeping FORGE fresh

This runbook is intentionally short and operator-facing. Detailed dependency reasoning remains in:

- [rolling-player-pass-2-refresh-entrypoint-inventory-2026-03-14.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-entrypoint-inventory-2026-03-14.md)
- [rolling-player-pass-2-refresh-dependency-graph-2026-03-14.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-dependency-graph-2026-03-14.md)

## What Runs Overnight

Use:

- `GET /api/v1/db/run-rolling-forge-pipeline?mode=overnight&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

Overnight mode is the full end-to-end freshness chain:

1. core entity freshness
   - games
   - teams
   - players
2. upstream skater-source freshness
   - NST gamelog
   - WGO freshness phase
3. contextual builders
   - line combinations
   - PP context builder phase
4. rolling-player recompute
5. projection-input ingest
6. projection-derived build
7. projection execution
   - goalie priors
   - FORGE run
8. downstream projection consumers and evaluation
   - start-chart refresh
   - projection accuracy when included
9. monitoring / reporting

Use overnight mode when:

- the date window is broad
- upstream source freshness may have drifted
- you need the full FORGE chain refreshed, not only rolling-player rows
- you are catching up after missed daily runs

## What Runs In The Daily Incremental Path

Use:

- `GET /api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&date=YYYY-MM-DD`

Daily incremental mode is the constrained freshness path designed around the sub-`4m30s` rolling budget:

1. date-scoped upstream freshness for the current slice
2. contextual builders only for the current slice
3. rolling-player recompute using the narrowed WGO-backed player set
4. projection ingest / derived / execution for the same current slice
5. optional downstream refreshes only when needed
6. monitoring / reporting

Daily mode is designed for:

- current-day correctness
- small date windows
- avoiding full-player scans
- keeping the operator surface to one main job instead of many route-level jobs

## Minimal Cron / Job Surface

The minimal operator-facing job surface should be:

1. daily incremental coordinator
   - `GET /api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&date=YYYY-MM-DD`
2. overnight coordinator
   - `GET /api/v1/db/run-rolling-forge-pipeline?mode=overnight&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
3. monitoring / reporting
   - `GET /api/v1/db/cron-report`

That is the preferred long-term job surface for keeping rolling-player metrics and FORGE fresh.

## What Should Not Become Separate Cron Jobs

These should remain implementation primitives or repair helpers, not independent long-term cron surfaces:

- single-game PP builder route
- single-game line-combination route
- legacy multi-step stats cron surface
- individual WGO split routes as separate operator jobs
- ad hoc validation/debug endpoints

## Operational Guidance

### If the goal is daily freshness

- run the daily coordinator
- do not schedule a long list of builder-specific jobs
- treat the coordinator as the source of truth for phase order

### If the goal is overnight recovery or broad refresh

- run the overnight coordinator
- use date ranges intentionally
- let the coordinator own stage ordering, skip logic, and reporting

### If validation is blocked

- first check `cron-report`
- then check retained validation freshness scripts or `trendsDebug.tsx`
- only use helper routes directly for targeted repair, not as routine operator workflow

## Net Outcome

The preferred operating model is now:

- one daily job
- one overnight job
- one monitoring job

That keeps the cron surface small while still supporting:

- overnight full-chain freshness
- daily incremental updates under the rolling budget target
- a manageable path for keeping FORGE fresh without route sprawl
