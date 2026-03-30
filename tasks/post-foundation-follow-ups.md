# Post-Foundation Follow-Ups

## Purpose

This document captures the work that should happen only after the NHL API data foundation has been validated and approved for training or production rollout.

These are not phase-1 foundation blockers. They are the next queue once the validation package is complete and the release gate is cleared.

## 1. Training Dataset Publication

- define the canonical training-row grain for the first xG model:
  - one row per shot-feature-eligible event
  - target label definition
  - train, validation, and test season split policy
- create versioned storage for exported training datasets
- record dataset lineage with:
  - `parser_version`
  - `strength_version`
  - `feature_version`
  - source commit SHA
- define exclusion policy for training-only rows if it differs from parity policy

## 2. Coefficient Fitting And Model Selection

- choose the first modeling baseline:
  - logistic regression
  - regularized logistic regression
  - gradient boosting baseline
- define the initial feature set and feature-family ablation plan
- fit the first coefficient set on the validated training dataset
- version the trained model separately from parser, feature, and parity versions
- record training configuration and reproducibility metadata

## 3. Calibration

- measure calibration on holdout samples
- evaluate raw probability calibration by:
  - score buckets
  - shot type
  - distance and angle bands
  - strength state
  - rebound and rush flags
- choose a calibration approach if needed:
  - isotonic regression
  - Platt scaling
  - no post-calibration if already acceptable
- version calibrated outputs separately from uncalibrated model outputs when required

## 4. Benchmarking

- benchmark the first model against:
  - simple distance-angle baseline
  - current phase-1 geometry approximation
  - any trusted external public xG reference used for sanity checks
- compare by:
  - log loss
  - Brier score
  - calibration error
  - rank-order usefulness for player and team aggregates
- produce a benchmark artifact with methodology notes and known differences from public models

## 5. Advanced Feature Additions

- evaluate whether additional public-data features materially improve the model:
  - richer rebound geometry
  - possession-chain logic
  - score-state features
  - score effects by game time
  - shooter and goalie handedness joins
  - roster-position context
  - deployment and matchup context
- version any new feature family under a new `feature_version`
- avoid mutating parity methodology just because training features expand

## 6. Miss-Reason And Blocked-Shot Research

- study whether any miss subtypes should be excluded, down-weighted, or separately modeled for xG
- decide whether blocked attempts belong in the model as:
  - excluded rows
  - zero-probability contextual rows
  - separate modeled class
- document any change as a training-methodology decision, not a parser change

## 7. Goalie Modeling Follow-Ups

- decide whether to model goalie-facing expected goals against directly from the skater xG model or via a dedicated goalie surface
- evaluate goalie-specific adjustments only after the base shot model is stable
- define goalie benchmarking separately from skater shooting xG benchmarking

## 8. Production Productization

- choose the first downstream readers to migrate from legacy NST surfaces
- create published parity tables and feature tables if query-time assembly is no longer sufficient
- define refresh cadence for:
  - current-season updates
  - repair runs
  - historical backfills
- add dashboards or health checks for validation drift and upstream schema drift

## 9. Historical Backfill Expansion

- run historical backfills only after:
  - replay semantics are hardened
  - stale-row replacement is implemented
  - validation rules are proven on current-season data
- decide season priority order for historical backfill
- produce dated backfill-run artifacts with validation summaries

## 10. Approval Rule

Do not start this follow-up queue until:

- the phase-1 release gate in `tasks/validation-checklist.md` is satisfied
- the implementation summary no longer lists unresolved release blockers for the intended action
- training or rollout has been explicitly approved for the next phase
