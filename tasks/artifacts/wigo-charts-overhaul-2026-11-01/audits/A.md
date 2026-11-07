# Lane A: render-to-source matrix for the WiGO Charts page (2026-11-01)

**Scope.** Every unique component C01-C19 (`data-coverage` attributes in `web/pages/wigoCharts.tsx` and `web/components/WiGO/**`), on the desktop one-page path and the phone path. Phone-only: `StatsTable`, `TimeframeComparison` (the desktop toolbar reuses it), the phone percentile bar chart. Nothing was added since the 10-25 audit except the 10-30/31 visual pass (12 UI commits, no data-layer change; `git log --since=2026-10-26` on every WiGO path shows only `WIGO UI pass step 1-12`).

**Method and limits.** Code, DDL and generated types only, read in this session: the page, `WigoDashboardSections`, all `components/WiGO/*` components, `CategoryCoverageChart`, `useWigoPlayerDashboard`, `useWigoGameLog`, `useWigoPlayerTotals`, `usePercentileRank`, `fetchWigoPlayerStats`, `fetchWigoPercentiles`, `fetchWigoRatingStats`, `calculateWigoRatings`, `fetchTeamDriverSnapshots`, `teamPerformanceDriverModel`, the writer `pages/api/v1/db/calculate-wigo-stats.ts`, and the DDL for `get_skater_game_scores_for_season` and `get_skaters_avg_stats` (baseline migration). A script confirmed that all 36 metrics x 7 periods map to a column that exists in `wigo_career`/`wigo_recent` (generated types) and is assigned by the writer.

**Not done (be clear):** no production read (lane A has none), so no value was seen; no Vitest, no e2e, no dev server, no browser. "Verified by `fixture`" is not claimed anywhere: the fixture (`web/e2e/fixtures/wigo/wigoFixtures.ts` header) says its numbers are not internally consistent and prove nothing about data, so it can only show layout. Everything below is verified by `code` unless marked otherwise. Generated types may lag production. **The current season was not established from data** (no read); today is 2026-11-01, so I expect 2026-27 about 12-15 games in. That is an expectation, not a finding. Lane B/C should confirm it with `games` (type 2, latest `seasonId` with date <= today); `seasons` is not on the approved table list.

---

## 1. Findings, worst first

`P0*` = wrong number shown **if** the stated data condition holds; the code path is verified, the data condition needs a production read (section 4, R-ids).

### A-01 (P0*): seasonal aggregates are zero-filled, so "no data" shows as 0, 0.0 or 0:00
- **Where:** `calculate-wigo-stats.ts:423-451` (`initSeasonData` starts `toi_all`, `ixg_all`, `icf_all`, `ihdcf_all`, `iscfs_all`, `gf_all`, `sf_all`, zone starts and every `wgo_*` count at 0); `:524` `std_atoi = safeDivide(toi_all, gp)`; `safeDivide` (`:128-136`) returns null only for a null numerator or null/zero denominator, so `safeDivide(0, 50)` is 0. Same for `ly_`, `ya3_`, `ca_`.
- **Failure scenario:** a player-season that has a `wgo_skater_stats_totals` row but no `nst_seasonal_individual_counts` row (strength `all`) gets `std_atoi = 0`, `std_ixg = 0`, `std_icf = 0`. The matrix shows ATOI "0:00", ixG "0.0", iCF "0" (`formatWigoStatValue`: `statMetadata.ts`, null only becomes "-"). The per-60s are correctly null ("-") because `toi_all = 0` is a zero denominator. In the recent windows the same condition is handled correctly (`metricCoverage` nulls the metric, `calculate-wigo-stats.ts:1166-1190`), so L5 shows "-" next to STD "0.0". The reverse also holds: NST rows present but no WGO totals row zero the counts (Goals, Points, ... show 0).
- **Verified:** `code`. **Not verified:** whether any current-season, LY, 3YA or CA player-season has that shape (R-1, R-2). Rookies with no season at all are not affected (no `stdData`, all null).
- **Better source exists:** `wgo_skater_stats_totals.toi_per_game` (seconds, same row the charts use) would not need NST for ATOI.

### A-02 (P0*; continues B-05): 3YA and CA mix seasons that have NST ice time with seasons that do not
- **Where:** 3YA `calculate-wigo-stats.ts:697-838`, CA `:841-981`. Numerators `wgo_g`, `wgo_pts`, `wgo_sog`, `wgo_hit` ... sum every season in the window; the denominator `toi_all` sums only seasons that have NST rows (WGO-only seasons contribute 0). `gp` sums all seasons. `ya3_atoi = toi_all / gp`; `ya3_g_per_60 = calculatePer60(wgo_g, toi_all)`; `ya3_ipp = wgo_pts / gf_all`.
- **Failure scenario:** a veteran whose CA window includes two seasons without NST rows: CA G/60, PTS/60, SOG/60, HIT/60, BLK/60, PIM/60 and IPP are inflated by those seasons' counts over a smaller ice time; CA ATOI is deflated (`toi_all` too small for `gp`). The PP per-60s (`ppg_per_60` etc.) use `wgo_pp_toi` from WGO only, so they stay consistent, which also makes them disagree with the rest of the same column.
- **Verified:** `code`. **Not verified:** how many seasons lack NST rows (R-1).

### A-03 (P1, becomes P0 if a unit is wrong; continues B-10): ATOI, PPTOI and every per-60 depend on three unverified time units
- **Chain, from code:** STD/LY/3YA/CA use NST seasonal `toi` documented as minutes (`:464`), then `normalizeWigoAggregateValue` multiplies ATOI by 60 (`statMetadata.ts`, `minutesToSeconds`). L5/L10/L20 use `nst_gamelog_as_counts.toi` documented as seconds (`:1005`) and divide by 60 for `atoi` (`:1059`), by 3600 for per-60. PPTOI everywhere is `wgo_skater_stats(_totals).pp_toi` divided by games (identity, so it must already be seconds). The charts use different columns of the same rows: TOI chart `wgo_skater_stats.toi_per_game` and `pp_toi_per_game`, PP per-60 chart `pp_toi_per_game`, while the writer uses `pp_toi`.
- **Failure scenario:** if any one unit differs from the comment, one period column is off by 60 (the September evidence "L5 G/60 = 0.01" was this class), and the matrix reference lines on the TOI/ATOI/PPTOI game log sit on the wrong axis scale.
- **Verified:** `code` for the chain. **Not verified:** all three units and `pp_toi` versus `pp_toi_per_game * games_played` (R-2, R-3).

