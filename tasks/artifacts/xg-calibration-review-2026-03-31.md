# xG Calibration Review

Date: `2026-03-31`
Task: `7.2`
Scope: evaluate whether post-calibration is required for the current baseline candidates and test `Platt` and `isotonic` calibration where justified.

## Inputs

- dataset artifact family tag suffix: `s20252026-p1-st1-f1-cfg4c96cf20`
- games: `2025021018, 2025021103, 2025021003, 2025021119, 2025021171, 2025021140, 2025020982, 2025021172, 2025021170, 2025021169`
- split counts for all three runs:
  - `train: 210`
  - `validation: 88`
  - `test: 0`

## Calibration contract used

- requirement rule:
  - calibration is considered required when overall holdout `avgPrediction` differs from holdout `goalRate` by at least `0.02`
  - or when a populated calibration bin differs from observed rate by at least `0.10`
- tested methods:
  - `Platt`
  - `isotonic`
- validation strategy:
  - `cross_validated_holdout`
  - because there is no dedicated `test` split in the current saved sample

## Shared warnings

These warnings applied to all three baseline families:

- the feature set still includes direct label leakage via `shotEventType:goal`
- there is no dedicated `test` split, so calibration comparison is holdout cross-validation only
- holdout positive-goal coverage is sparse: `5` goals in `88` examples

Because of those three warnings, no tested calibration method is currently considered `adoptable` for release use, even when the observed metrics look much better after calibration.

## Results

### `logistic_unregularized`

- post-calibration required: `yes`
- reason: holdout average prediction differed from holdout goal rate by `0.056818`
- raw holdout:
  - `logLoss: 1.177458`
  - `Brier: 0.056818`
  - `avgPrediction: 0`
  - `goalRate: 0.056818`
- `Platt`:
  - `logLoss: 0.218134`
  - `Brier: 0.053591`
  - `avgPrediction: 0.056838`
- `isotonic`:
  - `logLoss: 1.177458`
  - `Brier: 0.056818`
  - `avgPrediction: 0`
- best observed method: `Platt`
- adoptable method: `none`

Interpretation:

- `Platt` materially improves the collapsed near-zero probability surface.
- `isotonic` does nothing useful here because the raw model is effectively a single-point predictor.
- even after the exploratory `Platt` uplift, this family remains weak enough that calibration alone does not rescue it as the preferred baseline.

### `logistic_l2`

- post-calibration required: `yes`
- reason: holdout average prediction differed from holdout goal rate by `0.022727`
- raw holdout:
  - `logLoss: 1.883933`
  - `Brier: 0.090909`
  - `avgPrediction: 0.079545`
  - `goalRate: 0.056818`
- `Platt`:
  - `logLoss: 0.213337`
  - `Brier: 0.05595`
  - `avgPrediction: 0.095905`
- `isotonic`:
  - `logLoss: 0.776137`
  - `Brier: 0.054613`
  - `avgPrediction: 0.004178`
- best observed method: `Platt`
- adoptable method: `none`

Interpretation:

- calibration clearly helps this family.
- `Platt` is the better observed choice on holdout log loss.
- `isotonic` slightly beats `Platt` on Brier here, but its probability surface is still unstable on the sparse positive sample.

### `xgboost_js`

- post-calibration required: `yes`
- reason: holdout average prediction differed from holdout goal rate by `0.456512`
- raw holdout:
  - `logLoss: 0.672`
  - `Brier: 0.240122`
  - `avgPrediction: 0.51333`
  - `goalRate: 0.056818`
- `Platt`:
  - `logLoss: 0.180577`
  - `Brier: 0.044943`
  - `avgPrediction: 0.089629`
- `isotonic`:
  - `logLoss: 0`
  - `Brier: 0`
  - `avgPrediction: 0.056818`
- best observed method: `isotonic`
- adoptable method: `none`

Interpretation:

- the raw boosting model is badly miscalibrated on this sample.
- the perfect isotonic result is not trustworthy. It is a leakage-shaped artifact, not a credible production result.
- the right reading is not that `isotonic` solved the model. The right reading is that the current experiment is still contaminated by `shotEventType:goal`.

## Verdict

- post-calibration is currently required for all three saved baseline families under the present rule
- `Platt` is the most credible exploratory calibration method on this sample
- no calibrated result is currently adoptable because:
  - label leakage is still present
  - the sample has no dedicated `test` split
  - holdout positives are sparse

## Implication For `7.3`

The benchmark artifact should report:

- calibration was tested
- calibration improved the observed holdout metrics for the logistic families and the boosting family
- those gains are not yet trustworthy enough to declare a winning production-ready baseline
- the main blocker is still the leaked `shotEventType:goal` feature, not the absence of a calibration method
