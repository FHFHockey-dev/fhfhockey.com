# C7 ticket 30 — review of `e8e8c293c` (RSO-RECON: fixes for acceptance defects D1 and D2)

**Verdict: accept with limits.**
- **D1 and D2 are fixed**, with no false positives on still-legal plans and no silent replacement of the selected moves.
- **The limits:** two remaining **false negatives** (R1, R2), where the timeline rules a plan illegal but reconciliation proposes no repair. They are the same class of gap as D1, narrower, and not regressions.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no live reads.
- I reviewed the **commit** (`git archive e8e8c293c` at `/private/tmp/c7-r30`), not the working tree.
- Tests ran under the outbound network-deny preload.
- Evidence is in `r30-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **Commit**: reconciliation, planning, daily acceptance, plus my `c7Recon.test.ts` | **181/181** (the owner's 178 plus my 3) |
| **Parent mirror** (`reconciliation.ts` and `planning.ts` reverted to `e8e8c293c^`) | **173/178.** The 5 new or flipped tests fail: the 2 acceptance cases (the former `it.fails`, now `it`), the planning test "keeps a credited goalie minimum satisfied when future start odds are missing", and the 2 new reconciliation tests (reserve recheck; add timing and waiver clearance) |

## D1: reconciliation (`web/lib/rosterScheduleOptimizer/reconciliation.ts`)

**Against `buildTimeline`'s rules (`planningTimeline.ts:36-41, 83-86, 96-100`):**

| Check | Reconciliation | Timeline | Match |
| --- | --- | --- | --- |
| Reserve eligibility | `!step.reservePosition \|\| !player.reserveEligibility.includes(pos)` | same | yes |
| Player on the roster at the step | `!roster.has(id) && !hasRetainedAdd(id, step)`, mirroring the existing drop branch | `!roster.has(player.id)` | yes |
| Reserve capacity | other holders of `pos` ≥ `rosterSlots[pos] ?? 0`. Holders are tracked: removed on a retained drop or an add's `dropPlayerId`, and set when a reserve step is accepted. | after applying, the count > slots | yes (equivalent) |
| Add timing | `acquisitionEffectiveAt(snapshot, player, step.at)` is the **same** helper the timeline uses; it flags `effectiveAt < earliest` | next-day and waiver-clearance checks | yes |

- **Dependent repair:** every new flag calls `invalidateDependents()`, so steps that depend on a flagged step get "A prerequisite step needs repair." The owner's test asserts the exact issue pair and `suggestedSteps: []`.
- **No silent replacement:** `reconcileIntent` only returns `{ issues, suggestedSteps }` and never mutates `intent`. The owner tests assert `intent.steps` is unchanged. The acceptance suite's refresh cases (moves kept until the repair is accepted, Undo restores them) still pass.
- **No false positives:**
  - The owner tests confirm `timelineLegal(...) === true` gives `issues: []` for the base plan and for a retained earlier drop that frees the IR slot.
  - **My X1** (an add at T1 that drops the IR holder, then a reserve at T2): timeline legal, **no issues**.

| # | Severity | Finding |
| --- | --- | --- |
| **R1** | Low-medium (miss, not a false positive) | **Reconciliation walks steps in action (`at`) order; the timeline applies them in effective order.** **My X2:** a next-day add submitted at T1, effective at T3, drops the IR holder, and a reserve move happens at T2. The timeline sees the IR slot still occupied at T2 and calls it **illegal**. Reconciliation frees the slot when it processes the add (by `at`), so it reports **no issue** and `suggestedSteps: null`. The refreshed plan is illegal with no proposed repair, the same shape as D1. **Fix:** release a dropped holder in reconciliation at the add's `effectiveAt`, e.g. order the capacity pass by `effectiveAt` the way the timeline does. |
| **R2** | Low (miss) | **Waiver claim with no clearance time.** `acquisitionEffectiveAt` gives no earliest time when `waiverClearsAt` is missing, so reconciliation doesn't flag the claim. The timeline rejects it ("lacks conditional clearance"). **My X3:** a claim on a waivers player with no `waiverClearsAt` is timeline-illegal, with reconciliation issues `[]`. Unknown `acquisitionTiming` is also left to the timeline by design (owner test). Either flag these as "cannot verify effective time", or say in the refresh UI that plan legality, not reconciliation, is the authority for those cases. |

## D2: projected goalie starts (`web/lib/rosterScheduleOptimizer/planning.ts:895-913`)

- **Change:** once the minimum is met, `projected` = credited + the sum of known start probabilities, as before. But if any selected goalie's probability is unknown, `partialStarts` is true and the readout becomes `null` ("never a partial sum").
- **Order is right:** `risk` is computed **before** the null (`risk = hasMinimum && (projected === null || projected < required)`), so a met minimum is still not at risk. The planning test "keeps a credited goalie minimum satisfied when future start odds are missing" checks this. Coverage and penalty logic are unchanged.
- **UI readout** (`RosterScheduleOptimizer.tsx:1061` at the commit): `Projected: {number(result?.selected.goalie.projected)}`, and `number(null)` is `"—"` (`:77`). It shows unknown, with no NaN and no `null` text.
- **Other readouts:**
  - The goalie chip (`:1058`) shows `credited ?? "?"` / required, which is unaffected.
  - The candidate-detail `GoalieEvidence` (`:1186`) computes its own "known subtotal" label independently, which is unchanged and already labels partial sums.
