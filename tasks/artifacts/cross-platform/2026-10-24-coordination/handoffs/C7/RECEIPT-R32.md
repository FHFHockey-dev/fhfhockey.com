# C7 ticket 32 — review of `3f127f485` (RSO: refresh is never silent on a plan the timeline rejects)

**Verdict: accept.**
- It closes my R30 R1 and R2.
- No false positives on legal plans: 0 of 572 in a converse check over the commit's own 1,122-case matrix.
- The "unverifiable timing" flags don't nag honest manual plans, because the UI never lets an add be selected without verified timing.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commit** (`git archive 3f127f485` at `/private/tmp/c7-r32`), not the working tree.
- Tests ran under the outbound network-deny preload.
- Evidence is in `r32-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **Commit**: `reconciliation.test.ts` plus `dailyAcceptance.manual.test.ts` | **35/35** |
| **Parent mirror** (`reconciliation.ts` reverted to `3f127f485^` = `842ea60f6`) | **32/35.** The 3 new tests fail: the **1,122-case invariant**, "flags a selected add whose effective time … no longer allows" (extended with unknown timing and missing clearance), and "follows the timeline's effective-time order for a next-day add that frees an IR slot (C7 X1/X2)" |
| **My converse control** (`c7/converse.test.ts`: the same invariant matrix, also asserting legal plans get no step-level issue) | 29/29. **1,122 checked: 550 timeline-illegal, all flagged; 572 timeline-legal, 0 false positives** (no step issue, `suggestedSteps === null`). Results in `r32-converse.json`. Run 1 (`conv-run1.log`) failed to load because of my own import-path rewrite in the copied file, a reviewer error. |

## Change (`web/lib/rosterScheduleOptimizer/reconciliation.ts`)

1. **The add-timing branch now has three outcomes:**
   - timing unknown gives "Acquisition timing is unknown; X's effective time cannot be verified.";
   - no earliest time otherwise (a waiver claim with no `waiverClearsAt`) gives "Cannot verify waiver clearance for X.";
   - otherwise the existing too-early check applies.

   All three remove the step (`remove = true`).
2. **Timeline cross-check:**
   - If the refreshed roster is illegal before any move, it adds a single **informational** (`stepId: null`) warning.
   - Otherwise, while the retained steps are timeline-illegal, it finds the **first** step in effective order whose prefix (with its prerequisites) is illegal. It flags that step with the timeline's new limitation text, invalidates its dependents, and repeats.
   - Each pass removes at least one step, so the loop terminates. Cost is O(n²) `buildTimeline` calls per refresh, negligible for selected itineraries of a few steps.

## Checks

| Check | Evidence | Result |
| --- | --- | --- |
| **Are the unverifiable flags false positives on legal, fully known plans?** | No. They fire only when `acquisitionTiming === "unknown"` or `acquisitionEffectiveAt` returns `null` (a waiver claim without clearance). `buildTimeline` rejects exactly those cases ("Acquisition timing is unverified…", "Waiver claim … lacks conditional clearance"), so the plan is already illegal. The converse control found **0** flags on 572 legal plans. | Holds |
| **Do they nag every manual plan with honestly unknown timing?** | No. `chooseCandidate` (`RosterScheduleOptimizer.tsx:896-906`) refuses to add a step when `acquisitionEffectiveAt` is `null`, showing "Verify acquisition timing before selecting an add." or "Verify waiver clearance…". The planner also adds the limitation "Add/drop plans need acquisition-effective timing" (`planning.ts:1300`). So a manual plan under unknown timing contains no add steps to flag. The flags appear only when timing **becomes** unknown, or a clearance time disappears, **after** moves were selected; that is a real loss of verification. | Holds |
| **UX: issue or informational note?** | Step flags are proposals, not actions. The refresh banner reads "Provider refresh found N item(s) to review. Selected moves were kept." (`:1001`), and `suggestedSteps` applies only on explicit acceptance. That is the right weight for a plan the timeline now rejects. The only `stepId: null` addition ("refreshed roster or reserve placements are not legal before any selected move") is informational. It can repeat on each refresh while, for example, a healthy player sits in IR, overlapping the HIR alert. That is accurate, so I'm noting it, not flagging it. | Appropriate |
| **The invariant covers the D1, X2 and X3 shapes** | **D1:** the "IR eligibility lost" mutation across the reserve-plus-dependent-add plan. **X2:** the plan `[swap effective Tuesday dropping lw3, reserve lw2 at 18:00]` plus "next-day timing", and a dedicated X1/X2 test with an exact `"IR capacity exceeded."` issue on `res` and a legal repair. **X3:** "waiver clearance unknown", plus "unknown timing", "waiver clearance later", locks, protections, a spent allowance, removed IR and claimed streamers. It also asserts **the proposed repair is itself timeline-legal**. | Covered |
| **The invariant fails on the parent** | Yes (see Tests). | Holds |
| **No silent replacement; Undo** | `reconcileIntent` still returns only `{ issues, suggestedSteps }` and never mutates `intent`. The acceptance group "(g) refresh-style reconciliation keeps the selected moves and Undo" passes at the commit: "a refresh with better alternatives never replaces the selected moves", and "an invalidating refresh proposes a repair but keeps the moves until accepted, and Undo restores them". | Holds |

## Notes (info)

- The converse property (a legal plan gets no step-level flag) isn't in the committed invariant. Adding the four lines from my control would lock in the no-false-positive guarantee.
- The flagged step's message embeds the timeline's own limitation text (e.g. "IR capacity exceeded."), so copy changes in `planningTimeline.ts` will show up in refresh issues and in the test that asserts them.
