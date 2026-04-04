# xG Handedness Benchmark

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `3.4`
Scope: add shooter/goalie handedness joins and benchmark their impact on the repaired 10-game baseline sample.

## Added Feature Surface

Training-time handedness enrichment now joins season-scoped hand values from:

- `player_stats_unified` for shooter hand
- `goalie_stats_unified` for goalie catch hand

The join uses `player_id` plus `season_id`, taking the latest non-null `shoots_catches` value within the selected season.

New categorical features now available to the training harness:

- `shooterHandedness`
- `goalieCatchHand`
- `shooterGoalieHandednessMatchup`

Important boundary:

- these values are enriched in the training path, not silently injected into the default first-pass feature set
- the current benchmark used them only through explicit categorical feature selection

## Handedness Benchmark Configuration

Shared rerun sample:

- games: `2025021018, 2025021103, 2025021003, 2025021119, 2025021171, 2025021140, 2025020982, 2025021172, 2025021170, 2025021169`
- rows:
  - `shotRows: 391`
  - `eligibleRows: 298`
- split counts:
  - `train: 210`
  - `validation: 88`
  - `test: 0`

Explicit handedness feature additions used for the rerun:

- categorical:
  - `shooterHandedness`
  - `goalieCatchHand`
  - `shooterGoalieHandednessMatchup`

Shared categorical set for the rerun:

- `shotType`
- `strengthState`
- `strengthExact`
- `zoneCode`
- `previousEventTypeDescKey`
- `missReasonBucket`
- `shooterHandedness`
- `goalieCatchHand`
- `shooterGoalieHandednessMatchup`

New artifact tags:

- `logistic_unregularized-s20252026-p1-st1-f1-cfg9472e659`
- `logistic_l2-s20252026-p1-st1-f1-cfg9472e659`
- `xgboost_js-s20252026-p1-st1-f1-cfg9472e659`

## Observed Impact

### `logistic_unregularized`

- previous repaired holdout:
  - `logLoss: 1.648442`
  - `Brier: 0.079545`
  - `avgPrediction: 0.022727`
- handedness rerun:
  - `logLoss: 16.340443`
  - `Brier: 0.795454`
  - `avgPrediction: 0.852273`
- handedness made this family dramatically worse on the current sample
- the model learned non-zero handedness weights, but they did not help:
  - `shooterHandedness:L: -0.265759`
  - `shooterHandedness:R: 0.054190`
  - `goalieCatchHand:L: 0.033220`
  - `shooterGoalieHandednessMatchup:opposite-hand: 0.055261`
  - `shooterGoalieHandednessMatchup:same-hand: -0.265759`

### `logistic_l2`

- previous repaired holdout:
  - `logLoss: 1.883933`
  - `Brier: 0.090909`
  - `avgPrediction: 0.079545`
- handedness rerun:
  - `logLoss: 1.883933`
  - `Brier: 0.090909`
  - `avgPrediction: 0.079545`
- handedness had no measurable holdout effect on this family
- learned handedness weights were real but small and non-decisive:
  - `shooterHandedness:L: -0.221029`
  - `shooterHandedness:R: 0.048560`
  - `goalieCatchHand:L: 0.031999`
  - `shooterGoalieHandednessMatchup:opposite-hand: 0.049452`
  - `shooterGoalieHandednessMatchup:same-hand: -0.221029`

### `xgboost_js`

- previous repaired holdout:
  - `logLoss: 0.807738`
  - `Brier: 0.306537`
  - `avgPrediction: 0.560712`
- handedness rerun:
  - `logLoss: 0.818224`
  - `Brier: 0.311396`
  - `avgPrediction: 0.563703`
- handedness made this family slightly worse on the current sample
- observed handedness feature importance was effectively absent:
  - `shooterHandedness:L: 0`
  - `goalieCatchHand:L: 0`
  - `shooterGoalieHandednessMatchup:same-hand: 0`
  - the companion one-hot columns were `null`/unused in the saved importance vector

## Interpretation

This rerun does not show evidence that handedness improves the current repaired benchmark.

Key read:

- the join itself works and the enriched features are present in saved artifacts
- `xgboost_js` treated the handedness surface as effectively inert
- `logistic_l2` tolerated the added columns but did not benefit from them
- `logistic_unregularized` became materially less stable with the extra categorical surface

That makes the correct conclusion narrower than "handedness never matters":

- handedness joins are now available for later ablation work
- this sample provides no approval-grade evidence that they help
- the current signal is weak enough that handedness should remain optional, not promoted into the stronger candidate set yet

The benchmark still is not approval-grade because the same sample-design blockers remain:

- `test` split is still empty
- holdout positives are still sparse
- positive rebound and rush holdout coverage are still absent

## Conclusion

- shooter and goalie handedness joins are now implemented in the training harness
- the new handedness categorical features did not improve the repaired benchmark on this sample
- `xgboost_js` effectively ignored them
- `logistic_l2` showed no measurable change
- `logistic_unregularized` got much worse
- handedness should stay available as optional context, but it does not earn promotion in the second-pass candidate set from this rerun

## Consequence For `3.5`

The next second-pass feature benchmark should move to roster-position context rather than spending more time on handedness tuning in this sample regime.
