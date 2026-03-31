# xG Possession-Chain Benchmark

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `3.2`
Scope: add possession-chain context features and benchmark their impact on the repaired 10-game baseline sample.

## Added Feature Surface

Derived possession-chain context now includes:

- `possessionSequenceId`
- `possessionEventCount`
- `possessionDurationSeconds`
- `possessionStartEventId`
- `possessionStartTypeDescKey`
- `possessionStartZoneCode`
- `possessionRegainedFromOpponent`
- `possessionRegainEventTypeDescKey`
- `possessionEnteredOffensiveZone`

Important boundary:

- these features are now available to the training harness
- they are not silently added to the default first-pass feature contract
- they were benchmarked through an explicit second-pass feature selection

## Possession-Chain Benchmark Configuration

Shared rerun sample:

- games: `2025021018, 2025021103, 2025021003, 2025021119, 2025021171, 2025021140, 2025020982, 2025021172, 2025021170, 2025021169`
- rows:
  - `shotRows: 391`
  - `eligibleRows: 298`
- split counts:
  - `train: 210`
  - `validation: 88`
  - `test: 0`

Second-pass feature additions used for the rerun:

- numeric:
  - `possessionEventCount`
  - `possessionDurationSeconds`
- boolean:
  - `possessionRegainedFromOpponent`
  - `possessionEnteredOffensiveZone`
- categorical:
  - `possessionStartTypeDescKey`
  - `possessionStartZoneCode`
  - `possessionRegainEventTypeDescKey`

New artifact tags:

- `logistic_unregularized-s20252026-p1-st1-f1-cfg7d2a5b84`
- `logistic_l2-s20252026-p1-st1-f1-cfg7d2a5b84`
- `xgboost_js-s20252026-p1-st1-f1-cfg7d2a5b84`

## Observed Impact

### `logistic_unregularized`

- previous repaired holdout:
  - `logLoss: 1.648442`
  - `Brier: 0.079545`
  - `avgPrediction: 0.022727`
- possession-chain rerun:
  - `logLoss: 1.177458`
  - `Brier: 0.056818`
  - `avgPrediction: 0`
- learned possession weights were non-zero, including:
  - `possessionEventCount: 0.398927`
  - `possessionRegainedFromOpponent: 0.269510`
  - `possessionEnteredOffensiveZone: -0.097818`
  - `possessionStartZoneCode:O: 0.372288`

### `logistic_l2`

- previous repaired holdout:
  - `logLoss: 1.883933`
  - `Brier: 0.090909`
  - `avgPrediction: 0.079545`
- possession-chain rerun:
  - `logLoss: 1.177458`
  - `Brier: 0.056818`
  - `avgPrediction: 0`
- learned possession weights were non-zero, including:
  - `possessionEventCount: 0.306677`
  - `possessionRegainedFromOpponent: 0.235136`
  - `possessionEnteredOffensiveZone: -0.082430`
  - `possessionStartZoneCode:O: 0.318931`

### `xgboost_js`

- previous repaired holdout:
  - `logLoss: 0.807738`
  - `Brier: 0.306537`
  - `avgPrediction: 0.560712`
- possession-chain rerun:
  - `logLoss: 0.768933`
  - `Brier: 0.287537`
  - `avgPrediction: 0.540135`
- observed possession feature importance:
  - `possessionEventCount: 14`
  - `possessionEnteredOffensiveZone: 1`
  - `possessionStartTypeDescKey:faceoff: 1`

## Interpretation

This rerun shows that possession-chain context is not inert on the current repaired sample.

Key read:

- both logistic families assigned non-zero weight to several possession fields
- the boosting family used `possessionEventCount` materially and showed a modest holdout improvement

But the benchmark is still not clean enough to treat this as approval evidence:

- `test` split is still empty
- holdout positives are still sparse
- positive rebound and rush holdout coverage are still absent

There is also an important quality note on the logistic reruns:

- the holdout metrics improved numerically
- but both logistic families still collapsed to `avgPrediction = 0` on holdout
- that means the numerical improvement is not yet a trustworthy sign of a healthy, adoptable model surface

## Conclusion

- possession-chain context is now implemented and available for explicit benchmark configs
- unlike richer rebound geometry, this feature family does show measurable activity on the current sample
- the clearest plausible gain is in `xgboost_js`, where `possessionEventCount` became a used feature and holdout metrics improved modestly
- the result is still exploratory rather than approval-grade because the benchmark package remains constrained by the current sample design

## Consequence For `3.3`

The next second-pass benchmark should proceed, with two lessons carried forward:

- possession-chain context is worth keeping in the candidate second-pass surface
- no second-pass uplift should be treated as approval-grade until the benchmark package has a dedicated `test` split and stronger positive slice coverage
