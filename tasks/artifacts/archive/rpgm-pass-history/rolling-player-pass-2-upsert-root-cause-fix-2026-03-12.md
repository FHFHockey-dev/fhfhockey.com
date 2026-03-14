## pass-2 rolling upsert root cause and fix

Sub-task: `1.3`

Date:

- `2026-03-12`

## Goal

Fix the targeted `rolling_player_game_metrics` upsert failure and verify that a player-specific rolling recompute can write fresh rows again.

## Root-cause isolation

Deterministic slice:

- player: `Brent Burns`
- `playerId`: `8470613`
- season: `20252026`
- target row identity used for focused inspection:
  - `game_date=2025-10-07`
  - `strength_state=all`

What was ruled out:

- schema drift between the derived row and the live table
  - derived key count: `941`
  - live selected row key count: `942`
  - only live-only key: `updated_at`
- non-finite numeric values
- unsupported object, boolean, bigint, symbol, or function payload values
- row-specific data corruption limited to a later batch row
  - a single-row `supabase.from(...).upsert([row])` failed on the very first Brent Burns row with the same collapsed `Bad Request`

Transport check that isolated the actual failure mode:

- minimal `supabase.from("rolling_player_game_metrics").upsert([identityOnlyRow])`
  - result: `success`
- full-width `supabase.from("rolling_player_game_metrics").upsert([fullRow])`
  - result: `Bad Request`
- full-width direct PostgREST `fetch(...)` to:
  - `/rest/v1/rolling_player_game_metrics?on_conflict=player_id,game_date,strength_state`
  - result: `200 OK`

Conclusion:

- the full rolling row payload is valid
- the live table accepts the same full payload over direct PostgREST
- the failure was caused by the client-side `upsert()` transport path for this extremely wide table, not by rolling math, row values, or schema mismatch
- the most likely trigger is the generated wide-column request shape from the Supabase query builder, which becomes unsafe at the current `rolling_player_game_metrics` column surface

## Implemented fix

Updated file:

- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)

Change:

- replaced the final `supabase.from("rolling_player_game_metrics").upsert(...)` call with a dedicated direct PostgREST batch upsert helper

Helper behavior:

- `POST` to:
  - `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rolling_player_game_metrics?on_conflict=player_id,game_date,strength_state`
- headers:
  - `apikey`
  - `Authorization: Bearer ...`
  - `Content-Type: application/json`
  - `Prefer: resolution=merge-duplicates,return=minimal`
- body:
  - JSON batch payload only
- failure handling:
  - parses JSON error bodies when present
  - captures `code`, `details`, `hint`, `status`, `statusCode`, and raw `responseText`
  - rethrows a structured error so existing retry/logging behavior still works

What stayed the same:

- rolling fetch / merge / derive logic
- batching
- retry behavior
- slow-operation logging
- dry-run and payload-summary debugging controls from `1.2`

## Verification

### Typecheck

- `npx tsc --noEmit --pretty false`
- result: `PASS`

### Targeted live recompute

Command path:

- direct `ts-node` execution of the real `main(...)` pipeline

Result:

- Brent Burns targeted recompute completed successfully
- rows prepared: `244`
- total batches: `1`
- rows written: `244`
- upsert phase duration: `4517ms`
- final result:

```json
{
  "ok": true
}
```

Observed completion summary:

- `rowsUpserted: 244`
- `processedPlayers: 1`
- `playersWithRows: 1`
- `coverageWarnings: 0`
- `suspiciousOutputWarnings: 0`
- `unknownGameIds: 0`
- `freshnessBlockers: 0`

## Result

Status:

- `PASS`

What this sub-task established:

- the targeted rolling recompute failure is fixed
- the blocker was a wide-table client upsert transport issue, not bad rolling data
- the rolling writer can now write fresh Brent Burns rows again through the real recompute path
- `1.4` can proceed with rerunning the blocked March 12 player examples against the repaired write path
