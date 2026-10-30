> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# Diary: isolate-per-game-failure (local_7becd39f-0ce0-47b0-b291-dd19d670e460)
Session title: "Isolate per-game failures in ingest-projection-inputs". 187 messages, 21 turns, one task. Status when read: idle, last turn done.

## 1. Scope
- Task: make `web/pages/api/v1/db/ingest-projection-inputs.ts` isolate per-game failures instead of stopping the whole run at the first bad game. TJ owns the file; starting the session was his OK to edit it.
- Why: after R3/R4 on 2026-10-19 the projection-input re-ingest was blocked. NHL's shiftcharts feed returns total=0 for games 2026020006 to 2026020053 (earlier snapshots exist, e.g. 743 rows for 0006 from 10-01), and game 2026020057 fails `precheck_shifts` with a clock/duration mismatch. Each stopped the run, blocking every later game, and the whole downstream chain (derived tables, `run-projection-v2`).
- Started by Chef (local_4317ea20). Related to finding A-01. Optional item 3 (reuse a stored shift snapshot when NHL's feed is empty) was NOT built.

## 2. Where
- Branch octoberBranch. Files: `web/pages/api/v1/db/ingest-projection-inputs.ts`, `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts`; note `tasks/artifacts/ingest-game-isolation-2026-10-19/README.md`.

## 3. State
- Done; RELEASED in R5 (bb21d5942, 2026-10-19 18:16Z). The route file equals origin/master (b630e0767).
- Behaviour: only errors thrown while validating the NHL shift data are isolated (empty feed "No NHL shift rows returned", clock/duration mismatch, other shift-data checks). Fetch, DB read/write, verification, normalization and cursor errors still stop the run. The stored shift-totals DB read was moved after the check so a DB failure is not mistaken for a bad game.
- Response: each skipped game is in `errors` with `gameId`, `date`, `stage`, `message`, `isolated:true`; counted in `skipped` and new `skipReasons.sourceDataRejected`. `success` stays `false`; `nextGameId` does not stop at the skipped game; `lastCompletedGameId` is not set for it.
- Explicit runs (date range, `maxGames`, resume, chunk, `force`): bad games are always skipped. Scheduled cursor: a game is skipped only once its date is at least 2 UTC days old (yesterday's feed may simply be unpublished); then the cursor moves past it and the slate finishes `complete`. The scheduled path still fails closed on a Gamecenter 404.
- No retry table: nothing existing fits (the pipeline state table has one row per slate and a single `last_error`; finishing a slate `failed` with the cursor past the bad game would starve newer slates). To retry a game, run an explicit date range.
- Checks reported: `ingest-projection-inputs.test.ts` + `run-rolling-forge-pipeline.test.ts` 48 passed (5 new tests; one old test now expects `nextGameId:102` and `isolated:true`); ESLint clean on both files; tsc not run (no shared types changed). Chef re-ran the ingest test: 33/33.
- Production-chain evidence (Chef's register, localhost runs on R4+local code): ingest call 6 retry 200, 35 processed, 15 isolated (14 empty feeds in 0040-0053, 1 clock mismatch); call 7 200, 44 processed, 3 isolated; the 10-05 to 10-18 window completed. Four games without inputs (0057, 0094, 0101, 0123) were then skipped by the derived build as `projection_inputs_unavailable` (TJ-approved edit to `build-projection-derived-v2.ts`, also in R5).

## 4. Next
- None stated.

## 5. Blocked / needs TJ
- Decision it raised: any run with a skipped game returns `success:false`, so the rolling-forge pipeline stops later stages for that run. The session kept this so missing inputs stay visible. TJ/Chef must decide whether to run the later stages by hand on such days. Whether production's cron chain handled this on 10-20 is unverified.

## 6. Insights
- The session predicted the `run-projection-v2` input-ingest gate would stay FAIL while an isolated game lacks inputs. In Chef's 10-19 localhost run all preflight gates passed even with those 4 games lacking inputs; why is unexplained (unverified).
- NHL changed shift data after capture (fingerprint drift), and `update-shift-charts` re-fetches live NHL shifts; this is why the shift-charts side needed its own isolation (see diagnose-shift-charts-ro).
- Explicit date-range runs do not touch the scheduled cursor, so repair runs are safe to re-issue.
