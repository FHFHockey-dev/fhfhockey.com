# xG Expanded Feature Family

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `3.6`
Scope: version the promising second-pass additions under a named training artifact configuration.

## Decision

The high-priority second-pass pass is promising enough to version as a named training feature family.

New named preset:

- `expanded_v2`

This is not an approval decision for any model family.

It is a configuration decision:

- the expanded second-pass surface should no longer live only as ad hoc CLI feature lists
- it now has a stable, replayable feature-family name that persists into dataset and model artifacts

## Included In `expanded_v2`

`expanded_v2` includes all `first_pass_v1` features, plus these promoted additions:

- possession-chain context
  - `possessionEventCount`
  - `possessionDurationSeconds`
  - `possessionStartTypeDescKey`
  - `possessionStartZoneCode`
  - `possessionRegainedFromOpponent`
  - `possessionRegainEventTypeDescKey`
  - `possessionEnteredOffensiveZone`
- score-state context
  - `homeScoreDiffBeforeEvent`
  - `awayScoreDiffBeforeEvent`
  - `ownerScoreDiffBeforeEvent`
  - `ownerScoreDiffBucket`
  - `isLateGameClose`
  - `isLateGameTrailing`
- roster-position context
  - `shooterRosterPosition`
  - `shooterPositionGroup`
  - `isDefensemanShooter`

## Not Promoted Into `expanded_v2`

These remain available for explicit ablation, but they are not part of the named expanded preset:

- handedness joins
- richer rebound geometry

Reason:

- handedness did not help the repaired benchmark
- richer rebound geometry remained inconclusive because the current sample still has no positive rebound holdout coverage

## Artifact Contract Change

Training artifacts now record:

- `featureFamily`

Current expected values:

- `first_pass_v1`
- `expanded_v2`
- `{preset}+custom` when explicit CLI overrides are layered on top of a preset

The training entrypoint now supports:

- `--featureFamily first_pass_v1`
- `--featureFamily expanded_v2`

## Smoke Verification

Smoke run used:

- family: `logistic_l2`
- feature family: `expanded_v2`
- games: `2025021018, 2025021103, 2025021003, 2025021140`

Observed result:

- the generated artifact metadata persisted `featureFamily: expanded_v2`
- the saved feature keys included promoted possession, score-state, and roster-position fields
- the saved feature keys did not include handedness or rebound-geometry fields unless explicitly requested

## Interpretation

This is the right level of versioning for the current evidence.

Why:

- possession-chain context showed the strongest positive signal in the second-pass pass
- score-state helped the regularized and boosted families
- roster-position looked mildly promising for the regularized family
- the full second-pass story is still exploratory, but it is coherent enough to deserve a named preset

## Conclusion

- the training harness now has a stable named second-pass feature family: `expanded_v2`
- the promoted additions are possession-chain, score-state, and roster-position context
- handedness and rebound geometry stay out of the preset for now
- future benchmark artifacts can now compare `first_pass_v1` versus `expanded_v2` directly without reconstructing long CLI feature lists
