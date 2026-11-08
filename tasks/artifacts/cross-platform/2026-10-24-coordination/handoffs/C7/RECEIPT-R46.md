# C7 review R46: `08e583311` (FORGE week-ahead), `5aa3f8711` (capacity label, FR18 spec), `4ed3a6220` (FR9-D1/D2), `5aa9ba5e0` (Yahoo waiver rules, provider run proofs)

**Verdict: accept with limits.**
- All four commits do what they claim, and each new test fails on its parent.
- **Must change before release:**
  - **G1 (release gate):** the producer closure at HEAD is a new **`87edd78f…`** (194 modules, 0 findings), and it isn't allowlisted. List it with a commit-backed receipt, or every new uncaptured run is withheld.
- **Should change, but not a safety issue:**
  - **C1 (low):** the category-mode summary metric is now permanently "—", with copy promising a value.
  - **U1 (low-medium):** manual opponents that used to mean "nothing remaining" now show every category unknown until zeros are typed in, and the UI doesn't say so.
- Other notes: W1 and W2.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git mutations, no `GIT_DIR`, no production reads.
- I reviewed the **commits** (`git archive` at `/private/tmp/c7-r46`), not the working tree.
- Tests ran under the outbound network-deny preload with `TZ=UTC`, and with `FORGE_PROJECTION_DAYS_AHEAD`, `FORGE_RESERVE_PASS_ENABLED` and `RSO_YAHOO_DIET` unset.
- Evidence is in `r46-evidence/`.

## Tests

