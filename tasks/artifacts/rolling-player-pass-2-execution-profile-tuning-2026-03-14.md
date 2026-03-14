## Rolling Player Execution Profile Tuning - 2026-03-14

### Goal

Tune batching and concurrency defaults so daily incremental runs keep their fast settings while broader overnight-style recomputes stop inheriting the same write pressure by default.

### Implementation

Added explicit rolling recompute execution profiles in [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts):

- `daily_incremental`
  - `playerConcurrency=4`
  - `upsertBatchSize=500`
  - `upsertConcurrency=4`
  - `skipDiagnostics=true`
- `overnight`
  - `playerConcurrency=4`
  - `upsertBatchSize=250`
  - `upsertConcurrency=2`
  - `skipDiagnostics=true`
- `targeted_repair`
  - `playerConcurrency=4`
  - `upsertBatchSize=500`
  - `upsertConcurrency=4`
  - `skipDiagnostics=true`

### Resolution Rules

- explicit query params still win
  - `playerConcurrency`
  - `upsertBatchSize`
  - `upsertConcurrency`
  - `skipDiagnostics`
- explicit `executionProfile` is honored when present
- when `fastMode=true` and `executionProfile` is omitted, the route now infers a profile:
  - `playerId` => `targeted_repair`
  - season-only or full-refresh style runs => `overnight`
  - date-scoped runs => `daily_incremental`

### Coordinator Alignment

Updated [run-rolling-forge-pipeline.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts) so the consolidated coordinator passes:

- `executionProfile=daily_incremental` for daily runs
- `executionProfile=overnight` for overnight runs
- `executionProfile=targeted_repair` for targeted repair runs

This keeps the operational orchestration surface explicit and avoids relying on route-side inference alone.

### Rationale

- the daily path is already under the `4m30s` budget and benefits from higher write concurrency
- the overnight season-sweep benchmark showed materially larger per-player batches and very slow write outliers
- reducing overnight default write pressure is a safer default than letting season-scope runs inherit the same `4`-way upsert concurrency used for one-day incremental updates

### Verification

- route tests:
  - [update-rolling-player-averages.test.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.test.ts)
- coordinator tests:
  - [run-rolling-forge-pipeline.test.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.test.ts)
- typecheck:
  - `npx tsc --noEmit --pretty false`

### Operational Interpretation

- daily and overnight recomputes now have a first-class policy split instead of one shared fast-mode tuning assumption
- this does not finish runtime work by itself
- it gives the remaining steps a cleaner base for:
  - runtime-budget reporting
  - future nightly tuning
  - protecting the daily path without overdriving broader sweeps
