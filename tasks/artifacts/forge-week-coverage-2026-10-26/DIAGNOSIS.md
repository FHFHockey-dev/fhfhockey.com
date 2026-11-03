# FORGE week coverage for RSO: diagnosis and plan (2026-10-26)

Request (TJ): "It seems we need FORGE projections for all players for the whole week."

## Answer in one paragraph

The week is already covered. The players are not. For every date Mon 10-26 to Sun 11-01, RSO gets a FORGE line for the same 62% of rostered NHL players, and nothing all week for the other 38%. FORGE's daily run projects only each team's expected dressed lineup: about 18 skaters plus the likely starter. The interim bridge then drops any player missing from his team's latest run. So injured, scratched, healthy-reserve, extra-roster and third-string players have no forecast. RSO then treats one unknown player-game in a contested slot as "projected outcome unknown". A single injured or scratched player on a roster is therefore enough to turn the team's projected points, and every add/drop comparison involving that roster, into "—".

## Evidence

The measurement uses the same `loadPlanningData` and transport fitting as `/api/v1/roster-schedule-optimizer/data`. It ran read-only against current data at 2026-10-26T13:17Z for season 20262027, 2026-10-26 to 2026-11-01 (America/New_York). The script and its output are in `measure/`. Also used: read-only SQL on `forge_runs` and `forge_player_projections`.

| Measure | Value |
|---|---|
| Serving source | `legacy` → interim FORGE daily bridge (`forge-daily-bridge-v1`) |
| Planning players (unique current roster membership) | 1065 (950 skaters, 115 goalies; 58 with no team) |
| Team-games this week | 94 (47 games), all 32 teams |
| Required player-game opportunities | 2973 |
| Forecasts built = served | 1847 (62.1%); none trimmed |
| Response body | 1.25 MB of the 4.0 MB budget |
| `exclusionCounts` | `{}`: no `future_input`, `no_issued_revision`, `stale_source` or `use_not_approved` |
| Players with no forecast | 378 (338 skaters, 40 goalies), each with **0 of N** games covered. Coverage is all-or-nothing per player. |

Coverage by date (skater-games covered / needed, goalie-games covered / needed):

| Date | Team-games | Skaters | Goalies |
|---|---|---|---|
| Mon 10-26 | 6 | 104 / 180 | 13 / 18 |
| Tue 10-27 | 22 | 389 / 624 | 45 / 77 |
| Wed 10-28 | 8 | 140 / 232 | 16 / 25 |
| Thu 10-29 | 22 | 387 / 605 | 46 / 75 |
| Fri 10-30 | 6 | 107 / 178 | 12 / 20 |
| Sat 10-31 | 20 | 352 / 564 | 42 / 66 |
| Sun 11-01 | 10 | 174 / 276 | 20 / 33 |

The coverage ratio is flat across the week (60–65%), so the horizon is not the gap.

Who is missing (skaters, from `wgo_skater_stats_totals`):
- **70 "stale"**: in a FORGE run during the last 7 days but missing from their team's latest run. All 70 have played this season (64 have 3 or more GP) and 17 score ≥ 0.5 points per game. Examples: Suzuki (last game 10-20, MTL played 10-23 and 10-25), Marner (last 10-20), Rust and Byfield. These are mostly injured or scratched now.
- **268 never in a run during the lookback**: 74 have played this season and 194 have not. 37 have no NHL games this season or last (AHL depth or long-term injured). This group includes players such as Barzal, Terry, Fiala, Faber and Duchene (0 GP this season).
- **40 goalies**: no start share (third-string or AHL goalies, or 9 goalies with no current team).

## Root cause (file:line)

