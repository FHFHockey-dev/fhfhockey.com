# Rolling Player Pass-2 Refresh Execution Report

Date:

- March 12, 2026

Related artifacts:

- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-refresh-dependency-map.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-pass-2-validation-matrix.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-validation-freshness-report-2026-03-11.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-refresh-actions-report-2026-03-11.md`

## Purpose

This artifact records the actual refresh and recompute actions executed for task `3.2`.

It focuses on:

- current freshness state before action
- which refreshes were required versus unnecessary
- exact refreshes attempted
- exact rolling recompute attempts
- post-action readiness state for the retained validation players

## Pre-Action Freshness Snapshot

Command run:

```bash
npm run check:rolling-player-validation-freshness
```

Observed generation time:

- `2026-03-12T14:52:22.337Z`

Observed status before refresh actions:

- Brent Burns (`8470613`): `READY`
- Corey Perry (`8470621`): `BLOCKED`
- Jesper Bratt (`8479407`): `READY`
- Seth Jones (`8477495`): `BLOCKED`

Important blocker details before action:

- Brent Burns:
  - no unresolved freshness blockers remained
- Jesper Bratt:
  - no unresolved freshness blockers remained
- Corey Perry:
  - PK-only blocker remained
  - `countsTailLag = 1`
  - `ratesTailLag = 1`
  - `countsOiTailLag = 1`
  - latest PK source dates were still `2026-03-08`
- Seth Jones:
  - retained PK-blocked proxy case remained
  - `countsTailLag = 1`
  - `ratesTailLag = 1`
  - `countsOiTailLag = 1`
  - latest PK source dates were still `2025-12-30`

## Refresh Decision

### PP builder refresh

Not required in this sub-task.

Reason:

- all retained validation players showed `ppTailLag = 0`
- no player had an unresolved PP builder freshness blocker in the March 12 pre-action check

### Line builder refresh

Not required in this sub-task.

Reason:

- all retained validation players showed `lineTailLag = 0`
- no player had an unresolved line-context freshness blocker in the March 12 pre-action check

### NST PK source refresh

Required.

Reason:

- Corey Perry remained blocked specifically on PK counts, PK rates, and PK counts-on-ice source tails
- Seth Jones remained PK-blocked, but he is intentionally retained as the incomplete-tail proxy
- a narrow PK refresh from `2026-03-10` was the correct pass-2 action for Perry because that was the current stale tail

### Rolling recomputes

Required.

Reason:

- task `3.2` explicitly requires targeted rolling recomputes for selected validation players
- after source refresh attempts, target rows must be rerun before stored-vs-source comparison can be trusted

## Refreshes Executed

Execution method:

- direct in-process invocation of the existing route logic under escalated network permissions
- this was necessary because the local Next.js server was not reachable from the sandboxed curl path during the task

### 1. PK counts refresh

Refresh invoked:

```text
/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillCounts
```

Observed result:

- endpoint wrapper returned success:
  - `statusCode = 200`
  - `message = "Done"`
- actual NST work completed for:
  - `2026-03-10`
    - `288` rows upserted into `nst_gamelog_pk_counts`
  - `2026-03-11`
    - `41` rows upserted into `nst_gamelog_pk_counts`
  - `2026-03-12`
    - `0` rows
    - page returned no data, which is consistent with no available PK rows for that date at execution time

### 2. PK rates refresh

Refresh invoked:

```text
/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillRates
```

Observed result:

- endpoint wrapper returned success:
  - `statusCode = 200`
  - `message = "Done"`
- actual NST work completed for:
  - `2026-03-10`
    - `288` rows upserted into `nst_gamelog_pk_rates`
  - `2026-03-11`
    - `41` rows upserted into `nst_gamelog_pk_rates`
  - `2026-03-12`
    - `0` rows
    - page returned no data

### 3. PK counts-on-ice refresh

Refresh invoked:

```text
/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-03-10&overwrite=yes&datasetType=penaltyKillCountsOi
```

Observed result:

- endpoint wrapper returned success:
  - `statusCode = 200`
  - `message = "Done"`
- actual NST work completed for:
  - `2026-03-10`
    - `288` rows upserted into `nst_gamelog_pk_counts_oi`
  - `2026-03-11`
    - `41` rows upserted into `nst_gamelog_pk_counts_oi`
  - `2026-03-12`
    - `0` rows
    - page returned no data

## Rolling Recomputation Attempts

Execution method:

- direct invocation of `main(...)` from `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
- options used:
  - `season = 20252026`
  - `skipDiagnostics = true`

