# Sidecar hydration (6767073ea) — master-mode reconstruction backtest verdict (2026-10-21)

**Question (release session, TJ-approved there and in this session):** master's FORGE reader leaves every pruned rolling field (`_all`, `_avg_`, `_3ya`) NULL because the writer moved them to `rolling_player_metric_support_payloads` and master never reads it (`forge-model-release-inventory.md` finding 1). Does hydrating them (commit 6767073ea, `skater-queries.ts` only) improve master's projections? And does R18's even-strength assist refit, cleared on octoberBranch inputs, hold on master inputs?

## Method
- Four throwaway exports of `origin/master` 56fb03fef (R18, pre-R19): **a** as deployed; **b** + 6767073ea's hydration only (applied cleanly — master's `skater-queries.ts` is that commit's parent); **a0** = a with R18's assist refit reverse-applied; **b0** = b likewise. No Q7/Q8, no aligned-count support, no PP-usage change. Baseline model mode (`FORGE_SKATER_MODEL_MODE` unset) in all four.
- `web/scripts/capture-forge-reconstruction.ts` (transport fence: GET/HEAD to Supabase REST only) for every played game 2026-10-13..10-20 (62 games) × 4 variants, strictly sequential: **248 runs, 26,164 GET reads (max 119 per run), 0 rejected requests, every replay verified, 0 failures** (~55 min). One extra read-only SELECT (S9: hits/blocks actuals, 2,231 rows). TJ approved pilot + full run with stop rules (>500 reads/run, >4 h, >60k GETs); none triggered.
- Scorer: new `web/scripts/forge-reconstruction-backtest.ts` (paired cluster bootstrap by game, 2,000 reps, seed 1). 2,074 dressed player-games in all four variants. Full tables: `hydration-recon-backtest-report-2026-10-21.md`.
- **Caveat:** reconstructions read today's database (rolling rows recomputed and NST backfilled since those dates), so they are not what production served then; the paired comparisons share inputs and are clean.

## Hydration effect (b vs a, R18 on; b0 vs a0 is the same within noise)

| head (weight) | a bias / RMSE | b bias / RMSE | ΔRMSE [95% CI] | top-decile Σactual/Σpred a → b |
|---|---|---|---|---|
| **Fantasy points** | −0.442 / 2.102 | **−0.158 / 2.013** | **−0.089 [−0.123, −0.054]** | **1.235 → 0.976** |
| G (3) | −0.025 / 0.454 | −0.007 / 0.444 | −0.0095 [−0.014, −0.005] | 1.304 → 0.917 |
| A (2) | −0.095 / 0.573 | −0.073 / 0.560 | −0.0136 [−0.020, −0.007] | 1.637 → 1.174 |
| PPP (1) | −0.029 / 0.349 | −0.019 / 0.346 | −0.0020 (spans 0) | 1.286 → 0.958 |
| BLK (0.25) | −0.323 / 1.268 | −0.010 / 1.153 | −0.115 [−0.163, −0.072] | 1.681 → 0.824 |
| SOG (0.2) | −0.105 / 1.421 | −0.100 / 1.418 | −0.003 (spans 0) | 1.033 → **0.893** |
| HIT (0.2) | −0.232 / 1.651 | **+0.262** / 1.469 | −0.182 [−0.231, −0.134] | 0.900 → **0.636** |

FP MAE is flat (Δ CI [−0.029, +0.024]).

## R18 (even-strength assist refit) on master inputs

| | A bias | A RMSE Δ [CI] | top-decile A | FP bias | FP RMSE Δ [CI] | FP top decile |
|---|---|---|---|---|---|---|
| without hydration (a vs a0) | −0.180 → −0.095 | −0.024 [−0.028, −0.021] | 2.524 → 1.637 | −0.611 → −0.442 | −0.049 [−0.057, −0.042] | 1.355 → 1.235 |
| with hydration (b vs b0) | −0.167 → −0.073 | −0.025 [−0.031, −0.020] | 1.827 → 1.174 | −0.342 → −0.158 | −0.024 [−0.036, −0.012] | 1.075 → 0.976 |

**R18 holds on master inputs**, with or without hydration: assist bias roughly halves, RMSE improves with CIs excluding 0, top-decile calibration improves; MAE rises as expected (+0.037 A).

## Verdict
- **Hydration clears on the objective and on G, A, PPP and BLK**: fantasy-point bias falls 64%, RMSE improves (CI excludes 0), top-decile calibration goes from 24% under to 2% over; goals, assists and blocks all improve on bias, RMSE and top-decile calibration.
- **Two low-weight heads regress on calibration:** SOG top decile from 3% under to 11% over (RMSE neutral), and **HIT flips from under- to over-prediction** (bias −0.23 → +0.26; top decile from 10% to 57% over) although its RMSE improves strongly. The hits overshoot is the hydrated `hits_per_60_all` history now reaching master's un-shrunk hits path; octoberBranch's hits/blocks model (F5, all-strength rates shrunk to F/D priors) is the matching fix and is not on master (inventory R22).
- Under the literal per-head gate (no calibration regression on any head) SOG and HIT fail; on the fantasy-point objective, and on every head weighted 0.25 or more, hydration clears. **TJ's call:** ship hydration now (accepting the SOG/HIT top-decile shift, ~0.2-weight heads), or ship it together with F5 (R21 + R22 as the inventory already suggests).
- No patch prepared yet, per the release session's instruction; `recon/hydration-6767073ea.patch` (the clean master apply) is in the scratchpad if cleared.
