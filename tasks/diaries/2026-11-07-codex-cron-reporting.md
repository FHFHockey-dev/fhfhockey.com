# Cron reporting verification and fixes

- Scope: scheduled-job classification and bounded query starvation in cron-report/reportSource only; no deploy or database changes.
- Location: canonical /Users/tim/Code/fhfhockey.com, octoberBranch, started at 040c59341. Shared dirty checkout preserved. Ownership coordinated with cron-pipeline lead; existing report owner recorded as local_25c53d56-9f22-417d-8b51-57a19f9cf27f.
- State: reading existing a949d4d4a and prior cron report diaries before changing source. Reporting paths clean at start. Prior fixes include weekly-slot classification, pg_cron jobid match, narrowed success history, and empty-queue suppression.
- Next: verify coverage for Sunday-only schedule, 09:55 deployment tally, 08:05 power-play success, then fix any remaining gap with focused tests.
- Blockers: none. Release status not yet verified; no production execution authorized in this lane.

## Checkpoint
- Baseline focused source/report tests: 124 passed.
- Existing weekly/tally fixes are in octoberBranch; a949d4d4a is absent from local origin/master. Production state is not independently verified here.
- New confirmed source defect: job 388 inventory URL ends at `?startDate=` because the SQL concatenates the current UTC date. Its resolved audit URL fails strict query matching, so the successful scheduled receipt becomes an extra observation and the job stays unknown.
- Shared read deadline also permits the first core source to consume all 180 seconds before the audit reader starts. Will add bounded parallel core reads (two sources, same deadline) and realistic timeout regression.
- Plan: resolve only the inventory's supported literal/to_char(CURRENT_DATE +/- INTERVAL N days) URL concatenation without SQL evaluation; preserve exact query/method matching and reject unsupported expressions. Add captured-window regression fixtures.

## Handoff checkpoint
- Implemented narrow URL resolver in web/lib/cron/scheduledHttpUrl.ts, wired into cron-report inventory/observations. SQL date concatenations resolve against the scheduled UTC day, not report generation day; query and method identity stay strict. Arbitrary SQL/functions/formats fail closed.
- Core cron/audit readers now start together (concurrency two), retain the same 180-second absolute source deadline, request timeout, page limits, row-image verification and truthful incomplete flags. This removes provable serial-reader starvation; it does not establish that starvation caused today's live report.
- Changed: web/pages/api/v1/db/cron-report.ts; web/__tests__/pages/api/v1/db/cron-report.test.ts; new web/lib/cron/scheduledHttpUrl.ts and scheduledHttpUrl.test.ts.
- Checks: 139 focused tests passed (103 route, 26 reportSource, 10 SQL URL). Focused eslint passed. git diff --check passed. Full web typecheck is owned by cron-pipeline lead and pending at handoff; do not launch duplicate.
- Regression fixtures: 08:05 power-play and 09:55 tally successes, Sunday-only job not due, previous-day slot across midnight, wrong date/query rejection, calendar rollover, concurrent source completion, and audit retention when cron history reaches source deadline.
- No remote requests, database mutations, builds, deploys, commits, or pushes in this lane. Existing unrelated dirty files preserved. Existing weekly/tally corrections in a949d4d4a are retained rather than duplicated. Remote release state still belongs to release owner.

## Final bounded wrapper review
- Auditor supplied exact captured evidence: power-play audit job_name is the route path, not the scheduler name. Updated the regression fixture to that alias and captured receipt timestamps/durations; the two affected tests pass. No runtime code change from accepted patch.
- Checked update-nst-goalies, update-player-underlying-stats and game-predictions/score wrappers. All three have withCronJobAudit in current source and local origin/master. Underlying and score route sources match origin/master exactly. Their audit names differ from cron names: `/api/v1/db/update-player-underlying-stats` and `game-predictions-score`; NST goalie uses default route-path name.
- Underlying-yesterday and game-score-recent inventory entries have the same dynamic date-prefix matching issue as power-play; the new safe resolver supports their existing SQL templates including warmLandingCache=true. A truly absent audit remains unknown, not a successful refresh.
- Current unreleased NST lifecycle wraps outside audit and can return 503 before the audit wrapper runs when lifecycle admission fails. Origin/master does not contain that lifecycle, so it is not established as the cause of today's missing live receipt. Auth denial, killed execution, delivery failure, or audit insert failure cannot be distinguished from missing receipts alone.
- No speculative wrapper added, no cron invocation or production request performed. Next: pipeline lead owns deployment-state reconciliation and final verification.
