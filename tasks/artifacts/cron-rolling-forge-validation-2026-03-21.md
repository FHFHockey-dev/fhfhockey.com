## Rolling And FORGE Local/Dev Validation

Validation date:
- `2026-03-21`

Validation target:
- local/dev HTTP execution against `http://127.0.0.1:3000`
- cron bearer auth from `web/.env.local`

Notes:
- A local `node` process was already listening on port `3000`, so the checks were run against that existing local app instance.
- The routes were validated in cron-style invocation form, using the same HTTP method and empty-body shape used by the schedule where applicable.

### Outcomes

| Route | Method | Status | Timer | Outcome | Remaining blocker |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/db/update-rolling-player-averages` | `GET` | `200` | `03:46` | Success | None in this run |
| `/api/v1/db/update-rolling-player-averages` | `POST {}` | `200` | `03:37` | Success | None in this run |
| `/api/v1/db/update-start-chart-projections` | `POST {}` | `200` | `00:03.64` | Success | None in this run |
| `/api/v1/db/ingest-projection-inputs` | `POST {}` | `200` | `00:01.81` | Success | None in this run |
| `/api/v1/db/build-projection-derived-v2` | `POST {}` | `200` | `00:02` | Success | Warning only: goalie derived wrote zero rows |
| `/api/v1/db/run-projection-v2?date=2026-03-21` | `POST {}` | `500` | `02:06` | Structured failure | DB statement timeout during execution |
| `/api/v1/db/run-projection-accuracy?projectionOffsetDays=0` | `POST {}` | `500` | `00:00` | Structured failure | No succeeded projection run found for prior target date |

### Route Details

#### 1. `update-rolling-player-averages` `GET`

Endpoint:
- `/api/v1/db/update-rolling-player-averages`

Response:
- `200 OK`
- `executionProfile: daily_incremental`
- `runtimeBudget.durationLabel: 3m 46s`
- `runtimeBudget.withinBudget: true`

Conclusion:
- The bare cron-style `GET` path now completes successfully within the intended `4m30s` budget.

#### 2. `update-rolling-player-averages` `POST {}`

Endpoint:
- `/api/v1/db/update-rolling-player-averages`

Response:
- `200 OK`
- `executionProfile: daily_incremental`
- `runtimeBudget.durationLabel: 3m 37s`
- `runtimeBudget.withinBudget: true`

Conclusion:
- The former split failure mode is gone. The empty-body cron-style `POST` path is now functionally aligned with the fixed `GET` path.

#### 3. `update-start-chart-projections`

Endpoint:
- `/api/v1/db/update-start-chart-projections`

Response:
- `200 OK`
- `date: 2026-03-22`
- `projections: 324`
- `playerTasksProcessed: 324`
- `executionTime: 0m 3.64s`

Conclusion:
- The route now completes quickly in local/dev and no longer exhibits the oversized single-request failure observed in the benchmark run.

#### 4. `ingest-projection-inputs`

Endpoint:
- `/api/v1/db/ingest-projection-inputs`

Response:
- `200 OK`
- `timing.timer: 00:01`
- `gamesTotal: 11`
- `gamesProcessed: 6`
- `maxGames: 6`
- `nextGameId: 2025021105`
- `lastCompletedGameId: 2025021104`
- `errors: []`

Conclusion:
- The route now returns actionable bounded-run progress instead of collapsing into a generic fetch failure at the HTTP boundary.

#### 5. `build-projection-derived-v2`

Endpoint:
- `/api/v1/db/build-projection-derived-v2`

Response:
- `200 OK`
- `timedOut: false`
- `processedDates: ["2026-03-21"]`
- `player.gamesProcessed: 11`
- `team.gamesProcessed: 11`
- `goalie.gamesProcessed: 11`
- `observability.dataQualityWarnings[0].code: goalie_rows_zero`

Conclusion:
- The route now completes successfully and returns resumable progress shape.
- The remaining signal is data-quality related, not a route-timeout failure.

#### 6. `run-projection-v2`

Endpoint:
- `/api/v1/db/run-projection-v2?date=2026-03-21`

Response:
- `500 Internal Server Error`
- `timing.timer: 02:06`
- `preflight.status: PASS`
- `dependencyError.message: canceling statement due to statement timeout`

Key observation:
- The preflight gate fixes are working.
- The route now reaches execution and fails with a structured statement-timeout error rather than a stale-data preflight block or HTML leak.

Conclusion:
- This route remains the primary blocker in the local rolling/FORGE chain.
- The remaining work is execution-path/database performance, not preflight correctness.

Additional diagnostic:
- A separate local run with `bypassPreflight=true` also failed quickly with the same structured timeout shape, reinforcing that the blocker is execution-time DB work rather than preflight.

#### 7. `run-projection-accuracy`

Endpoint:
- `/api/v1/db/run-projection-accuracy?projectionOffsetDays=0`

Response:
- `500 Internal Server Error`
- `error: No succeeded projection run found for date=2026-03-20`
- structured `dependencyError` present

Conclusion:
- Error surfacing is now clean and machine-readable.
- The route is correctly blocked by upstream dependency state: it has no successful projection run to grade.

### Summary

Resolved locally:
- `update-rolling-player-averages` `GET`
- `update-rolling-player-averages` `POST {}`
- `update-start-chart-projections`
- `ingest-projection-inputs`
- `build-projection-derived-v2`

Still blocked locally:
- `run-projection-v2`
  - root blocker: DB statement timeout during execution
- `run-projection-accuracy`
  - root blocker: no succeeded upstream projection run available for the requested offset date
