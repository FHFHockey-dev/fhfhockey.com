# FORGE Dashboard Goalie Freshness Ownership

## Status

- `red`

## Scope Audited

- [goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/forge/goalies.ts)
- [update-goalie-projections-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-goalie-projections-v2.ts)
- [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts)
- [goaliePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/goaliePipeline.ts)
- [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts)
- [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md)

## Ownership Question

This audit asks whether the goalie band’s freshness is:

- owned by an explicit projection chain
- sequenced correctly in cron/runbook terms
- covered by freshness and runtime expectations
- safe from cross-surface confusion with the separate Start Chart goalie chain

## Current Policy Coverage

Dashboard freshness policy exists in [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts):

- `forge-goalies`
  - `maxAgeHours = 30`
  - severity `error`

Runtime budget coverage also exists in [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts):

- `/api/v1/forge/goalies`
  - `maxPayloadBytes = 220000`
  - `targetP95Ms = 800`

## Two Distinct Goalie Chains

The goalie ecosystem is currently split across two downstream consumers:

### 1. Start Chart goalie chain

- writer: [update-goalie-projections-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-goalie-projections-v2.ts)
- table: `goalie_start_projections`
- consumer: Start Chart / slate surfaces

### 2. FORGE goalie band chain

- writer: [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts)
- tables:
  - `forge_runs`
  - `forge_goalie_projections`
- consumer: `/api/v1/forge/goalies`

That distinction matters because a healthy Start Chart goalie prior does not automatically mean a healthy FORGE goalie band, and vice versa.

## Declared Pipeline Ownership

[goaliePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/goaliePipeline.ts) defines the intended chain as:

1. core roster/schedule
2. line combinations
3. projection input ingest
4. projection derived v2
5. goalie start priors v2
6. projection run v2
7. projection accuracy

In that declared model:

- `goalie_start_priors_v2`
  - endpoint `/api/v1/db/update-goalie-projections-v2`
  - depends on `projection_derived_v2`
- `projection_run_v2`
  - endpoint `/api/v1/db/run-projection-v2`
  - depends on `goalie_start_priors_v2`

## Actual Cron Ownership

Current scheduled jobs in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md):

- `09:30 UTC`
  - `update-goalie-projections-v2`
- `09:45 UTC`
  - `ingest-projection-inputs`
- `09:50 UTC`
  - `build-forge-derived-v2`
- `10:05 UTC`
  - `run-forge-projection-v2`

This means the actual runbook order does not match the declared pipeline order:

- `update-goalie-projections-v2` runs before:
  - `ingest-projection-inputs`
  - `build-projection-derived-v2`

That mismatch is an ownership clarity problem even if the old goalie-start writer does not strictly require those newer derived tables.

## Live Source Evidence

Live `/api/v1/forge/goalies` evidence:

- `requestedDate = 2026-03-28`
- `requested.scheduledGamesOnDate = 15`
- `requested.rowCount = 0`
- `resolved.date = 2026-03-26`
- `resolved.rowCount = 4`
- `fallbackApplied = true`

This shows the FORGE goalie chain is not currently producing requested-date coverage for the active slate.

## Preflight Ownership Evidence

[run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts) has explicit preflight gates for:

- core roster and scheduled games
- line combinations
- projection input ingest
- derived projection inputs
- goalie start priors
- stale goalie-game rows

Notable gate detail:

- `goalie_start_priors_v2`
  - checks `goalie_start_projections` rows for scheduled games
  - instructs operators to run `/api/v1/db/update-goalie-projections-v2?date={asOfDate}`

So the FORGE projection run formally depends on the older goalie-start table even though the serving band ultimately reads `forge_goalie_projections`.

## Ownership Verdict

Why this chain is `red`:

- the live FORGE goalie route is currently fallback-driven with incomplete requested-date coverage
- the cron order does not match the declared goalie pipeline order
- the runbook still couples the FORGE goalie chain to `goalie_start_projections`
- the broader goalie system is split across two different downstream tables and consumers
- freshness policy exists, but the live route is already violating it materially

## What Is Working

- the goalie band has explicit freshness-policy coverage
- the goalie band has explicit endpoint-budget coverage
- the FORGE run path has real preflight gates
- the serving route has high-signal diagnostics
- the runbook does contain named scheduled jobs for both:
  - `update-goalie-projections-v2`
  - `run-forge-projection-v2`

## What Is Failing

### 1. Requested-date coverage is currently broken

The route had no rows for the requested live date and had to fall back.

### 2. Declared pipeline order and actual cron order do not match

That creates ambiguity about what the true source-of-truth dependency chain is.

### 3. The goalie ecosystem is split across two output tables

This makes ownership harder to reason about operationally:

- `goalie_start_projections`
- `forge_goalie_projections`

### 4. Start Chart and FORGE goalie freshness can drift independently

One can fail while the other appears usable, which raises the operational burden and increases the chance of mixed health states.

## Required Follow-Ups

- decide whether the declared goalie pipeline order in [goaliePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/goaliePipeline.ts) or the current cron order is the real source of truth
- align cron/runbook ordering with the chosen ownership model
- trace why `run-projection-v2` is not yielding requested-date goalie rows for the active slate
- add explicit coverage checks for `forge_goalie_projections` by requested date, not just route-level fallback behavior
- keep `/api/v1/forge/goalies` quarantined until requested-date coverage is reliable and the chain order is operationally coherent
