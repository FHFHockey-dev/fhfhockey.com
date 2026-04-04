# First xG Baseline Decision

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `1.5`
Scope: record a fresh first-baseline approval decision after the repaired benchmark and repaired calibration rerun.

## Decision

- approved first baseline model: `none yet`

## Why No Baseline Is Approved Yet

The repaired rerun is materially better than the original decision surface because the leaked current-shot event-class feature is gone.

But the repaired evidence still does not justify approval of any family for integration.

Current repaired observed ranking:

- by holdout log loss:
  - winner: `xgboost_js`
  - runner-up: `logistic_unregularized`
  - third: `logistic_l2`
- by holdout Brier score:
  - winner: `logistic_unregularized`
  - runner-up: `logistic_l2`
  - third: `xgboost_js`

Current approval decision:

- no family is approved yet

## Blocking Reasons

### 1. The repaired benchmark still does not identify a single robust winner

The repaired rerun splits the leaderboard by metric:

- `xgboost_js` leads holdout log loss
- `logistic_unregularized` leads holdout Brier score

That is enough to keep the result exploratory rather than approval-grade.

### 2. The repaired holdout design is still too weak for approval

The repaired cohort still has:

- `validation: 88`
- `test: 0`
- holdout positives: `5`

That remains too small and too weakly separated for a durable approval decision.

### 3. Important slice coverage is still missing

The repaired holdout still has no positive:

- rebound slice
- rush slice

So the current observed leaders still are not proven in some of the most important shot-quality contexts.

### 4. Calibration remains unresolved for approval use

The repaired calibration review is now leakage-free, but it still concludes:

- post-calibration is required for all three families
- `Platt` is the most credible observed method
- no calibrated method is yet adoptable

So baseline-family approval and calibration approval both remain open.

## What This Means

- `xgboost_js` remains the repaired observed log-loss leader, not the approved baseline
- `logistic_unregularized` remains the repaired observed Brier leader, not the approved baseline
- `logistic_l2` remains unapproved and still weaker than the other two on the repaired sample

## Required Work Before Approval

The next approval candidate should be chosen only after:

1. hardening the calibration decision path on the repaired contract
2. requiring a non-empty dedicated `test` split
3. setting minimum acceptance rules for holdout-positive and slice coverage
4. rerunning the benchmark under those stronger approval conditions

## Consequence For The Remaining Follow-Up Queue

The next block of work should proceed under the explicit state:

- no first baseline is approved yet
- the repaired rerun is the new canonical evidence set
- calibration hardening and stronger approval conditions now sit on the critical path