### A-04 (P1; new): the comparison matrix goes silently blank when it has nothing to show
- **Where:** `hooks/useWigoPlayerDashboard.ts:164-168` and `:224`; `WigoComparisonMatrix.tsx:111` and `:180-190`. The aggregate query is `enabled` only once the season is known; with TanStack Query 5.90.15 (installed) a disabled query has `isLoading` false, so nothing says "loading".
- **Failure scenarios:**
  1. First paint: season request in flight, player selected: all 36 rows show "-" with an empty status line, then fill in.
  2. `/api/v1/season` fails: all "-" for the whole session (the season error is dropped, A-05).
  3. A player with neither a `wigo_career` nor a `wigo_recent` row (for example a call-up the writer has not reached): `fetchPlayerAggregatedStats` returns `[]` and the matrix shows 36 "-" rows, no sentence. The phone `StatsTable` has a "no data" row for the empty case; the desktop matrix does not.
- **Verified:** `code`. **Not verified:** the first-paint flash length.

### A-05 (P1; continues A-06): a failed season lookup, or a player with no team, shows the wrong status in six panels
- **Where:** `hooks/useCurrentSeason.ts:36` (`data ?? undefined`, error dropped); consumers: `PerGameStatsTable.tsx` ("Loading season info..."), `OpponentGamelog.tsx` (same), `PlayerRatingsDisplay.tsx`, `ConsistencyChart.tsx`, `ToiLineChart.tsx`, `PpgLineChart.tsx`, `RateStatPercentiles.tsx` (all "Loading season info..." forever after the retries), `TeamPerformanceDrivers.tsx:29,39,50` (`enabled` false renders "Select a player" even though one is selected).
- **Second trigger (new):** `buildWigoBranding` (`useWigoPlayerDashboard.ts`) returns `teamIdForLog: null` when `players.team_id` is null (unsigned, retired, AHL) and a null abbreviation when `teamNameToAbbreviationMap` lacks the name. Then `OpponentGamelog` says "Select a player" (`!teamId`) or "Could not find team abbreviation.", and the drivers card says "Select a player". The player-bio card and the matrix still render, so the page looks half-empty with the wrong explanation.
- **Verified:** `code`.

### A-06 (P1; new): labels that do not say what the source column means
| Label shown | What the source is | Where | Fix direction |
| --- | --- | --- | --- |
| **PP%** | Player's share of the **team's** power-play ice time (`wgo_skater_stats(_totals).pp_toi_pct_per_game`, a 0-1 fraction x100). Not conversion, not PP points share. The DDL comment on `wigo_career.std_pp_pct` says so; the UI never does. | `statMetadata.ts` (`PP%`), writer `:526`, `:761`, `:1067` | rename to "PP TOI%" or add a definition |
| **PPG, PPA, PPP /60** | Per 60 minutes of **PP** time (`wgo_pp_toi`), where every other "/60" is per 60 of all-situations ice time | writer `:586-605` | the planned group row "Per 60" that drops "/60" would hide the different denominator |
| **PTS1%** | (goals + primary assists) / points; null when points = 0 in the aggregates, but the game log plots 0 for a pointless game (`fetchWigoPlayerStats.ts`, `PTS1%` branch), so the chart's dashed "Game mean" is not comparable to the aggregate | `statMetadata.ts`, `fetchWigoPlayerStats.ts` | definition text |
| **OZS%** | OZS / (OZS + DZS) over **all strengths** (DDL comment), the common definition is even strength | writer `:539-542` | definition text |
| **CA** | Career average **excluding the current season**, over every season in `wgo_skater_stats_totals` (including partial and short seasons) | writer `:841-845` | definition text |
| **3YA** | The three seasons **before** the current one (LY is the first of them), not "last three years including now" | writer `:224-228` | definition text |
| **iHDCF/60, iSCF/60, iCF/60, ixG/60** (matrix) next to **HDCF/60, SCF/60** (percentile tiles) | individual versus on-ice chance counts (NST naming); both sets appear on one screen with no group heading | `RateStatPercentiles.tsx:44-66` | group or tooltip |

No definition of PP%, PTS1%, OZS%, CA or 3YA exists anywhere in the matrix, its help text or the phone `StatsTable` (the only note is about L5/L10/L20 spanning seasons).

### A-07 (P1; continues A-02 and B-04): aggregates carry no season or as-of date, so STD means "whatever the writer treated as current"
- **Where:** `wigo_career` has no season column (DDL; only `last_updated`); `WigoComparisonMatrix` never shows it. The page season comes from `/api/v1/season` at view time, the writer's from the same function at run time.
- **What changed since 10-25:** the query key and fetch now include the season (`getWigoAggregatedStatsQueryKey(playerId, seasonId)`, `fetchPlayerAggregatedStats(playerId, stdSeasonId)`), and the totals fallback only fills STD when `String(totalsData.season) === String(stdSeasonId)` (`fetchWigoPlayerStats.ts:244`). So old A-01 is fixed. Still open: after a rollover, or when the writer cron fails or skips (`withNhlOffSeasonSkip`), STD/LY/3YA/CA describe the previous frame while the production tiles (totals row for the new season) show the new one, with no label.
- **Verified:** `code`. **Not verified:** the writer's real freshness (R-4).

### A-08 (P1; continues B-06 and B-07): 3YA and CA columns use different semantics from STD and L-windows, undisclosed
- Counts (Goals, Points, SOG, PPP, ixG, ...) are **per-season means** (total / seasons used) in 3YA and CA, but **totals** in STD, LY and L5-L20. The GP row in the same column is the same per-season mean (`ya3_gp = gp / numSeasons`). DIFF stays right because it divides by the same-column GP (`tableUtils.ts`), but a reader comparing "Goals STD 12" to "Goals CA 28" sees totals against means.
- `ya3_pp_pct`/`ca_pp_pct` are an **unweighted mean of seasonal** shares (DDL comment), not pooled.
- Partial seasons (the 2020-21 shortened year, a call-up with 12 GP) weigh the same as an 82-game season in `/numSeasons`.
- L5/L10/L20 span seasons (`.limit(20)` on `wgo_skater_stats` with no season filter, `:299-304`); disclosed in two sentences (matrix help, phone note), but `GP` is the only sample indicator.
- **Verified:** `code`.

