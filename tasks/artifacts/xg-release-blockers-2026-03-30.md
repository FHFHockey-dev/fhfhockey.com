# XG Release Blockers - 2026-03-30

## Purpose

This artifact lists the unresolved blockers found during the `1.2` review of:

- `tasks/validation-checklist.md`
- `tasks/final-implementation-summary.md`
- `tasks/artifacts/xg-baseline-validation-2026-03-30.md`
- `tasks/artifacts/nhl-manual-audit-2026-03-30.md`
- `tasks/post-drift-retry-verification.md`

The scope here is training-use release readiness, not production-reader cutover.

## Resolved Prerequisites

These release-gate prerequisites are currently satisfied:

- phase-1 documentation exists for event taxonomy, strength mapping, parity rules, on-ice attribution, and data-layer boundaries
- live raw ingest is operational for the sampled games
- sampled raw payload presence and sampled event-count parity were confirmed operationally
- the latest manual audit passed for representative EV, PP/PK, OT, and empty-net samples

These are not the current blockers.

## Unresolved Blockers

### 1. Raw Event Identity Is Not Aligned

Status:

- blocker

Evidence:

- `tasks/artifacts/xg-baseline-validation-2026-03-30.md`

Current finding:

- the formal raw-vs-normalized validation failed for all `10` sampled games
- total event counts matched
- event-type distributions matched
- but `matchingEventIdCount = 0` for every sampled game

Why this blocks release:

- the validation checklist requires normalized event identity to reconcile to the raw event stream
- a broken `event_id` contract undermines deterministic replay, event-level auditing, and confidence that later feature and parity rows point at the intended upstream event

Required remediation direction:

- identify why stored `nhl_api_pbp_events.event_id` does not equal upstream raw `play-by-play` `eventId`
- fix the parser and/or ingest contract
- rerun raw-vs-normalized validation and record a passing batch

### 2. Exact-Subset NST Parity Is Still Failing

Status:

- blocker

Evidence:

- `tasks/artifacts/xg-baseline-validation-2026-03-30.md`

Current finding:

- sampled parity comparison failed broadly across:
  - `nst_gamelog_as_counts`
  - `nst_gamelog_as_counts_oi`
  - `nst_gamelog_goalie_all_counts`
- failures were not limited to approximation families
- representative exact-metric drift included:
  - shots
  - `icf`
  - `iff`
  - faceoff counts
  - hits and hits taken
  - assists and points
  - TOI

Why this blocks release:

- the training gate requires parity validation to be passing on the intended release sample, with only documented approximation drift allowed
- current failures are hard errors on exact-count families, not acceptable approximation-only drift

Required remediation direction:

- trace the parity mismatches back to event parsing, inclusion logic, on-ice attribution, and TOI segmentation
- rerun sampled legacy comparison after each fix
- record a passing or explicitly exceptioned parity batch

### 3. The Validation Package Is Not Yet Complete Enough As A Formal Release Record

Status:

- blocker

Evidence:

- `tasks/validation-checklist.md`
- `tasks/artifacts/xg-baseline-validation-2026-03-30.md`

Current finding:

- the checklist requires release-batch metadata including:
  - environment
  - season range
  - `parser_version`
  - `strength_version`
  - `feature_version`
  - `parity_version`
  - source commit SHA
  - explicit pass/fail status and exceptions
- the current dated validation artifact captures the sample and the fail outcome, but it is not yet a complete formal release record under that metadata contract

Why this blocks release:

- even if the technical issues were fixed, the release package is not complete until the recorded validation batch satisfies the checklist metadata contract

Required remediation direction:

- rerun the validation package with full release metadata captured
- store the final pass/fail artifact as the formal gate record

## Non-Blockers For Training Use

These remain relevant, but they are not the gating issues for baseline-training approval right now:

- production-reader cutover planning
- parity publication storage migration
- large historical backfill hardening
- downstream reader migration order

Those matter later, but the current training-use gate is already blocked before reaching them.

## Current Summary

The release gate for baseline-model training is not satisfied.

The smallest accurate blocker set is:

1. fix raw event identity alignment
2. fix exact-subset parity drift
3. rerun and record the validation package with complete release metadata
