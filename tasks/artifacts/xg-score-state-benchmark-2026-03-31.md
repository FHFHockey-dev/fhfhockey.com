# xG Score-State Benchmark

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `3.3`
Scope: add pre-shot score-state context features and benchmark their impact on the repaired 10-game baseline sample.

## Added Feature Surface

Derived pre-shot score-state context now includes:

- `homeScoreBeforeEvent`
- `awayScoreBeforeEvent`
- `homeScoreDiffBeforeEvent`
- `awayScoreDiffBeforeEvent`
- `ownerScoreDiffBeforeEvent`
- `ownerScoreDiffBucket`
- `isLateGameClose`
- `isLateGameTrailing`

Important boundary:

- these values are computed from the running pre-event scoreboard
- goal events do not see their own post-goal score update
- these features are available to the training harness, but they are not silently added to the default first-pass feature contract

## Score-State Benchmark Configuration

Shared rerun sample:

- games: `2025021018, 2025021103, 2025021003, 2025021119, 2025021171, 2025021140, 2025020982, 2025021172, 2025021170, 2025021169`
- rows:
  - `shotRows: 391`
  - `eligibleRows: 298`
- split counts:
  - `train: 210`
  - `validation: 88`
  - `test: 0`

Explicit score-state feature additions used for the rerun:

- numeric:
  - `homeScoreDiffBeforeEvent`
  - `awayScoreDiffBeforeEvent`
  - `ownerScoreDiffBeforeEvent`
- boolean:
  - `isLateGameClose`
  - `isLateGameTrailing`
- categorical:
  - `ownerScoreDiffBucket`

New artifact tags:

- `logistic_unregularized-s20252026-p1-st1-f1-cfgeb4c00bd`
- `logistic_l2-s20252026-p1-st1-f1-cfgeb4c00bd`
- `xgboost_js-s20252026-p1-st1-f1-cfgeb4c00bd`

## Observed Impact

### `logistic_unregularized`

- previous repaired holdout:
  - `logLoss: 1.648442`
  - `Brier: 0.079545`
  - `avgPrediction: 0.022727`
- score-state rerun:
  - `logLoss: 1.883934`
  - `Brier: 0.090909`
  - `avgPrediction: 0.079547`
- score-state made this family worse on the current sample
- learned score-state weights were non-zero, especially:
  - `ownerScoreDiffBeforeEvent: -0.583893`
  - `ownerScoreDiffBucket:trail-1: -0.651263`
  - `homeScoreDiffBeforeEvent: 0.392030`

### `logistic_l2`

- previous repaired holdout:
  - `logLoss: 1.883933`
  - `Brier: 0.090909`
  - `avgPrediction: 0.079545`
- score-state rerun:
  - `logLoss: 1.412950`
  - `Brier: 0.068182`
  - `avgPrediction: 0.011364`
- score-state improved this family materially on the current sample
- learned score-state weights were non-zero, especially:
  - `ownerScoreDiffBeforeEvent: -0.507716`
  - `ownerScoreDiffBucket:trail-1: -0.558079`
  - `homeScoreDiffBeforeEvent: 0.317278`

### `xgboost_js`

- previous repaired holdout:
  - `logLoss: 0.807738`
  - `Brier: 0.306537`
  - `avgPrediction: 0.560712`
- score-state rerun:
  - `logLoss: 0.787089`
  - `Brier: 0.296384`
  - `avgPrediction: 0.549954`
- score-state improved this family modestly on the current sample
- observed score-state feature importance:
  - `ownerScoreDiffBeforeEvent: 22`
  - `homeScoreDiffBeforeEvent: 11`
  - `awayScoreDiffBeforeEvent: 8`
- the late-game flags and categorical score buckets did not register meaningful importance in this rerun

## Interpretation

This rerun shows that score-state context is active, but uneven across model families.

Key read:

- owner-relative score differential is the strongest score-state signal in the current sample
- late-game interaction flags did not matter here
- the feature family helped `logistic_l2` and `xgboost_js`
- it hurt `logistic_unregularized`

That makes the correct conclusion narrower than "score-state always helps":

- score-state context looks worth keeping in the second-pass candidate surface
- but the benefit appears to depend on model family and regularization behavior

The benchmark still is not approval-grade because the same sample-design blockers remain:

- `test` split is still empty
- holdout positives are still sparse
- positive rebound and rush holdout coverage are still absent

## Conclusion

- pre-shot score-state context is now implemented and label-clean
- the strongest usable signal on this sample is `ownerScoreDiffBeforeEvent`
- score-state context looks promising for `logistic_l2` and `xgboost_js`
- score-state context does not rescue `logistic_unregularized`
- this should be treated as exploratory evidence for the second-pass surface, not as approval-grade model selection evidence

## Consequence For `3.4`

The next second-pass feature benchmark should proceed, with one important takeaway:

- score-state should stay in the candidate expanded feature family, but future approval work should emphasize regularized or boosted families rather than assuming the unregularized baseline remains the right comparison surface
