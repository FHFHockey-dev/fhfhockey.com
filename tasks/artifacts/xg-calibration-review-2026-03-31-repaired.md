# xG Calibration Review

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `1.4`
Scope: rerun calibration review on the repaired baseline contract after removing leaked current-shot event-class features.

## Inputs

- dataset artifact family tag suffix: `s20252026-p1-st1-f1-cfg4c96cf20`
- games: `2025021018, 2025021103, 2025021003, 2025021119, 2025021171, 2025021140, 2025020982, 2025021172, 2025021170, 2025021169`
- split counts for all three repaired runs:
  - `train: 210`
  - `validation: 88`
  - `test: 0`

## Important Change From The Prior Calibration Review

The repaired artifacts no longer contain:

- `shotEventType`
- `shotEventType:*`

The prior explicit label-leakage warning is gone from the calibration review.

## Calibration Contract Used

- requirement rule:
  - calibration is considered required when overall holdout `avgPrediction` differs from holdout `goalRate` by at least `0.02`
  - or when a populated calibration bin differs from observed rate by at least `0.10`
- tested methods:
  - `Platt`
  - `isotonic`
- validation strategy:
  - `cross_validated_holdout`
  - because there is still no dedicated `test` split in the current saved sample

## Shared Warnings

These warnings still apply to all three repaired baseline families:

- there is no dedicated `test` split, so calibration comparison is holdout cross-validation only
- holdout positive-goal coverage is sparse: `5` goals in `88` examples

Because of those two warnings, no tested calibration method is currently considered `adoptable` for approval use, even when the observed holdout metrics improve after calibration.

## Results

### `logistic_unregularized`

- post-calibration required: `yes`
- reason: holdout average prediction differed from holdout goal rate by `0.034091`
- raw holdout:
  - `logLoss: 1.648442`
  - `Brier: 0.079545`
  - `avgPrediction: 0.022727`
  - `goalRate: 0.056818`
- `Platt`:
  - `logLoss: 0.284088`
  - `Brier: 0.074021`
  - `avgPrediction: 0.093491`
- `isotonic`:
  - `logLoss: 1.183997`
  - `Brier: 0.058239`
  - `avgPrediction: 0.005682`
- best observed method: `Platt`
- adoptable method: `none`

Interpretation:

- `Platt` remains the most credible observed improvement for the repaired unregularized run.
- `isotonic` improves Brier relative to raw but still leaves an unstable and underconfident probability surface.
- this family is no longer invalidated by leakage, but it is still too weak and too sample-limited to approve.

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

- calibration still helps this family materially.
- `Platt` remains the cleaner observed choice on log loss.
- `isotonic` still edges `Platt` on Brier, but the sparse-positive setting makes that surface too unstable to approve.

### `xgboost_js`

- post-calibration required: `yes`
- reason: holdout average prediction differed from holdout goal rate by `0.503894`
- raw holdout:
  - `logLoss: 0.807738`
  - `Brier: 0.306537`
  - `avgPrediction: 0.560712`
  - `goalRate: 0.056818`
- `Platt`:
  - `logLoss: 0.226436`
  - `Brier: 0.0548`
  - `avgPrediction: 0.085289`
- `isotonic`:
  - `logLoss: 0.410278`
  - `Brier: 0.056064`
  - `avgPrediction: 0.061529`
- best observed method: `Platt`
- adoptable method: `none`

Interpretation:

- the repaired boosting run is still badly miscalibrated in raw form.
- unlike the leaked run, the repaired isotonic result is no longer suspiciously perfect.
- `Platt` is the better observed method here, but the same sample-design weaknesses still block adoption.

## Verdict

- post-calibration is still required for all three repaired baseline families under the current rule
- `Platt` is now the most credible observed calibration method across all three repaired runs
- no calibrated result is adoptable yet because:
  - there is still no dedicated `test` split
  - holdout positives are still sparse
  - rebound and rush positive holdout coverage are still absent in the benchmark package

## Implication For `1.5`

The fresh approval decision should use:

- the repaired benchmark artifact
- this repaired calibration review artifact

and should remain conservative unless the remaining sample-design blockers are explicitly accepted.
