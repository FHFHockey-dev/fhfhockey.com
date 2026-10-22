# FORGE pipeline repair — claude (Fable 5.1), 2026-10-21

Scope: scheduled rolling→FORGE pipeline (run-rolling-forge-pipeline) returns 504 at 240 s; stage stuck `running`; line/PP race; speed; per-game coverage; RSO drop ranking proposal; tonight's bounded prod steps.
Owned: `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` (+test), `web/lib/rollingForgePipelineRunState.ts`, `web/pages/api/v1/db/update-rolling-player-averages.ts` (+test), `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` (+test). Never NST/WGO/cron-report (Codex lane); never TJ's RSO past-day files.
Where: `/Users/tim/Code/fhfhockey.com` octoberBranch, HEAD 9e97c5837. Nothing committed.

## State
- Read pipeline route, run-state lib, rolling route + writer. Session restarted on Fable 5.1 (no edits before restart).
- TJ approved (this session) the read-only prod list: Vercel runtime logs 10:04–11:00Z for the pipeline route, deployment/SHA lookup, ≤10 Supabase SELECTs.
- Vercel logs pulled: scratchpad `prod/pipeline-logs.jsonl` (2,305 lines).

## Evidence (prod, read-only; 2 Vercel log queries, 10 Supabase SELECTs, all approved)
- Cron: vercel.json `5,10,15,20,30,35,40,45,55 10 * * *` (9 calls). Requests source: 10:05 207, 10:10 504, 10:15 504, 10:20 207, 10:30–10:55 504. Deployment dpl_3wsARCw… = master 7baa91407.
- Runtime logs cap at 256 lines/invocation (tails hidden). Every rolling run starts `resumePlayerId: null`, 396 players, ~1 player/s aggregate (concurrency 4; per-strength fetch ~0.65 s × 5 sequential + wgo/pp/line).
- `rolling_player_game_metrics.updated_at` is insert-time: 10-20 rows inserted 08:15–08:18 (job 278), then by pipeline runs at 10:12, 10:13, 10:17–18, 10:23, 10:33 — each run restarts at the first id and reaches ~60 ids further than the last before the 240 s kill; 10:35+ runs added nothing. 320/396 players done; last id 8482859.
- Root cause 1: the pipeline stores the rolling cursor only when the step returns; the step (180 s claim budget + unbounded in-flight tail with 8 s statement-timeout upsert splits/retries) never returns before the kill → `running` forever, zero durable progress.
- Root cause 2 (race/422): 10:20 run reached its budget and returned 422 because lines for games 146–151 were missing (written 10:25 by the */25 cron once `teamGameStats` had both teams). Pipeline passes explicit dates → blockers fatal. Stage marked failed attempt-1, then re-killed.
- DB: `authenticator` role statement_timeout=8s (applies to PostgREST/service_role); `rolling_player_metric_support_payloads` 8 MB table but 1.58 GB total (GIN jsonb_path_ops index) → 5-row upserts hit 8 s → split/retry tails. `rolling_player_game_metrics` 1,114 columns, 6.6 GB, never autovacuumed (stats stale). DB-side changes are TJ's call.
- 10:12 h5 run a9b49a47 succeeded (70 skater rows h5, 2 games); audit row status success. Cron-report wording not verified (cron-report job not in my approved queries).

## Design (implementing)
1. Writer: hard in-flight deadline (`abortInFlightAtMs`): aborts the player at phase boundaries, bounds retry sleeps; cursor = contiguous *completed* prefix; per-strength NST fetches run in parallel (same rows, same derive).
2. Route: `deadlineAt` epoch-ms param; daily_incremental default = start + 220 s.
3. Pipeline rolling stage: chunk loop (`maxPlayers` sized from measured ms/player), persists the cursor after every chunk (durable progress inside one invocation), `bypassFreshnessBlockers=true` (blocker count still reported).
4. Pipeline contextual stage: line combos via `repairMode=historical_backfill&gameIds=<source-date games>`, PP as before, then verify every source-date game has both teams' line rows; incomplete → fail once (retry next invocation), second time proceed with warning.
5. Dead-lease recovery: a `running` row whose lease expired is marked `stage_killed:attempt-N` before re-acquire; cap 3 → attempts_exhausted (visible), never silent looping.

