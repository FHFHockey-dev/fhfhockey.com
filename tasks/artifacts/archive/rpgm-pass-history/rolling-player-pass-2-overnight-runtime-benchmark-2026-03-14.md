## Rolling Player Overnight Runtime Benchmark - 2026-03-14

### Goal

Benchmark the broader overnight/backfill-oriented rolling-player recompute path separately from the one-day daily slice so runtime budgets can be tracked independently.

### Invocation

- execution path: `fetchRollingPlayerAverages.main(...)` invoked directly with `ts-node`
- scope: `season=20252026`
- effective settings:
  - `playerConcurrency=4`
  - `upsertConcurrency=4`
  - `batchSize=500`
  - `skipDiagnostics=true`
  - `forceFullRefresh=false`

### Result

- total runtime: `1305843ms`
- total runtime formatted: `21m 45.843s`
- processed players: `2065`
- players with rows: `886`
- rows upserted: `146588`
- coverage warnings: `0`
- suspicious-output warnings: `0`
- freshness blockers: `0`

### Runtime Notes

- This overnight-oriented season sweep is about `10.1x` slower than the one-day daily benchmark (`21m 45.843s` versus `2m 8.986s`).
- The run still processed the full `2065`-player universe, but the heavier overnight cost comes from much larger per-player row sets, not just the player scan.
- Representative player batches commonly ranged from roughly `168` to `260` rows in a single upsert batch.
- Some season-sweep upserts were materially slow, including observed single-player batches taking about `65s` and `66s`.
- Late in the run, more typical larger-player upserts were still often in the `2s` to `5s` range.

### Operational Interpretation

- The current overnight-style rolling recompute is operationally viable, but it is not in the same budget class as the daily incremental path and should not share the same runtime target.
- Daily and overnight flows need separate runtime budgets, separate timing summaries, and probably separate optimization tactics.
- The main follow-on areas for profiling and reduction are:
  - player-selection scope for incremental runs
  - large per-player season fetch/derive costs
  - slow upsert behavior on larger player batches
- This benchmark should be treated as the current overnight baseline for later tuning work, while the daily benchmark remains the baseline for the sub-`4m30s` target.
