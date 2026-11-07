# WiGO audit — Group B (timeframe comparison + ratings)

Snapshot: `/private/tmp/fhfh-wigo-redesign/web` (paths below are relative to it). This was a read-only review. I made no DB or network requests, ran no git commands and started no servers. The snapshot's audited files are byte-identical to `/Users/tim/Code/fhfhockey.com/web` (checked with `diff -q`). Live-data claims come from the prior audit's `LIVE-EVIDENCE.md` (read-only SQL, 2026-09-19). I did not re-check them.

Checks run: `npx vitest run` on tableUtils, fetchWigoPlayerStats, calculateWigoRatings, StatsTable, StatsTableRowChart and PlayerRatingsDisplay tests. Result: **6 files, 46 tests passed**. None of them covers the defects marked NEW below.

Timeframe semantics: the writer is `pages/api/v1/db/calculate-wigo-stats.ts`, and the client is `utils/fetchWigoPlayerStats.ts` with `components/WiGO/statMetadata.ts`.

| Key | Meaning in code |
| --- | --- |
| STD | Current-season totals for counts, per-game averages for ATOI/PPTOI, and ratio-of-sums for per-60 rates and percentages. Counts come from `wgo_skater_stats_totals`. TOI, ixG, iCF and on-ice data come from NST seasonal `strength='all'`. |
| LY | Same as STD, for `lastSeasonId`. |
| 3YA | The previous 3 seasons (the current season is excluded). Counts and GP are **per-season averages** (sum ÷ seasons present, partial seasons included). Rates and percentages are ratio-of-sums. PP% is an **unweighted mean of seasonal PP%**. |
| CA | Every stored season **except the current one**. Same averaging rules as 3YA. It is not a career total. |
| L5/L10/L20 | The latest N `wgo_skater_stats` rows with `games_played=1`, **across seasons**. NST rows are matched on `season:date`. Counts are window totals. Per-60 = count×3600/TOI-seconds. PP% is the mean of per-game PP%. Coverage is nulled per metric when any game lacks an input. |
| DIFF | `(L−R)/|R|×100`. Count rows are first divided by the GP row of the same period (`tableUtils.ts:41-76`). Rates, times and percentages are compared directly. A zero right-hand value gives no result. |

## 1. Query inventory

