# 2026-11-06 Claude: cron report fixes (lane 1)

## Scope
Fix root causes of every error/warning in the 11-06 daily cron report; improve report wording.
Owned: cron-report.ts, CronReportEmail/*, lib/cron/reportSource.ts, reportMetrics.ts, their tests, one new migration
(+ withCronJobAudit.ts and processor audit call sites if needed).

## Where
- octoberBranch, canonical checkout. Owned files clean at start.

## State
- Email read (11-06 13:01 UTC). Baseline: 9 focused test files / 260 tests pass.
- Root causes found:
  1. cron_job_audit no index, stale stats (planner: 1 row) -> seq scan + sort per page, 8 s authenticator timeout.
     Migration supabase/migrations/20261106233000_cron_job_audit_report_index.sql (local only).
  2. 8,620/9,251 rows/day are no-op successes (eventsLoaded 0) from starter-board's
     retryPendingLineSourceEvents fan-out (5 line-sources + 1 ccc per minute). Skip those audit inserts.
  3. Success history: 30-day lookback of all successes (~270k rows) vs 8 pages -> always incomplete.
     Restrict to failing jobs with no in-window success.
  4. "x-timeline-poll, update-lineup-deployment-tallies — 1 row": pg_cron return_message "1 row" from net.http_*.
     x-timeline-poll not in cron-schedule.md inventory (Edge Function, no audit writer) -> unscheduled UNKNOWN.
     update-lineup-deployment-tallies inventory route lacks ?action=current -> query check rejects its run.
  5. update-rolling-player-averages UNKNOWN: prod (origin/master) lacks the weekly-slot fix already on octoberBranch.

## Checkpoint: implemented (uncommitted)
- withCronJobAudit `skipAuditWhenNoOp` + lib/cron/emptyQueueRun.ts; both processors opt in.
- cron-report: success history filtered by job_name (+route path); jobid beats query drift; pg_net "1 row" reworded;
  Edge Function dispatches summarized (email footer + JSON), out of UNKNOWN; plain timeout wording.
- cron-schedule.md: job 391 route now ?action=current.
- Focused vitest: 340/341; the 1 failure is pre-existing cron-audit-wrappers (nst-team-stats uses
  withNstJobLifecycle, from bbc707815; not mine). eslint clean. typecheck running.
- Gotcha: `.in("job_name")` drops matches for renamed custom job names; test fixture updated accordingly.

## Checkpoint: committed a949d4d4a (octoberBranch, local only)
- typecheck exit 0. Migration registered by X-timeline session as authority row 116 (sha b6750726…).
- Next: TJ pop-up on applying the index; tell local_1fb55d9b when applied (it marks the row).

## Checkpoint: index applied to production (TJ approved via pop-up)
- Ran CREATE INDEX CONCURRENTLY + ANALYZE via Supabase execute_sql (not in schema_migrations).
- Readback: cron_job_audit_run_time_idx valid/ready, 25 MB; reltuples 350,599.
- EXPLAIN ANALYZE 24 h read at offset 8000: Index Scan + Incremental Sort, 911 ms (was seq scan, 8 s timeout).
- Told local_1fb55d9b to mark row 116 hand-applied. Confirmed: row 116 now "unknown" (hand-applied); its readback
  matches. Ledger repair `supabase migration repair --status applied 20261106233000` waits for TJ.
- Remaining: release of a949d4d4a (empty-poll skip, narrower lookback, wording); first clean report 11-07 13:00 UTC.

## Blockers / approvals
- Migration apply needs TJ pop-up approval. migration-authority.json row: ask local_1fb55d9b.
