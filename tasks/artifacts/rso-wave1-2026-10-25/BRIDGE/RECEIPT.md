# RSO-BRIDGE receipt (Claude, 2026-10-25)

Lane RSO-BRIDGE: two P1 data-integrity fixes in the interim FORGE daily bridge. Code only, offline fixtures, nothing committed (the orchestrator commits).

## Files

| File | Baseline sha256 (lease) | Final sha256 |
|---|---|---|
| web/lib/rosterScheduleData/forgeDailyBridge.ts | 651eff511275b93f6f598181f3c5402c9b4d1b57d3959eb772528842910855f5 | c1d0c2f8f3689e1bf93a514b082c949875effe4d8bf206bfd8a82000bcf3c296 |
| web/lib/rosterScheduleData/forgeDailyBridge.test.ts | 16c3d6f394be1a2a877b2a4ddaac9ef8d2100c577ff98ec3adb96aaf4342f9d1 | cac6bdcc677a0231a2455c8274a5fa3fbce691fc25ad3014aadcb667404de56b |
| web/lib/rosterScheduleData/planningInputs.ts | 8193aa5d1bd22349b729e0a135f2060e847c5569312f83a84b23d2cbee498313 | unchanged |

`planningInputs.ts` needed no change: it carries no stat logic. The planner already handles a null weighted stat: `gameForecastPoints` returns `expected: null`, and `evaluatePlan` nulls the stat total and adds "Projected X is incomplete". The fix was to stop the bridge feeding it 0.

Baseline failure log: `tasks/artifacts/rso-wave1-2026-10-25/BRIDGE/baseline-failures.txt` (16 failed / 42 passed, run against the baseline `forgeDailyBridge.ts` with the new tests).

## Behaviour changes

