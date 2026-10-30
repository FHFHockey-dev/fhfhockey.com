# WiGO charts: data and pipeline audit (2026-10-25)

**Scope.** I traced every page component (C01–C19) from `pages/wigoCharts.tsx` through `components/WiGO/**`, the `useWigo*` hooks and the `fetchWigo*` / `calculateWigoRatings` utilities, down to Supabase tables, views and RPCs and the `calculate-wigo-stats` writer. Three read-only sweeps did the tracing and their detail is in `audit-A.md`, `audit-B.md` and `audit-C.md`; each finding there carries file:line, a quoted line and a failure scenario. Each sweep also marked the September `tasks/TASKS/wigo-charts-audit/` items as open or fixed.

**Method.**
- Code, DDL and fixtures only. No production reads.
- **Re-verified by me in code:** B-01, B-02, B-09, A-04 and C-06 (the ones I fixed), plus A-01 and C-02.
- **Observed in the fixture network log:** A-01 (the `wgo_skater_stats_totals … order=season.desc&limit=1` request has no season filter) and C-02 (one unranged `get_skaters_avg_stats` RPC call).
- Everything else is as reported by the sweeps and is marked "sweep".

**Severity scale**
- **P0:** wrong number shown to users.
- **P1:** misleading in edge cases, or mishandles missing data.
- **P2:** performance or redundant fetch.
- **P3:** minor.

## Fixed in this patch (each has a focused test)

| ID | Sev | What was wrong | Fix | Test |
| --- | --- | --- | --- | --- |
| B-01 | P0 | The selected-stat chart plotted S%, PP% and PTS1% game logs as 0–1 fractions against 0–100 reference lines, giving a flat line and "0.1%" tooltips. `fetchWigoPlayerStats.ts` had its normalization commented out, and PTS1% was a fraction. | WGO percentage columns now go through `normalizeWigoAggregateValue`; PTS1% is ×100. NST percentage columns are left alone because their scale is unverified. | `fetchWigoPlayerStats.test.ts` "units (selected-stat chart)" |
| B-09 | P1 | The PPG/60, PPA/60 and PPP/60 charts queried `nst_gamelog_as_rates.pp*_per_60`, which don't exist per the generated types, so they showed "Failed to load". | Per game, `wgo_skater_stats` PP count × 3600 / `pp_toi_per_game`, the same definition as the writer's `calculatePer60FromSeconds(wgo_pp*, wgo_pp_toi)`. A game with no PP time gives null, not 0. | same file, PP per-60 case |
| B-02 | P0 | Ratings showed 50.0 for every metric when the cohort was the selected player alone, because the target is always kept and n=1 gives a 0.5 midrank. With the default min GP of 10 this happens early in the season. | `calculatePlayerRatings(…, minCohortPeers)`; the page passes `WIGO_RATING_MIN_COHORT_PEERS = 20`. Below that the stat shows "-". The ⓘ methodology text says so. | `calculateWigoRatings.test.ts` and `PlayerRatingsDisplay.test.tsx` (no 50.0, 9 × "-") |
| A-04 | P1 | Special-teams validity required PP goals ≤ PP opportunities in every game. A legitimate two-goal major wiped that team's season PP% and PK%. | The per-game ≤ checks are dropped; integer and non-negative checks stay. | `teamPerformanceDrivers.test.ts` (major-penalty case) |
| C-06 | P1 | The TOI chart's y-axis was hard-capped at 30:00, which clipped long overtime games while the tooltip showed the real value. | `max` became `suggestedMax` (a floor, not a cap). | new `ToiLineChart.test.tsx` |
| new | P3 | A DIFF above 999% (for example "+3584.8%") overflowed its matrix cell. | `formatDiffPercent` drops the decimal at four digits or more ("+3585%"). | `tableUtils.test.ts` |

## Open: data correctness (P1), recommended next

