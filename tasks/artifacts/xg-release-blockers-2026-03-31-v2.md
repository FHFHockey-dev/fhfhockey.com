# XG Release Blockers - 2026-03-31 v2

## Purpose

This artifact records the remaining blockers after reviewing:

- `/Users/tim/Code/fhfhockey.com/tasks/validation-checklist.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-release-validation-2026-03-31-v2.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-release-exception-policy-decision-2026-03-31.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-individual-policy-decision-2026-03-30.md`
- `/Users/tim/Code/fhfhockey.com/tasks/artifacts/nhl-manual-audit-2026-03-30.md`

The scope here is training-use release readiness for the current version tuple:

- `parser_version = 1`
- `strength_version = 1`
- `feature_version = 1`
- `parity_version = 1`

## Checklist Outcome

The updated March 31 release artifact satisfies the training-use release checklist.

Why:

- raw validation passed for the intended 10-game sample
- normalized event validation passed
- the formal release artifact records the required metadata
- the formal release artifact now separates:
  - blocking failures
  - approved exceptions
  - release disposition
- blocking failure result is `PASS`
- training-use release result is `PASS`
- the remaining parity drift is documented and versioned under approved exception policy
- the referenced manual audit still covers representative EV, PP/PK, OT, and empty-net scenarios

## Remaining Training-Use Blockers

None.

There are no remaining training-use release blockers for the current version tuple under the approved exception-aware contract.

## Remaining Non-Blockers

These are still real project tasks, but they do not block training use for the current version tuple:

- production-reader cutover from legacy NST-derived surfaces
- parity publication storage migration and durable published-surface rollout
- large historical backfill hardening
- baseline-model training, benchmarking, and selection work that depends on this release gate being satisfied

## Important Boundary

This artifact does not approve production rollout broadly.

It approves training-use release readiness for the current validated sample and version tuple.

Production rollout remains governed separately by:

- the broader rollout checklist
- downstream reader migration decisions
- parity-surface publication readiness

## Conclusion

Final blocker review result:

- training-use release blockers: none
- training-use release readiness: satisfied
- next correct move: record the updated release-gate verdict and, if that verdict is satisfied, resume baseline-option work
