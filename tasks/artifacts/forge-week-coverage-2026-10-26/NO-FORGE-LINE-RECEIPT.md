# "No FORGE line" labelled conservative 0 (TJ option B): receipt, 2026-10-26

Decision: TJ, by pop-up, chose "Labelled conservative 0 now". The cause was the P1 finding: one rostered player with no FORGE line made the roster baseline null and blanked every candidate's points. Base: octoberBranch at fe285adcf (prov-guard's week-ahead bridge, 08e583311). All uncommitted, local and offline; the reserve flag stays off.

## Rule as implemented (`web/lib/rosterScheduleData/forgeDailyBridge.ts`)
After the lineup, reserve and goalie paths, every identified player (catalog, unique identity, current team, roster revision) with **no row** for an upcoming game in the horizon gets one:
- **Planning contribution:** a labelled conservative 0 under code `skater:no_forge_line` or `goalie:no_forge_line`. Every stat key is a complete 0, season-rated keys included, so the plan counts 0, never unknown. `appearanceProbability` and `startProbability` stay null.
- **"If he plays" line:** his latest proven FORGE line for his current team, moved to the game the same way the lineup path does (team strength, rest, tilt). It is kept as `conditionalStats` and never counted, because planning reads only `stats` (tests below).
- **Attribution:** the row carries the revision of his team's latest proven run ("as of this run, FORGE did not dress him"), so it passes the same current-read admission as every bridge row.
- **Unchanged:** players with a real line (lineup, own-game or reserve). A confirmed "out" still counts 0.
- **Goalies with no start share** now always get the existing labelled-0 `goalie:start_unknown` / `goalie:start_unknown_team_line` rows. Before, that happened only with the reserve pass on.
- **Lines that exist but can't be read safely** (blank heads, unknown power play) still get no forecast: unknown stays unknown.

### Withheld runs: "no line exists" versus "a line may exist but is withheld"
Only "no line exists" gets the 0. A player gets **no forecast** (no masking 0) when some withheld (unproven) run is dated on or after his team's latest proven run and his team plays on that date. Which teams play when comes from the schedule rows the bridge already reads; with no schedule rows, every withheld run counts as possibly covering his team. A team with no proven run gets no 0 either, because there is nothing to attribute it to. Both cases are counted in a limitation: "N players have no proven FORGE line because a newer run for their team cannot prove it excluded third-party fantasy projections; they get no forecast rather than a 0." Every run withheld still means schedule-only.

### Payload
- `FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET` is now **6 MB** with or without the reserve pass; `FORGE_RESERVE_EXPANDED_BYTE_BUDGET` is an alias.
- This is the budget measured earlier against the 8 MiB unpacked-backup ceiling. The previous "4 MB with the pass off" rule is superseded because, with the pass off, every player now has a row.
- "No FORGE line" rows join the reserve all-or-nothing group (`isReserveLine`): when full coverage does not fit, all of them are withheld together, never only the late games, and the limitation says so.

Offline measurement (production-shaped fixture, pass off):

| Horizon | Player-games | Rows | "No FORGE line" rows | All labelled 0 | Expanded | Wire | Unpacked snapshot | At 6 MB |
|---|---|---|---|---|---|---|---|---|
| 7 days, typical | 3,196 | 3,196 | 1,128 | 1,316 | 5.26 MB | 1.31 MB | 5.68 MB | **full coverage** |
| 7 days, maximal (4 games per team) | 3,808 | 3,808 | 1,344 | 1,568 | 6.26 MB | 1.56 MB | 6.70 MB | labelled 0s withheld together; 2,240 rows served |
| 14 days, typical | 6,392 | 6,392 | 2,256 | 2,632 | 10.51 MB | 2.62 MB | 10.96 MB | withheld together; lineup rows as before |

**Limit:** in a maximal week, or a window longer than a week, the 0s are withheld, so one uncovered rostered player can blank candidates again. The limitation names this. Full coverage there needs the forecast/snapshot split (an earlier follow-up).

