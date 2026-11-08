> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# a20-sustainability-skip (session local_685566fa-d101-415f-9da1-6aa0a0c097ed)

Title: "Re-run degraded sustainability scores (A-20)". Idle after 10 turns (shortest of the group).

## 1. Scope
- Finding A-20 in `tasks/artifacts/sprint-audit-2026-10-19/CROSS-CHECK-AUDIT.md`. Background: R2 (in production since 2026-10-19) fixed the sustainability batch skip so every player is scored. The follow-up audit reproduced one gap: `web/lib/sustainability/score.ts` (~203-238) builds score rows with luck terms set to zero when `sustainability_window_z` is missing and records `missing_window_z_*` warnings; those rows count as current, so a re-run after window_z lands skips them as `source_already_processed`.
- Task: make `detectSustainabilitySourceAdvance` in `web/lib/sustainability/incremental.ts` also read `components->warnings` and treat a player as incomplete when it carries `missing_window_z_*` warnings and window_z rows now exist, using one chunked query. Rows degraded while window_z is still absent must keep skipping (no endless reprocessing). Port the reproduction (`degradedSkip.test.ts` in the Chef's audit scratchpad) into `incremental.test.ts`. Touch `rebuild-score.ts` only if a signature change forces it.
- Started by local_08a0bf1c. Code fix only; no production requests allowed.

## 2. Where
- Branch octoberBranch. Two files: `web/lib/sustainability/incremental.ts` and `web/lib/sustainability/incremental.test.ts`. `rebuild-score.ts` needed no change.
- Commit `b47c512fb` (TJ, 10-19 11:18). Released to master in R5 `bb21d5942` (first appears there via `git log -S missingWindowZKeys`); both files are identical blobs on master and octoberBranch (verified).

## 3. State
- Done and released. Fix: new helper `missingWindowZKeys` builds one key per `missing_window_z_<stat>` warning (player, window, stat). If a batch is complete and nothing is stale but some rows carry these warnings, one chunked, paged query on `sustainability_window_z` (filtered by snapshot, affected players, missing stats) runs. If a window_z row matches a key, the batch is reprocessed with the new reason `luck_inputs_available`; the result gains `repairable_luck_rows`.
- Test (one new, four cases): window_z now exists -> reprocess; window_z still absent -> skip; window_z exists only for another snapshot -> skip; partial rebuild still missing one stat -> skip.
- Checks reported at the time: Vitest 10 files / 33 tests pass (`incremental.test.ts` plus everything under `__tests__/pages/api/v1/sustainability/`); ESLint clean; full tsc FAILED with one error, TS2339 at `web/__tests__/pages/api/v1/start-chart.test.ts:291` (`sumProjectionParts` not exported from `start-chart`), caused by another session's mid-flight A-08 edits to start-chart files, not by this work (no type errors in the sustainability files). The A-08 and A-19 sessions' later full tsc runs exited 0 on the shared tree, so the failure was transient; a tsc run on this session's files alone after that is not recorded (unverified).

## 4. Next
- None stated.

## 5. Blocked / needs TJ
- Operational follow-through is not in this session: it made no production request, so whether the already-degraded production score rows were re-run after R5 is unverified. The Chef register notes the 10-19 10:40Z sustainability run produced 2,568 rows for 642 distinct players after R2; it does not say whether degraded rows were repaired.

## 6. Insights
- One deliberate deviation from the brief: matching is by player, window and stat, not by player and snapshot alone. Otherwise a rebuild that gains `shp` but still lacks `ppshp` would rerun forever, because the `ppshp` warning stays while window_z rows exist for that player.
- The `rebuild-score` test prints `cron_job_audit insert failed TypeError: fetch failed`; the warning predates this work and does not fail the test.
- The repair only triggers on a sustainability run made after window_z rows exist for the same snapshot (inference from the matching rule, not stated by the session).
