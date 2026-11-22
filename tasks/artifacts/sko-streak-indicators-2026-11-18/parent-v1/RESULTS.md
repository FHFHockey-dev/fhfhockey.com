# Development results by decision

AUC measures ranking. Average precision (AP) is compared with event prevalence. Lower Brier is better. Intervals for paired AUC gains resample skaters with all their appearances together. The A and B populations and outcomes differ. All twelve research contrasts remain unqualified. See the [long-history comparison](longer-reference-frozen-pairs.csv) for the stronger scoring comparator tested after the frozen analysis.

## A · Pilot's rolling labels

| Decision | Events / issues | Players | Scoring AUC | + process AUC | Paired Δ [95% CI] | AP vs prevalence | Brier (scoring → process) | Correct / alerts | Lead (GP) | Product |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Hot onset | 39 / 947 | 267 | 0.901 | 0.899 | -0.001 [-0.023, +0.020] | 0.386 vs 0.041 | 0.032 → 0.032 | 27 / 108 | 1 to breach, 2 to confirm | Development gate missed |
| Hot continuation | 93 / 139 | 71 | 0.935 | 0.895 | -0.040 [-0.095, -0.001] | 0.952 vs 0.669 | 0.098 → 0.129 | 12 / 12 | 1 to decision | Development gate missed |
| Hot exit | 46 / 139 | 71 | 0.935 | 0.895 | -0.040 [-0.095, -0.001] | 0.740 vs 0.331 | 0.098 → 0.129 | 13 / 15 | 1 to decision | Development gate missed |
| Cold onset | 24 / 947 | 267 | 0.981 | 0.932 | -0.049 [-0.137, -0.002] | 0.473 vs 0.025 | 0.017 → 0.019 | 20 / 89 | 1 to breach, 2 to confirm | Development gate missed |
| Cold continuation | 80 / 119 | 62 | 0.823 | 0.774 | -0.049 [-0.100, +0.002] | 0.881 vs 0.672 | 0.155 → 0.184 | 13 / 13 | 1 to decision | Development gate missed |
| Cold exit | 39 / 119 | 62 | 0.823 | 0.774 | -0.049 [-0.100, +0.002] | 0.649 vs 0.328 | 0.155 → 0.184 | 12 / 16 | 1 to decision | Development gate missed |

| Decision | Episodes at issue / seen ahead¹ | Alert rate / precision / recall | Mean estimate / observed rate | Calibration intercept / slope | AP (scoring → process) | Highest scoring-only AUC² |
|---|---:|---:|---:|---:|---:|---|
| Hot onset | 0 / 39 | 11.4% / 25.0% / 69.2% | 0.046 / 0.041 | -0.35 / 0.89 | 0.400 → 0.386 | scoring (0.901) |
| Hot continuation | 74 / 0 | 8.6% / 100.0% / 12.9% | 0.609 / 0.669 | 0.51 / 0.43 | 0.971 → 0.952 | scoring (0.935) |
| Hot exit | 74 / 0 | 10.8% / 86.7% / 28.3% | 0.391 / 0.331 | -0.51 / 0.43 | 0.823 → 0.740 | scoring (0.935) |
| Cold onset | 0 / 24 | 9.4% / 22.5% / 83.3% | 0.037 / 0.025 | -0.97 / 0.78 | 0.522 → 0.473 | scoring (0.981) |
| Cold continuation | 63 / 0 | 10.9% / 100.0% / 16.2% | 0.631 / 0.672 | 0.38 / 0.64 | 0.895 → 0.881 | scoring (0.823) |
| Cold exit | 63 / 0 | 13.4% / 75.0% / 30.8% | 0.369 / 0.328 | -0.38 / 0.64 | 0.747 → 0.649 | scoring (0.823) |

[All baseline stages, challengers and performance](evaluation/pilot/metrics.csv) · [Paired and ablation intervals](evaluation/pilot/paired_gains.csv) · [Calibration bins](evaluation/pilot/calibration.csv) · [Subgroups](evaluation/pilot/subgroups.csv) · [Training effects with uncertainty](evaluation/pilot/effects.csv) · [Eligibility and purge counts](evaluation/pilot/coverage.csv)

