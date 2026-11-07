# 2026-11-04 · Claude · BLSH lists (displayProfile mapper v3)

## Scope
Implement TJ decisions 1, 2, 5 and the short-window gate in `web/lib/buyLowSellHigh/displayProfile.ts` + `.test.ts` only. UI and repackaging go to Codex via `tasks/artifacts/blsh-lists-2026-11-04/CODEX-HANDOFF.md`.

## Where
- Branch `octoberBranch`, base `f98d28dc7`.
- Files: `web/lib/buyLowSellHigh/displayProfile.ts`, `displayProfile.test.ts`, handoff artifact, this diary.

## Decisions (TJ pop-up, 2026-11-03)
- List order: league-scoring gap (FHFH Standard points, expected minus observed, in the list's direction), not the frozen tier/|index| order.
- FHFH-gap sign disagreeing with the list side: withhold as conflicting (`headline_track_conflict_list_withheld`).

## Read-only numbers, 2026-10-28 display snapshot (python3 -I)
- Listed 448 → eligible at ≥20 personal games + 5-game window: 310 (BL 179: F 110/D 69; SH 131: F 93/D 38).
- After the headline-conflict gate: 281 (BL 169: F 103/D 66; SH 112: F 82/D 30).
- Top-25 overlap between orders (evidence vs league), BL F/BL D/SH F/SH D: 19/18/21/23.

## State (done, awaiting orchestrator)
- Commits: `42a6752ae` (mapper v3 + test), `dc4171d89` (Codex handoff `tasks/artifacts/blsh-lists-2026-11-04/CODEX-HANDOFF.md`).
- `npm test -- lib/buyLowSellHigh lib/player-cards components/buyLowSellHigh`: 562 passed, 1 failed (`cardEvidenceVerdict.test.ts` studio status line; renders a page, does not touch the mapper), 4 skipped.
- `npm run typecheck` exit 2. Mine to fix elsewhere: `components/blshTrade/fixtureEvidence.ts` (trade lane) needs the new score fields and track role. Not mine: `currentProcessEvidence.server*.ts` (Buffer typing, untracked baseline work) and `retainedBlsh.test.ts:134` (Buffer).
- v3 counts on pinned 10-26 source (vite-node run): BL 228 (F 140/D 88), SH 138 (F 98/D 40).

## Ticket 2: opportunity mapping (11-04)
- TJ pop-up: opportunity is provisional context, not a gate, until validated historically; never withhold only for (b) unavailable or differing comparisons; ranking stays on the league gap.
- Added `DisplayProfile.opportunity` (status, both comparisons, assessment, changes, listCheck with applied: false), `opportunityNotAttached()`, counts, and reason texts. 28 mapper tests pass.
- Typecheck exit 2. The trade fixture now fails only for the missing `opportunity` field (fix: `opportunityNotAttached()`). The other errors are unchanged and not mine.

## Next
- When the baseline lane lands `reference.historyStatus` / `insufficientHistory` in `currentWindows.ts` (uncommitted as of 11-04), switch `personalHistoryReason` to read them (unknown vs confirmed zero) instead of inferring from `personalN` + `sourceIds`.

## Gotchas
- Track 0 `fantasy_points` = FHFH Standard (productionReference `FHFH_WEIGHTS`). The track gap is support-conditioned minus observed; BL ⇔ gap > 0.
- `researchSnapshot.ts` validators require contiguous `rank` per side; the per-position rank is a new field.
