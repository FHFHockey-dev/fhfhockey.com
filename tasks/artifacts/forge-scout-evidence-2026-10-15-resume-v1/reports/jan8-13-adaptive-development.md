# January 8–13, 2026 adaptive development continuation

**One authorized six-day pass completed.** All first-pass forecasts and trials are preserved. This is exposed retrospective development, not an untouched evaluation or genuine historical as-of replay. No production promotion or change to today’s live capture.

The issued adaptive policy improved conditional skater TOI MSE by 5.112% against the fixed season-rate baseline, but worsened A by 3.946%, HIT by 3.488% and PIM by 0.480%. G, PPP, SOG and BLK stayed at baseline. These small, dependent development samples do not establish predictive qualification.

## Allocation and daily release

Independent metadata/code review preceded label decoding. Each date froze conditional forecasts for all 17 retained skaters and two goalies, including identities with no allocated outcome that day. Both feature history and adaptive-selection scores used only dates at least two calendar days earlier. Missing actuals do not become zeros.

| Historical day | History/selection through | Skater appearances | Positive-minute goalies | PPP labels | W labels |
|---|---|---:|---:|---:|---:|
| 2026-01-08 | 2026-01-06 | 14 | 1 | 1 | 0 |
| 2026-01-09 | 2026-01-07 | 2 | 0 | 0 | 0 |
| 2026-01-10 | 2026-01-08 | 14 | 0 | 1 | 0 |
| 2026-01-11 | 2026-01-09 | 2 | 0 | 0 | 0 |
| 2026-01-12 | 2026-01-10 | 12 | 1 | 1 | 1 |
| 2026-01-13 | 2026-01-11 | 11 | 0 | 0 | 0 |

Usable totals: 55 skater appearances across 16 players; three PPP labels from one player; two goalie appearances across two players; one verified start-conditioned W label. Two additional allocated goalie rows had explicit zero TOI and were excluded from positive-minute targets. These are not complete participation denominators.

Native reconciliation decoded only allocated same-day game bodies, including declared auxiliary co-player context; those additional players did not enter training, forecasts or scoring. January 14 onward remains reserved. Prior v1/v2/v3/v4 and COMP4 artifacts were read-only inputs or untouched. Receipt cutoff times remain separate from unknown original availability timestamps.

## What actually changed before subsequent predictions

| Day | Nonbaseline methods issued |
|---|---|
| 2026-01-08 | None; baseline for every supported head |
| 2026-01-09 | None; baseline for every supported head |
| 2026-01-10 | None; baseline for every supported head |
| 2026-01-11 | None; baseline for every supported head |
| 2026-01-12 | A: recent_.25; HIT: EB360; PIM: EB360 |
| 2026-01-13 | A: recent_.25; HIT: EB180; PIM: EB360; Skater TOI: recent_.5 |

Goalie tuple g000 and W expanding remained selected throughout. January 12 choices used only January 8–10 continuation scores; January 13 choices used only January 8–11. January 12–13 outcomes did not influence any issued method in this six-day pass. No first-pass forecast was replaced.

## Issued policy versus fixed baseline

| Target | Paired N | Baseline MSE | Issued MSE | MSE change | Issued MAE |
|---|---:|---:|---:|---:|---:|
| G | 55 | 0.189063 | 0.189063 | +0.000% | 0.349563 |
| A | 55 | 0.469355 | 0.487875 | +3.946% | 0.579879 |
| PPP | 3 | 0.005360 | 0.005360 | +0.000% | 0.073200 |
| SOG | 55 | 2.573847 | 2.573847 | +0.000% | 1.232762 |
| HIT | 55 | 0.806079 | 0.834193 | +3.488% | 0.714979 |
| BLK | 55 | 0.684049 | 0.684049 | +0.000% | 0.598184 |
| PIM | 55 | 3.866530 | 3.885108 | +0.480% | 0.854077 |
| Skater TOI | 55 | 6.606135 | 6.268459 | -5.112% | 1.999005 |

All issued policies have complete coverage on their original baseline-covered target keys. Reporting would withhold aggregate scores if an issued prediction were missing; denominators are not silently reduced.

## Every fixed skater candidate

MSE below is computed from each method’s preserved daily forecasts, not a rerun after seeing outcomes. Compare within a target; losses have different units across targets. PPP has only three labels. TOI EB60/EB360 are aliases excluded from the fixed budget.

| Method | G | A | PPP | SOG | HIT | BLK | PIM | TOI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| season_rate | 0.189063 | 0.469355 | 0.005360 | 2.573847 | 0.806079 | 0.684049 | 3.866530 | 6.606135 |
| recent_.25 | 0.196733 | 0.482179 | 0.003015 | 2.732286 | 0.802771 | 0.706161 | 3.795217 | 6.249667 |
| recent_.5 | 0.209112 | 0.510046 | 0.001340 | 3.022064 | 0.817140 | 0.749462 | 3.746903 | 6.024236 |
| recent_.75 | 0.226201 | 0.552956 | 0.000335 | 3.443181 | 0.849186 | 0.813954 | 3.721588 | 5.929840 |
| role_aware | 0.191439 | 0.464581 | 0.005201 | 2.596870 | 0.815001 | 0.693190 | 3.877862 | 5.966481 |
| EB60 | 0.190106 | 0.466132 | 0.005118 | 2.565026 | 0.804792 | 0.703069 | 3.873615 | — |
| EB180 | 0.188382 | 0.469481 | 0.004985 | 2.523402 | 0.791049 | 0.724931 | 3.867634 | 7.295315 |
| EB360 | 0.187159 | 0.474412 | 0.004842 | 2.491724 | 0.779936 | 0.758166 | 3.862381 | — |

