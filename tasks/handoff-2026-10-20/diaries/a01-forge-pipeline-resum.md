> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# Diary: a01-forge-pipeline-resum (local_54d52afa-2ecc-492f-94ff-e0e8ffc492cd)
Session title: "Make the legacy FORGE pipeline finish in season (A-01)". 532 messages, 69 turns, one task. Status when read: idle, last turn done.

## 1. Scope
- Task: finding A-01 (`tasks/artifacts/sprint-audit-2026-10-19/CROSS-CHECK-AUDIT.md`): make the legacy FORGE daily pipeline able to complete in season, and fix its rolling step to recompute the completed day (yesterday ET).
- Why: no `forge_runs` row had succeeded since 2026-09-29. The Vercel cron `/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&includeDownstream=true&includeAccuracy=false&stopOnFailure=false` ran every stage in one function capped at 240 s; `useDurableProjectionBacklog` forces `stopOnFailure=true`; every non-downstream stage is blocking. After b47c512fb the rolling route returns 207 with `resume.request`/`continueDailyWindow` at 180 s, which the pipeline treated as a failed blocking stage; the rolling step also dated itself today ET.
- Schedule changes were to be proposed only (needs TJ).

## 2. Where
- Branch octoberBranch. Files: `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` (resumable runner, step classification, yesterday fix), new `web/lib/rollingForgePipelineRunState.ts`, `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` (4 new tests plus an in-memory stand-in for the state table). `web/lib/rollingForgePipeline.ts` and the step routes were not changed.
- Hand-over note: `a01-resumable-forge-pipeline-2026-10-19.md` in the shared notes folder (`/Users/tim/Library/Application Support/Claude/side-session-notes/local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41/`).

## 3. State
- Done; RELEASED in R5 (bb21d5942, pushed 2026-10-19 18:16Z, live 18:20Z). Verified with git: `run-rolling-forge-pipeline.ts` and `rollingForgePipelineRunState.ts` equal origin/master (b630e0767). R6a later added projection-step resume into the same route (see resume-forge-projection).
- Schedule: the session proposed `web/vercel.json:32` `5-55/5 10 * * *`. `combinedCronInventory.test.ts` showed it collides with `update-line-combinations-job` (`*/25`) at 10:25 and 10:50, so TJ approved `5,10,15,20,30,35,40,45,55 10 * * *` (UTC). origin/master `vercel.json` has that schedule.
- Design: only the scheduled call (no date) resumes; explicit-date calls run once as before. Progress is stored in the existing `projection_pipeline_state` table and lease function (no migration), one row per stage per day keyed `rolling_forge_pipeline` / `daily_incremental:<today ET>` / stage id; the rolling step's player resume id is saved on its row. Each invocation skips finished stages, runs the rest under a lease that expires 270 s after the invocation started, starts another stage after the first only if under 90 s have passed (rolling needs at least 30 s left), and gives the rolling step 180 s minus time used plus `resumeFrom`. Rolling 207 marks the stage `partial` (not failed) and returns 207 with `termination.state:"continuation_required"`, `rollingResumeFrom`, 0 failed steps. A real failure stops the run; the next invocation retries that stage once; after 2 failures later calls return the same failure without rerunning. A completed run returns 200 and later calls do one DB read.
- Checks reported: pipeline test file 15/15 (a run over 4 invocations; rolling 207 continues; real failure stops and is retried once; a held stage; rolling targets yesterday); two mutation checks caught (reverting the yesterday fix fails 1 test, removing partial handling fails 2); related cron and pipeline-state suites 130/130; ESLint clean on 3 files; full `tsc` exit 0 under the lock.
- Not verified by me: how the 10-20 production chain (10:05-10:55Z) actually ran; the register ends ~01:10Z 10-20.

## 4. Next
- None stated. Session's estimate: 4-8 invocations on a full slate (1 for early stages, 1-3 for rolling, 2-4 for ingest through projection); it is a guess, since rolling speed per player was not measured after the A-05 fix.

## 5. Blocked / needs TJ
- Nothing pending from the session. Limits that need work elsewhere:
  - Limit 1 (cron report showed 207s as failures) was fixed by the treat-continuation-207s session; the email still has no CONTINUED label.
  - Rolling step passes explicit dates; if yesterday's upstream data is stale it returns 422, a real failure: retried once, then the run stops for the day.
  - Any non-rolling stage needing more than about 240 s alone still cannot finish.
  - Source and power-play steps are still dated today; separate overnight pg_cron jobs refresh them.

## 6. Insights
- `projection_pipeline_state` is revoked from service_role directly; the helper reuses its lease RPCs.
- Second writer: pg_cron's own `run-projection-v2` (~10:12Z) also writes today's `forge_runs`, inside the cron window.
- Chef's register notes a fallback one-time task at 2026-10-20 11:15Z that runs 10-20 via localhost only if the cron projection has not succeeded (owned by another session).
- Keep the 207 `continuation_required` contract and `rollingForgePipelineRunState.ts` behaviour intact: `withCronJobAudit` records it as `continued`.