1. **FORGE projects lineups, not rosters.** The skater stage takes the team's latest line combination (about 12 forwards and 6 defence), with a rolling-TOI top-18 fallback, constrained to the active roster: `web/lib/projections/stages/skater-stage.ts:1480-1540`, top 18 at `:392-441`. Each run covers only one slate date. The daily cron writes today's and tomorrow's h1 runs (`forge_runs` 10-26 and 10-27, each with about 17.6 skaters per team).
2. **The bridge forecasts only players in their team's latest run.** One player's latest line is re-aimed at each remaining game, using opponent, rest, home and tilt adjustments: `web/lib/rosterScheduleData/forgeDailyBridge.ts:379-413`. Players with no row are skipped (`:381`). Players absent from their team's latest run are "stale" and get nothing (`:384`, `:395`). Goalies with no start share get nothing (`:509-510`). Horizon is the 14-day calendar policy (`planning.ts:75`, `forgeDailyBridge.ts:359-361`). Lookback is 7 days (`:21`).
3. **The planner turns any unknown into "—".** An unknown value on a play competing for a slot is recorded as `unresolved` (`web/lib/rosterScheduleOptimizer/planning.ts:398-406`). That nulls `projectedValue` (`:924`). `comparisonEligible` needs a forecast on every play (`:960-962`), and add/drop comparisons need `comparisonEligible` (`candidatePlanMetrics.ts:165`). This is the deliberate "unknown, not zero" rule, so the gap in item 2 spreads to whole-team readouts.

Ruled out:
- Transport trimming: 1847 of 1847 rows were served, with the body at 1.25 of 4 MB.
- RSO use policy: bridge rows carry all uses (`forgeDailyBridge.ts:370`), and `use_not_approved` applies only to native admitted revisions (`planning.ts:226-235`).
- Admission and expiry: expiry is the lesser of game start and issue + 8 days (`forgeDailyBridge.ts:364`).
- Team or identity mismatch: none counted.

## Recommended plan (A): explicit "not in projected lineup" lines in the bridge

Read-time only, in `forgeDailyBridge.ts` plus tests. No FORGE pipeline, cron, ETL or schema change.

1. **Out-of-lineup skaters.** This covers the 70 stale skaters and the never-run skaters with NHL games this season or last. Emit an unconditional forecast of **expected 0** for each game: FORGE's own lineup does not dress them. Where a prior FORGE line exists, attach it as `conditionalStats` (re-aimed as today) so "if he plays" stays visible. Add a limitation such as "Not in FORGE's projected lineup: expected 0 until he returns to a lineup." Accepted lineup news in `loadDailyBoardEvidence`, which is already read, can restore the line for a named game.
2. **Goalies with no start share.** Use start chance 0 only when the team's other goalies' shares already sum to at least 0.95; otherwise keep unknown, as now.
3. **Leave out** players with no NHL games this season or last (about 37 or more pure-AHL rows). They stay unknown, which keeps the payload bounded.
4. **Byte budget is binding.** Today 1847 rows expand to 2.90 MB on the client (about 1.57 KB per row) against `FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET = 4 MB` (`forgeDailyBridge.ts:26`). Filling all 2973 opportunities would need about 4.7 MB, and the trim would drop Sat/Sun first. With step 3 the fill is roughly 600–800 rows, landing at about 3.8–4.1 MB, which is borderline. So zero rows must trim first, ahead of real lines, and the build must be measured with `measure/diag.test.ts` before release.
5. Tests: extend `forgeDailyBridge.test.ts` (stale player → 0 with a conditional line; news override; goalie rule; trim order). Re-run the measurement script locally.

**Cost:** no FORGE runs, no cron or ETL invocations, no writes, and **0 NST requests**; FORGE reads only DB tables. Each `/data` request does the same reads as today: season totals, FORGE rows and board evidence are already loaded. Added CPU is about 1k rows of arithmetic, negligible. The response wire grows about 0.3 MB (1.25 → about 1.6 MB). Remote cost is one normal release build, and only when TJ authorizes a release.

**Tradeoff to decide:** expected 0 undervalues a day-to-day player who returns midweek until a FORGE run includes him again. Runs happen daily, so that lasts about 1 day. Under today's rule the same player blanks the whole team.

