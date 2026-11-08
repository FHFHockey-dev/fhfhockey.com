# RSO-MANUAL: defects found by the offline daily acceptance packet

Base HEAD `32f82b1ee2ad240c3b0614efdf938eab168aa5be` (octoberBranch). Both defects are pinned as `it.fails` in
`web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`. When a fix lands, change that `it.fails` to `it`.
The case should then pass. If it is left as `it.fails`, the suite turns red, which flags the stale marker.
No product source was edited.

Before writing these up, each `it.fails` was run once as a plain `it`. Each failed only at its defect assertion
(test lines 346 and 411); every setup assertion before it passed.

---

## D1: Refresh reconciliation never rechecks selected IR/IR+/NA (reserve) moves

- **Severity:** medium. The contract says refresh must recheck the selected intent and propose repairs; it must
  never silently replace moves. Nothing is replaced here, but no repair is proposed either. The selected plan becomes
  illegal, and reconciliation reports no issue and no suggestion.
- **Where:** `web/lib/rosterScheduleOptimizer/reconciliation.ts:32-49` (first `for (const step of ordered)` loop). It
  has branches for `add` (lines 38-46) and `drop` (line 48) only. The second loop skips reserve steps too:
  `reconciliation.ts:69-78` handles `drop`, then `if (step.type !== "add") continue;`. In contrast,
  `planningTimeline.ts` `apply()` rejects a reserve step when `!player.reserveEligibility.includes(step.reservePosition)`
  or when reserve capacity is exceeded.
- **Test:** `(c) … > refresh flags a selected IR move whose player is no longer reserve-eligible`
  (`dailyAcceptance.manual.test.ts:336`).
- **Input:**
  - Full 17-player daily roster.
  - `lw2` was out with `reserveEligibility: ["IR"]`. An IR slot was open.
  - Selected intent: `[reserve lw2 → IR @ 2026-10-19T14:00Z, add fa1 dependsOn reserve]`.
  - Refresh snapshot: `lw2` is activated, so `reserveEligibility: []` and `injury: null`.
- **Expected:** `reconcileIntent(refreshed, intent, previous)` returns an issue for `reserve` and a dependent issue for
  `add` ("A prerequisite step needs repair."). `suggestedSteps` should be `[]`.
- **Actual:** `issues: []` and `suggestedSteps: null`. Meanwhile `evaluatePlan(refreshed, intent, "agp").legal === false`.
- **Suggested fix (for the RSO owner):** add a `reserve` branch to the first loop.
  - Flag the step (remove = true) when the player is no longer on the roster.
  - Do the same when `step.reservePosition` is missing from `player.reserveEligibility`.
  - Optionally, flag the step when the reserve position's capacity (`rules.rosterSlots[position]`, minus current
    occupants) is exhausted.
  - The existing `invalidateDependents()` then repairs the dependent add.
- **Related gaps (same class, no test added):** reconciliation also does not recheck these timing changes:
  - a changed `rules.acquisitionTiming` (for example `same_day` → `next_day`) that makes a selected `effectiveAt` too early;
  - a later `waiverClearsAt` for a selected waiver claim.

  `buildTimeline` rejects both. Reconciliation is silent on both.

## D2: The goalie "Projected" starts readout counts an unknown start probability as zero once the minimum is met

- **Severity:** low. This breaks "unknown is never zero" in a displayed number. It does not change risk or ranking,
  because `risk` is false once the minimum is met.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:903`:
  `else { startsKnown = false; if (!minimumAlreadyMet) projected = null; }`.
  When `credited >= required`, an assigned goalie start with no probability is skipped. Then line 909
  (`else if (finite(projected)) projected += …`) adds only the known probabilities to `credited`. The result is shown
  as `Projected:` in `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx:1061` (Matchup panel,
  "Goalie evidence").
- **Test:** `(d) … > keeps projected starts unknown after the minimum is met when a start probability is missing`
  (`dailyAcceptance.manual.test.ts:406`).
- **Input:**
  - Thursday check-in, `goalieMinimum { required: 3, credited: 3, counts: "starts", periodStart: 2026-10-19, periodEnd: 2026-10-26 }`.
  - Assigned starts: gA Thu confirmed (1); gB Fri 0.6; gA Sat 0.55; gB Sun probability `null`.
- **Expected:** `goalie.projected === null`, consistent with `expectedStarts === null`. A lower-bound value would also
  work if it carried an explicit "at least" label.
- **Actual:** `goalie.projected === 5.15` (3 + 1 + 0.6 + 0.55), with Sunday's unknown start treated as 0.
  `expectedStarts` is correctly `null`.
- **Note:** this may be deliberate, since the minimum is already met. The owner should decide between null and a
  labelled lower bound. Either way, the UI should not show an unlabelled number that silently excludes unknown starts.

---

**Resolution (RSO-RECON, 2026-10-25, uncommitted):** D1 and D2 are fixed; both cases are now plain `it` regression
tests. The related timing gaps under D1 are covered for verified timing. Details and hashes are in RECEIPT-2.md.
