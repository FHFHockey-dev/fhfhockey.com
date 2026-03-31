# xG Calibration Acceptance Rules

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `2.4`
Scope: define the minimum holdout-positive and slice-coverage rules required before a calibration result can be treated as adoptable.

## Acceptance Rules

A calibration result is not adoptable unless all of these conditions are satisfied:

1. dedicated `test` split is present
2. holdout positive-goal count is at least `10`
3. positive rebound holdout count is at least `1`
4. positive rush holdout count is at least `1`

## Current Enforcement

These rules now flow through the calibration assessment itself.

Each assessment now records:

- `holdoutPositiveCount`
- `reboundPositiveCount`
- `rushPositiveCount`
- `adoptabilityBlockingReasons`

The calibrated winner may still be recorded as the `bestObservedMethod`, but `adoptableMethod` stays `null` unless all four acceptance rules pass.

## Why These Rules Exist

The repaired rerun removed leakage, but calibration adoption was still blocked by weak evidence:

- no dedicated `test` split
- only `5` holdout positives
- no positive rebound holdout coverage
- no positive rush holdout coverage

This step turns those blockers into explicit contract rules instead of leaving them as narrative warnings.

## Consequence For Future Approval Work

- future calibration artifacts must show both the observed winner and the adoptability status
- a method like `Platt` can remain the current leading candidate while still being non-adoptable
- approval-grade reruns must now satisfy these coverage gates before a calibration family can be accepted
