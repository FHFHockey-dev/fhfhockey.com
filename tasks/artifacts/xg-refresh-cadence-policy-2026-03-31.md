# xG Refresh Cadence Policy

Date: `2026-03-31`
Task: `tasks-xg-baseline-follow-ups.md` `6.3`
Scope: define refresh cadence and rerun policy for current-season retrains, repair runs, and benchmark refreshes once a baseline is approved.

## Decision

The xG rollout path should use three distinct run classes:

- scheduled current-season retrains
- targeted repair runs
- benchmark refresh runs

These must not be treated as interchangeable.

## 1. Scheduled Current-Season Retrains

Purpose:

- refresh the active current-season model on newly ingested data once the approved baseline and calibration contract are stable

Cadence:

- no more than once per week during the season by default
- never retrain continuously on every ingest batch

Why weekly:

- it balances freshness against model churn
- it reduces unnecessary artifact proliferation
- it keeps downstream reader behavior more stable

Required inputs:

- current approved dataset contract
- current approved feature family
- current approved base model family
- current approved calibration layer, if any

Required output:

- new versioned dataset artifact
- new versioned base-model artifact
- new versioned calibration artifact if calibration is active
- dated validation and benchmark summary for the retrain

## 2. Targeted Repair Runs

Purpose:

- repair bad outputs after:
  - parser fixes
  - feature fixes
  - calibration fixes
  - data corrections
  - upstream payload corrections

Cadence:

- as needed only
- never bundled into the normal weekly retrain cadence by default

Rules:

- use explicit scope:
  - single game
  - sampled game set
  - bounded season slice
  - one full season only when justified
- preserve replay lineage and version attribution
- record exactly why the repair run happened

Required output:

- dated repair artifact
- affected artifact tags or version tuple
- explicit rollback target if the repair is later rejected

## 3. Benchmark Refresh Runs

Purpose:

- reassess family ranking, calibration quality, and approval status under a stable contract

Cadence:

- required whenever any of these change:
  - dataset cohort
  - split strategy
  - feature family
  - model family or key hyperparameters
  - calibration method
  - parser/strength/feature versions that affect training rows
- otherwise optional and not part of every weekly retrain by default

Interpretation:

- benchmark refresh is a decision-support run, not a production refresh primitive
- do not rerun the full family bakeoff on every operational retrain unless the comparison contract changed

## 4. No-Auto-Retrain Rule For Pre-Approved States

Before a baseline is approved:

- no scheduled retrain cadence is active
- reruns remain manual and artifact-driven

This preserves the current policy that exploratory benchmark work should not quietly become production behavior.

## 5. Trigger Rules

### Retrain Triggers

Run a scheduled retrain only when:

- enough new approved-season games have accumulated since the last approved training artifact
- no blocking validation drift is present
- no unresolved upstream schema or lineage issue is active

### Repair Triggers

Run a repair when:

- validation drift is confirmed
- a reader-visible bug is confirmed
- a source-data correction invalidates the current active artifact

### Benchmark Refresh Triggers

Run a benchmark refresh when:

- the comparison contract changes materially
- a new candidate family or feature set is introduced
- approval status is being reconsidered

## 6. Operational Guardrails

- every run class must emit dated artifacts
- every run class must preserve source commit SHA and version tuple
- repair runs must never silently replace the current active model without a reviewable artifact trail
- benchmark refreshes must not automatically activate a new model
- scheduled retrains must use the currently approved family/config only, not exploratory variants

## Conclusion

The rollout cadence is:

- weekly scheduled retrains after approval
- ad hoc targeted repair runs when required
- benchmark refreshes only when the comparison contract changes or approval is under review

This keeps operational freshness, repairability, and model-governance work clearly separated.