## State (implemented, uncommitted)
- Files: `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`, `web/pages/api/v1/db/update-rolling-player-averages.ts`, `web/lib/rollingForgePipelineRunState.ts`, `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` + their 3 test files.
- Dead-lease rule: `running` + lease expired + (expiry − updated_at) > 60 s ⇒ the holder died (partial hand-offs use a 30 s lease; chunk advances keep the invocation's 270 s lease). Kills counted on companion row `<stage>:kills` (cursor_game_id); 3 kills ⇒ stage closed `stage_failed:attempt-2`, run stops visibly.
- Checks: Vitest pipeline 46 + rolling route 24 + writer 60 + projectionPipelineState: 132/132 pass. ESLint clean on the 7 files. Full tsc under lock: running (see report).
- One mistake caught by tests: `processClaimedPlayer` argument order (playerId became 0).

- TJ decided (pop-up, this session): coverage = today + tomorrow (implemented in the scheduled projection stage with a dates-done cursor); DROP chip = rank known, flag unknown (separate RSO task, proposed as a session); tonight = finish rolling tail then project 10-21; DB proposal = write it (done: `tasks/artifacts/forge-pipeline-repair-2026-10-21/db-proposal-rolling-support-payload.md`, not run).
- After the projection change: 8 suites 266/266, eslint clean, final tsc under lock: see report.
- Hand-over note with tonight's exact URLs: side-session-notes `forge-pipeline-repair-2026-10-21.md`.

- Tonight's steps (TJ, prod, deployed 7baa91407, ~14:15Z): step 1 (rolling tail) returned 500 "canceling statement due to statement timeout" — the 8 s PostgREST cap on the GIN-indexed support-payload upsert, confirmed in production; TJ chose to defer the index drop. Step 2 `run-projection-v2?date=2026-10-21` → 200 completed in 36 s: run 5871cce5-3b56-4162-9a40-aaf0793dd4cb, git_sha 7baa91407 (stamped), 70 h1 skater + 4 goalie rows, preflight 10/10 PASS (verified with one approved SELECT). The RSO bridge takes it as the newest succeeded 10-21 run.

- between 14:16Z and 14:20Z, on TJ's explicit instruction: dropped `idx_rolling_player_metric_support_payloads_payload_gin` on production (lock_timeout 5 s; verified only pkey + snapshot indexes remain). TJ retries the rolling-tail URL himself. A migration recording the drop is still owed (see the proposal artifact).

- After the drop, TJ's retry of the rolling tail (prod, deployed writer): 200 warning, 75 players / 375 rows in 24 s, `stoppedReason: complete`, 6 freshness blockers bypassed (source-tail lag for a few players; degraded rows, not missing). ~3 players/s vs ~1/s this morning: the GIN index was the dominant cost, so even the deployed code would now clear 396 players in roughly 130 s. 10-20 rolling is complete. TJ re-ran the 10-21 projection at 14:20Z: run 34c3291c-06b9-4ed6-a23b-4b70bb399739, completed, 70 h1 skater + 4 goalie rows, preflight PASS — now the newest succeeded 10-21 run.

## Chef review round (TJ-approved fixes 2, 3, 4)
- Fix 2: the writer's in-flight deadline is now per run via `AsyncLocalStorage` (`runDeadline`; `main` wraps `runMain` with `run`/`exit`), read by the phase checks and the retry helper. Regression: two concurrent `main()` calls, one without a deadline and one already past it, keep their own outcomes.
- Fix 3: the next-day projection is best effort: a failed `date+1` step is recorded as `skipped` with `Next-day projection for <date> failed (non-blocking): HTTP <code>; failed gates …; <message>` and the stage completes; `failureSummary` stays clean. Preflight for a future date: gates are relative to `asOfDate` (line combos per scheduled team, derived rows within 7 days, goalie priors rows for that date's games — `update-goalie-projections-v2?limit=7` covers 7 days ahead); any failure is non-blocking now. Regression added.
- Fix 4: NST reads run two strengths at a time (`NST_STRENGTH_READ_CONCURRENCY`): 6 statements in flight per player, 24 at player concurrency 4 (was 15/60). Regression counts in-flight NST queries.
- Suites: 35 files, 898/898; eslint 0 errors; tsc under lock: see report.

## Next
- Chef re-review; release needs TJ's authorization (deployed code loops again tomorrow 10:05Z until then); proposal steps 2–3 (service_role timeout, ANALYZE) pending TJ; migration recording the index drop still owed.

## Insights
- Rolling writer stops *claiming* at budget; in-flight players (concurrency 4, full career reads × 5 strengths) finish after.
- Freshness 422 check runs after all work in rolling route; pipeline passes explicit dates so blockers are never tolerated.
