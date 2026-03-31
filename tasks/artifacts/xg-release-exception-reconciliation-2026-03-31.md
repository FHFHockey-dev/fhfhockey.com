# XG Release Exception Reconciliation - 2026-03-31

## Scope

This artifact records the reconciliation result for task `1.1` in `tasks/tasks-xg-release-exception-resolution.md`.

Question addressed:

- which failure classes reported in the March 31 formal release-validation artifact are already covered by explicit approved-exception documents?

## Inputs Reviewed

- `tasks/artifacts/xg-release-validation-2026-03-31.md`
- `tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md`
- `tasks/artifacts/xg-toi-on-ice-resolution-2026-03-30.md`
- `tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md`
- `tasks/artifacts/xg-on-ice-rerun-2026-03-30.md`
- `tasks/artifacts/xg-individual-policy-decision-2026-03-30.md`

## Formal Failure Surface Reported On March 31

The formal validation artifact reported these top exact mismatch metrics:

- `shots_blocked`
- `ca`
- `fa`
- `sf`
- `sa`
- `cf`
- `ff`
- `ga`
- `gf`
- `toi`
- `icf`
- `iff`
- `off_zone_faceoffs`
- `off_zone_starts`
- `def_zone_starts`
- `shots`
- `misconduct_penalties`
- `neu_zone_starts`
- `hits`
- `def_zone_faceoffs`
- `faceoffs_lost`
- `faceoffs_won`
- `major_penalties`
- `minor_penalties`
- `giveaways`
- `hits_taken`
- `takeaways`

## Reconciliation Result

All currently reported formal failure classes are already covered by the approved-exception package.

There is no currently reported metric family in the March 31 artifact that sits outside the documented exception decisions.

## Exception Mapping

### A. Official NHL-Correctness TOI Differences

Covered by:

- `tasks/artifacts/xg-toi-on-ice-resolution-2026-03-30.md`

Reported metric classes covered:

- `toi`

Interpretation:

- representative TOI differences were already adjudicated as official NHL-versus-frozen-NST divergences, not unresolved bugs

### B. On-Ice And Zone-Start NHL-Correctness Divergences

Covered by:

- `tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md`
- `tasks/artifacts/xg-on-ice-rerun-2026-03-30.md`

Reported metric classes covered:

- `cf`
- `ca`
- `ff`
- `fa`
- `sf`
- `sa`
- `gf`
- `ga`
- `off_zone_starts`
- `neu_zone_starts`
- `def_zone_starts`
- `off_zone_faceoffs`
- `def_zone_faceoffs`

Also covered within this bucket:

- `shots_blocked` when the mismatch is the `counts_oi` `NULL` versus `0` legacy-surface behavior already called out in the on-ice investigation

Interpretation:

- these are the exact surfaces explicitly retired as frozen-NST parity targets when the remaining difference comes from boundary conventions, legacy-only bookkeeping, or validator-policy noise

### C. Individual Exact-Count NHL-Correctness Divergences

Covered by:

- `tasks/artifacts/xg-individual-policy-decision-2026-03-30.md`

Reported metric classes covered:

- `shots`
- `icf`
- `iff`
- `shots_blocked`
- `faceoffs_won`
- `faceoffs_lost`
- `minor_penalties`
- `major_penalties`
- `misconduct_penalties`
- `hits`
- `hits_taken`
- `giveaways`
- `takeaways`

Interpretation:

- these were explicitly approved as NHL-event-credit or classification divergences unless a future audit proves parity differs from direct included-event reconstruction from normalized NHL rows

## Important Nuance: `shots_blocked`

`shots_blocked` appears in two different approved-exception buckets:

- on-ice `counts_oi` comparisons, where the frozen legacy surface often stores `NULL` and the new system emits explicit `0`
- individual counts, where blocked-shot credit can differ between frozen NST and NHL public event attribution

This is not an unclassified leak.

It is a metric that spans two already-documented exception classes.

## Net Result

The March 31 formal validation artifact is still marked `FAIL`, but that fail-state is not being driven by any newly unclassified blocker metric family.

Instead, the report is currently counting already-exceptioned drift as unresolved parity failure.

## Conclusion

Task `1.1` answer:

- every currently reported formal parity failure class is already covered by an explicit approved-exception document
- the remaining gap is not missing policy coverage
- the remaining gap is the validation and release-verdict contract, which still treats those exceptioned classes as blocking failures
