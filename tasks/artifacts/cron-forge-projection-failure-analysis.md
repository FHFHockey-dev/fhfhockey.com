# FORGE And Projection Failure Analysis

## Scope

- `09:40 UTC` `POST` `/api/v1/db/update-start-chart-projections`
- `09:45 UTC` `POST` `/api/v1/db/ingest-projection-inputs`
- `09:50 UTC` `POST` `/api/v1/db/build-projection-derived-v2`
- `10:05 UTC` `POST` `/api/v1/db/run-projection-v2`
- `11:30 UTC` `POST` `/api/v1/db/run-projection-accuracy?projectionOffsetDays=0`

## Summary

These failures are not all the same.

- `update-start-chart-projections`: route/runtime timeout from oversized single-request work
- `ingest-projection-inputs`: route/runtime timeout plus upstream fetch pressure inside the ingest loop
- `build-projection-derived-v2`: route/runtime timeout from multi-stage single-request work
- `run-projection-v2`: upstream stale-data or transport instability in preflight dependencies, surfacing as upstream HTML
- `run-projection-accuracy`: downstream dependency or Supabase transport instability, not a long runtime budget issue

## Per-Route Findings

### update-start-chart-projections

Benchmark result:

- timer: `05:01`
- reason: `fetch failed`
- summary: `null`

Root cause classification:

- primary: route timeout / oversized single-request workload
- secondary: schedule invokes the broad default path with no date/body controls

Why:

- The cron entry is a bare `POST` with `body := '{}'` and a `300000 ms` timeout:
  - [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L588)
