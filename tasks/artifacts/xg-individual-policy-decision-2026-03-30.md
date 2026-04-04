# Individual Exact-Count Policy Decision - 2026-03-30

## Scope

This artifact records the policy decision for remediation task `6.2` in `tasks/tasks-xg-release-remediation.md`.

Question decided:

- which remaining residual individual exact-count mismatches should be treated as true bugs versus approved NHL-correctness divergences?

## Inputs Considered

- `tasks/artifacts/xg-individual-root-causes-2026-03-30.md`
- `tasks/definitions-and-parity.md`
- prior project decision that NHL-derived correctness wins over frozen NST edge-case behavior

## Decision

The remaining residual individual exact-count mismatches are approved NHL-correctness divergences unless a concrete parser, inclusion-rule, or event-crediting bug is later demonstrated.

This applies to the current residual families investigated in task `6.1`:

- faceoffs won and lost
- shots
- `icf`
- `iff`
- shots blocked
- penalty-family splits
- hits and hits taken
- giveaways
- takeaways

## What Still Counts As A True Bug

The following still count as true bugs and must be corrected if discovered:

- a normalized event row drops or rewrites an upstream NHL participant id incorrectly
- parity counts diverge from direct included-event reconstruction using the same normalized NHL event rows
- inclusion rules exclude or include events inconsistently across parser, validator, and parity paths
- a penalty-family classification contradicts the documented NHL-derived classification rule we have versioned

## What Is Now Treated As An Approved Divergence

The following are not phase-1 blocking bugs when frozen NST disagrees:

- frozen NST faceoff win/loss credit differing from explicit NHL `winning_player_id` and `losing_player_id`
- frozen NST shot-family totals differing from explicit NHL shot-event ownership or blocked-shot credit
- frozen NST penalty-family buckets differing from documented NHL duration-based classification
- frozen NST hit, giveaway, takeaway, or hits-taken totals differing from explicit NHL player credit

## Release Implication

These residual individual exact-count differences do not block release by themselves under the approved NHL-correctness policy.

They should remain documented as:

- approved methodology differences from frozen NST
- not as unresolved parity-engine defects

## Follow-Up Rule

If a future audit finds a residual individual mismatch where:

- direct included-event reconstruction from normalized NHL rows and parity output disagree

that mismatch must be reopened as a true bug candidate rather than automatically waived by this decision.