### A-09 (P1; new, asked for explicitly): what the date/opponent list (C06, `OpponentGamelog`) shows
- **It shows the player's current team's schedule, not the player's games.** The team is `players.team_id` (`useWigoPlayerDashboard.ts` branding), the source is NHL `club-schedule-season/{abbr}/{seasonId}` through the `/api/cors` proxy (`OpponentGamelog.tsx:81`), filtered client-side to `game.season === seasonId`, `gameType` in {1 preseason, 2 regular, 3 playoffs}, and this team (`:105-111`), deduplicated by game id and sorted by `startTimeUTC`.
- **Window:** `anchor` = first game whose state is FUT, PRE, LIVE or CRIT and whose `gameScheduleState` is not PPD/CNCL; rows = `slice(anchor-5, anchor+5)` = 5 games before, the next game (highlighted with the team primary colour, `aria-current`), 4 after: **10 rows**. Before the first game: 5 rows (anchor 0). After the last game (no upcoming): the **last 6** games, no highlight (`:112-117`).
- **Columns:** Date (`Today`, `Tomorrow`, else `EEE, MMM d`, in the browser time zone, from `startTimeUTC`), Opponent (`vs. ABB` home, `@ ABB` away), Details: final = `W|L score-score` from this team's side plus ` (OT)` or ` (SO)`; live = `Live x-y`; future = local start time (`h:mm a`); `Postponed`, `Cancelled`, `N/A` (final with no score). The tie branch (`T`) cannot occur in the NHL (dead).
- **No player data at all:** no goals, assists, TOI, injury or scratch status. A healthy-scratch or injured player, or a player traded mid-season, shows team games the player did not play: for a traded player the list shows the **new** team's earlier games. The only disclosure is the table's `aria-label` ("player participation is not guaranteed"), invisible to sighted users.
- **Other issues:** `localTimeZone` starts as `"UTC"` and is set in an effect (`:63`, old A-11, still open), so the first paint can say "Tomorrow" for a 7 pm ET game and then flip; the query polls every 300 s forever (`:96`, A-09 old, open); `/api/cors` sets no cache header (`pages/api/cors/index.ts`).
- **Verified:** `code`. **Not verified:** how the list reads for the traded target player (R-7); whether 10 rows fit the planned bio block (the container is fixed 150 px with overflow hidden outside one-page mode, `wigoCharts.module.scss:386-392`; one-page grid sizing needs a live measure, lane D).

### A-10 (P1; continues C-02, C-03, C-04; cross-ref lane C): the radar (C15) is a separate pipeline
- **Source:** RPC `get_skaters_avg_stats(start_date, end_date)` over the table **`skatersGameStats`** joined to `games.date` (DDL), not WGO. Window: `regularSeasonStartDate` to `min(today, regularSeasonEndDate)` of the current season (`hooks/usePercentileRank.ts:40-49`). One unpaged read for the whole league (about 900-1000 skaters), shared per window; staleTime 10 min, `retry: 1`, no refetch on focus (improved since 10-25).
- **Shown:** eight per-game averages ranked as percentiles, labelled GOALS, ASSISTS, PPP, SOG, +/-, PIM, BLK, HITS. Values are never shown (only the 0-100 position); hidden unless all eight are finite.
- **Issues still open:** no minimum-games filter (`numgames` is returned and unused: a 1-GP player with a goal is the 100th percentile of goals per game); forwards and defense pooled; PIM and +/- rank "higher is better" (PIM 100 means most penalised, which is right for a fantasy category and wrong for a quality reading, nowhere stated); the 1000-row PostgREST cap versus the cohort size needs a count (R-6); the desktop title says "Skaters · 2025-26 · 0-100" from `currentSeasonId`, but the cohort comes from `useCurrentSeason()` dates (same source today, two code paths).
- **Verified:** `code`.

### A-11 (P1; continues B-11, B-12, C-04): ratings (C07) and rate percentiles (C19) use different cohorts and hide their inputs
- Ratings: nine numbers (Offense All/Even/PP, Defense All/Even/PK, Overall All/Even/Special) from `nst_percentile_{as,es,pp,pk}_{offense,defense}` for exactly `currentSeasonId` (no fallback), min GP and the 20-peer floor (`WIGO_RATING_MIN_COHORT_PEERS`) applied, regression below 10 GP. `overall.final` is computed (`calculateWigoRatings.ts:290`) and never shown (dead output).
- Rate percentiles: 16 tiles from `nst_percentile_{strength}_offense` with the same min-GP slider, but this panel **can fall back to the previous season** (`fetchWigoPercentiles.ts`, `isPercentileSeasonIncomplete`, signalled by a chip). So the two panels can describe different seasons.
- The slider that changes the ratings lives in the percentile panel. In the planned layout the percentiles sit in the bio group and the ratings under the doughnut/radar, so the control is on the opposite side of the page from half of what it changes; the ratings help text ("Adjust the rate panel's minimum GP") is the only link.
- The tile shows `percentile%`, a meter and an ordinal rank, never the underlying value (for example 0.82 G/60) and never the cohort size ("12th" of how many). Rank uses ties-share-the-best-rank (`calculatePercentiles.ts`).
- Forwards and defense pooled (C-04). Ratings use the same weights for both.
- **Verified:** `code`. Whether the 20-peer floor leaves PP and PK mostly "-" this early in the season needs R-10.

### A-12 (P1; new): what the planned layout would drop or break
Each item says what in the code it hits.
1. **Column width at 1280 x 95%.** Usable width is about 1216 px minus padding; period column about 40-44 px leaves about 32-33 px per metric column. The matrix uses Roboto Condensed at the `--wigo-data-size` token with `padding: 0 3px` (`wigoCharts.module.scss:1649-1660`); at the 11 px floor (pinned by the e2e) a digit is about 5.5 px. Estimates for the longest strings: "20:15" about 25 px fits; "45.2%" about 27 px borderline; **"100.0%"** (S% with one shot, PP TOI%, PTS1%) about 33 px and **"+3585%"** about 32 px do not fit; "-100.0%" in the DIFF row is 7 characters. Dropping the DIFF decimal helps DIFF only; the percent cells in the period rows still need `percent1` to lose its decimal at 100%. These are arithmetic estimates from the CSS tokens, not measurements: lane D must measure.
2. **Duplicate and ambiguous headers once "/60" is dropped.** In one band, "Per 60" would contain G, A, PTS, SOG, ixG, iCF, PPP, PPG, PPA, iHDCF, iSCF, HIT, BLK, PIM, PTS1, and the "Totals" group already contains SOG, PPP, PPG, PPA, HIT, BLK, PIM, ixG, iCF. Accessible names and e2e selectors (`getByRole("button", { name: "Show SOG game log" })`) must stay unique, and `selectedMetric` state (`WigoComparisonMatrix.tsx:62`) is keyed by the full label, so the buttons need "SOG per 60" as their accessible name while showing "SOG".
3. **Group assignment is not defined in the code.** Today the split is a single index (`MATRIX_SPLIT = indexOf("G/60")`, `:28-39`) plus IPP moved across. Three groups need a rule: Totals (GP ... iCF, 17), Per 60 (15 including PTS1/60), On-ice (IPP, oiSH%, OZS%); **PTS1% fits none** (it is a share of points; IPP is individual with an on-ice denominator).
4. **36 metric buttons in 32 px header cells.** Each header is a toggle (`aria-pressed`, `aria-controls="wigo-selected-stat"`) that drives the game log; keyboard targets are far below the 24 px minimum width unless the header text and hit area are decoupled.
5. **Quarter-width Metric Game Log.** `GameLogChart` renders seven period toggles with long labels (`STD: 12:34`, `L20: 0.45 /GP`, `StatsTableRowChart.tsx`), the "Game mean" label and a Recharts axis. At about 290 px (1216 / 4) the seven toggles wrap to three or more rows and take most of the panel height. Measure in lane D.
6. **E2E pins that the layout will break** (`web/e2e/wigo-one-page.spec.ts`): two tables, **9 header cells and 18 rows each**, headers `["Totals","STDL","LY","CAR","3YA","L5","L10","L20","DIFF"]`, `thead th[data-left]`, five help buttons, every `data-coverage` id C01-C19 present, 16 percentile meters, 4 driver articles, 11 px text floor, no clipped cells. The spec and `data-coverage` anchors need rewriting together with the layout, not after.
7. **Components split across two code paths** that the planned grouping must respect: `WigoTrendsSection` renders C14/C15 only with `summaryOnly` and C16-C18 only with `trendsOnly`; `WigoOverviewSection` bundles C02-C11; the matrix and C13 live inside `WigoComparisonMatrix`.
8. **Period order differs between code and the requested layout?** No: `COMPARISON_PERIODS` is already STD, LY, CA, 3YA, L5, L10, L20, matching the request. The `TimeframeComparison` select options, `StatsTable` columns and `StatsTableRowChart` toggles use the same order.
9. **DIFF as the last row** needs per-row semantics preserved: `computeDiffColumn` already yields one DIFF per metric, with GP row undefined; counts divide by the same-column GP (`shouldUseGpForDiff`); a zero baseline or a null gives "-". When the table is transposed, "-" for a missing GP in either compared period applies to all count columns at once.
10. **No-scroll risk from the 10-row schedule list** (A-09) sharing the bio group's height with production, pace and percentiles.

