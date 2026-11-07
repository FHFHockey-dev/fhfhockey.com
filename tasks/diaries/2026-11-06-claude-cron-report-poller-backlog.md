# 2026-11-06 Claude: cron report lane 2 (poller health + tweet backlog)

Scope: daily cron report gains (A) FxTwitter poller health per account and (B) tweet-review backlog with day-over-day change.
Parent: cron-report chef local_c95982ca. X-timeline owner: local_1fb55d9b. Lane 1 owns cron-report.ts and CronReportEmail/* edits until it commits.

## Where
- Branch octoberBranch, canonical checkout.
- Migration (mine, local, NOT applied): supabase/migrations/20261106230000_x_timeline_poll_runs.sql
- Libs: web/lib/cron/xPollerHealth.ts (+ .server.ts, test), web/lib/cron/tweetReviewBacklog.ts (+ .server.ts, test)
- Components: web/components/CronReportEmail/PollerHealthSection.tsx, TweetBacklogSection.tsx

## Decisions
- Persistence: SQL capture job (fn x_timeline_capture_poll_runs, cron */15) over an edge write: no redeploy, poller hot path untouched, same bodies the watchdog trusts. Pre-v5 bodies lack "providers": filter on '"results":[{"sourceKey"'.
- Switched accounts: enqueue parity (each shadow first sighting >= switched_at has exactly one source='fxtwitter' queue row) + read success / fail streak / staleness.
- Backlog delta: daily snapshot table (tweet_review_backlog_snapshots) written by the report; deltas blank until applied.
- Ticket 1 sent to local_1fb55d9b 19:4x UTC asking for schedule.sql cron line + migration-authority row. Awaiting reply.

## Gotchas
- PG 15: no pg_input_is_valid; per-row exception block.
- Live email is CronAuditEmail.tsx (route imports it), not CronReportEmail.tsx.
- countRemainingByType is unexported in tweetSwipeTrainerServer.ts; export it rather than copy.

## State (≈19:50 UTC)
- Built: xTimelinePairing (moved from replay script, replay now imports it), xPollerHealth(+server), tweetReviewBacklog(+server), both section components; countRemainingByType exported.
- Vitest 16/16 (3 files). eslint exit 0 on 12 files. typecheck running.
- Read-only sample rendered (scratchpad sample-sections.html). Coverage now starts at each account's first sighting (01:32 UTC 11-06) and skips the last 10 min (in flight); one miss = warning, critical needs <90% and >1 miss.
- Finding: CCC post 2118791055374225476 (IFTTT 19:45, "Nov 6, 2026: NHL Starting Goalies") not in shadow by 19:49 while CCC reads OK — (was guessed as a thread gap; X-timeline lane found it is an own post and FxTwitter's profile feed was stale). Plus the known CCC reply miss.
- Lane 1 still has cron-report.ts uncommitted → wiring not started.

## Committed
- 6675adae3 part (a): 13 files (libs, tests, components, migration, replay refactor, countRemainingByType export). typecheck EXIT 0, Vitest 16/16, eslint 0.
- TJ (pop-up): will apply 20261106230000 + capture cron line by hand. Verify read-only afterwards (table exists, cron job active, rows arriving).

## Next
 Wait for chef's "lane 1 committed" + X-timeline reply on ticket 1; then wire into cron-report.ts + CronAuditEmail.tsx (the live email).

## Amendments (X-timeline OK, ~20:10 UTC)
- 5d4133bfa: via/gap_state/gap_pages columns; x_timeline_poll_job_runs copied from cron.job_run_details by runid range (index scan ~59 ms; that table has 215k rows, runid index only). Missed = started − captured, last 2 min skipped.
- Migration final sha256 c62595ff…63ec, sent to local_1fb55d9b; they add migration-authority row, baseline test counts and the schedule.sql cron line.
- Checks after amendments: Vitest 17/17, typecheck EXIT 0, eslint 0.

## Part (b) wired (~20:40 UTC)
- Chef: lane 1 committed a949d4d4a. Wiring commit 1cb573c9a (cron-report.ts, CronAuditEmail.tsx, readers' not-installed handling, missingRelation.ts, reportSectionReaders.test.ts, cron-report.test.ts +1 case).
- Checks: 5 Vitest files 119/119 (cron-report.test 98/98), typecheck EXIT 0, eslint 0.
- TJ approved applying migration + cron line via pop-up, but both execute_sql and apply_migration were DECLINED by the tool. Not applied. Hand-apply needed: run the file in the SQL editor, then the capture cron line, then `select public.x_timeline_capture_poll_runs();`.
- Live sample (read-only, not installed): CCC coverage 7/9 → PROBLEM (reply 2118526534642553031 + own post 2118791055374225476 unseen: stale FxTwitter profile feed, not a thread gap); NHL_Rosters queued once 3/3.
- Not committed: tweetSwipeTrainerServer.ts has another session's +16 lines now; left alone.

## Next
After TJ applies: read-only verify tables, cron job active, capture rows; tell X-timeline lane to add authority row + schedule.sql line (sha c62595ff…).

## Migration applied (~20:12 UTC)
- plugin:supabase declined apply_migration 3×; TJ chose the second Supabase connector → apply_migration succeeded. Ledger version 20261106201221 (≠ file 20261106230000; file sha unchanged c62595ff…).
- cron 'x-timeline-poll-capture' jobid 402 */15 active; first capture: 1,260 rows / 180 runs, 180 job runs (14:12–20:12 UTC). RLS on, service_role only, secdef + empty search_path. Verified read-only.
- Live data exposed 3 flaws, fixed in 0c556b717: per-run start→body matching for missed runs, no leading-edge gap, "failing now" needs 3 misses. Vitest 119/119, typecheck EXIT 0, eslint 0.
- X-timeline lane told: authority row (note the ledger version) + schedule.sql line.

## Remaining
- First backlog snapshot is written by the next real report run (13:00 UTC 11-07); day-over-day changes from 11-08.
- Nothing pushed. Diary can retire once the chef records the outcome.

## Rename (~20:30 UTC)
- bfc6036e4: migration file renamed to 20261106201221_x_timeline_poll_runs.sql (ledger version), sha unchanged; REPORT_SECTIONS_MIGRATION + notes/tests/comments updated. Report tests 122/122, typecheck EXIT 0, eslint 0.
- supportedBaselineMigration.test.ts fails on the path only until the X-timeline lane moves row 115 (expected; they own it).

## Staleness + capture edge (~20:40 UTC)
- c5510348e: stale-feed warning (IFTTT newest settled post >20 min ahead of shadow newest; 10-min in-flight grace). Switched accounts: last-sighting age only; critical rule waits for the Pi cross-check.
- 8447c2b60: trailing gap ends at the newest captured job run (capture is every 15 min); runs in its last 2 min not judged.
- Live: CCC stale (28 min); 179/179 runs left a result; longest gap 2 min.
- Checks: 141/141 in 6 files incl. manifest test; eslint 0; typecheck EXIT 2 only from TweetSwipeTrainer/TrainerCard.tsx (swipe-trainer session WIP, not mine).
