# Validation Run

- Date: 2026-03-31T13:01:09.615Z
- Environment: local
- Commit: a89a8cfb150f286941a6ffc60ef301bff913db62
- Parser version: 1
- Strength version: 1
- Feature version: 1
- Parity version: 1
- Games sampled: 2025021018, 2025021103, 2025021003, 2025021119, 2025021171, 2025021140, 2025020982, 2025021172, 2025021170, 2025021169
- Result: PASS

## Validation Metadata

- Overlap games: 2025021018, 2025021003, 2025021119, 2025021140, 2025020982
- Season range covered: 20252026
- Manual audit reference: /Users/tim/Code/fhfhockey.com/tasks/artifacts/nhl-manual-audit-2026-03-30.md

## Verdict Summary

- Overall result: PASS
- Raw validation result: PASS
- Parity validation result: WARN
- Blocking failure result: PASS
- Approved exception result: PRESENT
- Training-use release result: PASS
- Summary: Raw validation passed, and any remaining parity drift is fully covered by approved exceptions.

## Raw Validation

- Raw validation games passed: `10/10`
- Raw validation games failed: `0/10`
- Raw validation failed game ids: none

## Parity Validation

- Parity samples evaluated: `292`
- Parity samples with any mismatch: `184`
- Parity samples with blocking mismatches: `0`
- Parity samples with approved-exception-only mismatches: `184`
- Parity samples with warnings only: `0`
- Blocking family breakdown: `{}`
- Approved exception family breakdown: `{"nst_gamelog_as_counts_oi":956,"nst_gamelog_as_counts":65}`
- Warning family breakdown: `{}`

## Blocking Failures

- none

## Approved Exceptions

- Approved exception mismatch count: `1021`
- Approved exception sample count: `184`
- Approved exception family breakdown: `{"nst_gamelog_as_counts_oi":956,"nst_gamelog_as_counts":65}`
- Approved exception metric breakdown: `{"shots_blocked":156,"ca":101,"fa":101,"sf":100,"sa":98,"cf":96,"ff":94,"ga":93,"gf":90,"toi":32,"icf":7,"iff":7,"off_zone_faceoffs":6,"off_zone_starts":6,"def_zone_starts":5,"shots":5,"misconduct_penalties":4,"neu_zone_starts":4,"hits":3,"def_zone_faceoffs":2,"faceoffs_lost":2,"faceoffs_won":2,"major_penalties":2,"minor_penalties":2,"giveaways":1,"hits_taken":1,"takeaways":1}`
- Governing artifact: `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-toi-on-ice-resolution-2026-03-30.md`
- Governing artifact: `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md`
- Governing artifact: `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-on-ice-rerun-2026-03-30.md`
- Governing artifact: `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-individual-policy-decision-2026-03-30.md`
- Governing artifact: `/Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md`

## Manual Audit References

- Manual audit artifact: /Users/tim/Code/fhfhockey.com/tasks/artifacts/nhl-manual-audit-2026-03-30.md
- Manual audit coverage note: Use the referenced audit to confirm representative EV, PP/PK, OT, and empty-net spot checks remain in scope for this release review.

## Disposition

- Training use: approved for the current version tuple
- Production rollout: still governed separately by the broader rollout gate
- Next action: record the updated release-gate verdict and resume baseline-model preparation only if that verdict is satisfied
