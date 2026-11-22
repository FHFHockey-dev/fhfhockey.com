# Off-day downstream proof: RC 096b78b62 (slate 2026-11-21, source 2026-11-20)

Prepared 2026-11-21, 17:40–17:56Z; revised 18:06Z after Chef ticket 2. By a Claude side session for Chef. Read-only throughout. There were no production writes, deploys, route invocations or NST calls. All code was run from `git archive` exports of `096b78b62` and `f47905d28` in the session scratchpad.

## Bottom line

1. **The fix is enough for the off-day itself.** None of the stages after NST behaves differently because 2026-11-20 had zero games. WGO, contextual builders and rolling take proven zero-input success paths. Ingest succeeded in production today on exactly this zero-game backlog.
2. **Stage 7 (`projection_derived_build`) passes now. This corrects v2 of this report (18:00Z), which predicted it would fail.**
   - The 10:25Z failure was real: 207 `success:false` on game 2026020357's manifest.
   - But that same call built the other 10 games of 11-19. The derived queue only takes a date that has a game whose relationship is current and whose derived build isn't (`lib/projections/derived/projectionDerivedQueue.ts:78-86`).
   - 0357's relationship is `pending`, so 0357 never qualifies. Running the real queue selector on all 409 production rows read at 18:01Z gives `[]`.
   - With an empty queue, the no-query call builds nothing and returns 200 `success:true` (`build-projection-derived-v2.ts:342-377`).
   - A deferred date is not stored anywhere. It only appears in that one response.
   - See "Chef ticket 2" below for Nov 22 and the 0357 repair.
3. **`projection_execution` is unproven.** It sits behind stage 7. It also failed with attempts exhausted on 11-17, 11-18 and 11-19 (`invalid_row`). The fix, `64bfd0e69`, is in the RC, and its trigger has no matching rows in production. However, the stage has not run on a full slate since the fix.
4. **Recovery blocker: deploying the RC alone will not recover 11-21.** `daily_incremental:2026-11-21 / upstream_skater_sources` is `failed`, `stage_failed:attempt-2`. A scheduled RC run stops with `attempts_exhausted` without calling NST (test B). There is no request parameter that overrides this: the attempt check runs before the lease, and nothing in the handler or `rollingForgePipelineRunState.ts` resets it.
5. **Control: pass.** On a stored nonempty slate, the NST request plan is identical on `f47905d28` and `096b78b62`, with zero schedule-fallback calls.

## Stage verdicts (in pipeline order, after NST)

