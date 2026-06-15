## Relevant Files

- `tasks/prd-fhfh-site-surface-expansion-roadmap.md` - Source PRD that defines the umbrella roadmap, scope, phases, and non-goals for this task list.
- `tasks/fhfh-site-surface-expansion-implementation-map.md` - Canonical route-ownership, naming, cross-link, and non-goal note used to lock roadmap decisions before feature work expands.
- `web/pages/index.tsx` - Homepage route that anchors slate summaries, standings, injuries, and downstream navigation.
- `web/styles/Home.module.scss` - Homepage styling layer where the injury-table date column and related layout polish are controlled.
- `web/components/HomePage/HomepageGamesSection.tsx` - Homepage live-game summary module that needs status validation and lightweight deep-link support.
- `web/components/HomePage/HomepageGamesSection.test.tsx` - Homepage regression coverage for live-game clock presentation and downstream decision-surface links.
- `web/components/HomePage/HomepageStandingsInjuriesSection.tsx` - Homepage standings and injuries surface for table-completeness and layout polish work.
- `web/components/HomePage/HomepageStandingsInjuriesSection.test.tsx` - Homepage regression coverage for standings sorting, error handling, and injury pagination behavior.
- `web/components/Layout/NavbarItems/NavbarItemsData.ts` - Global navigation inventory where roadmap-approved top-level tool links are exposed.
- `web/pages/trends/index.tsx` - Trends landing page that should absorb more recent-form, L10-style, and comparison-toolkit entry points.
- `web/pages/trends/player/[playerId].tsx` - Player trend detail route that already supports rolling and historical baselines and should be extended rather than replaced.
- `web/pages/trends/dashboard.module.scss` - Trends landing styling for the new recent-form scan and integrated goalie-workload panel.
- `web/pages/trends/player/playerTrendPage.module.scss` - Player trend detail styling for the explicit recent comparison toolkit and quick-view cards.
- `web/pages/wigoCharts.tsx` - Existing explanatory chart route that can host stronger over/under-performance storytelling before a brand-new page is created.
- `web/pages/stats/team/[teamAbbreviation].tsx` - Primary team route that should remain the core team destination as schedule, shot-map, and context modules expand.
- `web/pages/lines/[abbreviation].tsx` - Per-team lines page for deployment, PP personnel, and future timeshare or goal-share visualizations.
- `web/pages/lines/index.tsx` - Lines landing page that can route users into stronger line-context and data-freshness workflows.
- `web/components/PowerPlayCombos/PowerPlayCombos.tsx` - Existing PP-unit and personnel surface that should be extended for PP split and shot-share context.
- `web/components/LineCombinations/LineCombinationsGrid.tsx` - Current lines-grid renderer that is a likely integration point for new line-level visual context.
- `web/pages/goalies.js` - Current goalie route for weekly rankings and consistency-facing improvements.
- `web/pages/trueGoalieValue.tsx` - Existing goalie experiment that may absorb or link to stronger workload and weekly-quality surfaces.
- `web/components/GoalieShareChart/index.tsx` - Existing goalie-share visualization component that can be reused for clearer workload trend packaging.
- `web/pages/game-grid/index.tsx` - Game-grid route that should keep its planning role while linking to deeper team and matchup tools.
- `web/pages/game-grid/[mode].tsx` - Canonical game-grid route where phase-1 cross-links should guide users into the related deep-dive surfaces.
- `web/pages/start-chart.tsx` - Starter-board route that should connect matchup planning to trends, lines, goalies, and the game grid.
- `web/components/TeamStandingsChart/TeamStandingsChart.tsx` - Homepage standings-chart component where PP% and PK% metric scaling must stay aligned with upstream percentage units.
- `web/components/TeamStandingsChart/metricUtils.ts` - Shared metric-scaling helpers for homepage standings-chart percentage handling.
- `web/components/TeamStandingsChart/metricUtils.test.ts` - Regression tests that protect point-percentage scaling while keeping PP% and PK% in their original units.
- `web/components/GameGrid/utils/FourWeekGrid.tsx` - Core four-week-grid implementation that needs the tabbed “back side” redesign.
- `web/components/GameGrid/OpponentMetricsTable.tsx` - Existing opponent-context companion table that should remain aligned with grid enhancements.
- `web/lib/dashboard/teamContext.ts` - Existing team-context shaping logic that is a natural starting point for L10-style and matchup-facing modules.
- `web/lib/underlying-stats/teamScheduleStrength.ts` - Team schedule-strength helper that can support opponent-success and upcoming-schedule context.
- `web/lib/trends/teamPercentiles.ts` - Existing percentile/category foundation that can feed later category-coverage synthesis work.
- `web/lib/trends/trendsSurface.ts` - Shared trends-surface helper contract for locked baseline modes, quick-view labels, and recent-form summary cards.
- `web/lib/trends/trendsSurface.test.ts` - Helper-level regression coverage for trends-surface baseline and summary-card shaping.
- `web/pages/api/v1/trends/team-power.ts` - Existing recent-team-context API surface that may need expansion for fantasy-facing L10 packaging.
- `web/pages/api/v1/trends/team-sos.ts` - Existing team-schedule/opponent context route that can support matchup framing.
- `web/pages/api/v1/trends/team-ctpi.ts` - Existing team-context API surface that may be reused instead of creating duplicate recent-form endpoints.
- `web/pages/api/v1/start-chart.ts` - Existing matchup-planning API route whose context may need to cross-link with splits and recent-form surfaces.
- `web/pages/api/v1/trends/skater-power.ts` - Skater recent-form API that now needs to support the stronger 20-game window contract used by the trends toolkit.
- `web/lib/navigation/siteSurfaceLinks.ts` - Shared configuration for roadmap-approved cross-links between homepage, trends, team pages, lines, goalies, start chart, and game grid.
- `web/components/SurfaceWorkflowLinks/SurfaceWorkflowLinks.tsx` - Reusable cross-link strip for guiding users between summary and deep-dive decision surfaces.
- `web/components/SurfaceWorkflowLinks/SurfaceWorkflowLinks.module.scss` - Styling for the reusable roadmap cross-link strip.
- `web/components/SurfaceWorkflowLinks/index.ts` - Barrel export for the reusable workflow-link component.
- `web/components/SurfaceWorkflowLinks/SurfaceWorkflowLinks.test.tsx` - Component test coverage for the reusable workflow-link strip.
- `web/pages/splits/index.tsx` - New dedicated route candidate for player-vs-team and team-vs-team decision surfaces if extending existing pages proves awkward.
- `web/pages/api/v1/splits/index.ts` - New API surface candidate for split-query responses that are too opinionated to live on generic trend endpoints.
- `web/__tests__/pages/trends/index.test.tsx` - Route-level regression tests for trends landing changes and new entry points.
- `web/__tests__/pages/stats/team/[teamAbbreviation].test.tsx` - Route-level team-page tests for new modules, navigation, and canonical behavior.
- `web/__tests__/pages/splits/index.test.tsx` - New route-level tests for the dedicated splits surface if this route is introduced.
- `web/lib/splits/splitsSurface.ts` - Shared splits response types and calculation helpers for matchup cards, PP shot share, and fantasy-priority leader ranking.
- `web/lib/splits/splitsServer.ts` - Server-side composition layer that reuses underlying-stats and team-context data to build the splits surface payload.
- `web/lib/splits/splitsSurface.test.ts` - Helper-level coverage for PP shot-share derivation, fantasy leader ranking, and matchup-card shaping.
- `web/__tests__/pages/api/v1/splits/index.test.ts` - API-route coverage for splits request validation and payload passthrough.
- `web/pages/splits/splits.module.scss` - Styling for the dedicated splits route.
- `web/components/PowerPlayCombos/PowerPlayCombos.module.scss` - Styling support for the new PP shot-share detail labels inside the current PP-unit surface.
- `web/pages/auth/callback.tsx` - Auth callback page updated to opt out of static prerendering so roadmap work can still pass production build verification.
- `web/pages/auth/reset-password.tsx` - Password-reset page updated to opt out of static prerendering so roadmap work can still pass production build verification.

