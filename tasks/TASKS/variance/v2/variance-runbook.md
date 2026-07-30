# Variance Runbook

## Runtime Surfaces

- `/variance` is the minimal Variance hub. It links to `/variance/goalies` and `/variance/skaters`.
- `/variance/goalies` re-exports `web/pages/goalies.js`.
- `/goalies` redirects to `/variance/goalies` through `getServerSideProps` in `web/pages/goalies.js`.
- `/variance/skaters` is the full configurable skater variance leaderboard backed by `wgo_skater_stats` and optional Yahoo context.

## Upstream Sources

### Goalie Variance

- NHL Stats API, fetched client-side from `web/pages/goalies.js`, remains the source for the active goalie leaderboard and standard weekly Metrics table.
- `goalie_stats_unified` feeds the Advanced Analytics table. The page fetches season rows by `season_id` through Supabase and aggregates them page-side by `player_id`.
- `wgo_goalie_stats` stores official NHL goalie game rows used by documented goalie views and adjacent goalie surfaces.
- `yahoo_matchup_weeks` defines fantasy matchup week windows.
- `goalie_weekly_aggregates` joins `wigo_goalies` to `yahoo_matchup_weeks` and computes weekly goalie totals/rates.
- `league_weekly_goalie_averages` aggregates `goalie_weekly_aggregates` into week-level league averages.
- `wigo_goalies` joins `wgo_goalie_stats` to all-situations NST goalie counts/rates.
- `goalie_totals_unified` aggregates `goalie_stats_unified` by goalie/season and remains useful for validation, but it is not the current Advanced Analytics page source because `goalie_stats_unified` exposes the full strength-specific field set.
- NST goalie tables include all, 5v5, EV, PK, and PP counts/rates tables named `nst_gamelog_goalie_*_{counts,rates}`.

### Goalie Advanced Metrics Field Mapping

- Shared strength options live in `GOALIE_ADVANCED_STRENGTH_OPTIONS`.
- Visible strengths map to count prefixes:
  - `All Situations` -> `nst_all_counts`
  - `5v5` -> `nst_5v5_counts`
  - `Even Strength` -> `nst_ev_counts`
  - `PK` -> `nst_pk_counts`
  - `PP` -> `nst_pp_counts`
- The Advanced Analytics fetch selects `player_id`, `player_name`, `games_played`, `games_started`, `quality_start`, plus per-strength:
  - `${prefix}_toi`
  - `${prefix}_gsaa`
  - `${prefix}_xg_against`
  - `${prefix}_goals_against`
  - `${prefix}_hd_shots_against`
  - `${prefix}_shots_against`
  - `${prefix}_rebound_attempts_against`
  - `${prefix}_rush_attempts_against`
  - `${prefix}_avg_shot_distance`
  - `${prefix}_avg_goal_distance`

### Skater Variance

- `wgo_skater_stats` is the current `/variance/skaters` game-stat source.
- The page fetches the latest non-null `season_id`, then pages through current-season game rows from `wgo_skater_stats`.
- `wgo_skater_stats_totals` supplies the preferred latest-season identity; the game table is the fallback.
- `yahoo_nhl_player_map_read`, `yahoo_players_with_normalized_history`, and `yahoo_matchup_weeks` provide optional identity, ownership/draft, and matchup-week context.
- Selected game fields cover identity, scoring categories, special teams, peripherals, TOI, shooting, and individual shot-attempt rate.
- `rolling_player_game_metrics` remains the canonical rolling player table but is not an input to the current skater leaderboard.
- NST skater gamelog and seasonal tables documented in `supabase-table-structure.md` can support later advanced skater context.

## Refresh Jobs And Endpoints

- `/api/v1/db/update-yahoo-weeks` refreshes Yahoo matchup windows used by `yahoo_matchup_weeks`.
- `/api/v1/db/update-wgo-goalies` refreshes `wgo_goalie_stats`; scheduled as `update-all-wgo-goalies`.
- `/api/v1/db/update-wgo-goalie-totals` refreshes goalie totals surfaces; scheduled as `update-all-wgo-goalie-totals`.
- `/api/v1/db/update-nst-goalies` refreshes NST goalie counts/rates tables; scheduled as `update-nst-goalies`.
- `daily-refresh-goalie-unified-matview` refreshes goalie unified materialized views.
- `/api/v1/db/update-wgo-skaters` refreshes `wgo_skater_stats`; scheduled as `update-all-wgo-skaters`.
- `/api/v1/db/update-wgo-totals` refreshes `wgo_skater_stats_totals`; scheduled as `update-all-wgo-skater-totals`.
- `/api/v1/db/update-rolling-player-averages` refreshes `rolling_player_game_metrics`.
- `/api/v1/db/calculate-wigo-stats` refreshes WIGO skater derived surfaces.
- `daily-refresh-player-unified-matview` and `daily-refresh-player-totals-unified-matview` refresh player unified materialized surfaces.
- `tasks/TASKS/cron-operations/cron-schedule.md` is the current schedule inventory.

## Page-Layer Calculations

