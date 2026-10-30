# WiGO audit — Group C (trends and percentiles)

Snapshot: `/private/tmp/fhfh-wigo-redesign/web` (all paths below are relative to that directory unless absolute). This was a read-only review. SQL comes from `/Users/tim/Code/fhfhockey.com/supabase/migrations/20260716112908_production_schema_baseline.sql` ("baseline.sql"). No network, database, git or server use.

Checks run: `npx vitest run components/WiGO/ConsistencyChart.test.tsx components/WiGO/GameScoreLineChart/index.test.tsx components/WiGO/RateStatPercentiles.test.tsx utils/fetchWigoPercentiles.test.ts hooks/usePercentileRank.test.tsx` passed: 5 files, 34 tests. Nothing in a browser was run or observed.

Mount map (`pages/wigoCharts.tsx:156-192`). At ≥1600px, `WigoTrendsSection summaryOnly` (Consistency and a compact radar) goes in the summary band. `trendsOnly` (TOI, PPG and Game Score) goes in the trends column. RateStat goes in its own `percentilesBand` (`desktop` tiles). At 769–1599px, one `WigoTrendsSection` holds all five charts, with RateStat underneath in bar-chart mode. At ≤768px, mobile tabs mount only the active section. Only one tree is mounted at a time, so the prior "both trees mounted" concern from 00-shared is fixed for this group.

## 1. Query inventory

| Component | Table / view / RPC | Columns | Filters | Expected rows | Paging / limit | Dedupe / cache |
|---|---|---|---|---|---|---|
| ConsistencyChart, PpgLineChart, GameScoreLineChart (shared) | `wgo_skater_stats` (regular season only; playoffs live in `wgo_skater_stats_playoffs`, per `pages/api/v1/db/update-wgo-skaters.ts:1679-1682`) | game_id, date, points, shots, hits, blocked_shots | player_id, season_id, `games_played=1`, order date asc (`utils/fetchWigoPlayerStats.ts:883-898`) | ≤82 | none needed (<1000) | RQ `["wigoGameLog",p,s]`, staleTime 60s (`hooks/useWigoGameLog.ts:7-10`); fetched once for all 3 consumers; collapses identical duplicates and throws on conflicts (`fetchWigoPlayerStats.ts:906-917`) |
| ToiLineChart | `wgo_skater_stats` | date, toi_per_game, pp_toi_per_game, pp_toi_pct_per_game (×100 client-side) | player_id, season_id, order date. **No `games_played=1`, no dedupe** (`fetchWigoPlayerStats.ts:821-833`) | ≤82 | none | **Separate** RQ key `["wigoToiGameLog",p,s]` (`ToiLineChart.tsx:66-71`), so a second request hits the same rows |
| ToiLineChart, PpgLineChart (shared with snapshot/pace panels) | `wgo_skater_stats_totals` | player_id, games_played, goals…points_per_game, toi_per_game, pp_toi_pct_per_game (×100) | player_id, season = String(seasonId), order season desc, limit 1, maybeSingle (`fetchWigoPlayerStats.ts:700-731`) | 1 (PK player_id+season) | limit 1 | RQ `["wigoPerGameTotals",p,s]` 60s (`hooks/useWigoPlayerTotals.ts:9-14`) |
| GameScoreLineChart | RPC `get_skater_game_scores_for_season(p_player_id,p_season_id)` → (game_date, game_score) on `wgo_skater_stats` (baseline.sql:1342-1379) | computed | player_id, season_id; `WHERE game_score IS NOT NULL`; **no games_played filter** | ≤82 (live: 74 vs 76 canonical, per LIVE-EVIDENCE) | none | RQ `["skaterGameScoresForSeason",p,s]` 60s (`GameScoreLineChart/index.tsx:36-81`); joined client-side **by date** to wigoGameLog (`:86-102`) |
| CategoryCoverageChart (radar) | RPC `get_skaters_avg_stats(start_date,end_date)`: `skatersGameStats` ⋈ `games` by date, GROUP BY playerId (baseline.sql:1386-1407) | id, avg{goals,assists,plusminus,pim,hits,blockedshots,powerplaypoints,shots}, numgames | Date window = regular-season start through min(today, regular-season end) (`hooks/usePercentileRank.ts:69-78`); **no min-GP, no position** | one per skater who played (~925–1000) | **None.** No ORDER BY and no `.range()`; PostgREST `max_rows = 1000` (`/Users/tim/Code/fhfhockey.com/supabase/config.toml:18`) | RQ `["skaterPercentileCohort",start,end]`, staleTime 10 min, retry 1 (`usePercentileRank.ts:83-101`); shared across players |
| RateStatPercentiles | `nst_percentile_{as,es,pp,pk}_offense` (as = table; es/pp/pk = views) | player_id, season, gp, toi_seconds + 18 rate/pct columns (`utils/fetchWigoPercentiles.ts:13-19`) | season, `gp>0`, order player_id (`:65-84`) | ~630–940 per strength (LIVE-EVIDENCE) | paged, 500/page, about 2 pages | inner `fetchQuery(["wigoPercentileCohort",strength,season])` 60s (`:219-226`) |
| RateStatPercentiles | `nst_percentile_{s}_defense` | player_id, season, gp, toi_seconds only (`:21-23`) | season, order player_id | ~800–940 | paged 500, about 2 pages | same fetchQuery as above |
| RateStatPercentiles | `wgo_skater_stats_totals` | games_played | player_id + season, maybeSingle (`:86-103`) | 1 | — | `["wigoPercentilePlayerGp",season,player]` 60s |
| RateStatPercentiles | `wgo_skater_stats_totals` | games_played | season, order games_played desc, limit 1 (`:105-119`) | 1 | limit 1 | `["wigoPercentileSeasonMaxGp",season]` 60s |
| RateStatPercentiles (fallback only) | previous season's offense and defense tables | same | previousSeasonId (`:270-271`) | ~900 ×2 | paged | same cohort key |

