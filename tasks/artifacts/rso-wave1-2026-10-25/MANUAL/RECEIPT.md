# RSO-MANUAL receipt: offline manual/free daily acceptance packet

- **Lane:** RSO-MANUAL (CLAUDE-LEASES.json). **Date:** 2026-10-25.
- **Base HEAD:** `32f82b1ee2ad240c3b0614efdf938eab168aa5be` (octoberBranch).
- **Status:** not committed. The orchestrator commits.

## Deliverable

| File | sha256 |
|---|---|
| `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts` (new) | `d5177d39a88d5bc1821ba8f070c5d9c60a3b130c551708a1385aeefd03658962` |

Support files in this folder:
- `DEFECTS.md`
- `tsconfig.json` (scoped tsc project)
- `tsc.log`, `eslint.log`, `vitest-run1..3.log`

No product source was edited. The packet uses only public module exports:
- `planning`: `evaluatePlan`, `planRoster`
- `planningTimeline`: `acquisitionEffectiveAt`
- `planningDates`
- `reconciliation`: `reconcileIntent`
- `workspace`: `defaultIntent`, `defaultWorkspace`, `readWorkspace`, `readWorkspaceHistory`, `writeWorkspace`
- `retention`: `retentionCaution`
- `eligibility`, `slots`

It also uses the existing fixture helpers `player-forecasts/rsoUsePolicy.fixtures` (`fixtureRsoPolicy`, `fixtureRsoBindings`).

## Fixture

- **League:** 12-team Yahoo-style daily points league, manual provider, `America/Toronto`.
- **Roster slots:** C2 LW2 RW2 D4 G2 UTIL1 BN4 IR1 IR+1.
- **Scoring:** G 3, A 2, SOG 0.5, W 4, SV 0.2, GA −1.
- **Acquisitions:** a daily add limit of 1 per league day (local-midnight periods). Same-day timing, unless a test
  changes it.
- **Schedule:** a synthetic Mon 2026-10-19 → Sun 10-25 week. The schedule witness is 2 h old.
- **Forecast rows:** every row is labelled `modelVersion: "interim-forge-bridge-fixture-v1"`, with the limitation
  "Interim FORGE bridge fixture value (synthetic); not a calibrated FORGE forecast." Rows are admitted only by spying
  `currentRsoUsePolicy` to return a fictional fixture review. This follows the pattern in `dailyDecisionReplay.test.ts`.
  Scenario (e) also runs the production review catalog, which is empty.
- **Oracle:** expected values come from an independent function `fp(stats)` over the fixture lines. They are not
  read back from the planner.

## Scenarios: what each proves, and what it does not

**(a) Full roster, no moves** (3 tests)
- *Proves:*
  - 13 of 13 Monday starts are filled only by playing the C/LW player at LW. Removing that dual eligibility costs one
    start.
  - Every slot is legal for its player, filled once per day, and filled by a player whose team plays that game.
  - The maximum-starts plan (AGP, 13 starts) and the best-outcome plan (12 starts) are both derived from the same
    no-move lineup. The best-outcome plan benches a negative-projection goalie, with bench reason `negative_value`.
  - Projected totals match the oracle.
  - With the `auto` objective, the selected plan is the optimized no-move outcome. With `agp`, it is the AGP baseline.
  - Inputs are not mutated, and results do not change when the inputs are reordered.
- *Does not prove:* optimality on horizons longer than one day, or category leagues.

**(b) One-add/one-drop stream** (5 tests)
- *Proves:*
  - The net gain equals (streamer minus the displaced d4 on Monday) plus (streamer minus the dropped lw3's Tuesday
    start). It is not the streamer's raw total.
  - The planner keeps the manager's selected stream against the same no-move baseline.
  - A second add on the same day breaks the daily limit. A Tuesday add uses a fresh allowance and needs a conditional
    recheck. Streaming the streamer is legal.
  - An add submitted after puck drop loses that game.
  - Next-day timing takes effect at Tuesday 00:00 local, and an earlier `effectiveAt` is illegal.
  - Unknown timing has no effective time and is illegal.
  - A waiver claim takes effect at clearance, enforces the FAAB budget, and must be conditional.
- *Does not prove:* that search finds the stream on its own (exercised only within the selected-intent path); weekly
  add maximums; priority-waiver ordering.

