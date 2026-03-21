# SQL Refresh Execution Paths

## Scope

- `REFRESH MATERIALIZED VIEW goalie_stats_unified;`
- `REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;`
- `SELECT public.refresh_team_power_ratings(...);`
- `REFRESH MATERIALIZED VIEW player_totals_unified;`

## Most Important Finding

The benchmark failure path is not the same as the production cron path.

- In the benchmark runner, SQL-only jobs are executed through Supabase RPC:
  - [cron-audit-runner.ts](/Users/tim/Code/fhfhockey.com/web/scripts/cron-audit-runner.ts#L244)
  - RPC used: `execute_sql`
- In the real schedule, these jobs are registered as direct SQL in Postgres via `cron.schedule(...)`:
  - [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L219)
  - [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L470)
  - [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L668)
  - [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L707)
  - [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L798)

That means the benchmark proved instability in the Supabase RPC execution path, not a confirmed defect in the underlying SQL definitions.

## Evidence

### Control Case: SQL RPC Can Work

The benchmark successfully executed:

- `REFRESH MATERIALIZED VIEW player_stats_unified;`
- duration: `00:02`
- notes: `Executed through Supabase execute_sql RPC.`

Source:

- [cron-benchmark-run-latest.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-benchmark-run-latest.md#L691)

This matters because it shows:

- the benchmark SQL runner is not categorically broken
- the failing SQL jobs are likely the heavier or less stable members of the cluster

### Failing SQL Jobs

#### `goalie_stats_unified`

- observed duration: `01:10`
- failure: Cloudflare `520`
- source: [cron-benchmark-run-latest.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-benchmark-run-latest.md#L871)

Interpretation:

- this is not a classic long timeout at exactly `180000 ms`
- it looks more like an upstream SQL/RPC worker failure or proxy-visible origin failure during execution

#### `yahoo_nhl_player_map_mat`

- observed duration: `03:00`
- failure: Cloudflare `522`
- source: [cron-benchmark-run-latest.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-benchmark-run-latest.md#L1253)

Interpretation:

- the benchmark hit the outer `execute_sql` path timeout boundary
- likely a heavy refresh over a proxy path that did not complete before the edge gave up

#### `refresh_team_power_ratings(...)`

- observed duration: `03:00`
- failure: Cloudflare `522`
- source: [cron-benchmark-run-latest.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-benchmark-run-latest.md#L1541)

Interpretation:

- same pattern as above
- likely workload-sensitive and not a syntax problem first

#### `player_totals_unified`

- observed duration: `00:39`
- failure: Cloudflare `522`
- source: [cron-benchmark-run-latest.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-benchmark-run-latest.md#L1889)

Interpretation:

- shorter than the `180s` cases, so not all failures are simple long-run timeout events
- could be upstream query-path instability, edge instability, or transient Supabase origin failure

## Per-Job Determination

### `goalie_stats_unified`

- Query changes required: not yet indicated
- RPC retry/error normalization required: yes
- Workload reduction required: maybe, but not yet proven
- Schedule-aware dependency protection required: yes

Reasoning:

- benchmark only proved a `520` on the RPC path
- downstream `run-projection-accuracy` should not assume this view is fresh if the refresh did not complete

### `yahoo_nhl_player_map_mat`

- Query changes required: not yet indicated
- RPC retry/error normalization required: yes
- Workload reduction required: likely
- Schedule-aware dependency protection required: yes

Reasoning:

- it hit a clean `180s`-style edge timeout pattern
- this is the best candidate for a path that is too heavy for the RPC bridge even if the SQL is otherwise valid

### `refresh_team_power_ratings(...)`

- Query changes required: not yet indicated
- RPC retry/error normalization required: yes
- Workload reduction required: likely
- Schedule-aware dependency protection required: yes

Reasoning:

- same `522` timeout signature as the Yahoo mapping refresh
- consumers already have read fallbacks, but the refresh job itself still needs a more stable execution path or decomposition

### `player_totals_unified`

- Query changes required: not yet indicated
- RPC retry/error normalization required: yes
- Workload reduction required: possible, but not yet proven
- Schedule-aware dependency protection required: yes

Reasoning:

- downstream sustainability jobs depend directly on this view
- even if the refresh is not the root SQL problem, consumers need a freshness-aware guard

## What 3.1 Should Conclude

The SQL refresh cluster needs:

1. Better SQL benchmark error normalization
   - convert HTML/Cloudflare responses into structured `sql_rpc_transport_failure` output
   - preserve status class like `520` vs `522`

2. Retry on the benchmark RPC execution path
   - especially for transient `520` / `522`
   - bounded retry, not infinite retry

3. Schedule-aware dependency protection for downstream readers
   - consumer routes should fail clearly when upstream refreshes are stale or missing
   - they should not leak raw HTML or ambiguous query errors

4. Workload review for the heavy SQL jobs
   - `yahoo_nhl_player_map_mat`
   - `refresh_team_power_ratings(...)`
   - possibly `player_totals_unified`

## What 3.1 Does Not Yet Prove

This investigation does not prove:

- broken SQL syntax
- broken materialized view definitions
- broken `refresh_team_power_ratings(...)` logic
- that production pg_cron execution is failing in the same way as benchmark RPC execution

It proves:

- the benchmark RPC path is fragile for this cluster
- the cluster needs better normalization, likely retry, and downstream dependency protection

## Recommended Next Step

Move to implementation with this order:

1. normalize SQL RPC failures in the benchmark/observation layer
2. add bounded retry for `execute_sql` benchmark execution
3. investigate whether any downstream consumers need explicit freshness/precondition guards before assuming these refreshes completed
4. only after that, decide whether any individual SQL refresh needs decomposition or query redesign
