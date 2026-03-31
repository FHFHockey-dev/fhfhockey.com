# Validation Run

- Date: 2026-03-31T12:28:29.394Z
- Environment: local
- Commit: 5110c181d6f3ef63b639c58eb07d356ed3f98c31
- Parser version: 1
- Strength version: 1
- Feature version: 1
- Parity version: 1
- Games sampled: 2025021018, 2025021103, 2025021003, 2025021119, 2025021171, 2025021140, 2025020982, 2025021172, 2025021170, 2025021169
- Result: FAIL

## Validation Metadata

- Overlap games: 2025021018, 2025021003, 2025021119, 2025021140, 2025020982
- Season range covered: 20252026
- Manual audit reference: /Users/tim/Code/fhfhockey.com/tasks/artifacts/nhl-manual-audit-2026-03-30.md

## Passed

- Raw validation games passed: `10/10`
- Parity samples evaluated: `292`

## Failed

- Parity failed samples: `184/292`
- Parity family breakdown: `{"nst_gamelog_as_counts":144,"nst_gamelog_as_counts_oi":144,"nst_gamelog_goalie_all_counts":4}`
- Top exact mismatch metrics: `{"shots_blocked":156,"ca":101,"fa":101,"sf":100,"sa":98,"cf":96,"ff":94,"ga":93,"gf":90,"toi":32,"icf":7,"iff":7,"off_zone_faceoffs":6,"off_zone_starts":6,"def_zone_starts":5,"shots":5,"misconduct_penalties":4,"neu_zone_starts":4,"hits":3,"def_zone_faceoffs":2,"faceoffs_lost":2,"faceoffs_won":2,"major_penalties":2,"minor_penalties":2,"giveaways":1,"hits_taken":1,"takeaways":1}`

## Approved Exceptions

- /Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-toi-on-ice-resolution-2026-03-30.md
- /Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-on-ice-policy-decision-2026-03-30.md
- /Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-on-ice-rerun-2026-03-30.md
- /Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-individual-policy-decision-2026-03-30.md
- /Users/tim/Code/fhfhockey.com/tasks/artifacts/xg-exact-parity-disposition-2026-03-30.md

## Next Actions

- review failed sections and approved-exception coverage before release-gate review
