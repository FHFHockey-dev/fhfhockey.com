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

### 1. Mandatory Baseline Features

These columns must be present and used in the first baseline comparison.

Core geometry:

- `normalizedX`
- `normalizedY`
- `shotDistanceFeet`
- `shotAngleDegrees`

Shot context:

- `shotEventType`
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
- `createsRebound`

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
- `ownerAverageShiftAgeSeconds`
- `ownerMaxShiftAgeSeconds`
- `opponentAverageShiftAgeSeconds`
- `opponentMaxShiftAgeSeconds`

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
- label-adjacent columns would leak or restate the target
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

- `shotEventType`
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

## Summary

The first baseline comparison now uses:

- a compact mandatory feature set centered on geometry, sequence context, manpower, and a minimal contextual layer
- an optional feature set for ablation and richer later baselines
- a strict excluded set for identity fields, direct label leakage, and cohort-policy flags
