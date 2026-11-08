# FORGE rebuild: coordination and load plan

2026-11-08. **Planning only; the rebuild remains on hold.** The 2026-09-19..2026-11-06 scope is already approved. No repeat scope approval is requested. No schedules, flags, jobs, application code or production data were changed for this plan.

## What the current evidence establishes

Parent-reported read-only checks at 01:18–01:19 UTC found the rolling-player-averages chain's final chunk succeeded at 00:37:58 (1,830 rows), no running cron rows, no unfinished route-runner jobs, and a responsive database with 17 backends. These observations were supplied to this lane, not independently repeated here. They support recovery and completion of that observed work at that instant. They do not reserve capacity, exclude future jobs, or verify the reported 00:26 P3 mitigation.

Local sources show why a completely writer-free window cannot presently be promised:

| Source | Local schedule/behavior | Consequence |
| --- | --- | --- |
| Canonical cron inventory, jobs 1 and 2 | Lines at minute 00/25/50; stats at 00/20/40 | `*/25` is not 25 minutes after the prior hour's 50. Wait for actual completion, not just the start minute. |
| Jobs 396 and 397 | Forecast settlement at minute 20; queue drain every 5 minutes | The recorded drain URL says `dryRun=true`; that alone does not establish zero DB work or zero writes. |
| Job 399 / route runner | Every minute, conditional on runnable work and no live lease | Current emptiness is useful; a new enqueue can change it. Its lease protects route-runner work, not this script or every writer. |
| `web/vercel.json` | Starter-board and Yahoo live draft every minute; other hourly/daily routes | A 6–13 minute rebuild will cross scheduled starts. Some can be no-ops, but that must be evidenced. |
| Lines source processors, webhook/manual ingress | Additional triggers beyond the static cron inventory | Source settings and invocation history must be included; the cron file alone is incomplete. |

This is a repository schedule inventory, **not a fresh deployed schedule readback**. The parent confirms recurring writers remain enabled. Do not pick a wall-clock window from these local schedules alone.

## Decision required before execution

Keep the existing hold unless Tim/incident owner explicitly chooses one of these interpretations:

1. **Strict: no other production writer may overlap.** Maintain the hold. A point-in-time query, local lock file or new advisory lock used only by this script cannot satisfy this while independent schedulers/webhooks remain eligible. Only a demonstrated natural quiet window long enough for a bounded batch, or a separately approved targeted coordination mechanism that every conflicting writer honors, could satisfy it. No such window/mechanism is established. Do not pause jobs or change schedules under the existing approval.
2. **Recommended for minimal disruption: no other discretionary/heavy recovery job or conflicting FORGE/input writer; explicitly listed normal background jobs may continue under a monitored load budget.** This is a change to the overlap condition, not something to infer from the prior "yes." It still requires the incident evidence below. Keep essential crons running, appoint one coordinator, and serialize this rebuild with manual/backfill work. Named allowed background jobs and exclusions must be recorded before launch; unknown writers remain a blocker.

The recommendation is conditional. It does not authorize overlap now or establish that the database is ready.

## Evidence needed to release the outage hold

Use existing deployment records, logs, metrics and job receipts first. Do not invoke update/processing endpoints to obtain proof. One bounded evidence pass should provide:

1. **Effective P3 mitigation:** exact serving production deployment ID/SHA and rollout time; effective `LINES_OBSERVATIONS_ENABLED` value on that deployment, plus proof the code receiving traffic uses it. Local `lineSnapshotFlags()` gates `processLineSnapshotEvidence` on that flag; disabling `LINES_ENTRY_SERVING_ENABLED` alone is not equivalent. Both `update-lines-ccc` and `update-line-sources` call the processor. Verify all relevant serving deployments/regions and old requests have drained. No secret values need to be displayed.
2. **Observed effect and incident explanation:** compare existing request/query counts, latency and connection/CPU/memory pressure over bounded pre/post-mitigation periods, normalized for natural trigger count. Prefer a 10-minute interval before and after the rollout, excluding the documented drain period, plus the latest 15-minute health interval. Confirm P3-related reads/writes dropped through at least two natural processor opportunities. No invocations during a period is inconclusive about the flag's effect. If attribution remains unknown, state the unresolved cause and obtain an explicit incident-owner risk decision; do not silently waive the "cause and mitigation understood" hold.
3. **Drained competing work:** terminal rolling-chain receipt with no pending continuation; no queued/running/waiting route-runner work or unexpired lease; no in-flight relevant HTTP handlers, SQL jobs, materialization/backfill jobs or local runners. Include pg_net submissions still executing at the HTTP layer, webhooks and manual jobs. `cron.job_run_details` completion can mean an HTTP request was submitted, not that its route finished. `withCronJobAudit` writes its terminal row after the handler and may skip no-ops, so absence of a "running" audit row is not an execution registry.
4. **Current schedule and ownership:** deployed pg_cron/Vercel/other trigger readback, expected next starts, and recent durations/tails for the named competing writers. Coordinator confirms owners will not initiate discretionary recovery work during the reservation and identifies who can stop admission. A coordinator statement must be corroborated by current receipts/activity, not treated as telemetry.
5. **Fresh stability:** no new DB restarts, saturation/connection errors, unexplained long transactions or blocking chains during the latest 15 minutes of available metrics. Immediately before admission, use three sequential guard samples at 0/60/120 seconds (one existing verified session, three SELECTs, each bounded by the guard's 10-second timeouts). Proposed entry target: all three at **30 or fewer** current-database backends, leaving more headroom below the existing 40 threshold. This is a conservative admission proposal, not a newly measured capacity limit. Reconfirm competing jobs immediately before first write. A stale 17 or 28 sample cannot clear the gate.

Keep collection bounded: one batched schedule/queue read and one bounded activity/lock diagnostic, plus those three count samples; existing logs/metrics only for traffic history. Select metadata/aggregate counts rather than query text or private payloads. If a required query fails or evidence is unavailable, stop that pass and retain the hold; do not poll an unhealthy database. These are proposed checks, not checks performed for this plan.

## Execution plan after the conditions are satisfied

1. **One owner and one local process.** Revalidate the prepared script hash and released library base `a68f9b3d2`; preserve the approved date limits and untouched 2025-26 data. Use the confirmed session pooler, process-local URL and verified CA. No Vercel route or deployment is needed. Record a short reservation with start, scope, allowed background jobs, exclusions, stop contact and next known conflicting start. No reservation message has been sent in this task.
2. **Strengthen admission locally before using this plan.** The current script checks only before each date. Propose a focused script change to reuse the same guard before each game’s first DB work and immediately before its persist RPC; add a graceful stop request checked at those boundaries and a per-invocation admission deadline. These are not implemented here. An operator stop, new conflicting job, deteriorating health, or closed scheduling window must prevent the next write even if the backend count is low. The coordinator observes existing job/runtime evidence; the count itself cannot identify conflicting jobs.
3. **Pilot one small date.** From existing receipts or one bounded manifest/count read, choose an in-scope date with only one or two complete games. Use existing `--start D --end D`; a date that only skips unavailable inputs is not a meaningful load pilot. Keep concurrency one and the existing 3-second date gap. Review the pilot's receipts, per-game latency and health before continuing. Do not immediately launch all 49 calendar dates.
4. **Continue one date at a time.** Start the next date only after the preceding one has a terminal receipt and admission still passes. Prefer gaps following actual completion of stats/Lines work, outside the daily FORGE ingestion/derived/projection cluster. Use live schedules to avoid known conflicting starts. Proposed admission deadline for each invocation: the earlier of two minutes after launch or two minutes before the next excluded writer's start. If that leaves no usable interval, do not start. This closes admission; it is not a guarantee that an already-running RPC has stopped. If measured tail duration needs a larger margin, increase the margin or defer the batch.
5. **Preserve the load guard.** At more than 40 backends, admit no new work; keep 15-second waits with at most 20 waits. Never extend a wait past the admission deadline or an operator stop. A missing/invalid sample, connection/TLS/query failure, DB restart, persistence failure, new excluded job or uncertain commit outcome stops the invocation. Counts between 31 and 40 are permitted by the existing guard, but should close admission for the next date until the conservative entry target is restored. No retry loop for failed writes.
6. **Finish safely and resume precisely.** On a graceful stop, finish only the current confirmed operation, close the guard and record the last confirmed game/date. Do not start another game to "finish the date." If a client timeout/disconnect leaves a persist outcome unknown, inspect that game's materialization status/fingerprint/receipt before retrying; killing the local process does not prove server cancellation. Completed games may replay idempotently when resuming the same date, but those reads still consume budget. Carry only confirmed progress forward.
7. **Final check once.** After all approved dates finish, run the original bounded PP comparison once with a 30-second statement timeout. Record rewritten/idempotent/skipped totals and first/last date. Do not rerun projections/accuracy or expand dates.

The existing count measures current-database backends, not cluster-wide slot occupancy, CPU, memory, I/O, lock contention or exclusive ownership. Keep it unchanged; use the incident metrics and activity diagnostic to cover its limits. The guard session's 10-second settings **do not constrain the separate Supabase REST requests**. Local migration source declares a per-game advisory lock and 5-second lock/60-second statement settings for `persist_projection_game_derived_v1`; verify the deployed function and effective request/role timeouts before relying on any runtime bound. A per-game transaction lock is not a global production-job lock.

## Expected cost and stop budget

No new builds or application endpoint probes. Original sizing remains approximately 257 complete games/72 skipped, 49 calendar dates, and 1,850 Supabase calls; the 6–13 minute estimate does not include deliberate gaps or admission waits. The proposed two game-level checks add at most about 658 cheap count SELECTs for 329 candidate games before waits, on the same single guard connection. Actual missing-manifest games skip the persist check. Date guards add at most 49; pilot/gap sampling and replays must be counted separately. Every invocation's deadline bounds new admissions and waiting; do not restart pressure-blocked batches repeatedly to reset the wait budget. Report measured runtime/calls and defer if the estimate is materially exceeded.

## Local source references

- `tasks/TASKS/cron-operations/cron-schedule.md`: jobs 1/2, 396/397 and 399; deployed readback still required.
- `web/vercel.json`: independently scheduled routes and 240-second function setting.
- `web/lib/lines/types.ts`, `processor.ts`; `web/pages/api/v1/db/update-lines-ccc.ts`, `update-line-sources.ts`: actual observation gate and call sites. Local processor contains additional load controls; this plan does not assume they are deployed.
- `web/lib/cron/withCronJobAudit.ts`: handler execution precedes terminal audit insertion.
- `supabase/migrations/20261022133743_route_runner_tables.sql`, `web/lib/routeRunner/store.ts`: route-runner queue and lease scope.
- `supabase/migrations/20260720105524_add_projection_materialization_transactions.sql`: persist function and per-game lock.
- `rebuild-forge-derived-2026-27.ts`, `REBUILD-SIZING.md`, `CONNECTION-GUARD-RESULTS.md`: current script, approved bounds, tests and earlier preflight.

Validation for this planning task: inspected the referenced local code/configuration and document diff. No new tests needed because no code changed. No production calls, pauses, flag changes, deployments, rebuild writes or messages to Claude were made.