| Stage | Verdict | Evidence |
|---|---|---|
| upstream_skater_sources: WGO part | **pass** | Production: `update-all-wgo-skaters` at 2026-11-21 07:30:06Z (`/api/v1/db/update-wgo-skaters?action=all`) returned `success:true`, "Processed 0 distinct dates with 0 total updates", and skipped 2026-11-20 and 2026-11-21 as `expected_no_game`. The pipeline's `action=all&startDate=2026-11-20` covers the same two dates. The route is unchanged from `f47905d28` to the RC; it last changed in `cf0cb680e`, an ancestor. Code: `lib/cron/wgoDateOutcome.ts:38-45`, `update-wgo-skaters.ts:1420-1429` and `:2121-2127` (200). After the NST skip, WGO runs (`run-rolling-forge-pipeline.ts:891-897`; existing test `run-rolling-forge-pipeline.test.ts:958`). `update-wgo-totals` (`season=current`) is date-independent. Residual risk, unrelated to the off-day: an NHL Stats paging `source_failure`, as on 11-20 ("100/432 rows"). |
| contextual_builders | **pass** | With zero source games, `run-rolling-forge-pipeline.ts:934-1033` calls line combinations with `{count:"10"}` (recent-gap mode, which ignores the source date). It synthesizes the power-play step as `skipped` and skips both verify reads. The route's nothing-to-repair branch (`update-line-combinations/index.ts:297-309`) returns 200 `success:true`. Production: the same `count=10` call succeeded at every 25-minute run on 11-20 (10:00Z through 19:25Z) and at 11-21 17:25Z. Residual risk, unrelated to the off-day: repairing an older game can return 500 (`index.ts:364-386`). |
| rolling_player_recompute | **pass** (code plus a real-library test; no current-code production precedent) | Real `fetchRollingPlayerAverages.main` against a stub DB with no 11-20 WGO rows made 3 reads and returned `processedPlayers 0, rowsUpserted 0, stoppedReason "complete", nextResumeFrom null` (`fetchRollingPlayerAverages.ts:3110-3113`, `:4544-4562`; `rolling/rolling-zero-rc.json`). The route wrapper (`update-rolling-player-averages.ts:940-1070`) then returns 200 `success:true`, and the orchestrator chunk loop ends because `stoppedReason !== "max_players"`. Old-code precedent: on 2026-09-28 at 10:07Z, rolling for the zero-game date 09-28 returned success with 0 rows. |
| projection_input_ingest | **pass** | Production, same call: the standalone `ingest-projection-inputs` at 2026-11-21 09:45Z (POST, no query, durable backlog) returned `success:true`, `startDate/endDate 2026-11-20`, `gamesTotal 0`, `rowsUpserted 0`. The scheduled pipeline also uses the durable backlog (`run-rolling-forge-pipeline.ts:1832-1835`, `:1146`), adding only `maxDurationMs`. |
| projection_relationship_build | **pass** (the stage completes; see stage 7) | `{gameId:"all"}` (`:1178-1188`). The same handler (`shift-charts.ts`, also served by `/update-shifts?action=all` under job name `update-shift-charts`) ran at 2026-11-21 09:55Z and returned `success:true`: "Processed 10 shift-chart games; skipped 1", with `skippedGames [{2026020357, projection_raw_snapshot_stale}]` (`shift-charts.ts:1219-1221`). The queue comes from pending relationship rows (`:570-590`, `:1140`), not from the source date. |
| projection_derived_build | **pass (revised 18:05Z; empty queue)**. The text below is the earlier failure evidence, which the queue proof in "Chef ticket 2" supersedes. | The scheduled stage calls `build-projection-derived-v2` with no query (`:1195`), the same call the standalone cron made at 2026-11-21 10:25Z. That call returned 207 `success:false`, `processedDates []`, `deferredDates ["2026-11-19"]`, error `input_manifest: Projection input and relationship manifest is not complete for game 2026020357`. The response has no `operationStatus` or `resume`, so `classifyStepStatus` marks it `failed`: retried once, then `attempts_exhausted`. Manifest rule: `lib/projections/derived/projectionDerivedPersistence.ts:185-201`. Production row for 2026020357: `input_status complete`, `relationship_status pending`, updated 11-20 20:51Z. The other 11 games of 11-19 are complete. |
| projection_execution | **unproven** | *Off-day effect: none found.* Preflight windows are 7, 14 and 21 days (`run-projection-v2.ts:590-760`). For the 11-21 slate, 28 of 28 teams have derived rows in [11-14, 11-21) and line combinations within 21 days, and the 11-17, 11-18 and 11-19 games all have shift rows. The goalie step is `limit 7, endDate 2026-11-22`, and projection dates are 11-21 and 11-22. *Why it is unproven:* it runs only after stage 7. It failed with attempts exhausted on 11-17, 11-18 and 11-19 (`forge_runs`: `Rolling skater history read incomplete: invalid_row`, shas 69317010, 83750b4a, 80af7e76). Fix `64bfd0e69` is an ancestor of `f47905d28`. The trigger that fix leaves in place (an in-scope row without a game_id or season) has **no matching rows across the whole 1,095-day long-absence lookback** (`FORGE_LONG_ABSENCE_LOOKBACK_DAYS`): 0 rows in (2025-11-21, 2026-11-21) and 0 rows in (2023-11-22, 2025-11-21]. Not excluded: the other `invalid_row` branches (`skater-queries.ts:318`, `:331`, `:336`, `:405`), which cover player, strength and date scope mismatches and support-row shape. The only post-fix production run is the one-game `forge_runs f55203dc` (as_of 2026-11-21, 17:25Z, `f47905d28`, 36 players, succeeded). |

