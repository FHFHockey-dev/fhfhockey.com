# Q13 — pg_cron changes: job 278 (rolling, 08:15Z), job 329 (NST team stats, 10:55Z), job 79 (NST gamelog, 07:25Z)

Ask-first production changes. TJ runs them; nothing here has been executed. Evidence: `REPORT.md` §2 (Q3, Q6, Q12 results) and §3 finding 12; `workers/w1-inputs.md` §2–3 (G7, G8), `workers/w4-orchestration.md` §2, P11.

## 278 `update-rolling-player-averages` — daily 08:15Z → weekly
Why: it is the implicit 14-day recompute with no params, dies mid-list every day (ascending-id prefix only; Q6 showed 10-15 at 114/396 and 10-19 at 38/144 rows last inserted by its 08:17Z pass), and the pipeline's stage 4 recomputes run−1 two hours later with the complete NST/line context. The only thing it does that nothing else does is revisit late-arriving source days inside the 14-day window — worth keeping weekly, not daily.
```sql
-- read first
select jobid, jobname, schedule, active from cron.job where jobid = 278;
-- weekly (Sunday 08:15Z), same command/auth
select cron.alter_job(job_id := 278, schedule := '15 8 * * 0');
-- verify
select jobid, jobname, schedule, active from cron.job where jobid = 278;
```
Rollback: `select cron.alter_job(job_id := 278, schedule := '15 8 * * *');`
Note: after Q14 ships, the coverage check names exactly which dates/players the weekly pass must cover; if it stays clean for two weeks, 278 can be unscheduled.

## 329 `update-nst-team-stats-all` — 10:55Z → 09:15Z
Why: FORGE team context (`team-context-queries.ts:329-362`) reads `nst_team_all`/`nst_team_stats` during the 10:05–10:55Z pipeline; at 10:55Z the aggregates are refreshed one day late. 09:15Z sits ≥ 10 min after job 220 `update-nst-current-season` (08:45Z) and before job 328 `update-nst-team-daily-incremental` (09:55Z, ≤ 10 paced requests), so the NST per-hour budget (180) is not at risk: 329 is one season-to-date request set. Confirm the job's own request count from its last audit row before moving it.
```sql
select jobid, jobname, schedule, active from cron.job where jobid = 329;
select cron.alter_job(job_id := 329, schedule := '15 9 * * *');
select jobid, jobname, schedule, active from cron.job where jobid = 329;
```
Rollback: `select cron.alter_job(job_id := 329, schedule := '55 10 * * *');`

## 79 `update-nst-gamelog` — 07:25Z, 6 URLs/run — retire after the backfill (Codex lane)
Why: it has failed every day 10-15..10-20 (Q3) and processes 6 URLs/day against 20 URLs per game-day, so it can never converge; since R11 the pipeline's `upstream_skater_sources` step fetches run−1's 20 URLs (10-21 10:05:59Z: success, 6,784 rows). Once TJ's manual backfill of 10-07..10-18 is complete (verify with `prod-queries.sql` Q5), the job is redundant. The route and `lib/nst/**` are Codex's; the handoff note is `tasks/artifacts/cross-platform/2026-10-21-claude-to-codex-forge-audit-followups.md`. The pg_cron change itself is TJ's:
```sql
select jobid, jobname, schedule, active from cron.job where jobid = 79;
select cron.unschedule(79);
```
Rollback: the original `cron.schedule(...)` text is in `tasks/TASKS/cron-operations/cron-schedule.md` (job 79 block).

## Inventory record (append to `tasks/TASKS/cron-operations/cron-schedule.md` after each change runs)
```
-- 2026-10-2x job 278 update-rolling-player-averages moved from daily 08:15 UTC to weekly
-- Sunday 08:15 UTC (cron.alter_job): the scheduled pipeline recomputes run-1 daily;
-- the weekly pass only revisits late-arriving source days. Evidence:
-- tasks/artifacts/forge-projection-audit-2026-10-21/REPORT.md §3 finding 12, q13-pg-cron-changes.md.
-- 2026-10-2x job 329 update-nst-team-stats-all moved from 10:55 UTC to 09:15 UTC so FORGE
-- team context reads same-day aggregates (pipeline window 10:05-10:55 UTC).
-- 2026-10-2x job 79 update-nst-gamelog unscheduled after the 10-07..10-18 backfill; the
-- pipeline's upstream_skater_sources step fetches the completed day's 20 URLs daily.
```
Also flip the matching `"active"`/`"schedule"` fields in the JSON inventory blocks of that file.