### A-13 (P1; new): the phone path hides explanations and uses different components
- **Ratings without help:** the phone branch of C07 renders `PlayerRatingsDisplay` bare (`WigoDashboardSections.tsx:259-267`); only the desktop branch has the ⓘ that says "with fewer than 20 peers a stat shows '-'". On a phone a "-" rating is unexplained.
- **No metric definitions anywhere on phone**, and the DIFF method note exists only in the desktop matrix help.
- **Percentiles:** a Chart.js horizontal bar chart (`RateStatPercentiles.tsx`, labels like `72% · 12th`) instead of tiles; the status chips are full sentences, not chips.
- **Comparison:** `StatsTable` with an expand "+" per row; one expanded stat at a time; its chart is the same `GameLogChart` but its state key `wigoSelectedStatLog` is shared with the desktop matrix, so a resize that flips paths keeps the cache but not the selection.
- **Overview:** `PerGameStatsTable` renders one ten-row table instead of two halves; `WigoPlayerIdentity` shows the "Height" and "Weight" captions the desktop hides.
- **Verified:** `code`.

### A-14 (P2; continues A-07, A-08, A-09, A-10, B-15, B-18, C-07-C-09): performance items still open or changed
| Old ID | Status | Evidence |
| --- | --- | --- |
| A-07 (default `QueryClient`, no staleTime) | **open** | `pages/_app.tsx:20` `new QueryClient()`; the player-details and aggregate queries set no staleTime (`useWigoPlayerDashboard.ts:158-169`), and the desktop matrix's `wigoSelectedStatLog` query sets none (the phone `StatsTable` sets 60 s), so every metric click and every tab focus refetches on desktop |
| A-08 (writerless `wigo_rates`, duplicate totals read) | **partly fixed** | `wigo_rates` is gone; the aggregate fetch still reads `wgo_skater_stats_totals` (`order season desc limit 1`, `:643-648`) in parallel with `useWigoPlayerTotals`, and the row is discarded unless it is the current season; add `.eq("season")` or drop it |
| A-09 (schedule poll) | **open** | `OpponentGamelog.tsx:96`, 300 s poll with no live game; proxy has no cache header |
| A-10 (team-driver dataset, 60 s staleTime) | **open** | `TeamPerformanceDrivers.tsx:34` staleTime 60 s, 3 sequential steps |
- Repeat reads of the same table per player: `wgo_skater_stats` is read by `useWigoGameLog` (consistency, points, Game Score calendar), by the TOI chart (own key `wigoToiGameLog`, no `games_played = 1` filter), by the Game Score RPC, and by the selected-stat log for WGO metrics: four reads of one season for one player.
- 12 `console.log` calls in the WiGO fetch/rating utilities run on every fetch (`fetchWigoPlayerStats.ts:625` "Workspaceing ..." and others; old A-18, open).

### A-15 (P3, grouped): dead, stubbed or unreachable elements
- `buildPlayerAggregatedStats` takes `ratesData` but the only caller passes `null` (`fetchWigoPlayerStats.ts:691`), so the `metadata.isPerSixty && ratesData` branch (`:272-297`) is dead; `derivePer60` (`:308-346`) only fires for legacy rows because the writer always writes the per-60s alongside the counts.
- `statToGameLogColumnMap` carries seven entries for stats not in `WIGO_STAT_ORDER` (CF%, FF%, SF%, GF%, xGF%, SCF%, HDCF%): unreachable.
- `fetchPercentilePlayerData` (`:971`) and `fetchPlayerGameLogPoints` (`:794`) have no caller.
- `calculatePlayerRatings` computes `overall.final`, never shown (A-11).
- `StatsTable` accepts `visibleColumns` and `tableTitle`; the only caller passes `visibleColumns={undefined}`.
- `CategoryCoverageChart` `showTitle` is never true on this page.
- The schedule's `T` (tie) result is unreachable.
- Search: no empty-result message (the dropdown only renders with at least one result, `NameSearchBar.tsx`), no team or position in options (`:268` shows `fullName` only), `limit(10)` with no `order` (old A-13).
- TOI chart legend says "Avg (min)" while values read mm:ss (`ToiLineChart.tsx`).
- "Position" shows the raw code "L" or "R" (`playerBiography.ts:25`; old A-17).

---

## 2. Render-to-source matrix (desktop and phone)

Conventions. **WT** = `wgo_skater_stats_totals` (one row per player and season, `season` is a text column). **WG** = `wgo_skater_stats` (one row per player and game, `season_id` integer). **Season key** = the page's `currentSeasonId` from `/api/v1/season` unless stated. Missing values: "-" means null/NaN/infinite after `formatWigoStatValue`; zero displays as "0", "0.0", "0.00", "0.0%" or "0:00". Phone differences are in the last column.

