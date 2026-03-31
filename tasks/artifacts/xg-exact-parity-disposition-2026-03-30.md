# Exact Parity Disposition - 2026-03-30

## Scope

This artifact records the final disposition for remediation task `2.4` in `tasks/tasks-xg-release-remediation.md`.

Question addressed:

- after the sampled parity reruns and follow-up remediation work, do exact families now pass or have explicitly approved, documented exceptions?

## Inputs Considered

- `tasks/artifacts/xg-parity-rerun-2026-03-30.md`
- `tasks/artifacts/xg-toi-on-ice-resolution-2026-03-30.md`
- `tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md`
- `tasks/artifacts/xg-on-ice-rerun-2026-03-30.md`
- `tasks/artifacts/xg-individual-root-causes-2026-03-30.md`
- `tasks/artifacts/xg-individual-policy-decision-2026-03-30.md`
- `tasks/artifacts/xg-individual-rerun-2026-03-30.md`
- `tasks/definitions-and-parity.md`

## Current Exact-Parity State

Exact parity does not fully equal frozen NST row-for-row across the sampled overlap set.

That is no longer the governing question.

The governing question is whether every remaining exact mismatch is either:

- fixed, or
- covered by an explicit, documented policy decision

Current answer:

- yes

## Resolved Exact-Family Bugs

The following blocking bug classes were corrected earlier in this remediation track:

- raw event-id reconciliation between normalized events and raw NHL play-by-play
- bigint-string shift identifier normalization breaking skater exact-count accumulation
- duplicate-window TOI inflation in the shift layer
- zone-start overcount that treated every on-ice faceoff as a zone start

## Remaining Exact Mismatch Buckets And Their Disposition

### 1. Official NHL TOI Versus Frozen NST TOI

Disposition:

- approved NHL-correctness divergence

Rationale:

- representative TOI checks matched official NHL gamecenter boxscore after the shift fixes
- frozen NST still differs on some rows
- project policy is to prefer NHL-derived correctness

Supporting artifact:

- `tasks/artifacts/xg-toi-on-ice-resolution-2026-03-30.md`

### 2. On-Ice And Zone-Start Exact Mismatches

Examples:

- `cf`, `ca`
- `ff`, `fa`
- `sf`, `sa`
- `gf`, `ga`
- zone starts
- zone faceoffs

Disposition:

- approved NHL-correctness divergences when the remaining difference is due to frozen NST boundary conventions, legacy-only bookkeeping, or the intentional `NULL` versus `0` comparison policy

Rationale:

- the real zone-start implementation bug was fixed
- remaining drift is bounded to documented NHL-versus-NST boundary behavior and validator-policy differences

Supporting artifacts:

- `tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md`
- `tasks/artifacts/xg-on-ice-rerun-2026-03-30.md`

### 3. Individual Exact-Count Residuals

Examples:

- faceoffs won and lost
- shots
- `icf`
- `iff`
- shots blocked
- penalty-family splits
- hits and hits taken
- giveaways
- takeaways

Disposition:

- approved NHL-correctness divergences unless a future audit shows parity differs from direct included-event reconstruction from normalized NHL rows

Rationale:

- the residual investigation found no new parity-engine bug in this surface
- parity now matches direct included-event reconstruction for the representative cases
- remaining disagreement is frozen NST versus NHL event credit or classification

Supporting artifacts:

- `tasks/artifacts/xg-individual-root-causes-2026-03-30.md`
- `tasks/artifacts/xg-individual-policy-decision-2026-03-30.md`
- `tasks/artifacts/xg-individual-rerun-2026-03-30.md`

## Exact-Family Verdict For Task 2.4

Task `2.4` is satisfied.

Reason:

- exact families do not all numerically match frozen NST
- but every remaining sampled exact mismatch is now either:
  - fixed already, or
  - covered by an explicit documented exception under the approved NHL-correctness policy

## Important Boundary

This disposition does not mean future exact mismatches are automatically acceptable.

A future exact mismatch must still be treated as a bug candidate if:

- normalized NHL rows are wrong
- parity output disagrees with direct included-event reconstruction from the same normalized rows
- inclusion or classification rules are applied inconsistently

## Effect On Release Work

This completes the sampled exact-parity blocker analysis for task `2.0`.

The remaining release-blocker work now moves to:

- `3.0` formal release-batch validation packaging
- `4.0` re-evaluating the training-use release gate using the finalized validation artifact