| Component | Table/view/RPC | Columns | Filters | Expected rows | Paging/limit | Dedupe/cache |
| --- | --- | --- | --- | --- | --- | --- |
| useWigoPlayerDashboard (player) | `players` (+ `api-web.nhle.com/v1/player/{id}/landing` when `image_url` is null) | `*` | `id=eq` | 1 | `.single()` | key `[wigoPlayerDetails,id]`. staleTime 0 (the QueryClient defaults, `_app.tsx:20`). Seeded by `setQueryData` on search select. |
| fetchPlayerAggregatedStats → rawCombinedData (StatsTable, matrix) | `wigo_career` | `*` | `player_id` | 1 | maybeSingle | key `[wigoPlayerAggregatedStats, playerId]`. **No season in the key**, staleTime 0, refetches on window focus. |
| 〃 | `wigo_recent` | `*` | `player_id` | 1 | maybeSingle | same query |
| 〃 | `wigo_rates` | `*` | `player_id` | **0 rows live**; no writer in the repo | maybeSingle | same query; overrides career per-60 when a key is present |
| 〃 | `wgo_skater_stats_totals` | goals, assists, points, shots, hits, blocked_shots, penalty_minutes, pp_points, season, toi_per_game, pp_toi_pct_per_game | `player_id`, order season desc, **no season filter** | 1 (latest season) | limit 1 | same query. The same row is fetched again by useWigoPlayerTotals under another key. |
| StatsTable expanded row / matrix selected stat (fetchPlayerGameLogForStat) | `wgo_skater_stats` | `date, <col>` (PTS1%: goals, total_primary_assists, points) | `player_id`, `season_id`, order date; **no `games_played=1`** | ≤~82–110 | none (under 1000, OK) | key `[wigoSelectedStatLog, player, season, label]`. StatsTable staleTime 60s; matrix staleTime 0. They share the key. |
| 〃 | `nst_gamelog_as_counts` / `_counts_oi` / `_rates` / `_rates_oi` | `date_scraped, <col>` | `player_id`, `season`, order date_scraped; no game identity | ≤~82 (contaminated non-game rows possible, LIVE-EVIDENCE) | none | same |
| PlayerRatingsDisplay (fetchRawStatsForAllStrengths) | `nst_percentile_as_offense`, `es_offense`, `pp_offense` | 16: player_id, season, gp, toi_seconds + 12 weighted metrics (union across strengths) | `season=eq`, order player_id | ~630–940 each (Sept) | `fetchAllSupabasePages`, pageSize 500, retry 3 → ~2 pages per view | key `[wigoRatingCohort, season]`, staleTime 60s. Changing player or min-GP reuses the cache. |
| 〃 | `nst_percentile_as_defense`, `es_defense`, `pk_defense` | 13: base 4 + 9 metrics | 〃 | ~800–940 each | 〃 | 〃. pp_defense and pk_offense are skipped (`fetchWigoRatingStats.ts:60`). Total ≈12 requests and ≈5k rows. |
| (overlap) RateStatPercentiles | same `nst_percentile_{s}_{offense,defense}` views | own select | season (+ `gp>0`) | same | paged | key `[wigoPercentileStats, strength, season, **playerId**]`: it refetches the league for every player and never shares with ratings |
| useWigoPlayerTotals | `wgo_skater_stats_totals` | 15 columns | player, season | 1 | limit 1 | key `[wigoPerGameTotals, p, s]`, staleTime 60s |
| useWigoGameLog | `wgo_skater_stats` | game_id, date, points, shots, hits, blocked_shots | player, season_id, `games_played=1` | ≤~82 | none | key `[wigoGameLog, p, s]`, 60s; dedupes by game_id and throws on conflicts |
| useCurrentSeason | `getCurrentSeason` (lib/NHL/client) | — | — | 1 | — | staleTime 1h |
| Writer (cron) calculate-wigo-stats | totals, NST seasonal ind/on-ice, wgo_skater_stats (limit 20), nst_gamelog counts | — | per player, **sequential loop over every non-goalie in `players`** (3–5 queries/player) | — | `players` paged at 1000 | upserts in batches of 200 |

Unused code: `fetchPercentilePlayerData` (`fetchWigoPlayerStats.ts:940-1092`) has no importers. `utils/tierUtils.ts` is imported only by Projections, not WiGO, so it doesn't affect ratings.

## 2. Findings

### P0: wrong number shown to users

**B-01 (P0) — Selected-stat/row chart plots fractions against 0–100 reference lines for S%, PP% and PTS1%.** STILL OPEN (prior 13).
- Where: `fetchWigoPlayerStats.ts:546-549`. The normalization is commented out (`// if (unit === "percent_decimal" ... value = value / 100;`).
- `:453`: `value = (goals + primaryAssists) / points;` produces a fraction.
- `StatsTableRowChart.tsx:98` converts only TOI. `:306-307` (`else if (tableType === "RATES" || isPercentStat) { referenceValue = avgValue; }`) draws the 0–100 table value.
- These per-game sources are fractions: `fetchPlayerGameLogStats` multiplies the same `pp_toi_pct_per_game` by 100 (`:849-852`), and totals S% is a fraction (`:746-749`, test `:348`).
- Scenario: the S% chart line sits near 0.12 while the STD line sits at 12, flattening the line to the axis. The tooltip shows "0.1%". The "Avg" label shows "0.12".
- NST-sourced IPP, oiSH% and OZS% are probably 0–100 already (UNVERIFIED for the gamelog tables).
- Fix: in `fetchPlayerGameLogForStat`, apply `normalizeWigoAggregateValue(label, v)` to the WGO-sourced percent columns and to PTS1%. Verify the NST columns' scale before touching them.