| ID | Component (file) | Fields shown | Source (table / view / RPC, columns) | Filter and season key | Missing / null / zero handling and what the user sees | Stub, dead, unreachable | Phone path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | Header bar: `WigoDashboardHeader`, `NameSearchBar` (`WigoDashboardSections.tsx`, `NameSearchBar.tsx`) | WiGO brand and tagline; search box and up to 10 name options; selected-player chip (40 px thumbnail, `ABB · position`, Clear) | `players` (`select *`: `id`, `fullName`, `position`, `team_id`, `image_url`...) | `fullName ILIKE %term%` and `position is null or <> 'G'`, `limit 10`, no order, 300 ms debounce; no season | no match: dropdown simply absent, no message; error: "Failed to load players."; no player: "Search for a player to fill the dashboard"; thumbnail falls back to placeholder on error | goalie filter works; no accent folding, `%`/`_` unescaped; options show name only | same component, stacked in `mobileHeaderRow` |
| C02 | `PlayerHeader` (headshot + team logo) | headshot, team logo, "No Logo" text | `players.image_url`; fallback NHL `api-web.nhle.com/v1/player/{id}/landing` fetched directly from the browser (no proxy); logo `/teamLogos/{ABB}.png` (static) | `players.id = selectedPlayerId` via `.single()` (a bad id waits through default retries) | no `image_url` and the landing call fails or is blocked: placeholder; unknown abbreviation: "No Logo" | image host outside the `next.config.js` `remotePatterns` (`assets.nhle.com`, `nhl.bamcontent.com`, ...) would throw in `next/image` (R-9) | same |
| C03 | `WigoPlayerIdentity` (team, name, `#number · position`, age, height, weight) | team name, first and last name, jersey number, position code (L, R, C, D shown raw), age, height (ft in), weight (lb) | `players` (`team_id`, `sweater_number`, `position`, `birthDate`, `heightInCentimeters`, `weightInKilograms`); team name from static `lib/teamsInfo` by `team_id` | n/a | missing bio fields show "—"; no player: "Select a player"; null `team_id`: empty team line | `formatPosition` accepts LW/RW but the DB stores L/R | adds "Age/Height/Weight" captions |
| C04 | Season production (`PerGameStatsTable`) | Points, Goals, Assists, SOG: season total and "x.xx / GP" | WT: `games_played, goals, assists, points, shots, ...` | `player_id`, `season = String(seasonId)`, `limit 1` via `useWigoPlayerTotals`, staleTime 60 s | no season yet: "Loading season info..." (forever on failure, A-05); no row: "No stats data found for this player."; 0 GP: "Player has 0 games played."; a null count shows "-", a real 0 shows 0 | the heading shows `totals.season` formatted "2025-26" (old A-16 fixed) | same component |
| C05 | Per-game / 84-game pace (`PerGameStatsTable`) | rows GP, G, A, PTS, SOG, S%, PPP, HIT, BLK, PIM; Per/GP (2 dp) and Pace/84 (integer) | WT, same row as C04; S% = 100 x goals / shots computed client-side (the WT `shooting_percentage` column is fetched and converted but unused here) | same | S% needs shots > 0; GP row shows total GP under "Per/GP"; pace "-" for GP and S% | `* 84` hard-coded (`:100`) although `numberOfGames` exists (old A-16) | one 10-row table instead of two five-row halves |
| C06 | Date/opponent list (`OpponentGamelog`) | up to 10 team games: date, `vs.`/`@` opponent, result or start time | NHL `club-schedule-season/{abbr}/{seasonId}` through `/api/cors` (no Supabase) | team = `players.team_id` abbreviation; `game.season === seasonId`; gameType 1, 2, 3; staleTime 60 s, poll 30 s live / 300 s otherwise | see A-09; loading, error ("Failed to load game log."), empty ("No schedule data available...") states | tie result unreachable | same component |
| C07 | Player ratings (`PlayerRatingsDisplay`) | 9 numbers (Offense All, Even, PP; Overall All, Even, Special; Defense All, Even, PK), 0-100 with colour | `nst_percentile_{as,es,pp,pk}_{offense,defense}` (as_* are tables; es/pp/pk are views over `nst_seasonlong_*_rates`), columns from `ratingWeights.ts`; paged 500 | `season = currentSeasonId`; cohort `gp >= minGp` (default 10) or the selected player; a stat needs at least 20 peers; regression below 10 GP at that strength | fewer than 20 peers or no player row: "-"; player in none of the tables: "No rating data available for this player/season."; load/error text | `overall.final` never shown | no ⓘ help on phone (A-13); same numbers |
| C08-C11 | Team drivers (`TeamPerformanceDrivers`): Chance Generation, Chance Suppression, Finishing, Special Teams | per card: value (xGF/GP, xGA/GP, GF/xGF %, "PP x% . PK y%"), status word, nth percentile; footer: "5v5: N of M games to date", "Special teams: ..." | `games` (id, date, homeTeamId, awayTeamId; type 2), `nst_team_5v5` (team_abbreviation, date, gp, xgf, xga, gf), `wgo_team_stats` (team_id, game_id, date, pp_opportunities, power_play_goals_for, times_shorthanded, pp_goals_against) | `seasonId`, regular season only; cutoff = the earlier of the latest dates in the two team sources; 90% coverage rule; league sample of 24 teams per metric | below coverage or sample: four "—" cards and "Incomplete regular-season coverage; ratings unavailable."; error text; idle shows "Select a player" (A-05) | drivers use the player's current team, not the team they played for earlier | same |
| C12 | Comparison matrix (`WigoComparisonMatrix`) | 36 metrics x STD, LY, CA, 3YA, L5, L10, L20 + DIFF, in two 18-metric tables; L/R markers on headers | `wigo_career` (`std_/ly_/ya3_/ca_` columns) and `wigo_recent` (`l5_/l10_/l20_`), one row each by `player_id`; `wgo_skater_stats_totals` only as an STD count fallback (8 counts, same season only) | no season column in either aggregate table (A-07); query key `[.., playerId, seasonId]`, enabled when the season is known | see A-01, A-04; section 3 per metric | `ratesData` branch dead (A-15) | desktop-only (the phone uses `StatsTable`) |
| C13 | Selected-stat game log (`GameLogChart` via the matrix) | game-by-game line of the selected metric; seven period toggles with their value; dashed "Game mean" | per metric, section 3 (WG, `nst_gamelog_as_counts`, `_rates`, `_counts_oi`) | `player_id`, `season_id`/`season = currentSeasonId`, ordered by date; key `[wigoSelectedStatLog, player, season, metric]`, no staleTime | empty: "No game log data available for this season."; null game values are gaps (`connectNulls` draws across them) | `GP` unselectable; initial metric is SOG/60 | `StatsTable` expands one row at a time |
| C14 | Point consistency (`ConsistencyChart`) | doughnut of the share of games with 0, 1, 2, ... points; list with percent and count; "Cardio" line; "N GP" | WG: `game_id, date, points, shots, hits, blocked_shots` via `useWigoGameLog` | `player_id`, `season_id`, `games_played = 1`, deduped by `game_id` (throws on conflicting duplicates) | any game with null or non-integer points: "Consistency unavailable: incomplete game data."; null shots/hits/blocks only drop the Cardio line with a note; no rows: "No game data found..." | Cardio is a list row, not a doughnut segment (by design, tooltip says so) | Trends tab, same component |
| C15 | Category percentiles radar (`CategoryCoverageChart`) | 8-axis radar of percentile ranks (axis labels GOALS, ASSISTS, PPP, SOG, +/-, PIM, BLK, HITS); desktop caption "Skaters . 2025-26 . 0-100" | RPC `get_skaters_avg_stats` over `skatersGameStats` + `games` (A-10) | regular-season date window of the current season; no min GP; `retry: 1` | unavailable if any axis is null; timeout (57014) shows "Category percentile request timed out." with a Retry button; no player/loading texts | `showTitle` unused | non-compact variant with in-canvas labels |
| C16 | Time on ice (`ToiLineChart`) | two views: Total TOI and PP TOI per game with a season-average line, or PP TOI % per game with an average line; mm:ss axis | WG: `toi_per_game`, `pp_toi_per_game`, `pp_toi_pct_per_game` (x100); averages from WT `toi_per_game`, `pp_toi_pct_per_game` (x100) | `player_id`, `season_id`; **no** `games_played = 1` filter; own query key; staleTime 60 s | no rows: "No data" overlay; average line absent when WT is null; Y axis `suggestedMax` 30:00 | legend text "Avg (min)" vs mm:ss | Trends tab |
| C17 | Points per game (`PpgLineChart`) | bar per game, 5- and 10-game rolling means, season average line | WG `points` via `useWigoGameLog` (games_played = 1); season average = WT `points / games_played` | same as C14 | null points leave gaps; rolling means need a full window of consecutive games (`calculateRollingAverage`) | none | Trends tab |
| C18 | Game score (`GameScoreSection`, `GameScoreLineChart`) | bar per game, 5- and 10-game rolling means, "Game Score unavailable for N of M games" note | RPC `get_skater_game_scores_for_season(p_player_id, p_season_id)` (reads WG, `SECURITY DEFINER`, all rows of the season, all-strength on-ice goal term); joined by date to the `useWigoGameLog` calendar | `p_player_id`, `p_season_id = currentSeasonId` | any null input (SQL null propagation) drops that game: shown as a gap and counted in the note; two games on one date are treated as ambiguous gaps | none | Trends tab |
| C19 | Rate stat percentiles (`RateStatPercentiles`) | desktop: 16 tiles (percentile %, meter, ordinal rank); phone: bar chart; AS/ES/PP/PK pills; Min GP slider; "Player GP"; threshold chips | `nst_percentile_{strength}_offense` (offense columns only; defense table read only as a GP fallback); canonical GP from WT | `season = currentSeasonId` with automatic fallback to the previous season when the cohort looks incomplete (chip says so); `gp > 0`; min GP slider; GP above the WGO maximum is nulled (C-05 fix) | a stat with no value shows "-" and "Rank unavailable"; loading/error/no-player texts; chips for GP below the minimum, 0 GP, no GP data | tiles never show the stat value or cohort size (A-11) | bar chart variant |
| P1 | `StatsTable` (phone only) | the same 36 rows, STD..L20, DIFF with colour; a "+" per row opens that stat's game log | same as C12/C13 | same | "Loading stats data..." / error / "no data" row | `visibleColumns` unused | Comparison tab |
| P2 | `TimeframeComparison` (phone, and inside the desktop toolbar) | two selects: left and right period | none (state only) | defaults STD vs CA, reset when the player changes | n/a | none | same |

