# xG Calibration Path Decision

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `2.2`
Scope: choose the first calibration path to carry forward after the repaired leakage-free rerun.

## Decision

- first candidate calibration approach: `Platt`

## What This Decision Means

`Platt` is the first calibration family that should be carried forward into the approval-grade benchmark flow.

This does **not** mean:

- `Platt` is already approved for production use
- `Platt` is already the final adopted calibration layer
- the current repaired sample is strong enough to lock the calibration question

It only means:

- `Platt` is the most credible first path for the next approval pass

## Why `Platt` Was Chosen

On the repaired rerun, `Platt` was the most consistent observed method across all three baseline families:

- `logistic_unregularized`
  - raw `logLoss: 1.648442`
  - `Platt logLoss: 0.284088`
- `logistic_l2`
  - raw `logLoss: 1.883933`
  - `Platt logLoss: 0.213337`
- `xgboost_js`
  - raw `logLoss: 0.807738`
  - `Platt logLoss: 0.226436`

Compared with `isotonic`:

- `Platt` was the best observed method for all three repaired families
- `isotonic` remained more sample-sensitive and less stable on sparse positives
- `Platt` is the cleaner first choice for a stricter rerun with better holdout design

## Why This Is Still Not Adoption

The repaired benchmark package still has approval blockers:

- no dedicated `test` split
- only `5` positive holdout goals in `88` holdout examples
- no positive rebound holdout coverage
- no positive rush holdout coverage

So the correct boundary is:

- `Platt` is chosen as the next candidate path
- `Platt` is not yet approved as the adopted calibration layer

## Consequence For The Next Steps

The next calibration work should proceed in this order:

1. require a non-empty dedicated `test` split
2. add minimum holdout-positive and slice-coverage acceptance rules
3. rerun the benchmark with `Platt` as the primary calibration candidate
4. only then decide whether `Platt` becomes the first adoptable calibration method