### 1. Season-rate supplements: unknown, never 0
- `skaterStats()`: when season totals can't be read, `PENALTY_MINUTES`, `PLUS_MINUS`, `SH_GOALS`, `SH_ASSISTS`, `SH_POINTS`, `GAME_WINNING_GOALS`, `FACEOFFS_WON` and `FACEOFFS_LOST` are now `null` (they were 0). FORGE's own `proj_pim` / `proj_plus_minus` still win where they're stored, including a stored 0.
- `seasonRates()`:
  - a stat counts only rows that record its column. A stat no row records is `null` (an unrecorded column used to count as 0).
  - `gwgShare` uses only rows that record both goals and GWG, else `null`.
  - The league-rate fallback entry (`rates.get(0)`) is gone. A skater with no season rows gets unknown supplements, not the league's.
  - A rate genuinely read as 0 (for example a defenceman's faceoffs) stays 0.
- Limitations:
  - "count as 0" becomes "Season rates could not be read, so … are unknown; totals that score them are withheld."
  - New line: "N skaters have no season totals this season or last, so their … are unknown."
- Downstream effect: a points league that weights one of these stats now gets a withheld (null) total for an affected skater instead of a silently low one. Category leagues mark the category incomplete. **Coverage impact:** call-ups and rookies with no `wgo_skater_stats_totals` rows lose a projected total in leagues that score these stats. Before, they used league-average PIM/SH rates and 0 faceoffs/plus-minus.

### 1b. Power-play modeled-zero policy, now explicit (`withSpecialTeamsZeros` → `withPowerPlayZeros`)
- Kept as a declared, tested policy. Blank PP heads (goals, assists, shots) count 0 only when FORGE **stores** PP TOI ≤ 6 s (`NO_POWER_PLAY_SECONDS`).
- Changed: blank PP heads with **absent** PP TOI used to be zero-filled. They now stay unknown (no forecast), the same as blank heads with PP TOI over 6 s.
- Changed: known PP heads with absent PP TOI keep their line, but `TIME_ON_ICE_PER_GAME` is now unknown. PP TOI used to be zero-filled, giving a too-low TOI.
- PK columns are no longer zero-filled. That makes no difference: `modeledHeadTotals` (A-08) already treats PK as not modeled, and the TOI sum already adds absent PK TOI as 0.
- Limitation text now names the 6 s threshold and "real or unrecorded power-play time".
- **Coverage impact:** if FORGE writes null (not 0) PP TOI for skaters with no PP role, those skaters now get no forecast. Whether the writers store 0 or null for them is a FORGE-writer data question. I didn't check it (offline only).

### 2. Goalie start shares bound to current team and season
- Loader: the `goalie_start_projections` select now includes `team_id`.
- A share row counts only if all three hold:
  - `team_id` equals the goalie's current `nhlTeamId`;
  - `game_id` is finite;
  - `floor(game_id / 1e6)` equals `floor(seasonId / 1e4)`, i.e. the current season.
  
  Rows that fail (old team after a trade, other season, missing team) are ignored, even when newer.
- Per game, the share is that game's own row (`game_id`) when one exists. Otherwise it is the goalie's latest bound row: the labelled fallback policy, named in the limitations.
- A goalie with only unbound rows has an unknown share, so he gets no forecast for games FORGE hasn't projected for him. New limitation: "N goalies have start shares only from another team or season; those are ignored, so their start chance is unknown."
- The goalie-start limitation now states the binding and the exact-row-then-latest policy.

## Tests (all in `forgeDailyBridge.test.ts`)

Changed fixture: start-share rows carry `team_id` and real NHL game ids (`2026020001`, `2026020005`), because the season is now read from the id.

| Case | Test | Baseline |
|---|---|---|
| Unreadable totals → null, FORGE PIM/+- still stand | season-rate supplements › are unknown, never 0, when season totals cannot be read | FAIL (0) |
| Missing player → null; read zero stays 0 | › are unknown for a skater with no season totals, while a rate read as zero stays 0 | FAIL (league 0.5) |
| Unrecorded column → null, other rows still count | › count only the rows that record a stat… | FAIL (6 vs 7.5) |
| Downstream: weighted unknown withholds the FP total | › withhold a points total that weights an unknown supplement… | FAIL (1.05, not null) |
| Existing first test, now null supplements | reuses each skater's latest line… | FAIL (0) |
| PP TOI 0 / 6 s → modeled zero | blank power-play heads › count as zero production… (0, 6) | FAIL on the reworded limitation only; zero-fill itself unchanged (pin test) |
| PP TOI 7 / 120 s → unknown | › stay unknown with 7 / 120 s of power-play time | FAIL on the reworded limitation only; behaviour unchanged (pin test) |
| PP TOI absent + blank heads → unknown | › stay unknown with null s of power-play time | FAIL (zero-filled) |
| PP heads known, PP TOI absent → TOI unknown | › leave a known power-play line standing… | FAIL (TOI 15) |
| Blank ES line never rescued | › never rescue a blank even-strength line | pass (pin) |
| Same team | goalie start shares › use rows for the goalie's current team this season | pass (pin) |
| Traded mid-season | › ignore a traded goalie's rows from his old team, even newer ones | FAIL (0.4375/0.5625) |
| Cross-season | › ignore rows from another season | FAIL (0.4/0.6) |
| Missing prior stays unknown | › leave a goalie with no current-team, current-season row unknown | FAIL (0.5625) |
| Exact game row vs fallback | › prefer the row for the game itself, falling back to the latest row… | FAIL (0.9 everywhere) |
| Loader reads team_id | › are read with their team, so the bridge can bind them | FAIL |

## Checks (run from `web/`, GIT_DIR unset)

- **Passed:** `npx vitest --run lib/rosterScheduleData lib/rosterScheduleOptimizer/planning.test.ts lib/rosterScheduleOptimizer/gameForecastPoints.test.ts` gives 8 files, 352/352 tests. `forgeDailyBridge.test.ts` alone is 58/58.
  - Two earlier runs, at load average ~100–260, hit a 5 s timeout in `planning.test.ts` › "evaluates the entire 1000-player population across 13 days". That file imports nothing from this lane. Run alone, the test passed in 1.95 s. The final full run passed at load ~35.
- **Passed:** scoped `tsc --noEmit` (8 GB heap, under `/private/tmp/fhfh-heavy.lock`, created with noclobber and removed afterwards). Its include list is the 3 owned files plus the repo's ambient `.d.ts` files, exit 0. The first run caught an `it.each` tuple type in the new test; I fixed it and re-ran.
- **Failed, outside this lane:** whole-project `npx tsc --noEmit` (8 GB heap, same lock) exits 2. Its only error is in `lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts(373,82)` TS7053: the RSO-MANUAL lane's new, in-progress file. It has no errors in RSO-BRIDGE files. Log: `BRIDGE/tsc.log`.
- **Passed:** `npx eslint` on the 3 owned files, exit 0.
- No production, DB, provider, Vercel or git-mutating actions. GIT_DIR was unset for every test run.

## Not done / follow-ups (not in this lane's files or scope)
- Pre-existing: when only one of a team's goalies has a share for an unprojected game, normalisation gives him a start chance of 1.0. The test "normalises start shares that sum to less than one" declares this. With the new binding, a traded-in teammate whose share is unknown leaves the other goalie at 100%. Worth a policy decision: cap, or withhold the team's game.
- FORGE writer question: does it store 0 or null PP TOI for skaters with no PP role? If null, 1b reduces skater coverage.
