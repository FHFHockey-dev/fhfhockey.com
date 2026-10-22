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
  - R21 candidate `99c9e56b7` (route runner + admin gate on /db + review-token links) gated on master `248df9923`: vitest baseline-only failures, eslint clean, tsc 0. Master copy drops the tick's `responsePreviewKeys` (master's `withCronJobAudit` lacks it). Not pushed: needs TJ for migration 98 (route_runner tables), push, then the `route-runner-tick` pg_cron job.
  - FP valuation audit saved: `tasks/artifacts/fantasy-point-audit-2026-10-22/REPORT.md`. No FP arithmetic bug; input-side under-projection (PP assists per-two-goals scale, hit/block constant fallbacks, position-blind shot priors). Appendix Q1–Q6 are read-only and need TJ's go-ahead.
- **Next**
  1. TJ runs `VACUUM FULL` on `rolling_player_game_metrics` at a quiet hour; then check the size.
  2. TJ's console-loop NST gamelog backfill (10-07..10-18) was 126/240 at 13:30Z. On "Backfill complete": the 6.1 counts, the 6.2 bounded rolling recompute and the job 79 unschedule.
  3. R21 approvals as above.
  4. Full S-F hydration plus F3/F4 hits/blocks ship with the next FORGE model release (audit session).
- **Gotchas**
  - Pre-2026-27 rows still hold pruned wide values, so never omit the pruned keys from the upsert.
  - Before the drop, check master's code for the 491 names too.
  - `qualify-native-players-offline.test.ts` fails 30 tests at HEAD (pre-existing, `b8fe1072e` fixture gap).
  - The sizing query over 491 columns timed out; don't retry it.