**B-02 (P0, partly UNVERIFIED) — Ratings show 50.0 or extreme values when the cohort is tiny or empty. There is no minimum cohort size and no cohort count shown.** STILL OPEN (prior 07, "explain 50.0 values").
- `calculateWigoRatings.ts:46-49` always keeps the target: `return player.player_id === targetPlayerId || playerGp >= cohortMinGp;`.
- `calculatePercentiles.ts:50-51`: `(worseCount + 0.5 * equalCount) / data.length`. A one-row cohort therefore gives 0.5 → 50.0 for every metric.
- The default `minGp` is 10 (`wigoCharts.tsx:32`).
- LIVE-EVIDENCE: AS 20252026 had max GP 5, so the AS cohort was the target alone and every AS rating was 50.0.
- Early season (today is 2026-10-25, about 8–10 games in), cohorts at GP≥10 are near empty at every strength. The regression mean then also falls back to 50 (`:172-178`).
- Fix: require at least N other qualifying players per strength (e.g. 50). Otherwise show "insufficient cohort", or reuse the percentile panel's previous-season fallback (`fetchWigoPercentiles`). Show the cohort n and the applied season.

### P1: misleading, edge-case or missing-data mishandling

**B-03 (P1) — The STD count fallback uses the latest totals row with no season check.** STILL OPEN (prior README P1).
- `fetchWigoPlayerStats.ts:603-611`: `.order("season",{ascending:false}).limit(1)` with no season filter.
- `:331-357`: if `std_*` is null, STD takes `totalsData.goals` and similar fields.
- Scenario: an injured or retired player, or any player before the new season's writer run. STD Goals/Points/SOG/HIT/BLK/PIM/PPP show **last season's totals**, while STD GP shows "-".
- Test `fetchWigoPlayerStats.test.ts:236-258` asserts the fallback but has no season.
- Fix: filter by `currentSeasonId` (add it to the query key), or delete the fallback.

**B-04 (P1) — Aggregates have no season or as-of context.** STILL OPEN.
- The query key is player-only (`useWigoPlayerDashboard.ts:32-33,162-166`).
- `wigo_career` has no season column (only `last_updated`, `ca/ya3_seasons_used`), and the client ignores those fields.
- After a season rollover and before `update-wigo-table-stats` runs, "STD" is the previous season and "LY" is two seasons ago, with no visible signal.
- Fix: have the writer persist `std_season`/`ly_season`. The client should compare it with `currentSeasonId` and blank or flag stale periods.

**B-05 (P1, NEW, data magnitude UNVERIFIED) — Seasonal aggregates mix WGO numerators with NST denominators without per-season coverage.**
- In `calculate-wigo-stats.ts`, the 3YA/CA reducers (`acc.toi_all += season.toi_all;` and `acc.wgo_pp_toi += season.wgo_pp_toi ?? 0;`) add zero TOI for seasons where NST is missing. The goals, points and GP of those seasons are still added.
- `ca_atoi = toi_all / gp` and `ca_g_per_60 = calculatePer60(wgo_g, toi_all)` therefore come out deflated and inflated respectively.
- Recent windows null incomplete coverage; seasonal windows don't.
- Scenario: a player whose early seasons exist in `wgo_skater_stats_totals` but not in `nst_seasonal_individual_counts` gets inflated CA/3YA per-60s and deflated CA ATOI/PPTOI.
- Fix: per metric, sum numerator and denominator only over seasons where both exist, or exclude seasons that lack NST.

**B-06 (P1, NEW) — PP% is averaged as a mean of rates.**
- `ya3_pp_pct = safeAverage(totals.pp_toi_pct_values)` and `ca_pp_pct` treat a 5-GP season the same as an 82-GP season.
- `l*_pp_pct = safeAverage(totals.wgo_pp_toi_pct_values)` is a per-game mean.
- Fix: weight by GP at minimum. Ideally use the ratio of summed PP TOI to team PP TOI.