Players attempted:

- Brent Burns (`8470613`)
- Corey Perry (`8470621`)
- Jesper Bratt (`8479407`)
- Seth Jones (`8477495`)

### Shared recompute result

For all four players:

- bootstrap succeeded
- source fetches succeeded
- row merge succeeded
- row derivation succeeded
- upsert failed

Shared upsert failure pattern:

- each player reached:
  - `phase = "upsert"`
  - one batch only
- every retry failed with:
  - `Bad Request`
- no rows were upserted for any attempted player

Observed player-level failures:

- Brent Burns:
  - prepared rows: `244`
  - upsert phase failed after `5/5` attempts
- Corey Perry:
  - prepared rows: `204`
  - upsert phase failed after `5/5` attempts
- Jesper Bratt:
  - prepared rows: `248`
  - upsert phase failed after `5/5` attempts
- Seth Jones:
  - prepared rows: `160`
  - upsert phase failed after `5/5` attempts

Interpretation:

- the recompute pipeline can still fetch and derive rows from the current source set
- the blocking failure is now a target-write problem on `rolling_player_game_metrics`, not a fetch-or-derive problem
- this write failure is not isolated to one player or one strength state

## Post-Action Freshness Snapshot

Command rerun:

```bash
npm run check:rolling-player-validation-freshness
```

Observed generation time:

- `2026-03-12T15:00:54.501Z`

Observed status after refresh actions:

- Brent Burns (`8470613`): `READY`
- Corey Perry (`8470621`): `BLOCKED`
- Jesper Bratt (`8479407`): `READY`
- Seth Jones (`8477495`): `BLOCKED`

Important post-action findings:

- Brent Burns remained fully ready
- Jesper Bratt remained fully ready
- Corey Perry remained PK-blocked
- Seth Jones remained the retained PK-blocked proxy

### Why Corey Perry stayed blocked

Even after the PK refreshes succeeded globally, the player-level freshness script still reported:

- latest Perry PK counts date: `2026-03-08`
- latest Perry PK rates date: `2026-03-08`
- latest Perry PK counts-on-ice date: `2026-03-08`

Meaning:

- the refreshes succeeded at the table level for March 10 and March 11
- Corey Perry still has no player-level PK rows beyond March 8 in those source tables
- this now looks like a source-coverage reality for Perry’s PK slice, not a failed refresh invocation

### Why Seth Jones stayed blocked

No broader Jones-specific PK crawl was attempted in this sub-task.

Reason:

- Jones remains the intended incomplete-tail proxy for validation-blocker handling
- the March 12 work focused on Perry’s current PK stale tail because that was the actionable live blocker

## Net Result for Task 3.2

Completed:

- current freshness state was rechecked
- PP and line refresh need was evaluated and explicitly ruled out for this step
- targeted PK NST refreshes were executed successfully for the current stale tail window
- targeted rolling recomputes were attempted for all retained validation players

What changed:

- the PK refresh path is now verified as executable in this environment
- the rolling recompute path is now known to be blocked by a repeatable `rolling_player_game_metrics` upsert failure
- Corey Perry’s remaining PK blocker is now better understood as missing player-level PK source coverage after March 8, not simply a missed refresh

What remains blocked:

- Corey Perry PK validation
- Seth Jones PK validation
- all fresh target-row regeneration work until the rolling upsert `Bad Request` is diagnosed and fixed