---

## 3. The 36 metrics, traced one by one

**Writer** = `pages/api/v1/db/calculate-wigo-stats.ts` (cron route, not run here). Seasonal sources: WT, NSI = `nst_seasonal_individual_counts` (strength `all`, `toi` in minutes), NSO = `nst_seasonal_on_ice_counts` (strength `all`). Recent sources: the latest 20 WG rows with `games_played = 1`, any season (`.order date desc, game_id desc .limit(20)`, `:299-304`), joined to `nst_gamelog_as_counts` (NGI) and `nst_gamelog_as_counts_oi` (NGO) on `season:date` (`date_scraped`), `toi` documented in seconds.
Period windows: STD = the season the writer sees as current; LY = last season; **3YA = the three seasons before the current one**; CA = every season but the current; L5/L10/L20 = latest 5/10/20 games (fewer if the player has fewer; the GP row says how many).
**Normalisation in the page** (`statMetadata.ts`): ATOI x60 (minutes to seconds) for all periods; S%, PP%, IPP, oiSH%, OZS%, PTS1% x100; everything else identity. Formats: integer, one decimal (ixG), two decimals (per-60), percent with one decimal, mm:ss.
**Blank rules common to every metric:** a missing aggregate row blanks all periods (A-04). Per-60 recent values are also nulled in the page unless the window's own ATOI/PPTOI and GP are positive (`fetchWigoPlayerStats.ts:386-395`). The column "Always blank?" means structurally; every cell exists in the schema and is written by the writer for all 36 metrics (script check), so **no metric is blank by design**. Blank in practice depends on data and is listed under "Blank when".

