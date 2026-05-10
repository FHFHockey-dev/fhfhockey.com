## Relevant Files

- `web/pages/variance/skaters.tsx` - Main skater variance page that will load data, manage controls, and render the new skater leaderboard.
- `web/components/SkaterPage/skaterTypes.ts` - New skater-specific types for game rows, Yahoo rows, scoring settings, buckets, weekly aggregates, rankings, and table rows.
- `web/components/SkaterPage/skaterCalculations.ts` - New scoring, ownership/ADP bucketing, weekly aggregation, variance, and value classification helpers.
- `web/components/SkaterPage/skaterCalculations.test.ts` - Unit tests for fantasy scoring, weekly ownership, ADP buckets, standard deviation labels, and fallback behavior.
- `web/components/SkaterPage/skaterMetrics.ts` - New standard and advanced skater metric aggregation helpers.
- `web/components/SkaterPage/skaterMetrics.test.ts` - Unit tests for standard/advanced metric aggregation and bucket average rows.
- `web/components/SkaterPage/skaterFilters.ts` - New filter helpers for minimum GP/sample controls and ADP percent drafted threshold behavior.
- `web/components/SkaterPage/SkaterLeaderboard.tsx` - New top-level skater leaderboard component with tabs and controls.
- `web/components/SkaterPage/SkaterTable.tsx` - New reusable sortable table for Value Overview and Metrics tabs.
- `web/components/SkaterPage/SkaterAdvancedMetricsTable.tsx` - New sortable advanced metrics table.
- `web/components/SkaterPage/SkaterList.tsx` - New list/container component modeled after the goalie page path.
- `web/lib/projectionsConfig/fantasyPointsConfig.ts` - Existing source of default skater fantasy point settings.
- `web/lib/projectionsConfig/skaterScoringLabels.ts` - Shared skater scoring labels used by draft settings and skater variance helpers.
- `web/components/DraftDashboard/DraftSettings.tsx` - Existing source pattern for skater scoring labels that may need extraction or shared reuse.
- `web/styles/vars.scss` - Existing color variables for bucket-tinted row styling.
- `web/pages/variance/variance.module.scss` - Existing variance page styles that may need skater table/control additions.
- `web/__tests__/pages/api/v1/db/update-line-sources.test.ts` - Typed line-source update mock calls so TypeScript can inspect update payload assertions.
- `web/__tests__/pages/api/v1/db/update-lines-ccc.test.ts` - Typed CCC stale-row and unresolved-name update mocks for TypeScript-safe payload assertions.
- `web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId]/chart.test.ts` - Updated goalie chart fixtures to match the current shared chart result contract.
- `web/__tests__/pages/trends/index.test.tsx` - Updated trends page props to match the current dashboard page contract.
- `web/__tests__/pages/underlying-stats/goalieStats/index.test.tsx` - Typed shared goalie landing page mock props.
- `web/__tests__/pages/underlying-stats/index.test.tsx` - Added required route-status fixture for the team underlying-stats landing page.
- `web/__tests__/pages/underlying-stats/playerStats/[playerId].test.tsx` - Typed deferred fetch resolver fixture for detail loading-state tests.
- `web/__tests__/pages/underlying-stats/playerStats/index.test.tsx` - Typed deferred fetch resolver fixtures for background hydration tests.
- `web/lib/NHL/edge.ts` - Relaxed NHL Edge shot-location player summary IDs so slug-derived IDs remain supported.
- `web/lib/sources/lineupSourceIngestion.test.ts` - Narrowed GameDayTweets lineup fixture literals without making array fields readonly.
- `web/lib/underlying-stats/goalieStatsServer.test.ts` - Updated goalie chart delegation fixture to match the current chart result type.
- `web/lib/underlying-stats/playerStatsLandingServer.ts` - Preserved compatibility with legacy/generated fixture row fields while keeping selected runtime reads unchanged.
- `web/lib/underlying-stats/playerStatsLandingServer.test.ts` - Updated player-stats landing fixtures for current summary-row, parity, and mock metric contracts.
- `web/lib/underlying-stats/teamLandingRatings.test.ts` - Updated landing-rating fixtures to include current dashboard enrichment fields.
- `web/lib/underlying-stats/teamScheduleStrength.test.ts` - Added future-opponent fields required by the current SoS snapshot contract.
- `web/lib/xg/deploymentContext.test.ts` - Added required own-goal feature fixture field.

### Notes

- Unit tests should use the project's existing test runner and be placed alongside the skater helper files where practical.
- Keep goalie variance behavior unchanged.
- Confirm whether `IPP` and `iXG/60` have reliable source fields before displaying calculated values.
- Avoid adding database schema changes in the first pass.

