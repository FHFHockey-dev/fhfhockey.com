# FORGE counterfactual backtest (Q7 conversion shrink, Q8 rest buckets)

Seed 1, 2000 paired cluster-bootstrap reps by game_id; Δ is variant minus baseline (negative ΔMAE = better).
Baseline reproduces stored predictions; Q7 drops the second sample-weight shrink; Q8 uses B2B = 1 rest tiers (organic rates and season-bootstrap prior context).
Organic shots/TOI are held fixed under Q8 (team reconciliation cancels uniform rest multipliers); candidate-mode rows are not modelled.

## Inputs

| input | path | sha256 |
|---|---|---|
| runs | <scratchpad>/cohort/s1_runs.json | f30e26e160ce025e2f4a2d641961feb3df5b8ada91c2126181632248d964d8aa |
| projections | <scratchpad>/cohort/s2_projections.json | 81472251be364a4d054bfbdb7ae4aab1e40dbfdacb7993cb858ae669a7abbd43 |
| actuals | <scratchpad>/cohort/s3_actuals.json | 6b945b5ada044c934e1cb5e05587d424e5c172ec03933de0cf5d3fa61c53ceab |
| games | <scratchpad>/cohort/s4_games.json | 540fd5d2cd65b1a87e7880f523ac039c601bfae06824e9bc033160edd450292b |

## Selected runs

| as_of_date | run_id | git_sha |
|---|---|---|
| 2026-10-13 | 398603ef-9eda-4f40-8f40-c7fdd3179dce | null |
| 2026-10-14 | bc3669d8-1322-426f-b138-ead0d23a45fc | null |
| 2026-10-15 | 29f2df3e-5567-440a-b1b9-4699a9283dd7 | null |
| 2026-10-16 | 6b8089f7-13af-4c92-9bdb-0430cf34b342 | null |
| 2026-10-17 | ece312c0-96d8-4cca-8566-064e793a8e29 | null |
| 2026-10-18 | d61a0552-fe4e-4454-87d8-9f8c290489f1 | null |
| 2026-10-19 | 8a3bb848-eadc-4c57-b2c0-af2983b18dc4 | null |
| 2026-10-20 | c29b3307-e394-4b38-845c-c23971b2b583 | 98614484431d9360f9a08679f57bdfc57b297a8f |
| 2026-10-21 | 34c3291c-06b9-4ed6-a23b-4b70bb399739 | 7baa91407436c3085235d08cc285557dc85726a4 |

## Check counts

| check | count |
|---|---|
| drop_mask_disagrees_with_support | 364 |
| drop_no_actual | 194 |
| drop_rest_multiplier_mismatch | 0 |
| drop_used_rate_mismatch | 0 |
| head_withheld_A | 586 |
| head_withheld_G | 239 |
| head_withheld_PPP | 583 |
| negative_residual_A | 0 |
| negative_residual_G | 0 |
| negative_residual_PPP | 0 |
| projection_rows | 2268 |
| rows_used | 1710 |
| unbootstrapped_final_ne_organic_A | 5 |
| unbootstrapped_final_ne_organic_G | 9 |
| unbootstrapped_final_ne_organic_PPP | 2 |

Games (clusters): 51

## All rows

| variant | head | n | MAE | bias | ΔMAE [95% CI] | Δbias [95% CI] |
|---|---|---|---|---|---|---|
| baseline | G | 1471 | 0.2966 | -0.0214 | — | — |
| q7 | G | 1471 | 0.2977 | -0.0149 | +0.0010 [-0.0003, +0.0023] | +0.0065 [+0.0049, +0.0081] |
| q8 | G | 1471 | 0.2969 | -0.0210 | +0.0002 [+0.0001, +0.0003] | +0.0004 [+0.0004, +0.0005] |
| q7q8 | G | 1471 | 0.2980 | -0.0143 | +0.0014 [+0.0000, +0.0027] | +0.0071 [+0.0055, +0.0088] |
| baseline | A | 1124 | 0.4156 | -0.2153 | — | — |
| q7 | A | 1124 | 0.4140 | -0.2103 | -0.0015 [-0.0029, -0.0002] | +0.0050 [+0.0031, +0.0069] |
| q8 | A | 1124 | 0.4156 | -0.2147 | +0.0001 [-0.0001, +0.0003] | +0.0006 [+0.0005, +0.0007] |
| q7q8 | A | 1124 | 0.4141 | -0.2095 | -0.0014 [-0.0028, +0.0000] | +0.0059 [+0.0039, +0.0078] |
| baseline | PPP | 1127 | 0.2168 | -0.0382 | — | — |
| q7 | PPP | 1127 | 0.2164 | -0.0365 | -0.0004 [-0.0015, +0.0006] | +0.0017 [+0.0007, +0.0028] |
| q8 | PPP | 1127 | 0.2170 | -0.0379 | +0.0002 [+0.0000, +0.0003] | +0.0003 [+0.0003, +0.0004] |
| q7q8 | PPP | 1127 | 0.2166 | -0.0360 | -0.0002 [-0.0013, +0.0009] | +0.0022 [+0.0011, +0.0034] |

