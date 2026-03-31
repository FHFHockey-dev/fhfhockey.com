# xG Calibrated Artifact Storage Decision

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `6.2`
Scope: decide whether calibrated outputs need separate persisted model metadata or artifact storage.

## Current State

The current training artifact already records:

- raw model family and fit metadata
- raw holdout scores
- calibration assessment
- best observed calibration method
- adoptable calibration method

That is enough for benchmark analysis, but it is not enough for rollout use if a calibrated output is eventually adopted.

Why:

- the raw model and the calibrated prediction layer are not the same object
- calibration can change without retraining the underlying model coefficients or trees
- downstream readers must be able to tell whether they are consuming:
  - raw model probabilities
  - calibrated probabilities

## Decision

Calibrated outputs require separate persisted metadata and a separately versioned artifact identity.

This does not require a totally different storage system today, but it does require a separate persisted artifact record once calibration becomes adoptable.

## Required Separation

When calibration is eventually adopted, persist:

- the base model artifact
- the calibration artifact

as distinct versioned records linked to each other.

Minimum calibration artifact identity should include:

- calibration method
- calibration training/holdout scope
- source base-model artifact tag
- source dataset artifact tag
- calibration generation timestamp
- calibration-specific metrics
- calibration adoptability status

## Why Separate Storage Is Required

### 1. Reproducibility

The same base model may be evaluated with:

- raw probabilities
- `Platt`
- `isotonic`

Those are different runnable prediction contracts and must stay distinguishable.

### 2. Safer Rollout

If a downstream reader regresses, the system must support rollback at either layer:

- revert the calibration layer only
- or revert the full base model plus calibration pair

That is much harder if calibration is only an in-place overwrite of the raw model artifact.

### 3. Cleaner Validation

Validation and approval may differ by layer:

- a base model can be benchmark-valid
- while a calibration layer may still be non-adoptable

Separate artifact identity keeps those decisions auditable.

## Storage Rule

Approved rollout should use this contract:

1. one versioned base-model artifact
2. zero or one separately versioned calibration artifact attached to that base model
3. downstream readers must reference both when calibrated output is active

If calibration is not adopted:

- the base model artifact remains the only active prediction artifact

## Boundary

This decision does not yet define:

- exact Supabase table design
- exact file-layout convention
- rollout API contract

It only locks the rule that calibrated outputs cannot be treated as an unversioned overwrite of the base model artifact.
