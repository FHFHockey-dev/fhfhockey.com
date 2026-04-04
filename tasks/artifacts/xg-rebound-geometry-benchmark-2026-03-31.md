# xG Rebound Geometry Benchmark

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `3.1`
Scope: add richer rebound geometry features and benchmark their impact on the repaired 10-game baseline sample.

## Added Feature Surface

Derived rebound geometry now includes:

- `reboundLateralDisplacementFeet`
- `reboundDistanceDeltaFeet`
- `reboundAngleChangeDegrees`

Important boundary:

- these features are now available to the training harness
- they are not silently added to the default first-pass numeric feature set
- they were benchmarked through an explicit second-pass numeric feature selection

## Rebound-Geometry Benchmark Configuration

Shared rerun sample:

- games: `2025021018, 2025021103, 2025021003, 2025021119, 2025021171, 2025021140, 2025020982, 2025021172, 2025021170, 2025021169`
- rows:
  - `shotRows: 391`
  - `eligibleRows: 298`
- split counts:
  - `train: 210`
  - `validation: 88`
  - `test: 0`

Second-pass numeric feature set used for the rerun:

- `reboundLateralDisplacementFeet`
- `reboundDistanceDeltaFeet`
- `reboundAngleChangeDegrees`
- `normalizedX`
- `normalizedY`
- `shotDistanceFeet`
- `shotAngleDegrees`
- `periodNumber`
- `periodSecondsElapsed`
- `gameSecondsElapsed`
- `timeSincePreviousEventSeconds`
- `distanceFromPreviousEvent`
- `ownerPowerPlayAgeSeconds`
- `shooterShiftAgeSeconds`
- `eastWestMovementFeet`
- `northSouthMovementFeet`

New artifact tags:

- `logistic_unregularized-s20252026-p1-st1-f1-cfge7ff9d85`
- `logistic_l2-s20252026-p1-st1-f1-cfge7ff9d85`
- `xgboost_js-s20252026-p1-st1-f1-cfge7ff9d85`

## Observed Impact

### `logistic_unregularized`

- previous holdout:
  - `logLoss: 1.648442`
  - `Brier: 0.079545`
- rebound-geometry rerun:
  - `logLoss: 1.648442`
  - `Brier: 0.079545`
- learned rebound weights:
  - `reboundLateralDisplacementFeet: 0`
  - `reboundDistanceDeltaFeet: 0`
  - `reboundAngleChangeDegrees: 0`

### `logistic_l2`

- previous holdout:
  - `logLoss: 1.883933`
  - `Brier: 0.090909`
- rebound-geometry rerun:
  - `logLoss: 1.883933`
  - `Brier: 0.090909`
- learned rebound weights:
  - `reboundLateralDisplacementFeet: 0`
  - `reboundDistanceDeltaFeet: 0`
  - `reboundAngleChangeDegrees: 0`

### `xgboost_js`

- previous holdout:
  - `logLoss: 0.807738`
  - `Brier: 0.306537`
- rebound-geometry rerun:
  - `logLoss: 0.807738`
  - `Brier: 0.306537`
- rebound feature importance:
  - `reboundLateralDisplacementFeet: 0`
  - `reboundDistanceDeltaFeet: 0`
  - `reboundAngleChangeDegrees: 0`

## Interpretation

This rerun shows no measurable impact on the current repaired benchmark sample.

The most likely reason is not that the features are invalid. It is that the benchmark package is still too weak for this specific feature family:

- the holdout still has no positive rebound coverage
- all current holdout rebound rows are effectively `non-rebound`
- the new rebound-geometry features therefore had no useful holdout slice in which to express signal

That reading is consistent with the model artifacts:

- logistic families assigned zero weight to all three new rebound geometry features
- the boosting family assigned zero feature importance to all three

## Conclusion

- richer rebound geometry is now implemented and available for explicit benchmark configs
- this 10-game repaired sample does not show measurable uplift from those features
- the result should be treated as inconclusive rather than negative because the benchmark package still lacks positive rebound holdout coverage

## Consequence For `3.2`

The next second-pass feature benchmark should proceed, but the broader lesson is now clear:

- second-pass feature evaluation needs stronger slice coverage before lack of observed uplift can be treated as meaningful evidence