- The handler defaults to "tomorrow EST" when no date is supplied:
  - [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts#L150)
- For the target slate it:
  - fetches scheduled games
  - resolves recent line combinations per team
  - fetches ratings
  - fetches goalie priors
  - then issues one `rolling_player_game_metrics` query per player task in batched `Promise.all`
  - [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts#L340)

Interpretation:

- This route is doing too much in one request.
- The benchmark saw no JSON body, which is consistent with the outer HTTP call timing out before the route completed a response.

### ingest-projection-inputs

Benchmark result:

- timer: `05:01`
- reason: `TypeError: fetch failed`
- summary includes a timed `500`

Root cause classification:

- primary: route timeout boundary with upstream fetch failure inside ingest work
- secondary: bare cron call leaves the route on its default range and budget path

Why:

- The cron entry is a bare `POST` with no query params and a `300000 ms` timeout:
  - [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L607)
- The handler defaults to `startDate = today`, `endDate = startDate`, and a `270000 ms` internal budget unless overridden:
  - [ingest-projection-inputs.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/ingest-projection-inputs.ts#L175)
- For each game it may call:
  - `fetchPbpGame(...)`
  - `upsertPbpGameAndPlays(...)`
  - `upsertShiftTotalsForGame(...)`
  - [ingest-projection-inputs.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/ingest-projection-inputs.ts#L278)

Interpretation:

- This is not a pure preflight/stale-data failure.
- The benchmark captured a structured route-level `500`, which means the route was still alive long enough to serialize the inner failure.
- The most likely cause is upstream fetch/load failure during PBP or shift ingestion under a tight single-request budget.

### build-projection-derived-v2

Benchmark result:

- timer: `05:01`
- reason: `fetch failed`
- summary: `null`

Root cause classification:

- primary: route timeout / oversized single-request orchestration
- secondary: backlog sensitivity and missing bounded window in the cron call

Why:

- The cron entry is a bare `POST` with `body := '{}'` and a `300000 ms` timeout:
  - [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L627)
- The route supports `startDate`, `endDate`, `chunkDays`, `resumeFromDate`, `maxDurationMs`, and `bypassMaxDuration`, but the cron is not using them:
  - [build-projection-derived-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/build-projection-derived-v2.ts#L136)
- The handler runs three expensive builders in one request:
  - player derived
  - team derived
  - goalie derived
  - [build-projection-derived-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/build-projection-derived-v2.ts#L170)

Interpretation:

- This route is built to support chunking/resume, but the schedule is still invoking the broad default shape.
- The benchmark’s `fetch failed` with no response body fits an outer timeout boundary rather than a clean structured route error.

### run-projection-v2

Benchmark result:

- timer: `03:00`
- reason: upstream HTML (`<!DOCTYPE html>`)
- route returned structured JSON with `error` containing the HTML payload

Root cause classification:

- primary: upstream stale-data dependency or transport instability in preflight dependencies
- secondary: HTML error leakage from underlying Supabase-backed reads

Why:

- The cron entry is a bare `POST` with `body := '{}'` and `300000 ms` timeout:
  - [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L677)
- This route is explicitly preflight-gated before running projections:
  - line combinations
  - recent PBP + shift ingest
  - derived-table freshness
  - goalie start priors
  - stale goalie game rows / goalie team mapping checks
  - [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts#L260)
  - [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts#L360)
- A clean stale-data preflight failure should produce `422` with structured gate output:
  - [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts#L782)

Interpretation:

- This benchmark failure is not the normal clean stale-data path.
- It indicates one of the preflight dependency reads threw an upstream HTML error before the route could produce a `422`.
- The most likely failing surfaces are the same upstream tables already unhealthy in the benchmark window:
  - `goalie_start_projections`
  - `forge_*_game_strength`
  - `forge_goalie_game`
  - `pbp_games`
  - `shift_charts`
  - line-combination dependent queries

### run-projection-accuracy

Benchmark result:

- timer: `00:39`
- reason: upstream HTML (`<!DOCTYPE html>`)

Root cause classification:

- primary: downstream dependency / Supabase transport instability
- secondary: stale or missing FORGE output can also block this route, but this specific failure was too fast to be a runtime-budget issue

Why:

- The cron entry is explicit only about `projectionOffsetDays=0`; it still runs as one broad analytics pass:
  - [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L1131)
- The route first resolves a successful run id:
  - [projections/_helpers.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/projections/_helpers.ts#L17)
- It then reads and writes across many downstream tables:
  - `forge_player_projections`
  - `forge_goalie_projections`
  - `forge_runs`
  - `games`
  - `wgo_skater_stats`
  - `goalie_stats_unified`
  - `forge_goalie_game`
  - `forge_projection_accuracy_daily`
  - `forge_projection_accuracy_player`
  - `forge_projection_accuracy_stat_daily`
  - `forge_projection_calibration_daily`
  - [run-projection-accuracy.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-accuracy.ts#L1425)

Interpretation:

- The `00:39` failure time is too short to blame on the 5-minute route ceiling.
- This route is failing quickly on an upstream table read/write path, likely the same HTML-leaking Supabase transport class seen elsewhere in the benchmark.
- It is downstream of successful FORGE runs, but the observed failure shape points more to infrastructure/dependency read failure than to algorithmic runtime.

## Fix Order

1. Repair the upstream rolling / ingest / derived builders so they run in bounded windows.
2. Restore clean preflight dependencies for `run-projection-v2`.
3. Normalize HTML-leaking dependency failures into structured operator-usable errors.
4. Re-test `run-projection-accuracy` after the upstream FORGE chain is healthy.

## Validation Path

- Re-run:
  - `/api/v1/db/update-start-chart-projections` with an explicit date
  - `/api/v1/db/ingest-projection-inputs` with explicit `startDate`, `endDate`, and if needed `chunkDays`
  - `/api/v1/db/build-projection-derived-v2` with explicit bounded dates
  - `/api/v1/db/run-projection-v2?date=...`
  - `/api/v1/db/run-projection-accuracy?projectionOffsetDays=0`
- Confirm:
  - timeout-boundary jobs now return success or clean partial/timed-out JSON
  - preflight-gated jobs return structured gate output instead of HTML leakage
  - downstream accuracy job no longer fails on quick upstream HTML responses
