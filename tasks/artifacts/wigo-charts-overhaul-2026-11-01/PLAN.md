# WiGO Charts overhaul: plan (2026-11-01)

**Status:** planning finished. No application code changed; nothing pushed, deployed or written to production. TJ starts the implementation thread personally with `EXECUTOR-PROMPT.md`.

**Evidence:** `audits/A.md` (render to source), `B.md` (season and freshness), `C.md` (calculations), `D.md` (load), `E.md` (UI, read its "Revised top block" section first). `audits/PROD-READ-LEDGER.md` logs every production read: 44 SELECTs and 6 local page loads, all approved by TJ. Current season from the data: **20262027**, games through 2026-10-31.

**How far the evidence goes.** I checked these against the code myself: writer id order and flush size, `invalidFrame` rejection, TOI summing, `safeDivide` returning 0 for a zero numerator, `maxDuration` 240, no `retry` on the ratings query, the 3-attempt pager, the AS default and fallback, the 300 s schedule poll and the bare `QueryClient`. I also confirmed lane C's team-driver hand values, and the ratings error, 50% tiles and blank L-window rates, on lane D's real McDavid screenshot (`audits/screens/L2-star-warm.png`). Other row-level numbers are lanes B and C's reads, which I did not re-run. The layout was tested with a throwaway prototype on fictional data, never with real components or real data.

## 1. Worst findings

