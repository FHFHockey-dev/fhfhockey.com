# 2026-11-03 Claude: BLSH list-gating proposal (read-only)

## Scope
Read-only proposal for BL/SH list-gating rules (window games, TOI, magnitude, skew-aware chance rule, personalGames 0). No code edits, DB, network, deploys. Started from session local_61ea7da8. Output: `tasks/artifacts/blsh-list-gating-2026-11-03/PROPOSAL.md`; decision to TJ via pop-up.

## Where
- Snapshot read only: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`.
- Scratch scripts (not in repo): `/private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/c553bb52-6485-4f57-b21e-5e7a81af6a0a/scratchpad/` (gate.py, null2.py, more.py, fin.py, null3.py, ex2.py), run with `python3 -I`.
- Implementation hook found: `listWithheldReason(p)` in `web/lib/buyLowSellHigh/displayProfile.ts:160` (cohort gate already landed there as `NO_PERSONAL_HISTORY_LIST_WITHHELD`).

## State
- Analysis done. Brief corrections: 40 listed profiles have <5 window games (36 is the count of profiles with personalGames 1-4, 20 listed); smallest listed |value| is 0.52 (SH) / 1.09 (BL).
- Key finding: G+A flags among eligible profiles (75 BL / 77 SH at mid-p<=0.20) are about what pure Poisson noise predicts (66 / 65); NB(r=3) predicts more than observed.
- PROPOSAL.md written. TJ answered (11-03): eligibility only (5-game window + personal history) as membership; 0.20 and 0.10 mid-p screens as provisional views, not default; rank by existing BLSH evidence order; show actual vs expected; clarify tail meaning; test assumptions and historical usefulness before promotion. Recorded in PROPOSAL.md with clarifications and a two-layer spec.
- Dispersion check done (Pearson ~1.11; Poisson roughly fine, NB r=3 too heavy). Historical usefulness test NOT done (needs next-window data not in the snapshot).

## Next
Done for this task. Open follow-up: historical usefulness test of the screens (outside this read-only scope); implementation after the cohort-listing fix lands.

## Blockers / approvals
None. Diary stays until the follow-up/implementation is handed off.

## Gotchas
- `python3 -I` drops the script dir from sys.path: insert it manually for sibling imports.
- A G+A Poisson tail test flips the BL:SH ratio because a count of 0 is within chance whenever the reference expectation is below ~1.4; use mid-p to avoid the discreteness penalty.
