# P07 R2 + task10 independent integration review

**Hold complete combined scoring acceptance for one reproduced P2 defect.** The authority/refresh integration and the other tested numerical contracts pass. The prior narrow P07 R2 acceptance remains valid. There is no demonstrated data exposure or permission bypass in this packet.

Independent result: **91 passed, 2 failed assertions, 93 distinct executed cases** across three bounded runs. The two failures are one classification defect. No application source was edited or service called.

## P2 — Goalie-only weights incorrectly make complete skater points unavailable

**Impact:** a manager using a league with a nonzero `LOSSES_GOALIE` or `GAMES_STARTED` points weight can see “—” for a skater whose applicable scoring inputs are complete. The failure occurs when that goalie stat has no finite value in the forecast population. It suppresses valid points and the display tier; it does not fabricate points or expose private data.

**Reproduction on the real mounted RSO UI/hook/adapter:** one current approved bridge skater game has `GOALS=1`, `ASSISTS=2`; scoring weights are `{GOALS:3, ASSISTS:2, LOSSES_GOALIE:-2}`. Expected skater FP is 7.0 because goalie losses do not apply to skaters. The cell renders `Expected fantasy points: unavailable` and an em dash. Replacing the third weight with `GAMES_STARTED:-2` reproduces the same failure. Identical controls using each of `WINS_GOALIE`, `GOALS_AGAINST_GOALIE`, `SHOTS_AGAINST_GOALIE`, `SAVES_GOALIE`, and `SHUTOUTS_GOALIE` pass.

**Exact evidence, pinned bytes:**

- `web/lib/rosterScheduleOptimizer/planning.ts:85` — `GOALIE_STATS` omits both supported keys. Lines 95–97 treat an otherwise unobserved stat as applicable to both classes.
- `planning.ts:112` — new `gameForecastPoints` uses that classification; lines 114 and 119–121 retain the goalie-only weight and reject the absent skater value.
- `web/lib/integrations/yahoo/rosterPlanning.ts:26` and `:28` list these as goalie point columns; line 29 classifies them as goalie-only. This is repository-established semantics, not an invented expectation.
- `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx:842` calls the helper on the admitted current view and selected forecasts, so the defect reaches the actual UI.
- `p07Task10Independent.test.tsx:131`, `cross-class.log`: 7 executed cross-class cases, **5 pass / 2 fail**. The 36 earlier cases are skipped only by this run's explicit name filter; all 36 passed in the initial run. No failed assertion was disabled or exempted.
- Planner SHA-256: `09918cdb16f2eeee00554448b953c16f773b2e3f42455e213dac7e4f38ec5474`.

**Attribution:** the incomplete classification table and fallback are already present in commit `84cb1229cd1c1cdd037c43e660d2a181304ada51` and in the pinned R2 planner. Task10 adds the display helper and wires it to this existing classification. This is an inherited classification gap exposed by the new strict display path; do not attribute the entire defect to task10 or infer authorship from a model name.

**Surgical fix scope:** align the planner's known goalie-only keys with the existing supported scoring contract, minimally covering these two proven omissions, in `planning.ts`. Add the cross-class regressions to the helper and/or mounted-points tests. Preserve the current fail-closed behavior for genuinely missing applicable inputs and unknown keys. Do not revert to summing known subtotals or default missing values to zero. Because the classification is shared, include focused planner regression verification and re-pin the combined candidate after the assigned owner repairs it.

**Acceptance gates:** both failing skater controls return 7.0; missing `LOSSES_GOALIE`/`GAMES_STARTED` remains unavailable for a goalie; observed zero remains zero; the other five cross-class controls, partial-head tests, permission denial and refresh/serialization checks continue passing. Confidence: **high**, demonstrated through the actual caller. Release implication: hold the combined all-scoring display claim pending this narrow repair; do not reopen the accepted P07 clock/authority correction solely because of this issue.

## Fixed review boundary

