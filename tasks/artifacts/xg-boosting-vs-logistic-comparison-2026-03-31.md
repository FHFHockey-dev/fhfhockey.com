# xG Boosting vs Logistic Comparison - 2026-03-31

## Compared Artifacts

- Unregularized logistic:
  - `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_unregularized-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`
- L2 logistic:
  - `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_l2-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`
- XGBoost.js:
  - `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/xgboost_js-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`

## Shared Evaluation Contract

- Same validated 10-game cohort
- Same feature set
- Same row count: `298`
- Same split counts:
  - train: `210`
  - validation: `88`
  - test: `0`

## Holdout Comparison

### Unregularized logistic

- Holdout log loss: `1.177458`
- Holdout Brier: `0.056818`
- Holdout average prediction: `0`

### L2 logistic

- Holdout log loss: `1.883933`
- Holdout Brier: `0.090909`
- Holdout average prediction: `0.079545`

### XGBoost.js

- Holdout log loss: `0.672`
- Holdout Brier: `0.240122`
- Holdout average prediction: `0.51333`

## Strength-State Holdout Comparison

### EV

- Unregularized logistic:
  - log loss `1.315763`
  - Brier `0.063492`
- L2 logistic:
  - log loss `2.302585`
  - Brier `0.111111`
- XGBoost.js:
  - log loss `0.669464`
  - Brier `0.238936`

### PP

- Unregularized logistic:
  - log loss `1.036163`
  - Brier `0.05`
- L2 logistic:
  - log loss `1.036163`
  - Brier `0.05`
- XGBoost.js:
  - log loss `0.674592`
  - Brier `0.241335`

### SH

- Unregularized logistic:
  - log loss `0`
  - Brier `0`
- L2 logistic:
  - log loss `0`
  - Brier `0`
- XGBoost.js:
  - log loss `0.693597`
  - Brier `0.250225`

## Rebound / Rush Slices

- All three runs still only had `non-rebound` and `non-rush` holdout rows on this sample.
- So no model can yet be meaningfully ranked on positive rebound or positive rush holdout cases.

## Important Benchmark Validity Warning

This comparison is not a clean model-quality benchmark yet.

The current feature set includes `shotEventType`, whose levels include:

- `goal`
- `shot-on-goal`
- `missed-shot`

Because the label is defined as `isGoal` on the current shot row, the feature `shotEventType:goal` is direct label leakage.

Evidence from the saved XGBoost artifact:

- top feature importance is `shotEventType:goal`
- importance count: `60`
- all inspected next-highest features had `0` importance in the saved feature-importance output

That means the boosting model is exploiting the leaked target signal far more aggressively than the logistic baselines.

## Practical Interpretation

- If judged only by holdout log loss, XGBoost.js appears strongest.
- If judged by holdout Brier score, unregularized logistic appears strongest.
- But neither conclusion should be trusted yet because the current comparison contract is contaminated by target leakage.

## Correct Takeaway

- `xgboost_js` is now integrated and can be trained under the same artifact/evaluation contract.
- The saved comparison proves the boosting baseline path is operational.
- The current metric ranking should be treated as provisional until the label-leakage feature is removed from the baseline training set.

## Required Follow-Up

Before any winner is declared across logistic vs boosting:

1. remove `shotEventType:goal` label leakage from the baseline feature set
2. rerun all baseline families on the corrected feature contract
3. then compare holdout metrics again under the same contract
