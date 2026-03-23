# SQL Refresh Failure Analysis

## Scope

- `09:05 UTC` `REFRESH MATERIALIZED VIEW goalie_stats_unified;`
- `10:00 UTC` `REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;`
- `10:15 UTC` `SELECT public.refresh_team_power_ratings(...);`
- `10:41 UTC` `REFRESH MATERIALIZED VIEW player_totals_unified;`

## Conclusion

In the benchmark window, these failures originated in Supabase RPC transport, not in confirmed SQL syntax or application-side consumer logic.

The direct evidence is the returned failure shape:

- Cloudflare `520`
- Cloudflare `522`
- HTML error pages from `fyhftlxokyjtpndbkfse.supabase.co`

That means the benchmark runner failed while calling the `execute_sql` RPC path, before it received a structured Postgres or PostgREST error payload.

## Per-Job Classification

### REFRESH MATERIALIZED VIEW goalie_stats_unified

Benchmark result:

- timer: `01:10`
- reason: Cloudflare HTML `520`

Classification:

- primary: Supabase RPC transport failure
- not confirmed: SQL definition failure
- downstream consumers affected:
  - [run-projection-accuracy.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-accuracy.ts#L1317)

Evidence:

- [cron-benchmark-run-latest.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-benchmark-run-latest.md#L865)
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L470)

Interpretation:

- The benchmark did not receive a database error from the `REFRESH MATERIALIZED VIEW` itself.
- It received an upstream HTML error page while executing SQL through Supabase RPC.

### REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat

Benchmark result:

- timer: `03:00`
- reason: Cloudflare HTML `522`

Classification:

- primary: Supabase RPC transport timeout
- not confirmed: SQL definition failure
- downstream consumers likely affected:
  - FORGE and dashboard lookups that join Yahoo player mappings

Evidence:

- [cron-benchmark-run-latest.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-benchmark-run-latest.md#L1248)
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L665)

Interpretation:

- A `522` indicates the RPC request path timed out at the network/proxy edge.
- The benchmark cannot conclude that the materialized view SQL itself is broken.

### SELECT public.refresh_team_power_ratings(...)

Benchmark result:

- timer: `03:00`
- reason: Cloudflare HTML `522`

Classification:

- primary: Supabase RPC transport timeout
- secondary risk: underlying function may also be heavyweight, but that was not directly observed in this benchmark
- downstream consumers affected:
  - [teamRatingsService.ts](/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsService.ts#L137)
  - any route reading `team_power_ratings_daily` or `team_power_ratings_daily__new`

Evidence:

- [cron-benchmark-run-latest.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-benchmark-run-latest.md#L1538)
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L707)
- [teamRatingsService.ts](/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsService.ts#L170)

Interpretation:

- The failure happened on the SQL execution path, not when consumers later read the table.
- Consumer code already has some schema/table fallback logic, but that does not help when the refresh job itself never completes.

### REFRESH MATERIALIZED VIEW player_totals_unified

Benchmark result:

- timer: `00:39`
- reason: Cloudflare HTML `522`

Classification:

- primary: Supabase RPC transport timeout / upstream HTML failure
- downstream consumers affected:
  - [rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts#L196)

Evidence:

- [cron-benchmark-run-latest.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-benchmark-run-latest.md#L1884)
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L798)
- [rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts#L191)

Interpretation:

- This benchmark failure does not show a bad SQL payload from the materialized view refresh itself.
- It shows the SQL RPC path timing out before the refresh result came back.
- This explains why downstream sustainability work later failed with `player_totals_unified`-related errors.

## Downstream Consumer Impact

These refresh jobs were not failing because downstream consumers were broken. The direction of failure was the opposite.

The failed refreshes left downstream routes reading stale or unavailable data:

- `goalie_stats_unified`
  - used by [run-projection-accuracy.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-accuracy.ts#L1317)
- `player_totals_unified`
  - used by [rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts#L191)
- `team_power_ratings_daily`
  - read through [teamRatingsService.ts](/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsService.ts#L137)

## Root Cause Matrix

- `goalie_stats_unified`
  - root cause: Supabase RPC transport failure
  - evidence: HTML `520`
  - consumer impact: yes
- `yahoo_nhl_player_map_mat`
  - root cause: Supabase RPC transport timeout
  - evidence: HTML `522`
  - consumer impact: likely yes
- `refresh_team_power_ratings(...)`
  - root cause: Supabase RPC transport timeout
  - evidence: HTML `522`
  - consumer impact: yes
- `player_totals_unified`
  - root cause: Supabase RPC transport timeout
  - evidence: HTML `522`
  - consumer impact: yes

## Recommended Next Step

Treat this cluster as an RPC execution-path problem first, not as a consumer bug first.

That means the next remediation pass should check:

1. whether `execute_sql` needs retry or better error normalization in benchmark and operator surfaces
2. whether these refreshes should run through a more stable execution path than the current RPC route
3. whether any of the refresh SQL bodies are so heavy that they consistently trigger proxy timeouts and need workload reduction or decomposition

Only after that should consumer routes be blamed for these four benchmark failures.
