## Rolling Player Daily Runtime Benchmark - 2026-03-14

### Goal

Benchmark the current rolling-player daily update path using the repaired writer and the same effective settings used by the current fast-mode path.

### Invocation

- execution path: `fetchRollingPlayerAverages.main(...)` invoked directly with `ts-node`
- slice: `startDate=2026-03-12`, `endDate=2026-03-12`
- effective settings:
  - `playerConcurrency=4`
  - `upsertConcurrency=4`
  - `batchSize=500`
  - `skipDiagnostics=true`

### Result

- total runtime: `128986ms`
- total runtime formatted: `2m 8.986s`
- processed players: `2065`
- players with rows: `504`
- rows upserted: `2016`
- coverage warnings: `0`
- suspicious-output warnings: `0`
- freshness blockers: `0`

### Runtime Notes

- The current daily path is under the stated `4m30s` incremental budget on this one-day slice.
- The main structural inefficiency is still present: a one-day run scans the full `2065`-player universe instead of first narrowing to players with relevant rows in the requested slice.
- Bootstrap cost was about `3.0s` before player processing started.
- The common write pattern for players with a single game on the selected day was one upsert batch of `4` rows (`all`, `ev`, `pp`, `pk`).
- Representative per-player upsert durations for those `4`-row batches were usually about `150ms` to `185ms`.
- Representative player totals for players with one active game on the selected day were commonly about `0.7s` to `0.8s` end to end once all strengths and the write phase were included.

### Operational Interpretation

- The current implementation meets the immediate daily runtime target on the measured slice.
- It does not yet meet the stronger efficiency goal implied by the pass-2 backlog, because the runtime still depends on scanning the whole player population even when only a small daily freshness window is requested.
- The next runtime-focused tasks should treat this benchmark as the baseline to beat by:
  - reducing unnecessary player scanning
  - minimizing work for players without rows in the incremental slice
  - preserving the current sub-`4m30s` result while creating more headroom for overnight orchestration and downstream FORGE freshness
