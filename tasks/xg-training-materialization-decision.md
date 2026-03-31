# XG Training Dataset Materialization Decision

## Purpose

This document records the materialization decision for baseline task `2.4` in `/Users/tim/Code/fhfhockey.com/tasks/tasks-xg-baseline-options.md`.

## Decision

- `store versioned artifact`

## Meaning

The first baseline-comparison workflow will not rely only on regenerating the training cohort ad hoc from the live feature source.

Instead, each approved baseline dataset build must produce a versioned dataset artifact with:

- a stable dataset name
- a dataset version
- the required lineage metadata from `/Users/tim/Code/fhfhockey.com/tasks/xg-training-dataset-contract.md`
- the feature contract reference from `/Users/tim/Code/fhfhockey.com/tasks/xg-training-feature-contract.md`

## Why This Option Was Chosen

This project is about to compare multiple baseline families:

- unregularized logistic regression
- regularized logistic regression
- gradient boosting

That comparison is much cleaner if all models train against the same frozen dataset artifact instead of regenerating rows on demand from a potentially changed code or database state.

The versioned-artifact approach improves:

- reproducibility
- auditability
- fair model benchmarking
- rerun stability across calibration and ablation passes

## Consequences

The baseline harness must now support:

- dataset artifact naming
- dataset artifact versioning
- dataset-level metadata
- replayable train/validation/test membership under the stored split contract

This adds implementation work in the harness phase, but it reduces ambiguity in later model comparisons.

## Important Boundary

This decision does not yet force a particular persistence medium.

The stored artifact may be:

- a versioned table, or
- a versioned file artifact

That concrete storage shape should be decided during harness implementation as long as the lineage and replay contract remains intact.
