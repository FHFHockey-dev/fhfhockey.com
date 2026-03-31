# First xG Baseline Decision

Date: `2026-03-31`
Task: `8.1`

## Decision

- approved first baseline model: `none yet`

## Why No Baseline Is Approved Yet

The benchmark work is far enough along to identify an observed ranking, but not far enough to approve a baseline for integration.

Current observed ranking:

- provisional winner: `xgboost_js`
- provisional runner-up: `logistic_unregularized`

Current approval decision:

- no family is approved yet

## Blocking Reasons

### 1. The current feature contract is invalid for model selection

The saved benchmark still includes direct label leakage through `shotEventType:goal`.

That alone is enough to block approval because:

- it contaminates the raw ranking
- it contaminates the calibration experiments
- it disproportionately benefits the boosting family

### 2. The current holdout design is too weak for approval

The saved cohort has:

- `validation: 88`
- `test: 0`
- holdout positives: `5`

That is enough for exploratory comparisons, but not enough for an approval decision.

### 3. Important slice coverage is missing

The current holdout has no positive:

- rebound slice
- rush slice

So the current winner cannot be trusted across the exact contexts that matter most for shot-quality modeling.

## What This Means

- `xgboost_js` remains the observed benchmark leader, not the approved leader
- `logistic_unregularized` remains the most credible runner-up under the current flawed contract
- `logistic_l2` remains unapproved and currently weaker than both

## Required Correction Before Approval

The next approval candidate must be chosen only after:

1. removing `shotEventType:goal` from the baseline feature set
2. regenerating the baseline datasets under the repaired feature contract
3. rerunning all three families
4. rerunning the benchmark and calibration review
5. then making a fresh approval decision

## Consequence For The Remaining `8.x` Work

The rest of `8.x` should proceed as post-decision planning under the explicit state:

- no first baseline is approved yet
- further tuning work is allowed
- direct integration approval is still blocked pending the corrected rerun
