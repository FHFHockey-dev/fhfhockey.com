# RSO objective switch acceptance, 2026-11-15

**Verdict: PASS, with no defect found and no fix.** The planner and component levels are verified against the master export. Live acceptance is still open (see the end of this report).

- **Source:** `git archive e7477021779d48a11626f6719723e67f0517204a` (current `origin/master`), unpacked to the scratchpad, with `web/node_modules` symlinked. There was no `.env`, Yahoo, network, DB or dev server.
- **Spec:** TJ's criteria from the request. The Master Task List item itself is a ChatGPT page that could not be read.
- **History:** the toggle came in with `317375364` (2026-10-19); PR #431 only touched it. Everything here was tested against what is on master.

## Scenario: SYNTHETIC

No retained sanitized roster was used. Instead, a fixture was adapted from the `planning.test.ts` helpers into `objectiveSwitchScenario.fixture.ts`.

- **League:** points scoring, daily lineups, a two-day week (2026-10-05 and 2026-10-06). Slots are `C:1, G:1, BN:2`, with no acquisition steps (`maxSteps: 0`).
- **Players:** skater `a` (1 pt/game), skater `b` (2 pts/game), and goalie `g` (-3 pts/game, start probability 0.9).
- **Locked slot:** `a` is locked into `C#1` on 10-05.
- **Goalie minimum:** 1 start, 0 credited, counted as starts, window 10-05 to 10-07.
- **Missing projection:** `b`'s 10-06 forecast is removed, in that test only.

## Expected vs observed

| # | Check | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | Most starts plan | Fill every slot that has a game | `a`L C 10-05, `g` G 10-05, `b` C 10-06, `g` G 10-06: **4 GP / -3 pts**, legal | PASS |
| 2 | Best projected points plan | Sit the negative goalie | `a`L C 10-05, `b` C 10-06, G left empty: **2 GP / 3 pts**, legal | PASS |
| 3 | Lock holds under both objectives | `a` stays in C on 10-05 | Same in both plans (`locked: true`) | PASS |
| 4 | Lock is binding | With no lock, `b` takes 10-05 | `2026-10-05:C#1:b` under both objectives | PASS |
| 5 | Goalie minimum is binding | `accept_risk`: the points plan is flagged. `cover`: goalie starts are forced | `accept_risk` gives `risk:true, projected:0`. `cover` keeps the objective as outcome but starts `g` (risk false) and adds a coverage limitation. Most starts has `risk:false` | PASS |
| 6 | Missing projection is not treated as 0 | Totals stay unknown and a limitation is shown | `projectedValue` is null under both objectives (a zero would give -4 or 1). `valueUnknownPlayerIds=["b"]`. The limitation reads "Some scheduled games lack unconditional scoring forecasts; projected outcome is incomplete." The search limitation reads "compares plans on their known part: 1 player has unknown projections" | PASS |
| 7 | How the UI renders a missing value | Not shown as "0" | `number(null)` returns "—" (`RosterScheduleOptimizer.tsx:96`) | PASS (by code read) |
| 8 | The UI objective reaches the actual planner | The `planRoster` intent carries the clicked objective | Pass-through spy recorded `[auto(null), "agp", "outcome"]`, with the real `planRoster` run each time | PASS |
| 9 | Toggle state | Neither button is disabled; `aria-pressed` follows the click | Neither disabled (`pointsGoalAvailable` true, not `readOnlySaved`); pressed state flips | PASS |
| 10 | Tradeoff explained (Compare strip) | Both plans shown with GP and points, and the chosen one marked | "Most starts 4 GP · -3 pts" / "Best projected points 2 GP · 3 pts"; `data-selected` flips | PASS |
| 11 | The plan shown follows the toggle | The Matchup "Selected plan" line changes | "4 active · -3 projected" changes to "2 active · 3 projected" | PASS |

Notes and limits:

- **Rendering:** the UI evidence is **component-rendered (Vitest/jsdom), not browser-observed.**
- **How the UI test gets its plan:** the spy runs the real planner on the synthetic week, with the component's snapshot id carried over. The component only admits a result whose `snapshotId` and `intentRevision` match (`RosterScheduleOptimizer.tsx:757`). The by-position grid cell flip is therefore proven at planner level (rows 1 and 2), not in the grid DOM, because the grid's player list comes from the component workspace, not the fixture.
- **Per-player bench reason not seen in the UI:** the planner emits a `negative_value` bench decision for `g` on 10-05. Its UI text is "Benching this appearance avoids a negative scoring contribution." That text did not render in Plan details in this harness, because the component's focused date is not in the synthetic week. So the tradeoff explanation is proven through the Compare strip and the Matchup line, not through that sentence.
- **Missing-projection detail (row 6), not a defect:** with `b`'s 10-06 forecast missing, both objectives start `a` (known 1 pt) over `b` (unknown) on 10-06. Unknown is never priced as 0 in any total, and the planner says start/sit quality is unresolved. This is a preference for the known value, and it is disclosed.

## Files and commands

Run these from the export `web/`:

- `npx vitest run lib/rosterScheduleOptimizer/objectiveSwitchAcceptance.test.ts`: **4 passed / 0 failed** (`planner-tests.log`).
- `npx vitest run __tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`: **246 passed / 0 failed** (`component-tests.log`). This includes the new test "objective switch acceptance (SYNTHETIC): the chosen goal reaches the real planner and the Compare strip shows both plans".

Files in this folder:

- `objectiveSwitchAcceptance.test.ts`: new file, goes to `web/lib/rosterScheduleOptimizer/`.
- `objectiveSwitchScenario.fixture.ts`: new file, goes to `web/lib/rosterScheduleOptimizer/`.
- `component-test-addition.diff`: the added `it(...)` in `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`. A full copy of that file is here too.

There is no `fix.patch`, because no defect was proven. Nothing was committed, nothing was edited in the canonical tree, and no FORGE, player-forecasts or shared valuation files were touched.

## The one remaining live acceptance step

TJ needs to do this in the browser on a real Yahoo points league during a week where a rostered goalie or skater carries a negative or near-zero projection:

1. Open RSO and click **Most starts**, then **Best projected points**.
2. Confirm the two things that only a real account can show:
   - The by-position grid and the "Compare" strip change between the two plans.
   - The "Goalie starts x/min" chip and the Plan-details bench reason appear for the benched player.

Make no roster changes.
