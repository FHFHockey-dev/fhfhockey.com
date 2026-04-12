# Variance Runbook

## Runtime Surfaces

- `/variance` is the minimal Variance hub. It links to `/variance/goalies` and `/variance/skaters`.
- `/variance/goalies` re-exports `web/pages/goalies.js`.
- `/goalies` redirects to `/variance/goalies` through `getServerSideProps` in `web/pages/goalies.js`.
- `/variance/skaters` is a live MVP table backed by `wgo_skater_stats`.

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

- `wgo_skater_stats` is the current `/variance/skaters` MVP source.
- The page fetches the latest non-null `season_id`, then pages through current-season game rows from `wgo_skater_stats`.
- Selected fields: `player_id`, `player_name`, `team_abbrev`, `current_team_abbreviation`, `position_code`, `date`, `season_id`, `games_played`, `points`, `goals`, `assists`, `shots`, and `toi_per_game`.
- `wgo_skater_stats_totals` is documented and available for later season-total context, but the current MVP does not require it.
- `rolling_player_game_metrics` stores canonical rolling player metrics by player/date/strength state and is a future skater variance candidate, not part of the current MVP.
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
- `web/rules/context/cron-schedule.md` is the current schedule inventory.

## Page-Layer Calculations

- `calculateWeeklyRanking` compares selected weekly goalie stats against weekly league averages and assigns Elite, Quality, Average, Bad, or Really Bad.
- `calculateGoalieRankings` derives WoW points, weekly rank counts, WoW standard deviation, game fantasy points, game standard deviation, fantasy points above average, and percentile rank from NHL API game logs.
- `buildGoalieAdvancedMetricsRows` aggregates `goalie_stats_unified` season rows by goalie and strength. It sums counts, derives per-60 values with `(summed count / summed selected-strength TOI minutes) * 60`, derives QS% from quality starts divided by games started, and preserves missing values as `null`.
- `applyGoalieValueTiers` adds `valueTier` and `valueTierScore` to the current filtered goalie population. The score uses fantasy production, consistency, workload, and start confidence. QS% participates only when an advanced metrics row exists for that goalie.
- `buildGoalieVarianceAverages` computes filtered-population averages for WoW and game standard deviation.
- `formatGoalieVarianceValue` displays raw standard deviation or relative deltas versus the filtered average.
- `buildSkaterVarianceRows` aggregates `wgo_skater_stats` game rows by skater for the current season.
- `calculateSkaterProductionProxy` uses neutral production proxy `points + shots * 0.1`.
- Skater game volatility is the population standard deviation of the neutral production proxy by game.
- Minimum GP parsing lives in `components/Variance/varianceFilters.ts` and is shared by goalie and skater Variance surfaces.

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

- `/variance/skaters` is a live MVP table in `web/pages/variance/skaters.tsx`.
- It fetches `wgo_skater_stats`, not `wgo_skater_stats_totals`.
- It aggregates rows by `player_id` for the latest `season_id`.
- Current columns: player, team, position, GP, production proxy, goals, assists, shots, TOI/GP, and game volatility.
- The production proxy is deliberately neutral and should be labeled as `points + 0.1 * shots`, not fantasy scoring.
- Game volatility is the standard deviation of that neutral production proxy by game.
- The MVP does not include strength splits, PP role, rolling form, or site-wide skater fantasy scoring.

## Verification

- Verify weekly ranking by spot-checking `calculateWeeklyRanking` against a week where `goalie_weekly_aggregates` and `league_weekly_goalie_averages` are known.
- Verify fantasy points with one game row: `saves * 0.2 + wins * 4 + shutouts * 3 + goals_against * -1`.
- Verify WoW standard deviation against the weekly point sequence for a single goalie.
- Verify game standard deviation against per-game fantasy points for a single goalie.
- Verify advanced goalie metrics by comparing a known goalie/season against `goalie_stats_unified`:
  - QS% = summed `quality_start` / summed `games_started`.
  - GSAA and xGA = summed selected-strength fields.
  - xGA/60, HDSA/60, SA/60, RA/60, RushA/60 = summed count / summed selected-strength TOI minutes * 60.
- Verify skater MVP values by comparing a known player/season against `wgo_skater_stats`:
  - GP = summed `games_played` with missing game rows treated as one game.
  - Production proxy = sum of `points + shots * 0.1`.
  - Game volatility = standard deviation of per-game production proxy values.
  - TOI/GP = average of `toi_per_game` across counted games.
- Focused test command:
  - `npm run test:full -- --typecheck components/GoaliePage/goalieMetrics.test.ts components/Variance/skaterVariance.test.ts components/Variance/varianceFilters.test.ts`

## Known Gaps

- The active goalie leaderboard still fetches NHL API rows client-side instead of using the documented Supabase goalie views.
- The goalie advanced metrics fetch is season-scoped, not selected-date-range scoped.
- `goalie_totals_unified` is underused at runtime, though it remains useful for validation.
- Average shot distance and average goal distance are calculated but not rendered in the advanced table MVP.
- `/variance/skaters` uses a neutral production proxy, not site-wide fantasy scoring.
- `/variance/skaters` does not yet include skater strength-specific variance, PP role context, rolling form, or totals-table enrichment.
- Project-wide `tsc --noEmit` currently fails on unrelated underlying-stats/xg test type issues; use focused typechecked Vitest commands for this pass until those are resolved.
