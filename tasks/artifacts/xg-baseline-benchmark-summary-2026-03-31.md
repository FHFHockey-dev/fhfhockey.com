# xG Baseline Benchmark Summary

Date: `2026-03-31`
Task: `7.3`

## Compared Families

- `logistic_unregularized`
- `logistic_l2`
- `xgboost_js`

All three were evaluated on the same saved artifact contract:

- season scope: `20252026`
- version tuple: `parser=1`, `strength=1`, `feature=1`
- config signature: `cfg4c96cf20`
- split counts:
  - `train: 210`
  - `validation: 88`
  - `test: 0`

## Observed Ranking

### By raw holdout log loss

1. `xgboost_js` with `0.672`
2. `logistic_unregularized` with `1.177458`
3. `logistic_l2` with `1.883933`

### By raw holdout Brier score

1. `logistic_unregularized` with `0.056818`
2. `logistic_l2` with `0.090909`
3. `xgboost_js` with `0.240122`

## Provisional Winner And Runner-Up

- provisional winner on the currently observed benchmark: `xgboost_js`
- provisional runner-up: `logistic_unregularized`

This is only an observed ranking, not an approval decision.

## Calibration Outcomes

### `logistic_unregularized`

- raw holdout:
  - `logLoss: 1.177458`
  - `Brier: 0.056818`
- best observed calibration method: `Platt`
  - `logLoss: 0.218134`
  - `Brier: 0.053591`
- calibration interpretation:
  - calibration helps materially because the raw model collapses near zero
  - but the family still starts from a weak underlying fit

### `logistic_l2`

- raw holdout:
  - `logLoss: 1.883933`
  - `Brier: 0.090909`
- best observed calibration method: `Platt`
  - `logLoss: 0.213337`
  - `Brier: 0.05595`
- calibration interpretation:
  - calibration clearly helps
  - but this family still trails the unregularized run on the raw benchmark and shows unstable behavior on this small sample

### `xgboost_js`

- raw holdout:
  - `logLoss: 0.672`
  - `Brier: 0.240122`
- best observed calibration method: `isotonic`
  - `logLoss: 0`
  - `Brier: 0`
- calibration interpretation:
  - the perfect isotonic result is not trustworthy
  - it is best read as leakage-shaped overfit on a tiny holdout, not as a real production-ready calibration win

## Why No Family Is Approved Yet

No family is approved as the first xG baseline yet.

The main reasons are:

- the current feature set still includes direct label leakage through `shotEventType:goal`
- the saved benchmark has no dedicated `test` split
- holdout positive-goal coverage is sparse: `5` goals in `88` holdout rows
- rebound and rush positive holdout slices are absent, so slice robustness cannot be judged yet

## Rejection Reasons By Family

### `xgboost_js`

Observed status:

- best raw holdout log loss
- worst raw Brier score
- strongest apparent uplift after calibration

Current rejection reason:

- rejected for approval because the family is the most obviously contaminated by the leaked `shotEventType:goal` feature
- the saved feature-importance output is dominated by `shotEventType:goal`
- the calibration story is not trustworthy because the raw fit itself is leakage-driven

### `logistic_unregularized`

Observed status:

- runner-up on raw holdout log loss
- best raw Brier score
- best credible exploratory calibration result via `Platt`

Current rejection reason:

- rejected for approval because the raw fit collapses to near-zero probabilities
- calibration improves the numbers, but those improvements are still measured on a leaked, test-free contract
- it is not strong enough to be declared the winner before the feature contract is repaired

### `logistic_l2`

Observed status:

- weakest raw holdout log loss
- middle raw Brier score
- calibration improves the family but does not repair the underlying ranking problem

Current rejection reason:

- rejected for approval because it is weaker than the other two families on the current raw benchmark
- it shows unstable high-confidence behavior on this small sample
- it has no compensating operational advantage strong enough to justify approval right now

## Decision For `8.0`

Current benchmark conclusion:

- there is a provisional observed winner: `xgboost_js`
- there is a provisional runner-up: `logistic_unregularized`
- there is no approved first baseline yet because the benchmark contract is still invalidated by label leakage and weak holdout design

Required next correction before choosing the first approved baseline:

1. remove `shotEventType:goal` from the baseline feature set
2. rerun all three families on the repaired feature contract
3. rerun the shared benchmark and calibration review
4. only then record the first approved baseline decision