Stages 9 (accuracy) and 10 (monitoring) are non-blocking and are synthesized as `skipped` by the scheduled query.

## Chef ticket 2 (18:00Z): the stage-7 derived backlog and game 2026020357

### Q1. Does stage 7 fail or block on Nov 22 (scope `daily_incremental:2026-11-22`, source Nov 21, 14 games)?

**No, not because of 2026020357. A deferred date is not a stored blocker.**

**How the queue works.**
- With no query, the derived route takes its dates from `listPendingProjectionDerivedDates` (`build-projection-derived-v2.ts:207-220`, `:336-344`).
- That list includes a game only when its relationship is current (complete, with `relationship_input_fingerprint = input_fingerprint` and the current algorithm version) and its derived build is not (`projectionDerivedQueue.ts:78-86`).
- It then processes **every** game on each queued date (`:418-497`). A failing game ends that date with 207 `success:false`. The coordinator treats that as `failed`: there is no `operationStatus` or `resume`, so it is not partial (`run-rolling-forge-pipeline.ts:559-569`).
- `deferredDates` and `nextStartDate` are response fields only. No row stores them. The next call recomputes the queue.

**Proof: the real `selectPendingProjectionDerivedDates` on production rows** (`derived/`).
- I read all 409 `projection_game_materialization_status` rows with `input_status='complete'` at 18:01Z.
- The result is `[]`. Since 10:25Z, 11-19 has had no game that qualifies: the 10 others were built then, 0358 was built on 11-20, and 0357's relationship is `pending`, so 0357 itself never qualifies.
- With the queue empty, the route returns 200 `success:true` and processes nothing: `fullRangeDates = scheduledDates ?? …` stays `[]`, `:377`.
- Counter-check: with 0357's relationship set to current, the same function returns `["2026-11-19"]` (`derived/queue-out-if-0357-fixed.json`).

**Expected on Nov 22.**
- At 09:45Z, the durable ingest takes the 14 games of 11-21.
- At 09:55Z, and again in stage 6, the relationship build takes every pending relationship, including 0357. It skips 0357 as `projection_raw_snapshot_stale` and still returns `success:true`, as it did at 09:55Z today.
- Stage 7's queue is then `["2026-11-21"]`. Every game on that date has a complete manifest, so the build succeeds.
- 0357 is never selected.
- **Residual risk:** if any 11-21 game ends up with its relationship pending while the others on that date are queued (the way 0357 did), that whole date fails. You can't predict that in advance.

**What 0357 costs.** SEA/VAN derived strength is missing for 11-19, a known degradation. The projection preflight gates should still pass:
- The 7-day derived window holds.
- 0357's stored `shift_charts` has 38 of 38 raw manifest players, with no null strength columns. So the 14-day `projection_input_ingest` shift gate should classify it complete. That is inferred from row checks; the classifier itself was not run.

### Q2. The narrowest fix for 0357's manifest (report only; not run)

**Cause, from production rows.**
- 0357's input manifest pins `shift_raw_snapshot_version 1` (raw 151701, hash `3f03404853f5…`).
- The `shiftcharts` snapshot head moved to version 2 (raw 153769, hash `a348fb80a224…`) at 2026-11-21 00:25Z; PBP is unchanged (v2, 153758).
- The relationship RPC refuses with `SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE` whenever the pinned head is not current (`supabase/migrations/20260720105524_add_projection_materialization_transactions.sql`, around line 2317). The handler turns that into a skip (`shift-charts.ts:1219-1221`).
- So relationship stays pending until the inputs are re-pinned. No relationship rerun alone can fix it.

