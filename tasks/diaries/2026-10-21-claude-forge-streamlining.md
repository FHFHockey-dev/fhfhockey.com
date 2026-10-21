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
  - S-G worker running: stop writing 491 columns, narrow the 3 check scripts, regenerate the type keys, write the drop migration (not applied).
- **Decisions (TJ)**
  - 3.1: new RPC. Job 278: weekly. 7.3: pg_repack if available (installed version is null; 1.5.0 is available; TJ runs the CLI).
  - S-G: drop all 491 columns and narrow the scripts.
  - R16 without S-F. S-F waits for the FORGE model release (6 unreleased commits under `skater-queries.ts`).
- **Releases:**
  - R16 `1ed78ca5d`, R17 `8b99c22d2`, R18 `56fb03fef` (NST degrade plus the even-strength assist refit) are all live and smoke-tested.
  - Migration 96 (the 491-column drop) is applied.
  - pg_repack is unusable at 1.5.0; TJ runs `VACUUM FULL`.
- **Next**
  1. Gate R16, then push it with the Vercel watch and smoke test, then sync and push octoberBranch.
  2. Review S-G.
  3. Release the S-G writer change.
  4. Apply the drop migration with approval.
  5. pg_repack.
  6. 6.0 backfill counts once TJ's NST backfill is in; then the job 79 unschedule.
- **Gotchas**
  - Pre-2026-27 rows still hold pruned wide values, so never omit the pruned keys from the upsert.
  - Before the drop, check master's code for the 491 names too.
  - `qualify-native-players-offline.test.ts` fails 30 tests at HEAD (pre-existing, `b8fe1072e` fixture gap).
  - The sizing query over 491 columns timed out; don't retry it.
