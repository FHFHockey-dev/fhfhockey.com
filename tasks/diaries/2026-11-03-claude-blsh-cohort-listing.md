# 2026-11-03 Claude: BLSH cohort-only listing gate

## Scope
Players with `personal_n === 0` (cohort-only production reference) must not get a BL/SH list placement; keep them inspectable as withheld with a clear reason. Started from session local_61ea7da8.

## Where
- Branch `octoberBranch` (sole checkout). `web/lib/buyLowSellHigh/` is untracked by git.
- Defect: `supportGap.ts` `score()` sets `researchList` from `fresh && concordant` only; `productionReference.productionGap` already gives `direction: null` for n=0.

## State
- Traced: `score()`/`rankTwoLists` (frozen, parity-tested vs research RANKINGS), `displayProfile.buildDisplaySnapshot` (assembles lists via `rankTwoLists`), `researchSnapshot.parseCurrentResearchSnapshot` (validates saved lists only, pins score version v1), player-card adapters pin "support-conditioned-production-gap-v1".
- Current snapshot 2026-10-28: 152 zero-history profiles, 84 listed (51 BL, 33 SH), all tier provisional.
- `Profile.reference.personalN` == production axis `personal_n` (both `personal?.n ?? 0`).

- Commit 215364214 (displayProfile.ts + .test.ts, first time tracked). TJ chose "Assembly gate (Recommended)". Implemented in `displayProfile.ts` (mapper v2, `listWithheldReason`, reason `no_personal_history_list_withheld`, `counts.withheldNoPersonalHistory`, limits line) + regression test; opt-in packaging counts updated (dry-run-v4: BL 284, SH 182, withheld 259, gated 117; verified with a scratch tsx run, no files written).
- Checks: `npm test -- lib/buyLowSellHigh components/buyLowSellHigh lib/player-cards` 34/35 files pass; the one failure is `lib/player-cards/cardEvidenceVerdict.test.ts` (other lane's dirty file, no BLSH import). `npm run typecheck` exit 2, errors only in currentProcessEvidence.server*, WiGO, retainedBlsh.test (none in touched files).
- Lease note added to CLAUDE-LEASES.json leases[41].amendments (working tree only; file carries other sessions' uncommitted edits, so not committed).

- Follow-up from parent (TJ conditions): confirmed zero vs unknown history split; TJ pop-up chose "Withhold as unknown". Commit 973cb0f0c adds reason personal_history_unavailable_list_withheld, counts.withheldPersonalHistoryUnavailable, tests for gaining history, history becoming unavailable, and Player Cards (retainedBlshEvidence) carrying the same list/rank/reason as the preview. Same test/typecheck results.
- Codex repackaging steps: side-session notes folder, blsh-cohort-listing-codex-repackaging.md.

## Next
Codex repackages the 2026-10-28 snapshot with mapper v2 so the 84 saved listings (51 BL, 33 SH) leave the lists.

## Blockers / approvals
None.

## Gotchas
- A build-time gate does not change the saved JSON; the preview keeps showing the 84 until Codex repackages the snapshot.
