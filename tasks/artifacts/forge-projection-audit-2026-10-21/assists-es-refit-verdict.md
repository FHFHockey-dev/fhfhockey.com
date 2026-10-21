# ES-only assist refit (a5) — re-backtest verdict (2026-10-21)

Code (committed as HOLD): `assistDenominator` on the three calculators now accepts `"per_goal" | "per_two_goals" | { es, pp }`; the default when omitted — and the live stage path — is `SKATER_ASSIST_DENOMINATOR_DEFAULT = { es: "per_goal", pp: "per_two_goals" }`: even-strength assists fitted per goal (priors 1.44, clamps [0.4,3.4] trend / [0.4,3.6] coupling), power-play assists unchanged (0.95, [0.3,2] / [0.3,2.1]). `assist_rate_scale.convention` is persisted as `{ es, pp }`; holdout `naive_prior` ES 1.44 / PP 0.95. Checks: 9 files, 276 tests; eslint clean; tsc see diary.

Backtest: same TJ-approved cohort (1,710 scored player-games; 1,124 with an assist head; 51 games); harness variant `a5` (stored rows still reproduce exactly: 0 rate/rest/mask mismatches). Full tables: `assists-es-refit-backtest-report-2026-10-21.md`.

## Results (Δ vs baseline, 95% CI)

| head | variant | MAE | bias | RMSE | ΔMAE | ΔRMSE | top-decile Σactual/Σpred |
|---|---|---|---|---|---|---|---|
| G | a5 | 0.2966 | −0.0214 | 0.4646 | 0 | 0 | 1.050 (unchanged) |
| A | baseline | 0.4156 | −0.2153 | 0.6567 | — | — | 1.898 |
| A | a4 (both strengths) | 0.4566 | −0.0539 | 0.6173 | +0.0411 | −0.0394 [−0.0527, −0.0260] | 0.971 |
| A | **a5 (ES only)** | 0.4455 | **−0.1083** | **0.6244** | +0.0299 [+0.0230, +0.0372] | **−0.0323 [−0.0412, −0.0232]** | **1.221** |
| PPP | baseline | 0.2168 | −0.0382 | 0.4007 | — | — | 1.047 |
| PPP | **a5** | 0.2163 | −0.0386 | 0.4004 | −0.0005 [−0.0010, −0.0000] | −0.0003 [−0.0010, +0.0003] | **1.062** |

B2B team: A ΔRMSE −0.0225 [−0.0419, +0.0016]; PPP ΔRMSE +0.0001 [−0.0033, +0.0018]. B2B opponent: A ΔRMSE −0.0290 [−0.0479, −0.0103]; PPP ΔRMSE +0.0010 [−0.0008, +0.0036].

## Verdict against the gate (G/A/PPP, decile 10, B2B slices)
- **G:** unchanged (assists only).
- **PPP:** no regression anywhere — every Δ ≈ 0 with CIs spanning 0 or improving; top decile 1.047 → 1.062. This is what a4 failed.
- **A:** bias halved (−0.215 → −0.108), RMSE better with a CI excluding 0 (overall and opponent-B2B), top-decile calibration 1.898 → 1.221. **MAE worsens** (+0.030, CI excludes 0) — the expected effect of moving a zero-heavy count toward its true mean; under the literal "no regression on MAE" wording this head fails, under bias/RMSE/calibration it clears.
- **Decision for TJ:** whether assists are gated on bias/RMSE/calibration (recommended for a points league — lineups use expected points) or on MAE. If the former, a5 is the first model change in this audit that is cleared for a release candidate.

## Remaining assist gap and next step
a5 closes half of the assist bias; the rest is power-play assists (still on the halved scale) plus whatever over-predicts PP goals or PP usage — the compensating error a4 exposed (top-decile PPP 0.728 when PP assists were also refit). Next experiment, same harness and cohort, no new export: decompose PPP into PP goals and PP assists per row and score them separately to locate the PP over-prediction (PP conversion vs. PP TOI reallocation by role weight, REPORT §3 R5).
