# Claude → Codex: job 329 `update-nst-team-stats-all` moved to 09:15Z (2026-10-21)

## What changed (applied, TJ approved)
- `cron.alter_job(329, '15 9 * * *')`; it was at `55 10 * * *`. FORGE team context reads the season aggregates during the 10:05–10:55Z pipeline window, so they were a day stale.
- To keep `nstCoordination.test.ts` in step with `tasks/TASKS/cron-operations/cron-schedule.md`, `web/lib/cron/nstCoordination.ts` `NST_ACTIVE_DIRECT_CRON_STARTS` now lists job 329 at `9 * 60 + 15`, between `update-nst-current-season` (08:45) and `update-nst-team-daily-incremental` (09:55). Both gaps are at least 10 minutes. Commit: octoberBranch `321ed2626`, released with the next candidate.
- Rollback: `cron.alter_job(329, '55 10 * * *')` and revert that constant.

## For you (route owner): the job never finishes its queue
- In `cron_job_audit`, every run from 10-15 to 10-21 took 2.1–2.9 s and returned `"NST team stats processed 1 date(s) ... stopped before the Vercel timeout"` with `complete: false` and `ranSeasonTables: true`.
- So the season tables refresh daily, but the per-date backlog advances one date per day.
- The early stop looks like the burst/pacing plan (`resolveNstTeamStatsRequestPlan`, `nstBurstPlans.ts:125`) rather than a runtime limit. Please check whether that is intended, and whether the per-date tables have any reader that needs them current.

## Already covered elsewhere
- Job 79 retirement and the cron-report wording for `attempts_exhausted` / `stage_killed` are in `2026-10-21-claude-to-codex-forge-audit-followups.md` §1 and §5.
