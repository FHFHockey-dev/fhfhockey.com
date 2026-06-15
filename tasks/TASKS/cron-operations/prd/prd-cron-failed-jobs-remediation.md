# PRD: Cron Failed Jobs Remediation

## Goal

Investigate every cron job that failed in the benchmark audit, determine the root cause for each failure, fix the underlying implementation or dependency issue, and re-run targeted validation until the jobs complete successfully within an acceptable runtime envelope.

## Scope

This remediation covers the failed cron jobs identified in `tasks/artifacts/cron-benchmark-run-latest.md`:

- `07:45 UTC` `GET` `/api/v1/db/update-rolling-player-averages`
- `08:30 UTC` `GET` `/api/v1/db/update-nst-goalies`
- `08:50 UTC` `GET` `/api/v1/db/calculate-wigo-stats`
- `09:00 UTC` `POST` `/api/v1/db/update-rolling-player-averages`
- `09:05 UTC` `SQL` `REFRESH MATERIALIZED VIEW goalie_stats_unified;`
- `09:40 UTC` `POST` `/api/v1/db/update-start-chart-projections`
- `09:45 UTC` `POST` `/api/v1/db/ingest-projection-inputs`
- `09:50 UTC` `POST` `/api/v1/db/build-projection-derived-v2`
- `09:55 UTC` `GET` `/api/v1/db/update-nst-team-daily`
- `10:00 UTC` `SQL` `REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;`
- `10:05 UTC` `POST` `/api/v1/db/run-projection-v2`
- `10:15 UTC` `SQL` `refresh_team_power_ratings(...)`
- `10:20 UTC` `GET` `/api/v1/db/update-season-stats`
- `10:25 UTC` `GET` `/api/v1/db/update-rolling-games?date=recent`
- `10:30 UTC` `GET` `/api/v1/db/update-sko-stats`
- `10:35 UTC` `GET` `/api/v1/db/update-wgo-averages`
- `10:40 UTC` `GET` `/api/v1/db/sustainability/rebuild-baselines`
- `10:41 UTC` `SQL` `REFRESH MATERIALIZED VIEW player_totals_unified;`
- `10:42 UTC` `GET` `/api/v1/sustainability/rebuild-priors?season=current`
- `10:43 UTC` `GET` `/api/v1/sustainability/rebuild-window-z?season=current&runAll=true`
- `10:44 UTC` `GET` `/api/v1/sustainability/rebuild-score?season=current&runAll=true`
- `10:45 UTC` `GET` `/api/v1/ml/update-predictions-sko`
- `10:46 UTC` `GET` `/api/v1/sustainability/rebuild-trend-bands?runAll=true`
- `10:50 UTC` `GET` `/api/v1/db/update-nst-team-daily`
- `10:55 UTC` `GET` `/api/Teams/nst-team-stats`
- `11:00 UTC` `GET` `/api/v1/db/update-power-rankings`
- `11:30 UTC` `POST` `/api/v1/db/run-projection-accuracy?projectionOffsetDays=0`

## Requirements

- Determine why each failed job failed in the benchmark run.
- Fix the underlying cause rather than only suppressing the symptom.
- Preserve existing cron timing/reporting instrumentation.
- Preserve or improve cron safety for NST-touching routes.
- Re-benchmark or run targeted validation after each fix cluster.
- Document which failures were code defects, dependency/data freshness defects, infrastructure/transient failures, or schedule-induced timeout failures.

## NST Constraints

NST routes must follow these rate limits:

- `40` requests per `1` minute
- `80` requests per `5` minutes
- `100` requests per `15` minutes
- `180` requests per `1` hour

Known per-date URL counts when tables are current:

- `update-nst-gamelog` = `16`
- `update-nst-tables-all` = `4`
- `update-nst-goalies` = `10`
- `update-nst-current-season` = `4`
- `update-nst-team-daily` = `8`
- `update-nst-team-daily-incremental` = unknown, must be measured/confirmed
- `update-nst-team-stats-all` = unknown, must be measured/confirmed

Potential improvement to validate:

- when only a small number of NST URLs are queued for a route, allow a bounded burst mode that skips the route-level wait timer as long as all four global NST limits remain satisfied

## Success Criteria

- Each failed job has a documented root cause.
- Code or SQL changes are implemented for remediable failures.
- Re-run evidence shows the remediated jobs succeed or have a clearly documented remaining external blocker.
- NST burst behavior, if changed, remains compliant with all published limits.
