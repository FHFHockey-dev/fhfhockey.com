## pass-2 rolling upsert regression tests

Sub-task: `1.5`

Date:

- `2026-03-12`

## Goal

Add regression coverage for the repaired rolling recompute write path so the wide-table `rolling_player_game_metrics` transport fix stays protected and malformed upsert responses remain diagnosable.

## Updated files

- [fetchRollingPlayerAverages.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts)
- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)

## Added coverage

### Successful direct PostgREST batch upsert

New regression test:

- verifies `upsertRollingPlayerMetricsBatch(...)` posts a wide rolling row payload to:
  - `/rest/v1/rolling_player_game_metrics?on_conflict=player_id,game_date,strength_state`
- verifies the request uses the expected headers:
  - `apikey`
  - `Authorization`
  - `Content-Type`
  - `Prefer: resolution=merge-duplicates,return=minimal`
- verifies the JSON body contains the original batch payload unchanged

What this protects:

- the transport-path fix for wide `rolling_player_game_metrics` rows
- accidental reintroduction of the Supabase client `upsert()` path for this table
- header drift that would break merge-duplicate behavior

### Structured failure propagation for malformed upsert responses

New regression test:

- mocks a `400 Bad Request` response body containing:
  - `message`
  - `code`
  - `details`
  - `hint`
- verifies the thrown error preserves:
  - the original message
  - `code`
  - `details`
  - `hint`
  - `status`
  - `statusCode`
  - raw `responseText`

What this protects:

- future debugging quality when a bad column or bad payload reaches the direct writer
- the retry/logging layer’s ability to surface useful structured failure detail instead of collapsing everything to an opaque error

## Testability change

To support this focused regression coverage, the direct writer helper is now exported through:

- `__testables.upsertRollingPlayerMetricsBatch`

This keeps the tests narrow:

- no live Supabase dependency
- no full rolling recompute mocking stack
- direct coverage of the repaired transport boundary

## Verification

Targeted verification:

- `npm test -- --run lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
- result: `PASS`

Typecheck:

- `npx tsc --noEmit --pretty false`
- result: `PASS`

## Result

Status:

- `PASS`

What this sub-task established:

- the repaired write transport now has direct regression coverage
- malformed direct-upsert responses preserve the structured fields needed for diagnosis
- the recompute-reliability phase can now be closed with both live verification and local regression protection