Outer RateStat key: `["wigoPercentileStats",strength,season,player]` 60s (`RateStatPercentiles.tsx:244-255`).

On a cold player select at ≥1600px, Group C sends 6 requests for the trends charts: wigoGameLog 1, TOI log 1, GS RPC 1, totals 1 (shared), radar RPC 1 (cached for 10 min across players). RateStat adds about 6 (4 cohort pages + 2 totals), or about 10 when it falls back to the previous season. The radar RPC and the cohort pages are the heavy ones.

`statMetadata.ts` is **not imported** by any Group C component (`rg` consumers: StatsTable, StatsTableRowChart, tableUtils, PerGameStatsTable, WigoComparisonMatrix, fetchWigoPlayerStats). It has no effect on these charts.

## 2. Findings

### Status of the prior audit (`tasks/TASKS/wigo-charts-audit/14–19`)

| Prior item | Status | Current evidence |
|---|---|---|
| 14: null points become zero | FIXED | `ConsistencyChart.tsx:39-41,48`: any non-integer or null points blanks the chart with "incomplete game data" |
| 14: Cardio overlap / double count | FIXED | `:89-94` supplementary row; `:222` title explains the overlap; Cardio is hidden when shots/hits/blocks are incomplete (`:42-46,219`) |
| 14: one completed game per row, dedupe | FIXED | `fetchWigoPlayerStats.ts:897,906-917` |
| 14: reuse canonical logs with PPG, memoize | FIXED | shared `useWigoGameLog`; `useMemo` `:47-111` |
| 15: missing target drawn as zeros | FIXED | `usePercentileRank.ts:106-107,123-125`; `CategoryCoverageChart.tsx:72,179` |
| 15: first-tie rank instead of midrank | FIXED | `calculateRankingResult` midrank `utils/calculatePercentiles.ts:50-51` |
| 15: no error state | FIXED | `CategoryCoverageChart.tsx:175-178` (timeout-specific message plus Retry) |
| 15: inverted preseason window | FIXED | `usePercentileRank.ts:81` `StartTime <= EndTime` |
| 15: `count` vs `numgames` type | FIXED | `usePercentileRank.ts:22` |
| 15: zero labels hidden by truthiness | **STILL OPEN** (non-compact path only) | `CategoryCoverageChart.tsx:124` `dataset[i] && chart.ctx.fillText(...)` |
| 15: reliance on private Chart.js internals | **STILL OPEN** | `:81` `chart.scales.r._pointLabelItems` |
| 15: explicit cohort / min games / position policy | **STILL OPEN** | see C-03 |
| 15: duplicate legacy RPC effects | FIXED | shared RQ key `usePercentileRank.ts:85` |
| 15: live RPC timeout 57014 | **STILL OPEN** (LIVE-EVIDENCE / single-viewport report) | not code-fixable here |
| 16: share logs with other panels | **STILL OPEN** | C-07 |
| 16: reset zoom on player/season/toggle change | **STILL OPEN** (UNVERIFIED runtime) | `<Line>` is not keyed (`ToiLineChart.tsx:348`); see C-11 |
| 16: PPTOI% denominator, ratio-of-sums season line | **STILL OPEN** / UNVERIFIED | season line is NHL totals `pp_toi_pct_per_game` (`ToiLineChart.tsx:76`); its aggregation is not documented in code |
| 17: rolling mean averages "available" values | FIXED | `utils/formattingUtils.ts:156-168` returns null unless the full window is finite |
| 17: bars convert null to 0 | FIXED | `PpgLineChart.tsx:87` `log.points ?? null` |
| 17: season PPG reconciled with logs | **STILL OPEN** (partial) | `PpgLineChart.tsx:60-62` totals points/GP, not the plotted logs (C-10) |
| 18: zoom plugin not registered in wrapper | FIXED | `GameScoreLineChart/RollingAverageChart.tsx:4,25` |
| 18: RPC drops games with null inputs | MITIGATED (source still drops) | client re-aligns to the canonical calendar and discloses "unavailable for N of M" (`index.tsx:97-103,274-278`); the SQL still has `WHERE sub.game_score IS NOT NULL` (baseline.sql:~1376) |
| 18: documented model / strengths | **PARTIAL** | formula in help text `GameScoreSection.tsx:18`; strengths undisclosed and different from the published model (C-01) |
| 19: lower-level errors become empty arrays | FIXED | `fetchWigoPercentiles.ts:203-208` rethrows; test "propagates source failures" passes |
| 19: fallback swaps target + cohort with a GP mismatch | FIXED in messaging | `:287-292` fallbackReason; `RateStatPercentiles.tsx:467` shows Requested/Applied; Player GP now from the applied cohort (`:286-296`) |
| 19: completeness heuristic uses GP only | **STILL OPEN** | `fetchWigoPercentiles.ts:128-154` (C-05) |
| 19: defense-only players not added | STILL OPEN, impact nil | `:186` maps offense rows only; all 16 metrics come from offense columns, so defense-only rows could not be ranked anyway |

