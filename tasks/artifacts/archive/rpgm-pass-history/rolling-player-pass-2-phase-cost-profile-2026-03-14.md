## Rolling Player Phase Cost Profile - 2026-03-14

### Goal

Identify the highest-cost phases inside `fetchRollingPlayerAverages.ts` and the surrounding orchestration flow so the next runtime tasks target the real bottlenecks instead of tuning blindly.

### Inputs Used

- daily-path benchmark:
  - [rolling-player-pass-2-daily-runtime-benchmark-2026-03-14.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-daily-runtime-benchmark-2026-03-14.md)
- overnight-path benchmark:
  - [rolling-player-pass-2-overnight-runtime-benchmark-2026-03-14.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-overnight-runtime-benchmark-2026-03-14.md)
- code inspection:
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
  - [run-rolling-forge-pipeline.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts)

### Phase Breakdown

#### 1. Bootstrap and global setup

- includes:
  - `fetchGames()`
  - `fetchPlayerIds(options)`
  - ledger construction
  - known-game-id set construction
- observed cost:
  - about `3.0s` on the daily one-day benchmark
  - about `2.8s` on the overnight season benchmark
- conclusion:
  - non-trivial fixed cost
  - not the main bottleneck by itself
  - matters more on incremental runs than on long sweeps because it is pure overhead

#### 2. Player-set selection

- current behavior:
  - both daily and overnight runs process the full filtered player list returned by `fetchPlayerIds(options)`
  - incremental date-scoped runs still iterate the full `2065`-player universe
- observed cost impact:
  - daily run processed `2065` players even though only `504` had rows
  - overnight run also processed `2065` players, but this was less dominant because many more players had real row volume
- conclusion:
  - this is the main avoidable cost on the daily path
  - it is the first place to attack for the sub-`4m30s` requirement

#### 3. Per-player fetch fanout

- current behavior:
  - `processPlayer(...)` fetches data per player and per strength (`all`, `ev`, `pp`, `pk`)
  - each strength does counts, rates, counts-on-ice, PP rows, and line rows before merge/derive
- observed cost:
  - daily one-day players commonly spent about `100ms` to `180ms` per active strength fetch block
  - overnight season players commonly spent about `100ms` to `700ms+` per strength fetch block depending on row volume
- conclusion:
  - fetch fanout is a meaningful contributor
  - it scales with row count and strength count
  - it becomes more important once daily player-set selection is narrowed

#### 4. Merge and derive

- current behavior:
  - merge cost is usually negligible
  - derive cost is small on one-day slices and moderate on season sweeps
- observed cost:
  - one-day derive steps were commonly `0ms` to `5ms`
  - season-sweep derive steps were commonly about `20ms` to `50ms` for larger strength slices
- conclusion:
  - merge is not a real bottleneck
  - derive is real work on broader sweeps, but it is still secondary to upsert and unnecessary player scanning

#### 5. Diagnostics

- current benchmark settings:
  - `skipDiagnostics=true`
- code behavior:
  - suspicious-output checks and derived-window diagnostics are skipped in the benchmarked path
- conclusion:
  - diagnostics are not part of the current measured hot path
  - they still matter for overnight/readiness workflows, but they are not the first target for the current runtime issue

#### 6. Upsert

- current behavior:
  - all writes flow through `upsertRollingPlayerMetricsBatch(...)`
  - writes are limited by `upsertConcurrency`
  - each player pauses for `20ms` after write completion
- observed daily behavior:
  - common batch shape was `4` rows
  - common write durations were about `150ms` to `185ms`
- observed overnight behavior:
  - common batch shape was roughly `168` to `260` rows
  - typical larger writes often took `2s` to `5s`
  - outlier single-player writes reached about `65s` and `66s`
- conclusion:
  - upsert is the dominant cost on broader sweeps
  - it is also the phase with the worst tail-latency behavior
  - this is the primary overnight optimization target

### Surrounding Orchestration Observations

- the consolidated coordinator currently invokes rolling recompute with:
  - `fastMode=true`
  - `startDate`
  - `endDate`
- this means the current overnight coordinator still relies on the same rolling writer path and tuning defaults as the daily coordinator
- operational implication:
  - daily and overnight orchestration are now distinct conceptually, but the rolling recompute stage still shares one tuning profile
  - later tasks should consider whether daily and overnight recompute need separate defaults or explicit mode-aware parameters

### Highest-Cost Findings

Ordered by practical impact:

1. Daily-path full-player scanning
- highest avoidable cost on incremental runs
- daily benchmark succeeded in `2m 8.986s`, but still touched all `2065` players to upsert only `2016` rows across `504` players with rows

2. Overnight upsert latency on large player batches
- biggest cost on broader season/backfill sweeps
- includes extreme tail latency above `60s` for some single-player batches

3. Per-strength fetch fanout
- secondary cost that grows with season scope and player row volume
- likely the next-largest contributor after player selection and upsert cost

4. Fixed bootstrap overhead
- stable `~3s` cost that matters mainly for incremental efficiency

5. Derive cost
- real but not primary

6. Merge cost
- effectively negligible compared with the other phases

### Recommended Next Focus

- `3.4` should target incremental player-set narrowing first.
- `3.5` should tune batching and concurrency with special attention to large-batch overnight upsert tails.
- `3.6` should emit separate daily and overnight timing summaries so future tuning can distinguish:
  - bootstrap
  - player selection
  - fetch
  - derive
  - upsert