| ID | Finding (detail in audit-X.md) | Source |
| --- | --- | --- |
| A-01 / B-03 | The STD count fallback reads the latest `wgo_skater_stats_totals` row with **no season filter** (`fetchWigoPlayerStats.ts:603-611`). A player with no current-season games shows last season's totals as STD. | re-verified (network log) |
| A-02 / B-04 | The aggregate query key and fetch are player-only, and `wigo_career` has no season column. After rollover, STD can be last season until the writer runs, with no as-of label. | sweep |
| B-10 | The writer's TOI unit fixes are in source, but in September production rows still had L-window per-60s about 60× too small, and `std_pptoi` was wrong. A recompute is needed and unverified (my before screenshot from the prior evidence shows L5 G/60 = 0.01). | sweep + prior evidence |
| B-05 | 3YA and CA add WGO counts from seasons that have no NST TOI, which inflates per-60s and deflates ATOI and PPTOI. | sweep |
| B-06 / B-07 | PP% in 3YA and CA is an unweighted mean of seasonal PP%, and 3YA/CA counts are per-season averages that include partial seasons. Neither is disclosed in the UI. | sweep |
| B-08 | The chart's "Avg" line is an unweighted per-game mean, so it disagrees with the pooled STD line. | sweep |
| B-11 / B-12 | Rating cohorts have no TOI floor, and ratings and the percentile panel can use different seasons. | sweep |
| B-13 | NST chart rows join on `season + date_scraped` with no game identity. | sweep |
| A-03 | Team drivers need every team-game row. One missing row blanks that team for the season, and if 9 or more teams have gaps the cards blank for everyone. The NST cutoff date is also applied to `wgo_team_stats`. | sweep (code confirmed while building fixtures: `fetchTeamDriverSnapshots.ts` completeness filter) |
| A-05 | Search has no goalie or active filter and no ordering. A selected goalie gets empty panels with no explanation. | sweep |
| A-06 | A failed season lookup shows "Loading season info…" forever, and the drivers card says "Select a player" even after one is selected. | sweep |
| C-01 | Game Score's goal-differential term counts all-strength on-ice GF/GA (PP and SH included); the published model uses 5v5. The help text doesn't say this. | sweep (`baseline.sql:1364-1365`) |
| C-02 | The radar cohort is one **unpaged, unordered** RPC read under the 1000-row cap, with about 925–1000 skaters a season, so rows (possibly the selected player) can drop silently. Live, it also timed out in September. | re-verified (single unranged RPC) |
| C-03 / C-04 | The radar has no min-GP filter, and both the radar and the rate percentiles pool forwards with defensemen. | sweep |
| C-05 | Rate-percentile min GP, "Player GP" and the stale-season check use NST `gp`, which has been seen contaminated (GP 102). The correct WGO GP is already fetched. | sweep |

## Open: performance (P2)
- **A-07 / B-15:** a bare `new QueryClient()` means staleTime 0 and refetch on focus. Player details, the 4-request aggregate fetch and the matrix log all refetch on every tab focus.
- **A-08 / B-14:** `wigo_rates` (0 rows, no writer) is still fetched for every player and would silently override `wigo_career` if it were ever filled.
- **B-18:** `wgo_skater_stats_totals` is fetched twice for the same row.
- **A-09:** the schedule polls the uncached `/api/cors` Vercel function every 5 minutes, even offseason. This is a runtime cost under AGENTS.md's Vercel controls.
- **A-10 / B-16 / C-09:** the team-driver dataset (about 6–7k rows, about 9 requests), the ratings cohort and the rate-percentile cohorts are each re-downloaded after 60 s, and the cohorts aren't shared.
- **C-07 / C-08:** TOI and Game Score do their own game-log reads (Game Score needs two, plus a date join) instead of sharing `useWigoGameLog`.
- **C-11:** every page re-render rebuilds the three trend charts. This probably resets zoom (unverified at runtime).
- **B-17:** low-GP regression is O(n²) per stat on the main thread.

## Dead or unsafe code (recorded, not fixed)
- **C-17 (P3, do not reuse; verified by Codex via TJ and re-checked here).** `web/lib/supabase/utils/calculations.ts:10-46` `calculateGameScore` (the legacy sKO helper) turns every missing input into 0 (`?? 0` at :11-29). It also sums all-strength GF/GA (the same issue as C-01).
  - **No caller exists:** repo-wide search found no references outside the file.
  - **The live chart doesn't use it:** WiGO's Game Score chart comes from the `get_skater_game_scores_for_season` RPC (`components/WiGO/GameScoreLineChart/index.tsx:61`).
  - **Action:** no separate fix; the redesign does not call it. Any future Game Score view must use the live RPC path.
- **Goalie fantasy points:** no WiGO view shows them. If one is added, use FHFH Standard from the shared fantasyPointsConfig (0.2 per save, −1 per GA, +4 per win, +3 per shutout).

## Open: minor (P3)
A-11 to A-18 (UTC first render, preseason season, search quality, direct NHL headshot fetch, retry on a bad id, raw position codes, log noise), B-20 to B-25 (DIFF green for PIM increases, "+0.0%" in positive colour, selector order, cross-season recent windows, which are disclosed) and C-12 to C-16. Details are in the sweep files.

**Addressed by the redesign rather than as logic:**
- B-23: rating box sizes.
- B-24: the blank first paint is unchanged, but the ≥1600 / <1600 remount split is gone, because one tree now serves every width above 768px.
- C-16: rate-percentile controls are still replaced while loading; not changed.
- The search status line now floats under the input instead of growing the toolbar.

## Previously fixed (confirmed by the sweeps)
- Single mounted tree; row-log race and stale expansion; mobile shows all columns.
- Ratings cohort keyed by season; the DIFF formula; rating directions and weights.
- Consistency null handling and dedupe; strict 5- and 10-game rolling windows.
- Radar midrank, error and missing states; Game Score coverage disclosure and zoom.
- Rate-stat error propagation; fallback-season messaging; 84-game pace and S%; schedule ordering and cache.

## Not done (needs approval or another owner)
- No production reads were made; B-10 and C-02 magnitudes need a TJ-approved, bounded read to confirm.
- A-01, A-02 and B-04/05/06 touch the aggregate contract and writer (`calculate-wigo-stats`). That is a writer change plus a recompute, which is ask-first under AGENTS.md.
