# Lane F receipt: goalie workload (SS 10.0, 12.0)

Posts: `busy-quiet-goalies`, `goalie-rescue`, `ratio-impact`, all registered through `lib/socialShare/modules/lanes/goalieWorkload.ts`. No frozen file was edited.

## Subtasks

| Subtask | State | Evidence |
| --- | --- | --- |
| 10.1 `busyQuiet.ts` | Done | `busyQuiet.test.ts`: basis switch, relief handling, no goodness wording, danger-zone shots labeled as shots, team chances labeled team-level |
| 10.2 `goalieRescue.ts` | Done | `goalieRescue.test.ts`: no combined score, ownership states, empty pool |
| 10.3 Cards | Done | Card tests inside both test files, rendered with Testing Library. `suggestedUse` is a note only; no calendar field exists |
| 10.4 [real] | Done | Reads 1–9 below |
| 12.1 `ratioImpact.ts` | Done | `ratioImpact.test.ts`: pooled and mean of rates differ, unit conversion |
| 12.2 Sensitivity and safeguards | Done | Zero denominators unknown, line added to an empty base, stated zero base stays known, partial base stays unknown |
| 12.3 `RatioImpactCard.tsx` | Done | `hypothetical` basis, card test, forbidden-wording test over card, summary, fields, sample and alt text |
| 12.4 [real] | Done | Read 8 below. Loader test proves no read happens without a goalie id |

## Checks

- `npm test` on the three lane files plus `contract.test.ts`, `server.test.ts` and `PostStudio.test.tsx`: 79 tests, all passed.
- `eslint` on all lane files: clean.
- CSS-module pure check (sass, then `postcss-modules-local-by-default` in pure mode) on the three SCSS files: passed.
- `npx tsc --noEmit`: no errors in lane files.
- `e2e/social-share-goalie-workload.spec.ts`: this lane ran `--list` only (4 tests). The lead reports all 4 pass in a browser, after changing the spec at `108c68938` to click Refresh after server-scoped settings and to use role selectors for Category.

## Real reads

Project `fyhftlxokyjtpndbkfse`, Supabase MCP `execute_sql`, 2026-10-31. Every statement was a single `SELECT`. No writes, provider calls or Vercel requests.

| # | Statement | Tables read | Rows returned | Result |
| --- | --- | --- | --- | --- |
| 1 | Sample game rows, 10-24 to 10-30 | `wgo_goalie_stats` | 20 | Passed. TOI in seconds; relief rows present |
| 2 | Sample rows from 10-20 | `nst_gamelog_goalie_all_counts` | 10 | Passed. `toi` is minutes **and a string**; `team` uses `N.J`, `L.A` |
| 3 | Sample rows from 10-24 | `nst_team_gamelogs_as_counts` | 10 | Passed. Standard team codes; `situation` is `all` |
| 4 | Sample goalies joined to the map | `yahoo_players`, `yahoo_nhl_player_map_read` | 15 | Passed. Map keys match `player_key` |
| 5 | Coverage aggregates | `yahoo_players`, `wgo_goalie_stats`, `nst_gamelog_goalie_all_counts`, `nst_team_gamelogs_as_counts` | 1 | Passed |
| 6 | L10 workload sample, first attempt | `wgo_goalie_stats`, `yahoo_players`, map | 0 | **Failed before running**: `round(double precision, integer)`. Corrected with casts in 7 |
| 7 | L10 workload sample, at least 3 starts, top 12 by SA per start | `wgo_goalie_stats`, `yahoo_players`, map | 12 | Passed |
| 8 | Integrity aggregates and one goalie's base totals | `wgo_goalie_stats`, `yahoo_players`, map, `nst_team_gamelogs_as_counts`, `games` | 1 | Passed |
| 9 | Yahoo status of goalies with at least 3 L10 starts | `wgo_goalie_stats`, `yahoo_players`, map | 6 | Passed |

Findings:

- No nulls in SA, saves, GA or TOI, and no zero TOI, across this season's 455 game rows.
- NST goalie rows join WGO on goalie and game date: 414 of 417 match, with no duplicate keys, through 10-27. NST `shots_against` differs from WGO on 36 of the 414, so WGO stays the shot source and NST supplies only danger-zone splits.
- Because NST lags, an L10 window ending 10-30 is often under 90% covered. Those goalies show `— covered/expected`, as the contract requires. Expect many of these until NST catches up.
- 71 goalies appeared and 62 have at least 3 starts in the L10 window. 0 ambiguous Yahoo ids. 181 Yahoo goalies, 67 with null ownership, none among the 62.
- Top of the real Busy list on default settings, computed in SQL from the same definition: 32.4 SA per start, 8 starts, 2 relief. This checks the definition against real rows; it is not a loader run.
- Ratio base read for one goalie: 2 appearances, 39 SA, 36 saves, 3 GA, 7,200 s, no nulls.

**Loaders:** this lane did not run them end to end. A real edition reads about 455 appearances and 432 team games, above the 50-row sample bound, so the lead ran them at the render step and reports that all three posts rendered and exported correctly on real data. `ratio-impact` reads nothing without a goalie id.

## Decisions for the lead to check

