# XG Release Blockers - 2026-03-31

## Purpose

This artifact records the remaining training-use release blockers after reviewing:

- `tasks/validation-checklist.md`
- `tasks/artifacts/xg-release-validation-2026-03-31.md`
- `tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md`
- `tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md`
- `tasks/artifacts/xg-individual-policy-decision-2026-03-30.md`
- `tasks/artifacts/nhl-manual-audit-2026-03-30.md`

The scope here is training-use release readiness, not production-reader cutover.

## Resolved Prerequisites

These release-gate prerequisites are now satisfied:

- raw event identity alignment is fixed
- raw-vs-normalized validation passes on the intended 10-game training sample
- the formal release validation package now exists and records:
  - environment
  - season range
  - `parser_version`
  - `strength_version`
  - `feature_version`
  - `parity_version`
  - commit SHA
  - pass/fail status
  - approved exception references
- the latest manual audit still covers representative EV, PP/PK, OT, and empty-net samples

These are no longer the blockers.

## Remaining Blockers

### 1. Formal Parity Validation Is Still Recorded As Failed

Status:

- blocker

Evidence:

- `tasks/artifacts/xg-release-validation-2026-03-31.md`

Current finding:

- the formal release batch records:
  - raw validation passed `10/10`
  - parity samples evaluated `292`
  - parity failed samples `184/292`
  - overall result `FAIL`

Why this still blocks release:

- the training gate requires parity validation to be passing on the intended release sample, with approved approximation or methodology drift documented clearly enough to support approval
- the current formal artifact still reports failure rather than a passing batch with exceptioned drift

What remains to decide:

- whether the current approved-exception package is sufficient to reinterpret the failed parity rows as acceptable release-time divergences
- or whether the validator/reporting contract must be updated so approved exception classes are separated from true blocking failures

### 2. Approved Exceptions Are Documented, But Not Yet Integrated Into The Release Verdict Logic

Status:

- blocker

Evidence:

- `tasks/artifacts/xg-release-validation-2026-03-31.md`
- `tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md`

Current finding:

- we now have explicit policy documentation for:
  - official NHL-correctness TOI differences
  - on-ice and zone-start NHL-correctness divergences
  - individual exact-count NHL-correctness divergences
- however, the release-validation runner still reports the batch as failed because it counts those rows as raw parity failures instead of approved exception classes

Why this still blocks release:

- the release gate cannot be marked satisfied while the formal gate artifact itself still says `FAIL`
- we need a clear release-time interpretation layer:
  - either the current artifact is judged acceptable despite the fail label
  - or the validation/reporting contract is revised so exceptioned mismatches do not appear as unresolved blockers

## Non-Blockers For Training Use

These remain relevant, but they are not the gating issues for the immediate release verdict:

- raw identity reconciliation
- release metadata packaging
- sampled manual audit coverage
- production-reader cutover planning
- parity publication storage migration
- large historical backfill hardening

## Current Summary

The release gate for training use is still not satisfied.

The blocker set is now narrower than it was on March 30:

1. the formal release artifact still reports parity validation as failed
2. the approved-exception package is not yet reflected in the final release verdict logic

## Recommended Next Step

The next correct move is:

1. review the March 31 validation artifact against the approved-exception documents
2. decide whether the current fail-state artifact is still a blocker or whether exceptioned parity drift is acceptable for training use
3. record the new release-gate verdict explicitly
