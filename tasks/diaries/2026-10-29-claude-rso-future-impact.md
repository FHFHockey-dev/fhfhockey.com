# 2026-10-29 Claude: RSO VORP S2 later-impact (ΔF) engine

- **Scope:** S2 of `VORP/ASSESSMENT.md` under `S3-SCENARIO-CONTRACT.md` v1 (sha256 ca0ab382…): pure offline ΔF engine, one narrow scenario hook in `planning.ts`, tests, isolation harness, receipt. Lease `RSO-S2-FUTURE`. No commit (orchestrator commits).
- **Where:** `octoberBranch` at `081fcb849` (S1). Files: `web/lib/rosterScheduleOptimizer/futureImpact.ts`(+test), `planning.ts`, `planning.test.ts`, `tasks/artifacts/rso-wave2-2026-10-25/VORP/S2/`.
- **Baselines checked at start:** planning.ts 3eae2c8a…, planning.test.ts 3b0dbc56…, contract ca0ab382…; futureImpact files absent.

## Decisions
- Hook = module-scoped `scenarioUse` flag in `planning.ts`, set only by `evaluateScenarioPlan` in try/finally. With it unset, `forecastAllows` is unchanged except that rows carrying `scenarioUse` are refused. With it set, only marked rows are allowed, and `prepareEvaluation` skips the native contribution resolver (contract: never route scenario rows to native serving).
- Boundary rosters reuse `buildTimeline(...).at(far future)`, so step legality is the planner's own.
- F has no opponent, so category lineups are schedule-capacity chosen; carried as the assumption label `category_lineup_schedule_capacity`.

## State
- 17:2xZ: engine + hook + 50 tests passed under v1; harness 0/436 mismatches on and off vs 081fcb849, and the negative control vs 5453d2eca mismatches as expected; RSO suites 46 files / 1,135 tests passed; tsc exit 0; eslint clean.
- 17:3xZ: found the contract revised to **v2** mid-run (sha 2f31491a…, not by this lane). v2 rejects the `finished_at` witness. Adapted: `observed_capture` receipts (identity + checksum + bindings, completion ≤ D), all reason codes kept, one-receipt coherence, §2.6 claims, `version: "v2"`. 64 tests pass; eslint clean. Final suite, harness and tsc rerun in the background.
- 17:4xZ: the orchestrator reported tsc TS2345 at futureImpact.ts:156/319 (`"ok"` passed to `weakerState`). Fixed with no casts: generic `weakerState`, a `weakerTiming` helper, and the unreachable no-row/ok path → `unknown` `selection_invariant_breach`. Locked tsc after the fix: only `lib/player-cards/currentNhl.test.ts(94,53)` TS2775 (another lane, pre-existing). 64 tests pass; harness 0/0 on 1/74/238/123; eslint clean.
- Done: `VORP/S2/RECEIPT.md` complete with results and sha256s. Not committed (the orchestrator commits). Keep this diary until the orchestrator records the commit.

## Gotchas
- `prepareEvaluation` calls `resolvePlanningContributions(consumer "rso")`, which rejects raw rows lacking FORGE issued context; scenario rows must bypass it.
- `GameForecast.conditioning` is typed `"unconditional"` only; scenario conditional rows need a widened in-memory type.
- The harness `fix()` must read before `open(p,'w')` (the S1 gotcha); otherwise vitest reports "No test suite found".
- A future-dated plan step must be `conditional: true`, or `buildTimeline` rejects it.
- Skipped players also show the evaluator's `missing_component` codes; v2 §5 says keep them all.
