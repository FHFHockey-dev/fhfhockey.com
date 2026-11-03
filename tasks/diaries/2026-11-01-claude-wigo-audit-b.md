# WiGO audit lane B (data currency), 2026-11-01

- Scope: read-only; prove whether wigoCharts shows current data. Budget 20 prod SELECTs, logged in audits/PROD-READ-LEDGER.md. Report: audits/B.md.
- Where: octoberBranch, no commits. Files written: audits/TARGET-PLAYERS.md, audits/PROD-READ-LEDGER.md, audits/B.md, this diary.
- State: season 20262027 from data; regular season opened 2026-09-29; wgo_skater_stats complete through 10-31 (226 games, 8135 rows, no preseason rows).
- Pending: planning thread reply on extending scope to seasons, cron_job_audit, cron.job, nst_seasonal_*.
- Next: writer recency, per-player table, B-10 ratio check, then B.md.
- Gotcha: wgo_skater_stats.toi_per_game is seconds. Writer rejects a player when any L20 game id is not type 02 (calculate-wigo-stats.ts:311-330).

## 2026-11-01 close
- State: audits/B.md written; 20 of 20 reads used (B-17 logged, not run). No app changes, no git mutations.
- Checks: every report number comes from ledger B-01..B-21 or a code read. No page or route exercised.
- Open: planning thread never answered the scope request (seasons, cron_job_audit, cron.job, nst_seasonal_*). Root causes of B-04, B-05 and the writer's timeout remain inferred.
- Next: planning thread folds B.md into the plan. Runs in B.md are ask-first for TJ.
- Keep this diary until the plan records the outcome.

## 2026-11-01 extra reads
- TJ approved 4 more reads (B-22..B-25); run and folded into audits/B.md. Budget now 24 of 24.
- Result: Mercer's 26.16 proven as stale N.J row plus cumulative row. Bystedt has no seasonal row. No audit row for the writer since 10-25. Kill by limit is still inferred.
