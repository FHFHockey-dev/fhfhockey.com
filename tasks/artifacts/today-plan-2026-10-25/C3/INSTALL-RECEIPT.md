# C3 install receipt — C3a, C3b v2 and C3d installed in the canonical checkout

- **Authority:** orchestrator instruction (TJ moved the lanes back to Claude), lease `T3-C3` in `tasks/artifacts/cross-platform/2026-10-24-coordination/CLAUDE-LEASES.json`. The status reads "ACTIVE canonical 2026-10-25T16:24Z — install C3a + C3b v2".
- **Base:** `octoberBranch` at HEAD `2f2b43230`. No Git commands were run (the orchestrator commits). No live calls, no lock clearing, and no guard, retry or schedule changes.

## Pins rechecked before applying

| Path | Expected | Found |
|---|---|---|
| `web/pages/api/v1/db/calculate-wigo-stats.ts` | `f438eb12…` | `f438eb129e1f70dd0691151916e78a8ea2225412ec63847ce93e334bc9ee9fa6` ✔ |
| `web/lib/underlying-stats/playerStatsRefreshWindow.ts` | `d6a291b2…` | `d6a291b2371deab1f260ff5fe575069c4aaf42fe97a0dd87a81dcc952b820fb1` ✔ |
| `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts` (lease baseline) | `a065e5ea…` | `a065e5ea2a93f2fc93efd93ae90a6e2c72b733566e74597135ef94010815c198` ✔ |
| `C3-a-wigo-per-player-quarantine.patch` | `5e4cdd0d…` | `5e4cdd0d42afcc23ccfa71e17530bd2dbffbdf636bded2644bfa1f6700b35fec` ✔ |
| `second-pass/C3-b-incremental-recent-holes-v2.patch` | `2d1250f0…` | `2d1250f0b9b35adbdfe8def6a6562ff0b3c48b6b6cbd861a7432990adcbe0cea` ✔ |

Both patches passed `git apply --check -p1` and were then applied exactly with `patch -p1`. No `.orig` or `.rej` files were left behind.

## Exact changed paths and post-install hashes

| Path | Change | Post-install sha256 |
|---|---|---|
| `web/pages/api/v1/db/calculate-wigo-stats.ts` | C3a patch, exactly as reviewed | `355f4f19e68b3bce5b2507cbd614f8b65642afbeffb10c3da9560df4b05ce0bd` (= reviewed proposed source) |
| `web/lib/underlying-stats/playerStatsRefreshWindow.ts` | C3b v2 patch, exactly as reviewed | `5a83d97a21c0eab565b86e5fdffa9fc131fad4dd6196d15f3c11efba990f8fc1` (= reviewed proposed source) |
| `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts` | Regression tests for C3a (in lease) | `fc28c83dd430af0a1767e5bace92b2d56982c1159ae8d928ed48a4c80e311022` |
| `web/lib/underlying-stats/playerStatsRefreshWindow.test.ts` | **New file**: C3b selector regression tests | `945761df5fe0ab0191ddd49a308393896a906ddd33134ab3b18e1d284d236958` |

The **new test file is not listed in the lease's `canonical_write_paths`**. No test for this selector existed, so I added it next to the leased source on the orchestrator's "move its tests into the repo's real test locations" instruction. The orchestrator should confirm it or move it.

## Test changes

- **C3a, `calculate-wigo-stats.test.ts`:**
  - Five existing cases asserted the old whole-run 500 for an invalid frame. Under the accepted patch they now expect `207 {success:false, rejectedPlayerIds}` and the exact error text, with **still zero writes**. Those cases are the four `rejects an invalid NHL appearance frame` variants plus the `missing NHL season` coverage case.
  - New case: with one rejected and one valid player, only the valid player's `wigo_recent` and `wigo_career` rows are written.
  - The `installRecentFrameMock` helper gained an optional `players` argument; existing callers are unchanged.
- **C3b, new `playerStatsRefreshWindow.test.ts` (10 cases):**
  - an earlier hole is reselected and `startDate` is the earliest selected date, with `latestCoveredDate` staying the watermark;
  - each hole appears once, and covered games in between are excluded;
  - a hole on the watermark date is selected once;
  - boundary: a hole exactly 7 days back is selected; 8 days back is not;
  - the bound is anchored to the latest finished game, not the wall clock;
  - an unfinished game does not move the bound;
  - controls for no holes, no covered game, and no finished games.
