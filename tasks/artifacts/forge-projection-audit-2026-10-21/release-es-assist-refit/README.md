# ES-only assist refit — release patch for master (TJ-cleared 2026-10-21)

**Decision (TJ, this session):** gate assists on bias, RMSE and calibration, not MAE; treat the even-strength-only assist refit (backtest variant `a5`) as cleared; ship it as a clean single patch with Q7 and Q8 neutralised.

**Patch:** `ES-ASSIST-REFIT-master.patch` — base `origin/master` **8b99c22d2** (R17); 3 files, +97/−26; sha256 `bfdaab5c006cb73539eec03d085831d6f2f1d15f7039527fa5287d272b8233d9`. `git apply --check` passes on a pristine `git archive origin/master` export.

## What it changes (exactly the a5 behaviour)
- `web/lib/projections/calculators/skater-adjustments.ts` — `computeStrengthSplitConversionRates`: even-strength assists fitted **per goal** (denominators without ×2, prior pseudo-counts halved so shrinkage is unchanged, fallback 1.44, raw bounds [0.4, 2.9], output clamp [0.4, 3.4]); power-play assists and both goal rates byte-identical to master.
- `web/lib/projections/stages/skater-stage.ts` — assist rates used as fitted (the second sample-weight shrink is removed for assists only; the goal-rate shrink lines are unchanged byte-for-byte = **Q7 neutral**); ES trend clamp [0.4, 3.4], ES teammate-coupling clamp [0.4, 3.6] (PP unchanged); holdout `naive_prior` ES assist prior 1.44 (PP 0.95); `uncertainty.model.skater_selection.assist_rate_scale.convention = { es: "per_goal", pp: "per_two_goals" }` persisted.
- `computeSkaterRestScheduleAdjustments` untouched (**Q8 neutral**).
- `web/lib/projections/runProjectionV2.test.ts` — 3 tests: league-average ES support gives exactly 2× master's ES assist rate (≈1.65), PP and goal rates identical to master (pinned from master side by side), zero-support fallbacks ES 1.44 / PP 0.95.

## Checks (on the patched master export)
- Vitest `lib/projections` + `lib/rosterScheduleData/forgeDailyBridge.test.ts` + `__tests__/pages/api/v1/start-chart.test.ts`: 53 files, 1,163 → 1,166 tests, 0 failures.
- eslint clean on the three files; `tsc --noEmit` (8 GB heap, under `/private/tmp/fhfh-heavy.lock`) exit 0.

## Evidence and its limit
- Backtest (octoberBranch cohort 10-13..10-21, TJ-approved export): `../assists-es-refit-verdict.md` — G unchanged; PPP no regression (top decile 1.047 → 1.062); A bias −0.215 → −0.108, RMSE −0.032 [−0.041, −0.023], top-decile 1.898 → 1.221; A MAE +0.030 (accepted under the new gate).
- **Limit:** the cohort was scored on octoberBranch's aligned-pair conversion inputs. Master feeds the same calculator raw recent/all counts (`goals/shots/assists_total_all` and `_last5` from the EV/PP rolling rows, stage ~:2150-2167), and the denominator bug and the per-goal application are identical on both, so the correction transfers; the exact master-path numbers are unmeasured until the served-forecast ledger (S-B) is live.
- Consumers: no TypeScript reader of `conversion_rates.assist_rate_*` or `assist_per_goal_*` outside the stage (grep); bridge and Start Chart tests pass with the patch.

## octoberBranch note
octoberBranch still carries the HOLD commits 65fc4b9ee (Q7/Q8, live there), 07c7f71af and f0ab2b9fd (assist refit with an `assistDenominator` option and legacy mode). When master is synced back into octoberBranch after this release, the two files will conflict; resolve in favour of octoberBranch's `f0ab2b9fd` assist code (same behaviour, plus the option/legacy bookkeeping) and decide separately whether Q7/Q8 stay active there (they were not cleared).
