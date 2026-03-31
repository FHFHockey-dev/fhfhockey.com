# XG Rollout Health Checks

Date: 2026-03-31

## Purpose

Define the minimum post-approval health checks that must run so an approved NHL xG baseline does not silently drift away from:

- the validated NHL event/parity contract
- the adopted calibration contract
- the approved training feature contract

These checks are rollout protections. They are not replacements for full retrains, full benchmark reruns, or release-gate validation artifacts.

## 1. Validation Drift Checks

Validation drift checks answer:

- is the live NHL ingest still reconstructing the validated raw and normalized event surfaces correctly
- are parity-exception classes still the only remaining non-blocking drift classes
- has a new unapproved validation failure appeared since the approval artifact

Required checks:

- rerun raw-vs-normalized validation on a rotating sampled game set
- rerun exception-aware parity validation on the approved overlap sample or a maintained successor sample
- compare the current result shape against the approved training-use release artifact

Required recorded outputs:

- `raw_validation_result`
- `parity_validation_result`
- `blocking_failure_result`
- `approved_exception_result`
- failed game ids if any
- failed sample keys if any
- current `parser_version`
- current `strength_version`
- current `feature_version`
- current `parity_version`
- current source commit SHA

Severity rules:

- `red`
  - any raw validation failure
  - any new unapproved blocking parity failure
  - any version mismatch between the live run and the approved artifact that was not intentionally promoted
- `yellow`
  - approved-exception-only drift still present but materially larger than the approved benchmark package
  - sampled validation coverage missing or stale
- `green`
  - raw validation passes and any remaining parity drift is still fully exceptioned

## 2. Calibration Drift Checks

Calibration drift checks answer:

- does the adopted calibration layer still behave within the acceptance envelope that justified rollout
- has class balance or slice behavior shifted enough that the published probabilities are no longer trustworthy

Required checks once a calibrated model is adopted:

- compare live-scored holdout or refresh-batch results against the last approved calibrated artifact
- measure:
  - log loss
  - Brier score
  - average prediction vs goal rate gap
  - bin-level calibration summary
- inspect minimum required slices:
  - overall
  - strength state
  - rebound
  - rush

Required recorded outputs:

- base model artifact id
- calibration artifact id
- calibration method
- current holdout-positive count
- rebound-positive holdout count
- rush-positive holdout count
- adoptability or rollout-eligibility decision

Severity rules:

- `red`
  - calibration layer missing for a rollout that depends on it
  - calibration rerun violates the approved acceptance rules
  - the calibrated artifact no longer matches the linked base-model artifact identity
- `yellow`
  - metrics degrade materially from the last approved calibrated artifact but remain above the minimum floor
  - slice coverage drops below the preferred monitoring target while staying above the hard minimum
- `green`
  - calibration checks stay within the approved acceptance envelope

Important boundary:

- before a calibrated baseline is actually approved, calibration drift checks remain planned but inactive

## 3. Upstream Feature-Contract Drift Checks

Feature-contract drift checks answer:

- are the live feature rows still shaped according to the approved dataset contract
- has an excluded leaked field, removed field, or newly null-heavy field silently entered the training or scoring surface

Required checks:

- verify the active feature family name and versioned contract references
- verify required feature keys still exist for the active family
- verify excluded leaked fields are absent:
  - `shotEventType`
  - any encoded `shotEventType:*` key
- verify lineage fields required by the dataset contract remain present
- verify null-rate summaries for mandatory numeric and categorical fields do not spike unexpectedly

Required recorded outputs:

- feature family name
- expected required feature keys
- missing required keys if any
- forbidden leaked keys if any
- null-rate summary for mandatory fields
- linked contract references

Severity rules:

- `red`
  - leaked label-revealing fields appear in the live training or scoring feature set
  - required feature keys are missing
  - feature family metadata or contract reference is missing
- `yellow`
  - null-rate drift on important fields exceeds the expected operating band
  - optional feature surfaces disappear unexpectedly
- `green`
  - feature-family metadata, key set, and null-rate profile remain within the approved contract

## 4. Run Cadence

Minimum cadence after an xG baseline is approved:

- validation drift:
  - before each scheduled retrain
  - after any repair run touching ingest, normalization, parity, or feature logic
  - weekly during active current-season rollout
- calibration drift:
  - whenever a calibrated artifact is the published contract
  - before promoting a refreshed calibrated artifact
  - at least weekly during active rollout
- feature-contract drift:
  - before every training-dataset publication
  - before every model or calibration promotion
  - immediately after any feature-family or upstream join change

## 5. Escalation And Response

If any check goes `red`:

- block scheduled retrain promotion
- block baseline or calibration artifact promotion
- open a dated incident or remediation artifact
- rerun the relevant approval package before resuming rollout

If a check goes `yellow`:

- keep the current artifact live only if no `red` condition exists
- record the warning in the next dated benchmark or refresh artifact
- decide whether a targeted repair run is required

## 6. Operator Summary

The rollout health surface must separately show:

- validation drift status
- calibration drift status
- feature-contract drift status
- current approved base-model artifact id
- current approved calibration artifact id if any
- current approved feature family
- last successful validation date
- last successful benchmark or calibration review date

This keeps rollout health visible without collapsing fundamentally different failure modes into a single generic status.
