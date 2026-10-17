# Independent review — weekly rule supplement

Verdict: **REJECT pending one P2 coverage correction.** The two-file scope and pins are exact, but the new completeness guard can retire the blocker for a partial selected day.

## P2 — require coverage of complete local days, not only their midnights

Location: `web/lib/rosterScheduleOptimizer/providerRules.ts:17–18`, used to remove the missing-window blocker at lines 39–40.

`completeWeeklyWindows` calls `lineupPeriodAtDate` once per selected date. That existing helper tests only the date's league-local midnight. Consequently, windows can cover every tested midnight while leaving part of the selected horizon uncovered. For example, a window ending one second into the final selected day passes the new guard even though that day's evening game is outside the declared window.

Source-level reproducer based on the new `weeklySnapshot()` fixture:

1. Retain the October 5–11 horizon in `America/New_York`, the October 5 `04:00Z` window start/lock, and all existing valid rules.
2. Change the manager window end to `2026-10-11T04:00:01Z`.
3. Put a relevant owned/candidate scheduled game on October 11 at `23:00Z`.

Every midnight checked by the new loop falls inside the window, so the exact missing-window blocker is removed. The evening game is nevertheless later than the window's end. The planner also assigns weekly periods through the same date/midnight lookup (`planning.ts:530–561`), so it does not supply an independent game-time interval guard that repairs this admission. The supplement can therefore enable a supposedly verified weekly comparison using incomplete windows. This path was assessed statically; no test or planner execution occurred.

Keep the blocker unless the supplied windows cover complete league-local day intervals throughout the selected horizon, consistently with the planner's date-based grouping. Reject partial final days and intraday gaps rather than checking representative instants only. Use league-local day boundaries so DST days are handled correctly. Add focused negative cases for the partial-final-day example and an intraday gap, plus a valid complete coverage control. No planner-wide refactor is requested.

## Other reviewed properties

Removal is otherwise narrowly gated: manager windows must actually fill a previously missing provider field, the resulting mode must be weekly, identifiers must be unique, clocks finite and ordered, windows nonoverlapping, locks present and no later than end, and the selected date range bounded. The filter removes only the exact adapter limitation. Unrelated unsupported rules and authoritative provider windows remain intact; manager evidence remains partial, with source/provider arrays preserved. No forecast or availability authority is added by the patch itself.

The existing negative `partial range` test ends before a later selected midnight, so it does not catch this partial-day case. The positive synthetic net-AGP result has no forecast-points claim and does not establish real-account/provider acceptance.

## Exact reviewed candidate pins

These are reviewed/rejected pins, not accepted release hashes:

| Path | SHA-256 |
| --- | --- |
| `web/lib/rosterScheduleOptimizer/providerRules.ts` | `fd731cc5520de95e83f3f5208b56694f275bcf5f619d6e54ffb8b11bcb6a9d69` |
| `web/lib/rosterScheduleOptimizer/providerRules.test.ts` | `e73af1b50023f22281682e48feb17645ea0cb79dafd21949dd4f9eb211628c23` |

- `change.patch`: `0b579dcd67505475477c91824d9a54674f52b135a8d2d117ac237233ed68feb6`
- `files.sha256`: `aad1a3ade64d334f8042e3b4d8b935b4de188a839b9f5d4a5e1144848442b53c`
- `receipt.json`: `48eea25f7c36e41b1ee8b491b9aaf39d8ed7c6a570cd7bdd6b4bd72ffb6108db`
- `before.json`: `34161e31705b285373cb3c509faae03045db2a0ab6904ceff3b85d2037d23274`

Both before copies match their declared hashes; offline patch application reproduces both current files byte-for-byte. Both current source pins match the receipt. The existing 27-file forecast compiler cohort remains unchanged, and neither file belongs to that cohort.

## Verification and limits

The author receipt reports a failing pre-fix missing-window regression, 16/16 passing offline tests after the patch, clean scoped lint and whitespace. Source, assertions and receipt were inspected; no tests were rerun.

Reviewer work was bounded source/test/dependency inspection, hashes and textual patch reconstruction. This report is the only reviewer-written file. No application source edit, compiler, build, browser, live/account/database/provider request or model execution occurred; no private pilot evidence or labels were inspected. This patch is not covered by the earlier 27-file compiler receipt. Correction and focused re-review remain required; private-pilot or release authorization is not inferred.