**Steps, each a production write needing approval:**
1. **Re-ingest only 0357:** `POST /api/v1/db/ingest-projection-inputs?startDate=2026-11-19&endDate=2026-11-19&resumeFromGameId=2026020357&maxGames=1`.
   - Explicit dates make this the non-durable path: no pipeline lease and no parked-game retries (`ingest-projection-inputs.ts:475-482`, `:664-670`).
   - `resumeFromGameId` together with `maxGames=1` selects exactly that game (`:532-536`, `:602-605`).
   - It fetches 0357's PBP and shift chart from the NHL API (no NST) and captures the raw snapshots, which re-pins the current heads (`:725-790`).
   - It rewrites 0357's pbp/shift input rows and its materialization row. The input fingerprint should change, and relationship and derived then become pending for the new fingerprint.
2. **Build the relationship for 0357:** `POST /api/v1/db/shift-charts?gameId=2026020357`. The route needs POST (`shift-charts.ts:1300-1316`) and a final, complete PBP.
3. **Build the derived rows:**
   - Either let the next no-query derived call pick it up (the queue becomes `["2026-11-19"]`; all 12 games are reprocessed and the 11 current ones replay idempotently),
   - or target it: `POST /api/v1/db/build-projection-derived-v2?startDate=2026-11-19&gameId=2026020357` (`onlyGameId` filter, `:334`, `:425-433`).

**Stop conditions.**
- If step 1 answers with an `errors[]` entry for 0357 (source rejection or verification failure), stop.
- If step 2 still returns `skippedGames` with `projection_raw_snapshot_stale`, the NHL payload moved again during the window. Stop and report; do not loop.

**Not verified:** that step 1 changes the fingerprint and re-pins to head v2. I inferred it from the ingest code path and did not run it.

## Proof A: orchestrator routing, zero-game source (scratch test)

The test file is the RC's own `run-rolling-forge-pipeline.test.ts` harness (lines 1-268, identical on both trees) plus `orchestrator/orchestrator-block.ts`. It uses the real `runResumablePipeline` and `runStage` with an in-memory `projection_pipeline_state`. The `games` read for 11-20 returns `[]`.
- **Stub bodies.** NST returns the RC's own off-day answer. WGO, line combinations and rolling return the bodies in `orchestrator/route-bodies.json`, taken from the code paths and production audits above.
- **Stages 5–8 are default `{success:true}` stubs.** This proof therefore covers **coordinator routing only** for those stages. It does not cover their real answers; those are in the table, and stage 7's real answer today was a failure.

Result (`orchestrator/orch-rc.json`): one invocation at 2026-11-21T10:05:31Z returns 200 with termination `completed`, and every blocking state row is `complete`.
- Child queries: NST `2026-11-20`, WGO `startDate 2026-11-20`, line combinations `{count:"10"}`, power play not called, rolling `2026-11-20..2026-11-20`, projection dates `2026-11-21` and `2026-11-22`.
- Mutant check: with rolling returning 500 `success:false` (`route-bodies-mutant.json`), the test fails, as intended.

## Proof B: recovery check (same harness)

Production state was seeded (`core_entity_freshness complete rev 2`, `upstream_skater_sources failed rev 4 stage_failed:attempt-2`). A scheduled RC invocation then returns 207 with `stopped_on_blocking_failure / attempts_exhausted / nextStageId upstream_skater_sources`, `stagesRun 0`, and NST is never called (`orchestrator/orch-recovery-rc.json`). Code: the attempts check in `runResumablePipeline` (`failedAttempts >= MAX_BLOCKING_STAGE_ATTEMPTS = 2`, before the lease is acquired) and `lib/rollingForgePipelineRunState.ts:96-103`.

The options belong to Chef and TJ; this lane makes no recommendation.
- (i) An approved state change on that scope. Stage 7 would be a no-op success; see "Chef ticket 2".
- (ii) An explicit-window run. With `date=2026-11-21`, the source aperture becomes 11-21 itself, not 11-20, and the run is one-shot and non-resumable, with explicit ingest and derived ranges (`parseDateWindow` `:225-243`). That shape is not proven here.
- (iii) Let 11-22 run normally. Its stage 7 does not meet 2026020357 while that game stays pending; see "Chef ticket 2".