### Notes

- This checklist covers the umbrella roadmap, not a single shippable feature. Parent tasks are ordered so phase 1 work can land before phase 2 and 3 surfaces.
- Prefer extending existing routes first. Create a new route only when the PRD explicitly calls out that the existing page would become unclear or overloaded.
- Daily refresh is the default expectation. Only line-combination, goalie-start, or same-day slate features should introduce tighter freshness requirements.
- The ranking-vote idea is explicitly out of scope under the PRD’s no-voting and no-user-generated-data constraints.
- Use the repo’s current test stack for verification. Prefer targeted `npx vitest run [optional/path/to/test/file]` runs before broader validation.

## Tasks

- [x] 1.0 Lock the canonical product surfaces, naming, and navigation model for the roadmap
  - [x] 1.1 Map every in-scope PRD item to one canonical destination: homepage, trends, team pages, lines pages, goalie pages, game grid, WGO charts, or a new dedicated route.
  - [x] 1.2 Decide which currently overlapping routes stay canonical for users, especially for team analysis and goalie analysis, so new work does not create duplicate answers on different pages.
  - [x] 1.3 Define user-facing labels for internal names such as `WiGO`, `WGO`, `PELT`, `Breakout Barometer`, and `Value Cost Delta`, keeping aliases only where they improve recognition.
  - [x] 1.4 Add or update cross-links between homepage, trends, team pages, lines pages, start chart, and game grid so summary modules lead directly to the right deep-dive page.
  - [x] 1.5 Record the intentionally deferred items and PRD non-goals in implementation notes so no one accidentally builds the excluded ranking-vote workflow.

