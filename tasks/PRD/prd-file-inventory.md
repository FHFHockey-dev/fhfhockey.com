# PRD: File Inventory

Generated: 2025-09-12 03:36:19 UTC

This inventory lists all tracked files in the repo (excluding common build/cache/vendor directories) to support file-by-file optimization work.

Excluded paths:
- node_modules
- .git
- .next
- dist
- build
- .vercel
- coverage
- tmp
- .cache
- out
- .DS_Store
- __pycache__
- *.egg-info
- venv/.venv/env

Total files: 845

## Top-Level Summary
- web: 786 files
- cms: 30 files
- functions: 7 files
- tasks: 5 files
- (root): 5 files
- webhooks: 4 files
- .vscode: 4 files
- .playwright-mcp: 2 files
- tools: 1 files
- migrations: 1 files

## Directory Tree

```text
├── .playwright-mcp/
│   ├── page-2025-08-25T23-26-10-385Z.png
│   └── page-2025-08-27T03-18-57-834Z.png
├── .vscode/
│   ├── extensions.json
│   ├── fhfhockey.com.code-workspace
│   ├── mcp_config.json
│   └── settings.json
├── cms/
│   ├── .sanity/
│   │   └── runtime/
│   │       ├── app.js
│   │       └── index.html
│   ├── config/
│   │   ├── @sanity/
│   │   │   ├── data-aspects.json
│   │   │   ├── default-layout.json
│   │   │   ├── default-login.json
│   │   │   ├── form-builder.json
│   │   │   └── vision.json
│   │   └── .checksums
│   ├── plugins/
│   │   ├── cms-studio-logo/
│   │   │   ├── Logo.tsx
│   │   │   ├── logo.png
│   │   │   └── sanity.json
│   │   └── .gitkeep
│   ├── schemas/
│   │   ├── author.js
│   │   ├── blockContent.js
│   │   ├── category.js
│   │   ├── comment.js
│   │   ├── post.js
│   │   └── schema.js
│   ├── static/
│   │   ├── .gitkeep
│   │   └── favicon.ico
│   ├── .env.development
│   ├── .eslintrc
│   ├── .npmignore
│   ├── README.md
│   ├── package.json
│   ├── sanity.cli.js
│   ├── sanity.config.js
│   ├── sanity.json
│   ├── tsconfig.json
│   └── vercel.json
├── functions/
│   ├── api/
│   │   ├── fetch_team_table.py
│   │   └── index.py
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── requirements.txt
│   └── vercel.json
├── migrations/
│   └── 20250827_yahoo_upsert_and_mapping.sql
├── tasks/
│   ├── prd-cleanup-tasks.md
│   ├── prd-draft-dashboard.md
│   ├── prd-file-inventory.md
│   ├── prd-mobile-stats-page-optimization.md
│   └── tasks-prd-mobile-stats-page-optimization.md
├── tools/
│   └── gen_tree.py
├── web/
│   ├── .storybook/
│   │   ├── main.ts
│   │   └── preview.ts
│   ├── .vscode/
│   │   ├── launch.json
│   │   └── settings.json
│   ├── __tests__/
│   │   ├── LinemateMatrix/
│   │   │   ├── LineCombinationData.js
│   │   │   └── shiftcharts-2023020850.json
│   │   ├── index.test.tsx
│   │   └── vitest.setup.js
│   ├── components/
│   │   ├── Banner/
│   │   │   ├── Banner.module.scss
│   │   │   ├── Banner.tsx
│   │   │   └── index.ts
│   │   ├── BlogPost/
│   │   │   ├── BlogPost.module.scss
│   │   │   ├── BlogPost.tsx
│   │   │   └── index.ts
│   │   ├── CategoryCoverageChart/
│   │   │   ├── CategoryCoverageChart.module.scss
│   │   │   ├── CategoryCoverageChart.tsx
│   │   │   └── index.ts
│   │   ├── Chart/
│   │   │   ├── Chart.module.scss
│   │   │   ├── Chart.tsx
│   │   │   └── index.ts
│   │   ├── ChartTitle/
│   │   │   ├── ChartTitle.module.scss
│   │   │   ├── ChartTitle.tsx
│   │   │   └── index.ts
│   │   ├── ClientOnly/
│   │   │   ├── ClientOnly.tsx
│   │   │   └── index.ts
│   │   ├── CommentForm/
│   │   │   ├── CommentForm.module.scss
│   │   │   ├── CommentForm.tsx
│   │   │   └── index.ts
│   │   ├── Comments/
│   │   │   ├── Comments.module.scss
│   │   │   ├── Comments.tsx
│   │   │   └── index.ts
│   │   ├── CronReportEmail/
│   │   │   ├── CronAuditEmail.tsx
│   │   │   └── CronReportEmail.tsx
│   │   ├── DateRangeMatrix/
│   │   │   ├── DateRangeMatrixForGames.tsx
│   │   │   ├── GoalieCardDRM.tsx
│   │   │   ├── LinePairGrid.tsx
│   │   │   ├── PlayerCardDRM.tsx
│   │   │   ├── TeamDropdown.tsx
│   │   │   ├── drm.module.scss
│   │   │   ├── fetchAggregatedData.ts
│   │   │   ├── index.module.scss
│   │   │   ├── index.tsx
│   │   │   ├── lineCombinationHelper.ts
│   │   │   ├── useTOIData.tsx
│   │   │   └── utilities.ts
│   │   ├── DraftDashboard/
│   │   │   ├── DraftBoard.module.scss
│   │   │   ├── DraftBoard.tsx
│   │   │   ├── DraftDashboard.module.scss
│   │   │   ├── DraftDashboard.tsx
│   │   │   ├── DraftSettings.module.scss
│   │   │   ├── DraftSettings.tsx
│   │   │   ├── DraftSummaryModal.module.scss
│   │   │   ├── DraftSummaryModal.tsx
│   │   │   ├── ImportCsvModal.tsx
│   │   │   ├── MyRoster.module.scss
│   │   │   ├── MyRoster.tsx
│   │   │   ├── ProjectionsTable.module.scss
│   │   │   ├── ProjectionsTable.tsx
│   │   │   ├── SuggestedPicks.module.scss
│   │   │   ├── SuggestedPicks.tsx
│   │   │   ├── TeamRosterSelect.tsx
│   │   │   └── Untitled-1.html
│   │   ├── GameGrid/
│   │   │   ├── PDHC/
│   │   │   │   ├── PoissonHeatMap.tsx
│   │   │   │   └── Tooltip.tsx
│   │   │   ├── Switch/
│   │   │   │   ├── Switch.module.css
│   │   │   │   ├── Switch.module.scss
│   │   │   │   ├── Switch.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Toggle/
│   │   │   │   ├── Toggle.module.css
│   │   │   │   ├── Toggle.module.scss
│   │   │   │   ├── Toggle.tsx
│   │   │   │   └── index.ts
│   │   │   ├── contexts/
│   │   │   │   └── GameGridContext.tsx
│   │   │   ├── utils/
│   │   │   │   ├── FourWeekGrid.module.scss
│   │   │   │   ├── FourWeekGrid.tsx
│   │   │   │   ├── calcWeekScore.test.js
│   │   │   │   ├── calcWeekScore.ts
│   │   │   │   ├── calcWinOdds.test.js
│   │   │   │   ├── calcWinOdds.ts
│   │   │   │   ├── date-func.tsx
│   │   │   │   ├── helper.ts
│   │   │   │   ├── poisson.ts
│   │   │   │   ├── poissonHelpers.ts
│   │   │   │   ├── useFourWeekSchedule.ts
│   │   │   │   └── useSchedule.ts
│   │   │   ├── GameGrid.module.scss
│   │   │   ├── GameGrid.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── OpponentMetricsTable.module.scss
│   │   │   ├── OpponentMetricsTable.tsx
│   │   │   ├── TeamRow.tsx
│   │   │   ├── TotalGamesPerDayRow.tsx
│   │   │   ├── TransposedGrid.module.scss
│   │   │   ├── TransposedGrid.tsx
│   │   │   ├── VerticalMatchupCell.tsx
│   │   │   └── index.ts
│   │   ├── GameScoreChart/
│   │   │   ├── GameLogTable.tsx
│   │   │   └── GameScoreChart.tsx
│   │   ├── GameStateAnalysis/
│   │   │   ├── GameStateAnalysis.module.scss
│   │   │   └── GameStateAnalysis.tsx
│   │   ├── GoaliePage/
│   │   │   ├── GoalieLeaderboard.tsx
│   │   │   ├── GoalieList.tsx
│   │   │   ├── GoalieTable.tsx
│   │   │   ├── goalieCalculations.ts
│   │   │   └── goalieTypes.ts
│   │   ├── GoalieShareChart/
│   │   │   ├── GoalieShareChart.module.scss
│   │   │   └── index.tsx
│   │   ├── HeatMap/
│   │   │   ├── Heatmap.tsx
│   │   │   └── xGoals.tsx
│   │   ├── HockeyRinkSvg/
│   │   │   └── HockeyRinkSvg.tsx
│   │   ├── IconButton/
│   │   │   ├── IconButton.module.scss
│   │   │   ├── IconButton.tsx
│   │   │   └── index.ts
│   │   ├── Layout/
│   │   │   ├── Container/
│   │   │   │   ├── Container.module.scss
│   │   │   │   ├── Container.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Header/
│   │   │   │   ├── Header.module.scss
│   │   │   │   ├── Header.tsx
│   │   │   │   └── index.ts
│   │   │   ├── MobileMenu/
│   │   │   │   ├── MobileMenu.module.scss
│   │   │   │   ├── MobileMenu.tsx
│   │   │   │   └── index.ts
│   │   │   ├── NavbarItems/
│   │   │   │   ├── NavbarItems.module.scss
│   │   │   │   ├── NavbarItems.tsx
│   │   │   │   ├── NavbarItemsData.ts
│   │   │   │   └── index.ts
│   │   │   ├── Layout.module.scss
│   │   │   ├── Layout.tsx
│   │   │   └── index.ts
│   │   ├── LineCombinations/
│   │   │   ├── CategoryTitle/
│   │   │   │   ├── CategoryTitle.module.scss
│   │   │   │   ├── CategoryTitle.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Line/
│   │   │   │   ├── Line.module.scss
│   │   │   │   ├── Line.tsx
│   │   │   │   └── index.ts
│   │   │   ├── PlayerCard/
│   │   │   │   ├── GoalieCard.tsx
│   │   │   │   ├── PlayerCard.module.scss
│   │   │   │   ├── SkaterCard.tsx
│   │   │   │   └── index.ts
│   │   │   ├── __test__/
│   │   │   │   ├── LineCombinationsData.ts
│   │   │   │   └── utilities.test.ts
│   │   │   ├── LineCombinationsGrid.tsx
│   │   │   └── utilities.ts
│   │   ├── LinemateMatrix/
│   │   │   ├── index.module.scss
│   │   │   ├── index.tsx
│   │   │   └── utilities.ts
│   │   ├── LogoMaker/
│   │   │   ├── logoMaker.module.scss
│   │   │   └── logoMaker.tsx
│   │   ├── MetricsTimeline/
│   │   │   ├── MetricsTimeline.module.scss
│   │   │   └── MetricsTimeline.tsx
│   │   ├── Options/
│   │   │   ├── Options.module.scss
│   │   │   ├── Options.tsx
│   │   │   └── index.ts
│   │   ├── PageTitle/
│   │   │   ├── PageTitle.module.scss
│   │   │   ├── PageTitle.tsx
│   │   │   └── index.ts
│   │   ├── PlayerAutocomplete/
│   │   │   ├── PlayerAutocomplete.module.scss
│   │   │   ├── PlayerAutocomplete.tsx
│   │   │   └── index.ts
│   │   ├── PlayerBioCard/
│   │   │   ├── PlayerBioCard.module.scss
│   │   │   ├── PlayerBioCard.tsx
│   │   │   └── index.ts
│   │   ├── PlayerPPTOIPerGameChart/
│   │   │   ├── PPTOIChart.tsx
│   │   │   └── PlayerPPTOIPerGameChart.tsx
│   │   ├── PlayerPickupTable/
│   │   │   ├── PlayerPickupTable.module.scss
│   │   │   └── PlayerPickupTable.tsx
│   │   ├── PlayerStats/
│   │   │   ├── PlayerAdvancedStats.tsx
│   │   │   ├── PlayerContextualStats.tsx
│   │   │   ├── PlayerPerformanceHeatmap.tsx
│   │   │   ├── PlayerRadarChart.tsx
│   │   │   ├── PlayerStats.module.scss
│   │   │   ├── PlayerStatsAdvancedNote.tsx
│   │   │   ├── PlayerStatsChart.tsx
│   │   │   ├── PlayerStatsSummary.tsx
│   │   │   ├── PlayerStatsTable.tsx
│   │   │   └── types.ts
│   │   ├── Projections/
│   │   │   ├── PlayerMatchupWeekPerformanceChart.tsx
│   │   │   ├── ProjectionSourceAnalysis.module.scss
│   │   │   ├── ProjectionSourceAnalysis.tsx
│   │   │   └── RoundPerformanceBoxPlotChart.tsx
│   │   ├── RadioOptions/
│   │   │   ├── RadioOptions.module.scss
│   │   │   ├── RadioOptions.tsx
│   │   │   └── index.ts
│   │   ├── RecentPosts/
│   │   │   ├── RecentPosts.module.scss
│   │   │   ├── RecentPosts.tsx
│   │   │   └── index.ts
│   │   ├── RosterMatrix/
│   │   │   ├── RosterMatrix.module.scss
│   │   │   ├── RosterMatrix.tsx
│   │   │   └── RosterMatrixWrapper.tsx
│   │   ├── Select/
│   │   │   ├── Select.module.scss
│   │   │   ├── Select.tsx
│   │   │   └── index.ts
│   │   ├── ShiftChart/
│   │   │   └── PowerPlayAreaIndicators/
│   │   │       └── index.tsx
│   │   ├── ShotVisualization/
│   │   │   └── ShotVisualization.tsx
│   │   ├── SkoLineChart/
│   │   │   └── LineChart.tsx
│   │   ├── SocialMedias/
│   │   │   ├── SocialMedias.module.scss
│   │   │   ├── SocialMedias.tsx
│   │   │   └── index.ts
│   │   ├── Spinner/
│   │   │   ├── Spinner.module.scss
│   │   │   ├── Spinner.tsx
│   │   │   └── index.ts
│   │   ├── StatsPage/
│   │   │   ├── LeaderboardCategory.tsx
│   │   │   ├── LeaderboardCategoryBSH.tsx
│   │   │   ├── LeaderboardCategoryGoalie.tsx
│   │   │   ├── MobileTeamList.module.scss
│   │   │   ├── MobileTeamList.tsx
│   │   │   ├── PlayerSearchBar.tsx
│   │   │   └── Segment.tsx
│   │   ├── SustainabilityVSCareerChart/
│   │   │   ├── SustainabilityVSCareerChart.module.scss
│   │   │   ├── SustainabilityVSCareerChart.tsx
│   │   │   └── index.ts
│   │   ├── TeamDashboard/
│   │   │   ├── AdvancedL10Metrics.module.scss
│   │   │   ├── AdvancedL10Metrics.tsx
│   │   │   ├── GameByGameTimeline.module.scss
│   │   │   ├── GameByGameTimeline.tsx
│   │   │   ├── TeamDashboard.module.scss
│   │   │   ├── TeamDashboard.tsx
│   │   │   └── TeamLeaders.tsx
│   │   ├── TeamDropdown/
│   │   │   ├── TeamDropdown.module.scss
│   │   │   ├── TeamDropdown.tsx
│   │   │   └── index.ts
│   │   ├── TeamLandingPage/
│   │   │   ├── utils/
│   │   │   │   └── teamsInfo.ts
│   │   │   ├── DoughnutChart.js
│   │   │   ├── GoalieWorkloadBars.js
│   │   │   ├── StrengthOfSchedule.tsx
│   │   │   ├── goalieTrends.js
│   │   │   ├── teamLandingPage.css
│   │   │   ├── teamLandingPage.scss
│   │   │   ├── teamStats.js
│   │   │   └── teamStats.scss
│   │   ├── TeamScheduleCalendar/
│   │   │   ├── TeamScheduleCalendar.module.scss
│   │   │   ├── TeamScheduleCalendar.tsx
│   │   │   └── index.ts
│   │   ├── TeamSelect/
│   │   │   ├── TeamSelect.module.scss
│   │   │   ├── TeamSelect.tsx
│   │   │   └── index.ts
│   │   ├── TeamStandingsChart/
│   │   │   ├── TeamStandingsChart.module.scss
│   │   │   └── TeamStandingsChart.tsx
│   │   ├── TeamStatCard/
│   │   │   ├── TeamStatCard.module.scss
│   │   │   ├── TeamStatCard.tsx
│   │   │   └── index.ts
│   │   ├── TeamTabNavigation/
│   │   │   ├── TeamTabNavigation.module.scss
│   │   │   └── TeamTabNavigation.tsx
│   │   ├── TimeAgo/
│   │   │   ├── TimeAgo.tsx
│   │   │   └── index.ts
│   │   ├── TimeOnIceChart/
│   │   │   ├── TimeOnIceChart.module.scss
│   │   │   ├── TimeOnIceChart.tsx
│   │   │   └── index.ts
│   │   ├── TimeOptions/
│   │   │   ├── TimeOptions.tsx
│   │   │   └── index.ts
│   │   ├── Tooltip/
│   │   │   ├── Tooltip.module.scss
│   │   │   ├── Tooltip.tsx
│   │   │   └── index.ts
│   │   ├── WiGO/
│   │   │   ├── GameScoreLineChart/
│   │   │   │   ├── RollingAverageChart.tsx
│   │   │   │   └── index.tsx
│   │   │   ├── ConsistencyChart.tsx
│   │   │   ├── GameScoreSection.tsx
│   │   │   ├── NameSearchBar.module.scss
│   │   │   ├── NameSearchBar.tsx
│   │   │   ├── OpponentGameLog.module.scss
│   │   │   ├── OpponentGamelog.tsx
│   │   │   ├── PerGameStatsTable.module.scss
│   │   │   ├── PerGameStatsTable.tsx
│   │   │   ├── PlayerHeader.tsx
│   │   │   ├── PlayerRatingsDisplay.module.scss
│   │   │   ├── PlayerRatingsDisplay.tsx
│   │   │   ├── PpgLineChart.tsx
│   │   │   ├── RateStatPercentiles.tsx
│   │   │   ├── StatsTable.tsx
│   │   │   ├── StatsTableRowChart.tsx
│   │   │   ├── TeamNameSVG.tsx
│   │   │   ├── TimeframeComparison.module.scss
│   │   │   ├── TimeframeComparison.tsx
│   │   │   ├── ToiLineChart.tsx
│   │   │   ├── WigoDoughnutChart.js
│   │   │   ├── WigoLineChart.js
│   │   │   ├── fetchThreeYearAverages.ts
│   │   │   ├── ratingWeights.ts
│   │   │   ├── ratingsConstants.ts
│   │   │   ├── tableUtils.ts
│   │   │   ├── types.ts
│   │   │   ├── wgoRadarChart.js
│   │   │   └── wigoCharts.module.scss
│   │   ├── common/
│   │   │   ├── OptimizedImage.tsx
│   │   │   ├── PanelStatus.module.scss
│   │   │   └── PanelStatus.tsx
│   │   ├── GamePoissonChart.module.scss
│   │   └── PoissonDistributionChart.jsx
│   ├── contexts/
│   │   ├── AuthProviderContext/
│   │   │   └── index.tsx
│   │   ├── TeamColorContext/
│   │   │   ├── TEAM_COLORS.ts
│   │   │   └── index.tsx
│   │   └── RoundSummaryContext.tsx
│   ├── hooks/
│   │   ├── useCareerAveragesStats.ts
│   │   ├── useCurrentSeason.ts
│   │   ├── useDebounce.ts
│   │   ├── useGoals.tsx
│   │   ├── useHideableNavbar.ts
│   │   ├── useMissedGames.ts
│   │   ├── useOffseason.ts
│   │   ├── usePercentileRank.ts
│   │   ├── usePlayer.ts
│   │   ├── usePlayerMatchupWeekStats.ts
│   │   ├── usePlayerRecommendations.ts
│   │   ├── usePlayerStats.ts
│   │   ├── usePlayerWeeklyStats.ts
│   │   ├── usePlayers.ts
│   │   ├── useProcessedProjectionsData.tsx
│   │   ├── useProjectionSourceAnalysis.ts
│   │   ├── useResizeObserver.ts
│   │   ├── useScreenSize.ts
│   │   ├── useShotData.ts
│   │   ├── useSustainabilityStats.ts
│   │   ├── useTeamAbbreviation.ts
│   │   ├── useTeamSchedule.ts
│   │   ├── useTeamStats.ts
│   │   ├── useTeamStatsFromDb.ts
│   │   ├── useTeamSummary.ts
│   │   ├── useTeams.ts
│   │   ├── useVORPCalculations.ts
│   │   └── useWGOPlayerStats.ts
│   ├── lib/
│   │   ├── NHL/
│   │   │   ├── client/
│   │   │   │   └── index.ts
│   │   │   ├── server/
│   │   │   │   └── index.ts
│   │   │   ├── utils/
│   │   │   │   └── utils.ts
│   │   │   ├── NHL_API.ts
│   │   │   ├── TOI.ts
│   │   │   ├── base.ts
│   │   │   ├── statsPageFetch.ts
│   │   │   ├── statsPageTypes.ts
│   │   │   ├── teamPageTypes.ts
│   │   │   ├── teamsInfo.js
│   │   │   └── types.ts
│   │   ├── google/
│   │   │   └── sheets.ts
│   │   ├── mappers/
│   │   │   └── yahooPlayersToSheet.ts
│   │   ├── projectionsConfig/
│   │   │   ├── fantasyPointsConfig.ts
│   │   │   ├── formatToMMSS.ts
│   │   │   ├── formatTotalSecondsToMMSS.ts
│   │   │   ├── projectionSourcesConfig.ts
│   │   │   ├── projectionTableStructure.md
│   │   │   ├── statsMasterList.ts
│   │   │   └── yahooConfig.ts
│   │   ├── sanity/
│   │   │   ├── config.js
│   │   │   ├── sanity.js
│   │   │   └── sanity.server.js
│   │   ├── standardization/
│   │   │   ├── columnStandardization.ts
│   │   │   └── nameStandardization.ts
│   │   ├── supabase/
│   │   │   ├── GoaliePage/
│   │   │   │   ├── calculateAverages.ts
│   │   │   │   ├── calculateGoalieRanking.ts
│   │   │   │   ├── calculateRanking.ts
│   │   │   │   ├── fetchAllGoalies.ts
│   │   │   │   ├── fetchGoalieDataForWeek.js
│   │   │   │   ├── goaliePageWeeks.js
│   │   │   │   ├── types.ts
│   │   │   │   ├── updateWeeklyData.ts
│   │   │   │   └── upsertGoalieData.js
│   │   │   ├── Upserts/
│   │   │   │   ├── Yahoo/
│   │   │   │   │   ├── name_mapping_todo.json
│   │   │   │   │   ├── player_name_normalization_spec.json
│   │   │   │   │   ├── populate_yahoo_nhl_mapping.py
│   │   │   │   │   ├── reverse_only_matches.json
│   │   │   │   │   ├── unmatched_yahoo_nhl_mapping.json
│   │   │   │   │   ├── unmatched_yahoo_to_nhl_mapping.json
│   │   │   │   │   ├── yahoo-tables.md
│   │   │   │   │   ├── yahooAPI.py
│   │   │   │   │   ├── yahooAPIgameIds.py
│   │   │   │   │   ├── yahooApiPlayerKeys.py
│   │   │   │   │   └── yahooHistoricalOwnership.py
│   │   │   │   ├── yahooAuth/
│   │   │   │   │   └── token.json
│   │   │   │   ├── fetchPPTOIdata.js
│   │   │   │   ├── fetchPbP.ts
│   │   │   │   ├── fetchPowerRankings.js
│   │   │   │   ├── fetchRollingGames.js
│   │   │   │   ├── fetchSKOskaterStats.js
│   │   │   │   ├── fetchSKOyears.js
│   │   │   │   ├── fetchSoSgameLog.js
│   │   │   │   ├── fetchStandings.js
│   │   │   │   ├── fetchWGOdata.d.ts
│   │   │   │   ├── fetchWGOdata.js
│   │   │   │   ├── fetchWGOgoalieData.js
│   │   │   │   ├── fetchWGOgoalieStats.js
│   │   │   │   ├── fetchWGOskaterStats.js
│   │   │   │   └── supabaseShifts.js
│   │   │   ├── utils/
│   │   │   │   ├── calculations.ts
│   │   │   │   ├── constants.ts
│   │   │   │   ├── dataFetching.ts
│   │   │   │   ├── fetchAllGoalies.ts
│   │   │   │   ├── fetchAllSkaters.ts
│   │   │   │   ├── statistics.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── updateAllGoalies.ts
│   │   │   ├── client.ts
│   │   │   ├── database-generated.types.ts
│   │   │   ├── index.ts
│   │   │   ├── server.ts
│   │   │   ├── shotsByCoord.js
│   │   │   ├── signInWithGitHub.ts
│   │   │   ├── sosStandings.js
│   │   │   ├── sosStandings.log
│   │   │   ├── test.json
│   │   │   └── yahooUniformNumbers.py
│   │   ├── sync/
│   │   │   └── syncYahooPlayersToSheet.ts
│   │   ├── apollo-client.js
│   │   ├── cors-fetch.ts
│   │   ├── drawHockeyRink.ts
│   │   ├── fetchWithCache.ts
│   │   ├── getTimes.ts
│   │   ├── images.ts
│   │   └── teamsInfo.ts
│   ├── pages/
│   │   ├── api/
│   │   │   ├── Averages/
│   │   │   │   ├── [playerId].ts
│   │   │   │   ├── helpers.ts
│   │   │   │   ├── statsService.ts
│   │   │   │   └── types.ts
│   │   │   ├── CareerAverages/
│   │   │   │   └── [playerId].ts
│   │   │   ├── SustainabilityStats/
│   │   │   │   └── [playerId].ts
│   │   │   ├── Teams/
│   │   │   │   ├── [teamAbbreviation].ts
│   │   │   │   └── nst-team-stats.ts
│   │   │   ├── ThreeYearAverages/
│   │   │   │   ├── [playerId].ts
│   │   │   │   ├── nstgamelog.py
│   │   │   │   └── nsttest.py
│   │   │   ├── WGOAverages/
│   │   │   │   ├── calculateAverages.js
│   │   │   │   └── calculateAverages.ts
│   │   │   ├── cors/
│   │   │   │   └── index.ts
│   │   │   ├── internal/
│   │   │   │   └── sync-yahoo-players-to-sheet.ts
│   │   │   ├── v1/
│   │   │   │   ├── db/
│   │   │   │   │   ├── cron/
│   │   │   │   │   │   └── update-stats-cron.ts
│   │   │   │   │   ├── update-expected-goals/
│   │   │   │   │   │   ├── calculations.ts
│   │   │   │   │   │   ├── fetchData.ts
│   │   │   │   │   │   ├── index.ts
│   │   │   │   │   │   └── utils.ts
│   │   │   │   │   ├── update-line-combinations/
│   │   │   │   │   │   ├── [id].ts
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── update-player/
│   │   │   │   │   │   └── [playerId].ts
│   │   │   │   │   ├── update-power-play-combinations/
│   │   │   │   │   │   └── [gameId].ts
│   │   │   │   │   ├── update-standings-details/
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   ├── update-stats/
│   │   │   │   │   │   └── [gameId].ts
│   │   │   │   │   ├── calculate-wigo-stats.ts
│   │   │   │   │   ├── check-missing-goalie-data.ts
│   │   │   │   │   ├── cron-report.ts
│   │   │   │   │   ├── manual-refresh-yahoo-token.ts
│   │   │   │   │   ├── nst_gamelog_goalie_scraper.py
│   │   │   │   │   ├── nst_gamelog_scraper.py
│   │   │   │   │   ├── powerPlayTimeFrame.ts
│   │   │   │   │   ├── run-fetch-wgo-data.ts
│   │   │   │   │   ├── shift-charts.ts
│   │   │   │   │   ├── skaterArray.ts
│   │   │   │   │   ├── update-PbP.ts
│   │   │   │   │   ├── update-games.ts
│   │   │   │   │   ├── update-last-7-14-30.ts
│   │   │   │   │   ├── update-nst-current-season.ts
│   │   │   │   │   ├── update-nst-gamelog.ts
│   │   │   │   │   ├── update-nst-goalies.ts
│   │   │   │   │   ├── update-nst-last-ten.ts
│   │   │   │   │   ├── update-nst-player-reports.ts
│   │   │   │   │   ├── update-players.ts
│   │   │   │   │   ├── update-power-rankings.ts
│   │   │   │   │   ├── update-rolling-games.ts
│   │   │   │   │   ├── update-season-stats.ts
│   │   │   │   │   ├── update-seasons.ts
│   │   │   │   │   ├── update-sko-stats.ts
│   │   │   │   │   ├── update-team-yearly-summary.ts
│   │   │   │   │   ├── update-teams.ts
│   │   │   │   │   ├── update-wgo-averages.ts
│   │   │   │   │   ├── update-wgo-goalie-totals.ts
│   │   │   │   │   ├── update-wgo-goalies.ts
│   │   │   │   │   ├── update-wgo-ly.ts
│   │   │   │   │   ├── update-wgo-skaters.ts
│   │   │   │   │   ├── update-wgo-totals.ts
│   │   │   │   │   ├── update-yahoo-players.ts
│   │   │   │   │   ├── update-yahoo-weeks.ts
│   │   │   │   │   └── upsert-csv.ts
│   │   │   │   ├── discord/
│   │   │   │   │   └── send-message/
│   │   │   │   │       └── line-combo/
│   │   │   │   │           └── [gameId].ts
│   │   │   │   ├── game/
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── boxscore/
│   │   │   │   │           └── index.ts
│   │   │   │   ├── games/
│   │   │   │   │   └── index.js
│   │   │   │   ├── ml/
│   │   │   │   │   └── create-materialized-view.ts
│   │   │   │   ├── player/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── game-log/
│   │   │   │   │   │   │   └── [season]/
│   │   │   │   │   │   │       └── [type]/
│   │   │   │   │   │   │           └── index.ts
│   │   │   │   │   │   ├── percentile-rank/
│   │   │   │   │   │   │   └── index.ts
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── schedule/
│   │   │   │   │   └── [startDate].ts
│   │   │   │   ├── team/
│   │   │   │   │   └── [seasonId]/
│   │   │   │   │       └── index.ts
│   │   │   │   ├── webhooks/
│   │   │   │   │   ├── docker-compose.yaml
│   │   │   │   │   └── on-new-line-combo.ts
│   │   │   │   └── season.ts
│   │   │   ├── _types.ts
│   │   │   ├── createComment.ts
│   │   │   ├── db.md
│   │   │   └── toi.ts
│   │   ├── auth/
│   │   │   ├── Auth.module.scss
│   │   │   └── index.tsx
│   │   ├── blog/
│   │   │   ├── [slug].tsx
│   │   │   └── index.tsx
│   │   ├── db/
│   │   │   ├── index.tsx
│   │   │   └── upsert-projections.tsx
│   │   ├── game/
│   │   │   ├── GamePage.scss
│   │   │   ├── [gameId].tsx
│   │   │   └── modularization of the game page.md
│   │   ├── game-grid/
│   │   │   ├── [mode].tsx
│   │   │   └── index.tsx
│   │   ├── lines/
│   │   │   ├── line-combo/
│   │   │   │   └── [gameId].tsx
│   │   │   ├── [abbreviation].module.scss
│   │   │   ├── [abbreviation].tsx
│   │   │   └── index.tsx
│   │   ├── projections/
│   │   │   └── index.tsx
│   │   ├── stats/
│   │   │   ├── game/
│   │   │   │   └── [gameId].tsx
│   │   │   ├── player/
│   │   │   │   └── [playerId].tsx
│   │   │   ├── team/
│   │   │   │   └── [teamAbbreviation].tsx
│   │   │   └── index.tsx
│   │   ├── teamStats/
│   │   │   └── [teamAbbreviation].tsx
│   │   ├── test/
│   │   │   └── index.tsx
│   │   ├── 404.tsx
│   │   ├── FantasyPowerRankings.js
│   │   ├── PowerRankings.js
│   │   ├── _app.tsx
│   │   ├── _document.tsx
│   │   ├── buyLowSellHigh.js
│   │   ├── charts.tsx
│   │   ├── draft-dashboard.tsx
│   │   ├── drm.tsx
│   │   ├── goalies.js
│   │   ├── index.tsx
│   │   ├── podfeed.tsx
│   │   ├── requirements.txt
│   │   ├── shiftChart.js
│   │   ├── skoCharts.tsx
│   │   ├── statsPlaceholder.tsx
│   │   ├── sustainabilityTool.module.scss
│   │   ├── teamStats.tsx
│   │   ├── testLogoMaker.tsx
│   │   ├── trueGoalieValue.tsx
│   │   ├── wigoCharts.tsx
│   │   └── xGoalsPage.tsx
│   ├── public/
│   │   ├── pictures/
│   │   │   ├── socials/
│   │   │   │   ├── discord.png
│   │   │   │   ├── patreon.png
│   │   │   │   ├── spotify.png
│   │   │   │   ├── twitter.png
│   │   │   │   └── youtube.png
│   │   │   ├── FHFH Thumbnails YT.zip - 12.png
│   │   │   ├── FHFHTRAIN.png
│   │   │   ├── FHFHTRAINONCE.png
│   │   │   ├── FHFHonly.png
│   │   │   ├── IconSearch.png
│   │   │   ├── NHL_Hockey_Rink.svg
│   │   │   ├── arrow-down-red.png
│   │   │   ├── arrow-down-white.png
│   │   │   ├── arrow-right-green.png
│   │   │   ├── arrow-right-red.png
│   │   │   ├── arrow-up-green.png
│   │   │   ├── arrow.svg
│   │   │   ├── awayIcon.png
│   │   │   ├── blogIcon.png
│   │   │   ├── burgerMenu.svg
│   │   │   ├── circle.png
│   │   │   ├── close.svg
│   │   │   ├── discord.png
│   │   │   ├── download.svg
│   │   │   ├── drmIcon.png
│   │   │   ├── expand-icon.png
│   │   │   ├── expectedGoals.png
│   │   │   ├── fhfh-gpt-3.png
│   │   │   ├── fhfh-gpt-4.png
│   │   │   ├── fhfh-gpt-6.png
│   │   │   ├── fhfh-gpt-x.png
│   │   │   ├── fhfh-gpt.png
│   │   │   ├── fhfh-italic-2.png
│   │   │   ├── fhfh-italic-3.png
│   │   │   ├── fhfh-italic.png
│   │   │   ├── fhfh_gpt.png
│   │   │   ├── gameGrid.png
│   │   │   ├── gamesTable.png
│   │   │   ├── gpt.png
│   │   │   ├── green-arrow-up.svg
│   │   │   ├── hamburgerMenu.png
│   │   │   ├── heart-filled.png
│   │   │   ├── heart-outlined.svg
│   │   │   ├── homeIcon.png
│   │   │   ├── homeNavIcon.png
│   │   │   ├── injured.png
│   │   │   ├── lineCombosIcon.png
│   │   │   ├── linesTable.png
│   │   │   ├── logo-fhfh.svg
│   │   │   ├── logo.png
│   │   │   ├── logo2.png
│   │   │   ├── logo3.png
│   │   │   ├── menu-arrow-drop-down.svg
│   │   │   ├── navRibbon.png
│   │   │   ├── navRibbon.svg
│   │   │   ├── nstTables.png
│   │   │   ├── player-placeholder.jpg
│   │   │   ├── playersTable.png
│   │   │   ├── podcastIcon.png
│   │   │   ├── ppTimeframes.png
│   │   │   ├── red-arrow-down.png
│   │   │   ├── seasonsTable.png
│   │   │   ├── share-button.svg
│   │   │   ├── share.svg
│   │   │   ├── shiftChartsIcon.png
│   │   │   ├── shiftsTable.png
│   │   │   ├── statsIcon.png
│   │   │   ├── statsTable.png
│   │   │   ├── teamsTable.png
│   │   │   ├── utah-mammoth-logo-png_seeklogo-618353.png
│   │   │   └── wigoIcon.png
│   │   ├── teamCardPics/
│   │   │   ├── ANA.jpg
│   │   │   ├── ARI.jpg
│   │   │   ├── BOS.jpg
│   │   │   ├── BUF.jpg
│   │   │   ├── CAR.jpg
│   │   │   ├── CBJ.jpg
│   │   │   ├── CGY.jpg
│   │   │   ├── CHI.jpg
│   │   │   ├── COL.jpg
│   │   │   ├── DAL.jpg
│   │   │   ├── DET.jpg
│   │   │   ├── EDM.jpg
│   │   │   ├── FLA.jpg
│   │   │   ├── LAK.jpg
│   │   │   ├── MIN.jpg
│   │   │   ├── MTL.jpg
│   │   │   ├── NJD.jpg
│   │   │   ├── NYI.jpg
│   │   │   ├── NYR.jpg
│   │   │   ├── OTT.jpg
│   │   │   ├── PHI.jpg
│   │   │   ├── PIT.jpg
│   │   │   ├── SEA.jpg
│   │   │   ├── SJS.jpg
│   │   │   ├── STL.jpg
│   │   │   ├── TBL.jpg
│   │   │   ├── TOR.jpg
│   │   │   ├── VAN.jpg
│   │   │   ├── VGK.jpg
│   │   │   ├── WPG.jpg
│   │   │   ├── WSH.jpg
│   │   │   └── nsh.jpg
│   │   ├── teamLogos/
│   │   │   ├── ANA.png
│   │   │   ├── ARI.png
│   │   │   ├── BOS.png
│   │   │   ├── BUF.png
│   │   │   ├── CAR.png
│   │   │   ├── CBJ.png
│   │   │   ├── CGY.png
│   │   │   ├── CHI.png
│   │   │   ├── COL.png
│   │   │   ├── DAL.png
│   │   │   ├── DET.png
│   │   │   ├── EDM.png
│   │   │   ├── FHFH.png
│   │   │   ├── FLA.png
│   │   │   ├── Five Hole.png
│   │   │   ├── LAK.png
│   │   │   ├── MIN.png
│   │   │   ├── MTL.png
│   │   │   ├── NJD.png
│   │   │   ├── NSH.png
│   │   │   ├── NYI.png
│   │   │   ├── NYR.png
│   │   │   ├── OTT.png
│   │   │   ├── PHI.png
│   │   │   ├── PIT.png
│   │   │   ├── SEA.png
│   │   │   ├── SJS.png
│   │   │   ├── STL.png
│   │   │   ├── TBL.png
│   │   │   ├── TOR.png
│   │   │   ├── UTA.png
│   │   │   ├── VAN.png
│   │   │   ├── VGK.png
│   │   │   ├── WPG.png
│   │   │   ├── WSH.png
│   │   │   ├── bedard.png
│   │   │   ├── fhfhGoldMedal.png
│   │   │   └── image.png
│   │   ├── android-chrome-192x192.png
│   │   ├── android-chrome-512x512.png
│   │   ├── apple-touch-icon.png
│   │   ├── favicon-16x16.png
│   │   ├── favicon-32x32.png
│   │   ├── favicon.ico
│   │   ├── fhfh-favicon-16x16.png
│   │   ├── fhfh-favicon-32x32.png
│   │   └── site.webmanifest
│   ├── rules/
│   │   ├── create-prd.mdc
│   │   ├── generate-tasks.mdc
│   │   ├── process-task-list.mdc
│   │   └── supabase-table-structure.mdc
│   ├── scripts/
│   │   ├── fantasy_points_analysis.py
│   │   ├── fetch_team_table.py
│   │   ├── goals_correlation_analysis.py
│   │   ├── performance_prediction.py
│   │   └── requirements.txt
│   ├── stories/
│   │   ├── WiGO/
│   │   │   └── GameScoreLineChart.stories.tsx
│   │   ├── assets/
│   │   │   ├── accessibility.png
│   │   │   ├── accessibility.svg
│   │   │   ├── addon-library.png
│   │   │   ├── assets.png
│   │   │   ├── avif-test-image.avif
│   │   │   ├── context.png
│   │   │   ├── discord.svg
│   │   │   ├── docs.png
│   │   │   ├── figma-plugin.png
│   │   │   ├── github.svg
│   │   │   ├── share.png
│   │   │   ├── styling.png
│   │   │   ├── testing.png
│   │   │   ├── theming.png
│   │   │   ├── tutorials.svg
│   │   │   └── youtube.svg
│   │   ├── Button.stories.ts
│   │   ├── Button.tsx
│   │   ├── Configure.mdx
│   │   ├── Header.stories.ts
│   │   ├── Header.tsx
│   │   ├── Page.stories.ts
│   │   ├── Page.tsx
│   │   ├── button.css
│   │   ├── header.css
│   │   └── page.css
│   ├── styles/
│   │   ├── BLSH.module.scss
│   │   ├── Blog.module.scss
│   │   ├── Charts.module.scss
│   │   ├── GoalieTrends.module.scss
│   │   ├── GoalieWorkloadBars.module.scss
│   │   ├── Goalies.module.scss
│   │   ├── Home.module.scss
│   │   ├── LinePairGrid.module.scss
│   │   ├── Lines.module.scss
│   │   ├── PPTOIChart.module.scss
│   │   ├── Podfeed.module.scss
│   │   ├── PoissonHeatmap.module.scss
│   │   ├── Post.module.scss
│   │   ├── ProjectionsPage.module.scss
│   │   ├── ShiftChart.module.scss
│   │   ├── Stats.module.scss
│   │   ├── TeamStatsPage.module.scss
│   │   ├── _panel.scss
│   │   ├── globals.css
│   │   ├── mixins.scss
│   │   ├── pdhcTooltip.module.scss
│   │   ├── teamStats.module.scss
│   │   ├── useGoals.module.scss
│   │   ├── vars.scss
│   │   ├── wigoCharts.module.scss
│   │   └── wigoColors.ts
│   ├── utils/
│   │   ├── stats/
│   │   │   ├── formatters.ts
│   │   │   └── nhlStatsFetch.ts
│   │   ├── adminOnlyMiddleware.ts
│   │   ├── analytics.ts
│   │   ├── calculatePercentiles.ts
│   │   ├── calculateWigoRatings.ts
│   │   ├── dateUtils.ts
│   │   ├── debounce.ts
│   │   ├── extractPPDetails.ts
│   │   ├── fetchAllPages.ts
│   │   ├── fetchAllRows.ts
│   │   ├── fetchCurrentSeason.ts
│   │   ├── fetchCurrentseason.js
│   │   ├── fetchScheduleData.ts
│   │   ├── fetchWigoPercentiles.ts
│   │   ├── fetchWigoPlayerStats.ts
│   │   ├── fetchWigoRatingStats.ts
│   │   ├── formatDate.ts
│   │   ├── formattingUtils.ts
│   │   ├── getPowerPlayBlocks.ts
│   │   ├── groupBy.ts
│   │   ├── memoize.ts
│   │   ├── projectionsRanking.ts
│   │   ├── scrollTop.ts
│   │   ├── setDifference.ts
│   │   └── tierUtils.ts
│   ├── .env.development
│   ├── .env.production
│   ├── .env.test
│   ├── .eslintrc.json
│   ├── .nvmrc
│   ├── README.md
│   ├── next-env.d.ts
│   ├── next-seo.config.js
│   ├── next-sitemap.config.js
│   ├── next.config.js
│   ├── npm
│   ├── package-lock.json
│   ├── package.json
│   ├── tmp-run-sync.ts
│   ├── tmp-test-sheets.mjs
│   ├── tsconfig.json
│   ├── vercel.json
│   ├── vitest.config.mts
│   └── yahoo-fantasy.d.ts
├── webhooks/
│   ├── README.md
│   ├── app.js
│   ├── package-lock.json
│   └── package.json
├── .gitignore
├── README.md
├── draft-dashbord-audit.md
├── prd-yahoo-audit.md
└── yahoo_historical.log
```