**B-07 (P1) — 3YA/CA count semantics aren't disclosed.** STILL OPEN (prior 12).
- Counts and GP are per-season averages over seasons present, partial seasons included, and CA excludes the current season.
- The matrix help (`WigoComparisonMatrix.tsx:92-98`) explains only DIFF and the L-windows. StatsTable (<1600px) has no help at all.
- "CA Points 41" reads as a career total or a full-season pace. DIFF is still correct because it divides by the GP row.
- Fix: one help line and an "avg/season" header hint.

**B-08 (P1) — The chart's "Avg" line is an unweighted mean of per-game values.** STILL OPEN (prior 13).
- `StatsTableRowChart.tsx:102-110` averages per-game per-60s and percentages, which disagrees with the pooled STD line drawn next to it.
- `:281-284` formats the Avg label as `CountPerGame`, so S% reads "0.12" rather than a percentage.
- Fix: label it "mean of games", or compute it as pooled. Use the stat formatter.

**B-09 (P1, NEW) — The PPG/60, PPA/60 and PPP/60 charts query columns that don't exist.**
- `fetchWigoPlayerStats.ts:138-140` maps to `nst_gamelog_as_rates.ppg_per_60`, `ppa_per_60` and `ppp_per_60`.
- The generated types for `nst_gamelog_as_rates` (`database-generated.types.ts:12558+`) have none of these. PostgREST will return a 400, and the user sees "Failed to load game log for PPP/60." (Production schema UNVERIFIED.)
- Fix: derive per game from `wgo_skater_stats` as `pp_goals|pp_assists|pp_points × 3600 / pp_toi_per_game`.

**B-10 (P1) — Production aggregate rows may still carry the old unit bugs.** FIXED in source, production UNVERIFIED.
- The writer now uses `calculatePer60FromSeconds` for recent rates, ATOI = `toi/60/gp`, and `std_pptoi = safeDivide(wgo_pp_toi, gp)`.
- LIVE-EVIDENCE showed production `l5_g_per_60` 60× too small and `std_pptoi` = seasonal seconds/60, with "production aggregate rows remain unchanged pending … recompute".
- The client has no sanity guard. Until an authorized recompute, L-window per-60s and PPTOI can render wrong.

**B-11 (P1, NEW, magnitude UNVERIFIED) — Rating cohorts have no TOI floor.**
- `buildComparisonRows` filters only on `gp` (`calculateWigoRatings.ts:46-49`).
- PP and PK rows with GP≥minGp but only a few minutes produce extreme per-60s (e.g. GA/60 = 0) that rank at the top and set the scale.
- Fix: add a per-strength `toi_seconds` minimum.

**B-12 (P1) — Ratings and the percentile panel can use different seasons.** STILL OPEN (prior README P2).
- Ratings always use `currentSeasonId` with no fallback or contamination guard (`PlayerRatingsDisplay.tsx:62-66`).
- RateStatPercentiles applies a previous-season fallback and canonical GP.
- The ratings help text claims "{currentSeasonId} cohorts" (`WigoDashboardSections.tsx:259`).

**B-13 (P1) — Chart NST rows are keyed by `season` + `date_scraped` with no game identity.** STILL OPEN (prior 13 step 2).
- Contaminated multi-game or pre-season rows (LIVE-EVIDENCE: GP4 rows dated 2025-05-28 tagged 20252026) plot as games.
- The NST and WGO series are index-aligned, not date-aligned.

### P2: performance / redundant fetch

**B-14 (P2) — `wigo_rates` is fetched on every player load but has 0 rows and no writer** (`fetchWigoPlayerStats.ts:598-602`). If it is ever repopulated by an unknown job, it silently overrides `wigo_career` (`:256-277`). Prior 12 step 3 is STILL OPEN. Fix: remove the request and its override.