## Tasks

- [x] 1.0 Establish skater data contracts and shared scoring metadata
  - [x] 1.1 Create `web/components/SkaterPage/` if it does not already exist.
  - [x] 1.2 Define raw `wgo_skater_stats` row types, Yahoo player row types, scoring setting types, valuation mode types, bucket types, weekly aggregate types, and final leaderboard row types in `skaterTypes.ts`.
  - [x] 1.3 Define the supported skater fantasy scoring category map, including labels, source stat fields, default inclusion state, and default point values from `DEFAULT_SKATER_FANTASY_POINTS`.
  - [x] 1.4 Extract or share the `SKATER_LABELS` pattern from `DraftSettings.tsx` if needed so the variance page and draft settings do not drift.
  - [x] 1.5 Map all requested standard metrics to available `wgo_skater_stats` fields.
  - [x] 1.6 Verify whether `IPP` and `iXG/60` are available from existing tables; document any unavailable advanced fields in code comments and omit or render `N/A` rather than inventing values.

- [x] 2.0 Build skater calculation helpers
  - [x] 2.1 Implement fantasy point calculation per skater game from active scoring settings.
  - [x] 2.2 Implement matchup-week grouping for skater game rows, reusing existing variance week logic if available.
  - [x] 2.3 Implement weekly skater fantasy point aggregation.
  - [x] 2.4 Implement standard deviation calculation consistently with the goalie path, documenting sample vs population behavior.
  - [x] 2.5 Implement game-to-game variance from game fantasy point totals.
  - [x] 2.6 Implement week-over-week variance from weekly fantasy point totals.
  - [x] 2.7 Implement weekly ownership extraction from `ownership_timeline` using entries within each week.
  - [x] 2.8 Add ownership fallback behavior: closest prior timeline value, then `percent_ownership`, then unknown/WW-style fallback.
  - [x] 2.9 Implement ownership bucket labels from `0-9%` through `90-100%`.
  - [x] 2.10 Implement ADP extraction from `draft_analysis.average_pick`, falling back to denormalized Yahoo ADP fields.
  - [x] 2.11 Implement ADP round buckets using `Math.ceil(average_pick / 12)`.
  - [x] 2.12 Implement `WW` and `LOW %D` label assignment for missing ADP and below-threshold `percent_drafted` players.
  - [x] 2.13 Implement peer bucket weekly averages and per-game averages.
  - [x] 2.14 Implement week quality classification using the PRD standard deviation bands.
  - [x] 2.15 Implement low-sample bucket fallback behavior with a clear constant and comment.
  - [x] 2.16 Implement final value overview row assembly with week counts, `% OK weeks`, `% Good weeks`, `+/- Avg Fpts`, GP, and total fantasy points.

- [x] 3.0 Build skater metric aggregation helpers
  - [x] 3.1 Implement standard metrics aggregation for GP, ATOI, G, A, PTS, SOG, S%, PPTOI, PPG, PPA, PPP, HIT, BLK, PIM, and +/-.
  - [x] 3.2 Implement advanced per-60 metrics for G/60, A/60, PT/60, SOG/60, PPG/60, PPA/60, PPP/60, HIT/60, BLK/60, PIM/60, and CF/60 where source fields support them.
  - [x] 3.3 Implement `IPP` and `iXG/60` as mapped values only if reliable source fields exist; otherwise render `N/A`.
  - [x] 3.4 Implement bucket average rows for the Value Overview tab.
  - [x] 3.5 Implement bucket average rows for the Metrics tab.
  - [x] 3.6 Ensure bucket average rows calculate averages from visible bucket members and respect active filters.

- [x] 4.0 Update `/variance/skaters` data loading
  - [x] 4.1 Expand the `wgo_skater_stats` select fields to include all required standard, special teams, and advanced source fields.
  - [x] 4.2 Add Yahoo player data fetching from `yahoo_players` for the active season.
  - [x] 4.3 Normalize Yahoo text `player_id` values to join safely with numeric WGO `player_id` values.
  - [x] 4.4 Preserve paginated loading for large `wgo_skater_stats` result sets.
  - [x] 4.5 Ensure missing Yahoo data does not block rendering WGO skater rows.
  - [x] 4.6 Keep loading and error states consistent with existing variance pages.