| # | What the user sees today | Cause | Fix type |
|---|---|---|---|
| 1 | **Ratings never load.** About 66 s of "Loading", then "Unable to calculate ratings right now." | ES, PP and PK percentile views time out at about 3 s (`57014`). Retries multiply: 48 failed reads per page view, about 148 s of database time | Client retry fix, plus migration (ask-first) |
| 2 | **Default percentile panel is a wall of 50%, rank 1st** (McDavid: last season's 3-game row, a cohort of one) | `nst_percentile_as_*` has 0 rows for 20262027 and no writer in the repo; the fallback accepts a junk cohort | Client fix, plus migration (ask-first) |
| 3 | **About 1 in 8 current skaters have stale or missing table rows.** Bedard STD GP 69 (real 8). 13 players, including McKenna, have an empty table | Writer dies at about id 8483787 and silently starves the same high ids each night. 8 more skaters are rejected by bad rows | Writer change, then TJ runs it |
| 4 | **L5, L10 and L20 per-60s are blank** for everyone who played last night (313 of 313), and L20 for most of the league | Writer runs 08:50 UTC, NST gamelogs land after 10:05; holes on 10-05 and 10-06; one missing game nulls the whole window | Writer change, schedule move, NST backfill (ask-first) |
| 5 | **145 skaters written on 11-01 show ATOI 0:00, ixG 0.0, iCF 0.** DIFF reads -100% | 215 of 740 skaters have no NST seasonal row; writer stores 0, not null | Writer change |
| 6 | **Traded players are wrong.** Mercer ATOI 26:10 (real 15:23), PTS/60 0.98 (real 1.67), IPP 37.5% (real 66.7%) | Stale pre-trade row summed with the cumulative row | Writer change |
| 7 | **No as-of label anywhere,** so none of the above is visible | `last_updated` is never read | Client |

The formulas themselves are almost all right. Lane C's hand recomputations matched wherever the inputs were sound. The problem is what feeds them.

## 2. Settled decisions (TJ, pop-ups, 2026-11-01)

| Topic | Decision |
|---|---|
| One screen | **Keep no-scroll** at 1280x800 and up. Below 1280 wide or under the height floor, the page flows and scrolls. |
| Width | **95% on this page only.** Do not change the shared `$page-max-width`. |
| Centre table | **One band of 36 metric columns,** time periods as rows (STD, LY, CA, 3YA, L5, L10, L20). Group row: Totals, Per 60, On-ice. Headers drop "/60" under Per 60. |
| DIFF | **Bottom row, no decimal.** Compare dropdowns stay in the toolbar. L and R markers on period row labels. Period column pinned. No side-scroll at 1280. |
| `PTS1/60` | Moves to Per 60 as `PTS1`. |
| Charts | **One full-width row of four:** Metric Game Log, TOI, Points/GM, Game Score. |
| Top block | Approved grid in section 4: radar is a big square two rows tall on the far right; doughnut under the headshot; rate percentiles narrowed to span pace and list. Replaces the first-round "right of the bio group" arrangement. |
| "Game log" in the bio group | The date/opponent list (`OpponentGamelog`). |
| Phone | Keep the four tabs, regrouped as in section 4. Horizontal band with pinned period column and side-scroll. |
| Slow views | Executor runs EXPLAIN (with TJ's OK), drafts a local migration and stops. TJ approves applying it. |
| AS percentiles | **Make AS real** from game logs, by local migration for approval. Remove the junk fallback now. Until applied, AS says it has no data yet. Not a release blocker. |
| Metric Game Log | Bars for counts, straight segments for rates, real gaps. |
| F/D cohorts | **Keep pooled, and say so** on the panels ("all skaters"). |
| `PP%` | **Keep the label;** define it in hover and help. It is share of team power-play time. |
| Order | **Code first, UI alongside.** Local data fixes, then speed, then UI passes. UI does not wait for production steps, and TJ runs those when ready. Some panels stay wrong until then. |
| Test players | From the data: McDavid 8478402 (star), Imama 8478147 (depth), Bystedt 8483428 (rookie, 2 GP), Mercer 8482110 (traded). They do not show the writer stall: use Bedard 8484144 or McKenna 8486067 for that. No goalie case; search excludes goalies. |

**Decided by this thread, TJ may overrule:** rookie default stays STD vs CA, with a note when CA is empty. No TOI floor on rating cohorts (C-32) in this overhaul: it changes ratings and TJ has not asked for it. Brand elements stay, including the "What Is Going On" italic caps tagline. Help notes stay as popovers inside their panels.

**Superseded:** LAYOUT-PLAN 10-25 grid and two transposed halves. The 10-25 "no-scroll at 1280" rule stands.

## 3. Component health

Verdicts: **OK**, **Missing**, **Stale**, **Wrong**, **Misleading**. "Hand-checked" means recomputed from raw rows by lane C.

| ID | Component | Correct? | Complete? | Current? | Verdict and evidence |
|---|---|---|---|---|---|
| C01 | Search and header | Yes | No empty-result message; options show name only | Yes | **OK, minor.** A-15, old A-13 |
| C02 | Headshot, logo | Yes | Yes | Yes | **OK.** Direct NHL fallback fetch, old A-14 |
| C03 | Identity, bio | Mostly | Raw L/R position codes | **14 stale teams, 2 null** | **Stale for traded players.** Mercer shows NJD, plays WPG. B-10 |
| C04 | Season production | Yes, hand-checked | Yes | Yes (totals 11-01 07:40) | **OK.** C worked table |
| C05 | Per-game and 84-game pace | Yes, hand-checked | Yes | Yes | **OK.** 84 confirmed per team, C worked table |
| C06 | Date/opponent list | Yes | Yes | Yes | **Misleading.** Current team's schedule, not the player's games; only a hidden `aria-label` says so. Polls forever. A-09, D-05 |
| C07 | Ratings | Even/PP/PK formulas hand-checked | **Never renders** | Would mix seasons | **Missing.** D-01; All cells blank even once loading works, C-24 |
| C08-C11 | Team drivers | Yes, hand-checked for EDM and FLA, and EDM matches the real screenshot | Yes | Yes, 10-31 | **OK.** Slow, 6 requests. D-02 |
| C12 | Comparison table | Wrong for listed cases | L-window rates, OZS% STD/LY blank | **84 stale, 13 absent** | **Wrong.** B-01, B-02, C-20, C-21, C-22, C-25, C-26, C-30, C-31 |
| C13 | Metric Game Log | Values right where read | Gaps on 10-05, 10-06 for NST metrics | Yes | **Misleading.** Smoothed curves, gaps bridged (E-08). IPP, oiSH%, OZS% scale unverified (R-5) |
| C14 | Point consistency | Yes, hand-checked | Yes | Yes | **OK.** Colours fail CVD (E-04) |
| C15 | Radar | Yes, hand-checked; cohort is 740, under the 1000 cap | Values hover-only | Yes | **OK, misleading edges.** Small samples, PIM "more is higher". C-28, C-33, E-03 |
| C16 | TOI | Yes | Yes | Yes | **OK.** "Avg (min)" legend with mm:ss; odd ticks. E-13; own read D-06 |
| C17 | Points/GM | Yes | Yes | Yes | **OK.** Lines vanish on bars, E-04 |
| C18 | Game Score | Yes, RPC matched for all 14 McDavid games | **Gaps** for 280 rows 10-27 to 10-31 (`es_goals_for` null) | Yes | **Missing, data.** Imama 12 of 14. C-27, B-11 |
| C19 | Rate percentiles | ES hand-checked; **AS wrong** | Sparse players get "No AS data" | **Last season's stub** | **Wrong.** C-23, B-08. ES, PP, PK reads may time out too (not clicked, D-01) |
| P1 | Phone `StatsTable` | As C12 | DIFF off-screen; "+0.0%" in green | As C12 | **Wrong,** as C12. E-14 |
| P2 | `TimeframeComparison` | Yes | Yes | n/a | **OK** |

**Cross-lane catch:** lane C advises defaulting to ES while AS is empty, because its reads worked. Those ran through privileged SQL. Lane D shows the same ES views time out through the browser's anon path. So ES and ratings depend on the slow-view migration (P-1). Do not treat ES as a working substitute until that lands.

## 4. Target layout

Approved by TJ from `audits/screens/E-proto2-*.png`. Sizes are measured in the prototype at 95% width and a 4 px gap.

### 1280x800 to 1920x1080: no scroll

```
WiGO  What Is Going On | search                       | thumb, team, Clear    36
+----------+--------+--------+----------+----------------+
| identity |  pace  |  date/ | ratings  |                |
| + season |        |  opp   |          |     RADAR      |
|  stats   |        |  list  |          |  (two rows     |
+----------+--------+--------+----------+   tall, near   |
| doughnut | rate percentiles| team     |   square)      |
|          | 3 columns x 6   | drivers  |                |
+----------+-----------------+----------+----------------+
Compare [STD] vs [CA]   DIFF: % change . counts per game  (i)
       |      Totals (17)     |    Per 60 (15, incl. PTS1)   | On-ice (4) |
Period | GP ATOI PTS G A ...  | G A PTS SOG ...              | IPP oiSH%..|
STD  L | content-sized columns, 11 px floor                               |
LY / CA R / 3YA / L5 / L10 / L20
DIFF   | no decimal, bold, under a rule                                   |
+-------------+-------------+-------------+-------------+
| Metric log  | TOI         | Points/GM   | Game score  |   remaining height
+-------------+-------------+-------------+-------------+
```

| Breakpoint | Identity, doughnut | Pace | List | Ratings, drivers | Radar | Top rows | Band row | Charts |
|---|---|---|---|---|---|---|---|---|
| 1280x800 | 230 | **236 minimum** | 190 | 240 | 304x308 | `90px 66px 156px` | 187 | about 305x184 |
| 1440x900 | 258 | 258 | 214 | 270 | 352x352 | `106px 72px 178px` | 197 | about 343x230 |
| 1920x1080 | 343 | 343 | 285 | 360 | 477x460 | `130px 102px 232px` | 217 | about 457x280 |

Row template: `auto <top rows> auto minmax(<150|180|240>px, 1fr)`. Band padding floors 1.5, 2 and 3 px.

**Conditions the prototype found (all required):**
- Band uses `table-layout: auto`, `width: 100%`, and an `overflow-x: auto` guard. Equal columns do not fit at 1280; `+999%` everywhere needs 1179 of 1214 px at the 1.5 px floor.
- `WIGO_FIT_MIN_WIDTH` rises from 1200 to **1280**. `WIGO_FIT_MIN_HEIGHT` stays 700.
- Rate percentiles use **3x6, column-first**. 4x4 overflows at 1280 and 1440. Sparse tiles show one `—`; "Rank unavailable" overflows at 1280 and 1440.
- Drivers' partial-coverage note fits one line ("Partial: covered games only").
- Radar keeps full labels and ring ticks, with a lighter fill so it doesn't outrank the table.

**Known limit: charts are wider, not taller, at 1280.** Today 189x187, target about 305x184. They gain real height only at larger windows. Season density goes from about 1.8 to about 3.2 px per game at 1280.

**Known gap: a real browser window is shorter than these sizes.** 1440x900 was tested at a literal 900 inner height. A laptop browser with toolbars may have about 790 (estimate). Row tiers must key off **height as well as width**, as the existing `min-width: 1400px and min-height: 860px` tier does, and the executor must test 1440x790. That case should use the shorter top rows and give charts at least 150 px. TJ will not see the 1440x900 numbers in a normal laptop window.

### 769 to 1279 wide, or short windows: flow and scroll

```
context bar
identity + season stats | date/opp list
doughnut                | pace
rate percentiles (full width)
ratings                 | team drivers
radar (full width, capped height)
band: side-scrolls, period column pinned, opaque
Metric log              | TOI
Points/GM               | Game score
```

### 390 wide: four tabs

```
OVERVIEW     identity, season stats, pace, date/opp list
TRENDS       doughnut, TOI, Points/GM, Game score
PERCENTILES  radar, rate percentiles, ratings, drivers
COMPARISON   compare dropdowns; jump buttons Totals, Per 60, On-ice;
             band with pinned period, side-scroll, edge fade;
             Metric Game Log below; L5/L10/L20 note
```

Band at 13 px, 28 px rows, 32 px header, 45 px pinned column. It replaces the 35 "+" expanders and shows DIFF, which is off-screen today. Drop per-game repeats between season stats and pace on Overview. One ratings row order on desktop and phone.

## 5. Ordered work

Commit each item separately with explicit pathspecs. Data and performance items do not need a pop-up per item; UI passes do (section 7). All paths are under `web/`.

### Stage 1: data and logic, local code only

"Done" means the code is merged locally. Real values change only after TJ's production steps in section 6.

| # | Item | Findings | Files | Acceptance and tests |
|---|---|---|---|---|
| D1 | **Writer finishes and reports.** Limit the daily loop to players with a totals row in the current or previous season. Flush the partial batch on exit, stop before the platform limit, and write an audit row with counts and `rejectedPlayerIds` even if cut short | B-01, C-20 | `pages/api/v1/db/calculate-wigo-stats.ts`, `lib/cron/withCronJobAudit.ts` only if required | `__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts`: high ids are reached; a time-boxed stop still flushes and reports. **Not run against production** |
| D2 | **Multi-team seasonal rows.** Per season, use only the highest-GP row, on both NST reads | B-04, C-22 | same | Fixture shaped like Mercer: `N.J` plus `N.J, WPG` gives 215.27 min, iCF 45, ixG 2.89, GF 9 |
| D3 | **Null, not zero; WGO TOI as denominator.** ATOI and per-60s of WGO counts use `wgo_skater_stats_totals.toi_per_game`. NST-only stats stay null when NST is absent. Applies to STD, LY, 3YA, CA | B-05, C-21, C-31, A-01, A-02 | same | Bystedt shape: ATOI 12:51, ixG null, not 0. Check that WT `toi_per_game` is seconds, as C confirmed for this season |
| D4 | **L-windows.** WGO TOI for ATOI and WGO-count per-60s; per-metric coverage so one missing NST row nulls only NST-only metrics | B-06, B-07, C-25 | same | McDavid 10-31 shape: L5 ATOI 23:13, G/60 1.03, PTS/60 5.68, ixG null with missing NST |
| D5 | **GP-weight PP%** in 3YA and CA; numerators and denominators over the same seasons | C-30, B-05, B-06 | same | McDavid 3YA 80.78%; 8481604 CA shape 55.3% |
| D6 | **Rejected players.** Record which rule fails. Classify the cause only after a TJ-approved read (P-9), then decide. The whole-player rejection was deliberate (`80425a4a9`), so keep it until the cause is known | B-02 | same | Rejected list appears in the response and audit |
| D7 | **Percentile fallback.** Reject a fallback whose max GP is under min GP or whose target row is too small; sanitize fallback GP; show a plain "no data yet" state | C-23, B-08, C-34 | `utils/fetchWigoPercentiles.ts`, `components/WiGO/RateStatPercentiles.tsx` | `fetchWigoPercentiles.test.ts`, `RateStatPercentiles.test.tsx`: no 16-tile 50% wall with a cohort of 1; slider max not under min |
| D8 | **Ratings honesty.** Season label not a raw id; "-" with a reason when AS is empty; state that Overall omits AS while empty | C-24, B-12 | `PlayerRatingsDisplay.tsx`, `WigoDashboardSections.tsx` | `PlayerRatingsDisplay.test.tsx` |
| D9 | **As-of and stale detection.** Read `last_updated`; compare `std_gp` with totals `games_played`. The UI (U9) shows the date and marks the STD row stale when they differ | B-09, A-07, C-20 | `utils/fetchWigoPlayerStats.ts`, `hooks/useWigoPlayerDashboard.ts` | Bedard shape: STD 69 vs totals 8 flags stale |
| D10 | **Empty and failure states.** Expose the season error; matrix says why it's empty; no "Select a player" when one is selected or the team is null | A-04, A-05 | `hooks/useCurrentSeason.ts`, `WigoComparisonMatrix.tsx`, `TeamPerformanceDrivers.tsx`, `OpponentGamelog.tsx`, others in A-05 | Tests per panel; season-failure case |
| D11 | **Traded player's team.** When the latest WGO game's team differs from `players.team_id`, use the latest game's team for branding, schedule and drivers | B-10, A-09 | `hooks/useWigoPlayerDashboard.ts` | `useWigoPlayerDashboard.test.tsx`: Mercer shape shows WPG |
| D12 | **Radar.** Order and page the RPC read (`.order`, range) before it nears the cap; floor the cohort at 5 games while keeping the target; state the player's GP and "all skaters" | C-02, C-33, C-28 | `hooks/usePercentileRank.ts`, `CategoryCoverageChart` | Test paging past 1000; small-sample label |
| D13 | **Smaller logic.** `+0%` rounding through one formatter; PTS1% game log comparable with aggregate or defined; remove dead code that blocks the band (A-15); remove `console.log` noise (old A-18) | E-12, A-06, A-15 | `tableUtils.ts`, `StatsTable.tsx`, `fetchWigoPlayerStats.ts` | `tableUtils.test.ts` |

### Stage 2: performance, local code only

Ranked by lane D. Warm baseline in dev: 82 requests with the failure storm, about 30 once ratings is fixed; about 1.0 MB decoded; last panel 2.3 s. Timings are dev-mode.

| # | Item | Saves | Files | Acceptance |
|---|---|---|---|---|
| S1 | **Stop retrying timeouts.** Ratings `retry` 0 or 1; pager does not retry `57014` | 44 of 48 failed requests; wait from about 66 s to about 3 s | `PlayerRatingsDisplay.tsx`, `fetchWigoPlayerStats.ts` | Test: `57014` makes one attempt per layer |
| S2 | **WiGO-scoped query defaults.** Long `staleTime`, no refetch on focus. Do not change `_app.tsx`; that affects every page | About 25 requests, 0.7 MB per refocus (code estimate, not observed) | `useWigoPlayerDashboard.ts`, cohort and driver `useQuery` calls | Tests on options |
| S3 | **Schedule poll.** Poll only when a game is today; otherwise none, with a long `staleTime` | Up to 12 `/api/cors` calls an hour per tab | `OpponentGamelog.tsx` | `OpponentGamelog.test.tsx` |
| S4 | **Break serial chains.** Drivers' four stages and the percentile fallback run in parallel where correctness allows | About 450 ms and about 500 ms, on the slowest path | `fetchTeamDriverSnapshots.ts`, `fetchWigoPercentiles.ts`, `useWigoPlayerDashboard.ts` | Existing tests keep the cutoff and stale rule |
| S5 | **Merge reads.** One `wgo_skater_stats` read for all charts; four totals reads down to two; drop the defense read that only supplies `gp` and `toi_seconds` | 7 requests, about 45 KB | `ToiLineChart.tsx`, `useWigoGameLog.ts`, `fetchWigoPlayerStats.ts`, `fetchWigoPercentiles.ts` | Confirm which games TOI should include (it has no `games_played = 1` filter today) |
| S6 | **Memoize** chart data, options and sections | Avoids rebuilds on compare changes and resize (not measured) | `ToiLineChart.tsx`, `PpgLineChart.tsx`, `GameScoreLineChart/index.tsx`, `WigoDashboardSections.tsx` | Tests pass; zoom survives a compare change |
| S7 | **Linear ratings regression** | About 1M comparisons per stat on low-GP targets | `calculateWigoRatings.ts`, `calculatePercentiles.ts` | Same outputs in tests |
| S8 | **Lazy-load chart libraries** (`StatsTableRowChart`, `RateStatPercentiles`, `CategoryCoverageChart`) | Not measured for production | `WigoDashboardSections.tsx`, `WigoComparisonMatrix.tsx` | No layout shift; no production build unless TJ agrees |
| S9 | **Trim `select *`** | About 5 KB | `useWigoPlayerDashboard.ts`, `fetchWigoPlayerStats.ts` | Tests |

Verify with the fixture's request log: counts and duplicates before and after. Real timings need TJ-approved page loads (P-9).

### Stage 3: UI passes

**One pass at a time, under the protocol in section 7.** Read the `dataviz` skill before any chart change.

| Pass | What TJ sees | Findings | Main files | Acceptance |
|---|---|---|---|---|
| U1 | Width 95% on this page; fit floor 1280 | E-05 | `pages/wigoCharts.tsx`, `styles/wigoCharts.module.scss:1467` | Other pages unchanged; 1200-1279 flows |
| U2 | **New grid and band** together, including rewriting `e2e/wigo-one-page.spec.ts`. Group row; `PTS1` under Per 60; L and R on rows; DIFF row without decimal; 95%-based tiers by width and height | E-01, E-07, E-12, A-12 | `WigoComparisonMatrix.tsx`, `pages/wigoCharts.tsx`, `WigoDashboardSections.tsx`, stylesheet, spec | Section 4 sizes ±10 px at 1280x800, 1440x900, 1440x790, 1920x1080; no document scroll; no clipped cell; every `data-coverage` present; `+999%` worst case fits at 1280 |
| U3 | Header as metric control: selected column, focus ring, roving tabindex, full accessible names, `<colgroup>` semantics, `aria-live` title | E-02, E-09, A-12 | `WigoComparisonMatrix.tsx`, stylesheet | Arrow keys work; names unique ("Shots per 60"); not read as "Show … game log" on each cell |
| U4 | Rate percentiles slot: 3x6 column-first, capped slider, two-line filter, one `—` per sparse tile, panel says "all skaters"; short drivers note | E-10, C-29 | `RateStatPercentiles.tsx`, `TeamPerformanceDrivers.tsx`, stylesheet | Fits with two chips at 1280; 16 meters |
| U5 | Radar and doughnut: full labels, ticks, printed values, `aria-label`, lighter fill; doughnut ordinal ramp and label | E-03, E-04, C-28 | `CategoryCoverageChart`, `ConsistencyChart.tsx`, `styles/wigoColors.ts` | Radius at least 90 at 1280; validator passes CVD for the doughnut |
| U6 | Chart row consistency: dates, ticks, solid grid, legend on title line, one-row chips, TOI 5-minute steps, type tiers | E-13, E-08 | `ToiLineChart.tsx`, `PpgLineChart.tsx`, `StatsTableRowChart.tsx`, `GameScoreLineChart` | Same date format and tick size across all four |
| U7 | Metric Game Log: **bars for counts, straight segments for rates, real gaps,** mean in the title line | E-08 | `StatsTableRowChart.tsx` | `isWigoCountChartStat` picks bars; `connectNulls` off; no text over marks |
| U8 | Colour roles: recessive bars, one meaning per colour, L and R match table, legend text in ink | E-04 | `styles/wigoColors.ts`, chart files | `dataviz` validator; 3:1 where lines cross bars |
| U9 | Honest states: as-of date, stale-row mark (D9), rookie DIFF note, plain copy for "no data yet", team-schedule title on the list | E-06, A-09, B-09 | `WigoComparisonMatrix.tsx`, `OpponentGamelog.tsx` | Bedard and Bystedt shapes; label states it is the team's schedule |
| U10 | Phone band, pinned opaque column, jump buttons, scroll cue, focusable scroll region, game log below | E-11, E-14 | `StatsTable.tsx` or the shared band, stylesheet end block | All periods and DIFF reachable; 13 px; focusable wrapper |
| U11 | Phone regrouping, as in section 4 | E phone section | `pages/wigoCharts.tsx`, `WigoDashboardSections.tsx` | Each panel appears once; `?tab=` still works; add ⓘ on phone ratings (A-13) |
| U12 | Copy and definitions: PP%, PTS1%, OZS%, CA, 3YA, PP per-60 denominators in hover and help; E-15 copy table; final accessibility; Axe if back | A-06, A-08, E-15, A11y table | `statMetadata.ts`, `WigoComparisonMatrix.tsx`, others | `design:ux-copy` review; Axe run, or reported as not run |

**Every pass:** run the CSS pure check on each changed stylesheet, since Vitest misses it. New phone rules go in the block at the end of `wigoCharts.module.scss`. Canvas fonts use `Roboto Condensed, sans-serif`. Nothing under the 11 px floor.

## 6. Production and ask-first

**Not part of any pass. The executor drafts locally and stops; TJ approves each one, directly and for the exact scope.** TJ runs routes from the browser.

| # | Step | Needs | Fixes | Owner |
|---|---|---|---|---|
| P-1 | Slow views: EXPLAIN, then indexes (`nst_gamelog_*` has season last) or a stored table | TJ OK for EXPLAIN; **migration** | Ratings; ES, PP, PK percentiles | Executor drafts; TJ approves applying |
| P-2 | AS source for 20262027, built from game logs; likely shares P-1's stored table. Also find or replace the missing writer | **Migration**, maybe a schedule | AS tab, All ratings | Executor drafts; TJ approves. GP undercounts until P-5 |
| P-3 | **TJ runs `calculate-wigo-stats`** after D1-D5 ship. A plain rerun today would stop at the same place | Deployment, then TJ's run | Items 3, 5, 6 in section 1 | TJ |
| P-4 | Move pg_cron job 231 (`update-wigo-table-stats`, 08:50 UTC) after the 10:05 pipeline | **Production schedule** | Blank L-window NST metrics | TJ approves |
| P-5 | NST gamelog backfill for 10-05, 10-06 and on-ice 10-04. About 40 URLs, which is not under the burst limit, so pace at the `AGENTS.md` limits | Route run | L10, L20; Metric Game Log gaps | **Codex lane**; report only |
| P-6 | NST seasonal: no row for 215 of 740 skaters; stale pre-trade rows; `off_zone_starts`, `def_zone_starts` null on all 528 rows | Investigation | NST-only STD stats, OZS% | **Codex lane**; report only |
| P-7 | Refresh `players.team_id` for 16 skaters | Writer not traced | Root of D11 | TJ decides |
| P-8 | `s-maxage` on `/api/cors` schedule URLs and `/api/v1/season` | Changes production caching | Function invocations | TJ approves |
| P-9 | More bounded reads and page loads: rejected list (D6), IPP/oiSH%/OZS% scale (R-5), past-season seasonal rows, real timings | Exact scope, each time | Unverified items | TJ approves |
| P-10 | Server-side cohort aggregation (D rank 4): about 730 KB and 12 requests per view | **Migrations**; logic moves to SQL | Load | Later; propose only after P-1 |
| P-11 | Release: push, merge, deploy. The 14 commits of the 10-30 pass are also still on `octoberBranch` only | Separate approval, per `AGENTS.md`. Never push `octoberBranch` alone | All | TJ |

## 7. UI pass protocol

Make ONE pass. Capture desktop and phone screenshots on the isolated dev server. Show them. Ask TJ by pop-up to approve or request changes. On changes, iterate on the same pass and ask again. On approval, commit with explicit pathspecs, and only then start the next pass. No pass is skipped or bundled.

## 8. Not verified

- **Axe never ran.** The server was still failing to connect at the last check. No screen reader run. Accessibility claims are by hand or from code.
- **Prototype only:** real components in the new grid, real data in the grid, sizes between the three, 769-1279 flow and the no-player state are untested. Lane E's chart-size and text-width numbers are from the prototype.
- **Writer kill by platform limit is inferred,** strongly. Platform logs and `cron.job_run_details` were not read. About 1,000 rejected players per run is an estimate (B-02).
- **Slow-view cause** comes from migration text, not EXPLAIN. ES, PP and PK buttons were not clicked. Whether the view timeouts apply to every strength button is unverified.
- **LY, 3YA and CA causes** rest on 20262027 seasonal rows plus effects in `wigo_career`.
- **Why** 215 seasonal rows are missing, and whether `es_goals_for` self-heals (C-27), is unknown.
- **Not observed at runtime:** refetch on focus (lane D's test was invalid), the 5-minute poll, resize re-renders, the phone path's requests. Production bundle sizes were not measured; dev-only.
- **Lease:** `WIGO-UI-PASS` still reads `active` in `CLAUDE-LEASES.json` though its diary says done. Coordination files are outside this thread's scope, so the executor must have that closed and a new lease opened (see the prompt).
