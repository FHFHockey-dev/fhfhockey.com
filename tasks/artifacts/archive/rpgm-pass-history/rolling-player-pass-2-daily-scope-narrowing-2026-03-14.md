## Rolling Player Daily Scope Narrowing - 2026-03-14

### Goal

Reduce avoidable recompute work for daily updates by limiting date-scoped incremental runs to the player set that actually appears in the requested WGO slice.

### Implementation

- changed `fetchPlayerIds(options)` in [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
- new behavior:
  - if the run is date-scoped (`startDate` and/or `endDate`)
  - and it is not a full refresh
  - and it is not a single-player recompute
  - then player selection comes from `wgo_skater_stats` for the requested slice instead of the full `players` table
- goalie exclusion is still enforced by validating the candidate ids against the `players` table
- season-only and full-refresh style runs keep the existing broad player-selection behavior

### Verification

- unit coverage:
  - [fetchRollingPlayerAverages.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts)
  - added coverage for:
    - date-scoped selection rule
    - normalized sorted unique player-id handling
- typecheck:
  - `npx tsc --noEmit --pretty false`
- live daily rerun:
  - slice: `2026-03-12` to `2026-03-12`
  - settings: `playerConcurrency=4`, `upsertConcurrency=4`, `batchSize=500`, `skipDiagnostics=true`

### Before / After

- before:
  - processed players: `2065`
  - players with rows: `504`
  - runtime: `128986ms`
- after:
  - processed players: `504`
  - players with rows: `504`
  - runtime: `99763ms`

### Impact

- eliminated `1561` unnecessary player passes on the measured one-day slice
- reduced runtime by `29223ms`
- reduced runtime by about `22.7%`
- preserved the same row output count:
  - `2016` rows upserted before
  - `2016` rows upserted after

### Operational Interpretation

- this change improves the daily incremental path directly without changing broader season/backfill semantics
- it creates more headroom under the `4m30s` daily budget
- overnight tuning still needs separate work because its dominant bottleneck is large-batch write cost, not incremental player selection