### New / refined findings

**C-01 — P1 — Game Score goal-differential term uses all-strength on-ice GF/GA (including PP and SH), which departs from the published Luszczyszyn model, and the help text does not disclose it.**
- File: baseline.sql:1364-1365 (`get_skater_game_scores_for_season`).
- Evidence: `0.15 * (wgs.es_goals_for + wgs.pp_goals_for + wgs.sh_goals_for) - 0.15 * (wgs.es_goals_against + wgs.pp_goals_against + wgs.sh_goals_against)`.
- The coefficients all match Dom Luszczyszyn's Game Score: .75 G, .7 A1, .55 A2, .075 SOG, .05 BLK, ±.15 PD/PT, ±.01 FOW/FOL, ±.05 CF/CA, ±.15 GF/GA. The published version uses 5v5 Corsi and 5v5 goal differential. That is from my reference knowledge; I could not check the article offline, so the source claim is UNVERIFIED.
- Failure: a PP1 forward gets +0.15 for every PP goal while on ice, on top of the points already credited. A PK specialist loses 0.15 for every PP goal against. Empty-net goals are included too. The scores are systematically inflated or deflated by role.
- Related, UNVERIFIED: whether `sat_for`/`sat_against` (NHL `summaryshooting` satFor/satAgainst, `update-wgo-skaters.ts:564,568`) are 5v5 by NHL definition.
- Fix: use 5v5 GF/GA if the source has them. Otherwise rename the help text to "all-situation on-ice GF−GA (differs from the published model)" at `GameScoreSection.tsx:18`.

**C-02 — P1 — Radar cohort read is unpaged, has no ORDER BY, and sits right under the 1000-row PostgREST cap.**
- Files: `hooks/usePercentileRank.ts:88-93`; baseline.sql:1386-1407; `/Users/tim/Code/fhfhockey.com/supabase/config.toml:18` `max_rows = 1000`.
- Evidence: `.rpc("get_skaters_avg_stats", {...}).returns<PlayerAvgStats[]>()` returns one row per skater with ≥1 game. A full season is ~925–1000 skaters (NST cohorts in LIVE-EVIDENCE: 925–941).
- Failure: if a season passes 1000 skaters, the response is cut silently at an arbitrary point because nothing orders it. Some players drop out of the cohort, which skews the percentiles. If the selected player is dropped, the radar shows "unavailable". The production max_rows and actual row count are UNVERIFIED.
- Fix: order by id and page with `.range()` via `fetchAllSupabasePages`, or move ranking into SQL.

