# Rolling Player Failure Analysis

## Scope

- `07:45 UTC` `GET` `/api/v1/db/update-rolling-player-averages`
- `09:00 UTC` `POST` `/api/v1/db/update-rolling-player-averages`

## Conclusion

The two cron failures share the same underlying root cause: both scheduled jobs invoke the same unbounded broad-sweep rolling-player rebuild path against the full skater population.

They do not represent meaningfully different execution modes.

They fail at different surfaces:

- The `07:45 UTC` `GET` run fails inside the route with a database statement timeout and returns a structured `500`.
- The `09:00 UTC` `POST` run keeps working long enough to hit the outer `300000 ms` HTTP cron timeout and surfaces only as `fetch failed`.

## Evidence

### Cron schedule inputs

The `GET` cron is a bare route call with no query parameters:

- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L198)

The `POST` cron also sends no meaningful scope controls. Its request body is just `{}`, and the route does not read `req.body` for execution options:

- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L448)
- [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts#L185)

### Route behavior

The route only derives scope from query params like `playerId`, `season`, `startDate`, `endDate`, `resumeFrom`, and `maxPlayers`.

With none of those present, it defaults to:

- `executionProfile: "daily_incremental"`

Relevant code:

- [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts#L206)

That means both scheduled jobs enter the same default profile and call the same worker:

- [update-rolling-player-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-rolling-player-averages.ts#L257)

### Worker behavior

When the request is not player-scoped and not date-scoped, the worker does not limit itself to recent players. It paginates through the entire `players` table for all non-goalies:

- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts#L2513)

The date-scoped narrowing only happens when `startDate` or `endDate` is present:

- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts#L2544)

So the current cron schedule is effectively running the broadest possible skater rebuild twice.

## Why The Failure Surfaces Differ

### 07:45 GET

Observed benchmark result:

- timer: `03:00`
- reason: `canceling statement due to statement timeout`

This aligns with an inner database statement limit being hit while the route is still alive and able to return JSON.

### 09:00 POST

Observed benchmark result:

- timer: `05:00`
- reason: `fetch failed`
- summary: `null`

This aligns with the outer caller hitting the cron HTTP timeout boundary at `300000 ms`:

- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L455)

Because the route never completed a response, the benchmark runner only saw a transport failure:

- [cron-audit-runner.ts](/Users/tim/Code/fhfhockey.com/web/scripts/cron-audit-runner.ts#L201)

## Root Cause

Primary root cause:

- both scheduled jobs are unbounded broad-sweep rolling-player runs against the full skater set

Secondary contributing causes:

- the `daily_incremental` default is too broad when no date window is supplied
- the `POST` cron gives the false impression of a different mode, but `{}` in the request body changes nothing
- the broad worker path can exceed either inner DB statement limits or the outer cron HTTP timeout depending on where work stalls

## Proposed Fix Direction

1. Stop scheduling unbounded bare calls for this route.
2. Convert both cron entries to explicit bounded query-param invocations such as `startDate`, `endDate`, and `fastMode=true`, or an explicit `executionProfile`.
3. Ensure the broad overnight/full sweep path is only used with explicit scope controls, batching, or resumability.
4. Consider changing the route default so "daily_incremental" without a date window derives a recent date range instead of the full player table.

## Validation Path

- Update both cron entries to pass explicit bounded scope.
- Re-run the two route calls locally through the benchmark runner.
- Confirm both return structured JSON instead of:
  - `canceling statement due to statement timeout`
  - `fetch failed`