## Files

- .gitignore
- .playwright-mcp/page-2025-08-25T23-26-10-385Z.png
- .playwright-mcp/page-2025-08-27T03-18-57-834Z.png
- .vscode/extensions.json
- .vscode/fhfhockey.com.code-workspace
- .vscode/mcp_config.json
- .vscode/settings.json
- README.md
- cms/.env.development
- cms/.eslintrc
- cms/.npmignore
- cms/.sanity/runtime/app.js
- cms/.sanity/runtime/index.html
- cms/README.md
- cms/config/.checksums
- cms/config/@sanity/data-aspects.json
- cms/config/@sanity/default-layout.json
- cms/config/@sanity/default-login.json
- cms/config/@sanity/form-builder.json
- cms/config/@sanity/vision.json
- cms/package.json
- cms/plugins/.gitkeep
- cms/plugins/cms-studio-logo/Logo.tsx
- cms/plugins/cms-studio-logo/logo.png
- cms/plugins/cms-studio-logo/sanity.json
- cms/sanity.cli.js
- cms/sanity.config.js
- cms/sanity.json
- cms/schemas/author.js
- cms/schemas/blockContent.js
- cms/schemas/category.js
- cms/schemas/comment.js
- cms/schemas/post.js
- cms/schemas/schema.js
- cms/static/.gitkeep
- cms/static/favicon.ico
- cms/tsconfig.json
- cms/vercel.json
- draft-dashbord-audit.md
- functions/.gitignore
- functions/README.md
- functions/api/fetch_team_table.py
- functions/api/index.py
- functions/package.json
- functions/requirements.txt
- functions/vercel.json
- migrations/20250827_yahoo_upsert_and_mapping.sql
- prd-yahoo-audit.md
- tasks/prd-cleanup-tasks.md
- tasks/prd-draft-dashboard.md
- tasks/prd-file-inventory.md
- tasks/prd-mobile-stats-page-optimization.md
- tasks/tasks-prd-mobile-stats-page-optimization.md
- tools/gen_tree.py
- web/.env.development
- web/.env.production
- web/.env.test
- web/.eslintrc.json
- web/.nvmrc
- web/.storybook/main.ts
- web/.storybook/preview.ts
- web/.vscode/launch.json
- web/.vscode/settings.json
- web/README.md
- web/__tests__/LinemateMatrix/LineCombinationData.js
- web/__tests__/LinemateMatrix/shiftcharts-2023020850.json
- web/__tests__/index.test.tsx
- web/__tests__/vitest.setup.js
- web/components/Banner/Banner.module.scss
- web/components/Banner/Banner.tsx
- web/components/Banner/index.ts
- web/components/BlogPost/BlogPost.module.scss
- web/components/BlogPost/BlogPost.tsx
- web/components/BlogPost/index.ts
- web/components/CategoryCoverageChart/CategoryCoverageChart.module.scss
- web/components/CategoryCoverageChart/CategoryCoverageChart.tsx
- web/components/CategoryCoverageChart/index.ts
- web/components/Chart/Chart.module.scss
- web/components/Chart/Chart.tsx
- web/components/Chart/index.ts
- web/components/ChartTitle/ChartTitle.module.scss
- web/components/ChartTitle/ChartTitle.tsx
- web/components/ChartTitle/index.ts
- web/components/ClientOnly/ClientOnly.tsx
- web/components/ClientOnly/index.ts
- web/components/CommentForm/CommentForm.module.scss
- web/components/CommentForm/CommentForm.tsx
- web/components/CommentForm/index.ts
- web/components/Comments/Comments.module.scss
- web/components/Comments/Comments.tsx
- web/components/Comments/index.ts
- web/components/CronReportEmail/CronAuditEmail.tsx
- web/components/CronReportEmail/CronReportEmail.tsx
- web/components/DateRangeMatrix/DateRangeMatrixForGames.tsx
- web/components/DateRangeMatrix/GoalieCardDRM.tsx
- web/components/DateRangeMatrix/LinePairGrid.tsx
- web/components/DateRangeMatrix/PlayerCardDRM.tsx
- web/components/DateRangeMatrix/TeamDropdown.tsx
- web/components/DateRangeMatrix/drm.module.scss
- web/components/DateRangeMatrix/fetchAggregatedData.ts
- web/components/DateRangeMatrix/index.module.scss
- web/components/DateRangeMatrix/index.tsx
- web/components/DateRangeMatrix/lineCombinationHelper.ts
- web/components/DateRangeMatrix/useTOIData.tsx
- web/components/DateRangeMatrix/utilities.ts
- web/components/DraftDashboard/DraftBoard.module.scss
- web/components/DraftDashboard/DraftBoard.tsx
- web/components/DraftDashboard/DraftDashboard.module.scss
- web/components/DraftDashboard/DraftDashboard.tsx
- web/components/DraftDashboard/DraftSettings.module.scss
- web/components/DraftDashboard/DraftSettings.tsx
- web/components/DraftDashboard/DraftSummaryModal.module.scss
- web/components/DraftDashboard/DraftSummaryModal.tsx
- web/components/DraftDashboard/ImportCsvModal.tsx
- web/components/DraftDashboard/MyRoster.module.scss
- web/components/DraftDashboard/MyRoster.tsx
- web/components/DraftDashboard/ProjectionsTable.module.scss
- web/components/DraftDashboard/ProjectionsTable.tsx
- web/components/DraftDashboard/SuggestedPicks.module.scss
- web/components/DraftDashboard/SuggestedPicks.tsx
- web/components/DraftDashboard/TeamRosterSelect.tsx
- web/components/DraftDashboard/Untitled-1.html
- web/components/GameGrid/GameGrid.module.scss
- web/components/GameGrid/GameGrid.tsx
- web/components/GameGrid/Header.tsx
- web/components/GameGrid/OpponentMetricsTable.module.scss
- web/components/GameGrid/OpponentMetricsTable.tsx
- web/components/GameGrid/PDHC/PoissonHeatMap.tsx
- web/components/GameGrid/PDHC/Tooltip.tsx
- web/components/GameGrid/Switch/Switch.module.css
- web/components/GameGrid/Switch/Switch.module.scss
- web/components/GameGrid/Switch/Switch.tsx
- web/components/GameGrid/Switch/index.ts
- web/components/GameGrid/TeamRow.tsx
- web/components/GameGrid/Toggle/Toggle.module.css
- web/components/GameGrid/Toggle/Toggle.module.scss
- web/components/GameGrid/Toggle/Toggle.tsx
- web/components/GameGrid/Toggle/index.ts
- web/components/GameGrid/TotalGamesPerDayRow.tsx
- web/components/GameGrid/TransposedGrid.module.scss
- web/components/GameGrid/TransposedGrid.tsx
- web/components/GameGrid/VerticalMatchupCell.tsx
- web/components/GameGrid/contexts/GameGridContext.tsx
- web/components/GameGrid/index.ts
- web/components/GameGrid/utils/FourWeekGrid.module.scss
- web/components/GameGrid/utils/FourWeekGrid.tsx
- web/components/GameGrid/utils/calcWeekScore.test.js
- web/components/GameGrid/utils/calcWeekScore.ts
- web/components/GameGrid/utils/calcWinOdds.test.js
- web/components/GameGrid/utils/calcWinOdds.ts
- web/components/GameGrid/utils/date-func.tsx
- web/components/GameGrid/utils/helper.ts
- web/components/GameGrid/utils/poisson.ts
- web/components/GameGrid/utils/poissonHelpers.ts
- web/components/GameGrid/utils/useFourWeekSchedule.ts
- web/components/GameGrid/utils/useSchedule.ts
- web/components/GamePoissonChart.module.scss
- web/components/GameScoreChart/GameLogTable.tsx
- web/components/GameScoreChart/GameScoreChart.tsx
- web/components/GameStateAnalysis/GameStateAnalysis.module.scss
- web/components/GameStateAnalysis/GameStateAnalysis.tsx
- web/components/GoaliePage/GoalieLeaderboard.tsx
- web/components/GoaliePage/GoalieList.tsx
- web/components/GoaliePage/GoalieTable.tsx
- web/components/GoaliePage/goalieCalculations.ts
- web/components/GoaliePage/goalieTypes.ts
- web/components/GoalieShareChart/GoalieShareChart.module.scss
- web/components/GoalieShareChart/index.tsx
- web/components/HeatMap/Heatmap.tsx
- web/components/HeatMap/xGoals.tsx
- web/components/HockeyRinkSvg/HockeyRinkSvg.tsx
- web/components/IconButton/IconButton.module.scss
- web/components/IconButton/IconButton.tsx
- web/components/IconButton/index.ts
- web/components/Layout/Container/Container.module.scss
- web/components/Layout/Container/Container.tsx
- web/components/Layout/Container/index.ts
- web/components/Layout/Header/Header.module.scss
- web/components/Layout/Header/Header.tsx
- web/components/Layout/Header/index.ts
- web/components/Layout/Layout.module.scss
- web/components/Layout/Layout.tsx
- web/components/Layout/MobileMenu/MobileMenu.module.scss
- web/components/Layout/MobileMenu/MobileMenu.tsx
- web/components/Layout/MobileMenu/index.ts
- web/components/Layout/NavbarItems/NavbarItems.module.scss
- web/components/Layout/NavbarItems/NavbarItems.tsx
- web/components/Layout/NavbarItems/NavbarItemsData.ts
- web/components/Layout/NavbarItems/index.ts
- web/components/Layout/index.ts
- web/components/LineCombinations/CategoryTitle/CategoryTitle.module.scss
- web/components/LineCombinations/CategoryTitle/CategoryTitle.tsx
- web/components/LineCombinations/CategoryTitle/index.ts
- web/components/LineCombinations/Line/Line.module.scss
- web/components/LineCombinations/Line/Line.tsx
- web/components/LineCombinations/Line/index.ts
- web/components/LineCombinations/LineCombinationsGrid.tsx
- web/components/LineCombinations/PlayerCard/GoalieCard.tsx
- web/components/LineCombinations/PlayerCard/PlayerCard.module.scss
- web/components/LineCombinations/PlayerCard/SkaterCard.tsx
- web/components/LineCombinations/PlayerCard/index.ts
- web/components/LineCombinations/__test__/LineCombinationsData.ts
- web/components/LineCombinations/__test__/utilities.test.ts
- web/components/LineCombinations/utilities.ts
- web/components/LinemateMatrix/index.module.scss
- web/components/LinemateMatrix/index.tsx
- web/components/LinemateMatrix/utilities.ts
- web/components/LogoMaker/logoMaker.module.scss
- web/components/LogoMaker/logoMaker.tsx
- web/components/MetricsTimeline/MetricsTimeline.module.scss
- web/components/MetricsTimeline/MetricsTimeline.tsx
- web/components/Options/Options.module.scss
- web/components/Options/Options.tsx
- web/components/Options/index.ts
- web/components/PageTitle/PageTitle.module.scss
- web/components/PageTitle/PageTitle.tsx
- web/components/PageTitle/index.ts
- web/components/PlayerAutocomplete/PlayerAutocomplete.module.scss
- web/components/PlayerAutocomplete/PlayerAutocomplete.tsx
- web/components/PlayerAutocomplete/index.ts
- web/components/PlayerBioCard/PlayerBioCard.module.scss
- web/components/PlayerBioCard/PlayerBioCard.tsx
- web/components/PlayerBioCard/index.ts
- web/components/PlayerPPTOIPerGameChart/PPTOIChart.tsx
- web/components/PlayerPPTOIPerGameChart/PlayerPPTOIPerGameChart.tsx
- web/components/PlayerPickupTable/PlayerPickupTable.module.scss
- web/components/PlayerPickupTable/PlayerPickupTable.tsx
- web/components/PlayerStats/PlayerAdvancedStats.tsx
- web/components/PlayerStats/PlayerContextualStats.tsx
- web/components/PlayerStats/PlayerPerformanceHeatmap.tsx
- web/components/PlayerStats/PlayerRadarChart.tsx
- web/components/PlayerStats/PlayerStats.module.scss
- web/components/PlayerStats/PlayerStatsAdvancedNote.tsx
- web/components/PlayerStats/PlayerStatsChart.tsx
- web/components/PlayerStats/PlayerStatsSummary.tsx
- web/components/PlayerStats/PlayerStatsTable.tsx
- web/components/PlayerStats/types.ts
- web/components/PoissonDistributionChart.jsx
- web/components/Projections/PlayerMatchupWeekPerformanceChart.tsx
- web/components/Projections/ProjectionSourceAnalysis.module.scss
- web/components/Projections/ProjectionSourceAnalysis.tsx
- web/components/Projections/RoundPerformanceBoxPlotChart.tsx
- web/components/RadioOptions/RadioOptions.module.scss
- web/components/RadioOptions/RadioOptions.tsx
- web/components/RadioOptions/index.ts
- web/components/RecentPosts/RecentPosts.module.scss
- web/components/RecentPosts/RecentPosts.tsx
- web/components/RecentPosts/index.ts
- web/components/RosterMatrix/RosterMatrix.module.scss
- web/components/RosterMatrix/RosterMatrix.tsx
- web/components/RosterMatrix/RosterMatrixWrapper.tsx
- web/components/Select/Select.module.scss
- web/components/Select/Select.tsx
- web/components/Select/index.ts
- web/components/ShiftChart/PowerPlayAreaIndicators/index.tsx
- web/components/ShotVisualization/ShotVisualization.tsx
- web/components/SkoLineChart/LineChart.tsx
- web/components/SocialMedias/SocialMedias.module.scss
- web/components/SocialMedias/SocialMedias.tsx
- web/components/SocialMedias/index.ts
- web/components/Spinner/Spinner.module.scss
- web/components/Spinner/Spinner.tsx
- web/components/Spinner/index.ts
- web/components/StatsPage/LeaderboardCategory.tsx
- web/components/StatsPage/LeaderboardCategoryBSH.tsx
- web/components/StatsPage/LeaderboardCategoryGoalie.tsx
- web/components/StatsPage/MobileTeamList.module.scss
- web/components/StatsPage/MobileTeamList.tsx
- web/components/StatsPage/PlayerSearchBar.tsx
- web/components/StatsPage/Segment.tsx
- web/components/SustainabilityVSCareerChart/SustainabilityVSCareerChart.module.scss
- web/components/SustainabilityVSCareerChart/SustainabilityVSCareerChart.tsx
- web/components/SustainabilityVSCareerChart/index.ts
- web/components/TeamDashboard/AdvancedL10Metrics.module.scss
- web/components/TeamDashboard/AdvancedL10Metrics.tsx
- web/components/TeamDashboard/GameByGameTimeline.module.scss
- web/components/TeamDashboard/GameByGameTimeline.tsx
- web/components/TeamDashboard/TeamDashboard.module.scss
- web/components/TeamDashboard/TeamDashboard.tsx
- web/components/TeamDashboard/TeamLeaders.tsx
- web/components/TeamDropdown/TeamDropdown.module.scss
- web/components/TeamDropdown/TeamDropdown.tsx
- web/components/TeamDropdown/index.ts
- web/components/TeamLandingPage/DoughnutChart.js
- web/components/TeamLandingPage/GoalieWorkloadBars.js
- web/components/TeamLandingPage/StrengthOfSchedule.tsx
- web/components/TeamLandingPage/goalieTrends.js
- web/components/TeamLandingPage/teamLandingPage.css
- web/components/TeamLandingPage/teamLandingPage.scss
- web/components/TeamLandingPage/teamStats.js
- web/components/TeamLandingPage/teamStats.scss
- web/components/TeamLandingPage/utils/teamsInfo.ts
- web/components/TeamScheduleCalendar/TeamScheduleCalendar.module.scss
- web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx
- web/components/TeamScheduleCalendar/index.ts
- web/components/TeamSelect/TeamSelect.module.scss
- web/components/TeamSelect/TeamSelect.tsx
- web/components/TeamSelect/index.ts
- web/components/TeamStandingsChart/TeamStandingsChart.module.scss
- web/components/TeamStandingsChart/TeamStandingsChart.tsx
- web/components/TeamStatCard/TeamStatCard.module.scss
- web/components/TeamStatCard/TeamStatCard.tsx
- web/components/TeamStatCard/index.ts
- web/components/TeamTabNavigation/TeamTabNavigation.module.scss
- web/components/TeamTabNavigation/TeamTabNavigation.tsx
- web/components/TimeAgo/TimeAgo.tsx
- web/components/TimeAgo/index.ts
- web/components/TimeOnIceChart/TimeOnIceChart.module.scss
- web/components/TimeOnIceChart/TimeOnIceChart.tsx
- web/components/TimeOnIceChart/index.ts
- web/components/TimeOptions/TimeOptions.tsx
- web/components/TimeOptions/index.ts
- web/components/Tooltip/Tooltip.module.scss
- web/components/Tooltip/Tooltip.tsx
- web/components/Tooltip/index.ts
- web/components/WiGO/ConsistencyChart.tsx
- web/components/WiGO/GameScoreLineChart/RollingAverageChart.tsx
- web/components/WiGO/GameScoreLineChart/index.tsx
- web/components/WiGO/GameScoreSection.tsx
- web/components/WiGO/NameSearchBar.module.scss
- web/components/WiGO/NameSearchBar.tsx
- web/components/WiGO/OpponentGameLog.module.scss
- web/components/WiGO/OpponentGamelog.tsx
- web/components/WiGO/PerGameStatsTable.module.scss
- web/components/WiGO/PerGameStatsTable.tsx
- web/components/WiGO/PlayerHeader.tsx
- web/components/WiGO/PlayerRatingsDisplay.module.scss
- web/components/WiGO/PlayerRatingsDisplay.tsx
- web/components/WiGO/PpgLineChart.tsx
- web/components/WiGO/RateStatPercentiles.tsx
- web/components/WiGO/StatsTable.tsx
- web/components/WiGO/StatsTableRowChart.tsx
- web/components/WiGO/TeamNameSVG.tsx
- web/components/WiGO/TimeframeComparison.module.scss
- web/components/WiGO/TimeframeComparison.tsx
- web/components/WiGO/ToiLineChart.tsx
- web/components/WiGO/WigoDoughnutChart.js
- web/components/WiGO/WigoLineChart.js
- web/components/WiGO/fetchThreeYearAverages.ts
- web/components/WiGO/ratingWeights.ts
- web/components/WiGO/ratingsConstants.ts
- web/components/WiGO/tableUtils.ts
- web/components/WiGO/types.ts
- web/components/WiGO/wgoRadarChart.js
- web/components/WiGO/wigoCharts.module.scss
- web/components/common/OptimizedImage.tsx
- web/components/common/PanelStatus.module.scss
- web/components/common/PanelStatus.tsx
- web/contexts/AuthProviderContext/index.tsx
- web/contexts/RoundSummaryContext.tsx
- web/contexts/TeamColorContext/TEAM_COLORS.ts
- web/contexts/TeamColorContext/index.tsx
- web/hooks/useCareerAveragesStats.ts
- web/hooks/useCurrentSeason.ts
- web/hooks/useDebounce.ts
- web/hooks/useGoals.tsx
- web/hooks/useHideableNavbar.ts
- web/hooks/useMissedGames.ts
- web/hooks/useOffseason.ts
- web/hooks/usePercentileRank.ts
- web/hooks/usePlayer.ts
- web/hooks/usePlayerMatchupWeekStats.ts
- web/hooks/usePlayerRecommendations.ts
- web/hooks/usePlayerStats.ts
- web/hooks/usePlayerWeeklyStats.ts
- web/hooks/usePlayers.ts
- web/hooks/useProcessedProjectionsData.tsx
- web/hooks/useProjectionSourceAnalysis.ts
- web/hooks/useResizeObserver.ts
- web/hooks/useScreenSize.ts
- web/hooks/useShotData.ts
- web/hooks/useSustainabilityStats.ts
- web/hooks/useTeamAbbreviation.ts
- web/hooks/useTeamSchedule.ts
- web/hooks/useTeamStats.ts
- web/hooks/useTeamStatsFromDb.ts
- web/hooks/useTeamSummary.ts
- web/hooks/useTeams.ts
- web/hooks/useVORPCalculations.ts
- web/hooks/useWGOPlayerStats.ts
- web/lib/NHL/NHL_API.ts
- web/lib/NHL/TOI.ts
- web/lib/NHL/base.ts
- web/lib/NHL/client/index.ts
- web/lib/NHL/server/index.ts
- web/lib/NHL/statsPageFetch.ts
- web/lib/NHL/statsPageTypes.ts
- web/lib/NHL/teamPageTypes.ts
- web/lib/NHL/teamsInfo.js
- web/lib/NHL/types.ts
- web/lib/NHL/utils/utils.ts
- web/lib/apollo-client.js
- web/lib/cors-fetch.ts
- web/lib/drawHockeyRink.ts
- web/lib/fetchWithCache.ts
- web/lib/getTimes.ts
- web/lib/google/sheets.ts
- web/lib/images.ts
- web/lib/mappers/yahooPlayersToSheet.ts
- web/lib/projectionsConfig/fantasyPointsConfig.ts
- web/lib/projectionsConfig/formatToMMSS.ts
- web/lib/projectionsConfig/formatTotalSecondsToMMSS.ts
- web/lib/projectionsConfig/projectionSourcesConfig.ts
- web/lib/projectionsConfig/projectionTableStructure.md
- web/lib/projectionsConfig/statsMasterList.ts
- web/lib/projectionsConfig/yahooConfig.ts
- web/lib/sanity/config.js
- web/lib/sanity/sanity.js
- web/lib/sanity/sanity.server.js
- web/lib/standardization/columnStandardization.ts
- web/lib/standardization/nameStandardization.ts
- web/lib/supabase/GoaliePage/calculateAverages.ts
- web/lib/supabase/GoaliePage/calculateGoalieRanking.ts
- web/lib/supabase/GoaliePage/calculateRanking.ts
- web/lib/supabase/GoaliePage/fetchAllGoalies.ts
- web/lib/supabase/GoaliePage/fetchGoalieDataForWeek.js
- web/lib/supabase/GoaliePage/goaliePageWeeks.js
- web/lib/supabase/GoaliePage/types.ts
- web/lib/supabase/GoaliePage/updateWeeklyData.ts
- web/lib/supabase/GoaliePage/upsertGoalieData.js
- web/lib/supabase/Upserts/Yahoo/name_mapping_todo.json
- web/lib/supabase/Upserts/Yahoo/player_name_normalization_spec.json
- web/lib/supabase/Upserts/Yahoo/populate_yahoo_nhl_mapping.py
- web/lib/supabase/Upserts/Yahoo/reverse_only_matches.json
- web/lib/supabase/Upserts/Yahoo/unmatched_yahoo_nhl_mapping.json
- web/lib/supabase/Upserts/Yahoo/unmatched_yahoo_to_nhl_mapping.json
- web/lib/supabase/Upserts/Yahoo/yahoo-tables.md
- web/lib/supabase/Upserts/Yahoo/yahooAPI.py
- web/lib/supabase/Upserts/Yahoo/yahooAPIgameIds.py
- web/lib/supabase/Upserts/Yahoo/yahooApiPlayerKeys.py
- web/lib/supabase/Upserts/Yahoo/yahooHistoricalOwnership.py
- web/lib/supabase/Upserts/fetchPPTOIdata.js
- web/lib/supabase/Upserts/fetchPbP.ts
- web/lib/supabase/Upserts/fetchPowerRankings.js
- web/lib/supabase/Upserts/fetchRollingGames.js
- web/lib/supabase/Upserts/fetchSKOskaterStats.js
- web/lib/supabase/Upserts/fetchSKOyears.js
- web/lib/supabase/Upserts/fetchSoSgameLog.js
- web/lib/supabase/Upserts/fetchStandings.js
- web/lib/supabase/Upserts/fetchWGOdata.d.ts
- web/lib/supabase/Upserts/fetchWGOdata.js
- web/lib/supabase/Upserts/fetchWGOgoalieData.js
- web/lib/supabase/Upserts/fetchWGOgoalieStats.js
- web/lib/supabase/Upserts/fetchWGOskaterStats.js
- web/lib/supabase/Upserts/supabaseShifts.js
- web/lib/supabase/Upserts/yahooAuth/token.json
- web/lib/supabase/client.ts
- web/lib/supabase/database-generated.types.ts
- web/lib/supabase/index.ts
- web/lib/supabase/server.ts
- web/lib/supabase/shotsByCoord.js
- web/lib/supabase/signInWithGitHub.ts
- web/lib/supabase/sosStandings.js
- web/lib/supabase/sosStandings.log
- web/lib/supabase/test.json
- web/lib/supabase/utils/calculations.ts
- web/lib/supabase/utils/constants.ts
- web/lib/supabase/utils/dataFetching.ts
- web/lib/supabase/utils/fetchAllGoalies.ts
- web/lib/supabase/utils/fetchAllSkaters.ts
- web/lib/supabase/utils/statistics.ts
- web/lib/supabase/utils/types.ts
- web/lib/supabase/utils/updateAllGoalies.ts
- web/lib/supabase/yahooUniformNumbers.py
- web/lib/sync/syncYahooPlayersToSheet.ts
- web/lib/teamsInfo.ts
- web/next-env.d.ts
- web/next-seo.config.js
- web/next-sitemap.config.js
- web/next.config.js
- web/npm
- web/package-lock.json
- web/package.json
- web/pages/404.tsx
- web/pages/FantasyPowerRankings.js
- web/pages/PowerRankings.js
- web/pages/_app.tsx
- web/pages/_document.tsx
- web/pages/api/Averages/[playerId].ts
- web/pages/api/Averages/helpers.ts
- web/pages/api/Averages/statsService.ts
- web/pages/api/Averages/types.ts
- web/pages/api/CareerAverages/[playerId].ts
- web/pages/api/SustainabilityStats/[playerId].ts
- web/pages/api/Teams/[teamAbbreviation].ts
- web/pages/api/Teams/nst-team-stats.ts
- web/pages/api/ThreeYearAverages/[playerId].ts
- web/pages/api/ThreeYearAverages/nstgamelog.py
- web/pages/api/ThreeYearAverages/nsttest.py
- web/pages/api/WGOAverages/calculateAverages.ts
- web/pages/api/_types.ts
- web/pages/api/cors/index.ts
- web/pages/api/createComment.ts
- web/pages/api/db.md
- web/pages/api/internal/sync-yahoo-players-to-sheet.ts
- web/pages/api/toi.ts
- web/pages/api/v1/db/calculate-wigo-stats.ts
- web/pages/api/v1/db/check-missing-goalie-data.ts
- web/pages/api/v1/db/cron-report.ts
- web/pages/api/v1/db/cron/update-stats-cron.ts
- web/pages/api/v1/db/manual-refresh-yahoo-token.ts
- web/pages/api/v1/db/nst_gamelog_goalie_scraper.py
- web/pages/api/v1/db/nst_gamelog_scraper.py
- web/pages/api/v1/db/powerPlayTimeFrame.ts
- web/pages/api/v1/db/run-fetch-wgo-data.ts
- web/pages/api/v1/db/shift-charts.ts
- web/pages/api/v1/db/skaterArray.ts
- web/pages/api/v1/db/update-PbP.ts
- web/pages/api/v1/db/update-expected-goals/calculations.ts
- web/pages/api/v1/db/update-expected-goals/fetchData.ts
- web/pages/api/v1/db/update-expected-goals/index.ts
- web/pages/api/v1/db/update-expected-goals/utils.ts
- web/pages/api/v1/db/update-games.ts
- web/pages/api/v1/db/update-last-7-14-30.ts
- web/pages/api/v1/db/update-line-combinations/[id].ts
- web/pages/api/v1/db/update-line-combinations/index.ts
- web/pages/api/v1/db/update-nst-current-season.ts
- web/pages/api/v1/db/update-nst-gamelog.ts
- web/pages/api/v1/db/update-nst-goalies.ts
- web/pages/api/v1/db/update-nst-last-ten.ts
- web/pages/api/v1/db/update-nst-player-reports.ts
- web/pages/api/v1/db/update-player/[playerId].ts
- web/pages/api/v1/db/update-players.ts
- web/pages/api/v1/db/update-power-play-combinations/[gameId].ts
- web/pages/api/v1/db/update-power-rankings.ts
- web/pages/api/v1/db/update-rolling-games.ts
- web/pages/api/v1/db/update-season-stats.ts
- web/pages/api/v1/db/update-seasons.ts
- web/pages/api/v1/db/update-sko-stats.ts
- web/pages/api/v1/db/update-standings-details/index.ts
- web/pages/api/v1/db/update-stats/[gameId].ts
- web/pages/api/v1/db/update-team-yearly-summary.ts
- web/pages/api/v1/db/update-teams.ts
- web/pages/api/v1/db/update-wgo-averages.ts
- web/pages/api/v1/db/update-wgo-goalie-totals.ts
- web/pages/api/v1/db/update-wgo-goalies.ts
- web/pages/api/v1/db/update-wgo-ly.ts
- web/pages/api/v1/db/update-wgo-skaters.ts
- web/pages/api/v1/db/update-wgo-totals.ts
- web/pages/api/v1/db/update-yahoo-players.ts
- web/pages/api/v1/db/update-yahoo-weeks.ts
- web/pages/api/v1/db/upsert-csv.ts
- web/pages/api/v1/discord/send-message/line-combo/[gameId].ts
- web/pages/api/v1/game/[id]/boxscore/index.ts
- web/pages/api/v1/games/index.js
- web/pages/api/v1/ml/create-materialized-view.ts
- web/pages/api/v1/player/[id]/game-log/[season]/[type]/index.ts
- web/pages/api/v1/player/[id]/index.ts
- web/pages/api/v1/player/[id]/percentile-rank/index.ts
- web/pages/api/v1/player/index.ts
- web/pages/api/v1/schedule/[startDate].ts
- web/pages/api/v1/season.ts
- web/pages/api/v1/team/[seasonId]/index.ts
- web/pages/api/v1/webhooks/docker-compose.yaml
- web/pages/api/v1/webhooks/on-new-line-combo.ts
- web/pages/auth/Auth.module.scss
- web/pages/auth/index.tsx
- web/pages/blog/[slug].tsx
- web/pages/blog/index.tsx
- web/pages/buyLowSellHigh.js
- web/pages/charts.tsx
- web/pages/db/index.tsx
- web/pages/db/upsert-projections.tsx
- web/pages/draft-dashboard.tsx
- web/pages/drm.tsx
- web/pages/game-grid/[mode].tsx
- web/pages/game-grid/index.tsx
- web/pages/game/GamePage.scss
- web/pages/game/[gameId].tsx
- web/pages/game/modularization of the game page.md
- web/pages/goalies.js
- web/pages/index.tsx
- web/pages/lines/[abbreviation].module.scss
- web/pages/lines/[abbreviation].tsx
- web/pages/lines/index.tsx
- web/pages/lines/line-combo/[gameId].tsx
- web/pages/podfeed.tsx
- web/pages/projections/index.tsx
- web/pages/requirements.txt
- web/pages/shiftChart.js
- web/pages/skoCharts.tsx
- web/pages/stats/game/[gameId].tsx
- web/pages/stats/index.tsx
- web/pages/stats/player/[playerId].tsx
- web/pages/stats/team/[teamAbbreviation].tsx
- web/pages/statsPlaceholder.tsx
- web/pages/sustainabilityTool.module.scss
- web/pages/teamStats.tsx
- web/pages/teamStats/[teamAbbreviation].tsx
- web/pages/test/index.tsx
- web/pages/testLogoMaker.tsx
- web/pages/trueGoalieValue.tsx
- web/pages/wigoCharts.tsx
- web/pages/xGoalsPage.tsx
- web/public/android-chrome-192x192.png
- web/public/android-chrome-512x512.png
- web/public/apple-touch-icon.png
- web/public/favicon-16x16.png
- web/public/favicon-32x32.png
- web/public/favicon.ico
- web/public/fhfh-favicon-16x16.png
- web/public/fhfh-favicon-32x32.png
- web/public/pictures/FHFH Thumbnails YT.zip - 12.png
- web/public/pictures/FHFHTRAIN.png
- web/public/pictures/FHFHTRAINONCE.png
- web/public/pictures/FHFHonly.png
- web/public/pictures/IconSearch.png
- web/public/pictures/NHL_Hockey_Rink.svg
- web/public/pictures/arrow-down-red.png
- web/public/pictures/arrow-down-white.png
- web/public/pictures/arrow-right-green.png
- web/public/pictures/arrow-right-red.png
- web/public/pictures/arrow-up-green.png
- web/public/pictures/arrow.svg
- web/public/pictures/awayIcon.png
- web/public/pictures/blogIcon.png
- web/public/pictures/burgerMenu.svg
- web/public/pictures/circle.png
- web/public/pictures/close.svg
- web/public/pictures/discord.png
- web/public/pictures/download.svg
- web/public/pictures/drmIcon.png
- web/public/pictures/expand-icon.png
- web/public/pictures/expectedGoals.png
- web/public/pictures/fhfh-gpt-3.png
- web/public/pictures/fhfh-gpt-4.png
- web/public/pictures/fhfh-gpt-6.png
- web/public/pictures/fhfh-gpt-x.png
- web/public/pictures/fhfh-gpt.png
- web/public/pictures/fhfh-italic-2.png
- web/public/pictures/fhfh-italic-3.png
- web/public/pictures/fhfh-italic.png
- web/public/pictures/fhfh_gpt.png
- web/public/pictures/gameGrid.png
- web/public/pictures/gamesTable.png
- web/public/pictures/gpt.png
- web/public/pictures/green-arrow-up.svg
- web/public/pictures/hamburgerMenu.png
- web/public/pictures/heart-filled.png
- web/public/pictures/heart-outlined.svg
- web/public/pictures/homeIcon.png
- web/public/pictures/homeNavIcon.png
- web/public/pictures/injured.png
- web/public/pictures/lineCombosIcon.png
- web/public/pictures/linesTable.png
- web/public/pictures/logo-fhfh.svg
- web/public/pictures/logo.png
- web/public/pictures/logo2.png
- web/public/pictures/logo3.png
- web/public/pictures/menu-arrow-drop-down.svg
- web/public/pictures/navRibbon.png
- web/public/pictures/navRibbon.svg
- web/public/pictures/nstTables.png
- web/public/pictures/player-placeholder.jpg
- web/public/pictures/playersTable.png
- web/public/pictures/podcastIcon.png
- web/public/pictures/ppTimeframes.png
- web/public/pictures/red-arrow-down.png
- web/public/pictures/seasonsTable.png
- web/public/pictures/share-button.svg
- web/public/pictures/share.svg
- web/public/pictures/shiftChartsIcon.png
- web/public/pictures/shiftsTable.png
- web/public/pictures/socials/discord.png
- web/public/pictures/socials/patreon.png
- web/public/pictures/socials/spotify.png
- web/public/pictures/socials/twitter.png
- web/public/pictures/socials/youtube.png
- web/public/pictures/statsIcon.png
- web/public/pictures/statsTable.png
- web/public/pictures/teamsTable.png
- web/public/pictures/utah-mammoth-logo-png_seeklogo-618353.png
- web/public/pictures/wigoIcon.png
- web/public/site.webmanifest
- web/public/teamCardPics/ANA.jpg
- web/public/teamCardPics/ARI.jpg
- web/public/teamCardPics/BOS.jpg
- web/public/teamCardPics/BUF.jpg
- web/public/teamCardPics/CAR.jpg
- web/public/teamCardPics/CBJ.jpg
- web/public/teamCardPics/CGY.jpg
- web/public/teamCardPics/CHI.jpg
- web/public/teamCardPics/COL.jpg
- web/public/teamCardPics/DAL.jpg
- web/public/teamCardPics/DET.jpg
- web/public/teamCardPics/EDM.jpg
- web/public/teamCardPics/FLA.jpg
- web/public/teamCardPics/LAK.jpg
- web/public/teamCardPics/MIN.jpg
- web/public/teamCardPics/MTL.jpg
- web/public/teamCardPics/NJD.jpg
- web/public/teamCardPics/NYI.jpg
- web/public/teamCardPics/NYR.jpg
- web/public/teamCardPics/OTT.jpg
- web/public/teamCardPics/PHI.jpg
- web/public/teamCardPics/PIT.jpg
- web/public/teamCardPics/SEA.jpg
- web/public/teamCardPics/SJS.jpg
- web/public/teamCardPics/STL.jpg
- web/public/teamCardPics/TBL.jpg
- web/public/teamCardPics/TOR.jpg
- web/public/teamCardPics/VAN.jpg
- web/public/teamCardPics/VGK.jpg
- web/public/teamCardPics/WPG.jpg
- web/public/teamCardPics/WSH.jpg
- web/public/teamCardPics/nsh.jpg
- web/public/teamLogos/ANA.png
- web/public/teamLogos/ARI.png
- web/public/teamLogos/BOS.png
- web/public/teamLogos/BUF.png
- web/public/teamLogos/CAR.png
- web/public/teamLogos/CBJ.png
- web/public/teamLogos/CGY.png
- web/public/teamLogos/CHI.png
- web/public/teamLogos/COL.png
- web/public/teamLogos/DAL.png
- web/public/teamLogos/DET.png
- web/public/teamLogos/EDM.png
- web/public/teamLogos/FHFH.png
- web/public/teamLogos/FLA.png
- web/public/teamLogos/Five Hole.png
- web/public/teamLogos/LAK.png
- web/public/teamLogos/MIN.png
- web/public/teamLogos/MTL.png
- web/public/teamLogos/NJD.png
- web/public/teamLogos/NSH.png
- web/public/teamLogos/NYI.png
- web/public/teamLogos/NYR.png
- web/public/teamLogos/OTT.png
- web/public/teamLogos/PHI.png
- web/public/teamLogos/PIT.png
- web/public/teamLogos/SEA.png
- web/public/teamLogos/SJS.png
- web/public/teamLogos/STL.png
- web/public/teamLogos/TBL.png
- web/public/teamLogos/TOR.png
- web/public/teamLogos/UTA.png
- web/public/teamLogos/VAN.png
- web/public/teamLogos/VGK.png
- web/public/teamLogos/WPG.png
- web/public/teamLogos/WSH.png
- web/public/teamLogos/bedard.png
- web/public/teamLogos/fhfhGoldMedal.png
- web/public/teamLogos/image.png
- web/rules/create-prd.mdc
- web/rules/generate-tasks.mdc
- web/rules/process-task-list.mdc
- web/rules/supabase-table-structure.mdc
- web/scripts/fantasy_points_analysis.py
- web/scripts/fetch_team_table.py
- web/scripts/goals_correlation_analysis.py
- web/scripts/performance_prediction.py
- web/scripts/requirements.txt
- web/stories/Button.stories.ts
- web/stories/Button.tsx
- web/stories/Configure.mdx
- web/stories/Header.stories.ts
- web/stories/Header.tsx
- web/stories/Page.stories.ts
- web/stories/Page.tsx
- web/stories/WiGO/GameScoreLineChart.stories.tsx
- web/stories/assets/accessibility.png
- web/stories/assets/accessibility.svg
- web/stories/assets/addon-library.png
- web/stories/assets/assets.png
- web/stories/assets/avif-test-image.avif
- web/stories/assets/context.png
- web/stories/assets/discord.svg
- web/stories/assets/docs.png
- web/stories/assets/figma-plugin.png
- web/stories/assets/github.svg
- web/stories/assets/share.png
- web/stories/assets/styling.png
- web/stories/assets/testing.png
- web/stories/assets/theming.png
- web/stories/assets/tutorials.svg
- web/stories/assets/youtube.svg
- web/stories/button.css
- web/stories/header.css
- web/stories/page.css
- web/styles/BLSH.module.scss
- web/styles/Blog.module.scss
- web/styles/Charts.module.scss
- web/styles/GoalieTrends.module.scss
- web/styles/GoalieWorkloadBars.module.scss
- web/styles/Goalies.module.scss
- web/styles/Home.module.scss
- web/styles/LinePairGrid.module.scss
- web/styles/Lines.module.scss
- web/styles/PPTOIChart.module.scss
- web/styles/Podfeed.module.scss
- web/styles/PoissonHeatmap.module.scss
- web/styles/Post.module.scss
- web/styles/ProjectionsPage.module.scss
- web/styles/ShiftChart.module.scss
- web/styles/Stats.module.scss
- web/styles/TeamStatsPage.module.scss
- web/styles/_panel.scss
- web/styles/globals.css
- web/styles/mixins.scss
- web/styles/pdhcTooltip.module.scss
- web/styles/teamStats.module.scss
- web/styles/useGoals.module.scss
- web/styles/vars.scss
- web/styles/wigoCharts.module.scss
- web/styles/wigoColors.ts
- web/tmp-run-sync.ts
- web/tmp-test-sheets.mjs
- web/tsconfig.json
- web/utils/adminOnlyMiddleware.ts
- web/utils/analytics.ts
- web/utils/calculatePercentiles.ts
- web/utils/calculateWigoRatings.ts
- web/utils/dateUtils.ts
- web/utils/debounce.ts
- web/utils/extractPPDetails.ts
- web/utils/fetchAllPages.ts
- web/utils/fetchAllRows.ts
- web/utils/fetchCurrentSeason.ts
- web/utils/fetchCurrentseason.js
- web/utils/fetchScheduleData.ts
- web/utils/fetchWigoPercentiles.ts
- web/utils/fetchWigoPlayerStats.ts
- web/utils/fetchWigoRatingStats.ts
- web/utils/formatDate.ts
- web/utils/formattingUtils.ts
- web/utils/getPowerPlayBlocks.ts
- web/utils/groupBy.ts
- web/utils/memoize.ts
- web/utils/projectionsRanking.ts
- web/utils/scrollTop.ts
- web/utils/setDifference.ts
- web/utils/stats/formatters.ts
- web/utils/stats/nhlStatsFetch.ts
- web/utils/tierUtils.ts
- web/vercel.json
- web/vitest.config.mts
- web/yahoo-fantasy.d.ts
- webhooks/README.md
- webhooks/app.js
- webhooks/package-lock.json
- webhooks/package.json
- yahoo_historical.log