- [x] 5.0 Build skater leaderboard UI
  - [x] 5.1 Create `SkaterLeaderboard.tsx` with valuation mode toggle, scoring controls, filters, tab state, and table rendering.
  - [x] 5.2 Create scoring controls with checkboxes and editable numeric point inputs for all supported skater categories.
  - [x] 5.3 Default selected scoring controls to goals, assists, shots on goal, hits, blocked shots, and power-play points.
  - [x] 5.4 Add `Relative to Ownership` and `Relative to ADP` valuation mode toggle.
  - [x] 5.5 Add ADP `percent_drafted` slider with default value `0.5`, shown only when ADP mode is active.
  - [x] 5.6 Add minimum GP or minimum sample filter controls.
  - [x] 5.7 Add a weekly/per-game display option for `+/- Avg Fpts`.
  - [x] 5.8 Add `Value Overview`, `Metrics`, and `Advanced Analytics` tabs.
  - [x] 5.9 Wire active scoring, valuation, and filter controls into memoized row calculations.

- [x] 6.0 Build skater tables and sorting
  - [x] 6.1 Create `SkaterTable.tsx` for sortable Value Overview and Metrics tables.
  - [x] 6.2 Implement Value Overview columns exactly as defined in the PRD, including `OWN%` or `ADP` next to `Tier`.
  - [x] 6.3 Implement Metrics columns exactly as defined in the PRD, including `OWN%` or `ADP` next to `Team`.
  - [x] 6.4 Create `SkaterAdvancedMetricsTable.tsx`.
  - [x] 6.5 Implement Advanced Analytics columns exactly as defined in the PRD, including `OWN%` or `ADP` next to `Team`.
  - [x] 6.6 Implement stable sorting for text, numeric, missing, and bucket average row values.
  - [x] 6.7 Ensure bucket average rows remain visually tied to their bucket grouping during sorting or choose a documented grouped-table behavior.
  - [x] 6.8 Create `SkaterList.tsx` if the goalie page pattern requires a separate list/container component.

- [x] 7.0 Add bucket-aware styling
  - [x] 7.1 Add ownership bucket row styling with readable tinted zebra striping.
  - [x] 7.2 Add ADP round bucket row styling with distinct round colors.
  - [x] 7.3 Add distinct but related styling for `WW` and `LOW %D`.
  - [x] 7.4 Use `web/styles/vars.scss` color variables where practical.
  - [x] 7.5 Ensure bucket average rows are visually distinct without breaking table readability.
  - [x] 7.6 Check responsive behavior for wide tables and preserve existing variance page layout patterns.

- [x] 8.0 Replace the skater MVP page with the new flow
  - [x] 8.1 Update `web/pages/variance/skaters.tsx` to render the new skater leaderboard components.
  - [x] 8.2 Remove or stop using the current neutral production proxy table from the page.
  - [x] 8.3 Keep any still-useful logic from `web/components/Variance/skaterVariance.ts` only if it fits the new helper design.
  - [x] 8.4 Confirm `/variance/skaters` still links and loads correctly from the variance hub.

- [x] 9.0 Add focused tests
  - [x] 9.1 Test fantasy point calculation with default scoring and custom scoring.
  - [x] 9.2 Test ownership weekly average calculation from timeline entries.
  - [x] 9.3 Test ownership fallback behavior when weekly timeline entries are missing.
  - [x] 9.4 Test ownership bucket boundaries, including 0, 9, 10, 99, and 100.
  - [x] 9.5 Test ADP round bucket conversion for a 12-team league.
  - [x] 9.6 Test `WW` and `LOW %D` assignment.
  - [x] 9.7 Test weekly aggregation and variance calculations.
  - [x] 9.8 Test standard deviation week labels for Elite, Quality, Average, Bad, and Really Bad.
  - [x] 9.9 Test low-sample bucket fallback behavior.
  - [x] 9.10 Test standard and advanced metric aggregation, including unavailable metric rendering.

- [x] 10.0 Verify the completed feature
  - [x] 10.1 Run the focused skater helper tests.
  - [x] 10.2 Run existing goalie variance and skater variance tests to confirm no regression.
  - [x] 10.3 Run TypeScript/typecheck or the closest existing project validation command.
  - [x] 10.4 Start the dev server and verify `/variance/skaters` loads.
  - [x] 10.5 Verify scoring edits update fantasy points, variance, and week labels.
  - [x] 10.6 Verify ownership mode and ADP mode display the correct context columns and bucket labels.
  - [x] 10.7 Verify bucket average rows appear in Value Overview and Metrics.
  - [x] 10.8 Verify missing Yahoo data degrades gracefully.

- [x] 11.0 NEW: Resolve existing full TypeScript verification blockers
  - [x] 11.1 Fix or quarantine pre-existing `tsc --noEmit` failures in underlying-stats and xg test files so full typecheck can be used as a clean verification signal. Verified with `npx tsc --noEmit` and a targeted Vitest pass covering 15 touched test files.
