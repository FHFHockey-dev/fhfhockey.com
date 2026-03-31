# xG Shift-Fatigue History

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `4.2`
Scope: add richer shift-fatigue history features beyond current shift age.

## Added Feature Surface

The contextual feature layer now derives immediate prior-shift history from normalized shift intervals.

New optional numeric features:

- `shooterPreviousShiftGapSeconds`
- `shooterPreviousShiftDurationSeconds`
- `ownerAveragePreviousShiftGapSeconds`
- `ownerAveragePreviousShiftDurationSeconds`
- `opponentAveragePreviousShiftGapSeconds`
- `opponentAveragePreviousShiftDurationSeconds`

Interpretation:

- `previousShiftGapSeconds` measures the bench-rest gap between the previous shift end and the current shift start
- `previousShiftDurationSeconds` measures the workload of the immediately preceding shift
- owner and opponent aggregates are computed across the current on-ice player set for the event owner and defending side

## Important Boundary

This is still a conservative public-data fatigue model.

It does not yet attempt:

- multi-shift rolling workload windows
- cross-period recovery normalization
- bench-length or rotation-depth inference
- game-state-aware fatigue weighting

Cross-period prior shifts are intentionally not converted into gap values, because intermissions would distort the rest signal.

## Verification

Focused tests passed for:

- contextual prior-shift history derivation
- baseline dataset encoding of the new numeric keys
- training-script row-shape compatibility

Training smoke run passed with an explicit prior-shift-history feature selection:

- family: `logistic_l2`
- games: `2025021018, 2025021103, 2025021003, 2025021140`
- artifact tag: `logistic_l2-s20252026-p1-st1-f1-cfgc200782d`
- feature family: `first_pass_v1+custom`

The saved artifact accepted:

- `shooterPreviousShiftGapSeconds`
- `shooterPreviousShiftDurationSeconds`
- `ownerAveragePreviousShiftGapSeconds`
- `ownerAveragePreviousShiftDurationSeconds`
- `opponentAveragePreviousShiftGapSeconds`
- `opponentAveragePreviousShiftDurationSeconds`

## Early Smoke Observation

This smoke run produced a plausible non-degenerate holdout profile on the small 4-game sample:

- holdout average prediction: `0.071644`
- holdout log loss: `0.194871`
- holdout Brier: `0.048502`

That is encouraging, but it is not a benchmark conclusion.

Why:

- the run used a custom narrow feature subset
- the sample still has `test = 0`
- comparative model evaluation is deferred to task `4.4`

## Conclusion

- richer immediate shift-history features are now available as optional training inputs
- the implementation stays within the stable public-data boundary
- benchmark comparison against the approved baseline surface remains deferred to `4.4`
