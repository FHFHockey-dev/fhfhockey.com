## Rolling Player Runtime Budget Reporting - 2026-03-14

### Goal

Add explicit runtime-budget reporting to the rolling recompute and coordinator surfaces so daily and overnight runs emit comparable operator-facing timing summaries.

### Implemented Reporting Surfaces

#### 1. Rolling recompute route

Updated [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts) so successful responses now include:

- `executionProfile`
- `runtimeBudget.budgetMs`
- `runtimeBudget.budgetLabel`
- `runtimeBudget.durationMs`
- `runtimeBudget.durationLabel`
- `runtimeBudget.withinBudget`

Execution-profile budgets:

- `daily_incremental`: `270000ms` (`4m 30s`)
- `overnight`: `1800000ms` (`30m 0s`)
- `targeted_repair`: `600000ms` (`10m 0s`)

#### 2. Rolling + FORGE coordinator route

Updated [run-rolling-forge-pipeline.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts) so top-level responses now include:

- `runtimeBudget.budgetMs`
- `runtimeBudget.budgetLabel`
- `runtimeBudget.durationMs`
- `runtimeBudget.durationLabel`
- `runtimeBudget.withinBudget`

Coordinator mode budgets:

- `daily_incremental`: `270000ms` (`04:30`)
- `overnight`: `5400000ms` (`90:00`)
- `targeted_repair`: `900000ms` (`15:00`)

### Why Two Layers

- the rolling recompute route needs its own budget because it is the main runtime-sensitive stage
- the coordinator needs a higher-level budget because operators care about whether the full daily or overnight chain stayed healthy and tractable

### Verification

- route tests:
  - [update-rolling-player-averages.test.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.test.ts)
- coordinator tests:
  - [run-rolling-forge-pipeline.test.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.test.ts)
- typecheck:
  - `npx tsc --noEmit --pretty false`

### Operational Interpretation

- daily and overnight runs now return an explicit in-budget / out-of-budget signal instead of only raw durations
- the daily budget is aligned to the stated `4m30s` requirement
- the broader overnight budget is intentionally looser and is meant to track operational drift without pretending the overnight chain should behave like a one-day incremental update