**(c) IR/IR+ vacancy before any drop** (5 tests, 1 `it.fails`)
- *Proves:*
  - For both IR and IR+, the best add plan is `[reserve lw2, add fa1]` with no drop. Every drop plan ranks after it.
  - The net gain matches the oracle.
  - An open bench place gives a plain add.
  - The timeline rejects an ineligible reserve move and an over-capacity reserve.
- *Exposes D1:* refresh reconciliation does not recheck reserve moves.
- *Does not prove:* NA slots, or multi-reserve sequences.

**(d) Goalie minimum** (4 tests, 1 `it.fails`)
- *Proves:*
  - Credited (1), confirmed (1) and projected starts stay separate.
  - A missing start probability makes `expectedStarts` and `projected` null, and adds the coverage-unresolved and
    not-verified limitations.
  - Known probabilities add to projected starts, never to credited. `minimumSatisfied` stays false.
  - Thin probabilities leave the minimum at risk.
  - Changed starter evidence is flagged on refresh.
- *Exposes D2:* once the minimum is met, `projected` counts an unknown start probability as 0.
- *Does not prove:* appearance-based minimums, or the category penalty (`lose_goalie_categories`).

**(e) Missing evidence** (5 tests)
- *Proves:*
  - A missing forecast row gives null projected points, a schedule-capacity recommendation and the unresolved row,
    while schedule capacity stays at 13 starts. A requested points objective falls back to most starts, with its
    limitation.
  - A scoring weight with no forecast stat (HITS), or blank weights, gives null points.
  - A player with unknown availability is never proposed. A forced add of that player is illegal, and becomes legal
    after "Mark available".
  - Unknown NHL team membership makes the result indeterminate.
  - Under the production review catalog, which is empty, interim rows give null points rather than 0.
- *Does not prove:* stale or expired rows, conflicting forecasts, or baseline/blended sources.

**(f) Protections vs locks, automatic must-keep off** (3 tests)
- *Proves:*
  - The default intent and workspace protect no one.
  - A 92%-owned player gets a high-demand caution but is still proposed as a drop.
  - A protection blocks drops, including a forced one, but does not force a start.
  - A manager lock fixes the slot for that day and blocks a same-day drop, but not a drop the next day.
- *Does not prove:* provider (Yahoo) locks, or weekly lock windows.

**(g) Refresh reconciliation and Undo** (3 tests)
- *Proves:*
  - Selected moves survive the workspace schema round trip, with a one-entry Undo history.
  - A refresh where a better alternative exists leaves `selected.steps` unchanged, returns no issues, and does not
    mutate the intent.
  - An invalidating refresh (the player was claimed and the daily allowance cut to 0) proposes a repair
    (`suggestedSteps: []`). The intent keeps its moves, the planner evaluates them as selected (illegal), and Undo
    after an accepted repair returns the selected moves (revision 1).
- *Does not prove:* the component-level accept/undo UI (that test is RSO-FLAKE's lane), or IndexedDB preservation.

**Not covered at all:**
- the real interim bridge read (`withCurrentPlanningRead`, which needs fetch)
- Yahoo connected flows
- weekly leagues
- Fantrax
- category scoring
- free no-input discovery

## Runs (offline, from `web/`)

| Check | Command | Result |
|---|---|---|
| Vitest ×3 | `env -u GIT_DIR npx vitest run lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts` | **passed** 3/3: 28 tests each (26 pass, plus 2 known defects pinned as `it.fails`), about 1.1 s |
| Defect pin check | the same run with `it.fails` → `it`, then the file restored | each failed only at its defect assertion (test lines 346 and 411) |
| ESLint | `npx eslint lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts` | **passed** (exit 0) |
| Scoped tsc | `node node_modules/typescript/bin/tsc --noEmit -p ../tasks/artifacts/rso-wave1-2026-10-25/MANUAL/tsconfig.json` | **passed** (exit 0); checks the new file and its imports |
| Whole-project tsc | n/a | **not run** (not needed; the heavy lock was not taken) |

No network, database, provider, production, server, git mutation or `GIT_DIR` was used.

## Defects (details in DEFECTS.md)

| ID | Severity | Where | Summary |
|---|---|---|---|
| D1 | medium | `reconciliation.ts:32-49`, `:69-78` | `reconcileIntent` never rechecks selected reserve moves. A refresh that makes an IR move illegal returns no issues and `suggestedSteps: null`. |
| D2 | low | `planning.ts:903`, `:909` | Once credited meets the minimum, `goalie.projected` sums known start probabilities and drops unknown ones as 0. The Matchup panel shows the result (`RosterScheduleOptimizer.tsx:1061`). |
