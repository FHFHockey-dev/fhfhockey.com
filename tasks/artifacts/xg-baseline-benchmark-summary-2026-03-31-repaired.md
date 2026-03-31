# xG Baseline Benchmark Summary

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `1.4`
Scope: rerun the shared baseline benchmark on the repaired feature contract after removing leaked current-shot event-class features.

## Compared Families

- `logistic_unregularized`
- `logistic_l2`
- `xgboost_js`

Shared repaired contract:

- season scope: `20252026`
- version tuple: `parser=1`, `strength=1`, `feature=1`
- artifact tag suffix remains `cfg4c96cf20`
- split counts:
  - `train: 210`
  - `validation: 88`
  - `test: 0`

## Important Change From The Prior Benchmark

The repaired artifacts no longer contain:

- `shotEventType`
- `shotEventType:*`

The prior explicit label-leakage warning is gone from the rerun benchmark.

## Repaired Raw Holdout Ranking

### By holdout log loss

1. `xgboost_js` with `0.807738`
2. `logistic_unregularized` with `1.648442`
3. `logistic_l2` with `1.883933`

### By holdout Brier score

1. `logistic_unregularized` with `0.079545`
2. `logistic_l2` with `0.090909`
3. `xgboost_js` with `0.306537`

## Repaired Interpretation

- `xgboost_js` remains the observed log-loss leader after leakage removal
- `logistic_unregularized` remains the observed Brier leader
- `logistic_l2` remains third on log loss and second on Brier

So the benchmark still does not point to a single unambiguous winner under both metrics.

## Remaining Benchmark Warnings

The repaired rerun still has real benchmark limitations:

- dedicated `test` split is still empty
- positive rebound holdout coverage is absent
- positive rush holdout coverage is absent
- holdout positive-goal coverage remains thin

## Current Benchmark Conclusion

The repaired rerun is materially better than the leaked one because the most serious contract flaw is gone.

But it still does not justify baseline approval yet because:

- the sample is still too weak for approval-grade ranking
- the calibration question is still open
- the context-slice coverage is still incomplete

## Consequence For `1.5`

The next approval decision should use:

- this repaired benchmark artifact
- the repaired calibration review artifact

and should remain conservative unless the remaining sample-design blockers are explicitly accepted.
