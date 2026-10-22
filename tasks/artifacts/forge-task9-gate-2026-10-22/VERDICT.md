# Task 9 gate: context terms with a single owner (2026-10-22)

**Verdict: not cleared. Variant g is roughly neutral on the objective.** No code ships. The diagnosis below points to the next lever: the model's predictions are too compressed.

## What g changed (on top of the live model f = Release C)

[variant-g-over-f.patch](variant-g-over-f.patch):
- **9.1, goalie quality has one owner.** The team-level goal multiplier drops its opponent-team 5v5 save % term (`opponentSaveEdge × 2.3`). That term double-counted the opponent-goalie GSAA multiplier.
- **9.1, opponent goalie damped 50%.** The goal coefficient goes 0.18 → 0.09 and the assist coefficient 0.11 → 0.055. Before, it averaged 1.034 and sat near its 0.83/1.18 clamps at p10/p90.
- **9.2, role stability as uncertainty.** `roleStabilityMultiplier` (mean 0.90, range 0.70–1.05) no longer multiplies availability. It widens the quantile volatility instead, by ×(2 − stability).
- **Home and rest are unchanged.** Their current sizes (about ±1% goals) were not re-fitted, and evidence-sized values need their own fit.
- **Q7 probe** ([q7-probe-over-g.patch](q7-probe-over-g.patch)): a 1-game pilot of g without the second goal shrink. Forward PP goals per shot went 0.197 → 0.213; the cohort actual is 0.170 and the prior 0.159. **Q7 stays out.**

## Gate

62 games, 7,544 GETs (per-gate approval), 62/62 replays matched. Source: [PAIR-f-vs-g.md](PAIR-f-vs-g.md) and [MZ-AND-D-SHARE.md](MZ-AND-D-SHARE.md).

| head | rel. bias f → g | ΔRMSE g − f [95% CI] | top decile f → g |
|---|---|---|---|
| FP | −1.0% → −1.7% | +0.008 [−0.000, +0.015] | 1.099 → 1.139 |
| G | −6.9% → −7.9% | +0.001 [+0.000, +0.002] | 1.061 → 1.085 |
| A | −3.2% → −4.3% | +0.002 [+0.001, +0.003] | 1.184 → 1.238 |
| PPP | +17.1% → +15.3% | +0.001 (spans 0) | 0.920 → 0.934 |
| SOG | −9.2% → −9.2% | −0.001 (spans 0) | 1.046 → 1.077 |
| HIT | +10.9% → +11.1% | **−0.016** [−0.024, −0.009] | 0.883 → 0.911 |
| BLK | +11.6% → +11.2% | **−0.006** [−0.011, −0.001] | 0.858 → 0.859 |

Two more signals:
- **D in the top FP decile:** 35 (c) → 26 (f) → **19 (g)**, against **38** actual.
- **Mincer–Zarnowitz slopes, f → g:** G 1.16 → 1.19, A 1.36 → 1.42, SOG 0.99 → 1.03, FP 1.14 → 1.19.

## Diagnosis from the cohort (offline; uses the 10-21 audit's `s5_pp_actuals.json`, no new reads)

- **PP usage is right.** Predicted vs actual PP TOI is 1.01 (F) and 1.03 (D); PP shots are 1.00 and 1.06.
- **The PP excess is forward PP conversion:** 0.200 predicted per shot vs 0.170 actual, with a prior of 0.159.
- **ES shots run about 11% low for dressed skaters.** ES TOI and shots are reconciled to team targets afterwards, so player-level shot multipliers and role stability only redistribute. The shortfall is team totals spread over about two non-dressed projected skaters per team: 124 rows dropped as not dressed. That's participation, not a context term.
- **Predictions are compressed.** Slopes above 1 mean the top is under-predicted and the bottom over-predicted. The likely cause is over-shrinkage from the split-half k values in tasks 3/4: an unweighted `corr()` that includes low-exposure players understates reliability, so k comes out too large. A, the head with the largest k (258/309 on-ice goals), has the steepest slope (1.36–1.42).

## Next options (TJ)

1. Re-estimate k with exposure-weighted split-half reliability (or a beta-binomial moment fit), excluding players under a minimum exposure. This needs one aggregate query like the task 3/4 one, then one gate.
2. Gate only the HIT/BLK part of g (role stability as uncertainty), which helps HIT/BLK RMSE, as its own per-effect toggle (9.3).
3. Handle participation dilution, so non-dressed projections don't take team share. That's outside the model lane: lineup/participation.
