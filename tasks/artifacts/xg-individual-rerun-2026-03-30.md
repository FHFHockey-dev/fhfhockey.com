# Individual Exact-Count Rerun - 2026-03-30

## Scope

This artifact records the rerun result for remediation task `6.3` in `tasks/tasks-xg-release-remediation.md`.

Question checked:

- after the `6.1` root-cause trace and the `6.2` policy decision, is there any remaining true-bug individual exact-count drift that still needs a code fix?

## Validation Commands Run

- `./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' /tmp/run-baseline-validation.ts`
- `./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' /tmp/summarize-parity-rerun.ts`

## Rerun Result

### Raw Validation

- `10/10` sampled games passed raw-versus-normalized validation.
- `0` sampled games failed raw event identity reconciliation.

### Exact Parity Surface

- total sampled rows: `292`
- failed sampled rows: `184`
- total exact mismatches still reported: `1021`

Those failures are still dominated by:

- on-ice families already handled under the separate on-ice divergence decision
- legacy `NULL` versus `0` handling for `counts_oi.shots_blocked`
- individual exact-count families already documented as approved NHL-correctness divergences

## Individual `nst_gamelog_as_counts` Interpretation

The rerun still shows residual exact mismatches in the individual counts family, but they remain inside already-documented divergence classes:

- `toi`
- `shots_blocked`
- `icf`
- `iff`
- `shots`
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

- no new individual exact-count bug family appeared in the rerun
- the non-TOI individual mismatches line up with the `6.1` root-cause artifact and the `6.2` policy decision
- the TOI mismatches remain covered by the earlier `2.3` conclusion that official NHL-derived TOI is preferred over frozen NST TOI when the two differ

## Decision

Task `6.3` resolves as:

- no additional code correction required for the current residual individual exact-count surface
- rerun evidence is consistent with approved NHL-correctness divergences, not a newly discovered parity-engine defect

## Effect On The Remediation Queue

- individual exact-count remediation is complete for the currently investigated bug surface
- the remaining blocker work stays with:
  - `2.4` sampled parity rerun and exception framing
  - `3.0` formal release-batch validation package
  - `4.0` release-gate re-evaluation
