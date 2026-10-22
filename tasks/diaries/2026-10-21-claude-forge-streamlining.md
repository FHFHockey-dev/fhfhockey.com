# FORGE audit streamlining (S-F, S-G, Q10–Q13) — 2026-10-21

- **Scope**
  - Task list: `tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md`.
  - The audit session (`local_f4058d3f`) keeps Q9, Q14, S-B and Q7/Q8. I file and apply its S-B migration at S-B's release.
- **Where**
  - octoberBranch commits:
    - `321ed2626`: cron 278/329 record and NST constant.
    - `312d7759d`: Codex note.
    - `ebdcfe6be`: Q10, Q11, Q12.
    - `0ff219d25`: S-F reader and the 1.3 inventory.
    - `05ee907ca`: ledger 95 applied.
  - None of them is pushed yet.
  - Production is on R15 `42eb9fd80`. R16 candidate `d5283309829f` (Q10/Q11/Q12 plus the cron constant, no S-F) is gating in `scratchpad/r16-export`.
- **State**
  - Cron: job 278 weekly (`15 8 * * 0`) and job 329 at `15 9 * * *`, applied about 17:58Z.
  - RPC `forge_latest_rolling_rows` applied as ledger `20261021182129`. EXPLAIN shows a primary-key backward probe per player.
  - S-G done: the writer stops writing the 491 columns (R17) and the drop is applied (ledger 96).
  - NST is down (HTTP 521). The pipeline degrades on an NST source shortfall (R18).
- **Decisions (TJ)**
  - 3.1: new RPC. Job 278: weekly. 7.3: pg_repack if available (installed version is null; 1.5.0 is available; TJ runs the CLI).
  - S-G: drop all 491 columns and narrow the scripts.
  - R16 without S-F. S-F waits for the FORGE model release (6 unreleased commits under `skater-queries.ts`).
- **Releases:**
  - R16 `1ed78ca5d`, R17 `8b99c22d2`, R18 `56fb03fef` (NST degrade plus the even-strength assist refit) are all live and smoke-tested.
  - Migration 96 (the 491-column drop) is applied.
  - pg_repack is unusable at 1.5.0; TJ runs `VACUUM FULL`.
- **10-22 update**
  - Live since: R19 `3929c6422` (S-F-lite, S-B crons, pp1, ledger 97) and R20 `248df9923` (NST gamelog deadline/resume). 10-22 morning pipeline clean.
  - R21 `99c9e56b7` live (deployment `dpl_7ZG28acCKCeHXn7tgL6x5eDEeQEi` READY; smoke 5/5 incl. `/db/runner` 200 and the jobs API 401 unauthenticated). Migration 98 (route_runner tables, ledger `20261022133743`) applied before the push; pg_cron job 399 `route-runner-tick` scheduled after it (first runs succeeded with 0 rows, so no HTTP call while idle). Route-runner diary retired.
  - FP valuation audit saved: `tasks/artifacts/fantasy-point-audit-2026-10-22/REPORT.md`, with production Q1/Q2/Q5/Q6 results in Appendix C (F2 confirmed in production; F3 null band 10-12..10-18 matches the NST gap; zero hit/block rates 38–49% from 10-19). Q3/Q4 wait for a week of ledger data.
  - Gotcha: `supportedBaselineMigration.test.ts` fails at octoberBranch HEAD because `20261021210000_in_season_sandbox_billing.sql` (committed in `fd58ba245` by another session) has no migration-authority record. Not mine.
  - R22 `f8c874a6c` live (`dpl_5GUANvUtWoqaWa38PTAgM6PYaD4j` READY; smoke 5/5): /db/runner URL builder + restyle, `$page-max-width` 90% token. Runner-builder diary retired. octoberBranch synced (`878dbc9e3`).
  - NST backfill 10-07..10-18 complete (TJ, 14:19Z) and counted (6.1 done). Job 79 unscheduled by TJ's approval (5.5 done, `0b6ef82e2`).
- **Next**
  0. TJ queues the bounded rolling recompute on /db/runner: `/api/v1/db/update-rolling-player-averages?startDate=2026-10-07&endDate=2026-10-21&fastMode=true&executionProfile=overnight`; then 6.3 (re-run audit Q5 for null/zero last-5 rates).
  1. TJ runs `VACUUM FULL` on `rolling_player_game_metrics` at a quiet hour; then check the size.
  2. TJ's console-loop NST gamelog backfill (10-07..10-18) was 126/240 at 13:30Z. On "Backfill complete": the 6.1 counts, the 6.2 bounded rolling recompute and the job 79 unschedule.
  3. R21 approvals as above.
  4. Full S-F hydration plus F3/F4 hits/blocks ship with the next FORGE model release (audit session).
- **Gotchas**
  - Pre-2026-27 rows still hold pruned wide values, so never omit the pruned keys from the upsert.
  - Before the drop, check master's code for the 491 names too.
  - `qualify-native-players-offline.test.ts` fails 30 tests at HEAD (pre-existing, `b8fe1072e` fixture gap).
  - The sizing query over 491 columns timed out; don't retry it.
