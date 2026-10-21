# FORGE reconstruction backtest (variants a, b, a0, b0)

a = master; b = master + sidecar hydration; a0 = a without the R18 ES-assist refit; b0 = b without R18.
Games in all four variants only; dressed player-games (actual row present). Seed 1, 2000 paired cluster-bootstrap reps by game_id; Δ = first minus second variant.

## Inputs

| input | path | sha256 |
|---|---|---|
| captures a (62 files) | <scratchpad>/recon/out/a | 2c5788096dfc93a0ec941736bd03b4eb3329e592f8a6f1e214e1db22bf360358 |
| captures b (62 files) | <scratchpad>/recon/out/b | ead6be1bf48b6a70a62830d4bcf0f212e3efe39e23eaef074d6917b81f26def4 |
| captures a0 (62 files) | <scratchpad>/recon/out/a0 | 9eb570bc7773b52c025a1993fe6889c21b32074d9cea0402236f9c5b0ea67684 |
| captures b0 (62 files) | <scratchpad>/recon/out/b0 | 592f46908a81e4e182da232cafc9b55440cb2fbe8dee7475818ae08d047a844b |
| actuals | <scratchpad>/cohort/s3_actuals.json | 6b945b5ada044c934e1cb5e05587d424e5c172ec03933de0cf5d3fa61c53ceab |
| hits-blocks | <scratchpad>/cohort/s9_hits_blocks.json | aab787fa586a7e87fc426030f75bc6f91fa55f32214be624ccb0f66fc8b9aea8 |

Games kept: 62; dropped (not in all four variants): none.

## Metrics per variant

| variant | head | n | MAE | bias | RMSE |
|---|---|---|---|---|---|
| a | G | 2074 | 0.2844 | -0.0248 | 0.4535 |
| b | G | 2074 | 0.2806 | -0.0074 | 0.4440 |
| a0 | G | 2074 | 0.2844 | -0.0248 | 0.4535 |
| b0 | G | 2074 | 0.2806 | -0.0074 | 0.4440 |
| a | A | 2074 | 0.3873 | -0.0953 | 0.5734 |
| b | A | 2074 | 0.3826 | -0.0733 | 0.5598 |
| a0 | A | 2074 | 0.3505 | -0.1796 | 0.5978 |
| b0 | A | 2074 | 0.3463 | -0.1670 | 0.5849 |
| a | PPP | 2074 | 0.1653 | -0.0289 | 0.3485 |
| b | PPP | 2074 | 0.1653 | -0.0193 | 0.3464 |
| a0 | PPP | 2074 | 0.1652 | -0.0294 | 0.3489 |
| b0 | PPP | 2074 | 0.1673 | -0.0159 | 0.3474 |
| a | SOG | 2074 | 1.0913 | -0.1045 | 1.4208 |
| b | SOG | 2074 | 1.0907 | -0.1000 | 1.4176 |
| a0 | SOG | 2074 | 1.0913 | -0.1045 | 1.4208 |
| b0 | SOG | 2074 | 1.0907 | -0.1000 | 1.4176 |
| a | HIT | 2074 | 1.1437 | -0.2317 | 1.6508 |
| b | HIT | 2074 | 1.0630 | +0.2616 | 1.4689 |
| a0 | HIT | 2074 | 1.1437 | -0.2317 | 1.6508 |
| b0 | HIT | 2074 | 1.0630 | +0.2616 | 1.4689 |
| a | BLK | 2074 | 0.8443 | -0.3225 | 1.2684 |
| b | BLK | 2074 | 0.8160 | -0.0097 | 1.1532 |
| a0 | BLK | 2074 | 0.8443 | -0.3225 | 1.2684 |
| b0 | BLK | 2074 | 0.8160 | -0.0097 | 1.1532 |

## Paired deltas

