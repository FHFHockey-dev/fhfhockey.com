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

## Skater Freshness and Observability

`run-projection-v2` blocks a scheduled slate when any scheduled team has hard-stale line combinations (more than 21 days), fewer than 12 distinct forward/defense role assignments, or no skater-derived rows in the prior seven-day window. Soft-stale line combinations (more than 10 days) are reported but remain usable until the hard boundary.

Read these response fields before treating a run as healthy:

- `preflight.gates[]` — inspect `line_combinations`, `skater_line_freshness`, `skater_role_coverage`, and `skater_derived_freshness`.
- `observability.skaterRowsProcessed` — must be non-zero when games were processed.
- `observability.skaterFreshnessFailureCount` — must be zero unless a controlled manual bypass was explicitly intended.
- `observability.dataQualityWarnings[]` — includes zero-row and failed-gate warnings used by the cron report/email.

For range backfills, `chunkDays` limits the current request and `nextStartDate` names the first unprocessed date. Resume with the original `startDate`/`endDate` plus that exact `resumeFromDate`; reruns are idempotent under run-scoped upserts. If a date fails preflight, the response returns that date as `nextStartDate` so upstream data can be repaired before continuing.

## Manual Validation Checklist
Use this checklist after every manual run/backfill chunk.

1. Endpoint response checks
- `success` is true.
- `timedOut` is false unless chunking intentionally hit duration window.
- `nextStartDate` is null for completed windows.
- `observability.dataQualityWarnings` is empty, or warnings are explicitly understood.

2. Projection freshness checks
- `run-projection-v2` response has non-zero `gamesProcessed` on slate days.
- `playerRowsUpserted` and `observability.skaterRowsProcessed` are non-zero on slate days.
- Skater line freshness, role coverage, and derived freshness gates pass for every scheduled team.
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
- Zero skater rows with games processed: refresh players/rosters and line combinations, rebuild rolling metrics and derived tables, then rerun without bypass.
- Skater line/role failure: refresh line combinations and confirm the latest scheduled-team row has at least 12 distinct forward/defense assignments.
- Skater derived freshness failure: rebuild recent `forge_player_game_strength` rows for every scheduled team before resuming.
- Persistent candidate contamination: refresh players + line combinations, then rebuild derived and re-run projection.

## Operational Cadence (Practical Default)
- Same-day: steps 1 through 9.
- Next-day (post-final stats): step 10.

## Skater Model Rollout and Rollback

- Current version: `skater-role-scenario-v1`.
- Safety flag: `FORGE_SKATER_MODEL_MODE=candidate|baseline` (server-only environment name; no secret value belongs in logs or docs).
- Default remains `candidate` to preserve current repository behavior. `baseline` is the emergency rollback mode and returns the scenario-free current-rate stat line while preserving the same storage/API schema.
- Changing the deployed flag or promoting a new default is a production checkpoint. Do not do it from a backfill or validation request.

Promotion requires all of the following:

1. At least 14 distinct matched holdout dates with both current-baseline and naive-prior comparisons.
2. Candidate MAE and RMSE do not regress versus the current baseline.
3. Candidate MAE improves versus the naive prior and interval coverage remains inside the approved launch bands.
4. No blocking skater freshness gate, unexplained zero-row slate, or canonical-reader regression is open.

Rollback to `baseline` if the active 14-day MAE/RMSE regresses, interval coverage leaves the approved band, scheduled slates repeatedly require bypass/produce zero skater rows, or a version/response defect breaks canonical readers. After rollback, rerun one bounded slate, verify `/api/v1/forge/players` metadata/rows, and record the affected run IDs and dates.

## Post-launch Monitoring and Recalibration

- Daily: review cron status, `skaterRowsProcessed`, `skaterFreshnessFailureCount`, freshness gates, zero-row warnings, and holdout availability.
- Weekly: review 7/14/30-day MAE/RMSE, P10/P90 hit rates, role-bucket diagnostics, component miss attribution, and current/naive holdout deltas.
- Recalibrate only when a stable multi-day pattern exists; do not react to one slate. Any rate/prior/threshold change receives a new model version, the same 14-day shadow requirement, focused tests, and a documented rollback target.
- Keep a deployed candidate unchanged while evidence accumulates. A code-complete shadow report does not count as 14 elapsed observation days.

## Related Docs
- `tasks/tasks-goalie-forge.md`
- `tasks/goalie-forge.md`