Full MSE/RMSE/MAE/bias, every daily fold, coverage and every pass/fail guard are in results.json and each frozen daily selection audit. Any whole-block diagnostic winner in results.json is explicitly posthoc and was not substituted for the issued policy.

## Every coherent goalie candidate

The three binary digits encode recent-five weights for SA / minutes / save probability: 0 means full history; 1 means 25% recent blend. SV=SA*p, GA=SA−SV, SV%=p and GAA=60*GA/minutes for every tuple. No independent incoherent totals or ratios were selected.

| Tuple | SV MSE | GA MSE | SA MSE | Minutes MSE | Binomial loss | J |
|---|---:|---:|---:|---:|---:|---:|
| g000 | 244.129132 | 3.849553 | 297.034175 | 1289.381655 | 0.265351559 | 123.989343 |
| g001 | 238.175881 | 4.920858 | 297.034175 | 1289.381655 | 0.268249940 | 121.548369 |
| g010 | 244.129132 | 3.849553 | 297.034175 | 1239.412001 | 0.265351559 | 123.989343 |
| g011 | 238.175881 | 4.920858 | 297.034175 | 1239.412001 | 0.268249940 | 121.548369 |
| g100 | 231.272319 | 3.576424 | 279.966269 | 1289.381655 | 0.265351559 | 117.424372 |
| g101 | 225.746587 | 4.585443 | 279.966269 | 1289.381655 | 0.268249940 | 115.166015 |
| g110 | 231.272319 | 3.576424 | 279.966269 | 1239.412001 | 0.265351559 | 117.424372 |
| g111 | 225.746587 | 4.585443 | 279.966269 | 1239.412001 | 0.268249940 | 115.166015 |

Only two appearances are scored. One was an official starter with 8.4 minutes; the other played 60 minutes. The short appearance creates large workload errors, but does not justify a posthoc exclusion or model change. g111 is the existing current 25%-blend model. All eight tuples are reported; none met the minimum sample needed for adaptation. SV% and GAA diagnostics and exposure-adjusted GA Poisson deviance remain available in results.json.

## Every W candidate

| Method | N | Brier | Log loss |
|---|---:|---:|---:|
| expanding | 1 | 0.165981 | 0.523248 |
| pool5 | 1 | 0.171107 | 0.533841 |
| pool20 | 1 | 0.180126 | 0.552363 |

One verified label cannot support comparison or calibration claims; the other positive-minute goalie appearance lacked valid win credit. W is conditional on an official start and does not imply start probability.

## Interpretation and finite stop

Skater count/minute selection used MSE; W used Brier; goalie SA/minutes used MSE and save rate used shot-weighted binomial loss. Selection required at least 20 paired rows, two players and two nonempty daily folds, strict pooled improvement, improvement in half the days and a 25% daily regression bound. Goalie tuple selection additionally required pooled 2% and daily 25% component regression limits plus the 0.5% binomial guard. No thresholds or recipe budgets changed after labels opened.

Empirical training-only p10/p90 bands, support counts, fallback origins, and 0/1–4/5+ history strata are retained in forecasts and results; they are not calibrated intervals. Rookie, returning and trade qualification remain unverified. Prior-team differences are descriptive only. Older-season results do not establish this season’s new-player or role performance. No lineup-decision-value claim is supported by the incomplete participation/manager-roster frame.

Unsupported: SO, participation probability, goalie-start probability, PP role, strength-specific ice time and unconditional ice time. Supported-but-small: PPP, goalie components/ratios and W. Missing status stays distinct from zero.

The finite pass stops here. Do not extend dates, rerun forecasts, add candidates or consume January 14 onward without new direct authorization. Any further research should preregister its allocation and decision rule; the observed A/HIT/PIM regressions must remain in the record. No accepted live candidate or production deployment results from this report.

## Evidence

- [Protocol](protocol/PROTOCOL.md) and [exact allocation](protocol/allocation.json).
- [Independent execution gate](protocol/reviews/execution-gate.json).
- [Complete trial results](results.json) and [completion hashes](completion.json).
- Daily immutable artifacts under days/YYYY-MM-DD: predictions, freeze, materialization attempt, normalized records, native evidence, receipt, settlement and exposure record.
- [Live BLK continuity receipt](protocol/live-blk-continuity.json): unchanged 17:50 dispatch,18:15 cutoff,18:30 issuance Eastern. Future timely execution remains unverified.
- Independent post-run acceptance is a separate review receipt; this report alone does not confer acceptance.