**C-03 — P1 — Radar percentiles have no min-GP filter, ignore the page min-GP control, and pool F with D.**
- Files: `usePercentileRank.ts:52-55` (every finite row is ranked; `numgames` is never used); `components/WiGO/WigoDashboardSections.tsx:310` header text "Skaters · season · 0–100".
- Failure: one-game call-ups with outlier per-game averages sit at both tails of every axis. A defenseman's Goals/Assists/PPP are ranked against forwards, and a forward's BLK/HITS against defensemen. The radar shape then reflects position more than performance.
- Fix: filter on `numgames >= minGp` (or a fixed floor) and add a position split (the RPC would need to join players).

**C-04 — P1 — RateStat percentiles pool forwards and defensemen.**
- Files: `fetchWigoPercentiles.ts:13-19` (no position column is selected; the views have none, `lib/supabase/database-generated.types.ts:42331-42449`); `RateStatPercentiles.tsx:306-310` filters only on GP.
- Failure: a top-pairing offensive D-man shows roughly middling G/60, Pts/60, iSCF/60 and ixG/60, because he is ranked against every forward. Users have no way to tell.
- Fix: join position (players or wgo totals position_code) and add an F/D/All toggle, or at least label it "vs all skaters".

**C-05 — P1 — Min-GP filter, "Player GP" and the staleness heuristic all use NST `gp`, which is contaminated in production.**
- Files: `RateStatPercentiles.tsx:291-293,306-310,467`; `fetchWigoPercentiles.ts:246-251,148-151`.
- Evidence (LIVE-EVIDENCE §Percentile cohorts): 2025-26 ES max GP is 102, and player 8477964 aggregates to GP 102.
- Failure: users see "Player GP: 102". The slider max (`:381`) goes past 82. Contaminated GP also inflates `percentileSeasonMaxGp`, so `cohortLooksStale` never fires, and a bad cohort gets labeled as complete. The code faithfully displays a bad source; the GP values themselves were verified live in the prior evidence, not by me.
- Fix: show and filter on canonical WGO GP (`canonicalPlayerGp` is already fetched but no longer used in the UI). Treat an NST gp above the canonical GP as invalid.

**C-06 — P1 — TOI chart y-axis is hard-capped at 30:00, so 30+ minute games are clipped.**
- File: `ToiLineChart.tsx:222-224` `min: 0, max: 60 * 30`.
- Failure: heavy-minute defensemen sometimes pass 30:00 in OT games. Those points get clipped at the top edge, and the tooltip still shows the real value, so the plot and the hover disagree.
- Fix: replace `max` with `suggestedMax: 1800`.

**C-07 — P2 — TOI fetches its own game log instead of sharing the canonical one, and uses looser filters.**
- Files: `ToiLineChart.tsx:66-71`; `fetchWigoPlayerStats.ts:821-833`.
- Evidence: key `["wigoToiGameLog",…]`; the query has no `.eq("games_played", 1)` and no duplicate collapse, while the canonical reader has both (`:897,906-917`).
- Failure: one extra request per player select. If a duplicate or `games_played=0` row exists, the TOI x-axis would have more games than the PPG and Game Score axes. Live data currently has none (LIVE-EVIDENCE).
- Fix: add the TOI columns to `fetchPlayerGameLogConsistencyData` and use `useWigoGameLog`.

**C-08 — P2 — Game Score needs two reads over the same rows, plus a fragile date join.**
- File: `GameScoreLineChart/index.tsx:60-65,85-102`.
- The RPC returns `game_date` only, not game_id, so the client joins by date. Any same-date ambiguity turns into a gap (`:100`).
- The score is a linear function of `wgo_skater_stats` columns. It could be computed from the shared log (one request), or the RPC could return game_id.
- `.order("game_date")` on the RPC duplicates the RPC's own ORDER BY.

