# RSO-YAHOO: defects found by the offline Yahoo daily acceptance packet

Base HEAD `3f127f485` (octoberBranch). The defect is pinned as `it.fails` in
`web/lib/rosterScheduleOptimizer/dailyAcceptance.yahoo.test.ts`. When it is fixed, change that `it.fails` to `it`.
No product source was edited.

Before writing this up, the `it.fails` case was run once as a plain `it`. It failed only at its final assertion
(test line 189). The earlier assertions passed: a fully verified import with matchup, roster, availability and
acquisitions all true, and `rules: false`.

---

## Y1: `capabilities.rules: false` carries no limitation naming the unverified rule facts

- **Severity:** low to medium.
  - The planner still refuses acquisitions under unknown timing, and `planRoster` adds its own search limitation
    ("Add/drop plans need acquisition-effective timing…").
  - But the provider layer's account of what is unverified is silent, and the UI builds its "partial provider
    inputs" state from that account.
  - This conflicts with the beta rule that `capabilities.rules: false` is never presented as complete rules.
- **Where:**
  - `web/lib/integrations/yahoo/rosterPlanning.ts:435`: `acquisitionTiming: "unknown"` is always set.
  - `web/lib/integrations/yahoo/rosterPlanning.ts:437`: goalie minimum `counts: "unknown", penalty: "unknown"` is
    always set.
  - `web/lib/integrations/yahoo/rosterPlanning.ts:468-470`: the only rules limitation, "Verify …; these are not inferred
    from season transaction totals.", names remaining acquisitions and goalie-minimum *progress*. It is emitted only
    when the weekly counter or the credited value is missing.
  - `web/lib/integrations/yahoo/rosterPlanning.ts:576`: `capabilities.rules` is hard-coded `false`.
  - **Downstream (not edited, read only):** `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx:498`
    decides refresh "complete" from `roster`/`availability`/`code`. `:868` decides `partialProviderInputs` from
    `roster`, `availability` and `healthItems`, which are derived from `capabilities.limitations` plus the time-zone
    item. Neither reads `capabilities.rules`.
- **Test:** `(a) … > names the unverified rule facts whenever capabilities.rules is false`
  (`dailyAcceptance.yahoo.test.ts:183`).
- **Input** (synthetic connected league): fresh owned roster; complete discovery (short page); fresh owned week-2
  `roster_adds` counter (1 of `max_weekly_adds` 4); current scoreboard covering the exact horizon; Yahoo time zone
  `America/Toronto`; `minimumGoalieStarts: 3`.
- **Expected:** with `capabilities.rules === false`, `capabilities.limitations` (or `rules.unsupported`) names the
  unverified facts. Those are transaction effective timing and goalie-minimum counting and penalty. Then the health
  list can never come out empty while rules are unverified.
- **Actual:**
  - `capabilities = { roster: true, availability: true, acquisitions: true, matchup: true, rules: false }`.
  - `capabilities.limitations = []` and `rules.unsupported = []`.
  - `rules.acquisitionTiming = "unknown"`, and `rules.goalieMinimum` has `counts` and `penalty` `"unknown"`.
  - Once the manager confirms the time zone, `healthItems` is empty and `partialProviderInputs` is `false`.
- **Suggested fix (for the RSO owner):** in `loadYahooPlanningSnapshot`, push one limitation whenever
  `capabilities.rules` is false. For example: "Yahoo does not report when transactions take effect or how the goalie
  minimum counts and penalizes; confirm them in League rules." Skip it if a future provider read verifies those facts.
  Optionally have the UI read `capabilities.rules` directly. That is a UI copy/logic change for the UI owner, not this
  lane.

## Observations (no defect)

- `currentProviderPeriod` returns the verified current-week dates even when `max_weekly_adds` is missing or 0. It
  carries dates only, never an allowance, and the planning periods stay `[]`. The suite pins this.
- Discovery that ends with a short page is "complete" for listed players. A catalog player Yahoo never lists still
  stays `unknown`, never available. The suite pins this.
- A manager-entered acquisition period can fill an unverified Yahoo allowance (per scenario b's "overrides fill
  gaps"). It is marked by `evidence.managerRules` (partial), not as provider evidence.

---

**Resolution (RSO-Y1, 2026-10-25, uncommitted):** Y1 is fixed. The loader now names every unverified rule fact in one
limitation, and the case is a plain `it` regression test. The UI follow-up and hashes are in RECEIPT-2.md.
