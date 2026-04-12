## Relevant Files

- `tasks/tasks-xg-release-exception-resolution.md` - Execution plan for resolving the gap between the approved-exception package and the still-failing formal release artifact.
- `tasks/artifacts/xg-release-validation-2026-03-31.md` - Current formal release-batch artifact, which still records `FAIL`.
- `tasks/artifacts/xg-release-exception-reconciliation-2026-03-31.md` - Reconciliation of the March 31 formal failure classes against the approved exception package, showing which reported failures are already exceptioned.
- `tasks/artifacts/xg-release-exception-policy-decision-2026-03-31.md` - Policy decision recording that approved-exception classes remain visible but should not count as blocking parity failures.
- `tasks/artifacts/xg-release-validation-output-contract-2026-03-31.md` - Required report shape for formal release validation, separating raw failures, true blockers, and approved exceptions.
- `tasks/artifacts/xg-release-validation-2026-03-31-v2.md` - Updated formal release-validation artifact published under the exception-aware contract.
- `tasks/artifacts/xg-release-blockers-2026-03-31-v2.md` - Final blocker review showing no remaining training-use blockers under the updated release contract.
- `tasks/artifacts/xg-release-gate-verdict-2026-03-31-v2.md` - Updated dated release-gate verdict recording that the training-use gate is now satisfied.
- `tasks/tasks-xg-baseline-options.md` - Baseline-model task list reactivated now that the training-use release gate is satisfied.
- `tasks/definitions-and-parity.md` - Canonical parity policy document updated to state that approved exception classes remain visible but are not training-use blockers by themselves.
- `tasks/artifacts/xg-release-blockers-2026-03-31.md` - Current blocker list after the formal release batch.
- `tasks/artifacts/xg-release-gate-verdict-2026-03-31.md` - Current dated verdict recording that the release gate is not satisfied.
- `tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md` - Exact-family disposition showing which residual mismatches are fixed or explicitly exceptioned.
- `tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md` - Policy decision for on-ice and zone-start NHL-correctness divergences.
- `tasks/artifacts/xg-individual-policy-decision-2026-03-30.md` - Policy decision for residual individual exact-count NHL-correctness divergences.
- `tasks/validation-checklist.md` - Formal validation and release-gate checklist that this resolution work must satisfy.
- `web/scripts/run-nhl-xg-release-validation.ts` - Current release-validation runner that still emits a failed batch result.
- `web/lib/supabase/Upserts/nhlXgValidation.ts` - Validation logic that may need exception-aware release interpretation.

### Notes

- Do not resume `tasks/tasks-xg-baseline-options.md` until this task list is complete and a new release-gate verdict is explicitly recorded as satisfied.
- Treat this as a release-policy and validation-contract resolution pass, not as model work.
- If the right outcome is that the release gate remains blocked, record that explicitly rather than forcing a pass.

## Tasks

- [ ] 1.0 Determine whether the current formal parity `FAIL` should remain blocking or be reclassified under approved exception policy
  - [x] 1.1 Reconcile the March 31 formal validation artifact against the approved exception documents and identify exactly which reported failure classes are already exceptioned.
  - [x] 1.2 Decide whether approved-exception classes should still count as blocking parity failures in the formal release artifact.
  - [x] 1.3 Document the release-policy decision, including whether exceptioned drift is acceptable for training use.

- [ ] 2.0 Update the validation and reporting contract if the current fail-state should no longer be blocking
  - [x] 2.1 Define the required output shape for release validation so raw failures, true parity bugs, and approved exception classes are reported separately.
  - [x] 2.2 Update `web/lib/supabase/Upserts/nhlXgValidation.ts` and/or `web/scripts/run-nhl-xg-release-validation.ts` so approved exception classes do not appear as unresolved blockers.
  - [x] 2.3 Add tests covering the new release-validation interpretation rules.

- [ ] 3.0 Re-run the formal release batch under the resolved contract
  - [x] 3.1 Re-run the full release validation batch on the intended training sample.
  - [x] 3.2 Publish a new dated release-validation artifact showing the resolved interpretation.
  - [x] 3.3 Re-review the updated artifact against `tasks/validation-checklist.md` and record the final remaining blockers, if any.

- [ ] 4.0 Record the final training-use release verdict
  - [x] 4.1 Record a new dated release-gate verdict based on the updated release artifact.
  - [x] 4.2 If and only if the verdict is satisfied, resume `tasks/tasks-xg-baseline-options.md` at task `2.0`.
