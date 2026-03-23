## SQL Refresh And Downstream Local/Dev Validation

Validation date:
- `2026-03-21`

Validation target:
- local/dev HTTP execution against `http://127.0.0.1:3000`
- local SQL RPC execution through `executeSqlRpcWithRetry`

## SQL Refresh Validation

These checks were run through the benchmark SQL path, not direct pg_cron SQL.

| Job | Result | Duration | Notes |
| --- | --- | --- | --- |
| `REFRESH MATERIALIZED VIEW goalie_stats_unified;` | Success | `4.57s` | `attempts=1`, structured RPC success |
| `REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;` | Success | `0.19s` | `attempts=1`, structured RPC success |
| `SELECT public.refresh_team_power_ratings(...);` | Success | `0.18s` | validated with exact statement, `attempts=1` |
| `REFRESH MATERIALIZED VIEW player_totals_unified;` | Success | `2.03s` | `attempts=1`, structured RPC success |

Conclusion:
- The local SQL RPC path is no longer reproducing the earlier Cloudflare/HTML failures for this cluster.
- The earlier `refresh_team_power_ratings` syntax failure was from the first ad hoc validation string, not the actual SQL path. A corrected rerun succeeded.

## Downstream Route Validation

| Route | Status | Duration | Outcome | Structured response? | Remaining blocker |
| --- | --- | --- | --- | --- | --- |
| `/api/v1/db/calculate-wigo-stats` | timeout | `180s+` | No HTTP response before curl timeout | No | Route still hangs locally |
| `/api/v1/db/update-season-stats` | timeout | `180s+` | No HTTP response before curl timeout | No | Route still hangs locally |
| `/api/v1/db/update-sko-stats` | `400` | fast | Failure | Yes | `Column 'assists_5v5' of relation 'sko_skater_stats' does not exist` |
| `/api/v1/db/update-wgo-averages` | `500` | `8.06s` | Failure | Yes | structured transport/dependency failure: `Error upserting 3-year batch: TypeError: fetch failed` |
| `/api/v1/db/sustainability/rebuild-baselines` | `200` | `112.22s` | Success | Yes | None |
| `/api/v1/sustainability/rebuild-priors?season=current` | `200` | `5.21s` | Success | Yes | None |
| `/api/v1/sustainability/rebuild-window-z?season=current&offset=0&limit=250` | `200` | `79.03s` | Success | Yes | None |
| `/api/v1/sustainability/rebuild-score?season=current&offset=0&limit=250` | `200` | `113.19s` | Success | Yes | None |
| `/api/v1/sustainability/rebuild-trend-bands?offset=0&limit=250` | `200` | `43.34s` | Success | Yes | None |
| `/api/v1/ml/update-predictions-sko` | `200` | `2.46s` | Success | Yes | None |

## Detailed Findings

### `calculate-wigo-stats`

Endpoint:
- `/api/v1/db/calculate-wigo-stats`

Observed behavior:
- local curl timed out after `180s`
- no HTTP response body was returned

Conclusion:
- This route remains a route-level timeout candidate in local/dev.
- The structured dependency normalization work did not help here because the route did not return within the probe window.

### `update-season-stats`

Endpoint:
- `/api/v1/db/update-season-stats`

Observed behavior:
- local curl timed out after `180s`
- no HTTP response body was returned

Conclusion:
- Like `calculate-wigo-stats`, this route still appears to have a long-running local execution path that can hang past the probe window.

### `update-sko-stats`

Endpoint:
- `/api/v1/db/update-sko-stats`

Observed response:
- `400 Bad Request`
- structured `dependencyError` present
- message: `Column 'assists_5v5' of relation 'sko_skater_stats' does not exist`

Conclusion:
- Error surfacing is clean and operator-usable.
- The remaining blocker is a real schema/data contract issue, not raw HTML leakage.

### `update-wgo-averages`

Endpoint:
- `/api/v1/db/update-wgo-averages`

Observed response:
- `500 Internal Server Error`
- `duration: 8.06 s`
- structured `dependencyError` present
- classification: `transport_fetch_failure`

Conclusion:
- Error surfacing is clean and operator-usable.
- The remaining blocker is an upstream fetch/upsert path failure, not an HTML body leak.

### Sustainability Chain

Validated endpoints:
- `/api/v1/db/sustainability/rebuild-baselines`
- `/api/v1/sustainability/rebuild-priors?season=current`
- `/api/v1/sustainability/rebuild-window-z?season=current&offset=0&limit=250`
- `/api/v1/sustainability/rebuild-score?season=current&offset=0&limit=250`
- `/api/v1/sustainability/rebuild-trend-bands?offset=0&limit=250`

Observed behavior:
- all five succeeded locally
- durations ranged from `5.21s` to `113.19s`

Conclusion:
- The prerequisite/dependency hardening does not prevent successful runs once upstream data is healthy.

### `update-predictions-sko`

Endpoint:
- `/api/v1/ml/update-predictions-sko`

Observed response:
- `200 OK`
- `duration: 2.46s`
- `players: 27`
- `upserts: 27`

Conclusion:
- The route succeeds cleanly once unified-view dependencies are available.

## Summary

Resolved locally:
- all four SQL refresh jobs through the SQL RPC benchmark path
- sustainability rebuild routes
- `update-predictions-sko`
- structured failure surfacing for:
  - `update-sko-stats`
  - `update-wgo-averages`

Still blocked locally:
- `calculate-wigo-stats`
  - route-level timeout / no response within `180s`
- `update-season-stats`
  - route-level timeout / no response within `180s`
- `update-sko-stats`
  - schema mismatch in `sko_skater_stats`
- `update-wgo-averages`
  - upstream fetch/upsert failure, now surfaced structurally

Most important `5.2` conclusion:
- The HTML-leak problem is effectively gone in the routes that returned during validation.
- The remaining issues are now real blockers: timeouts, schema mismatch, and transport failure.