- [x] 2.0 Polish the homepage and other lightweight summary surfaces before deeper feature expansion
  - [x] 2.1 Verify the homepage still swaps scheduled start time to period plus time remaining for in-progress games and repair any regressions if the live-state contract has drifted.
  - [x] 2.2 Audit the homepage standings module to confirm data completeness, empty-state handling, and resilience when one upstream data source is stale.
  - [x] 2.3 Fix the injury-table date-column layout issue so the row density remains readable across common viewport widths.
  - [x] 2.4 Audit every homepage PP-related summary metric, identify why the current PP% output can drift from expected values, and correct the displayed contract rather than patching only formatting.
  - [x] 2.5 Add lightweight downstream links from homepage summary modules into the strongest relevant deep-dive surfaces instead of trying to turn the homepage into a dense analysis page.
  - [x] 2.6 Add targeted route/component tests for homepage rendering, data fallbacks, and any corrected metric-display logic.

- [x] 3.0 Expand trends into the main recent-form and rolling-comparison toolkit
  - [x] 3.1 Audit the existing player trend route and explicitly lock the supported baseline modes for strong v1, with recent-vs-season and recent-vs-career treated as required and recent-vs-last-year included only if the source contract is stable.
  - [x] 3.2 Package the current rolling-chart capability into clearer user-facing controls for L7, L14, L30, rolling-10, and related comparison views so users do not need to infer the workflow from chart behavior alone.
  - [x] 3.3 Expose clearer recent-form summaries for TOI, shots, PP usage, and related fantasy metrics on the trends landing page so users can scan before drilling into a player page.
  - [x] 3.4 Integrate or enhance goalie-share and goalie-workload trend presentation using existing goalie-share components rather than creating a disconnected new chart surface.
  - [x] 3.5 Extend or normalize the supporting trend APIs and data shapers so the UI receives explicit comparison-ready outputs instead of raw rolling metrics with ambiguous labels.
  - [x] 3.6 Add route-level and helper-level tests covering baseline-mode switching, URL state, and trend-summary rendering.

- [x] 4.0 Deliver the strongest fantasy-decision additions: splits, L10 context, and PP shot-share
  - [x] 4.1 Decide whether the splits experience fits cleanly into trends or should become a dedicated route; if a dedicated route is cleaner, create `/splits` as the canonical player-vs-team and team-vs-team surface.
  - [x] 4.2 Define the strong-v1 split-query contract for player-versus-team and team-versus-team outputs, with fantasy-oriented summaries and ranking behavior rather than raw historical dumps.
  - [x] 4.3 Implement the supporting API and query layer for split results, reusing existing team-context and underlying-stat helpers where possible instead of building isolated duplicate data paths.
  - [x] 4.4 Build an L10-style team-context module that combines recent team offense, defense, and special-teams context with opponent framing so users can make matchup decisions without manually joining multiple pages.
  - [x] 4.5 Expose player PP shot share as a dedicated user-facing metric and keep it explicitly separate from PP TOI share, PP usage share, or unit membership.
  - [x] 4.6 Integrate PP shot-share output with existing PP personnel and line-context displays so the feature explains role and opportunity together.
  - [x] 4.7 Add navigation hooks from trends, team pages, lines pages, and start-chart-adjacent surfaces into the new splits and recent-context modules.
  - [x] 4.8 Add route, API, and calculation tests for split-query correctness, L10-context shaping, and PP shot-share derivation.

- [ ] 5.0 Expand team pages and lines pages into the main team-context workflow
  - [ ] 5.1 Keep the current team route as the primary team destination and remove any ambiguity about which route should own new team-context modules.
  - [ ] 5.2 Add or enhance rolling team line charts for GF/GP, PP%, points percentage, xGF, xGA, and shots-for style metrics where the repo already has enough data to support a stable contract.
  - [ ] 5.3 Strengthen team-level opponent-success or opponent-quality context so upcoming schedule interpretation is visible inside the team experience instead of only in grid-adjacent tools.
  - [ ] 5.4 Extend PP personnel coverage into a clearer PP split-by-personnel surface, either directly on the team page or through a clearly linked sub-surface that users can discover without guesswork.
  - [ ] 5.5 Audit the existing line-ingestion pipeline and close the gap between background line-refresh work and stable user-facing output, especially if line snapshots are available from FHFHbot-related sources.
  - [ ] 5.6 Add L1 through L4 timeshare and goal-share visualization to the lines experience so deployment changes are interpretable at a glance.
  - [ ] 5.7 Verify that schedule grid, shot map, line combinations, PP personnel, and new opponent context work together without forcing users across legacy and new team routes.
  - [ ] 5.8 Add page-level and component-level tests covering team-page modules, line visualizations, and any refreshed line-data contracts.