## Top decile by predicted G

| variant | head | bin | n | Σactual/Σpred | mean pred | mean actual |
|---|---|---|---|---|---|---|
| baseline | G | baseline-G top decile | 148 | 1.050 | 0.4440 | 0.4662 |
| baseline | A | baseline-G top decile | 148 | 1.898 | 0.3488 | 0.6622 |
| baseline | PPP | baseline-G top decile | 148 | 1.047 | 0.3099 | 0.3243 |
| baseline | G | own top decile | 148 | 1.050 | 0.4440 | 0.4662 |
| q7 | G | baseline-G top decile | 148 | 0.952 | 0.4895 | 0.4662 |
| q7 | A | baseline-G top decile | 148 | 1.783 | 0.3714 | 0.6622 |
| q7 | PPP | baseline-G top decile | 148 | 1.006 | 0.3223 | 0.3243 |
| q7 | G | own top decile | 148 | 0.937 | 0.4906 | 0.4595 |
| q8 | G | baseline-G top decile | 148 | 1.046 | 0.4457 | 0.4662 |
| q8 | A | baseline-G top decile | 148 | 1.888 | 0.3508 | 0.6622 |
| q8 | PPP | baseline-G top decile | 148 | 1.042 | 0.3113 | 0.3243 |
| q8 | G | own top decile | 148 | 1.061 | 0.4457 | 0.4730 |
| q7q8 | G | baseline-G top decile | 148 | 0.948 | 0.4918 | 0.4662 |
| q7q8 | A | baseline-G top decile | 148 | 1.770 | 0.3742 | 0.6622 |
| q7q8 | PPP | baseline-G top decile | 148 | 1.000 | 0.3243 | 0.3243 |
| q7q8 | G | own top decile | 148 | 0.932 | 0.4930 | 0.4595 |

## B2B team (stored team_rest_days = 1)

| variant | head | n | MAE | bias | ΔMAE [95% CI] | Δbias [95% CI] |
|---|---|---|---|---|---|---|
| baseline | G | 204 | 0.3057 | -0.0209 | — | — |
| q7 | G | 204 | 0.3053 | -0.0153 | -0.0004 [-0.0045, +0.0033] | +0.0056 [+0.0012, +0.0105] |
| q8 | G | 204 | 0.3051 | -0.0223 | -0.0006 [-0.0013, -0.0000] | -0.0013 [-0.0025, -0.0003] |
| q7q8 | G | 204 | 0.3043 | -0.0173 | -0.0014 [-0.0054, +0.0023] | +0.0037 [-0.0011, +0.0091] |
| baseline | A | 153 | 0.4303 | -0.2046 | — | — |
| q7 | A | 153 | 0.4295 | -0.2013 | -0.0009 [-0.0045, +0.0019] | +0.0033 [-0.0004, +0.0068] |
| q8 | A | 153 | 0.4297 | -0.2069 | -0.0006 [-0.0015, +0.0001] | -0.0023 [-0.0041, -0.0007] |
| q7q8 | A | 153 | 0.4286 | -0.2046 | -0.0017 [-0.0059, +0.0015] | -0.0000 [-0.0046, +0.0041] |
| baseline | PPP | 154 | 0.2342 | -0.0332 | — | — |
| q7 | PPP | 154 | 0.2319 | -0.0335 | -0.0022 [-0.0050, +0.0002] | -0.0003 [-0.0034, +0.0022] |
| q8 | PPP | 154 | 0.2336 | -0.0344 | -0.0006 [-0.0016, +0.0001] | -0.0012 [-0.0022, -0.0003] |
| q7q8 | PPP | 154 | 0.2311 | -0.0352 | -0.0031 [-0.0064, -0.0006] | -0.0020 [-0.0057, +0.0009] |