1. **A Window field was added** to Busy/Quiet and Rescue (L5, L10, STD; default L10). 10.2 asks for window fields, but CONTRACT's default table names none.
2. **Rescue also has a Category field** (wins, saves, SV%, GAA; default wins) and a visible include-unknown toggle (default off). One category orders the list; there is no combined score.
3. **Rescue applies the pickup cards' status rule**: only healthy or `DTD` count as available. On real data this removes 15 of the 62 qualified goalies (IR 6, NA 6, O 2, IR-LT 1), including 9 at or under 50% rostered, and leaves 26 candidates on defaults. The count is printed on the card. `NA` covers some goalies with recent starts, and Yahoo's status may lag. TJ may want to review this at real-input acceptance.
4. **Busy/Quiet shows no SV% or GAA at all**, and does not use `teamStartShare`, which no subtask requires.
5. **NST failures do not fail Busy/Quiet.** Shots stand, the source says `missing` and the columns show `—`. Rescue's reads are all or nothing, because ownership gates its pool.
6. **Team chances are per team game and never switch with basis.** The card discloses how many listed appearances shared the net.
7. **Ratio Impact takes saves as shots less goals** for entered lines, so a line cannot contradict itself. The sensitivity axis is goals allowed, at the entered shots and minutes, and it stops at the entered shots rather than print negative saves.
8. **`goalie-rescue` is a new id.** The older gated `category-rescue` format is untouched; its disposition stays with 13.0.

## Follow-up from the real render

The lead's render found "1 listed appearances shared the net" in the Busy/Quiet footnote. It now handles the singular, with a test for each form.

## Follow-up: fill the card, cut the text (TJ, 2026-10-31)

Built on the lead's shell change (`9bb30218d`, `756d4706f`), with a body of about 860px.

- **Rows:** Busy/Quiet goes from 6 to 11 per side, and Rescue from 10 to 20. Row heights stretch to fill the body, up to a cap, so a thin pool leaves a band rather than giant rows.
- **Ties:** Busy/Quiet holds at most 13 per side and Rescue 30. Anyone cut by that cap is counted in `evidence.sample`, so a tied goalie is never dropped silently.
- **Ratio Impact:** type is 30px and row heights stretch. `SENSITIVITY_MAX_STEPS` drops from 20 to 12, so the table still fits at that size.
- **On-card text:** each card has one legend line. Rescue and Busy/Quiet keep the window and through date in it, so the PNG still says what it covers. Explainers moved to `evidence.sample` and `evidence.cohort`, which print on the page.
- **Column changes:** Rescue's `TEAM GMS LEFT` is now `GMS LEFT`, with its meaning in the legend. Its `GS` cell no longer prints the short-window count; `GS` plus `RELIEF` is that count.
- **Spec:** `e2e/social-share-goalie-workload.spec.ts` now expects the Rescue legend, on top of the lead's `108c68938`.
- **Not verified:** no browser run. The row counts come from arithmetic on the 860px body, so the fill and the no-clip result need the lead's real render.

## Follow-up: overflow on the real render

The lead measured content of 1142, 1423 and 887px against bodies of 845 to 861px.

- **Cause:** the `.fill` wrapper's grid row sized to the table's largest content, so table rows grew to their height cap. Rows at the cap predict 1146, 1427 and 896px from the real snapshots' row counts, which matches. Row count was not the cause.
- **Fix:** `.fill` now has a `minmax(0, 1fr)` row and the table `min-height: 0`, so rows share the height actually available.
- **Expected row heights from the real snapshots, by arithmetic:** Busy/Quiet about 33px (11 per side), Rescue about 35px (23 rows), Ratio Impact about 80px on top and 67px in sensitivity. Ratio Impact's cap rises from 72 to 84px so its top table leaves no band.
- **Rescue tie cap:** 30 becomes 29, which fits at the 27px minimum in an 845px body.
- **Not verified:** no browser run. The lead re-measures.

## Follow-up: Busy and Quiet visuals (TJ, 2026-10-31)

- **Layout:** Busy and Quiet sit side by side in the goalie board style, reusing `GoalieIdent`. Its Best and Worst boards and `HeatTile` are not used, because they carry goodness colours.
- **Tile:** SA on the selected basis, in one cyan hue whose strength follows the shown low-to-high range. No green, red or tone attribute.
- **Sparkline:** shots against per appearance, oldest first, on one scale for the whole card. A null is a gap with a tick and a broken line; a real 0 is plotted. Relief is an open dot. The series is the goalie's appearances, so a team game he did not play is not a gap.
- **Kept, compact:** GP, GS, relief, total SA, HD SHOTS on the basis, and TEAM SCA and HDCA per game, in two detail lines. The legend keeps "Workload only, not how well a goalie played."
- **Rows and ties:** 11 per side gives about 72px rows at an 845px body. Minimum row is 63px, so the tie cap drops from 13 to 12; anyone cut is counted in `evidence.sample`.
- **Alt text:** adds each goalie's shots by game.
- **Spec:** expects `TEAM SCA` and a visible sparkline.
- **Not verified:** no browser run. The fit is arithmetic until the lead's render.

## Blockers

None. No frozen file needs a change.
