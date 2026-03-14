## pass-2 rolling upsert debugging controls

Sub-task: `1.2`

Date:

- `2026-03-12`

## Goal

Add a targeted logging and dry-run path to the rolling recompute writer so invalid payload columns, nullability mismatches, or over-wide row batches can be isolated without attempting a real `rolling_player_game_metrics` write.

## Implemented controls

Updated files:

- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
- [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts)

New write-path controls:

- `dryRunUpsert`
  - available on the internal `main(...)` options surface
  - available on the API route query string
  - behavior: derives rows normally, logs batch shape, skips `.upsert(...)`, and completes the run with `rowsUpserted: 0`
- `debugUpsertPayload`
  - available on the internal `main(...)` options surface
  - available on the API route query string
  - behavior: logs a summarized batch payload shape before the write attempt

## Added logging surfaces

### Upsert batch summary

When either `dryRunUpsert` or `debugUpsertPayload` is enabled, the writer logs:

- `playerId`
- `batchNumber`
- `totalBatches`
- `dryRunUpsert`
- `rowCount`
- `keyCountMin`
- `keyCountMax`
- `firstRowKeyCount`
- `unionKeyCount`
- `rowsDifferingFromFirst`
- `keysOutsideFirstRow`
- `firstRowIdentity`
- `sampleRowIdentities`
- `firstRowKeyPreview`

This is enough to detect:

- row-width explosions
- inconsistent key sets within a batch
- unexpected per-row shape drift
- which row identity anchors the failing batch

### Upsert failure detail

When an upsert still fails, the writer now logs a serialized failure object with:

- `playerId`
- `rows`
- `totalBatches`
- `rowsUpsertedSoFar`
- structured error fields extracted from the thrown object
- `ownKeys` so collapsed Supabase error objects can still be inspected consistently

## API route support

The recompute endpoint now accepts:

- `dryRunUpsert=true`
- `debugUpsertPayload=true`

These flags are:

- parsed from the request query
- included in trigger logging
- forwarded into the real rolling pipeline

## Verification run

Deterministic verification slice:

- player: `Brent Burns`
- `playerId`: `8470613`
- season: `20252026`
- options:
  - `skipDiagnostics: true`
  - `dryRunUpsert: true`
  - `debugUpsertPayload: true`

Execution method:

- direct `ts-node` invocation of [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
- no local Next.js server required

Observed write-phase result:

- derived rows prepared: `244`
- total batches: `1`
- `upsertBatchSummary` emitted successfully
- no `.upsert(...)` attempt made
- run completed with:
  - `rowsUpserted: 0`
  - `ok: true`

Captured batch summary highlights:

- `rowCount`: `244`
- `keyCountMin`: `941`
- `keyCountMax`: `941`
- `firstRowKeyCount`: `941`
- `unionKeyCount`: `941`
- `rowsDifferingFromFirst`: `0`
- `keysOutsideFirstRow`: `[]`
- first row identity:
  - `player_id=8470613`
  - `game_id=2025020003`
  - `game_date=2025-10-07`
  - `season=20252026`
  - `strength_state=all`

## Why this unblocks the next step

`1.1` proved the write path fails with a collapsed `Bad Request`.

`1.2` now provides a safe inspection path that can be used in `1.3` to:

- compare the derived row shape against the generated Supabase row contract
- narrow the failure to a specific column, type, or nullability mismatch
- inspect whether the batch width itself is acceptable before reattempting real writes
- validate future fixes without mutating target rows until the root cause is confirmed

## Result

Status:

- `PASS`

What this sub-task established:

- targeted rolling recomputes can now be run in a no-write validation mode
- batch payload shape is now observable before the failing upsert
- the Brent Burns repro slice completes successfully in dry-run mode
- `1.3` can focus on root-cause isolation and the real write fix rather than additional instrumentation