**C-09 — P2 — RateStat refetches about 4 cohort pages per strength after 60 s, and the defense read is close to useless.**
- Files: `fetchWigoPercentiles.ts:224,233,240` (staleTime 60_000 against a daily cron refresh); `:176-199`.
- Defense rows are fetched (about 2 pages) only to backfill `gp`/`toi`. Offense rows are already filtered `gp>0`, so the `gp` backfill is never used, and the `toi` backfill applies only when the offense `toi_seconds` is null.
- Fix: raise staleTime to ≥10 min and drop the defense read (or select it only where toi is null).

**C-10 — P2/P3 — PPG "Season Avg" comes from the totals table, but the bars come from the game log.**
- File: `PpgLineChart.tsx:60-62`.
- Failure: when totals and logs refresh at different times (crons at 07:30 and 07:40), the dashed average can disagree with the plotted bars.
- Fix: compute it as Σpoints / logs.length from the plotted data.

**C-11 — P2 (runtime behavior UNVERIFIED) — Any page re-render rebuilds all three trend charts and probably resets zoom.**
- Files: `PpgLineChart.tsx:269-270`, `ToiLineChart.tsx:320-321` and `GameScoreLineChart/index.tsx:254-255` rebuild data and options on every render with no memoization.
- react-chartjs-2 5.3.1 `setOptions` does `Object.assign(chart.options, nextOptions)` (`node_modules/react-chartjs-2/dist/index.js:13-17`). That swaps `scales` for a fresh object without the zoom plugin's min/max.
- The page re-renders on every window `resize` (`pages/wigoCharts.tsx:33-38`) and on every min-GP slider move (`setMinGp`, page state, `:32`).
- Failure: dragging the RateStat slider or resizing the window wipes the user's zoom on TOI/PPG/Game Score. Each re-render also re-runs a 400 ms animation and the rolling averages.
- Fix: `useMemo` the data and options, and `React.memo` the trend section.

**C-12 — P3 — The non-compact radar hides valid 0.0 labels, and the header implies season context it does not own.**
- File: `CategoryCoverageChart.tsx:124` (prior item, still open).
- The radar's window comes from `useCurrentSeason`, not the page's `currentSeasonId` (`usePercentileRank.ts:67`). Both come from `useCurrentSeason` today (`hooks/useWigoPlayerDashboard.ts:148-149`), so they agree for now, but the radar would not follow a future season picker.

**C-13 — P3 — Game Score and PPG rolling-line fills.**
- Files: `GameScoreLineChart/index.tsx:150-151` (both 5- and 10-game lines `fill: true` with LINE_PRIMARY at 0.2 alpha); `PpgLineChart.tsx:117-118` (5-game line `fill: true`).
- The fills shade the area under the bars, and in Game Score the 10-game fill uses the 5-game color.

**C-14 — P3 — Tooltip and tick formatting.**
- PPG bar tooltips print integer points as "2.00" (`PpgLineChart.tsx:228-237`, both branches use `toFixed(2)`).
- TOI y-ticks are auto-stepped in seconds (no `stepSize`), so labels land on non-minute values like 3:20 or 6:40 (`ToiLineChart.tsx:231-236`). Fix: `stepSize: 300`.
- RateStat shows percentiles with a "%" suffix (`RateStatPercentiles.tsx:157,199,508`), which reads like a share.

**C-15 — P3 — Consistency colors and the loading GP badge.**
- Buckets past the palette and the Cardio row both fall back to `WIGO_COLORS.GREY_MEDIUM` (`ConsistencyChart.tsx:81,93`), so high-point buckets look the same as Cardio.
- The toolbar shows "0 GP" while loading (`:158`).

**C-16 — P3 — Switching strength in RateStat unmounts the controls during the fetch.**
- File: `RateStatPercentiles.tsx:395,410`.
- `isLoading` (a new key with no `placeholderData`) replaces the whole panel, including the AS/ES/PP/PK buttons and the slider, with "Loading Player Data…". The layout jumps.
- Fix: `placeholderData: keepPreviousData`.

