# XG Release Gate Verdict - 2026-03-31

## Scope

This artifact records the training-use release-gate verdict for remediation task `4.2` in `tasks/tasks-xg-release-remediation.md`.

## Verdict

- `release gate not satisfied`

## Basis For Verdict

The March 31 formal release-validation batch established that:

- raw validation passed on the intended 10-game training sample
- release metadata packaging is now complete
- manual-audit coverage remains in place for representative EV, PP/PK, OT, and empty-net samples

Those are no longer the blockers.

The gate remains blocked because:

1. the formal release artifact still records parity validation as `FAIL`
2. the approved-exception package exists, but it is not yet reflected in the final release-verdict logic

Supporting artifacts:

- `tasks/artifacts/xg-release-validation-2026-03-31.md`
- `tasks/artifacts/xg-release-blockers-2026-03-31.md`
- `tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md`
- `tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md`
- `tasks/artifacts/xg-individual-policy-decision-2026-03-30.md`

## What This Blocks

The following remain blocked:

- baseline-model training
- training-dataset publication for formal model fitting
- resuming `tasks/tasks-xg-baseline-options.md`

## Next Required Decision

Before the gate can move to satisfied, we need one of the following:

- a formal validation artifact that records parity as passing after approved exception handling is applied correctly, or
- an explicit release-policy decision that the current failed parity artifact is still acceptable for training use despite the fail label

Until one of those happens, the correct release verdict remains `not satisfied`.
