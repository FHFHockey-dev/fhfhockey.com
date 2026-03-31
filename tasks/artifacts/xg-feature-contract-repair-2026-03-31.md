# xG Feature Contract Repair

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `1.1`

## Change

Removed direct label leakage from the baseline training feature contract by excluding current-shot event-class usage from the default model matrix.

## What Changed

- `shotEventType` was removed from the first-pass baseline feature contract as a mandatory feature
- `shotEventType` was added to the excluded leakage set in the training feature contract
- the default categorical feature list in the baseline dataset encoder no longer includes `shotEventType`

## Why

The current label is defined on the current shot row:

- `goal` => label `1`
- `shot-on-goal` or `missed-shot` => label `0`

That means using current-shot `shotEventType` as a model input leaks the answer directly, especially through `shotEventType:goal`.

## Resulting Contract

The repaired first-pass categorical default set is now:

- `shotType`
- `strengthState`
- `strengthExact`
- `zoneCode`
- `previousEventTypeDescKey`
- `missReasonBucket`

## Boundary

This task repairs the contract and default encoding path only.

It does not yet:

- regenerate the saved baseline artifacts
- rerun the three baseline families
- rerun the benchmark and calibration reviews

Those steps remain in follow-up tasks `1.2` through `1.5`.