- Checkout: `octoberBranch`, baseline/observed HEAD `84cb1229cd1c1cdd037c43e660d2a181304ada51`. HEAD alone is not the reviewed snapshot.
- Verified **3,375** R2 fixed-source hashes, then overlaid the nine task10 `after/` files after checking their candidate hashes. The resulting **3,379-file** fixed snapshot and **39 combined candidate pins** are recorded in `FIXED-SNAPSHOT.json` and `START-HASHES.json`.
- Of the original 32 R2 pins, 30 remain identical, including all eight R2 delta files. The two explicitly overlaid task10 files are `planning.ts` and `RosterScheduleOptimizer.tsx`.
- `END-HASHES.json` confirms all 39 tested pins unchanged and matching canonical at the recorded end boundary; all 3,378 other fixed files match too. The only intentional fixed-file difference in scratch is its private Vitest cache path.
- Scratch location is in `SCRATCH-PATH.txt`. Existing dependencies were symlinked; no environment files or credentials were read. Reviewer-only fixtures and configuration are separate from application source.

## What passed

1. **Actual mounted UI, 36 new initial cases:** each of the 17 supported skater and seven goalie point keys is withheld when missing from an applicable weighted total; complete observed zeros remain zero; all supplied keys and negative weights contribute; known conditional means are not divided again at start probability 0, null or 0.5; incomplete conditional totals remain unavailable independently of complete expected totals.
2. **Actual displayed-value invalidation:** offline transition immediately removes previously visible goalie values. Returning online with a rejected read, exact replay, revoked bridge allowlist or expired source leaves both expected/if-starts values unavailable. One fresh data read is shared by numeric consumers.
3. **Task10's 34 focused cases rerun:** 19 scorer, three renderer, six grid and six mounted RSO tests. Expected FP determines tiers; conditional FP is separate; observed past-day actual zero is preserved; unreviewed native values are denied.
4. **Combined R2 guards:** six original independent boundary cases, three correlation cases, unchanged C08, and four hook generation/expiry cases pass on the overlaid planner/UI snapshot.
5. **Two additional serialization/contribution tests:** JSON/packed output remains usable as display readback but cannot authorize a restored planning execution when the current read is suspended. A single denied weighted contribution with finite retained means withholds both totals; a per-appearance component cannot be relabeled as a per-start total.

Source inspection confirms `RosterScheduleOptimizer.tsx:607` obtains the current generation's execution, line 610 falls back to capacity-only data, and lines 842–847 derive values only from the admitted display snapshot and selected forecast inputs. `ForecastPoints.tsx` renders finite zero and negative numbers, labels the two goalie views separately, and never divides by probability. No native review was added.

## Other receipts and limits

- The newer R2 `heavy-verification/RECEIPT.md` reports application-scoped TypeScript and eight-file ESLint passed with empty diagnostic logs and all 3,375 pins unchanged. Both empty logs were inspected; receipt SHA-256 is `9ef03483ec2026b6fcbdd3e7e538290e544b612c5765a535b5b32f70fa8032ff`. This supersedes the earlier R2 pending status. These are owner checks, not independently rerun here.
- Task10 reports 243 tests, scoped lint with six existing RSO warnings, and full-tree TypeScript with only the two ablation-script errors at lines 115/136. This review did not rerun those broad checks or change the external worker's script. Full-tree typing remains separate from combined application qualification.
- **Blocked action:** one sandbox Chromium launch for offline static-grid inspection, targeting the installed headless shell, failed at `bootstrap_check_in ... MachPortRendezvousServer` with permission denied (1100). No page/context opened. The process exited with SIGTRAP and temporary cleanup completed. Status: **blocked/denied by the local runtime, no uncertain outcome**. No retry, escalation or sandbox workaround was attempted. See `BROWSER.json` and `browser.log`.
- Owner 700/1100 px static actual-grid screenshots are existing evidence only. This review establishes mounted jsdom behavior, not an independent real-browser layout or full application/worker E2E pass.
- Historical predictive qualification, exact native target approvals, full FHFH tree integration, hosted behavior and release authorization remain outside this review. No heavy-check lock was acquired/removed, and no full suite, build, migration, production request, commit or deployment ran.

This review is complete. The highest-value next action is the small classification repair with the two retained failing tests, followed by fixed-snapshot re-verification. The broader authority and numerical safeguards tested here should be preserved.