**B-15 (P2, NEW) — No staleTime on the page's core queries.** `_app.tsx:20` uses a bare `new QueryClient()`, so staleTime is 0 and refetchOnWindowFocus is on. That covers player details, the aggregated query (4 requests) and the matrix stat log (`WigoComparisonMatrix.tsx:47-57`, unlike StatsTable's 60s). All of them refetch on every tab focus or remount. Fix: set staleTime to the cron cadence (hours).

**B-16 (P2) — Ratings cohort staleTime is 60s, and the percentile panel doesn't share the cohort.** Prior 07 is partly FIXED: the key is season-only and min-GP changes no longer refetch.
- With staleTime 60s (`PlayerRatingsDisplay.tsx:65`), every player switch after a minute reloads ~12 paged requests (~5k rows), although the data is daily.
- `RateStatPercentiles.tsx:245` reloads the same views per player.
- Fix: a long staleTime, and one season/strength cohort query shared by both panels.

**B-17 (P2, timing UNVERIFIED) — Low-GP regression is O(n²) per stat and runs in `useMemo` on the main thread.**
- `calculateWigoRatings.ts:148-164` calls `calculateRankingResult` (an O(n) find plus an O(n) loop) for every cohort row.
- With up to 44 weighted stats and n ≈ 940, that is tens of millions of comparisons. It reruns on every min-GP change.
- The mean midrank of a cohort is ≈50 anyway.
- Fix: sort once per stat (O(n log n)) or use a constant 50.

**B-18 (P2) — `wgo_skater_stats_totals` is fetched twice for the same row.** The aggregated query (latest season) and useWigoPlayerTotals (player and season) use different keys and columns. Prior 00 is partly OPEN.

**B-19 (P2) — The writer is an N+1 sequential loop over every non-goalie in `players`** (calculate-wigo-stats.ts). Cron cost only; it doesn't affect page latency. STILL OPEN (prior 12 step 6).

### P3: minor / cosmetic

**B-20 (P3) — DIFF colour implies "better".** PIM and PIM/60 increases render green. StatsTable (`StatsTable.tsx:281-287`) has no "relative %, not better" disclosure; the matrix has one (`:84-96`).

**B-21 (P3) — Rounding and sign display.** A DIFF of 0.04 shows "+0.0%" in positive colour (`StatsTable.tsx:288-290`). The matrix marks 0 as `data-diff-sign="positive"` (`:183-185`).

**B-22 (P3) — Selector order doesn't match the table.** The selector order is STD, L5, L10, L20, LY, 3YA, CA (`TimeframeComparison.tsx:8`). The column/row order is STD, LY, CA, 3YA, L5, L10, L20.

**B-23 (P3) — Rating box styling and font sizes.** The inline `borderWidth: "3px"` (`PlayerRatingsDisplay.tsx:97-100`) overrides the ≥1600 `.ratingBox{border-width:1px}`. Below 1600px the label is 10px and the value 15px (module.scss:43,84,92).

**B-24 (P3) — The page renders nothing until the client effect sets `viewportWidth`** (`wigoCharts.tsx:33-40,126,200`): SSR and first paint are blank. The `resize` listener isn't throttled and re-renders the whole page.

**B-25 (P3) — Recent windows cross seasons.** This is disclosed (StatsTable caption, matrix help). Prior 12 is accepted and disclosed. In October the L20 and L10 reference lines are mostly last season's games, while the chart shows only current-season games.

