# xG Regularized Logistic Review - 2026-03-31

## Compared Runs

- Unregularized logistic:
  - `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_unregularized-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`
- L2 logistic:
  - `/Users/tim/Code/fhfhockey.com/web/scripts/output/xg-baselines/logistic_l2-s20252026-p1-st1-f1-cfg4c96cf20/model-artifact.json`

## Coefficient Stability

- L2 regularization did not radically change the dominant feature ranking.
- In both runs, the largest-magnitude weights stayed concentrated in the same core numeric features:
  - `shooterShiftAgeSeconds`
  - `shotDistanceFeet`
  - `normalizedX`
  - `shotAngleDegrees`
  - `periodSecondsElapsed`
  - `eastWestMovementFeet`
- This suggests the current feature mix is directionally stable at the top level, even though the fitted model quality is still poor.

## Observed Shrinkage

Most obvious L2 shrinkage effects from the saved artifacts:

- `shooterShiftAgeSeconds`
  - unregularized: `-35.55`
  - L2: `-31.50`
- `shotDistanceFeet`
  - unregularized: `-20.05`
  - L2: `-18.21`
- `periodSecondsElapsed`
  - unregularized: `-13.25`
  - L2: `-3.29`
- `shotAngleDegrees`
  - unregularized: `-8.37`
  - L2: `-7.00`
- `eastWestMovementFeet`
  - unregularized: `7.31`
  - L2: `6.18`
- `northSouthMovementFeet`
  - unregularized: `-3.37`
  - L2: `-1.97`
- `distanceFromPreviousEvent`
  - unregularized: `-1.08`
  - L2: `-0.15`

Important nuance:

- L2 did not shrink every coefficient monotonically.
- `normalizedX` increased from `10.66` to `12.24`, which is a sign that simple L2 alone is not enough to make this training setup well behaved.

## Practical Deployment Advantages

Even though the saved L2 result is not better on holdout metrics, it still has some practical operational advantages:

- fit options are now explicit and persisted in the model artifact
- the training entrypoint can now support:
  - unregularized logistic
  - L2 logistic
  - elastic-net style logistic
- this gives later baseline comparisons a stable, reusable contract instead of one-off experimentation

## Practical Deployment Disadvantages

- L2 did not improve holdout quality on the current sample
- it introduced obvious overconfidence in the top probability bin
- the model is still sensitive to unscaled numeric features
- current deployment value is mostly experimentation infrastructure, not model quality

## Bottom Line

- L2 regularization produced modest coefficient shrinkage and a more varied prediction surface.
- That is a useful modeling-control improvement.
- But on this sample it did not create a better baseline.
- The main value of `5.1` through `5.3` is that regularized logistic is now a supported, reproducible baseline family for future larger-cohort comparisons.
