# Q7 / Q8 frozen-cohort backtest — verdict (2026-10-21)

Harness: `web/scripts/forge-counterfactual-backtest.ts` (new, tested 4/4); inputs: four TJ-approved read-only SELECTs run once via read-only psql (`prod-queries.sql` §backtest), exported to scratchpad JSON (S1 11 runs, S2 2,268 projection rows / 4.96 MB, S3 2,231 actuals, S4 64 games). Full report: `q7-q8-backtest-report-2026-10-21.md`. Seed 1, 2,000 paired cluster-bootstrap reps by game.

## Cohort actually scored
- 1,710 of 2,268 rows: 194 had no WGO actual (scratches; 10-21 games not yet played at export), **364 were dropped by the mask self-check** — these are the stamped master runs (10-20 `98614484`, 10-21 `7baa91407`), whose heads are never withheld while their support pair is absent (master lacks `6e14053ff`). So the **stamped stratum is empty**; every scored row comes from the 10-13..10-19 octoberBranch local runs. The conversion/rest code under test is identical on both; only the masking differs.
- Self-checks: 0 used-rate mismatches, 0 rest-multiplier mismatches, 0 negative residuals → the baseline reproduces the stored predictions exactly and the stored inputs are consistent with the pure calculators.
- Early-season caveat (scout W-E): the season bootstrap weight on the model's own line is p = games/20 ≈ 0.05–0.30 in this window, so Q7's effect is diluted to that share; a full-season effect would be ~3–20× larger than measured here.

## Numbers (Δ = variant − baseline; negative ΔMAE is better; 95% CI)

| head | n | baseline MAE / bias | Q7 ΔMAE | Q7 Δbias | Q8 ΔMAE | Q8 Δbias |
|---|---|---|---|---|---|---|
| G | 1,471 | 0.2966 / −0.0214 | +0.0010 [−0.0003, +0.0023] | +0.0065 [+0.0049, +0.0081] | +0.0002 [+0.0001, +0.0003] | +0.0004 |
| A | 1,124 | 0.4156 / **−0.2153** | **−0.0015 [−0.0029, −0.0002]** | +0.0050 | +0.0001 [−0.0001, +0.0003] | +0.0006 |
| PPP | 1,127 | 0.2168 / −0.0382 | −0.0004 [−0.0015, +0.0006] | +0.0017 | +0.0002 [+0.0000, +0.0003] | +0.0003 |

Top decile by predicted G (148 rows, fixed bins): Σactual/Σpred baseline **1.050** (5% under) → Q7 **0.952** (5% over), Q8 1.046, Q7+Q8 0.948. Assists in that decile: baseline 1.898, Q7 1.783.
B2B team slice (team rest = 1; n 204/153/154): Q7 G ΔMAE −0.0004 [−0.0045, +0.0033]; Q8 G ΔMAE −0.0006 [−0.0013, −0.0000], Δbias −0.0013; Q7+Q8 PPP ΔMAE −0.0031 [−0.0064, −0.0006].
B2B opponent slice (n 206/155/156): Q8 G ΔMAE **+0.0012 [+0.0008, +0.0017]**, A +0.0006, PPP +0.0011 — the opponent-fatigue boost moving to the heavy tier slightly hurts.

## Verdict against the gate ("no regression on G/A/PPP and on calibration decile 10, B2B slice included")
- **Q7 — not cleared.** G MAE does not improve (CI spans 0 with a positive point estimate); A improves slightly; decile-10 calibration does not improve — it flips from +5% under to −5% over, and with the bootstrap dilution removed later in the season the over-prediction at the top would grow. The second shrink is wrong in form (window-blind) but it is currently doing useful work as a top-decile damper. Recommendation: **do not release Q7 as is**; keep the code and its `conversion_shrink` bookkeeping (already persisted going forward — it makes the ledger comparison free), and revisit as S-C (window-aware weights) once the served-forecast ledger has ~3 weeks of data.
- **Q8 — a wash, not a regression in practice.** Every Δ is ≤ 0.0012 FP-equivalent per game (≤ 0.4% of MAE); the team-B2B slice improves marginally, the opponent-B2B slice worsens marginally; decile 10 unchanged. It is the convention fix F8 needs before any rest-magnitude calibration can be meaningful, but it does not meet the literal "no regression" bar on the all-rows G line (+0.0002, CI excludes 0 by 0.0001). **TJ's call**: ship as a consistency fix now (recommended, with `rest_legacy_multipliers` persisted for later comparison), or hold with Q7.

## The finding that matters more than either change
Assists are under-predicted by **0.215 per player-game** across the whole cohort (bias −0.2153 on MAE 0.4156), and by 0.31 per game in the top goal decile (predicted 0.349 vs actual 0.662). That is ≈0.43 league points per player-game, an order of magnitude above Q7/Q8's effects. Candidates (not verified): the assist-per-goal double shrink (A1 + A3, same mechanism as Q7), the teammate-coupling clamp, the season-bootstrap prior for assists, or the 2× goals denominator in the assist Bayes blend. Proposed next experiment (same harness, no new exports): counterfactual on the assist rate alone (drop A3, widen the coupling clamp) — it needs only the stored `conversion_shrink.assist_*` fields.
