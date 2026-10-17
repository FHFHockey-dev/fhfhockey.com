# Independent re-review — weekly supplement V2

Verdict: **REJECT pending one P2 compatibility correction.** V2 fixes the originally reported uncovered interval/short-final-day problem. It still admits intraday period transitions that the unchanged planner cannot represent correctly. The original V1 rejection remains preserved.

## P2 — continuous union coverage does not ensure a unique lineup period for each local date

Location: `web/lib/rosterScheduleOptimizer/providerRules.ts:19–23`, returning success for adjoining intervals without checking their compatibility with the planner's date-based window assignment.

The new continuous interval sweep is correct for union coverage. However, `lineupPeriodAtDate` assigns each **entire local date** to the period containing its local midnight. The unchanged planner uses this lookup at `planning.ts:530–563` to group that day's games and select the roster at that period's lock. A transition between periods during the day is therefore unrepresentable by that lookup, even when the two periods have no gap or overlap.

The new positive `gap=false` control at `providerRules.test.ts:163–171` supplies a concrete source-level counterexample:

- Selected range: October 26–November 1, `America/New_York`.
- First period: start/lock `2026-10-26T04:00:00Z`, end `2026-11-01T06:00:00Z`.
- Second period: start/lock `2026-11-01T06:00:00Z`, end `2026-11-02T05:00:00Z`.

V2 removes the blocker, as asserted by that control. But November 1 local midnight is `04:00Z`, so `lineupPeriodAtDate("2026-11-01", ...)` chooses the **first** period. A November 1 game at `23:00Z` belongs to the second interval and should use its November 1 lock; the planner instead groups it with the first period and uses the October 26 lock. A player acquired before the second lock but after the first can consequently be omitted from a valid later-period lineup, or earlier-period locks can be applied to the wrong game. Continuous coverage has not made the weekly input compatible or unambiguous for this evaluator. This counterexample was assessed from source; no test/planner execution was performed.

Keep the missing-window blocker unless each selected league-local day is wholly covered by the single period returned for that date. Reject an intraday change between different period IDs under the current planner contract. This is a local guard correction; no planner-wide refactor is requested. Retain the valid full-day/week DST and timezone controls, and add a negative adjoining-intraday-period case with a later game/changed lock. The present repeated-hour adjacency control should not claim planner compatibility merely from interval-union continuity.

## Original finding resolved

The corrected sweep begins at the first selected league-local midnight and requires coverage through midnight after the final selected date using existing timezone helpers. A positive gap returns false; an interval ending early does not reach the terminal boundary. The one-second final-day/evening-game, intraday gap, spring-forward shortfall and fall-back shortfall regressions address the original P2. The issue above concerns a different property: agreement between supplied interval boundaries and the unchanged daily grouping algorithm.

The exact missing-limitation filter, manager-applied/missing-provider gates, unrelated unsupported rules, provider authority and partial manager provenance remain narrowly preserved.

## Exact reviewed V2 pins

These are reviewed/rejected V2 pins, not accepted release hashes:

| Path | SHA-256 |
| --- | --- |
| `web/lib/rosterScheduleOptimizer/providerRules.ts` | `f28ea1f2332debfb984b8cc9049a926298844c93552c3953742d0c953addf249` |
| `web/lib/rosterScheduleOptimizer/providerRules.test.ts` | `9475f1dd1ea47c75018f7dc7658efb2fe67d6ee2993aa09b001e43bc4bca8ee0` |

- `receipt.json`: `001f8b9ff337fe683c86947bd145bbef6a0cda50a45c478dab02def20949761a`
- `change.patch`: `95688810105a70ec224c8479379725a4d3c962dc9d037f7cf92fd1de77493d42`
- `files.sha256`: `00ecc969759ed41a8366190cb60c466c61e000b6fcc85aefc6f475411e1bad88`
- Original preserved `independent-review.md`: `4d51202070a4547316c00e3bc9cdd88bd564446c14a1bec1b7b1ec86056bb428`

Both V2 current pins match the receipt. Both retained original before copies match `before.json`; offline patch reconstruction reproduces both V2 files exactly. The source pair remains outside the separately frozen 27-file forecast cohort. The author reports that cohort remains unchanged; its compiler receipt does not cover this new pair.

## Verification and limits

The retained author receipt reports 26/26 focused tests passed, scoped ESLint exit 0 with empty output, and a whitespace check passed. Source, assertions and receipt were inspected; no tests were rerun.

Only read-only source/artifact inspection, hashes and textual patch reconstruction were performed. This sidecar is the only reviewer-written file. No application source edit, compiler, build, browser, live/account/provider/database request, model execution or private-pilot evidence/label read occurred. Correction and same-peer bounded re-review remain required. No release or private-pilot approval is implied.
