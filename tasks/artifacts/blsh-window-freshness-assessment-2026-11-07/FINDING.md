# Separate window recency from observation freshness before scaling capture

The existing native process gate checks every source game's date against the server evaluation date and the request's `maxEventAgeDays` (currently seven). That is different from requiring the **latest game of a five-game window** to be recent. The actual window assembler (`currentWindows.ts:238`) checks the latest game's age, not every game's age. Both that assembler and the broader current-input diagnostic also use a different anchor: `eventThroughDate` rather than the server evaluation date.

This matters even with newly retrieved, correctly authenticated native receipts. In the retained November 1 request's exact selected population:

- 740 profiles, including 644 with five selected game records.
- 594 of those five-game windows have a latest game within seven days of the original November 1 as-of.
- **None** has all five games within seven days of that as-of.
- 45 have all five games within seven days of the October 31 event cutoff instead.

Example: the retained Steven Stamkos window is October 24, 25, 27, 29 and 31. Its most recent game is one day old on November 1, but its first game is eight days old. Fresh capture cannot change those actual event dates.

Consequently, if the current native gate is used unchanged to require admission of every member of these selected windows, fresh receipts alone cannot admit a complete five-game window. This is a compatibility problem for that intended consumer, not proof that the gate violates its presently coded policy. It is not a recount of today's coverage, a model result, or permission to loosen a gate.

## Smallest resolution to review

Keep three questions explicit:

1. Is each retained native observation authenticated, correctly scoped and recent enough as a **source observation**, with original retrieval time preserved?
2. Does the player window contain the required last five completed appearances, and is its **latest event** recent enough under the product's window-recency policy? Older members remain genuinely dated history, never relabeled as today's events.
3. Is the baseline/reference admitted for the intended use? This is separate from either freshness question and leaves 2025–26 reserved.

Before a larger collection, review where these checks belong and pin the consumer/window contract. One possible implementation separates per-row source qualification from whole-window current-use eligibility, with freshness and coverage visible at both levels. It must not let an old window become a current recommendation merely because its native page was fetched today. Do not silently remove the row check, raise seven to an arbitrary number, or change a frozen capture's timestamp. No code/policy change is included here.

## Evidence and verification

- `web/lib/buyLowSellHigh/currentProcessEvidence.server.ts`: the `today - record.date <= maxEventAge` check inside `qualifyGroup`.
- `web/lib/buyLowSellHigh/currentInput.ts`: `eventAgeDays = eventThroughDate - row.date`, separately from capture age.
- `web/lib/buyLowSellHigh/currentWindows.ts`: selected last-five window, with `lastAge` computed from its latest date and `eventThroughDate`; freshness requires `0 <= lastAge <= 7` plus available production.
- `recount.py` authenticates the original request and retained selected profiles/rows by exact hashes. It counts dates only and independently checks all-member ages against the oldest-member formulation. `RESULT.json` records the result and pins.
- Original request timestamp remains November 1; the packet is stale today. No old input was refreshed, no source or score was changed, no provider/DB call was made and no reserved data was read. No application test suite was run for this metadata-only assessment.
