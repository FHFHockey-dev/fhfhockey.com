> Compiled 2026-10-20 from the session transcript by the orchestrator's helper; not written by the session itself.

# rso-decision-replay (session local_5a8e5e5b-69d7-47f2-8eb9-7071af6183e0)

Title: "RSO roster-decision replay checks". Idle after 49 turns.

## 1. Scope
- Task: an offline, deterministic replay test showing the roster schedule optimizer (RSO) makes correct whole-day roster decisions from fixed inputs. It is the "RSO real decisions" next action in `tasks/artifacts/sprint-audit-2026-10-19/CROSS-CHECK-AUDIT.md` and pickup step 3 of Codex's audit; it uses the S-12 lane notes in `tasks/sprint-2026-10-18/HANDOFF-2026-10-18.md`.
- Required assertions: zero / unknown / short-of-minimum goalie requirements stay distinct; a missing forecast stays unknown (null), never 0, like `modeledHeadTotals`; an expired forecast drops out; the matchup end date is exclusive; a hand-computed ranking is stable and explainable.
- Rule: if a real defect appears, write a failing test plus the smallest RSO fix; report anything larger.
- Started by local_08a0bf1c (RSO owner session). No task ID beyond the audit item.

## 2. Where
- New file: `web/lib/rosterScheduleOptimizer/dailyDecisionReplay.test.ts` (8 tests). No RSO source file was changed.
- Branch octoberBranch. Committed in `5ae65fc13` (10-19 14:18). Also on origin/master through R6c `707f60e83`; the master copy differs by one import (it lacks `FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT` in the goalie revision's `inputProvenance`, which octoberBranch's copy has). Who added that import on the branch is unverified.
- Hand-over note (outside the repo, not read by this helper): `rso-daily-decision-replay-2026-10-19.md` in the shared side-session notes folder of local_08a0bf1c.

## 3. State
- Done. Vitest 8/8 pass, ESLint clean on the file, full `tsc --noEmit` under the heavy lock exit 0.
- Fixture: one fixed matchup week (Yahoo week 2, Mon 10-05 to Sun 10-11), planned from 10-10 12:00Z; points-scoring league with C1, G1, BN1 slots; synthetic player IDs only. Goalie forecasts go through the real `publicPlanningForecasts` admission using a copy of the revision fixture from `rosterScheduleData/planning.test.ts`.
- Proven: goalie forecast admitted at 12:00Z, excluded as `stale_source` at game start and 36 h after publication, and the horizon becomes null (not old value, not 0); goalie minimums (zero, unknown, short, progress unknown, already met) stay distinct and only a short minimum reserves a candidate slot; exclusive period end (a 100-goal game on 10-12 is excluded); missing forecast stays null while an explicit 0 gives 0; hand-computed ranking (baseline 5.75 points; best net changes g2 +1, x +1, y +0.75, z unknown) is identical with inputs reversed.
- Not proven: `loadPlanningData` and the Yahoo loader's database/API reads (inputs built the way the loader builds them); only goalie forecasts pass the admission boundary (skater forecasts are hand-built to the same contract); no real captured league data; points scoring only, no category leagues.

## 4. Next
- None stated. The final report ends with two observations left for TJ.

## 5. Blocked / needs TJ
- Ranking-policy call 1: exact ties are broken alphabetically by step ID (`compareCandidatePlans` and the pruning in `candidatePlanMetrics.ts`). Example: for skater x it shows "drop a" and hides the equally good "drop b" (the benched, lower-value player); for y and g2 "drop goalie 7" beats "drop b" only because "7" sorts before "b". Stable but unexplained. Suggested fix: break ties by lowest baseline contribution before step ID. Whether this was later changed is unverified.
- Observation 2 (not fixed, errs safe): a scoring stat missing from a snapshot's realized-so-far totals turns a known 0 into unknown. Only matters for manual or partial snapshots, since Yahoo reports every scoring stat.

## 6. Insights
- Yahoo loader leaves acquisition timing "unknown", so no swap is generated until the manager confirms timing; the fixture sets same-day as that confirmation.
- Period ends use the same exclusive-end formulas as the Yahoo loader.
- The first draft failed on a genuine tie, not a defect; the tests now assert the tie explicitly. Once drop-goalie scores are known, the -2.75 drop-goalie plan is correctly pruned as dominated.
- Production RSO now runs the R6c/R6d/R6f interim FORGE bridge on master; this replay exercises the issued-forecast admission and planning path, not the bridge (my reading of the test, not stated by the session).