### Alternatives considered (not recommended now)
- **B: Widen FORGE to the full active roster.** This changes the projection model: TOI and team-total reconciliation would spread ice time to players who will not dress. It adds about 300 rows per slate in writes and extends cron runtime, still with 0 NST requests. It is a model decision, not a coverage fix.
- **C: Planner-only partial totals.** Let projected points sum the known players and flag the rest. This breaks the declared "unknown, not zero" invariant across optimizer, ledger and comparisons, a larger and riskier diff.

## TJ decision (2026-10-26): redirected to widening FORGE

TJ: "FORGE runs should cover ALL players. In order to recommend add/drops we need to know the projected FORGE fantasy point projections for all Waiver Wire free agents."

Plan A (expected-0 fill) and C are therefore off. The revised plan below (B′) needs its own implementation lane. Nothing has been changed yet.

### Revised plan B′: a FORGE "reserve pass" for every rostered player
1. **Skater stage.** After the lineup pass is projected and reconciled (`skater-stage.ts:1480-1700`), project every other current-roster skater on the team (`rosters.is_current`) who has NHL games this season or last. Use the same per-player rate model with a role-default TOI (his recent TOI, else a 4th-line or 3rd-pair default). Each line means "if he dresses". **Keep these lines out of team TOI and goal reconciliation**, so lineup players' numbers do not change.
2. **Goalie stage.** Write a per-start line for every rostered goalie, not only the projected starter. Start chance stays with the existing start-share and news logic.
3. **Mark reserve rows.** `forge_player_projections` has no participation column; it has `uncertainty jsonb`. Readers that sum team totals or score accuracy (Start Chart, accountability and accuracy, team rows) must skip reserve rows. Choose a marker (a key in `uncertainty`, or a new column via migration) and add a reader audit to the lane.
4. **Bridge.** Serve the reserve line as `conditionalStats`, with the unconditional line = conditional × dress probability. The default is 0 for players out of the latest lineup with no news; accepted lineup news raises it. This keeps the "unknown, not zero" contract honest while giving every free agent a FORGE fantasy-point projection.
5. **Payload.** Full coverage is about 2973 rows × 1.57 KB ≈ 4.7 MB expanded, over the 4 MB budget (`forgeDailyBridge.ts:26`). Either compact the client expansion (most of each row is the repeated `issuedContext`), or filter in the private Yahoo route (`yahoo-current-data.ts`, which knows the league's roster and free agents) to that team's roster plus waiver-wire players.
6. **Scope gap.** RSO's player set is only players with a unique current NHL roster membership (1065). Yahoo free agents with no NHL roster spot (AHL, unsigned) are not in planning at all, and B′ will not cover them.

**Cost estimate:**
- **Runtime.** Recent runs take about 8–9 s per game: an 11-game slate took 96 s and a 12-game slate 104 s (one 12-game run took 245 s over 2 invocations). About 11 extra skaters and 1–2 extra goalies per team would add roughly 50–60%, so about 150 s for an 11-game slate. The run is resumable, so it stays deadline-safe.
- **Writes.** About 240 more `forge_player_projections` rows per 11-game slate, roughly 500 per day across the two daily runs.
- **NST.** 0 requests. No `naturalstattrick` reference exists in `lib/projections`, `lib/rosterScheduleData` or `lib/player-forecasts`, so FORGE reads DB tables only.
- **Remote.** One release build, when authorized. No extra cron entries; the existing daily FORGE cron picks the change up.
- **Validation.** First recompute or backfill runs need TJ's explicit approval.

## Not verified / limits
- I did not read TJ's private Yahoo roster or free-agent list. Which of the 378 players are on TJ's roster or in the candidate pool is unmeasured.
- I did not trace whether players in IR slots are excluded from plays. If they are, injured players already on IR do not blank totals, and only those occupying active or bench slots do.
- The measurement is one snapshot (Mon 13:17Z). Counts move with each daily run.
- Native forecasts (`source.kind` native) would replace the bridge entirely. This plan is for the interim bridge only.