| # | Label | What it is (source meaning) | STD, LY (`std_*`/`ly_*`) | 3YA, CA (`ya3_*`/`ca_*`) | L5, L10, L20 (`l5_*`...) | Blank when | Zero shown when | Game-log source (C13) | Label check |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | GP | games played | max(NSI/NSO `gp`, WT `games_played`) (`:461,494`) | sum of the same over seasons / seasons used (per-season mean) | number of games in the window (`numGames`) | no season row | n/a | not selectable | 3YA/CA is a per-season mean (A-08) |
| 2 | ATOI | all-situations ice time per game, mm:ss | NSI `toi` (min) / gp, x60 | NSI `toi` / total gp, x60 | NGI `toi` (s) per game, `/60` then x60; null if any game lacks NST toi | no NSI row gives **0:00**, not "-" (A-01); window with a missing NGI row | A-01 and A-02 | WG `toi_per_game` (s) | OK; unit chain A-03 |
| 3 | Points | points | WT `points` | per-season mean of WT `points` | sum of WG `points` | null if any game's `points` is null (`metricCoverage`) | no WT row but NST rows: 0 | WG `points` | OK |
| 4 | Goals | goals | WT `goals` | per-season mean | sum of WG `goals` | as above | same | WG `goals` | OK |
| 5 | Assists | assists | WT `assists` | per-season mean | sum of WG `assists` | as above | same | WG `assists` | OK |
| 6 | SOG | shots on goal | WT `shots` | per-season mean | sum of WG `shots` | as above | same | WG `shots` | OK |
| 7 | S% | goals / shots | `g / sog`, x100 | pooled `g / sog` over the window | sum goals / sum shots | null if shots = 0 | 0.0% with shots > 0 | WG `shooting_percentage` x100 (not the ratio) | OK |
| 8 | PPP | power-play points | WT `pp_points` | per-season mean | sum of WG `pp_points` | as above | same | WG `pp_points` | OK |
| 9 | PPG | power-play goals | WT `pp_goals` | per-season mean | sum of WG `pp_goals` | as above | same | WG `pp_goals` | OK |
| 10 | PPA | power-play assists | WT `pp_assists` | per-season mean | sum of WG `pp_assists` | as above | same | WG `pp_assists` | OK |
| 11 | PPTOI | PP ice time per game, mm:ss | WT `pp_toi` / gp (seconds, identity) | sum `pp_toi` / total gp | sum WG `pp_toi` / games; null if any game's `pp_toi` is null | no WT row; unit unverified (A-03) | player with no PP time shows 0:00 (correct) | WG `pp_toi_per_game` | OK |
| 12 | PP% | player's share of the team's PP time | WT `pp_toi_pct_per_game` x100 | **unweighted mean of seasonal shares** | mean of the games' `pp_toi_pct_per_game` | no value | 0.0% | WG `pp_toi_pct_per_game` x100 | **Mismatch**: reads as PP conversion (A-06) |
| 13 | HIT | hits | WT `hits` | per-season mean | sum of WG `hits` | as #3 | same | WG `hits` | OK |
| 14 | BLK | blocked shots | WT `blocked_shots` | per-season mean | sum of WG `blocked_shots` | as #3 | same | WG `blocked_shots` | OK |
| 15 | PIM | penalty minutes | WT `penalty_minutes` | per-season mean | sum of WG `penalty_minutes` | as #3 | same | WG `penalty_minutes` | OK (DIFF colour: lower may be "better", see old B-20) |
| 16 | ixG | individual expected goals | NSI `ixg` | per-season mean of NSI `ixg` | sum of NGI `ixg`; null if any game lacks NGI | **0.0 for a season with no NSI row** (A-01) | A-01 | NGI `ixg` by `date_scraped` | OK |
| 17 | iCF | individual Corsi for (shot attempts) | NSI `icf` | per-season mean | sum of NGI `icf` | as #16 | A-01 | NGI `icf` | OK |
| 18 | G/60 | goals per 60 of all-situations ice time | `calculatePer60(wgo_g, toi_all)` | `wgo_g` over seasons / `toi_all` over **NST seasons only** (A-02) | sum goals x3600 / sum NGI `toi` (s) | null if toi_all = 0 or a missing NGI game | 0.00 when goals = 0 | NGI-rates `goals_per_60` | OK |
| 19 | A/60 | assists per 60 | WT assists / toi | same mixing | same | same | same | NGI-rates `total_assists_per_60` | OK |
| 20 | PTS/60 | points per 60 | WT points / toi | same mixing | same | same | same | NGI-rates `total_points_per_60` | OK |
| 21 | SOG/60 | shots per 60 | WT shots / toi | same mixing | same | same | same | NGI-rates `shots_per_60` | OK |
| 22 | ixG/60 | ixG per 60 | NSI ixg / toi | same (both NST, consistent) | NGI ixg / NGI toi | same | same | NGI-rates `ixg_per_60` | OK |
| 23 | iCF/60 | iCF per 60 | NSI icf / toi | same (both NST) | NGI icf / NGI toi | same | same | NGI-rates `icf_per_60` | OK |
| 24 | PPP/60 | PP points per 60 of **PP time** | `pp_points x3600 / wgo_pp_toi` | same (WGO only, consistent) | sum / sum WG `pp_toi` | null if PP time 0 or unreported | 0.00 | WG `pp_points x3600 / pp_toi_per_game` (null when no PP time) | **Denominator differs** from all other /60 (A-06) |
| 25 | PPG/60 | PP goals per 60 of PP time | as #24 with `pp_goals` | as #24 | as #24 | same | same | as #24 | same |
| 26 | PPA/60 | PP assists per 60 of PP time | as #24 with `pp_assists` | as #24 | as #24 | same | same | as #24 | same |
| 27 | iHDCF/60 | individual high-danger chances for per 60 | NSI `ihdcf` / toi | same (both NST) | NGI `hdcf` / NGI toi | as #22 | same | NGI-rates `hdcf_per_60` | OK; only per-60 stat with no count column |
| 28 | iSCF/60 | individual scoring chances for per 60 | NSI `iscfs` / toi | same (both NST) | NGI `iscfs` / NGI toi | as #22 | same | NGI-rates `iscfs_per_60` | OK |
| 29 | HIT/60 | hits per 60 | WT hits / toi | same mixing | same | same | same | NGI-rates `hits_per_60` | OK |
| 30 | BLK/60 | blocks per 60 | WT blocks / toi | same mixing | same | same | same | NGI-rates `shots_blocked_per_60` | OK |
| 31 | PIM/60 | penalty minutes per 60 | WT pim / toi | same mixing | same | same | same | NGI-rates `pim_per_60` | OK |
| 32 | IPP | individual points percentage: points / on-ice goals for | WT `points` / NSO `gf` (all strengths) | `wgo_pts / gf_all` pooled; seasons without NSO add points but no goals-for (A-02) | sum WG points / sum NGO `gf` | null if `gf = 0` ("-") or any game lacks NGO | 0.0% | NGI `ipp` (scale unverified, R-5) | OK |
| 33 | oiSH% | on-ice shooting percentage: on-ice GF / SF | NSO `gf / sf` | pooled | sum NGO `gf` / sum `sf` | null if `sf = 0` | 0.0% | NGO `on_ice_sh_pct` (scale unverified, R-5) | OK |
| 34 | OZS% | offensive-zone start share, all strengths | NSO `off_zone_starts / (off + def)` | pooled | sum NGO zone starts | null if both 0 | 0.0% | NGO `off_zone_start_pct` (scale unverified, R-5) | All-strength definition (A-06) |
| 35 | PTS1% | share of points that are goals or primary assists | `(wgo_g + wgo_a1) / wgo_pts` (WT `total_primary_assists`) | pooled | same from WG; null if any `total_primary_assists` is null | null if points = 0 | 0.0% | WG, 0 for a pointless game, null only for missing data (differs from the aggregate, A-06) | OK |
| 36 | PTS1/60 | goals + primary assists per 60 | WT (g + a1) / toi | same mixing | WG (g + a1) / NGI toi | as #18 | 0.00 | NGI-rates `goals_per_60 + first_assists_per_60` (null if either null) | OK |

