# FORGE Operator Runbook (Goalies + Skaters)

## Scope
This runbook covers manual refresh and backfill operations for FORGE projection dependencies and projection outputs.

## Date Conventions
- Use ISO date format: `YYYY-MM-DD`.
- For daily operations, run projection and goalie-start jobs for the slate date.
- Run accuracy after games finalize (typically next day for prior slate).

## Endpoint Order (Required)
Run in this order for full freshness:

1. `/api/v1/db/update-games`
2. `/api/v1/db/update-teams`
3. `/api/v1/db/update-players`
4. `/api/v1/db/update-line-combinations`
5. `/api/v1/db/update-rolling-player-averages`
6. `/api/v1/db/ingest-projection-inputs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
7. `/api/v1/db/build-projection-derived-v2?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
8. `/api/v1/db/update-goalie-projections-v2?date=YYYY-MM-DD`
9. `/api/v1/db/run-projection-v2?date=YYYY-MM-DD&horizonGames=1`
10. `/api/v1/db/run-projection-accuracy?date=YYYY-MM-DD`

## Timeout and Bypass Controls

### 1) Ingest and Derived Jobs (long-running)
Supported parameters:
- `maxDurationMs=<ms>`
- `bypassMaxDuration=true`
- `chunkDays=<n>`
- `resumeFromDate=YYYY-MM-DD`

Recommended manual backfill pattern:
- Start with chunking and resume (safe default).
- Use `bypassMaxDuration=true` only when manually supervising long runs.

Examples:
- `/api/v1/db/ingest-projection-inputs?startDate=2025-10-01&endDate=2025-12-31&chunkDays=7`
- `/api/v1/db/ingest-projection-inputs?startDate=2025-10-01&endDate=2025-12-31&resumeFromDate=2025-11-19&chunkDays=7`
- `/api/v1/db/ingest-projection-inputs?startDate=2025-10-01&endDate=2025-12-31&bypassMaxDuration=true`
- `/api/v1/db/build-projection-derived-v2?startDate=2025-10-01&endDate=2025-12-31&chunkDays=7`
- `/api/v1/db/build-projection-derived-v2?startDate=2025-10-01&endDate=2025-12-31&resumeFromDate=2025-11-19&chunkDays=7`
- `/api/v1/db/build-projection-derived-v2?startDate=2025-10-01&endDate=2025-12-31&bypassMaxDuration=true`

### 2) Projection Run Job
Supported parameters:
- `date=YYYY-MM-DD` or `startDate/endDate`
- `horizonGames=1..5`
- `chunkDays=<n>`
- `resumeFromDate=YYYY-MM-DD`
- `maxDurationMs=<ms>`
- `bypassPreflight=true` (manual emergency override only)

Examples:
- `/api/v1/db/run-projection-v2?date=2026-02-08&horizonGames=1`
- `/api/v1/db/run-projection-v2?startDate=2026-01-15&endDate=2026-01-31&chunkDays=5`
- `/api/v1/db/run-projection-v2?startDate=2026-01-15&endDate=2026-01-31&resumeFromDate=2026-01-24&chunkDays=5`

If preflight fails:
- Read `preflight.gates` in response.
- Execute missing upstream jobs.
- Re-run without bypass first.
- Use `bypassPreflight=true` only for controlled intervention.

## Goalie Observability (New)
The following endpoints now return `observability` payloads:
- `/api/v1/db/build-projection-derived-v2`
- `/api/v1/db/update-goalie-projections-v2`
- `/api/v1/db/run-projection-v2`

Expected fields:
- `observability.goalieRowsProcessed`
- `observability.dataQualityWarnings[]`

Use `cron-report` outputs to monitor:
- goalie rows per job
- goalie data-quality warning count
- slow/failing jobs

## Manual Validation Checklist
Use this checklist after every manual run/backfill chunk.

1. Endpoint response checks
- `success` is true.
- `timedOut` is false unless chunking intentionally hit duration window.
- `nextStartDate` is null for completed windows.
- `observability.dataQualityWarnings` is empty, or warnings are explicitly understood.

2. Projection freshness checks
- `run-projection-v2` response has non-zero `gamesProcessed` on slate days.
- `goalieRowsUpserted` is non-zero on slate days unless no goalie projections are expected.

3. Derived/input sanity checks (Supabase)
- `pbp_games` coverage exists for recent games.
- `shift_charts` has recent rows.
- `forge_player_game_strength`, `forge_team_game_strength`, and `forge_goalie_game` have recent `game_date` rows.

4. Goalie prior sanity checks (Supabase)
- `goalie_start_projections` has rows for scheduled `game_id` values.
- No known stale/traded goalie contamination in candidate pools.

5. Output sanity checks (API)
- `/api/v1/forge/goalies?date=YYYY-MM-DD` returns non-empty `data` for slate days.
- `starter_probability` values are non-uniform across all goalies.
- `uncertainty.model.starter_selection.candidate_goalies` is constrained and plausible.

6. Accuracy checks
- Run `/api/v1/db/run-projection-accuracy?date=YYYY-MM-DD` after actuals finalize.
- Confirm goalie calibration/coverage diagnostics updated without errors.

## Failure Handling
- Timeout: re-run using `resumeFromDate` and a smaller `chunkDays`.
- Preflight fail: run indicated dependency jobs; avoid bypass unless necessary.
- Zero goalie rows with games processed: inspect `observability.dataQualityWarnings`, then verify goalie priors and derived goalie game tables.
- Persistent candidate contamination: refresh players + line combinations, then rebuild derived and re-run projection.

## Operational Cadence (Practical Default)
- Same-day: steps 1 through 9.
- Next-day (post-final stats): step 10.

## Related Docs
- `tasks/tasks-goalie-forge.md`
- `tasks/goalie-forge.md`
