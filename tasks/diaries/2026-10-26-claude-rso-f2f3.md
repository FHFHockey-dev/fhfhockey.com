# 2026-10-26 · Claude · RSO-MANUAL F2/F3 (Astra audit)

## Scope
F2: separate legal lineup selection from approved totals/comparison in `rosterScheduleOptimizer/planning.ts`
(+ candidatePlanMetrics, planningTypes). F3 (after F2 is committed): stable method approval vs per-issuance lineage
(`rosterScheduleData/planning.ts:227`, `player-forecasts/rsoUsePolicy.ts:74`). Receipts:
`tasks/artifacts/astra-rso-handoff-2026-10-26/slices/F2F3/`. No commit (orchestrator commits F2 before F3).

## Where
octoberBranch @ cd73cbd69. Lease pinned 15:46Z (RSO-MANUAL). Baseline hashes in scratchpad f2f3-baseline.sha.

## State
- [start] Read audit F2/F3, reproduction.test.ts, AMENDMENT-01. Mapped gates: planning.ts playValue, unresolved →
  projectedValue null (:924), inputEligible (:930), comparisonEligible (:960); candidatePlanMetrics :80/:148/:160.
- Design: lineup still chosen by assign() (capacity when assignment denied). Unresolved issues that are
  assignment-only (verified eligibility, unconditional forecast, every scoring target approved for totals+comparison
  with finite stats) no longer null totals/comparison; recommendation (quality) stays ineligible; new
  `selectionMethod` label + limitation.

- [F2 done, uncommitted] planning.ts (pricedOnly/totalsUnresolved/capacitySelected/comparisonInputs/selectionMethod),
  planningTypes.ts (selectionMethod), candidatePlanMetrics.ts (outcomeComparable), candidatePlanMetrics.test.ts (5 tests).
  Suites UTC + NY 2,725/2,725; eslint 0; scoped tsc 0; whole tsc fails only on PROV-GUARD's in-progress
  projections/apiHelpers files (not leased). Receipt: slices/F2F3/RECEIPT-F2.md.

- [F2 committed 978134e22 by orchestrator; F1 committed 5a19f1def.]
- [F3 done, uncommitted] rsoUsePolicy.ts: lineage `<method>@<revision>`; resolver matches the method half; new
  issuanceIntact (revision, issued context, issuedAt<=now<expiresAt) in restrictRsoForecast. rosterScheduleData/planning.ts
  emits issuedParticipationLineage(kind, revisionId). Tests in rsoUsePolicy.test.ts + rosterScheduleData/planning.test.ts.
  Suites UTC+NY 2,743/2,743; in-season 428/428; eslint 0; whole tsc 0 under lock. Receipt slices/F2F3/RECEIPT-F3.md.
- rsoUsePolicy.ts is in the FORGE producer closure: closure hash changes (reported for re-verification).

## Next
Orchestrator commits F3 and re-verifies the FORGE closure hash. Retire diary after commit.

## Gotchas
- zsh does not word-split an unquoted $VAR list of paths; pass suite paths inline.
- RsoUsePolicy.reviews is readonly; build a new policy object in tests.
- Adding a binding field would need workspaceSchema/planningDataTransport edits (strict zod); encode in the existing string instead.
- The 1000-player perf test can time out under heavy combined suite load; it takes ~2.5 s alone.