### Prior-audit status, other items
- **FIXED:** StatsTable row-log race and stale expansion. It now uses useQuery keyed by player/season/label and resets on context change (`StatsTable.tsx:64-81`). The fetch rethrows errors (`fetchWigoPlayerStats.ts:568-574`) and an error state is shown.
- **FIXED:** desktop and mobile trees are no longer both mounted (`wigoCharts.tsx:126,200`).
- **FIXED:** the mobile comparison no longer limits columns to the selected pair (no `visibleColumns` is passed, `:255-264`).
- **FIXED:** the ratings cohort is no longer keyed by player/min-GP, and the two unweighted strengths are skipped (`fetchWigoRatingStats.ts:60`).
- **VERIFIED OK:** the DIFF formula and zero baseline (`tableUtils.ts:68-76`) match the spec.
- **VERIFIED OK:** the GP normalization for 3YA/CA is consistent, because both count and GP are per-season averages.
- **VERIFIED OK:** stat directions in `ratingWeights.ts`. xGA, SCA, HDCA, GA, SA, giveaways and minor penalties are lower-is-better; blocks and takeaways are higher-is-better.
- **VERIFIED OK:** weights sum to 100, except PK defense at 95. Weights are renormalized by the total, so this is harmless.
- **VERIFIED OK:** every selected rating column exists in the six views (checked against the generated types).
- **Unchanged by design:** defense shows PK, not PP, and the nine cells are preserved.

## 3. Layout facts

**StatsTable (769–1599px and mobile "comparison" tab)**
- Layout: 36 stat rows, GP included and not expandable. 9 columns: Stat label, STD, LY, CA, 3YA, L5, L10, L20, DIFF.
- Sizing: `table-layout: fixed`, `min-width: 600px`, first column 100px. Body td height 24px; header th 34px and sticky. Container `overflow:auto`. On mobile, `.combinedStatsTableContainer` has `overflow-x:auto`.
- Highlights: the left/right selected columns get blue/yellow outlines.
- Expanded row: clicking "+" inserts one chart row (`colSpan 9`) below the stat. Only one row can be open at a time.
- Chart contents: an h4 `"<label> Per Game - 2026-27"`, 7 reference toggle buttons (counts shown as "/GP", STD on by default), and a Recharts line+area chart (height 230) of current-season per-game values. It also draws a dashed "Avg" line plus any toggled reference lines.
- Grid placement: the comparison column sits in the grid row `minmax(760px, calc(100vh - 150px))`. Column widths are `minmax(640px,1.65fr)` (600px at ≤1420, 660px at ≤1180), and a single column at ≤980.

**WigoComparisonMatrix (≥1600px)**
- Layout: transposed. 37 columns (a 78px "Period" column plus 36 metrics, `table-layout: fixed`). 8 rows: 7 periods (STD, LY, CA, 3YA, L5, L10, L20) plus DIFF. That is 252 value cells plus 36 DIFF cells.
- Sizing: thead 38px, rows 25px, 12px font, `white-space: nowrap`. The toolbar is 40px and holds the selectors (410px wide), the DIFF legend, ⓘ help and status.
- Grid: row `280px` in `46px 260px 280px 376px`. At 1600px each metric column is about 41px, so 7-character DIFF strings like "+123.4%" may overflow (UNVERIFIED). It was verified only at 1920px.
- Selected-stat panel: grid area "selected" (first track of `708fr 528fr 640fr`), height 376px, padding 8px. It holds an h3, a season line, 7 toggles and a chart of height 300. That leaves little room (tight).
- Metric selection: clicking a header button (any metric except GP) changes it. The default is SOG/60.

**PlayerRatingsDisplay**
- Shape: 3 sections × 3 boxes = 9 cells. Offense (All/Even/PP), Overall (All/Even/Special), Defense (All/Even/PK). `overall.final` is computed but not shown.
- Colour: a red→yellow→green ramp.
- <1600px: `.ratingsContainer` is a fixed 150px tall, with 3 equal flex columns. Boxes have min-height 32px, a 10px label and a 15px value.
- ≥1600px: one of the 8 summary-band tracks (`252/196/212/224/226/236/246/248fr`, row 260px), wrapped in WigoSectionCard with ⓘ help. 3 rows. Each box is a row: min-height 18px, 12px font, a 5px inline bar at 55% max width.

**TimeframeComparison**: the container has min-height 44px. Two selects, each `width:min(70%,420px)` (module.scss:13-36).
