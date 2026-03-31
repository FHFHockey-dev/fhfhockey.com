# xG Roster-Position Benchmark

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `3.5`
Scope: add shooter roster-position context and benchmark its impact on the repaired 10-game baseline sample.

## Added Feature Surface

Training-time roster-position enrichment now joins shooter position from:

- `players.position`

The join uses the current `shooterPlayerId` on each shot row and normalizes the source value into compact position buckets.

New roster-position features now available to the training harness:

- `shooterRosterPosition`
- `shooterPositionGroup`
- `isDefensemanShooter`

Important boundary:

- these values are enriched in the training path, not silently injected into the default first-pass feature set
- the current benchmark used them only through explicit boolean and categorical feature selection

## Roster-Position Benchmark Configuration

Shared rerun sample:

- games: `2025021018, 2025021103, 2025021003, 2025021119, 2025021171, 2025021140, 2025020982, 2025021172, 2025021170, 2025021169`
- rows:
  - `shotRows: 391`
  - `eligibleRows: 298`
- split counts:
  - `train: 210`
  - `validation: 88`
  - `test: 0`

Explicit roster-position feature additions used for the rerun:

- boolean:
  - `isDefensemanShooter`
- categorical:
  - `shooterRosterPosition`
  - `shooterPositionGroup`

New artifact tags:

- `logistic_unregularized-s20252026-p1-st1-f1-cfgd59f2dcc`
- `logistic_l2-s20252026-p1-st1-f1-cfgd59f2dcc`
- `xgboost_js-s20252026-p1-st1-f1-cfgd59f2dcc`

## Observed Impact

### `logistic_unregularized`

- previous repaired holdout:
  - `logLoss: 1.648442`
  - `Brier: 0.079545`
  - `avgPrediction: 0.022727`
- roster-position rerun:
  - `logLoss: 5.976040`
  - `Brier: 0.295445`
  - `avgPrediction: 0.306814`
- roster-position made this family much worse on the current sample
- the model learned real position weights, but they destabilized the fit:
  - `shooterRosterPosition:R: 0.504560`
  - `shooterRosterPosition:C: -0.362840`
  - `shooterRosterPosition:D: -0.096677`
  - `shooterPositionGroup:forward: 0.086916`
  - `isDefensemanShooter: -0.096677`

### `logistic_l2`

- previous repaired holdout:
  - `logLoss: 1.883933`
  - `Brier: 0.090909`
  - `avgPrediction: 0.079545`
- roster-position rerun:
  - `logLoss: 1.648442`
  - `Brier: 0.079545`
  - `avgPrediction: 0.022727`
- roster-position improved this family materially on the current sample
- learned position weights were non-zero and directionally consistent with the unregularized fit, but better controlled:
  - `shooterRosterPosition:R: 0.418629`
  - `shooterRosterPosition:C: -0.287564`
  - `shooterRosterPosition:D: -0.085878`
  - `shooterPositionGroup:forward: 0.071031`
  - `isDefensemanShooter: -0.085878`

### `xgboost_js`

- previous repaired holdout:
  - `logLoss: 0.807738`
  - `Brier: 0.306537`
  - `avgPrediction: 0.560712`
- roster-position rerun:
  - `logLoss: 0.808756`
  - `Brier: 0.307042`
  - `avgPrediction: 0.560749`
- roster-position was effectively flat to slightly worse on the current sample
- observed roster-position feature importance was absent:
  - `isDefensemanShooter: 0`
  - `shooterRosterPosition:C: 0`
  - `shooterRosterPosition:D: 0`
  - `shooterRosterPosition:L: 0`
  - `shooterPositionGroup:defense: 0`
  - `shooterPositionGroup:forward: 0`

## Interpretation

This rerun shows that roster-position context is active, but only looks mildly promising for the regularized family.

Key read:

- the join itself works and the enriched position fields are present in saved artifacts
- `logistic_l2` is the only family that improved on this sample
- `xgboost_js` treated the roster-position surface as effectively inert
- `logistic_unregularized` again became materially less stable with the added categorical surface

That makes the correct conclusion narrower than "position always helps":

- shooter roster-position context looks worth keeping in the second-pass candidate surface
- the evidence is strongest for the regularized family
- the current sample does not justify promoting roster-position as a universal win across model families

The benchmark still is not approval-grade because the same sample-design blockers remain:

- `test` split is still empty
- holdout positives are still sparse
- positive rebound and rush holdout coverage are still absent

## Conclusion

- shooter roster-position enrichment is now implemented in the training harness
- the new position features did not improve `xgboost_js`
- they materially hurt `logistic_unregularized`
- they modestly improved `logistic_l2`
- roster-position context should stay in the second-pass candidate surface, but the evidence remains exploratory rather than approval-grade

## Consequence For `3.6`

The next task should version the expanded feature family only if the combined second-pass surface still looks coherent after these reruns.

Right now the correct read is:

- keep roster-position available in the expanded candidate set
- do not treat it as a standalone approval-triggering addition
- carry it forward primarily as a regularized-family candidate when deciding whether `3.6` should version the expanded feature family