- [ ] 6.0 Build the stronger goalie-consistency and workload surfaces
  - [ ] 6.1 Define the strong-v1 weekly goalie bucketing contract, including named bands such as `Elite`, `Good`, `Average`, `Bad`, and `Abysmal`, plus the minimum sample rules used to classify a week.
  - [ ] 6.2 Implement the consistency-score logic and the supporting summary tables that explain patterns such as `3-2`, `2-1`, and `1-0` quality-start style outcomes over time.
  - [ ] 6.3 Add starts-per-week and workload summaries so users can separate performance quality from simple volume opportunity.
  - [ ] 6.4 Decide whether these surfaces live on `goalies.js`, `trueGoalieValue.tsx`, or a clearly linked dedicated route, then keep one canonical user-facing goalie workflow.
  - [ ] 6.5 Treat goalie quality-of-competition framing as a later or optional layer unless the data contract is reliable enough to support backup-to-starter transition analysis without misleading output.
  - [ ] 6.6 Add tests for week classification, consistency scoring, summary-table aggregation, and route-level rendering.

- [ ] 7.0 Upgrade the game-grid ecosystem and explanatory chart surfaces
  - [ ] 7.1 Redesign the four-week grid to support a tabbed “back side” view that preserves the current table while allowing alternate stat-focused views.
  - [ ] 7.2 Keep the current four-week columns recognizable after the redesign so existing users do not lose the familiar planning workflow.
  - [ ] 7.3 Decide which additional statistics belong on the alternate grid tabs first, favoring high-fantasy-utility context over metric sprawl.
  - [ ] 7.4 Keep the opponent-metrics and schedule-context companion surfaces aligned with the new tab model so users can still interpret matchup quality next to schedule density.
  - [ ] 7.5 Expand the WGO explanatory-chart experience into a clearer over/under-performance tool for teams, focusing on readable drivers such as chance generation, chance suppression, finishing, and special teams.
  - [ ] 7.6 Ensure the upgraded grid and WGO surfaces link cleanly to team pages, trends, and other deep-dive tools instead of acting like isolated utilities.
  - [ ] 7.7 Add component and route tests for tab switching, state preservation, and explanatory-chart data shaping.

- [ ] 8.0 Stage the later-phase percentile synthesis and experimental toolkit work without blocking production surfaces
  - [ ] 8.1 Turn the existing percentile/category-coverage foundations into a clearer summary leaderboard or card system before attempting a large standalone tool.
  - [ ] 8.2 Define the first user-facing shell for the player evaluation toolkit, using descriptive copy first and retaining `PELT` only as an alias until product naming is finalized.
  - [ ] 8.3 Scope the `Breakout Barometer` around a bounded metric set such as TOI, SOG/60, iSCF/60, iXG/60, and iHDCF/60 so the feature can ship as a coherent channel or trend view rather than an open-ended experiment.
  - [ ] 8.4 Scope `Value Cost Delta / ROI for ADP` around a clear draft/value decision contract so it complements, rather than duplicates, existing draft or projection tooling.
  - [ ] 8.5 Gate experimental surfaces behind explicit labels, navigation, or feature flags so they do not dilute the clarity of the core production workflow while still remaining in active roadmap scope.

- [ ] 9.0 Finish the roadmap with shared data-contract, validation, and rollout work
  - [ ] 9.1 Audit each feature area for whether it can reuse an existing API/table/helper versus requiring a new dedicated contract, and avoid introducing duplicate endpoints when a nearby surface can be extended cleanly.
  - [ ] 9.2 Apply the PRD’s daily-refresh default across roadmap features and document exceptions for lines, goalie starts, or live-slate context that need tighter freshness.
  - [ ] 9.3 Add targeted regression coverage for the newly expanded routes, helper modules, and APIs before broader workspace verification.
  - [ ] 9.4 Run end-to-end smoke checks across the main user flows: homepage to trends, homepage to team pages, lines to PP context, game grid to team deep dives, and goalie landing to workload or consistency views.
  - [ ] 9.5 Capture any unresolved scope questions, deferred later-phase work, and post-v1 follow-ups in implementation notes so the roadmap remains actionable after the first round of delivery.