| pair | effect | head | n | ΔMAE [95% CI] | Δbias [95% CI] | ΔRMSE [95% CI] |
|---|---|---|---|---|---|---|
| b vs a | hydration effect, R18 on | G | 2074 | -0.0038 [-0.0070, -0.0006] | +0.0174 [+0.0153, +0.0197] | -0.0095 [-0.0139, -0.0050] |
| b vs a | hydration effect, R18 on | A | 2074 | -0.0048 [-0.0082, -0.0013] | +0.0219 [+0.0183, +0.0258] | -0.0136 [-0.0204, -0.0071] |
| b vs a | hydration effect, R18 on | PPP | 2074 | +0.0000 [-0.0027, +0.0026] | +0.0096 [+0.0079, +0.0113] | -0.0020 [-0.0065, +0.0030] |
| b vs a | hydration effect, R18 on | SOG | 2074 | -0.0006 [-0.0186, +0.0159] | +0.0045 [+0.0022, +0.0071] | -0.0032 [-0.0270, +0.0187] |
| b vs a | hydration effect, R18 on | HIT | 2074 | -0.0807 [-0.1125, -0.0511] | +0.4933 [+0.3984, +0.5836] | -0.1819 [-0.2312, -0.1341] |
| b vs a | hydration effect, R18 on | BLK | 2074 | -0.0283 [-0.0543, -0.0030] | +0.3128 [+0.2552, +0.3682] | -0.1152 [-0.1626, -0.0718] |
| b0 vs a0 | hydration effect, R18 off | G | 2074 | -0.0038 [-0.0070, -0.0006] | +0.0174 [+0.0153, +0.0197] | -0.0095 [-0.0139, -0.0050] |
| b0 vs a0 | hydration effect, R18 off | A | 2074 | -0.0042 [-0.0062, -0.0021] | +0.0126 [+0.0104, +0.0149] | -0.0129 [-0.0169, -0.0088] |
| b0 vs a0 | hydration effect, R18 off | PPP | 2074 | +0.0021 [-0.0010, +0.0051] | +0.0135 [+0.0115, +0.0155] | -0.0015 [-0.0068, +0.0044] |
| b0 vs a0 | hydration effect, R18 off | SOG | 2074 | -0.0006 [-0.0186, +0.0159] | +0.0045 [+0.0022, +0.0071] | -0.0032 [-0.0270, +0.0187] |
| b0 vs a0 | hydration effect, R18 off | HIT | 2074 | -0.0807 [-0.1125, -0.0511] | +0.4933 [+0.3984, +0.5836] | -0.1819 [-0.2312, -0.1341] |
| b0 vs a0 | hydration effect, R18 off | BLK | 2074 | -0.0283 [-0.0543, -0.0030] | +0.3128 [+0.2552, +0.3682] | -0.1152 [-0.1626, -0.0718] |
| a vs a0 | R18 effect without hydration | G | 2074 | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] |
| a vs a0 | R18 effect without hydration | A | 2074 | +0.0368 [+0.0331, +0.0404] | +0.0843 [+0.0813, +0.0873] | -0.0244 [-0.0280, -0.0209] |
| a vs a0 | R18 effect without hydration | PPP | 2074 | +0.0001 [-0.0002, +0.0003] | +0.0004 [+0.0001, +0.0008] | -0.0004 [-0.0007, -0.0002] |
| a vs a0 | R18 effect without hydration | SOG | 2074 | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] |
| a vs a0 | R18 effect without hydration | HIT | 2074 | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] |
| a vs a0 | R18 effect without hydration | BLK | 2074 | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] |
| b vs b0 | R18 effect with hydration | G | 2074 | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] |
| b vs b0 | R18 effect with hydration | A | 2074 | +0.0362 [+0.0317, +0.0408] | +0.0936 [+0.0896, +0.0979] | -0.0251 [-0.0308, -0.0195] |
| b vs b0 | R18 effect with hydration | PPP | 2074 | -0.0020 [-0.0026, -0.0014] | -0.0035 [-0.0039, -0.0031] | -0.0009 [-0.0020, +0.0001] |
| b vs b0 | R18 effect with hydration | SOG | 2074 | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] |
| b vs b0 | R18 effect with hydration | HIT | 2074 | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] |
| b vs b0 | R18 effect with hydration | BLK | 2074 | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] | +0.0000 [+0.0000, +0.0000] |

## Top-decile calibration (bins fixed by variant a predicted G)

| variant | head | bin | n | Σactual/Σpred | mean pred | mean actual |
|---|---|---|---|---|---|---|
| a | G | variant-a G top decile | 208 | 1.304 | 0.2949 | 0.3846 |
| a | A | variant-a G top decile | 208 | 1.637 | 0.3760 | 0.6154 |
| a | PPP | variant-a G top decile | 208 | 1.286 | 0.2430 | 0.3125 |
| a | SOG | variant-a G top decile | 208 | 1.033 | 2.5687 | 2.6538 |
| a | HIT | variant-a G top decile | 208 | 0.900 | 0.8173 | 0.7356 |
| a | BLK | variant-a G top decile | 208 | 1.681 | 0.4606 | 0.7740 |
| a | G | own top decile | 208 | 1.304 | 0.2949 | 0.3846 |
| b | G | variant-a G top decile | 208 | 0.917 | 0.4195 | 0.3846 |
| b | A | variant-a G top decile | 208 | 1.174 | 0.5241 | 0.6154 |
| b | PPP | variant-a G top decile | 208 | 0.958 | 0.3263 | 0.3125 |
| b | SOG | variant-a G top decile | 208 | 0.893 | 2.9707 | 2.6538 |
| b | HIT | variant-a G top decile | 208 | 0.636 | 1.1563 | 0.7356 |
| b | BLK | variant-a G top decile | 208 | 0.824 | 0.9396 | 0.7740 |
| b | G | own top decile | 208 | 0.934 | 0.4789 | 0.4471 |
| a0 | G | variant-a G top decile | 208 | 1.304 | 0.2949 | 0.3846 |
| a0 | A | variant-a G top decile | 208 | 2.524 | 0.2438 | 0.6154 |
| a0 | PPP | variant-a G top decile | 208 | 1.294 | 0.2415 | 0.3125 |
| a0 | SOG | variant-a G top decile | 208 | 1.033 | 2.5687 | 2.6538 |
| a0 | HIT | variant-a G top decile | 208 | 0.900 | 0.8173 | 0.7356 |
| a0 | BLK | variant-a G top decile | 208 | 1.681 | 0.4606 | 0.7740 |
| a0 | G | own top decile | 208 | 1.304 | 0.2949 | 0.3846 |
| b0 | G | variant-a G top decile | 208 | 0.917 | 0.4195 | 0.3846 |
| b0 | A | variant-a G top decile | 208 | 1.827 | 0.3368 | 0.6154 |
| b0 | PPP | variant-a G top decile | 208 | 0.926 | 0.3376 | 0.3125 |
| b0 | SOG | variant-a G top decile | 208 | 0.893 | 2.9707 | 2.6538 |
| b0 | HIT | variant-a G top decile | 208 | 0.636 | 1.1563 | 0.7356 |
| b0 | BLK | variant-a G top decile | 208 | 0.824 | 0.9396 | 0.7740 |
| b0 | G | own top decile | 208 | 0.934 | 0.4789 | 0.4471 |

## Check counts

| check | count |
|---|---|
| drop_no_actual_not_dressed | 124 |
| games_dropped | 0 |
| games_kept | 62 |
| player_games_projected_a | 2198 |
| rows_used | 2074 |
