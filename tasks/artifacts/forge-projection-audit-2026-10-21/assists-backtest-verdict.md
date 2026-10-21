# Assists under-prediction — counterfactual backtest and mechanism (2026-10-21)

Same cohort export as the Q7/Q8 run (S1–S4, TJ-approved, read-only; 1,710 scored player-games, 1,124 with an assist head, 51 games); harness `web/scripts/forge-counterfactual-backtest.ts` with variants `a1` (assist-only no second shrink), `a2` (outer teammate-coupling clamp widened), `a1a2`, `a3` (final assist rates × 2 after all clamps — a proxy for the denominator fix below). Full tables: `assists-backtest-report-2026-10-21.md`. No model code was changed.

## Correction to the Q7/Q8 verdict
The decomposition shows mean season-bootstrap weight **p = 1.000 and prior part = 0** on every scored row: the bootstrap was not active in this cohort, so the earlier caveat "Q7's effect is diluted by the bootstrap" was wrong. Q7's measured effect is its full organic effect; the verdict (not cleared) stands.

## Results (Δ = variant − baseline, 95% CI; negative ΔMAE is better)

| variant | head | MAE | bias | ΔMAE | Δbias | top-decile Σactual/Σpred |
|---|---|---|---|---|---|---|
| baseline | A | 0.4156 | −0.2153 | — | — | 1.898 |
| a1 | A | 0.4144 | −0.2147 | −0.0011 [−0.0022, −0.0001] | +0.0006 | 1.941 |
| a2 | A | 0.4156 | −0.2153 | 0 (clamp binds on 0/1,124 rows) | 0 | 1.898 |
| **a3** | A | 0.4579 | **−0.0552** | **+0.0424 [+0.0325, +0.0533]** | **+0.1601** | **0.949** |
| baseline | PPP | 0.2168 | −0.0382 | — | — | 1.047 |
| a3 | PPP | 0.2473 | +0.0164 | +0.0305 [+0.0253, +0.0355] | +0.0546 | 0.714 |

Decomposition (baseline, rows with head A): mean predicted A **0.160** vs mean actual **0.375** (43%); top goal decile 0.349 vs 0.662. Goals are nearly unbiased (−0.021).

## Mechanism (code-verified)
`computeStrengthSplitConversionRates` fits the assist rate against **two goals**: `recentDenom: args.evGoalsRecent * 2`, `baseDenom: args.evGoalsAll * 2` (and PP likewise), with fallback priors 0.72 / 0.95 and bounds [0.2, 1.45] / [0.3, 1.8] all on that halved scale (`web/lib/projections/calculators/skater-adjustments.ts:583-636`). The stage then applies it **per goal**: `baseAssistsEs = baseGoalsEs * p.assistRateEs` (`web/lib/projections/stages/skater-stage.ts:2633-2634`); nothing doubles it back. League-wide, assists ≈ 1.7 × goals, so an assists-per-goal rate fitted as A/(2G) ≈ 0.85 halves every assist line. The data match: predictions are 43% of actuals (0.5 × the shrink/clamp/trend residue). The two hypotheses TJ asked to test (second shrink, coupling clamp) are not the cause: a1 moves A by 0.3%, a2 by nothing.

## What the gate cannot see
Per-game MAE on a zero-heavy count prefers predictions shrunk toward zero: the halved line *wins* on MAE (a3 is +0.042 worse) while being wrong by half on expectation. For a points league the lineup and ranking decisions use expected points, where the halved line misorders playmakers against shooters (A is worth 2 of the 3+2+1 core). The release gate should therefore score assists on **bias/calibration plus RMSE or log-score**, not MAE alone; the harness and the served-forecast ledger (`scoreLedger`) currently report MAE and bias only — adding RMSE is a few lines.

## Proposed fix (model code; HOLD until re-backtested)
1. Fit assists per goal: drop the `* 2` on the four denominators (`:585, :592, :620, :622, :630, :632`), double the fallback priors (0.72 → 1.44 ES, 0.95 → 1.90 PP — or derive them from league totals, which is better), double the raw bounds ([0.4, 2.9] / [0.6, 3.6]) and the downstream clamps in `computeStrengthSplitConversionRates` (`:642-643`), `resolveSkaterConversionRates` (`SKATER_CONVERSION_BOUNDS`), the trend clamp (`skater-stage.ts:2264-2265`) and the coupling clamp (`:2497-2505`). The `adaptivePriorStrength` evidence denominators (`:585, :592`) should also drop the `* 2` so prior strength stays in goal units.
2. Re-backtest with the harness: because it imports the pure calculator, the real fit (not the ×2 proxy) is scored from the stored support counts with no new export. Expect A bias near zero, top-decile A ≈ 1.0, PPP not overshooting (a3's PPP 0.714 shows a flat ×2 is too much for PP; the refit will set the PP scale from data).
3. Persist the new rate alongside the old in `uncertainty.model` (same pattern as `conversion_shrink`) so the ledger can compare live.
Verification: fixture asserting league-average support (A = 1.7 G) yields an assist rate ≈ 1.7; cohort backtest table; then the served-forecast ledger once it is live.

## Not verified
- Whether any reader or display assumes the halved assist-rate scale (grep for `assist_rate_es` consumers before changing bounds).
- The PP assist scale after a proper refit (the proxy over-corrects PP).
- The cohort is 10-13..10-19 branch runs (stamped master rows fail the mask self-check); the denominator code is identical on master.
