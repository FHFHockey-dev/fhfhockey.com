# Ingest per-game isolation (2026-10-19)

Status: local only. Not committed, not pushed, no hosted DB/API/cron/NHL calls.

## Problem
`/api/v1/db/ingest-projection-inputs` stopped at the first game whose NHL shift
payload failed validation (`precheck_shifts`): empty feed ("No NHL shift rows
returned", games 2026020006–0053) or "Shift clock/duration mismatch" (0057).
Every later game was blocked; only 8 games refreshed.

## Change
`web/pages/api/v1/db/ingest-projection-inputs.ts`
- Only errors thrown by `buildShiftStrengthUpserts` (pure validation of the NHL
  shift payload against final PBP) are isolatable. Fetch errors, DB reads
  (`hasCompleteShiftTotals` now runs after validation), persistence,
  verification, normalization and cursor errors still stop the run as before.
- Isolated game: pushed to `errors` with `{gameId, date, stage, message,
  isolated: true}`, counted in `skipped` and new `skipReasons.sourceDataRejected`,
  `success` stays `false`, and the loop continues. `lastCompletedGameId` is not
  set for it; `nextGameId` is not held on it.
- Explicit runs (date range, `maxGames`, `resumeFromGameId`, `chunkDays`,
  `force`): always isolate. Range/resume semantics otherwise unchanged.
- Durable scheduled cursor: isolate only when the game date is ≤ today − 2 UTC
  days (`DURABLE_SOURCE_REJECTION_GRACE_DAYS`). Inside that window it holds the
  cursor exactly as before, because yesterday's shift feed may simply not be
  published yet. Once isolated, the cursor advances past it and the lease
  finishes `complete` if no blocking error/timeout occurred. A blocking error
  after an isolated one still fails the lease at the blocking game.
- Durable Gamecenter 404 behaviour is unchanged (fails closed).

## Cursor decision (report-only, no retry table)
No small existing table fits a per-game retry record: `projection_pipeline_state`
is one row per slate with a single `last_error` (cleared on `complete`), and the
input manifest only records completed inputs. Finishing the lease `failed` with
the cursor past the game would make `readOldestProjectionPipelineBacklog` pick
the same slate every run and starve newer slates. So: age-based grace, then
complete the slate and keep the game visible via
- the response/cron audit (`success:false`, `errors[].isolated`), which the
  rolling-forge orchestrator classifies as a failed step (conservative), and
- `run-projection-v2`'s `projection_input_ingest` preflight gate, which reads
  stored shift coverage and stays FAIL while the game lacks inputs.
Retry = an explicit date-range run. A durable per-game retry/backoff record
would need a migration; left as a follow-up.

## Not built
Optional fallback (reuse the stored shiftcharts snapshot when NHL returns an
empty feed): not small. It needs a new reader for the stored raw shift head and
a decision on whether a pre-correction snapshot is acceptable input. Follow-up.

## Policy note for Chef/TJ
Runs with isolated games return `success:false`, so the orchestrator still
stops downstream stages for that run. That is deliberate (missing inputs stay
visible); decide whether the recovery runs downstream stages manually.

## Verification
- `npx vitest run __tests__/pages/api/v1/db/ingest-projection-inputs.test.ts
  __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` — 48 passed.
- `npx eslint` on both changed files — passed.
- `tsc` — not run (no shared/exported types changed; `Result` is file-local).

## Release list
- `web/pages/api/v1/db/ingest-projection-inputs.ts`
- `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts`
  (5 new tests; "validates the complete shift payload…" now expects
  `nextGameId: 102` and `isolated: true`)
- this note (docs only)
