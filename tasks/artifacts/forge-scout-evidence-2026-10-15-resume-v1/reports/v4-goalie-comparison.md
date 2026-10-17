# Four-candidate goalie development comparison

**Decision: retain baseline for this private comparison.** No challenger passed all preregistered checks. The existing v3 selection remains preserved; this decision does not replace it or authorize live use.

One fixed pass used 39 previously allocated coherent goalie appearances and scored the same 26 player/game keys for every candidate: two goalies, four folds (4, 9, 10, 3 rows), 681 observed shots. No new labels or allocations were used. These are retrospective hindcasts with a two-calendar-day history lag and zero genuinely as-of-qualified rows. Prior exposed v3/COMP4 findings informed this protocol; this is development, not independent validation.

## Preregistered comparison

Primary score J = (MSE(SV) + MSE(GA))/2. Required: lower pooled J, improvement in at least two folds, no pooled component MSE deterioration above 2%, no fold J or component MSE deterioration above 25%, and no shot-weighted binomial loss deterioration above 0.5%. All candidates met the fixed coverage minimum. The protocol and execution gate preceded outcome decoding and the single pass.

| Candidate | Recent weights SA / minutes / save rate | J (lower better) | Change vs baseline | Folds improving J | Decision |
|---|---|---:|---:|---:|---|
| baseline | 0 / 0 / 0 | 28.674979 | +0.000% | 0/4 | Retained fallback |
| current | 0.25 / 0.25 / 0.25 | 29.319013 | +2.246% | 0/4 | Rejected: pooled J, fold consistency, pooled SV/SA limits, fold 1 GA limit |
| conservative0 | 0 / 0 / 0.25 | 28.613332 | -0.215% | 2/4 | Rejected: fold 1 GA limit |
| conservative10 | 0.1 / 0.1 / 0.25 | 28.883766 | +0.728% | 1/4 | Rejected: pooled J, fold consistency, fold 1 GA limit |

Baseline is the fallback, not a challenger required to improve on itself. No tolerances were relaxed after seeing results.

## Component errors

| Candidate | SV MSE / MAE | GA MSE / MAE | SA MSE / MAE | Minutes MSE / MAE |
|---|---:|---:|---:|---:|
| baseline | 55.574804 / 6.178367 | 1.775154 / 1.099966 | 49.307898 / 5.708581 | 100.148598 / 4.775792 |
| current | 56.890369 / 6.191444 | 1.747658 / 1.116683 | 50.619475 / 5.743795 | 100.613106 / 4.849922 |
| conservative0 | 55.451131 / 6.148821 | 1.775532 / 1.123133 | 49.307898 / 5.708581 | 100.148598 / 4.775792 |
| conservative10 | 56.003493 / 6.165870 | 1.764039 / 1.120553 | 49.803275 / 5.722667 | 100.309598 / 4.804845 |

| Candidate | Shot-weighted binomial loss | GA exposure-adjusted Poisson deviance | Fold 1 GA MSE increase |
|---|---:|---:|---:|
| baseline | 0.348016171 | 1.152653 | +0.000% |
| current | 0.347898710 | 1.141808 | +41.695% |
| conservative0 | 0.347898710 | 1.154441 | +59.044% |
| conservative10 | 0.347898710 | 1.149303 | +51.600% |

The shared save-rate update improves pooled binomial loss slightly, but the workload blends worsen pooled SV and SA mean error. Conservative0 isolates the save-rate update and improves J by only 0.215%; its first-fold GA regression still breaches the declared guard. Better rate scoring alone does not qualify the joint count forecast.

## Fold and player checks

| Candidate | Nov 17–30 J (N=4) | Dec 1–14 J (N=9) | Dec 15–Jan 2 J (N=10) | Jan 3–7 J (N=3) |
|---|---:|---:|---:|---:|
| baseline | 17.564255 | 12.162333 | 43.267341 | 44.386008 |
| current | 19.317761 | 12.545026 | 43.887011 | 44.415986 |
| conservative0 | 17.989711 | 12.255758 | 43.115200 | 43.511318 |
| conservative10 | 18.485028 | 12.369330 | 43.416627 | 43.849186 |

| Candidate | Player 9709 J (N=11) | Player 9768 J (N=15) |
|---|---:|---:|
| baseline | 34.554839 | 24.363082 |
| current | 34.226204 | 25.720407 |
| conservative0 | 34.394205 | 24.374024 |
| conservative10 | 34.321305 | 24.896237 |

Full precision MSE, RMSE, MAE, bias, ratio diagnostics, sample counts, all guard booleans and all 15 pooled/fold/player/player-by-fold cells per candidate are preserved in [results.json](results.json). Empty cells remain explicit. Player strata were diagnostic only.

## Boundaries and verification

All four candidates preserve SA = SV + GA, SV = SA × save probability, and GAA = 60 × GA / predicted minutes. Save probability is exposure-weighted; ratios are coherent rate estimands, not expected random per-game ratios. Baseline and current predictions and original aggregate metrics reproduced frozen v3 values within the declared numerical tolerance. Eleven synthetic checks passed before execution, covering chronology, fallback, coherence, selection guards and metadata-first exclusion.

January 8 onward remains reserved. Prior v3 and COMP4 artifacts are read-only inputs; all new files are confined to this private v4 directory. No external projections, new acquisition, production writes or deployment. Today’s existing BLK operation remains unchanged at 17:50 dispatch, 18:15 cutoff and 18:30 issuance.

Only two goalies and tiny dependent folds are represented. These results do not qualify rookies, sparse-history populations, traded or returning players, or new-season roles. No uncertainty-calibration or lineup-decision-value claim is made. SO, participation, goalie-start probability, PP role and unconditional ice time remain unsupported. W and skater models were not compared or changed.

## Stopping and next proposals

The four-candidate comparison is finished. Do not expand candidates, change thresholds or rerun this selection on these outcomes. If further work is separately authorized, preregister a distinct workload question and cohort/role coverage and uncertainty requirements before execution; keep reserved evaluation protected. The small rate-only improvement and first-fold regression justify further investigation, not promotion.

Protocol: [PROTOCOL.md](PROTOCOL.md). Prefit gate: [reviews/execution-gate.json](reviews/execution-gate.json). Frozen forecasts: [predictions.json](predictions.json). Numerical history state: [research-state.json](research-state.json). Independent post-run acceptance is a separate receipt in reviews; this report alone is not acceptance.
