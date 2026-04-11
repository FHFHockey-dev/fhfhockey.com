# Failure Handling Policy

## Purpose

This document defines retry, error logging, and partial-failure handling for the NHL API ingestion pipeline.

It covers failures caused by:

- upstream API instability
- malformed payloads
- parser failures
- Supabase schema mismatches
- partial batch failure during current-season runs or historical backfills

## Failure Classes

### 1. Retryable Upstream Fetch Failures

Examples:

- timeout
- aborted request
- socket reset
- transient `fetch failed`
- HTTP `429`
- HTTP `500`
- HTTP `502`
- HTTP `503`
- HTTP `504`

Policy:

- retry automatically
- use bounded retry count
- use increasing delay between attempts
- treat the failure as upstream, not parser or DB failure

Current implementation status:

- already present in `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`
- defaults today:
  - `DEFAULT_FETCH_RETRIES = 3`
  - `DEFAULT_FETCH_TIMEOUT_MS = 20000`
  - `DEFAULT_RETRY_DELAY_MS = 500`

### 2. Non-Retryable Upstream Failures

Examples:

- HTTP `400`
- HTTP `401`
- HTTP `403`
- HTTP `404`
- clearly invalid endpoint selection

Policy:

- do not retry automatically
- log the failure once with endpoint, game id, and status code
- mark the game failed for that run

### 3. Malformed Payload Failures

Examples:

- payload missing expected top-level objects
- `plays` is not an array for `play-by-play`
- `shiftcharts.data` is not an array
- required game identity fields are missing or invalid

Policy:

- do not blindly retry if the payload shape is already malformed
- classify as payload-shape failure
- store enough context to debug the upstream shape change
- do not mark the game complete

### 4. Parser Failures

Examples:

- unexpected event shape that throws during normalization
- broken `situationCode` decoding assumptions
- invalid field coercion that prevents row construction

Policy:

- fail the affected game
- preserve raw payloads if they were fetched successfully
- do not treat as a successful ingest just because raw archival worked
- capture parser version and failing stage in the audit details

### 5. Schema Or Database Failures

Examples:

- missing column
- failed upsert
- constraint violation
- permission issue
- view or table drift between code and project schema

Policy:

- fail the affected game or batch immediately if the error is systemic
- do not continue blindly if every later game would hit the same schema mismatch
- capture the exact table, conflict target, and DB error message

## Retry Policy

### Retry Scope

Retries apply only to upstream fetches.

Do not automatically retry:

- malformed payloads that already arrived successfully
- parser exceptions
- schema mismatch errors

### Retry Budget

Current default:

- up to 3 attempts per upstream fetch

Required future behavior:

- keep retry count configurable
- log attempt number and final exhaustion reason
- include endpoint URL in the final failure detail

### Backoff

Current default:

- linear delay using `retryDelayMs * attempt`

Acceptable near-term policy:

- current linear backoff is acceptable for phase 1

Preferred later policy:

- jittered backoff for large batch runs to avoid synchronized retry bursts

## Partial-Failure Handling

### Single-Game Mode

If a single targeted game fails:

- return failure for that request
- do not mark the game complete
- preserve any successfully archived raw payloads
- allow later rerun of the same game without manual cleanup

### Multi-Game Batch Mode

If one game fails in a batch:

- continue processing later games when the failure is game-local
- record per-game success and failure results
- return both succeeded and failed game ids
- do not report the batch as a clean success if any game failed

### Systemic Failure Rule

If the failure is clearly systemic, stop the batch early.

Examples:

- missing required DB column
- broken auth to Supabase
- parser crash affecting all games

Reason:

- continuing would only multiply noise and partial writes

## Required Logging Fields

Every failed run or failed game should log:

- route name
- mode:
  - `game`
  - `date_range`
  - `backfill_batch`
- requested game ids or range
- failing game id
- failing endpoint when applicable
- failure class
- status code when applicable
- parser version
- strength version
- feature version when applicable later
- parity version when applicable later
- retry attempt count for upstream failures
- raw response summary or error message

## Cron Audit Contract

Current routes already use `withCronJobAudit`, which captures:

- method
- URL
- status code
- duration
- serialized response
- thrown error message
- inferred `rows_affected`

Required additions for NHL batch routes:

- include succeeded game ids
- include failed game ids
- include failure class per failed game when available
- include whether the batch was partial success versus full success

## Response Contract For Failed Or Partial Runs

Structured responses should include:

- `success`
- `mode`
- `requestedGameCount`
- `processedGameCount`
- `succeededGameIds`
- `failedGameIds`
- `rowsUpserted`
- `partialFailure`
- `message`

If a failure is per-game, include a per-game result object with:

- `gameId`
- `status`
- `stage`
- `error`

## Raw Payload Handling On Failure

If raw fetch succeeds but normalization fails:

- keep the raw payload snapshots
- fail the normalized ingest for that game
- do not delete the raw snapshot

This is important because raw archival is the replay source for fixing parser or schema issues later.

## Completion Rules

A game is complete only if:

1. required raw payloads are archived
2. normalized rows succeed
3. validation checks for that game are not fatally broken

Anything less is partial work, not success.

## Known Current Gaps

Current phase-1 gaps still to tighten later:

- route responses do not yet return explicit per-game failure-class objects
- multi-game raw ingest does not yet distinguish partial success from full success in a first-class status model
- systemic schema failures are not yet documented as an explicit early-stop rule in route code

## Approval Rule

Failure handling is acceptable only if:

- retryable upstream failures are retried and exhausted cleanly
- non-retryable failures are not retried blindly
- raw payloads remain preserved when available
- per-game partial failures are visible to operators
- systemic failures stop noisy batch continuation