## Tests
- **P1 regression** (`forgeReservePayload.test.ts`). With the pass off, the production-shaped league gives every rostered player a row for every game, within budget. A roster with one scratched skater who has no FORGE line runs through the real current-read admission and `candidatePlanMetrics`:
  - before (P1 measurement): baseline null, 0 of 40 candidates with net points;
  - now: the baseline is comparison-eligible with points, and every evaluated candidate gets net points (8 of 8 under a bounded search for test speed; production evaluates 40).
- **The conditional line is visible but never counted:**
  - s2's rows carry `conditionalStats` {GOALS 0.35, ASSISTS 0.45} with every `stats` key 0, appearance and start null, and the "No FORGE line" note;
  - the planner's `candidateHorizonPoints` for s2 is **0**, not 0.35×… and not null.
- **Withheld runs:**
  - a withheld run dated after the team's latest proven run → no s2 forecast, and the limitation counts 2 players (s2, plus s3, whose team has no proven run);
  - a schedule showing the team has no game on the withheld date → the 0 applies;
  - every run withheld → schedule-only.
- **Real lines and confirmed outs:** a confirmed out counts 0, and real-line rows are byte-identical with and without the news.
- **Pass off:** reserve rows are still not read, and no reserve-state codes appear. The only labelled codes are `no_forge_line` and `start_unknown(_team_line)`. Existing tests asserting "no forecast" for stale skaters and unshared goalies were updated to the new labelled 0.
- **Payload:** a typical week fits the 6 MB budget completely. Maximal weeks and longer windows withhold all reserve and labelled-0 rows together. Every existing week-of-runs test still passes, with the maximal week now withholding with the pass off as well.

## Checks
- vitest, affected set (188 files; `lib/projections`, `lib/rosterScheduleData`, `lib/rosterScheduleOptimizer`, `lib/in-season`, `lib/player-forecasts`, `lib/integrations/yahoo`, the RSO, start-chart, projections and forge API tests, RSO components):
  - **UTC: 188 files, 4,988 tests passed.**
  - **America/New_York: 186 of 188 files.** The 2 failures pass when re-run in isolation under New York (372 of 372): a planner performance test that timed out at 5 s under CPU load, and `__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`, which rso-flake is editing (dirty, not mine).
- eslint: clean on the changed files.
- tsc, whole project, under `/private/tmp/fhfh-heavy.lock`: **exit 0** (2026-10-26T23:15:26Z).
- **Closure:** `verify-forge-release-sha --worktree`: **VERIFIED, 0 findings**, closure **`bf23edfea5b5c9301fcedd2b5c3fa86016ceecd86d1d2d49c0a6d6c687e7ab3b`**, 194 modules. The one closure file changed is `web/lib/rosterScheduleData/bridgeForecastWire.ts` (two note codes). The allowlist was not edited. The verifier's output JSON was removed from the tree; re-verify at the release candidate.

## Files (sha256)
- `web/lib/rosterScheduleData/forgeDailyBridge.ts` 744d37c2bb7a6ed98c28d3499153bda6ba532b99f23b6aabe394572dfd79e63a
- `web/lib/rosterScheduleData/forgeDailyBridge.test.ts` 250023a50ad95d270a77c0e576f58a8cea9a23cc631c0cd41fb89476d2a5775d
- `web/lib/rosterScheduleData/bridgeForecastWire.ts` 61105e1a7347880c28ed4417f157a71ed1e53e06b2d1d58a0434c4983bf7ffaf
- `web/lib/rosterScheduleData/forgeReservePayload.test.ts` 4f61b21e32cc18f86ecdf9491ce53d9e3a5953f45905da510edce0742a0b770b
- `tasks/diaries/2026-10-26-claude-forge-reserve-pass.md` e24237928fc8f2c0cddc9b14e12455627398341ba2feb0d0bb0823b32cdea958
