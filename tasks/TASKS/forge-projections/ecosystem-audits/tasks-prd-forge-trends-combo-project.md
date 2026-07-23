## Relevant Files

- `web/pages/FORGE.tsx` - Current FORGE projections page to be merged into the dashboard.
- `web/pages/trends/index.tsx` - Trends dashboard to be consolidated.
- `web/pages/trends/placeholder.tsx` - Archived legacy Trends dashboard content.
- `web/pages/underlying-stats/index.tsx` - Team power rankings page to be merged.
- `web/pages/start-chart.tsx` - Start Chart UI page for games/goalies context.
- `web/pages/api/v1/start-chart.ts` - Start Chart data API (games, goalies, CTPI sparkline).
- `web/pages/api/v1/forge/players.ts` - FORGE projections API used by FORGE page.
- `web/pages/api/v1/trends/team-power.ts` - Team trends API for percentiles.
- `web/pages/api/v1/trends/team-ctpi.ts` - CTPI ladder API.
- `web/pages/api/v1/trends/team-sos.ts` - Strength-of-schedule API.
- `web/pages/api/v1/trends/skater-power.ts` - Skater trends API.
- `web/pages/api/team-ratings.ts` - Team power ratings API for underlying-stats.
- `web/lib/teamRatingsService.ts` - Team power ratings loader for underlying-stats.
- `web/lib/teamsInfo.ts` - Team metadata map and id/abbr helpers.
- `web/lib/trends/teamMetricConfig.ts` - Team trend categories and weights.
- `web/lib/trends/skaterMetricConfig.ts` - Skater trend categories.
- `web/lib/trends/ctpi.ts` - CTPI computation and sparkline helpers.
- `web/lib/trends/teamPercentiles.ts` - Team percentile engine.
- `web/lib/trends/strengthOfSchedule.ts` - SOS computation.
- `tasks/TASKS/cron-operations/cron-schedule.md` - Cron dependencies for required tables.
- `tasks/forge-trends-combo-architecture.md` - Decisions for route and rendering strategy.
- `web/lib/dashboard/dataFetchers.ts` - Shared dashboard API fetch utilities and loader.
- `web/hooks/useDashboardData.ts` - Unified dashboard data hook scaffold.
- `web/lib/dashboard/teamMetadata.ts` - Shared team metadata normalization helper.
- `web/pages/trends/dashboard.module.scss` - Neon noir dashboard styling for the new trends dashboard.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Define combined dashboard information architecture and data contracts
  - [x] 1.1 Confirm final route name and whether the page is SSR, CSR, or hybrid.
  - [x] 1.2 Define canonical data shapes for team power, projections, and trends.
  - [x] 1.3 Decide whether legacy `player_projections` stays as fallback or is removed.
  - [x] 1.4 Align date semantics across sources (today vs latest available vs yesterday).
  - [x] 1.5 Document required filters (date, team, search, position, projection source).

- [x] 2.0 Build unified data loading layer and cache strategy
  - [x] 2.1 Create shared fetch utilities/hooks for CTPI, team power, SOS, skater trends, FORGE projections, and start-chart schedule data.
  - [x] 2.2 Add caching/memoization to avoid duplicate API calls across sections.
  - [x] 2.3 Normalize team metadata via `teamsInfo` (abbr/name/colors) in one place.
  - [x] 2.4 Add loading/error boundary handling per section with consistent empty states.

- [x] 3.0 Consolidate team power views (CTPI + power ratings + SOS)
  - [x] 3.1 Merge CTPI ladder and power ratings table into a single canonical table.
  - [x] 3.2 Integrate SOS metrics into the combined team table and cards.
  - [x] 3.3 Reuse CTPI sparkline + hot/cold streaks as sidebar components.
  - [x] 3.4 Expose component ratings (finishing/goalie/danger/special/discipline) in expanded rows or tooltips.

- [x] 4.0 Consolidate player/goalie projections and matchup context
  - [x] 4.1 Build unified projections section using FORGE as primary source.
  - [x] 4.2 Wire goalie starts and win/shutout probabilities into projections view.
  - [x] 4.3 Add games remaining + opponent context to projection rows.
  - [x] 4.4 Add toggle for legacy projections if retained (side-by-side or switch).
  - [x] 4.5 Ensure uncertainty bands render consistently across skaters/goalies.

- [x] 5.0 Consolidate trend charts (team + skater) and search
  - [x] 5.1 Embed team trend charts with category tabs and brush controls.
  - [x] 5.2 Embed skater trend charts with position + window controls.
  - [x] 5.3 Reuse player search/autocomplete and link to player trend pages.
  - [x] 5.4 Standardize chart palettes and legends across sections.

- [ ] 6.0 Create the new dashboard page and routing, and deprecate legacy pages
  - [x] 6.1 Implement the new combined page layout and top-level navigation.
  - [x] 6.2 Add SSR/CSR data hydration logic based on chosen strategy.
  - [x] 6.3 Add redirects or in-app links from legacy pages to the new dashboard.
  - [ ] 6.4 Audit for dead code and remove unused components once migration is complete.

- [ ] 7.0 Validation, performance tuning, and cron dependency check
  - [x] 7.1 Verify API response sizes and add pagination/limits where needed. A value-free Production probe measured all nine budgeted dashboard routes; eight passed and `skater-power?limit=60` exceeded its 280,000-byte budget at 383,242 bytes. The route now accepts bounded `seriesGames` history while retaining full-history rankings; actual consumers request 40 chart points, 10 Hot/Cold points, or one movers point. The regression uses a full 60-player/82-game input, verifies the existing 50-player cap plus one-point caller contract, and keeps serialized output within 280,000 bytes. NEW 8.0 retains deployment/Production remeasurement.
- [x] 7.2 Load-test with empty data and off-season scenarios. The complete 26-test dashboard page suite covers empty endpoint payloads, blocked/degraded weekly and stale fallback states, independent module states, and usable shell rendering; the production remediation closeout separately records the truthful 52,153-game/zero-eligible-write offseason no-op.
- [x] 7.3 Validate cron table freshness against `tasks/TASKS/cron-operations/cron-schedule.md`. The reconciled production chain remains WGO 09:35 → incremental NST 09:55 → CTPI 10:10 → team power 10:15, full NST 10:55, and player trends 12:00; bounded production probes verified 32 CTPI teams, 32 distinct non-zero team trends, and explicit latest-eligible offseason blocking.
- [x] 7.4 Confirm median dashboard load time under the target thresholds. The preserved 10-run warm-cache artifact records 1,142.85 ms median dashboard-ready time against the 2,500 ms target, with 400.3 ms median load-event time; current 7-file/58-test validation and full TypeScript pass.

## NEW Tasks

- [ ] NEW 8.0 **P1 deployed skater-trend response-budget gate:** current customer Production returns 383,242 bytes for the former largest dashboard shape against the 280,000-byte budget. Exact commit `9a1adb2f0daa3ce3e7274cd085902f1b086aa0de` is READY as target-null deployment `dpl_DNbHyah58BezABc2ppN4sUyDCvcc`; value-free branch probes returned 200 at 85,699 bytes for the largest-caller `limit=60&seriesGames=1` shape, 184,671 bytes for the shared Trends `limit=25&seriesGames=40` shape, and 201,317 bytes for Hot/Cold `limit=40&seriesGames=10`, with no bounded deployment error logs. Keep open only for separately authorized customer-Production targeting and remeasurement of all nine declared budgets (discovered and locally remediated 2026-07-22; branch artifact verified 2026-07-22).
