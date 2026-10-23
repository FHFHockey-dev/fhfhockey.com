# FORGE model lane hand-over (Claude, 2026-10-22)

## Released (shipped by Chef)

| Release | master | Contents |
|---|---|---|
| **B** | `40b17b572` | task 2 (`721486d0f`: history hydration, full S-F reader, F/D-prior hits/blocks, paired count/exposure repair), the goalie model 7.x, market probabilities 6.x, NB distributions 8.x, nullable GF/W, and the 7.3 bridge |
| **C** | `d4c2632d3` | task 3 (`23adcf713`: assists from team on-ice goals × assist share, reconciled to league A/G of 1.65 ES / 1.91 PP) and task 4 (`7dee3cbed`: F/D × ES/PP conversion and shot-rate priors) |

Release C measured against the Release B model on 62 games:
- fantasy-point bias −10.7% → −1.0%, with RMSE −0.065 and deciles 0.90–1.10;
- defencemen goals +46% → +2%;
- the SOG calibration slope 0.78 → 0.99.

## Unreleased on octoberBranch

**`0dd535e0d`** replaces the shrinkage strengths for assist share and goal conversion with method-of-moments estimates; the shot-rate ones are unchanged. Against Release C, error was neutral on every stat. The calibration slopes moved slightly toward 1: goals 1.16 → 1.14, assists 1.36 → 1.30, fantasy points 1.14 → 1.12. It rides with the next model release. Evidence is in `tasks/artifacts/forge-k-refit-gate-2026-10-22/`.

## Task status

- **Task 9 (context terms): not cleared, nothing shipped.** The evidence commit is `5c6cadc84`, in `tasks/artifacts/forge-task9-gate-2026-10-22/`. The tested variant changed three things:
  - goalie quality had one owner: the team save % term was dropped;
  - the opponent-goalie effect was damped 50%;
  - role stability moved into the uncertainty instead of cutting the mean.

  Fantasy points came out neutral (error +0.008, interval spans 0). Hits and blocks improved. Fewer defencemen reached the top fantasy-point decile, which was worse. Q7 (dropping the second conversion shrink) raised forwards' PP goals per shot to 0.213 against 0.170 actual, so Q7 stays out.
- **Task 5 (SH goals/assists, PK TOI): deferred by TJ.** It needs the native goal-accounting contract versioned from ES+PP to ES+PP+PK first; today `NativeSkaterGoalRow.proj_goals_pk` must be null. Its consumers would change too: the forecast-diagnostics contract, board scoring and start-chart TOI. The audit sizes its value at about +0.04 FP/game.

## Open gaps

1. **PP points run +17%; defencemen +40%.** PP TOI and PP shots are right. The excess is forwards' PP conversion: 0.20 predicted vs 0.17 actual goals per shot. PP assists are correctly 1.91 × PP goals, so the extra PP goals carry straight into PP points.
2. **Predictions are compressed.** The slopes are above 1 for goals, assists and fantasy points. The small-sample second goal shrink has a weight capped at 0.76. Context goal multipliers inflate conversion, and the shot-quality multiplier double-counts finishing that conversion history already holds.
3. **Even-strength shots run about 11% low for dressed skaters.** Team totals are spread over roughly 2 non-dressed projected skaters per team. That's participation work, outside the model lane.
4. **Early-season rolling rows (09-29..10-06) are stale or missing.** TJ refreshes them from /db/runner; the scope is in `tasks/artifacts/forge-task2-gate-2026-10-22/VERDICT.md`. Every row from 10-07 on is identical.
5. **Hits run +11% and blocks +12%.** Candidate fixes are the migration 88 league rescale or a physical prior re-fit. Each needs its own gate.

## Evidence and harness

- **Verdicts:** `tasks/artifacts/forge-{task2,task3,task4,task9,k-refit}-gate-2026-10-22/`.
- **Priors data:** `tasks/artifacts/forge-priors-2026-10-22/`.
- **Scripts,** copied into those folders:
  - capture runner `run-captures-v.sh`;
  - paired scorer `score_pair.py`;
  - `mz.py`.
- **Cohort:** 62 games, 10-13..10-20; actuals reused from the 10-21 audit.
- **Production reads in this lane** (all TJ-approved in the session):
  - about 63k reads across the capture runs, each within its stop rules;
  - 1.2k reads for the row-identity check;
  - two aggregate SQL queries.
- **Diary:** `tasks/diaries/2026-10-22-claude-model-lane.md`. It stays open because task 5 is unfinished.
