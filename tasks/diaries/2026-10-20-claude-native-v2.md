# Diary — native v2 replay harness + serving decisions (claude, 2026-10-20)

## Scope
Chef ticket: (1) update the v2 offline publish-dry replay for 06 gates + 07 split (two requests/proofs), runnable by TJ; runbook REPLAY-RUNBOOK-2026-10-20.md; optional local read-only dry run (no network). (2) Serving decisions memo tasks/artifacts/native-serving-2026-10-20/DECISIONS.md (D-3..D-7 questions + S-1 release plan under G1).
Owned: web/scripts/forge-daily*.ts, replay scripts, lib/player-forecasts/** (only if needed), the two artifacts. No commit; no GIT_DIR; no network.

## Log
- start.
- Harness: new tasks/artifacts/forge-v2-prerollout-gates-2026-10-19/v2-replay-20261021-split.ts (old publishdry script left unchanged beside its receipts). Phase A true plan -> means_plan_incomplete; phase B stand-in complete plan -> full split pipeline. Receipt is counts-only.
- Ran locally offline (23 s, 0 network, 0 DB), output in scratchpad then deleted: A stopped means_plan_incomplete; B inputs_bound 1060+200, proofs 1113+211=1324 items, shared scope, outputs 84 rows/505 sources/100 nulls, reviewed 84, cadence 84, publish dry_run, 0 unbound; gate checks all stop.
- Next: runbook, then DECISIONS.md.
- Runbook written: tasks/artifacts/forge-v2-prerollout-gates-2026-10-19/REPLAY-RUNBOOK-2026-10-20.md. Memo written: tasks/artifacts/native-serving-2026-10-20/DECISIONS.md (D-3..D-7 + S-1 waves; master-safe wave 1 vs G1 wave 2; C-5 stale because the R6c bridge now serves RSO and is hidden under `empty`).
- No web/ code changed (the harness needed no new exports). No commit. DONE; report to Chef. Keep this diary until the Chef records the outcome.

## Task 3: S-1 wave 1 dark master patch (Chef, after 4ac609a15)
- Finding: the native readers (nativeContributionAdmission + participation stores) pull ~2,200 branch-only model lines and non-additive hunks in 9 shared master files (contributions, goalieBaselineRates, baselineRates, baselineGeneration, planningContributions, resolvedPlanningForecast, contributionStore, goalieBaselineInputCapture, sourceSnapshot). DECISIONS.md under-scoped wave 1. Building wave 1a (serving source + catalog head + sourceSnapshot hunks + planning/data wiring, native kind served as empty until 1b) and inventorying 1b.
- Scratch: scratchpad/s1w1 = git archive origin/master c2ed28384 (local ref; no fetch).
- 22:58Z wave 1a done: tasks/artifacts/release-r10-2026-10-21/S1-WAVE1-master.patch sha 5db477e8…ed63 (+README with 1b inventory). Fresh apply on origin/master c2ed28384 PASS; vitest 28 files/934 pass; tsc 0 (after one test-type correction); G1 guard PASS (checks 1,2,4 in scratch; 3 manual vs octoberBranch blobs); eslint 0; differential master-vs-patched planning identical in 16 combos.
- Open for Chef: wave 1b (native readers + model closure) needs its own staffed slice; do not set the head env until 1b.

## Task 4: wave 1b (Chef, R9 live = b5e801d8f)
- Start: re-check 1a on b5e801d8f, then 1b (native readers + model closure + shared hunks), zero visible change with head unset; definition hashes byte-identical.
- 1a re-check on R9 b5e801d8f: git apply --check PASS (no regeneration needed).
- 1b STOPPED (Chef's stop rule): side-by-side of R9 vs octoberBranch client resolver (resolvePlanningContributions) on a pre-activation bridge snapshot: HEAD stamps powerPlayRole on every forecast (+~105 B/row, 2,281 -> 2,491 B on a 2-row fixture). Native RSO at activation needs those client files (catalogParticipation, applyModeledStartMetadata), so a faithful port changes client output before activation; also HEAD rejects raw detailed rows with non-unconditional conditioning and strips startParticipation. Reported options A' (port as-is after measuring save size vs 4 MB cap, TJ approves) / B (gated hybrid) / C (server-only, useless at activation). No 1b patch written. Scratch side-by-side removed.

## Task 5: A′ (TJ chose port as-is, measure first)
- Step 1 gate: worst-case RSO save (~7,200 bridge rows, non-ASCII, preservation) UTF-8 bytes R9 vs branch resolver; PASS iff A′ ≤ 3,196,800 B (80% of 3,996,000).
- Step 1 PASS: actual save body (packed raw snapshot; resolver not in save path) 1,818,213 B = 45.5% of 3,996,000 (gate 3,196,800); same under R9 and A′. Hypothetical resolved-rows save: R9 7,565,384 / A′ 8,371,304 (+805,920, powerPlayRole x7,200) — not the save path. Fixture: 1,800 players x 4 games, 32 teams, non-ASCII names, 17-player roster, 20 intent steps (scratch-only; fixture workspace not schema-exact).
- Step 2 built in scratch s1b (R9 + 1a + 1b): 17 closure files byte-identical from octoberBranch (6 replaced, 11 new) + native branch in planning.ts (native kind only) + HEAD tests for copied files (currentSeasonSogContribution.test.ts left out: needs gameExpectations). Master's own tests pass on ported code (682/683; the 1 was my 1a native expectation, updated). Def hashes: patched == HEAD == pins for 6 policies; legacy skater/goalie == R9. Side-by-side vs R9 (16 combos): server identical; client identical except powerPlayRole. Patch S1-WAVE1B-master.patch 4c2965ff…ca19 (29 files, +4803 −61). G1 guard PASS; fresh R9+1a+1b apply PASS. Next: focused vitest + tsc under lock (run-s1b.sh).
- 23:22Z 1b checks: vitest 48 files / 1,785 passed; tsc exit 0; README updated. DONE pending Chef review. Remaining serving slice: FORGE next-N (forge/forecasts + gameExpectations*). Diary kept until Chef records outcome.
