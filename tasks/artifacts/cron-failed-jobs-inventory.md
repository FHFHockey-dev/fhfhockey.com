# Cron Failed Jobs Inventory

## Source

- `tasks/artifacts/cron-benchmark-run-latest.md`
- `tasks/artifacts/cron-benchmark-run-latest.json`

## Summary

- Failed jobs analyzed: `27`
- Normalization focus:
  - failure category
  - likely failure surface
  - whether the error is transport-level, application-level, SQL/RPC-level, or upstream HTML leakage

## Failure Categories

### 1. Application Timeout

These failures returned an application-generated timeout or budget-bound response rather than a raw transport failure.

- `07:45 UTC` `GET` `/api/v1/db/update-rolling-player-averages`
  - Reason: `canceling statement due to statement timeout`
  - Surface: route-level application/database timeout

### 2. Transport / Fetch Failure

These failures collapsed to `fetch failed` or `TypeError: fetch failed`, which usually means the request died before a useful structured body was returned.

- `08:30 UTC` `GET` `/api/v1/db/update-nst-goalies`
- `08:50 UTC` `GET` `/api/v1/db/calculate-wigo-stats`
- `09:00 UTC` `POST` `/api/v1/db/update-rolling-player-averages`
- `09:40 UTC` `POST` `/api/v1/db/update-start-chart-projections`
- `09:45 UTC` `POST` `/api/v1/db/ingest-projection-inputs`
- `09:50 UTC` `POST` `/api/v1/db/build-projection-derived-v2`
- `09:55 UTC` `GET` `/api/v1/db/update-nst-team-daily`
- `10:50 UTC` `GET` `/api/v1/db/update-nst-team-daily`

### 3. SQL / RPC Upstream HTML Failure

These jobs failed through the Supabase RPC or SQL execution path and returned HTML error pages instead of structured JSON.

- `09:05 UTC` `SQL` `REFRESH MATERIALIZED VIEW goalie_stats_unified;`
- `10:00 UTC` `SQL` `REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;`
- `10:15 UTC` `SQL` `refresh_team_power_ratings(...)`
- `10:41 UTC` `SQL` `REFRESH MATERIALIZED VIEW player_totals_unified;`

### 4. HTTP Route With Upstream HTML Leakage

These jobs are HTTP routes, but the route error body contains `<!DOCTYPE html>`, which indicates an upstream dependency or nested query failed and the route leaked the raw HTML failure through its own error message.

- `10:05 UTC` `POST` `/api/v1/db/run-projection-v2`
- `10:20 UTC` `GET` `/api/v1/db/update-season-stats`
- `10:30 UTC` `GET` `/api/v1/db/update-sko-stats`
- `10:35 UTC` `GET` `/api/v1/db/update-wgo-averages`
- `10:40 UTC` `GET` `/api/v1/db/sustainability/rebuild-baselines`
- `10:42 UTC` `GET` `/api/v1/sustainability/rebuild-priors?season=current`
- `10:43 UTC` `GET` `/api/v1/sustainability/rebuild-window-z?season=current&runAll=true`
- `10:44 UTC` `GET` `/api/v1/sustainability/rebuild-score?season=current&runAll=true`
- `10:45 UTC` `GET` `/api/v1/ml/update-predictions-sko`
- `10:46 UTC` `GET` `/api/v1/sustainability/rebuild-trend-bands?runAll=true`
- `10:55 UTC` `GET` `/api/Teams/nst-team-stats`
- `11:30 UTC` `POST` `/api/v1/db/run-projection-accuracy?projectionOffsetDays=0`

### 5. Application Defect

These failures point to a concrete code/runtime defect rather than a timeout or transport failure.

- `10:25 UTC` `GET` `/api/v1/db/update-rolling-games?date=recent`
  - Reason: `Error: require is not a function`
- `11:00 UTC` `GET` `/api/v1/db/update-power-rankings`
  - Reason: `Error: require is not a function`

## Normalized Matrix

