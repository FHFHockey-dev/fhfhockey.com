# XG Training Feature Contract

## Purpose

This document defines which shot-feature columns are:

- mandatory
- optional
- excluded

for the first xG baseline comparison.

This is the contract for baseline task `2.2` in `/Users/tim/Code/fhfhockey.com/tasks/tasks-xg-baseline-options.md`.

## Scope

This contract applies to the first baseline cohort defined in:

- `/Users/tim/Code/fhfhockey.com/tasks/xg-training-dataset-contract.md`

That means:

- one row per eligible unblocked shot-feature row
- season `20252026`
- current version tuple:
  - `parser_version = 1`
  - `strength_version = 1`
  - `feature_version = 1`

## Feature Categories

## Named Feature Families

The training harness now exposes two named feature-family presets:

### `first_pass_v1`

This is the default clean baseline family.

It contains:

- all mandatory baseline numeric features
- all mandatory baseline boolean features
- the recommended first-pass categorical set

It intentionally excludes optional second-pass context such as possession-chain, score-state, handedness, roster-position, and richer rebound geometry unless those are explicitly requested.

### `expanded_v2`

This is the first named second-pass candidate family.

It contains everything in `first_pass_v1`, plus the promoted additions from the March 31 second-pass benchmark pass:

- possession-chain context:
  - `possessionEventCount`
  - `possessionDurationSeconds`
  - `possessionStartTypeDescKey`
  - `possessionStartZoneCode`
  - `possessionRegainedFromOpponent`
  - `possessionRegainEventTypeDescKey`
  - `possessionEnteredOffensiveZone`
- score-state context:
  - `homeScoreDiffBeforeEvent`
  - `awayScoreDiffBeforeEvent`
  - `ownerScoreDiffBeforeEvent`
  - `ownerScoreDiffBucket`
  - `isLateGameClose`
  - `isLateGameTrailing`
- roster-position context:
  - `shooterRosterPosition`
  - `shooterPositionGroup`
  - `isDefensemanShooter`

It intentionally does not promote these optional families yet:

- handedness joins
- richer rebound geometry

Reason:

- handedness did not help on the repaired sample
- rebound geometry remained inconclusive because the current holdout still lacks positive rebound coverage

### 1. Mandatory Baseline Features

These columns must be present and used in the first baseline comparison.

Core geometry:

- `normalizedX`
- `normalizedY`
- `shotDistanceFeet`
- `shotAngleDegrees`

Shot context:

- `shotType`
- `strengthState`
- `strengthExact`
- `zoneCode`
- `periodNumber`
- `periodSecondsElapsed`
- `gameSecondsElapsed`

Sequence context:

- `previousEventTypeDescKey`
- `previousEventSameTeam`
- `timeSincePreviousEventSeconds`
- `distanceFromPreviousEvent`

Derived flags:

- `isReboundShot`
- `isRushShot`
- `isFlurryShot`
- `isEmptyNetEvent`
- `isOvertimeEvent`

Miss context:

- `missReasonBucket`
- `isShortSideMiss`

Contextual features:

- `ownerPowerPlayAgeSeconds`
- `shooterShiftAgeSeconds`
- `eastWestMovementFeet`
- `northSouthMovementFeet`
- `crossedRoyalRoad`

Why these are mandatory:

- they represent the first-pass public-data xG signal set
- they are available directly from the current feature builder
- they cover geometry, sequence context, manpower context, and a minimal fatigue/movement layer without overloading the first baseline
- miss subtypes stay in the cohort as explanatory inputs; they are not currently exclusion rules

### 2. Optional Baseline Features

These columns should be carried through the training dataset and artifact metadata, but the first harness may enable or disable them behind feature-selection config.

Player or goalie identifiers:

- `shooterPlayerId`
- `shootingPlayerId`
- `scoringPlayerId`
- `goalieInNetId`

Team and side context:

- `eventOwnerTeamId`
- `eventOwnerSide`

Ordering and identifiers:

- `eventIndex`
- `sortOrder`
- `previousEventId`

Extended rebound context:

- `reboundSourceEventId`
- `reboundSourceTypeDescKey`
- `reboundTimeDeltaSeconds`
- `reboundDistanceFromSource`
- `reboundLateralDisplacementFeet`
- `reboundDistanceDeltaFeet`
- `reboundAngleChangeDegrees`
- `createsRebound`

Possession-chain context:

- `possessionSequenceId`
- `possessionEventCount`
- `possessionDurationSeconds`
- `possessionStartEventId`
- `possessionStartTypeDescKey`
- `possessionStartZoneCode`
- `possessionRegainedFromOpponent`
- `possessionRegainEventTypeDescKey`
- `possessionEnteredOffensiveZone`