DIFF (every period pair): `(left - right) / |right| x 100`; counts compare per game (value / the same period's GP), rates, times and percentages compare directly; null in either, a missing GP for counts, or a zero baseline gives "-" (`tableUtils.ts`, `computeDiffColumn`). GP has no DIFF.

---

## 4. Needs a production read (for lanes B and C)

Each is SELECT-only, aggregate, scoped by season or target player. Lane B owns the target players; ids refer to this report.

| ID | Question | Why (finding) | Suggested shape |
| --- | --- | --- | --- |
| R-1 | Per season, how many rows exist in `nst_seasonal_individual_counts` (strength `all`) versus `wgo_skater_stats_totals`, and what is the earliest NST season? | A-01, A-02: size of the zero-fill and the 3YA/CA mixing | two aggregate counts grouped by season |
| R-2 | For each target player: the `wigo_career` row (`std_/ly_/ca_` atoi, pptoi, gp, g_per_60, ixg) next to `wgo_skater_stats_totals` (`games_played`, `toi_per_game`, `pp_toi`, `pp_toi_per_game`, `pp_toi_pct_per_game`) | A-03: unit of NSI `toi`, WT `pp_toi`; STD ATOI x60 versus `toi_per_game`; is the 0-1 scale of `pp_toi_pct_per_game` right | 4 players, a few columns |
| R-3 | `wigo_recent` L5/L10/L20 for the same players: share of non-null columns; for one player, whether `nst_gamelog_as_counts.date_scraped` equals the WG `date` and `toi` is in seconds (compare to `toi_per_game`) | A-03 and the join key (old B-13): if the dates differ every NST-derived L value is null | one player, 10 games |
| R-4 | `max(last_updated)` of `wigo_career` and `wigo_recent` versus the latest `wgo_skater_stats.date`; current season from `games` (type 2, latest `seasonId` with date <= today) | A-07 freshness; confirm the season | two aggregates |
| R-5 | Value ranges of `nst_gamelog_as_counts.ipp`, `nst_gamelog_as_counts_oi.on_ice_sh_pct`, `off_zone_start_pct` (min, max, avg) for the season | C13 for IPP, oiSH%, OZS%: per-game 0-1 versus 0-100 against the aggregates' x100 | one aggregate each |
| R-6 | `get_skaters_avg_stats` for the season window: row count (wrap in `count(*)`), and whether a target player appears; at most twice | A-10: 1000-row cap, timeouts | count wrap |
| R-7 | For the traded target: `players.team_id` versus the last `wgo_skater_stats.team_abbrev`; WT `games_played` versus the count of `games_played = 1` rows; whether `wgo_skater_stats` contains playoff game ids (`game_id::text like '____03____'`) | A-09, A-14 (consistency GP versus production GP); the writer rejects a player whose last 20 include a non-regular-season game id (`:311-325`) | a few counts |
| R-8 | For the four players: count of `wgo_skater_stats` rows with `games_played = 1` for the season versus WT `games_played` | C14 "N GP" label versus C04 | counts |
| R-9 | Distinct host of `players.image_url` for the target players | C02: `next/image` remote hosts | 4 rows |
| R-10 | Cohort size per strength in `nst_percentile_*` for the season (rows with `gp >= 10`) | A-11: how often the 20-peer floor blanks PP/PK ratings this early | 6 counts |

Lane D (live page): column widths and heights for A-12 items 1, 4, 5 and 10 (10-row schedule inside the bio group at 1280 x 800).

---

## 5. Re-verified old items (A-series, plus the older ones this lane touched)

State is as of the code read on 2026-11-01 (HEAD `0a7fb6842`, working tree changes in other lanes not touched).

| Old ID | Subject | State | Evidence |
| --- | --- | --- | --- |
| A-01 | STD totals fallback with no season filter | **fixed** | `fetchWigoPlayerStats.ts:244-246` keeps the row only when `season === stdSeasonId`; the query waits for the season (`useWigoPlayerDashboard.ts:168`). Residual: the read is still season-less (`:643-648`) and duplicates `useWigoPlayerTotals` |
| A-02 | Aggregates not tied to the dashboard season | **partly fixed, still open (A-07)** | key and fetch carry the season; `wigo_career` still has no season or as-of; matrix shows none |
| A-03 | Missing game blanks a team's drivers | **fixed** | cutoff is the earlier of two source dates (`fetchTeamDriverSnapshots.ts`), 90% rule with N-of-M label (`teamPerformanceDriverModel.ts`, `TEAM_DRIVER_MIN_COVERAGE`) |
| A-04 | Valid PP/PK game invalidates the season | **fixed** | per-game `<=` check dropped; integer and non-negative checks remain (`teamPerformanceDriverModel.ts`) |
| A-05 | Goalies in search | **fixed** | `.or("position.is.null,position.neq.G")` (`NameSearchBar.tsx:72`) |
| A-06 | Failed season lookup shows the wrong status | **still open, wider (A-05)** | `useCurrentSeason.ts:36`; `TeamPerformanceDrivers.tsx:29,39,50`; plus null-team players and the silent matrix (A-04) |
| A-07 | Default QueryClient refetches on focus | **still open (A-14)** | `_app.tsx:20`; no staleTime on player/aggregate/selected-stat queries |
| A-08 | `wigo_rates` read, duplicate totals read | **partly fixed** | `wigo_rates` gone; totals duplicate remains |
| A-09 | Schedule poll hits an uncached function | **still open** | `OpponentGamelog.tsx:96`; `pages/api/cors/index.ts` sets no cache header |
| A-10 | Team-driver dataset refetched every 60 s | **still open** | `TeamPerformanceDrivers.tsx:34` |
| A-11 | First render uses UTC | **still open** | `OpponentGamelog.tsx:63`; the component is client-only (the page renders nothing before the viewport is measured), so `useState(getLocalTimeZone)` is safe |
| A-12 | Preseason shows the previous season | **still open, dormant in November** | `lib/NHL/server/index.ts` `.lte("startDate", now)`; the schedule includes gameType 1 but the season id is the old one until the season row's start date |
| A-13 | Search quality | **partly fixed** | goalie filter added; still no order (`NameSearchBar.tsx:70-73` (`.ilike` :70, `.or` :72, `.limit` :73)), no accent folding, `%`/`_` unescaped, options show name only (`:268`), no "no results" line |
| A-14 | Headshot fallback fetches NHL directly | **still open** | `useWigoPlayerDashboard.ts:108-110` (direct `fetch`, whether `api-web` sends CORS headers not verified) |
| A-15 | Bad URL id waits through retries | **still open** | `.single()` (`:94`) with the default 3 retries; no `retry` option on the query (`:158-162`) |
| A-16 | Per-game table details | **partly fixed** | season shown as "2025-26" (fixed); GP row still shows total GP under "Per/GP" (`PerGameStatsTable.tsx:111`); `* 84` still hard-coded (`:100`) |
| A-17 | Raw L/R position codes | **still open** | `playerBiography.ts:25-26` shows the stored code |
| A-18 | Console log noise | **still open** | `fetchWigoPlayerStats.ts:625` and 11 other `console.log` calls in the WiGO fetch and ratings utilities |
| A-L02 | Next game clipped in the 150 px schedule box | **unknown for one-page mode** | the container is still `height: 150px` (`wigoCharts.module.scss:386-392`) outside the grid; the one-page layout sizes it by grid area, needs a live measure |
| B-05, B-06, B-07 | 3YA/CA mixing, unweighted PP%, per-season means | **still open (A-02, A-08)** | writer `:697-981` unchanged |
| B-10 | Writer unit fixes versus production values | **cannot confirm without a read** (A-03) | code chain only |
| C-02 | Radar cohort unpaged | **still open, partly mitigated** | one unpaged RPC; now has `retry: 1`, 10-min staleTime, no focus refetch, a timeout message and a Retry button (`usePercentileRank.ts`, `CategoryCoverageChart.tsx`) |
| C-03, C-04 | No min GP on the radar; F and D pooled | **still open** | RPC returns `numgames`, unused |
