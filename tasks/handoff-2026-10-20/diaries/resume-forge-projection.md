> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# Diary: resume-forge-projection (local_9ebe4f4f-cd18-49d1-8a19-9acdc1fa10ec)
Session title: "Resume FORGE projection runs per game". Status when read: idle, last turn done.

## 1. Scope
- Task: make the FORGE v2 daily projection run (`run-projection-v2`) resumable within one slate date, so slates of 10-16 games finish across several pipeline invocations under Vercel's 240 s limit.
- Why: `run-projection-v2?date=2026-10-17` timed out at the 210 s budget after 10 of 14 games (about 20 s per game, sequential). The run was marked `failed`, and a retry started a new run_id and redid every game. 10-20 has 11 games; 10-22/24/27/29/31 have 10-12.
- Started by the parent session (local_08a0bf1c) with "option 1": one run_id per as_of_date. No task IDs beyond that. Claimed its files with Chef (local_4317ea20) before editing; Chef confirmed no conflict.

## 2. Where
- Branch: octoberBranch (sole checkout). Work was uncommitted in the session.
- Files (all under `web/`): `lib/projections/queries/run-lifecycle-queries.ts`, `lib/projections/run-forge-projections.ts`, `lib/projections/types/run-forge-projections.types.ts`, `pages/api/v1/db/run-projection-v2.ts`, `pages/api/v1/db/run-rolling-forge-pipeline.ts`; tests: new `lib/projections/run-forge-projections.resume.test.ts`, plus `__tests__/pages/api/v1/db/run-projection-v2.test.ts` and `run-rolling-forge-pipeline.test.ts`.
- Hand-over note: `/Users/tim/Library/Application Support/Claude/side-session-notes/local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41/forge-v2-resumable-projection-run-2026-10-19.md`.

## 3. State
- Done and RELEASED as R6a: master commit 3755308fa (pushed 2026-10-19 ~21:41Z with TJ's approval; Vercel web build READY, cms/functions/fhfhockey.com CANCELED). Sync merge b21242f1c put it on octoberBranch (pushed ~21:59Z). Verified with git: `run-lifecycle-queries.ts`, `run-projection-v2.ts`, `run-rolling-forge-pipeline.ts` equal origin/master (b630e0767).
- Design: lease and finished-game list live in `forge_runs.metrics.resume` (no migration). Takeover is compare-and-set on the previous owner. Every write checks the lease, so a killed invocation cannot finalize. A timeout leaves the row `running` and returns 207 `operationStatus:"partial"` with `resume.request` and no `error`; the cron audit records it as `continued`. Resume deletes rows from a half-done game before re-projecting it. The run becomes `succeeded` only when every game is done. A resumed run still reads as `full_slate` (`execution_scope` without requested game IDs, `input_provenance` kept), checked against `forge/players.ts`.
- Pipeline: the projection step gets the invocation's remaining time (180 s from start, measured after the goalie step); a partial result uses neither of the stage's 2 attempts.
- Checks reported by the session: 5 new resume tests; 4 mutation checks (each broken guard fails a test); related 13 files 374 passed/7 skipped; reader/auth/cron set 234 passed/1 skipped; `tsc --noEmit` pass; ESLint clean on 8 files. Chef re-ran 5 files, 57/57. Chef's R6a gate: tsc pass, focused 134/134, full Vitest 16 failed identical to pristine master. One candidate-only edit: the resume test uses master's `buildForgeInputProvenance()`.
- Not verified by me: how the resume behaved in the production cron chain on 10-20 (register ends ~01:10Z 10-20).
- Working tree note: uncommitted edits now in `run-forge-projections.ts` and `run-forge-projections.types.ts` are about league physical totals (another task), not resume. Attribution unverified.

## 4. Next
- None stated. Optional step it deliberately skipped: bounded per-game concurrency (2-3) behind a parameter, only after measuring.

## 5. Blocked / needs TJ
- Resume only works when Starter Board capture and compute are both off. `STARTER_BOARD_COMPUTE_ENABLED` exists in production with an unknown value (register E-6). TJ should check it; if capture is on, the daily run keeps the old fail-on-timeout path.

## 6. Insights
- Known limits: range mode (`startDate`/`endDate`) does not stop at a timed-out date; `begin_forge_game_run` treats a paused full-slate run as active for 10 minutes after its last write (can briefly block Starter Board runs); the goalie step reruns on every resumed pipeline invocation (cost unmeasured).
- Chef constraints to keep: `run-projection-v2.ts` is TJ's file and must keep its `adminOnly(withNhlOffSeasonSkip(...))` export shape (`projection-materialization-auth.test.ts` checks it); keep the A-01 207 `continuation_required` contract and `rollingForgePipelineRunState.ts` untouched.
- Second writer: pg_cron's own `run-projection-v2` (~10:12Z) also writes today's `forge_runs`, inside the cron window 10:05-10:55Z.
- First mutation attempt showed the status guard masking the owner guard; the test was tightened so the fence is checked while the run is still `running`.
