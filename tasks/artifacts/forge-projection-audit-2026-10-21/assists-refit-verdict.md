# Per-goal assist refit — re-backtest verdict (2026-10-21)

Code (uncommitted at writing, committed as HOLD): `computeStrengthSplitConversionRates` / `computeSupportedStrengthSplitConversionRates` / `resolveSkaterConversionRates` take `assistDenominator: "per_goal" | "per_two_goals"` (default `per_goal`); `per_goal` drops the ×2 goal denominators and halves every prior pseudo-count (`blendOnlineRate` adds priorStrength to the denominator), so shrinkage is identical and every rate is exactly 2× the legacy one; priors 1.44/1.90, bounds and the stage's trend/coupling clamps doubled; `uncertainty.model.skater_selection.assist_rate_scale = { convention: "per_goal", legacy_per_two_goals: {...} }`; holdout `naive_prior` moved to 1.44/1.90. Tests: model files 113, harness 10, bridge, queries, ledger — 274 across 9 files; eslint clean; tsc see diary.

Backtest: same TJ-approved cohort export (1,710 scored player-games; 1,124 with an assist head; 51 games), harness variants `a4` (per-goal refit; goals unchanged) and `a4q7` (refit + Q7 goal path), RMSE now reported with paired cluster-bootstrap CIs. Full tables: `assists-refit-backtest-report-2026-10-21.md`.

## Results (Δ vs baseline, 95% CI)

| head | variant | MAE | bias | RMSE | ΔRMSE | top-decile Σactual/Σpred |
|---|---|---|---|---|---|---|
| A | baseline | 0.4156 | −0.2153 | 0.6567 | — | 1.898 |
| A | **a4** | 0.4566 | **−0.0539** | **0.6173** | **−0.0394 [−0.0527, −0.0260]** | **0.971** |
| A | a4q7 | 0.4571 | −0.0452 | 0.6173 | −0.0394 [−0.0540, −0.0250] | 0.891 |
| PPP | baseline | 0.2168 | −0.0382 | 0.4007 | — | 1.047 |
| PPP | **a4** | 0.2467 | +0.0157 | 0.4091 | +0.0084 [−0.0005, +0.0182] | **0.728** |
| G | a4 | unchanged | | | | 1.050 |

B2B team slice (A n 153): a4 bias −0.205 → −0.036, ΔRMSE −0.029 [−0.061, +0.011]. B2B opponent slice (PPP n 156): a4 ΔRMSE **+0.033 [+0.003, +0.075]**.

## Verdict
- **Assists: cleared on the measures that matter for expected points.** Bias falls 75% (−0.215 → −0.054 per player-game), RMSE improves with a CI that excludes 0, and top-decile calibration goes from 90% under to 3% over. MAE worsens (+0.041), as expected for a mean-correct forecast of a zero-heavy count — MAE should not be the gate for this head.
- **PPP: not cleared.** With assists fixed, PPP flips from slightly under (bias −0.038) to slightly over (+0.016) overall, and the top goal decile is now over-predicted by 37% (Σactual/Σpred 0.728); the opponent-B2B slice RMSE worsens with a CI excluding 0. Baseline PPP was well calibrated only because halved PP assists were offsetting an over-prediction elsewhere on the PP side (PP goals and/or the PP share reallocation, REPORT §3 finding R5 / W3 §3) — fixing one error exposed the other.
- **Q7 still not cleared** (a4q7 adds nothing for A and pushes top-decile A to 0.891, G to 0.952).

## Recommendation
Do not release the refit as one change. Two options, both re-backtestable with no new export:
1. **ES-only refit** (assists per goal at even strength; PP assists stay on the old scale until the PP side is fixed). Expected: most of the A bias fix (ES assists are ~70% of assists), PPP unchanged. Needs a harness variant `a5` and a `assistDenominatorPp` split in the calculator option.
2. **Refit both + find the PP over-prediction** (PP goals per PP shot, PP TOI reallocation by role weight) before release; larger, but leaves no known compensating error.
Either way the RSO gains the most from (1) now: assists are worth 2 points each and are the head that was off by half.

Ledger note: rows written after this code ships carry `assist_rate_scale.convention = "per_goal"`; earlier rows' `conversion_rates.assist_rate_*` are on the half scale. The served-forecast ledger compares served values, so it is unaffected; the offline harness pins `per_two_goals` for stored rows.
