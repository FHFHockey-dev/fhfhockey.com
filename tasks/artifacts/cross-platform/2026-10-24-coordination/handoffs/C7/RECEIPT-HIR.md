# C7 independent review — HIR healthy reserves (uncommitted)

**Verdict: accepted with limits.**
- The duplicate drop notice is removed through a narrow seam.
- The two gain-text corrections name the true cause.
- **Limits:**
  - the parent wiring is verified by types and helper tests, not by a rendered assertion;
  - the filter matches by player, not by reason (O1).

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git, no live reads. Tests ran under the outbound network-deny preload. Evidence is in `r18-evidence/hir/`.

## Pins

- **All five paths equal `RECEIPT.md`:**

  | Path | Hash |
  | --- | --- |
  | `healthyReserves.ts` | `91b99377…` |
  | `healthyReserves.test.ts` | `d88f4686…` |
  | `HealthyReserveAlert.tsx` | `985f698d…` |
  | `HealthyReserveAlert.test.tsx` | `20ff1db9…` |
  | `RosterScheduleOptimizer.tsx` | `a30eba6c…` |

- **`hir.patch`:** `b65f0872…`.

## Code read

| Item | Evidence | Result |
| --- | --- | --- |
| **Drop-notice filter in `RosterScheduleOptimizer.tsx`** | Exactly three edits:<br>- the import;<br>- `dropBlockers = gapReport ? withoutHealthyReserves(gapReport.projectionBlockers, healthyReserves) : []`;<br>- the first drop notice now renders `dropBlockers` instead of `gapReport.projectionBlockers`.<br>The condition `!gapReport.bestDrop && …length > 0`, the `unprojectedDrops` notice, the row chips and `lineupGaps.ts` are unchanged. | Holds |
| **Nothing silently lost** | The removed blockers name only players that `HealthyReserveAlert` lists. The alert renders whenever `result` exists (`:1043`), `gapReport` is non-null only when `result` is, and the alert returns null only when there are no reserves. So every suppressed row's player is still named in the alert, with its move. Lineup-wide `playerId: null` blockers always stay. | Holds |
| **Gain text** | Both values null now says "Gain unknown until the lineup passes the rule check", the true cause: both are null only when a lineup fails the rule check. Unknown points with ≤ 0 added games now says "No added active games this week" instead of the false "No projected gain". "No projected gain" stays only for a known gain of ≤ 0. | Holds |
| **Known healthy vs unknown injury, DTD/O/IR/IR+, partial data** | Unchanged. Only `injury === null` from a live and complete read is flagged. The receipt's "already satisfied" rows match the code and tests. | Holds |

## Tests

**34/34 pass** (`hir.json`): healthyReserves 9, HealthyReserveAlert 2, lineupGaps 10, parent `RosterScheduleOptimizer.points` 13. That reproduces HIR's 21 + 13. The baseline failure log (`alert-baseline-failure.txt`) shows that the new alert test fails on HEAD's alert.

## Limits and observations (to HIR)

| # | Item |
| --- | --- |
| **L1** | No rendered test covers the parent's drop notice. The wiring is checked only by `tsc` and the pure helper's tests, as the receipt says. A small render test (a healthy-IR fixture where the "No drop suggested" notice is hidden and an injured-ineligible blocker stays) would lock it in. |
| **O1** | `withoutHealthyReserves` drops **every** blocker that names a flagged player, whatever its reason. Today that is safe: on an illegal lineup the blocker list is replaced by the reserve-eligibility rows, and a healthy player in IR without eligibility makes the lineup illegal. But if a flagged player ever had a *different* blocker (e.g. "has unknown projected points" on a legal lineup, where Yahoo lists IR eligibility for a healthy player), it would also be hidden. Filtering on the reserve-eligibility reason as well would make the helper match its stated intent exactly. |
| **O2** | Policy questions 1–3 (DTD-in-IR+ note, two flagged players competing for one spot, weekly IR activation after lock) are correctly left to TJ. No Yahoo rules were invented. |
