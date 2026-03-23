# Cron Failed Jobs Remediation Status 2026-03-21

Readable status summary after the targeted validation reruns for the previously failed cron-job clusters.

## Resolved Jobs

These routes or SQL-backed jobs now complete successfully in local/dev validation.

### Rolling And FORGE Mid-Pipeline

| Job | Validation result | Duration | Notes |
| --- | --- | --- | --- |
| `/api/v1/db/update-rolling-player-averages` `GET` | `200` | `03:46` | Bare cron-style GET now completes within the intended runtime budget. |
| `/api/v1/db/update-rolling-player-averages` `POST {}` | `200` | `03:37` | Empty-body cron-style POST now behaves like the fixed GET path. |
| `/api/v1/db/update-start-chart-projections` | `200` | `00:03.64` | Route no longer shows the old oversized single-request failure pattern. |
| `/api/v1/db/ingest-projection-inputs` | `200` | `00:01.81` | Returns bounded progress state cleanly. |
| `/api/v1/db/build-projection-derived-v2` | `200` | `00:02` | Returns resumable progress shape; remaining signal is warning-only data quality. |

### SQL Refresh Cluster

| Job | Validation result | Duration | Notes |
| --- | --- | --- | --- |
| `REFRESH MATERIALIZED VIEW goalie_stats_unified;` | Success | `4.57s` | Structured SQL RPC success locally. |
| `REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;` | Success | `0.19s` | Structured SQL RPC success locally. |
| `SELECT public.refresh_team_power_ratings(...);` | Success | `0.18s` | Corrected exact statement succeeded. |
| `REFRESH MATERIALIZED VIEW player_totals_unified;` | Success | `2.03s` | Structured SQL RPC success locally. |

### Sustainability And ML Downstream

| Job | Validation result | Duration | Notes |
| --- | --- | --- | --- |
| `/api/v1/db/sustainability/rebuild-baselines` | `200` | `112.22s` | Succeeds when prerequisites are healthy. |
| `/api/v1/sustainability/rebuild-priors?season=current` | `200` | `5.21s` | Succeeds cleanly. |
| `/api/v1/sustainability/rebuild-window-z?season=current&offset=0&limit=250` | `200` | `79.03s` | Succeeds cleanly. |
| `/api/v1/sustainability/rebuild-score?season=current&offset=0&limit=250` | `200` | `113.19s` | Succeeds cleanly. |
| `/api/v1/sustainability/rebuild-trend-bands?offset=0&limit=250` | `200` | `43.34s` | Succeeds cleanly. |
| `/api/v1/ml/update-predictions-sko` | `200` | `2.46s` | Succeeds once unified-view dependencies are present. |

### NST Cluster

| Job | Validation result | Duration | Notes |
| --- | --- | --- | --- |
| `/api/v1/db/update-nst-goalies?startDate=2026-03-21&maxDays=1` | `200` | bounded chunk | Processes `8` requests at `0ms`, fully compliant with NST ceilings. |
| `/api/v1/db/update-nst-team-daily?runMode=forward&startDate=2026-03-21&endDate=2026-03-21` | `200` | `2961 ms` | Single-date `8` request burst is compliant. |
| `/api/Teams/nst-team-stats?date=2026-03-21` | `200` | `5.4s` | `6` request burst is compliant; no longer pays the legacy fixed `21s` delay. |

## Still Blocked Jobs

These jobs still fail or time out after remediation work.

| Job | Current state | Remaining blocker |
| --- | --- | --- |
| `/api/v1/db/run-projection-v2?date=2026-03-21` | `500` | Structured DB statement timeout during execution. |
| `/api/v1/db/run-projection-accuracy?projectionOffsetDays=0` | `500` | No succeeded upstream projection run available for the target date. |
| `/api/v1/db/calculate-wigo-stats` | timeout | No HTTP response within `180s`; route-level long-running execution remains. |
| `/api/v1/db/update-season-stats` | timeout | No HTTP response within `180s`; route-level long-running execution remains. |
| `/api/v1/db/update-sko-stats` | `400` | Schema mismatch: column `assists_5v5` missing from `sko_skater_stats`. |
| `/api/v1/db/update-wgo-averages` | `500` | Structured transport/dependency failure: `TypeError: fetch failed`. |

## Infrastructure Or Environment Follow-Up

These items are no longer reproducing as application-code failures in local/dev, but still warrant follow-up because the original benchmark failure class pointed to infrastructure or transport fragility.

| Item | Follow-up |
| --- | --- |
| SQL RPC benchmark path | The original benchmark captured `520/522` HTML failures from the Supabase `execute_sql` path. Local retry/normalization now behaves well, but production/preview transport stability should still be watched. |
| `run-projection-v2` execution path | The route now passes preflight and fails deeper in DB execution. This is now a performance/query-budget issue rather than stale-data gating or HTML leakage. |
| `run-projection-accuracy` | Healthy once a successful projection run exists; no direct route defect remains from the earlier HTML-leak class. |

## Structured Error Improvements Confirmed

The following routes no longer leak raw HTML as the top-level operator message when they fail:

- `/api/v1/db/update-sko-stats`
- `/api/v1/db/update-wgo-averages`
- `/api/v1/db/run-projection-v2`
- `/api/v1/db/run-projection-accuracy`
- sustainability rebuild routes

## Net Result

- Most of the originally failed jobs are now either:
  - fully resolved in local/dev validation, or
  - reduced to clear structured blockers instead of opaque HTML/proxy noise.
- The main unresolved engineering problems are now concentrated in:
  - FORGE execution-time DB performance
  - two long-running downstream routes that still hang locally
  - one SKO schema mismatch
  - one remaining WGO transport/dependency path failure