Verified OK (no finding):
- Game Score coefficients (except the C-01 strength issue).
- 5- and 10-game windows: the first N−1 games are null, and any missing game in a window nulls that point (`formattingUtils.ts:156-168`, matching the help text).
- Consistency buckets: mutually exclusive, 0…max, denominator = deduped GP.
- TOI units: seconds end-to-end, formatted mm:ss (`formattingUtils.ts:52-66`).
- PP TOI % stored as a fraction and ×100 once, for both logs and totals.
- X-axes: category scale with server `order(date asc)`. `formatDateToMMDD` is timezone-safe (`T00:00:00` local).
- Regular season only: the `wgo_skater_stats` table contains only regular season, and the radar window stops at the regular-season end.
- Season id for NST is the int `season`; for totals it is `String(seasonId)`, which matches the column type.
- RateStat percentile uses midrank (worse + 0.5·equal)/N and rank = better+1. The selected player is kept below min GP, with a message. Every metric is higher-is-better, correctly, since there are no "against" metrics.
- No stale-player races: every query is keyed by player and season, and Game Score remounts via `key={playerId:seasonId}`.

## 3. Layout facts

All charts use **Chart.js 4.5.1 via react-chartjs-2 5.3.1**. Zoom is chartjs-plugin-zoom 2.2.0 (TOI, PPG, Game Score). Datalabels is chartjs-plugin-datalabels (RateStat bars). recharts and d3 are not used by Group C.

| Component | Chart type | Responsive / aspect | Height source | Controls / legend inside |
|---|---|---|---|---|
| ConsistencyChart | Doughnut, cutout 60% (`:114-117`) | `responsive`, `maintainAspectRatio:false` | `.consistencyAndCategoryWrapper` 185px fixed (`wigoCharts.module.scss:485-497`); mobile auto, min 220px (`:126-135`); ≥1600 the chart area is `flex 0 0 38%`, min-width 72px (`:1938-1942`) | Chart.js legend off. HTML list on the right: one row per bucket 0…max plus Cardio (`:218-238`). "N GP" badge in the toolbar |
| CategoryCoverageChart | Radar, 8 axes, r 0–100 | non-compact: `maintainAspectRatio:true` (square, height-constrained by its container); compact: `false` and fills `.compactRadar {flex:1; min-height:0}` (`CategoryCoverageChart.module.scss:33`) | `.percentileChartContainer` flex 3 next to Consistency (`:629-657`); ≥1600 sits in the summary grid (`:1599-1606`) | Non-compact: custom canvas labels via private API, font changes at BreakPoint.l. Compact: native pointLabels 12px and ticks at 0/50/100. No legend or controls besides Retry |
| ToiLineChart | Line, two y-axes (only one shown) | `maintainAspectRatio:false` | `.toiChartContainer` 180px (`:659-666`); mobile min 180px; ≥1600 is ⅓ of the 376px trends row (`:1664-1670`, grid row `:1564`) | Toolbar: text legend, Reset, TOI / PP TOI % toggle. Chart legend off |
| PpgLineChart | Bar + 3 lines | `maintainAspectRatio:false` | `.ppgChartContainer` 155px (`:668-675`); ≥1600 ⅓ of 376px | Toolbar: text legend (Pts / 5-GM / 10-GM / Avg) and Reset |
| GameScoreSection / LineChart | Bar + 2 lines (`RollingAverageChart` `<Chart type="bar">`) | `maintainAspectRatio:false`; inner flex wrapper `height:100%` (`index.tsx:259-263`) | `.gameScoreContainer` 155px (`:677-684`); ≥1600 ⅓ of 376px | Toolbar: legend, Reset, ⓘ `<details>` help popover (abs-positioned 260px, `:2047-2060`). A "Game Score unavailable for N of M games" status line takes 16px below the canvas |
| RateStatPercentiles | non-desktop: one vertical Bar, 16 bars, y 0–100, with three datalabels per bar (rotated category, value %, ordinal rank) (`:117-224`). desktop (≥1600): 4×4 tile grid of `<meter>`s, no canvas (`:501-512`, `scss:1893-1925`) | `maintainAspectRatio:false`; canvas forced to 100%×100% (`scss:1523-1540`) | `.rateStatBarPercentilesContainer` 205px (`:686-693`; `.rateStatPercentilesComponent` 100%); ≥1600 height 100% of the percentiles band (`:1831-1834`) | Its own controls: AS/ES/PP/PK buttons, a Min GP range slider (0…max NST GP; page default 10, shared with Ratings via page state), a context line (Player GP · Requested · Applied), and up to 4 threshold/fallback messages that eat vertical space at 205px |

Status overlays on TOI, PPG and Game Score are `position:absolute` over `.chartCanvasContainer {position:relative; flex-grow:1; overflow:hidden}` (`scss:1288-1295`). The Chart.js canvas is a direct child of that container for TOI and PPG, and Game Score sits inside an extra flex wrapper.