- `calculateWeeklyRanking` compares selected weekly goalie stats against weekly league averages and assigns Elite, Quality, Average, Bad, or Really Bad.
- `calculateGoalieRankings` derives WoW points, weekly rank counts, WoW standard deviation, game fantasy points, game standard deviation, fantasy points above average, and percentile rank from NHL API game logs.
- `buildGoalieAdvancedMetricsRows` aggregates `goalie_stats_unified` season rows by goalie and strength. It sums counts, derives per-60 values with `(summed count / summed selected-strength TOI minutes) * 60`, derives QS% from quality starts divided by games started, and preserves missing values as `null`.
- `applyGoalieValueTiers` adds `valueTier` and `valueTierScore` to the current filtered goalie population. The score uses fantasy production, consistency, workload, and start confidence. QS% participates only when an advanced metrics row exists for that goalie.
- `buildGoalieVarianceAverages` computes filtered-population averages for WoW and game standard deviation.
- `formatGoalieVarianceValue` displays raw standard deviation or relative deltas versus the filtered average.
- `SkaterPage/skaterCalculations.ts` applies the selected scoring categories and point values to each game, maps games into Yahoo matchup or calendar weeks, and derives weekly production, sample standard deviation, rating counts, ownership/ADP buckets, and value rows.
- Default skater point values come from `lib/projectionsConfig/fantasyPointsConfig.ts`; users may configure the active categories and values on the page.
- `SkaterPage/skaterMetrics.ts` owns standard, advanced, overview, and trend row shaping.
- The skater leaderboard uses `SkaterPage/skaterFilters.ts`; goalie Minimum GP parsing remains in `components/Variance/varianceFilters.ts`.
- `components/Variance/skaterVariance.ts` preserves the historical neutral-MVP helper for compatibility tests only and has no runtime consumer.

## Table/View-Layer Calculations

- `goalie_weekly_aggregates` computes weekly save percentage, GAA, saves/60, and shots against/60.
- `league_weekly_goalie_averages` computes league weekly totals and weighted rate averages.
- `goalie_totals_unified` computes season totals plus aggregate save percentage, GAA, quality start percentage, NST all/5v5 rates, and availability flags.
- `goalie_stats_unified` exposes per-game official NHL and strength-specific NST goalie fields consumed by the Advanced Analytics table.
- `wgo_skater_stats` stores skater game rows consumed by `/variance/skaters`.
- `wgo_skater_stats_totals` stores skater season totals available for later skater variance expansion.
- `rolling_player_game_metrics` is the canonical skater rolling table for future skater variance work.

## Naming, Directionality, And Fallback Rules

- Lower is better for goals against, GAA, WoW standard deviation, and game standard deviation.
- Higher is better for fantasy points, wins, saves, shutouts, save percentage, quality starts percentage, GSAA, workload, and start volume.
- xGA, xGA/60, SA/60, HDSA/60, RA/60, and RushA/60 are exposure/context metrics, not goalie quality metrics by themselves.
- Relative variance labels must state delta versus the filtered average, not the full NHL league.
- Relative variance mode is display-only. Sorting remains on raw WoW/game standard deviation because subtracting the same filtered average does not change order.
- Empty Minimum GP input resets the filter to zero and shows all rows. Invalid input preserves the last valid numeric threshold and shows an error.
- Missing metric values render as `N/A` and sort after valid values.
- Value Tier labels are relative to the current filtered goalie population and should not be described as absolute league tiers.

## Advanced Metrics Table

- The goalie Advanced Analytics surface is a sortable table in `GoalieAdvancedMetricsTable.tsx`.
- Current columns: `Goalie`, `GP`, `GS`, `QS%`, `GSAA`, `xGA`, `xGA/60`, `HDSA/60`, `SA/60`, `RA/60`, and `RushA/60`.
- Average shot distance and average goal distance are calculated by the mapper but intentionally not rendered in the MVP table to avoid crowding. Add them only with clear shot-profile labels.
- Strength selection defaults to `All Situations` and updates state in place without changing routes.
- Missing or non-finite values render as `N/A`.
- Sortable missing values are placed after real values in both ascending and descending sorts.

## Skaters Variance Table

- `web/pages/variance/skaters.tsx` owns data loading; `web/components/SkaterPage/SkaterLeaderboard.tsx` owns controls and table selection.
- The active surface supports value overview, standard, advanced, and trend modes with configurable fantasy scoring and ownership/ADP valuation.
- Row shaping and sorting remain in `SkaterPage` calculation/metric/table modules; the page does not invoke the historical neutral proxy.
- Later-page failures retain completed rows and render a stable partial-data notice.

## Verification

- Verify weekly ranking by spot-checking `calculateWeeklyRanking` against a week where `goalie_weekly_aggregates` and `league_weekly_goalie_averages` are known.
- Verify fantasy points with one game row: `saves * 0.2 + wins * 4 + shutouts * 3 + goals_against * -1`.
- Verify WoW standard deviation against the weekly point sequence for a single goalie.
- Verify game standard deviation against per-game fantasy points for a single goalie.
- Verify advanced goalie metrics by comparing a known goalie/season against `goalie_stats_unified`:
  - QS% = summed `quality_start` / summed `games_started`.
  - GSAA and xGA = summed selected-strength fields.
  - xGA/60, HDSA/60, SA/60, RA/60, RushA/60 = summed count / summed selected-strength TOI minutes * 60.
- Verify skater fantasy and variance values by applying the selected category weights to known `wgo_skater_stats` game rows, grouping them into the resolved matchup weeks, and comparing the weekly aggregates and sample standard deviation.
- Focused test command:
  - `npm test -- components/SkaterPage/skaterCalculations.test.ts components/SkaterPage/skaterMetrics.test.ts components/GoaliePage/goalieCalculations.test.ts components/GoaliePage/goalieFilters.test.ts components/GoaliePage/goalieMetrics.test.ts components/Variance/varianceFilters.test.ts`

## Known Gaps

- The active goalie leaderboard still fetches NHL API rows client-side instead of using the documented Supabase goalie views.
- The goalie advanced metrics fetch is season-scoped, not selected-date-range scoped.
- `goalie_totals_unified` is underused at runtime, though it remains useful for validation.
- Average shot distance and average goal distance are calculated but not rendered in the advanced table MVP.
- `/variance/skaters` does not yet consume canonical `rolling_player_game_metrics` or NST strength-split rows.
- Yahoo ownership/draft enrichment is optional and does not replace NHL player/stat authority.