| Run | Result |
| --- | --- |
| **HEAD `5aa9ba5e0`**: bridge, pipeline, categories packet, planning, reproducibility, CategoryGains, the RSO component, Yahoo rosterPlanning, yahooDiet | **709/709** |
| **Week-ahead parent** (`f98312c9b`, with its tests) | **143/157.** The 13 pipeline `FORGE_PROJECTION_DAYS_AHEAD` cases fail (parsing, 6 days ahead, keep going past a failed date and resume), and so does "reads runs dated through seven days ahead, and lets a later run of a date supersede an earlier one". |
| **Capacity-label parent** (`08e583311`, with its RSO test) | **218/220.** The 2 "labels the plan totals when the lineup was chosen by schedule_capacity" cases fail. |
| **FR9 parent** (`2d815ee1c`, with its tests) | **200/209.** Both former `it.fails` cases now fail on the parent, plus the fixture updates the new D1 semantics need (planning 1, reproducibility 5, CategoryGains 1). |
| **Yahoo parent** (`4ed3a6220`, with its tests) | **103/123.** All waiver-import cases (FAAB with verified budget; priority; budget unknown for stale, not-owned, other-team, absent-team, negative, non-numeric and absent balances) and the provider-proof cases fail. |
| **FR18 Playwright spec** | **Discovery only:** `--list` finds 5 tests (19/20/29 slots, mobile tabs, continuity). **Not run:** it needs a dev server and Chromium. The author reports 5/5 in UTC and New York. |
| **Closure** (the committed scanner) | `08e583311` and HEAD `5aa9ba5e0` both give **`87edd78f5dfa96eded8a32927ef184d9266995edf52f395cf5ac6b8565c64f97`**, 194 modules, **0 findings**. The allowlist at HEAD lists `4bf0fce7`, `4c06fd9e` and `c1f0129a`, **not** `87edd78f` (nor R45's `dd6ec27d`). **G1.** |

## 08e583311: FORGE week-ahead

| Question | Evidence | Result |
| --- | --- | --- |
| **Bridge reads proven runs through today+7; newest proven run per date wins** | `to = now + FORGE_DAILY_BRIDGE_AHEAD_DAYS (7)`, from `today − 7`. Per `as_of_date` the **first proven** run in `created_at desc` order wins, and newer unproven runs are counted as withheld, never read. Each run projects only its own date's games, so a game's exact line comes from **that date's newest proven run**. The test "lets the day-of run supersede one written days ahead, before its lineups existed: the early lines never win" fails on the parent. | Holds |
| **Unset env equals today's behaviour exactly** | `forgeProjectionDaysAhead`: unset, empty or invalid (`7`, `-1`, `2.5`, `six`) gives **1**, so the dates are `[date, date+1]` with goalie `endDate = date+1`, exactly the old `projectNextDay: true`; `"0"` gives the run date only. **One stored-state difference:** after a **failed** next-day projection, the stage cursor is now persisted as 2, where it stayed at 1 before (the existing test changed `cursor_game_id: 1` to `2`). The stage completes either way, so it isn't re-entered and behaviour is equivalent. A re-entered stage would no longer retry the failed day-ahead date, which is intended. | Equivalent (W1) |
| **Dates ahead are non-blocking** | A failed date with `index > 0` is marked `skipped` with a reason, progress is persisted, and the loop **continues** to later dates. A non-success, non-failed step (for example the deadline) breaks and resumes on the next invocation from the stored cursor (tested: "keeps going past a failed date ahead, and resumes after the last handled date"). The run date's downstream stages aren't blocked. | Holds |
| **Do stale early runs ever beat day-of runs?** | **For a game's exact line, no:** the newest proven run of that `as_of_date` wins. **For stand-in lines** (games without their own exact line), the bridge's `latest` order is `as_of_date` first, so a run dated further ahead outranks a nearer day-of run computed later. With every date projected (days ahead = 6), every game has an exact line, so stand-ins apply only to gaps. | Holds for exact lines (W2) |
| **Payload and trim order** | The design note's measurements on the production-shaped fixture: a typical week is 806,830 wire bytes against 2.5 MB and 2,862,188 expanded against 4 MB with the reserve pass off; with it on, 5,513,616 against 6 MB; the maximal week with the reserve pass on withholds reserves (as today). No lineup line is trimmed within 7 days; trimming begins only past 14 days and keeps the earliest games. The bridge's byte budgets are unchanged in code. | Holds (measurements are the author's) |

| # | Severity | Note |
| --- | --- | --- |
| **W1** | Info | Unset env isn't **byte**-identical in stored state: after a failed next-day projection, `projection_execution.cursor_game_id` is 2, not 1. There's no behaviour difference, because the stage completes. |
| **W2** | Info | **Stand-ins prefer the furthest-dated run.** For games **without** their own line, the stand-in comes from the player's furthest-dated run (`as_of_date` first). A future-dated run written earlier can therefore supply the stand-in over a later day-of run for a nearer date. With full week-ahead coverage, stand-ins are rare. If partial coverage (for example days ahead = 2) is used, consider ordering stand-ins by `issuedAt` first. Similarly, `teamLatestDate`, which drives "missing from his team's latest run" and reserve membership, becomes the team's **furthest-dated** run. |

## 5aa3f8711: capacity label and the FR18 spec

- **Label:** "Lineup by schedule capacity" appears when `selectionMethod === "schedule_capacity"`, plus "; totals priced from approved projections" when `projectedValue` is known (tested both ways; fails on the parent).
- **The spec is isolated and network-blocked:**
  - `isolateNetwork(page)` aborts every non-loopback request, returns 503 for unmocked `**/api/**`, and returns `[]` for `**/rest/v1/**`.
  - The RSO page has no `getServerSideProps`, so there's no server-side fetch outside the browser routes.
  - The Playwright `webServer` runs `npm run dev:stable -p 3100` with **`PLAYWRIGHT_ISOLATED_NEXT=1`** (separate `.next`).
  - It uses fictional fixtures and a pinned planning time.
- I didn't run it (discovery only).

## 4ed3a6220: FR9-D1 and FR9-D2

- **D1:** `opponentStats` now builds over the **union** of realized and remaining keys, and a component missing on **either** side is `null`. So a missing remaining component makes that category unknown with no win/loss claim, and known categories stay known.
- **D2:** category mode sets `projectedValue = null` always. Comparison eligibility moves to `matchupKnown`, which has the same truth conditions as the old non-null scalar, including the goalie-forfeiture risk, unresolved totals and conflicts. The `planRoster` drop-recommendation limitation now keys on `!baseline.comparisonEligible` in category mode.
- **Is the consumer audit complete? Mostly.**
  - Correctly covered: `benchDecisions`, `planComparison`, `candidatePlanMetrics`, `healthyReserves`, `lineupGaps`, `CategoryGains`, the Matchup panel (`:1124`), and the capacity note (`:1121`).
  - **Missed: the summary metric at `RosterScheduleOptimizer.tsx:1120`.** In category mode it's still labelled "Category outcomes", its value is `number(result?.selected.projectedValue)`, and its detail reads "Projected wins minus losses", or "Shows once projections cover your lineup" when the value is null. Since D2 the value is **always** "—" and the copy promises a value that never comes. **C1 (low): re-label it (for example a per-category win/loss/tie count) or hide it in category mode.**
- **U1 (low-medium, behaviour change for manual matchups):**
  - Yahoo snapshots set opponent `remaining: null` (`rosterPlanning.ts:650`), so live Yahoo leagues are **unchanged**.
  - But the manual "Add opponent totals" starts with `remaining: {}`, and the component merges manual remaining over provider remaining.
  - Before D1, a manager who entered only realized totals got known results (missing remaining was treated as zero). Now **every category stays unknown until a remaining value, including an explicit 0, is entered for each component**, and saved manual workspaces like that turn unknown after release.
  - That's correct under FR9, but the Matchup setup copy doesn't say "enter 0 for nothing remaining". Add that hint, or a "no games remaining" control.

## 5aa9ba5e0: Yahoo waiver rules and provider run proofs

| Question | Evidence | Result |
| --- | --- | --- |
| **Verified pattern; unknown is never assumed** | `yahooPlanningReportedRules` produces `{ present, reportedValue, verified }` per fact. `uses_faab` is verified only for an exact yes or no from a **fresh** settings read. `faab_balance` is verified only in budget mode, from a **fresh, owned, matching team** read (`team_key` and `is_owned_by_current_login`), as an integer from 0 to 100,000. `waiver_time`, `weekly_deadline` and `min_games_played` are verified only for recognised values. `waiver_type` and `waiver_rule` are shown but never interpreted. `rules.waivers` is set **only** when `uses_faab` is verified, with `remainingBudget: null` unless the balance is verified. Every negative case is tested (and fails on the parent). Data health now names only facts that are still unreported. The save schemas accept `rules.waivers` (`workspaceSchema.ts:131`) and the new `yahooLeagueRules` evidence entry (record of `evidence`; limitation lines stay under 200 characters, values cut to 40). | Holds |
| **Provider run proofs never in saves** | The provider route passes `onBridgeRunProofs` into `loadYahooPlanningSnapshot`, which forwards it to `loadPlanningData` and sets nothing on the snapshot (tested: "forwards bridge run proofs to the caller only when asked, never onto the snapshot"). Proofs go only into `compactBridgeForecasts(…, proofs)`, so they land on `bridgeForecasts.proofs`. The client expands the wire without proofs (R45). | Holds |
| **Note** | With the diet flag on, the team resource (FAAB balance) can come from the 30-minute facts cache, so a "verified" balance can trail a just-processed claim by up to 30 minutes. The evidence `asOf` is the settings read time. Minor. | Info |
