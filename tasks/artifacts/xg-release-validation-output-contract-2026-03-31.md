# XG Release Validation Output Contract

Date: 2026-03-31

## Purpose

Define the required output shape for the formal NHL xG release-validation artifact so the report can distinguish:

- raw-ingest or normalized-event failures
- true parity bugs that remain release blockers
- approved exception classes that stay visible but are not training-use blockers by themselves

This contract is the target for the next validation-runner update.

## Required Top-Level Verdicts

Every formal release-validation artifact must publish all of the following verdicts explicitly:

- `overall_result`
- `raw_validation_result`
- `parity_validation_result`
- `blocking_failure_result`
- `approved_exception_result`
- `training_use_release_result`

Required meanings:

- `overall_result`
  - `PASS` only when `training_use_release_result = PASS`
  - `FAIL` otherwise
- `raw_validation_result`
  - `PASS` when raw-vs-normalized validation passed for the intended sample
  - `FAIL` otherwise
- `parity_validation_result`
  - `PASS` when no parity mismatches were found at all
  - `WARN` when parity mismatches exist but all of them are covered by approved exception classes
  - `FAIL` when at least one parity mismatch remains unapproved
- `blocking_failure_result`
  - `PASS` when no unapproved blocker class remains
  - `FAIL` when any unapproved raw or parity blocker remains
- `approved_exception_result`
  - `NONE` when no approved exception class was observed in the sample
  - `PRESENT` when one or more approved exception classes was observed in the sample
- `training_use_release_result`
  - `PASS` when raw validation passed and all remaining parity drift is exceptioned
  - `FAIL` when any unapproved blocker remains

## Required Report Sections

Every formal release-validation artifact must contain these sections in this order:

1. `Validation Metadata`
2. `Verdict Summary`
3. `Raw Validation`
4. `Parity Validation`
5. `Blocking Failures`
6. `Approved Exceptions`
7. `Manual Audit References`
8. `Disposition`

## Section Contract

### 1. Validation Metadata

Must include:

- validation date
- environment
- commit SHA
- sampled game ids
- overlap game ids
- season range covered
- `parser_version`
- `strength_version`
- `feature_version`
- `parity_version`

### 2. Verdict Summary

Must include:

- `overall_result`
- `raw_validation_result`
- `parity_validation_result`
- `blocking_failure_result`
- `approved_exception_result`
- `training_use_release_result`

Must also include one short plain-language explanation of why the current batch passed, warned, or failed.

### 3. Raw Validation

Must include:

- total sampled games
- passed raw-validation games
- failed raw-validation games
- failed raw-validation game ids

If raw validation failed, the artifact must list the failure classes, such as:

- event-count drift
- event-id reconciliation failure
- duplicate `event_id`
- duplicate `sort_order`
- event-type count mismatch

### 4. Parity Validation

Must include:

- parity samples evaluated
- parity samples with any mismatch
- parity samples with unapproved blocking mismatches
- parity samples with approved-exception-only mismatches
- family breakdown
- top metric breakdown

This section must not collapse all mismatches into a single failed count.

### 5. Blocking Failures

This section is required even when empty.

It must list only mismatch classes that remain release blockers after approved-exception reconciliation.

Each listed blocker must include:

- mismatch family
- metric or rule class
- sample count
- reason it is still blocking
- required next action

If there are no blocking failures, the section must say so explicitly.

### 6. Approved Exceptions

This section is required even when empty.

It must list only observed mismatch classes that are already covered by approved exception policy.

Each approved-exception entry must include:

- mismatch family
- metric or rule class
- sample count
- governing exception artifact reference
- short rationale

If approved exceptions are present, they must be visible here rather than counted as unresolved blockers.

### 7. Manual Audit References

Must include:

- manual audit artifact path used for the release review
- whether the current batch still falls within that audit’s covered scenarios or needs a refreshed manual audit

### 8. Disposition

Must include:

- whether training use is approved for the current version tuple
- whether production rollout remains blocked
- next action if training use is still blocked

## Required Interpretation Rules

- Raw-validation failure is always blocking.
- Unapproved parity drift is always blocking.
- Approved exception drift is never invisible.
- Approved exception drift is not blocking for training use by itself.
- A batch may have `parity_validation_result = WARN` and still have `training_use_release_result = PASS`.
- A batch may not have `training_use_release_result = PASS` while `blocking_failure_result = FAIL`.

## Required Data Model For The Runner

The runner should be able to produce, at minimum, these logical buckets:

- `rawFailures`
- `parityBlockingFailures`
- `parityApprovedExceptions`
- `parityWarnings`
- `approvedExceptionRefs`

The important boundary is:

- `parityBlockingFailures` drives the gate
- `parityApprovedExceptions` informs the user and the artifact
- both remain visible in the same report

## March 31 Application

Applied to the March 31 artifact:

- raw validation currently belongs in `PASS`
- approved exception classes belong in `Approved Exceptions`, not `Blocking Failures`
- the current blocker is the report contract itself, because it still labels already-exceptioned parity drift as unresolved failure

That means `2.2` should update the validation runner and interpretation logic, not reopen already-approved policy decisions.
