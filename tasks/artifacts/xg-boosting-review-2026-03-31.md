# xG Boosting Review - 2026-03-31

## Run Reference

- Artifact tag: `xgboost_js-s20252026-p1-st1-f1-cfg4c96cf20`
- Model artifact: `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/xgboost_js-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`
- Dataset artifact: `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/xgboost_js-s20252026-p1-st1-f1-cfg4c96cf20/dataset-artifact.json`
- Family: `xgboost_js`
- Fit options:
  - `learningRate: 0.1`
  - `maxDepth: 3`
  - `minChildWeight: 5`
  - `numRounds: 60`

## Feature Importance Behavior

- The saved feature-importance output is dominated by one feature:
  - `shotEventType:goal`
- Reported importance:
  - `shotEventType:goal = 60`
- The inspected next-highest features were effectively `0`.

Interpretation:

- the model is not discovering a broad, credible shot-quality structure yet
- it is relying overwhelmingly on a single leaked target-correlated feature

## Overfitting Risk

- Overfitting risk is currently high.
- The clearest evidence is the holdout probability pattern:
  - most holdout rows sit near `0.500225`
  - the positive cases are pushed into a much higher bin around `0.730882`
- That split looks better in log loss than the logistic runs, but it is not trustworthy because the top feature is label leakage.

Additional reasons the current boosting run is fragile:

- only `10` games were used
- holdout has `0` test rows
- positive rebound and positive rush holdout slices are absent
- the pure-JS implementation is useful for baselines, but it is not a mature production learner

## Calibration Behavior

- Holdout average prediction: `0.51333`
- Holdout goal rate: `0.056818`
- Holdout Brier score: `0.240122`

Interpretation:

- the model is severely miscalibrated on this sample
- it is assigning roughly 50 percent probability to a cohort with a true goal rate under 6 percent
- even where log loss looks better than the logistic runs, calibration is clearly poor

## Operational Tradeoffs

Advantages:

- integrates into the same baseline artifact contract as the logistic families
- pure JavaScript dependency, so no native build toolchain was needed
- provides model serialization and feature-importance output
- gives a realistic path for a tree-based baseline comparison without building a custom ensemble from scratch

Disadvantages:

- current benchmark is invalid until label leakage is removed
- calibration is poor on the current sample
- feature-importance surface is not credible yet because of leakage domination
- dependency installation altered the local npm tree substantially, which increases repo churn risk compared with the lighter logistic path

## Bottom Line

- The boosting path is operational and should stay in the baseline candidate set.
- The current saved boosting result should not be used as evidence that boosting is better than logistic.
- The next meaningful comparison requires:
  1. removing `shotEventType:goal` from the baseline training feature set
  2. rerunning all three baseline families
  3. re-evaluating performance, calibration, and feature-importance behavior on the corrected contract
