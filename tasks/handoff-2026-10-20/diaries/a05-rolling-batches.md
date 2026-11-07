> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# a05-rolling-batches (session local_ac605ae9-d057-4ce4-9544-6fb36c70b3be)

Title: "Bound the daily rolling-metrics recompute (A-05)". Idle after 63 turns.

## 1. Scope
- Finding A-05 in `tasks/artifacts/sprint-audit-2026-10-19/CROSS-CHECK-AUDIT.md`: cron job 278 (`15 8 * * *`, POST {}) runs a 14-day window (15 dates) at concurrency 4 with no time stop, so Vercel kills it at 240 s after the lowest player ids. Evidence E-2 in `tasks/artifacts/super-goal-audit-2026-10-17/PROD-READS-2026-10-19.md`: 2026-10-14 to 10-17 all-strength rolling rows were 0-8% of WGO skater-game rows. Why it matters: the FORGE skater stage reads these rolling metrics, and production FORGE forecasts have been stale since 09-29.
- Brief: confirm the mechanism, then make the scheduled path finish or resume (runtime budget, resumeFrom cursor, truthful 207). Never call truncate, never default to fullRefresh, change no schedules, do not edit `run-rolling-forge-pipeline.ts`.
- Started by local_08a0bf1c. Related: A-01 (pipeline), A-12, A-19.

## 2. Where
- Branch octoberBranch. Commit `b47c512fb` (TJ, 10-19 11:18, "Fix six audit findings...").
- Files: `web/pages/api/v1/db/update-rolling-player-averages.ts`, `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`, their two test files, new `web/lib/rollingPlayerDailyResume.ts` (identical blob on master and octoberBranch).
- Released to master in R5 `bb21d5942` (10-19 14:16) as a partial port: the R5 candidate notes say most hunks applied cleanly, the output-loop hunks were hand-ported without the aligned-count builder. octoberBranch's two route/fetch files still differ from master (they also carry `rollingPlayerCountSupport` and `resolveRollingFullRefreshMode`, unreleased work of other sessions).
- Hand-over note (outside repo, not read by helper): `a05-rolling-runtime-budget-2026-10-19.md` in local_08a0bf1c's side-session notes folder.

## 3. State
- Done and released (R5). Session checks: 143 tests across 7 related files pass, ESLint clean, full tsc exit 0. Mutation check: the windowed-vs-full-history equivalence test fails when the derive skip is broken.
- What changed: `stopClaimingPlayersAtMs` stops claiming new players at a deadline (default 180 s on the `daily_incremental` profile; `maxRuntimeMs` overrides, `disableRuntimeBudget` removes it); finished players are an id-ordered prefix, so `nextResumeFrom` resumes exactly; `stoppedReason` is complete / max_players / runtime_budget; 207 with `success:false`, `operationStatus:"partial"` and `resume.request`; `resumeCursor` placed first so the cron audit's 4,000-char preview keeps it; `continueDailyWindow=true` reads today's latest cursor from `cron_job_audit` (complete window returns 200, no work); pre-window games update running totals but no longer build output rows.
- Later use: the Chef ran the daily window locally on 10-19 17:25Z with `disableRuntimeBudget=true` and fastMode: 200, `operationStatus:"warning"`, 25 min 11 s (`tasks/artifacts/release-r2-2026-10-19/ops/rolling-1-chef.json`). A bounded recompute (214 players, dry-run 3 first) was handed to local_c39098ae after R6d; its outcome is unverified.

## 4. Next
- Nothing stated beyond TJ's schedule decision below. Also unverified: whether the production rolling data is now caught up (the R6d bounded recompute outcome is not in this transcript).

## 5. Blocked / needs TJ
- Schedule proposal, not applied (no evidence in the repo that it was): keep job 278; add 6 pg_cron entries, same URL and auth, body `{"continueDailyWindow": true}`, every 5 minutes 08:20-08:45 UTC (5 min exceeds the 240 s cap so runs cannot overlap; finished window returns in about 1 s; chain ends before the 10:05 UTC FORGE pipeline). Needs TJ's approval.
- Pipeline dating, reported only by the session: `run-rolling-forge-pipeline.ts:156-163` defaulted dates to today ET; the cron fires 06:05 ET, so its rolling step covered only today and never recomputed yesterday. Resolved since, checked in the current tree: R5 `bb21d5942` (A-01 resumable pipeline) makes `parseDateWindow` recompute the last completed day for the implicit scheduled window.
- The session also reported the pipeline counted this step's 207 as a failed step. Resolved since: the pipeline now classifies `operationStatus:"partial"` with `resume.required` as `partial`, and R5's `withCronJobAudit.ts` has a "continued" planned-partial 207 rule.

## 6. Insights
- Mechanism confirmed: `startDate` is deleted at ~:2981 so each player's full WGO and NST history is read for 5 strengths; a full output row was built for every career game x 5 strengths, then discarded outside the 14 days.
- History reads were NOT trimmed: stored rows include 3-year averages, career averages and career GP%, so reading less would change values.
- Coverage estimate (reasoned, not measured): ~21 requests (200 career games) to ~37 (1,000 games) per player; at 50-150 ms each, roughly 130-600 players per 180 s run; ~700 skaters in season means 2-6 runs a day. Before the fix, runs reached about 15-40 players.
- A run killed before answering leaves no cursor, so its players are redone, never skipped.
- R5 changed the FORGE pipeline cron to `5,10,15,20,30,35,40,45,55 10 * * *` (UTC), a separate A-01 change.