## B2B opponent (stored opponent_rest_days = 1)

| variant | head | n | MAE | bias | ΔMAE [95% CI] | Δbias [95% CI] |
|---|---|---|---|---|---|---|
| baseline | G | 206 | 0.3072 | -0.0267 | — | — |
| q7 | G | 206 | 0.3082 | -0.0190 | +0.0009 [-0.0023, +0.0041] | +0.0076 [+0.0018, +0.0134] |
| q8 | G | 206 | 0.3084 | -0.0241 | +0.0012 [+0.0008, +0.0017] | +0.0026 [+0.0019, +0.0034] |
| q7q8 | G | 206 | 0.3100 | -0.0152 | +0.0027 [-0.0004, +0.0060] | +0.0115 [+0.0054, +0.0176] |
| baseline | A | 155 | 0.4548 | -0.2468 | — | — |
| q7 | A | 155 | 0.4534 | -0.2397 | -0.0014 [-0.0053, +0.0015] | +0.0072 [+0.0006, +0.0143] |
| q8 | A | 155 | 0.4554 | -0.2429 | +0.0006 [-0.0004, +0.0016] | +0.0040 [+0.0028, +0.0053] |
| q7q8 | A | 155 | 0.4543 | -0.2338 | -0.0005 [-0.0052, +0.0031] | +0.0130 [+0.0054, +0.0214] |
| baseline | PPP | 156 | 0.2005 | -0.0028 | — | — |
| q7 | PPP | 156 | 0.2001 | -0.0005 | -0.0004 [-0.0033, +0.0030] | +0.0023 [-0.0016, +0.0067] |
| q8 | PPP | 156 | 0.2016 | -0.0006 | +0.0011 [+0.0004, +0.0019] | +0.0022 [+0.0016, +0.0030] |
| q7q8 | PPP | 156 | 0.2017 | +0.0026 | +0.0012 [-0.0022, +0.0053] | +0.0054 [+0.0012, +0.0105] |

## Stratum: stamped git_sha

_no rows_

## Stratum: null/local git_sha

| variant | head | n | MAE | bias | ΔMAE [95% CI] | Δbias [95% CI] |
|---|---|---|---|---|---|---|
| baseline | G | 1471 | 0.2966 | -0.0214 | — | — |
| q7 | G | 1471 | 0.2977 | -0.0149 | +0.0010 [-0.0003, +0.0023] | +0.0065 [+0.0049, +0.0081] |
| q8 | G | 1471 | 0.2969 | -0.0210 | +0.0002 [+0.0001, +0.0003] | +0.0004 [+0.0004, +0.0005] |
| q7q8 | G | 1471 | 0.2980 | -0.0143 | +0.0014 [+0.0000, +0.0027] | +0.0071 [+0.0055, +0.0088] |
| baseline | A | 1124 | 0.4156 | -0.2153 | — | — |
| q7 | A | 1124 | 0.4140 | -0.2103 | -0.0015 [-0.0029, -0.0002] | +0.0050 [+0.0031, +0.0069] |
| q8 | A | 1124 | 0.4156 | -0.2147 | +0.0001 [-0.0001, +0.0003] | +0.0006 [+0.0005, +0.0007] |
| q7q8 | A | 1124 | 0.4141 | -0.2095 | -0.0014 [-0.0028, +0.0000] | +0.0059 [+0.0039, +0.0078] |
| baseline | PPP | 1127 | 0.2168 | -0.0382 | — | — |
| q7 | PPP | 1127 | 0.2164 | -0.0365 | -0.0004 [-0.0015, +0.0006] | +0.0017 [+0.0007, +0.0028] |
| q8 | PPP | 1127 | 0.2170 | -0.0379 | +0.0002 [+0.0000, +0.0003] | +0.0003 [+0.0003, +0.0004] |
| q7q8 | PPP | 1127 | 0.2166 | -0.0360 | -0.0002 [-0.0013, +0.0009] | +0.0022 [+0.0011, +0.0034] |

