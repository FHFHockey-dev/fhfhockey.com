# 2026-11-06 Claude: cron report three lanes (Chef)

## Scope
Chef for three lanes on the daily cron report (`web/pages/api/v1/db/cron-report.ts`, `web/components/CronReportEmail/`):
1. Fix root causes of every error/warning in today's report.
2. Add an FxTwitter poller health section (needs persisted poller runs; coordinate with the X-timeline main session).
3. Status of tweet-pattern-review backlog, answer-key labels and unresolved aliases; propose adding them to the report.

## Where
- Branch `octoberBranch`, canonical checkout. No commits by Chef.
- Cron-report files were clean in git at start (no other lane dirty).

## Findings (read-only)
- 11-06 and 11-05 report emails are identical: "incomplete telemetry; totals unknown", 49/57 jobs unknown,
  `Incomplete cron_job_audit: canceling statement due to statement timeout. 1000 observations retained`.
- Root cause A: `cron_job_audit` has NO index (350,605 rows, 596 MB). The report pages it with OFFSET and
  orders by run_time, job_name, status, rows_affected, details (jsonb), so page 2 hits the statement timeout.
- Root cause B: 9,251 audit rows per 24 h; `/api/v1/db/update-line-sources` writes 7,362 and
  `/api/v1/db/update-lines-ccc` 1,473 (per-minute processors), so 10 pages are needed.
- `cron_job_report` is a view; 2,491 rows per 24 h.
- Lane 3 (2026-11-06 ~20:xx UTC): tweet_pattern_review_items pending 9,289 (reviewed 198, ignored 102).
  Trainer queue: line combos 1,400, goalies 1,830, injuries 644, transactions 192. Answer-key labels: 0.
  lineup_unresolved_player_names: 1,211 pending rows (655 distinct names), 298 resolved, 9 ignored.

## State / next
- Propose lane sessions (cards; this turn was started by another session so the app only allows proposals).
- Lane 1 and lane 2 both touch cron-report.ts / CronReportEmail.tsx: lane 2 builds its own module first and
  wires into the report only after lane 1 commits.

## Blockers / approvals
- Index migration on cron_job_audit and any poller-runs table need TJ approval to apply.

## Checkpoint: staffing
- The app refused direct starts (this turn came from another session), so lanes went out as proposal cards:
  lane 1 `task_1eaf235c` (cron-report-fixes), lane 2 `task_ba9038a6` (poller-health, now also has the backlog block).
- TJ approved putting the tweet-review backlog counts in the report, built in lane 2.
- Lane 2 waits for Chef's word that lane 1 committed before editing cron-report.ts / CronReportEmail.tsx.
- Next: once TJ starts the cards, verify each lane's commit, then tell lane 2 it can wire in.
- TJ started both: lane 1 = local_25c53d56-9f22-417d-8b51-57a19f9cf27f, lane 2 = local_10cd8715-f228-42ea-adf4-63c849c87bc7.
- Checkpoint: lane 2 part (a) committed 6675adae3 (13 files, verified), migration 20261106230000 row 115 pending; waiting on TJ's pop-up. Lane 1 uncommitted (index migration 20261106233000 = row 116), waiting on its own typecheck. Tell lane 2 to wire in once lane 1 commits.
- Lane 1 committed a949d4d4a (verified 11 files). Lane 2 amendments 5d4133bfa. Told lane 2 to wire in part (b) on top of a949d4d4a.

## Final state (Chef)
- Commits on octoberBranch (local, not pushed): 6675adae3, a949d4d4a, 5d4133bfa, 1cb573c9a. Verified file lists.
- Index cron_job_audit_run_time_idx is LIVE (TJ hand-applied; verified via pg_indexes). Needs
  `supabase migration repair --status applied 20261106233000` later.
- Migration 20261106230000 (poller runs + backlog snapshots) NOT applied; Supabase tool declined. TJ runs the file,
  then the x-timeline-poll-capture cron line and one capture. X-timeline session still owes the schedule.sql line.
- Code takes effect only after a release (Vercel build; needs TJ approval).
- Sample shows a real CCC miss: post 2118791055374225476 (starting goalies thread) absent from shadow >30 min.
- Migration applied as ledger version 20261106201221 (~20:12 UTC); file renamed in bfc6036e4. Verified: 1,274 rows in x_timeline_poll_runs, capture cron active. Ledger row 115 path already updated in migration-authority.json (X-timeline session's file, uncommitted).
- Lane 2 follow-ups verified: 0c556b717, c5510348e (stale-feed warning), 8447c2b60 (gap edge). Typecheck red only in TrainerCard.tsx (swipe-trainer's dirty file), not ours.
