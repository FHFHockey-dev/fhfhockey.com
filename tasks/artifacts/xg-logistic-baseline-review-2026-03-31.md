# xG Logistic Baseline Review - 2026-03-31

## Run Reference

- Artifact tag: `logistic_unregularized-s20252026-p1-st1-f1-cfg4c96cf20`
- Model artifact: `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_unregularized-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`
- Dataset artifact: `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_unregularized-s20252026-p1-st1-f1-cfg4c96cf20/dataset-artifact.json`
- Cohort: 2025-2026 unblocked shot attempts from the validated 10-game sample
- Version tuple: `parser=1`, `strength=1`, `feature=1`

## Dataset Shape

- Games: `10`
- Total shot-feature rows loaded: `391`
- Eligible baseline rows: `298`
- Split counts:
  - Train: `210`
  - Validation: `88`
  - Test: `0`

## Strengths

- The full training path now works end to end on validated NHL-derived rows.
- Dataset and model artifacts are versioned, reproducible, and carry lineage metadata.
- Holdout reporting now exists for:
  - overall holdout
  - strength-state slices
  - rebound slices
  - rush slices
- The saved artifact proves that baseline comparisons can now run on a stable contract rather than ad hoc scripts.

## Weaknesses

- This first unregularized logistic fit is degenerate on the sampled cohort.
- Average prediction is effectively `0` across train and holdout reporting.
- Calibration collapses into the first probability bin only.
- Holdout quality is not trustworthy yet as a model benchmark because:
  - there are `0` test rows in this split
  - rebound holdout has only `non-rebound` rows
  - rush holdout has only `non-rush` rows

## Obvious Feature / Modeling Gaps

- Feature scaling is absent. Large-magnitude numeric inputs are likely dominating optimization.
- Training optimization is too naive for the current feature mix:
  - zero initialization
  - fixed learning rate
  - no normalization
  - no convergence diagnostics
- The current 10-game sample is too small and too sparse for meaningful rush/rebound slice evaluation.
- Categorical expansion is working, but the current sample likely underpopulates several levels, which weakens early coefficient estimates.
- We do not yet report coefficient ranking or feature-effect inspection, so diagnosing failure modes still requires manual artifact inspection.

## Recommended Next Moves

1. Keep this run as the baseline "plumbing works" artifact, not as a serious performance benchmark.
2. In the next baseline task, document this model as operationally complete but statistically weak.
3. Before treating logistic results as meaningful, add at least:
   - feature scaling
   - larger cohort coverage
   - explicit coefficient inspection output
4. Compare the regularized logistic baseline against this run only after the evaluation contract is identical.
