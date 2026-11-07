# FORGE-QUAL diary (Claude, 2026-10-25)

## Scope
Read-only audit: the forecast qualification plan for RSO and Start Chart. Output only under tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/ (QUALIFICATION-PLAN.md, GAPS.md, DECISIONS-FOR-TJ.md, tooling/). Nothing under web/. No production/DB/network; no git mutations.

## Where
- Canonical checkout, octoberBranch at 0f8a09fff (bridge ticket 2 uncommitted, separate lane).
- Reference: /Users/tim/Documents/Codex/2026-10-25/task-4/RSO-FORGE-CONSOLIDATED-HANDOFF.md

## State
- Handoff read. Three read-only Explore subagents are mapping writers / admission / consumers; I verify their key citations.
- Release C Oct 23–30 block: local sources only say "preserve its boundaries, artifacts, access constraints and reveal rules" (tasks/TASKS/prd-forge-testing-grounds.md:79, :225 open question). The exact rules weren't found locally or in the Codex 10-22..25 folders. Treat it as sealed and ask TJ.

## Next
Synthesize the maps, then GAPS, plan, checker, decisions.

## Checkpoint
- Admission map in; spot-verified rsoUsePolicy.ts:41-46 (empty reviews), :59-65 (64-hex config/artifact hashes required), rosterScheduleData/planning.ts:213 (bindings minted with null hashes). So a native RSO use is denied before any review is consulted: a code gap, not only a missing catalog row.
- The review type has no evidence/threshold fields (rsoUsePolicy.ts:18-26); native-baseline policy/review do (contributionStore.ts:190-226: prospectiveEvidenceRef, ownerApprovalRef).
- tooling/check-readbacks.mjs + 11 node:test self-tests pass (fixtures are synthetic).

## Done
- Wrote GAPS.md (15 gaps), QUALIFICATION-PLAN.md (path map, identity matrix, first target SOG h1 via forge_game_revisions, evidence E1-E3, bounded reads R1-R6 at most 9 per slate, not run), DECISIONS-FOR-TJ.md (D1-D6), and tooling (checker + 11 self-tests + README field paths).
- Writer, admission and consumer maps came from 3 read-only Explore subagents; I re-read every load-bearing citation myself.
- Nothing written under web/; no production/DB/network; no git mutations. Other web/ changes in git status belong to other lanes.
- Open: the E1/E2 extractors (to build in web/ after D3); the Release C rules (D1); D6 is time-bound (Oct 27 04:00Z).