## B · Next five played games

| Decision | Events / issues | Players | Scoring AUC | + process AUC | Paired Δ [95% CI] | AP vs prevalence | Brier (scoring → process) | Correct / alerts | Lead (GP) | Product |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Hot onset | 855 / 6,778 | 591 | 0.550 | 0.642 | +0.092 [+0.050, +0.129] | 0.206 vs 0.126 | 0.110 → 0.108 | 143 / 524 | 1 to first, 5 to verdict | Development signal; stronger comparator unresolved |
| Hot continuation | 149 / 714 | 243 | 0.501 | 0.557 | +0.056 [-0.011, +0.132] | 0.233 vs 0.209 | 0.169 → 0.182 | 11 / 46 | 1 to first, 5 to verdict | Development gate missed |
| Hot exit | 565 / 714 | 243 | 0.501 | 0.557 | +0.056 [-0.011, +0.132] | 0.839 vs 0.791 | 0.169 → 0.182 | 144 / 167 | 1 to first, 5 to verdict | Development gate missed |
| Cold onset | 531 / 6,778 | 591 | 0.834 | 0.810 | -0.024 [-0.038, -0.011] | 0.260 vs 0.078 | 0.066 → 0.067 | 173 / 654 | 1 to first, 5 to verdict | Development gate missed |
| Cold continuation | 165 / 564 | 187 | 0.601 | 0.601 | -0.000 [-0.064, +0.067] | 0.391 vs 0.293 | 0.205 → 0.217 | 18 / 38 | 1 to first, 5 to verdict | Development gate missed |
| Cold exit | 399 / 564 | 187 | 0.601 | 0.601 | -0.000 [-0.064, +0.067] | 0.779 vs 0.707 | 0.205 → 0.217 | 86 / 108 | 1 to first, 5 to verdict | Development gate missed |

| Decision | Episodes at issue / seen ahead¹ | Alert rate / precision / recall | Mean estimate / observed rate | Calibration intercept / slope | AP (scoring → process) | Highest scoring-only AUC² |
|---|---:|---:|---:|---:|---:|---|
| Hot onset | 0 / 309 | 7.7% / 27.3% / 16.7% | 0.112 / 0.126 | -0.56 / 0.64 | 0.144 → 0.206 | level (0.555) |
| Hot continuation | 289 / 0 | 6.4% / 23.9% / 7.4% | 0.149 / 0.209 | -0.95 / 0.19 | 0.201 → 0.233 | level (0.521) |
| Hot exit | 289 / 0 | 23.4% / 86.2% / 25.5% | 0.851 / 0.791 | 0.95 / 0.19 | 0.795 → 0.839 | level (0.521) |
| Cold onset | 0 / 233 | 9.6% / 26.5% / 32.6% | 0.091 / 0.078 | -0.54 / 0.80 | 0.247 → 0.260 | level (0.840) |
| Cold continuation | 223 / 0 | 6.7% / 47.4% / 10.9% | 0.317 / 0.293 | -0.59 / 0.34 | 0.380 → 0.391 | level (0.615) |
| Cold exit | 223 / 0 | 19.1% / 79.6% / 21.6% | 0.683 / 0.707 | 0.59 / 0.34 | 0.771 → 0.779 | level (0.615) |

[All baseline stages, challengers and performance](evaluation/forward/metrics.csv) · [Paired and ablation intervals](evaluation/forward/paired_gains.csv) · [Calibration bins](evaluation/forward/calibration.csv) · [Subgroups](evaluation/forward/subgroups.csv) · [Training effects with uncertainty](evaluation/forward/effects.csv) · [Eligibility and purge counts](evaluation/forward/coverage.csv)

¹ For active decisions, count distinct confirmed episodes at issue. For onset, the issue is neutral. Count distinct same-side chart episodes encountered within the horizon. B production blocks can qualify without a chart episode. Count each player-game once per decision. Consecutive warnings in a sustained run are distinct issues.

² This is a descriptive comparison of the four prespecified baselines on validation. The comparator in the paired table is frozen. An ideal calibration intercept/slope is 0/1. Intervals condition on the fitted development models. Opponents and league-wide calendar shocks can correlate across player clusters.
