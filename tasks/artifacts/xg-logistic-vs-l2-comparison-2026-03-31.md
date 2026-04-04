# xG Logistic vs L2 Logistic Comparison - 2026-03-31

## Compared Artifacts

- Unregularized:
  - `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_unregularized-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`
- L2 regularized:
  - `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_l2-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`

## Shared Run Contract

- Cohort: validated 10-game March 31 training sample
- Eligible rows: `298`
- Split counts:
  - train: `210`
  - validation: `88`
  - test: `0`
- Version tuple:
  - `parser=1`
  - `strength=1`
  - `feature=1`
- Feature set: identical across both runs

## Holdout Comparison

### Unregularized logistic

- Holdout example count: `88`
- Holdout average prediction: `0`
- Holdout log loss: `1.177458`
- Holdout Brier score: `0.056818`
- Calibration shape:
  - every holdout example fell into the first bin
  - effectively a near-zero-probability model

### L2 logistic

- Holdout example count: `88`
- Holdout average prediction: `0.079545`
- Holdout log loss: `1.883933`
- Holdout Brier score: `0.090909`
- Calibration shape:
  - most holdout rows still collapsed near zero
  - a small group spiked into the `0.9-1.0` bin
  - that high-probability spike was badly overconfident

## Slice Comparison

### Strength-state holdout slices

- Unregularized:
  - `EV`: log loss `1.315763`, Brier `0.063492`
  - `PP`: log loss `1.036163`, Brier `0.05`
  - `SH`: log loss `0`, Brier `0`
- L2:
  - `EV`: log loss `2.302585`, Brier `0.111111`
  - `PP`: log loss `1.036163`, Brier `0.05`
  - `SH`: log loss `0`, Brier `0`

### Rebound / rush holdout slices

- Both runs only had `non-rebound` and `non-rush` holdout rows on this sample.
- That means neither run can yet be judged meaningfully on positive rebound or positive rush cases.

## Practical Conclusion

- L2 regularization improved one narrow failure mode:
  - it moved the model away from total zero-prediction collapse
- But on the saved holdout metrics, L2 was worse than the unregularized run:
  - worse holdout log loss
  - worse holdout Brier score
  - more obvious overconfidence in the top calibration bin
- So on this exact sample, `logistic_l2` is not the better baseline.

## Interpretation Limits

- This is still a weak benchmark because:
  - there is no test split
  - the cohort is only 10 games
  - rebound and rush positive slice coverage is absent
  - neither run uses feature scaling

## Recommended Direction

1. Keep the L2 result as a useful regularization reference artifact.
2. Do not treat it as the leading baseline yet.
3. In the next step, document coefficient stability and shrinkage behavior rather than claiming metric superiority.
