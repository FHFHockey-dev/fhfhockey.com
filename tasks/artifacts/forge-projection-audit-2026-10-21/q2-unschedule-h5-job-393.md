# Q2 — unschedule pg_cron job 393 (`run-forge-projection-v2-weekly`, `run-projection-v2?horizonGames=5`, 10:12Z)

Ask-first production change; TJ runs it. Nothing here has been executed.

## Why
- No reader consumes `horizon_games = 5` rows: the RSO bridge (`forgeDailyBridge.ts:481-484`), Start Chart (`start-chart.ts:884`) and the accuracy job (`run-projection-accuracy.ts:1700-1701`) all filter to `horizon_games = 1`; `forge/players.ts:332-337` refuses to relabel h5 → h1.
- Until Q3 lands, the h5 run can be the newest succeeded run for a date and make every reader return zero skater rows (prod 10-21: run `a9b49a47` `h5:full` created 10:12Z, 70 rows all horizon 5).
- It shares the same-date run lease with the pipeline's h1 run (409 → 207 `run_in_progress_elsewhere`) inside the 10:05–10:55Z window, and failed 5 of the last 7 days (422 10-15..10-19, 500 10-20).
- Cost: ~70 s (10-21) to ~200 s of function time per day for unused rows.

## SQL (read-only check, then the change)
```sql
-- 1. confirm the job id and command before touching it
select jobid, jobname, schedule, active, left(command, 120) as command_head
from cron.job where jobid = 393;

-- 2. unschedule (by id; jobname 'run-forge-projection-v2-weekly' also works)
select cron.unschedule(393);

-- 3. verify
select jobid, jobname from cron.job where jobid = 393;   -- expect 0 rows
```

Alternative (if a second attempt at tomorrow's h1 run is wanted instead of removal): re-create as `run-projection-v2?date=<tomorrow>` is not expressible in a static cron URL; the route takes `date=` only. Prefer removal; the pipeline's stage 8 already projects today and (after Q1) tomorrow.

## Inventory record to add to `tasks/TASKS/cron-operations/cron-schedule.md` after it runs
```
-- 2026-10-21 job 393 run-forge-projection-v2-weekly (10:12 UTC, run-projection-v2?horizonGames=5)
-- unscheduled by TJ. No reader consumed horizon-5 rows (bridge, Start Chart and
-- run-projection-accuracy filter horizon_games = 1); the run competed for the
-- same-date lease with the scheduled pipeline's h1 run and could be selected as
-- the newest succeeded run by horizon-blind readers. Evidence:
-- tasks/artifacts/forge-projection-audit-2026-10-21/REPORT.md §3 finding 3.
```
Also mark the job's `"active": false` (or remove its entry) in the JSON inventory block at lines ~414-425 of that file.

## Rollback
The original `cron.schedule(...)` text is preserved at `cron-schedule.md:1690-1708` (Vault-backed `cron_secret` header). Re-running it restores the job under a new jobid.
