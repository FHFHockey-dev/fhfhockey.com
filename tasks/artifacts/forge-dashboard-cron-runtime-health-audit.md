# FORGE Dashboard Cron And Runtime Health Audit

## Status

- `red`

## Goal

Document the actual scheduled ownership, declared runtime expectations, and likely operational bottlenecks across the component chains that feed the FORGE dashboard and route family.

## Current Scheduled Ownership

Relevant cron/runbook entries currently exist for:

- `update-yahoo-players`
- `update-team-ctpi-daily`
- `update-team-power-ratings`
- `update-team-power-ratings-new`
- `update-goalie-projections-v2`
- `update-start-chart-projections`
- `ingest-projection-inputs`
- `build-projection-derived-v2`
- `run-forge-projection-v2`
- `update-nst-team-daily`
- `nst-team-stats`
- sustainability rebuild chain:
  - `rebuild-baselines`
  - `rebuild-priors`
  - `rebuild-window-z`
  - `rebuild-score`
  - `rebuild-trend-bands`

## Declared Runtime / Budget Signals

Current explicit policy helpers include:

- [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)
  - endpoint payload budgets for several dashboard APIs
- [rollingPlayerOperationalPolicy.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerOperationalPolicy.ts)
  - rolling/daily/overnight budgets:
    - `daily_incremental = 270000ms`
    - `overnight = 1800000ms`
    - pipeline `overnight = 5400000ms`
- cron report / benchmark helpers already present in:
  - `lib/cron/*`

## Main Operational Problems

### 1. Team Context Schedule Order Is Wrong

Current cron order in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md):

- `09:10` `update-team-ctpi-daily`
- `09:12` `update-team-power-ratings`
- `09:13` `update-team-power-ratings-new`
- `09:55` `update-nst-team-daily`
- `nst-team-stats` later in the newer static block

But the audited dependency graph requires the NST/WGO team sources first.

Operational consequence:

- outputs can look current by date while still being derived from stale upstream team inputs

### 2. Goalie / FORGE Projection Order Is Also Wrong

Declared pipeline order in [goaliePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/goaliePipeline.ts):

1. core roster/schedule
2. line combinations
3. projection input ingest
4. projection derived v2
5. goalie start priors v2
6. projection run v2
7. projection accuracy

Current cron order:

- `09:30` `update-goalie-projections-v2`
- `09:40` `update-start-chart-projections`
- `09:45` `ingest-projection-inputs`
- `09:50` `build-projection-derived-v2`
- `10:05` `run-forge-projection-v2`

Operational consequence:

- goalie priors are being refreshed before their declared derived-input dependency
- the goalie and slate ecosystems can both inherit stale or incomplete upstream state

### 3. Trend Movement Still Has No Real Scheduled Owner

The trend audit found no active cron entry for the apparent `player_trend_metrics` writer:

- [player-trends.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/player-trends.ts)

Operational consequence:

- trend movement freshness is not truly owned even though the dashboard depends on it

### 4. Budget Policy Is Incomplete For Top Adds

Missing explicit endpoint budgets in [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts) for:

- `/api/v1/forge/players`
- `/api/v1/transactions/ownership-trends`
- `/api/v1/transactions/ownership-snapshots`

Operational consequence:

- one of the most interaction-heavy dashboard surfaces still lacks a first-class payload/runtime policy

## Bottleneck / Risk Summary By Component Family

### Slate / Goalie

- most sensitive to schedule ordering
- vulnerable to mismatched requested-date vs resolved-date coverage

### Team Context

- most sensitive to wrong upstream order plus stale-source masking
- duplicated team-power writers add surface complexity without reducing uncertainty

### Top Adds

- freshness chain exists, but policy coverage is incomplete
- live staleness/fallback issues are still bleeding into the user-facing route family

### Sustainability

- cron ownership exists
- runtime chain is explicit
- but scheduled ownership alone is not preventing continuity holes

### Trend Movement

- weakest operational ownership of the audited set

## Overall Assessment

Cron/runtime health is `red`.

Not because the system has no schedule surface. It does.

It is `red` because the current schedule surface still fails three critical standards:

- some chains are ordered incorrectly
- some important chains are still unowned
- some important endpoints are still outside explicit budget policy

## Required Follow-Ups

- reorder team-context jobs so NST/WGO team inputs precede CTPI and team-power writers
- align cron order with the declared goalie/forge pipeline order
- add explicit scheduled ownership for the trend-movement writer or document the true owner if it is elsewhere
- extend payload/runtime policy to the Top Adds dependency endpoints