Score-state context:

- `homeScoreBeforeEvent`
- `awayScoreBeforeEvent`
- `homeScoreDiffBeforeEvent`
- `awayScoreDiffBeforeEvent`
- `ownerScoreDiffBeforeEvent`
- `ownerScoreDiffBucket`
- `scoreEffectsGameTimeSegment`
- `ownerScoreDiffByGameTimeBucket`
- `isLateGameClose`
- `isLateGameTrailing`
- `isLateGameLeading`
- `isFinalFiveMinutes`
- `isFinalTwoMinutes`

Handedness context:

- `shooterHandedness`
- `goalieCatchHand`
- `shooterGoalieHandednessMatchup`

Roster-position context:

- `shooterRosterPosition`
- `shooterPositionGroup`
- `isDefensemanShooter`

Deployment and matchup context:

- `ownerForwardCountOnIce`
- `ownerDefenseCountOnIce`
- `opponentForwardCountOnIce`
- `opponentDefenseCountOnIce`
- `ownerGoalieOnIce`
- `opponentGoalieOnIce`
- `ownerSkaterDeploymentBucket`
- `opponentSkaterDeploymentBucket`
- `skaterRoleMatchupBucket`

Extended rush context:

- `rushSourceEventId`
- `rushSourceTypeDescKey`
- `rushTimeSinceSourceSeconds`
- `rushSourceTeamRelativeZoneCode`

Extended flurry context:

- `flurrySequenceId`
- `flurryShotIndex`
- `flurryShotCount`
- `flurrySequenceStartEventId`
- `flurrySequenceEndEventId`

Extended contextual features:

- `opponentPowerPlayAgeSeconds`
- `shooterPreviousShiftGapSeconds`
- `shooterPreviousShiftDurationSeconds`
- `ownerAverageShiftAgeSeconds`
- `ownerMaxShiftAgeSeconds`
- `ownerAveragePreviousShiftGapSeconds`
- `ownerAveragePreviousShiftDurationSeconds`
- `opponentAverageShiftAgeSeconds`
- `opponentMaxShiftAgeSeconds`
- `opponentAveragePreviousShiftGapSeconds`
- `opponentAveragePreviousShiftDurationSeconds`

Why these are optional:

- they may help later model families
- some are redundant with simpler first-pass features
- some are more useful for ablation or richer second-pass models than for the first clean baseline comparison

### 3. Excluded From The First Baseline Feature Matrix

These columns must not be treated as model input features for the first baseline comparison.

Identity and lineage only:

- `featureVersion`
- `gameId`
- `seasonId`
- `gameDate`
- `eventId`

Direct label or near-label leakage:

- `shotEventType`
- `isGoal`
- `isShotOnGoal`
- `isMissedShot`
- `isBlockedShot`
- `isUnblockedShotAttempt`

Raw coordinates once normalized geometry exists:

- `rawX`
- `rawY`

Training-policy exclusion flags:

- `isPenaltyShotEvent`
- `isShootoutEvent`
- `isDelayedPenaltyEvent`
- `hasRareManpower`

Reason for exclusion:

- identity fields are for lineage, joins, and split assignment only
- current-shot event-class and label-adjacent columns would leak or restate the target
- raw coordinates are dominated by normalized geometry in the first baseline
- exclusion and cohort-policy flags define row eligibility, not shot quality

## Missingness Policy

The first baseline contract allows nullable features.

Required behavior:

- do not drop a row solely because an optional contextual feature is null
- mandatory columns must exist in the dataset schema even if some values are null
- the training harness must choose an explicit null-handling strategy and record it in artifact metadata

## Encoding Policy

The first baseline harness should assume:

- numeric features stay numeric
- booleans are encoded as binary flags
- low-cardinality categorical features may be one-hot encoded

Recommended first-pass categorical set:

- `shotType`
- `strengthState`
- `strengthExact`
- `zoneCode`
- `previousEventTypeDescKey`
- `missReasonBucket`

## Important Boundaries

- This contract defines feature eligibility, not the exact final model matrix implementation.
- The first baseline harness may run ablations between mandatory-only and mandatory-plus-optional sets.
- Any future addition of blocked-shot cohorts, goalie-specific context expansion, or historical season expansion must be versioned in training artifact metadata.
- any future miss-subtype exclusion, down-weighting, or separate modeling treatment must also be versioned and justified by an approval-grade rerun

## Summary

The first baseline comparison now uses:

- a compact mandatory feature set centered on geometry, sequence context, manpower, and a minimal contextual layer
- an optional feature set for ablation and richer later baselines
- a strict excluded set for identity fields, current-shot event-class leakage, direct label leakage, and cohort-policy flags