- I did not copy the first-pass route-passthrough test into the repo: `update-player-underlying-stats.test.ts` mocks the selector, and the route passes `selection.startDate` through unchanged. That test stays in `second-pass/tests/`.
- The offline artifact tests in `C3/tests/` and `C3/second-pass/tests/` now import the installed sources. Their "released/canonical" defect cases are superseded and no longer describe the canonical tree. I left them unchanged as frozen evidence.

## Checks

| Check | Result |
|---|---|
| Focused Vitest: `calculate-wigo-stats.test.ts`, `playerStatsRefreshWindow.test.ts`, `update-player-underlying-stats.test.ts`, `update-player-underlying-summaries.test.ts` | **passed** (66/66: 34 + 10 + 16 + 6) |
| Scoped ESLint on the 4 changed paths | **passed** (exit 0, no output) |
| `npm run typecheck` (`NODE_OPTIONS=--max-old-space-size=8192 tsc --noEmit`, whole project, under `/private/tmp/fhfh-heavy.lock`) | **passed** (exit 0, 0 `error TS`) |

A first attempt with plain `npx tsc --noEmit` ran out of memory at node's default ~4 GB heap (exit 134) before reporting any diagnostics; it is not a result. The lock was acquired atomically for each run, released by its owner, and confirmed absent afterwards.

## C3d — installed (diagnostic only)

- **Authority:** an orchestrator message after Codex became BLSH-only. The lease `T3-C3` `canonical_write_paths` now lists `web/pages/api/v1/db/forge-served-forecast-snapshot.ts` with baseline `968c894a…`, noted "C3d diagnostic only".
- **Pins rechecked:** the source was `968c894ab0ece10b7e897278310f89b9c1f2b36ec8d2111e9296cf1029139a72` ✔ and the patch was `b957eceb20f1b206161a2eedd4ee06d478e4b9f0669abd5617d03c929e1f0439` ✔. `git apply --check -p1` passed, then the patch was applied exactly with `patch -p1`. No `.orig` or `.rej` files were left.
- **Behaviour:** the catch-all 500 body gains `stage`, where the error surfaced, and `stageMs`, the elapsed time per stage. There are no new branches, budgets, guards, locks, data or write changes. Both the existing direct 500 for a failed write and the 207 market paths are unchanged. `stage` names where the error surfaced, not necessarily the slow stage; read `stageMs` for that.

| Path | Change | Post-install sha256 |
|---|---|---|
| `web/pages/api/v1/db/forge-served-forecast-snapshot.ts` | C3d patch, exactly as reviewed | `9b78c93ed9f4f56de8102601b57a02c9aa3f749059326759b2c2aa2dd4e13000` (= reviewed proposed source) |
| `web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts` | Permanent route regression test that Codex asked for: 1 new case | `76798133117e4e9bddcb4712b80b83ca53ebb6811020c45783dd63cebc4d9216` |

The test file is **not in the lease's `canonical_write_paths`**, and no lease lists it. Its last change was release `b3f9a7e25`. I added one case on the orchestrator's "run its focused tests" instruction plus Codex's request for permanent coverage. The orchestrator should confirm it.

New case: planning inputs return after spending 95 s of the route's 45 s budget, and the bridge then raises `PlanningReadDeadlineError`. The route returns `500 {success:false, date, error:"Planning read deadline exceeded", stage:"forge_bridge", stageMs:{day_games:0, planning_inputs:95000, forge_bridge:0}}` with no upsert.

| Check | Result |
|---|---|
| Focused Vitest: `forge-served-forecast-snapshot.test.ts`, `planning.test.ts`, `forgeDailyBridge.test.ts` | **passed** (157/157: 8 + 107 + 42) |
| Scoped ESLint: the 2 changed paths | **passed** (exit 0) |
| `npm run typecheck` (whole project, under the heavy lock, after C3d) | **failed outside C3** (exit 2, 8 `error TS`). **0 errors in any C3 path.** All 8 are in `lib/forge-testing-grounds/`: 6 in `boundedWorker.test.ts` and 2 in `memoryRunStore.ts`. They are a run-status union-type mismatch. `memoryRunStore.ts` is modified in the working tree, last written at 12:42 EDT by another lane (likely `tg-testing-grounds`). C3 did not touch it. The earlier whole-project run after C3a/C3b, before that edit, had 0 errors. The lock was released and confirmed absent. |

## C3c

Unchanged, as directed. No code change.