## Proof C: control (nonempty date, real `update-nst-gamelog` handler on both trees)

The harness head (`update-nst-gamelog.test.ts` lines 1-408) is identical on both trees, plus `control/control-block.ts`. Inputs are the stored `games` rows for 2026-11-19 (12 games) and 2026-11-21 (14), saved in `control/games-2026-11-19-and-21.json`. NST is mocked, and global `fetch` is stubbed to record calls and reject.

| Case | f47905d28 | 096b78b62 |
|---|---|---|
| 11-19, pipeline query with `deadlineAt` | plan 20 URLs; 0 schedule calls | plan 20 URLs (**identical list**); 0 schedule calls |
| 11-19, full plan (no deadline) | 20 URLs; 0 | 20 URLs (**identical**); 0 |
| 11-21 stored, games not started | `skipped_no_completed_games`, 0 URLs; 0 | same; 0 |

Status, success, state, `plannedRequestCount`, `missingScheduleDates []` and the continuation shape all match. The only difference is that the RC adds `verifiedOffDates: []`. Code reason: the new block runs only when `missingScheduleDates[0]` exists, which means the stored schedule lacks the date. The `skippedNoCompletedGames` expression adds `verifiedOffDates.length`, which is 0 here, so it is unchanged.

## History (a)

- The only earlier zero-game dates in the 2026-27 `games` table are preseason (09-15 to 09-18, 09-27, 09-28). `projection_pipeline_state` for this pipeline starts on 2026-10-20, so 11-20 is the first zero-game source date in the resumable era.
- On 09-28 (old non-resumable code, source = run date = a zero-game date), WGO succeeded with 0 rows, line combinations (`count=10`) succeeded, rolling succeeded with 0 rows, and power play was absent. The run stopped at ingest on preseason game 2026010056 (`INVALID_PROJECTION_RAW_SHIFT_ROWS`), which is unrelated. Its pipeline audit response is truncated at 4000 characters.
- The 11-19 inputs are present: `wgo_skater_stats` 432 rows, `rolling_player_game_metrics` 2160, `forge_player_game_strength` 419, line combinations 12 of 12 games, `pbp_games` 12 of 12. The exception is the relationship manifest for 2026020357 (above).
- 11-20's scope also stopped at stage 2: NST reported "explicit progress read is unconfirmed", then WGO 11-19 hit a `source_failure` at 100/432 rows. These were fixed or repaired later and are not off-day issues.

## Unrelated observation (not a verdict)

`update-rolling-player-averages` answers 207 `success:false, operationStatus "partial"` with no `resume` when it refuses players for an unknown game id (`:970-972`, from `7a13f65c0`). The coordinator classifies that as **failed**, not partial. It cannot occur on a zero-player day.

## Commands and queries

DB access was read-only via `tasks/artifacts/forge-pregame-capture-2026-11-14/operator/pgpool.sh -At -c "set default_transaction_read_only=on; …"`. The verbatim SQL for every invocation is in `receipt.json` under `queries`: 40 invocations in all, which is over the ~15 guideline. All were small SELECTs. One errored on truncated JSON, one hit the 60 s statement timeout and was re-run on a narrower window, and one hit an operator-type error and was re-run.

Tests were run from the scratchpad exports with `web/node_modules` symlinked, without `GIT_DIR`:
- `npx vitest run __tests__/pages/api/v1/db/nst-control.scratch.test.ts` in each tree: 20 of 20 passed, exit 0 on both.
- `npx vitest run __tests__/pages/api/v1/db/zero-game-orchestrator.scratch.test.ts` in the RC: 2 of 2 passed. The mutant run failed, as intended.
- `npx vitest run lib/supabase/Upserts/rolling-zero.scratch.test.ts` in the RC: 1 of 1 passed.

Not run: typecheck, lint and the full suites. No repository code changed.