| # | Slot | Method | Job | Route / SQL | Failure Category | Primary Failure Surface | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 | `07:45 UTC` | `GET` | `update-rolling-player-averages` | `/api/v1/db/update-rolling-player-averages` | `application_timeout` | `route/db timeout` | `canceling statement due to statement timeout` |
| 16 | `08:30 UTC` | `GET` | `update-nst-goalies` | `/api/v1/db/update-nst-goalies` | `transport_fetch_failure` | `transport/runtime` | `fetch failed` |
| 19 | `08:50 UTC` | `GET` | `update-wigo-table-stats` | `/api/v1/db/calculate-wigo-stats` | `transport_fetch_failure` | `transport/runtime` | `fetch failed` |
| 21 | `09:00 UTC` | `POST` | `update-rolling-player-averages` | `/api/v1/db/update-rolling-player-averages` | `transport_fetch_failure` | `transport/runtime` | `fetch failed` |
| 22 | `09:05 UTC` | `SQL` | `daily-refresh-goalie-unified-matview` | `REFRESH MATERIALIZED VIEW goalie_stats_unified;` | `sql_rpc_html_failure` | `supabase rpc/sql transport` | `<!DOCTYPE html>` |
| 29 | `09:40 UTC` | `POST` | `update-start-chart-projections` | `/api/v1/db/update-start-chart-projections` | `transport_fetch_failure` | `transport/runtime` | `fetch failed` |
| 30 | `09:45 UTC` | `POST` | `ingest-projection-inputs` | `/api/v1/db/ingest-projection-inputs` | `transport_fetch_failure` | `transport/runtime` | `TypeError: fetch failed` |
| 31 | `09:50 UTC` | `POST` | `build-forge-derived-v2` | `/api/v1/db/build-projection-derived-v2` | `transport_fetch_failure` | `transport/runtime` | `fetch failed` |
| 32 | `09:55 UTC` | `GET` | `update-nst-team-daily` | `/api/v1/db/update-nst-team-daily` | `transport_fetch_failure` | `transport/runtime` | `fetch failed` |
| 33 | `10:00 UTC` | `SQL` | `daily-refresh-matview` | `REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;` | `sql_rpc_html_failure` | `supabase rpc/sql transport` | `<!DOCTYPE html>` |
| 34 | `10:05 UTC` | `POST` | `run-forge-projection-v2` | `/api/v1/db/run-projection-v2` | `http_upstream_html_leak` | `nested upstream dependency` | `<!DOCTYPE html>` |
| 35 | `10:15 UTC` | `SQL` | `refresh-team-power-ratings-daily` | `refresh_team_power_ratings(...)` | `sql_rpc_html_failure` | `supabase rpc/sql transport` | `<!DOCTYPE html>` |
| 36 | `10:20 UTC` | `GET` | `update-season-stats-current-season` | `/api/v1/db/update-season-stats` | `http_upstream_html_leak` | `nested upstream dependency` | `Failed to determine latest processed game... <!DOCTYPE html>` |
| 37 | `10:25 UTC` | `GET` | `update-rolling-games-recent` | `/api/v1/db/update-rolling-games?date=recent` | `application_defect` | `runtime/module loading` | `Error: require is not a function` |
| 38 | `10:30 UTC` | `GET` | `update-sko-stats-full-season` | `/api/v1/db/update-sko-stats` | `http_upstream_html_leak` | `nested upstream dependency` | `Failed to determine latest sko_skater_stats date... <!DOCTYPE html>` |
| 39 | `10:35 UTC` | `GET` | `update-wgo-averages` | `/api/v1/db/update-wgo-averages` | `http_upstream_html_leak` | `nested upstream dependency` | `Failed to fetch data from nst_seasonal_on_ice_counts: <!DOCTYPE html>` |
| 40 | `10:40 UTC` | `GET` | `rebuild-sustainability-baselines` | `/api/v1/db/sustainability/rebuild-baselines` | `http_upstream_html_leak` | `nested upstream dependency` | `Supabase query error ... player_stats_unified ... <!DOCTYPE html>` |
| 41 | `10:41 UTC` | `SQL` | `daily-refresh-player-totals-unified-matview` | `REFRESH MATERIALIZED VIEW player_totals_unified;` | `sql_rpc_html_failure` | `supabase rpc/sql transport` | `<!DOCTYPE html>` |
| 42 | `10:42 UTC` | `GET` | `rebuild-sustainability-priors` | `/api/v1/sustainability/rebuild-priors?season=current` | `http_upstream_html_leak` | `nested upstream dependency` | `<!DOCTYPE html>` |
| 43 | `10:43 UTC` | `GET` | `rebuild-sustainability-window-z` | `/api/v1/sustainability/rebuild-window-z?season=current&runAll=true` | `http_upstream_html_leak` | `nested upstream dependency` | `<!DOCTYPE html>` |
| 44 | `10:44 UTC` | `GET` | `rebuild-sustainability-score` | `/api/v1/sustainability/rebuild-score?season=current&runAll=true` | `http_upstream_html_leak` | `nested upstream dependency` | `<!DOCTYPE html>` |
| 45 | `10:45 UTC` | `GET` | `update-predictions-sko` | `/api/v1/ml/update-predictions-sko` | `http_upstream_html_leak` | `nested upstream dependency` | `<!DOCTYPE html>` |
| 46 | `10:46 UTC` | `GET` | `rebuild-sustainability-trend-bands` | `/api/v1/sustainability/rebuild-trend-bands?runAll=true` | `http_upstream_html_leak` | `nested upstream dependency` | `<!DOCTYPE html>` |
| 47 | `10:50 UTC` | `GET` | `update-nst-team-daily-incremental` | `/api/v1/db/update-nst-team-daily` | `transport_fetch_failure` | `transport/runtime` | `fetch failed` |
| 48 | `10:55 UTC` | `GET` | `update-nst-team-stats-all` | `/api/Teams/nst-team-stats` | `http_upstream_html_leak` | `nested upstream dependency` | `Failed to scan existing dates for nst_team_all: <!DOCTYPE html>` |
| 49 | `11:00 UTC` | `GET` | `update-power-rankings` | `/api/v1/db/update-power-rankings` | `application_defect` | `runtime/module loading` | `Error: require is not a function` |
| 50 | `11:30 UTC` | `POST` | `run-projection-accuracy` | `/api/v1/db/run-projection-accuracy?projectionOffsetDays=0` | `http_upstream_html_leak` | `nested upstream dependency` | `<!DOCTYPE html>` |

## Immediate Implications For Follow-On Root Cause Work

- Start with `application_defect` jobs first because they are the most deterministic to fix.
- Treat `application_timeout` and `transport_fetch_failure` jobs as likely route-budget, oversized-workload, or upstream-availability problems.
- Treat `sql_rpc_html_failure` and `http_upstream_html_leak` jobs as a shared infrastructure/dependency cluster until proven otherwise, because many of them appear to be different faces of the same Supabase/Cloudflare failure plane.
