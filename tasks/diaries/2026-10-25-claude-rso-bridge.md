# RSO-BRIDGE diary (Claude, 2026-10-25)

## Scope
Two P1 fixes in the interim FORGE daily bridge, offline, no commit:
1. Season-rate supplements: unreadable/missing → null, never 0; PP zero-fill only as a declared policy.
2. Goalie start shares bound to current team + current season (from game_id); exact-game row before fallback.

## Where
- octoberBranch, canonical checkout; no git mutations.
- Owned: web/lib/rosterScheduleData/forgeDailyBridge.ts, forgeDailyBridge.test.ts, planningInputs.ts (lease RSO-BRIDGE).
- Baseline sha256 matched the lease at start.
- Receipt: tasks/artifacts/rso-wave1-2026-10-25/BRIDGE/RECEIPT.md

## State
- Read bridge, planner null handling (gameForecastPoints and evaluatePlan withhold/mark incomplete on null weighted stats).
- planningInputs.ts needs no change (it has no stat logic).

## Decisions
- No league-rate fallback for a skater with no season rows: unknown, labelled. Per-stat: only rows carrying the column count.
- PK blanks are not modeled (modeledHeadTotals A-08), so the zero-fill now covers PP heads only, and only when PP TOI is stored and <= 6 s.
- Season of a share row = floor(game_id / 1e6) vs floor(seasonId / 1e4).

## Next
Write failing tests, then implement.

## Checkpoint 19:07 local
- Tests written; baseline 16 fail / 42 pass (log in BRIDGE/baseline-failures.txt). Implemented; bridge file 58/58 pass.
- lib/rosterScheduleData + planning + gameForecastPoints: 351/352; the one failure is planning.test.ts 1000-player perf test timing out at 5 s under load avg ~260 (doesn't import the bridge). Re-run when load drops.
- eslint clean. Scoped tsc caught an it.each tuple type in the test; fixed; whole tsc pending, re-run of both needed.
- Receipt drafted with placeholders FINAL_BRIDGE / FINAL_TEST / CHECKS.

## Done 19:10 local
- Final: 352/352 tests; scoped tsc 0; whole tsc fails only in RSO-MANUAL's dailyAcceptance.manual.test.ts (not ours); eslint 0.
- Receipt complete: tasks/artifacts/rso-wave1-2026-10-25/BRIDGE/RECEIPT.md. Not committed (orchestrator commits). Keep this diary until the orchestrator records the commit.

## Ticket 2 (C7 R29 B1/B2), 19:25 local
- Base e5975452c (file hashes matched receipt 1). B1: open-team rule, rescale never scales up past an unknown (shares, FORGE remainder, news, B2B). B2: teamless goalies counted, linked by latest current-season start row / FORGE line.
- Baseline 5 fail / 60 pass; final 359/359 across the required suites; scoped + whole tsc 0; eslint 0.
- Receipt: tasks/artifacts/rso-wave1-2026-10-25/BRIDGE/RECEIPT-2.md. Not committed. Gap: a teamless goalie with no rows can't be linked.
