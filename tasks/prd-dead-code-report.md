# PRD: Dead Code & Stale Files Report

Generated: 2025-09-12 12:40:13 UTC

Tools: knip (unused files/exports), dependency-cruiser (orphans), ts-prune (unused TS exports), git (stale files).

## Summary
- knip: identifies unused files and exports (Next.js-aware with defaults).
- dependency-cruiser: lists modules with no inbound imports (orphans), excluding Next entrypoints and assets).
- ts-prune: TypeScript-only unused exports.
- git: 100 oldest last-touched files under web/.

## Knip Findings

# Knip report

## Unused files (51)

* components/DateRangeMatrix/DateRangeMatrixForGames.tsx
* components/PlayerPPTOIPerGameChart/PlayerPPTOIPerGameChart.tsx
* components/TeamLandingPage/teamStats.js
* components/TeamStatCard/TeamStatCard.tsx
* components/TeamStatCard/index.ts
* components/WiGO/TeamNameSVG.tsx
* components/WiGO/WigoDoughnutChart.js
* components/WiGO/WigoLineChart.js
* components/WiGO/fetchThreeYearAverages.ts
* components/WiGO/ratingsConstants.ts
* components/WiGO/wgoRadarChart.js
* hooks/useDebounce.ts
* hooks/usePlayerStats.ts
* hooks/usePlayerWeeklyStats.ts
* hooks/useProjectionSourceAnalysis.ts
* hooks/useTeamAbbreviation.ts
* hooks/useTeamStats.ts
* hooks/useWGOPlayerStats.ts
* lib/NHL/NHL_API.ts
* lib/projectionsConfig/formatTotalSecondsToMMSS.ts
* lib/supabase/GoaliePage/calculateAverages.js
* lib/supabase/GoaliePage/calculateAverages.ts
* lib/supabase/GoaliePage/calculateGoalieRanking.ts
* lib/supabase/GoaliePage/calculateRanking.ts
* lib/supabase/GoaliePage/fetchAllGoalies.ts
* lib/supabase/GoaliePage/fetchGoalieDataForWeek.js
* lib/supabase/GoaliePage/goaliePageWeeks.js
* lib/supabase/GoaliePage/types.ts
* lib/supabase/GoaliePage/updateWeeklyData.js
* lib/supabase/GoaliePage/upsertGoalieData.js
* lib/supabase/Upserts/fetchPPTOIdata.js
* lib/supabase/Upserts/fetchSKOskaterStats.js
* lib/supabase/Upserts/fetchSKOyears.js
* lib/supabase/Upserts/fetchSoSgameLog.js
* lib/supabase/Upserts/fetchStandings.js
* lib/supabase/Upserts/fetchWGOgoalieData.js
* lib/supabase/Upserts/fetchWGOgoalieStats.js
* lib/supabase/Upserts/fetchWGOskaterStats.js
* lib/supabase/Upserts/supabaseShifts.js
* lib/supabase/shotsByCoord.js
* lib/supabase/sosStandings.js
* lib/supabase/utils/fetchAllGoalies.ts
* lib/supabase/utils/fetchAllSkaters.ts
* next-sitemap.config.js
* tmp-run-sync.ts
* tmp-test-sheets.mjs
* utils/analytics.ts
* utils/dateUtils.ts
* utils/fetchCurrentseason.js
* utils/fetchScheduleData.ts
* utils/memoize.ts

## Unused exports (37)

| Name                                | Location                                                   | Severity |
| :---------------------------------- | :--------------------------------------------------------- | :------- |
| ProjectionSourceAnalysis            | components/Projections/ProjectionSourceAnalysis.tsx:444:14 | error    |
| useTeams                            | components/GameGrid/contexts/GameGridContext.tsx:23:17     | error    |
| DEFAULT_GOALIE_FANTASY_POINTS       | lib/projectionsConfig/fantasyPointsConfig.ts:26:14         | error    |
| DEFAULT_SKATER_FANTASY_POINTS       | lib/projectionsConfig/fantasyPointsConfig.ts:8:14          | error    |
| calculateStandardDeviation          | components/GoaliePage/goalieCalculations.ts:51:14          | error    |
| calculateGameFantasyPoints          | components/GoaliePage/goalieCalculations.ts:81:14          | error    |
| defaultCanonicalColumnMap           | lib/standardization/columnStandardization.ts:4:14          | error    |
| commonNicknamesToFormal             | lib/standardization/nameStandardization.ts:889:14          | error    |
| rankingPoints                       | components/GoaliePage/goalieCalculations.ts:37:14          | error    |
| Constants                           | lib/supabase/database-generated.types.ts:32541:14          | error    |
| canonicalNameMap                    | lib/standardization/nameStandardization.ts:12:14           | error    |
| getTOIDataForGames                  | components/DateRangeMatrix/useTOIData.tsx:21:23            | error    |
| getStatDefinition                   | lib/projectionsConfig/statsMasterList.ts:281:14            | error    |
| dateDiffInDays                      | components/GameGrid/utils/date-func.tsx:46:17              | error    |
| DateRangeMatrixInternal             | components/DateRangeMatrix/index.tsx:235:17                | error    |
| isDefense                           | components/DateRangeMatrix/index.tsx:416:20                | error    |
| YAHOO_DIRECT_STATS_CONFIG           | lib/projectionsConfig/yahooConfig.ts:25:14                 | error    |
| LinemateMatrixInternal              | components/LinemateMatrix/index.tsx:469:17                 | error    |
| isForward                           | components/DateRangeMatrix/index.tsx:416:9                 | error    |
| MySet                               | components/DateRangeMatrix/index.tsx:31:14                 | error    |
| HEADERS                             | lib/mappers/yahooPlayersToSheet.ts:17:14                   | error    |
| PanelStatus                         | components/common/PanelStatus.tsx:18:14                    | error    |
| useRoundSummaryData                 | contexts/RoundSummaryContext.tsx:18:14                     | error    |
| emptyPerGameAverages                | lib/supabase/utils/constants.ts:85:14                      | error    |
| STAT_LABELS                         | lib/supabase/utils/constants.ts:61:14                      | error    |
| fetchPercentilePlayerData           | utils/fetchWigoPlayerStats.ts:917:23                       | error    |
| useTeamGameStats                    | hooks/useTeamStatsFromDb.ts:154:17                         | error    |
| Footer                              | components/Layout/Layout.tsx:21:17                         | error    |
| sanityClient                        | lib/sanity/sanity.server.js:6:14                           | error    |
| formatTOIFromSecondsWithLeadingZero | utils/formattingUtils.ts:113:14                            | error    |
| getSeasons                          | lib/NHL/server/index.ts:148:23                             | error    |
| getGameLogs                         | lib/NHL/client/index.ts:52:23                              | error    |
| getBoxscore                         | lib/NHL/client/index.ts:73:23                              | error    |
| useOffseason                        | hooks/useOffseason.ts:12:14                                | error    |
| getRole                             | lib/supabase/index.ts:63:23                                | error    |
| CHART_PALETTE                       | styles/wigoColors.ts:57:14                                 | error    |
| default                             | lib/NHL/TOI.ts:110:8                                       | error    |


## Dependency-Cruiser Orphan Candidates (excluding Next entrypoints/assets)

- web/.next/build/chunks/[root-of-the-server]__4718a9dd._.js
- web/.next/build/chunks/[root-of-the-server]__c7ae8543._.js
- web/.next/build/chunks/[turbopack-node]_transforms_webpack-loaders_ts_5a40237e._.js
- web/.next/server/chunks/1183.js
- web/.next/server/chunks/149.js
- web/.next/server/chunks/1750.js
- web/.next/server/chunks/1960.js
- web/.next/server/chunks/2017.js
- web/.next/server/chunks/2185.js
- web/.next/server/chunks/2341.js
- web/.next/server/chunks/2647.js
- web/.next/server/chunks/2658.js
- web/.next/server/chunks/3095.js
- web/.next/server/chunks/3337.js
- web/.next/server/chunks/3586.js
- web/.next/server/chunks/4042.js
- web/.next/server/chunks/4098.js
- web/.next/server/chunks/4270.js
- web/.next/server/chunks/4385.js
- web/.next/server/chunks/5781.js
- web/.next/server/chunks/5848.js
- web/.next/server/chunks/6238.js
- web/.next/server/chunks/6373.js
- web/.next/server/chunks/6440.js
- web/.next/server/chunks/6521.js
- web/.next/server/chunks/6836.js
- web/.next/server/chunks/7008.js
- web/.next/server/chunks/7117.js
- web/.next/server/chunks/7169.js
- web/.next/server/chunks/7383.js
- web/.next/server/chunks/7666.js
- web/.next/server/chunks/8082.js
- web/.next/server/chunks/8673.js
- web/.next/server/chunks/8713.js
- web/.next/server/chunks/8823.js
- web/.next/server/chunks/917.js
- web/.next/server/chunks/928.js
- web/.next/server/chunks/939.js
- web/.next/server/chunks/9492.js
- web/.next/server/chunks/9602.js
- web/.next/server/chunks/[root-of-the-server]__888f0b61._.js
- web/.next/server/chunks/[root-of-the-server]__f312660b._.js
- web/.next/server/chunks/node_modules_2215db0f._.js
- web/.next/server/chunks/node_modules_next_dist_ce0f0522._.js
- web/.next/server/chunks/ssr/[root-of-the-server]__04586cee._.js
- web/.next/server/chunks/ssr/[root-of-the-server]__15d02ed1._.js
- web/.next/server/chunks/ssr/[root-of-the-server]__175287b3._.js
- web/.next/server/chunks/ssr/[root-of-the-server]__322e3ef3._.js
- web/.next/server/chunks/ssr/[root-of-the-server]__9f350845._.js
- web/.next/server/chunks/ssr/[root-of-the-server]__ae5c0e40._.js
- web/.next/server/chunks/ssr/[root-of-the-server]__ff287038._.js
- web/.next/server/chunks/ssr/components_DraftDashboard_DraftDashboard_tsx_327053fe._.js
- web/.next/server/chunks/ssr/lib_projectionsConfig_projectionSourcesConfig_ts_6f5ad0ba._.js
- web/.next/server/chunks/ssr/node_modules_0b53a5be._.js
- web/.next/server/chunks/ssr/node_modules_2888f049._.js
- web/.next/server/chunks/ssr/node_modules_3110762b._.js
- web/.next/server/chunks/ssr/node_modules_7f561231._.js
- web/.next/server/chunks/ssr/node_modules_bcb3dea8._.js
- web/.next/server/chunks/ssr/node_modules_next_16570f93._.js
- web/.next/server/dynamic-css-manifest.js
- web/.next/server/interception-route-rewrite-manifest.js
- web/.next/server/middleware-build-manifest.js
- web/.next/server/middleware-react-loadable-manifest.js
- web/.next/server/next-font-manifest.js
- web/.next/server/pages/_app.js
- web/.next/server/pages/_document.js
- web/.next/server/pages/_error.js
- web/.next/server/pages/api/Averages/[playerId].js
- web/.next/server/pages/api/Averages/helpers.js
- web/.next/server/pages/api/Averages/statsService.js
- web/.next/server/pages/api/Averages/types.js
- web/.next/server/pages/api/CareerAverages/[playerId].js
- web/.next/server/pages/api/SustainabilityStats/[playerId].js
- web/.next/server/pages/api/Teams/[teamAbbreviation].js
- web/.next/server/pages/api/Teams/nst-team-stats.js
- web/.next/server/pages/api/ThreeYearAverages/[playerId].js
- web/.next/server/pages/api/WGOAverages/calculateAverages.js
- web/.next/server/pages/api/_types.js
- web/.next/server/pages/api/cors.js
- web/.next/server/pages/api/createComment.js
- web/.next/server/pages/api/internal/sync-yahoo-players-to-sheet.js
- web/.next/server/pages/api/toi.js
- web/.next/server/pages/api/v1/db/calculate-wigo-stats.js
- web/.next/server/pages/api/v1/db/check-missing-goalie-data.js
- web/.next/server/pages/api/v1/db/cron-report.js
- web/.next/server/pages/api/v1/db/cron/update-stats-cron.js
- web/.next/server/pages/api/v1/db/manual-refresh-yahoo-token.js
- web/.next/server/pages/api/v1/db/powerPlayTimeFrame.js
- web/.next/server/pages/api/v1/db/run-fetch-wgo-data.js
- web/.next/server/pages/api/v1/db/shift-charts.js
- web/.next/server/pages/api/v1/db/skaterArray.js
- web/.next/server/pages/api/v1/db/update-PbP.js
- web/.next/server/pages/api/v1/db/update-expected-goals.js
- web/.next/server/pages/api/v1/db/update-expected-goals/calculations.js
- web/.next/server/pages/api/v1/db/update-expected-goals/fetchData.js
- web/.next/server/pages/api/v1/db/update-expected-goals/utils.js
- web/.next/server/pages/api/v1/db/update-games.js
- web/.next/server/pages/api/v1/db/update-last-7-14-30.js
- web/.next/server/pages/api/v1/db/update-line-combinations.js
- web/.next/server/pages/api/v1/db/update-line-combinations/[id].js
- web/.next/server/pages/api/v1/db/update-nst-current-season.js
- web/.next/server/pages/api/v1/db/update-nst-gamelog.js
- web/.next/server/pages/api/v1/db/update-nst-goalies.js
- web/.next/server/pages/api/v1/db/update-nst-last-ten.js
- web/.next/server/pages/api/v1/db/update-nst-player-reports.js
- web/.next/server/pages/api/v1/db/update-player/[playerId].js
- web/.next/server/pages/api/v1/db/update-players.js
- web/.next/server/pages/api/v1/db/update-power-play-combinations/[gameId].js
- web/.next/server/pages/api/v1/db/update-power-rankings.js
- web/.next/server/pages/api/v1/db/update-rolling-games.js
- web/.next/server/pages/api/v1/db/update-season-stats.js
- web/.next/server/pages/api/v1/db/update-seasons.js
- web/.next/server/pages/api/v1/db/update-sko-stats.js
- web/.next/server/pages/api/v1/db/update-standings-details.js
- web/.next/server/pages/api/v1/db/update-stats/[gameId].js
- web/.next/server/pages/api/v1/db/update-team-yearly-summary.js
- web/.next/server/pages/api/v1/db/update-teams.js
- web/.next/server/pages/api/v1/db/update-wgo-averages.js
- web/.next/server/pages/api/v1/db/update-wgo-goalie-totals.js
- web/.next/server/pages/api/v1/db/update-wgo-goalies.js
- web/.next/server/pages/api/v1/db/update-wgo-ly.js
- web/.next/server/pages/api/v1/db/update-wgo-skaters.js
- web/.next/server/pages/api/v1/db/update-wgo-totals.js
- web/.next/server/pages/api/v1/db/update-yahoo-players.js
- web/.next/server/pages/api/v1/db/update-yahoo-weeks.js
- web/.next/server/pages/api/v1/db/upsert-csv.js
- web/.next/server/pages/api/v1/discord/send-message/line-combo/[gameId].js
- web/.next/server/pages/api/v1/game/[id]/boxscore.js
- web/.next/server/pages/api/v1/games.js
- web/.next/server/pages/api/v1/ml/create-materialized-view.js
- web/.next/server/pages/api/v1/player.js
- web/.next/server/pages/api/v1/player/[id].js
- web/.next/server/pages/api/v1/player/[id]/game-log/[season]/[type].js
- web/.next/server/pages/api/v1/player/[id]/percentile-rank.js
- web/.next/server/pages/api/v1/schedule/[startDate].js
- web/.next/server/pages/api/v1/season.js
- web/.next/server/pages/api/v1/team/[seasonId].js
- web/.next/server/pages/api/v1/webhooks/on-new-line-combo.js
- web/.next/server/pages/blog.js
- web/.next/server/pages/blog/[slug].js
- web/.next/server/pages/draft-dashboard.js
- web/.next/server/pages/game-grid.js
- web/.next/server/pages/game-grid/[mode].js
- web/.next/server/pages/index.js
- web/.next/server/pages/lines.js
- web/.next/server/pages/lines/[abbreviation].js
- web/.next/server/pages/stats.js
- web/.next/server/pages/stats/player/[playerId].js
- web/.next/server/pages/stats/team/[teamAbbreviation].js
- web/.next/server/pages/statsPlaceholder.js
- web/.next/server/server-reference-manifest.js
- web/.next/static/chunks/0b62e0ef-a4b1087b5f27195c.js
- web/.next/static/chunks/1022-d45a371bf0d284c0.js
- web/.next/static/chunks/1030-c9f97ce27e663531.js
- web/.next/static/chunks/12142dde-0551f4c3bc0455f0.js
- web/.next/static/chunks/1226-56f6353b3f9c521d.js
- web/.next/static/chunks/1490-6cc4c7ebc68344e9.js
- web/.next/static/chunks/2086-025d536507ad2eac.js
- web/.next/static/chunks/2354-6357da8fb3bf598e.js
- web/.next/static/chunks/2601-75e58f7461a61702.js
- web/.next/static/chunks/2764-ada9f0c821abd39d.js
- web/.next/static/chunks/2787-cb38884a9d8f9c34.js
- web/.next/static/chunks/2833-f5b65206dccd6a5c.js
- web/.next/static/chunks/3115-32c0fb5eb4c4ca14.js
- web/.next/static/chunks/319-43827737b6c9b279.js
- web/.next/static/chunks/3204-0063cf629f4efa72.js
- web/.next/static/chunks/3292-cc9652c2d0083e31.js
- web/.next/static/chunks/34-2e7caeac80d8ccbf.js
- web/.next/static/chunks/3515.eb6c9962c555e82c.js
- web/.next/static/chunks/3719-8126fec70ed9f47f.js
- web/.next/static/chunks/4163-103f750c2b6065f3.js
- web/.next/static/chunks/5099-d6f15c3331a300f6.js
- web/.next/static/chunks/5253-2db2ce9db5de0138.js
- web/.next/static/chunks/5379.bd120d9bc4ad7930.js
- web/.next/static/chunks/5848-99a01e8d363419e8.js
- web/.next/static/chunks/6261-db0b3f28978e68a8.js
- web/.next/static/chunks/644.18cbb37cc20a20ed.js
- web/.next/static/chunks/646-44d3ebe360ab0181.js
- web/.next/static/chunks/6d2b60a9-2026efb8f53341cb.js
- web/.next/static/chunks/7013-eb35fcc54c149f8e.js
- web/.next/static/chunks/7035-9379d1ac8b97a1ef.js
- web/.next/static/chunks/7061.273e68e728a2e3b2.js
- web/.next/static/chunks/7229-58431693ae3fa8dd.js
- web/.next/static/chunks/7407-ce9477a3762c4dec.js
- web/.next/static/chunks/7569.a6732a8deffeea14.js
- web/.next/static/chunks/7808-3edb08a9d643dd85.js
- web/.next/static/chunks/8123-7eacdf395fada92c.js
- web/.next/static/chunks/8230-c2ee746fee6883bb.js
- web/.next/static/chunks/8391-c53df6aaf0ab1333.js
- web/.next/static/chunks/8827-805c9bf3ab55c2e3.js
- web/.next/static/chunks/9373-f4cecbbed8f35aac.js
- web/.next/static/chunks/9808-a1b976362268effc.js
- web/.next/static/chunks/98309536-d5583eac3828dd0e.js
- web/.next/static/chunks/9891-409ab3005196d3a9.js
- web/.next/static/chunks/[root-of-the-server]__03ef54a7._.js
- web/.next/static/chunks/[root-of-the-server]__39ea7166._.js
- web/.next/static/chunks/[root-of-the-server]__8bfa132d._.js
- web/.next/static/chunks/[root-of-the-server]__d26a0c69._.js
- web/.next/static/chunks/_79a29b63._.js
- web/.next/static/chunks/_f126be0f._.js
- web/.next/static/chunks/components_7cd1a68d._.js
- web/.next/static/chunks/components_DraftDashboard_DraftDashboard_tsx_53cf618f._.js
- web/.next/static/chunks/components_DraftDashboard_DraftDashboard_tsx_d41cb1e0._.js
- web/.next/static/chunks/framework-b9fd9bcc3ecde907.js
- web/.next/static/chunks/main-cf315a46a8165efe.js
- web/.next/static/chunks/node_modules_93145bfc._.js
- web/.next/static/chunks/node_modules_@apollo_client_907ff8dd._.js
- web/.next/static/chunks/node_modules_@mui_material_990e3a25._.js
- web/.next/static/chunks/node_modules_@mui_system_bc4ed15f._.js
- web/.next/static/chunks/node_modules_@react-spring_core_dist_react-spring_core_modern_mjs_557929b6._.js
- web/.next/static/chunks/node_modules_@supabase_auth-js_dist_module_ee427b70._.js
- web/.next/static/chunks/node_modules_@supabase_node-fetch_browser_bcf6ea59.js
- web/.next/static/chunks/node_modules_@tanstack_query-core_build_modern_ec005d2e._.js
- web/.next/static/chunks/node_modules_a0521f5f._.js
- web/.next/static/chunks/node_modules_b095c3f4._.js
- web/.next/static/chunks/node_modules_bfb25619._.js
- web/.next/static/chunks/node_modules_moment-timezone_0e53cbd4._.js
- web/.next/static/chunks/node_modules_moment_0c55cd92._.js
- web/.next/static/chunks/node_modules_next_0cefb970._.js
- web/.next/static/chunks/node_modules_next_dec78bf7._.js
- web/.next/static/chunks/node_modules_next_dist_b1fb42d2._.js
- web/.next/static/chunks/node_modules_next_dist_c2576e2a._.js
- web/.next/static/chunks/node_modules_next_dist_client_45e9549c._.js
- web/.next/static/chunks/node_modules_next_dist_client_d0aa886c._.js
- web/.next/static/chunks/node_modules_next_dist_compiled_5f371279._.js
- web/.next/static/chunks/node_modules_next_dist_compiled_b8bbfb97._.js
- web/.next/static/chunks/node_modules_next_dist_compiled_e019967a._.js
- web/.next/static/chunks/node_modules_next_dist_compiled_next-devtools_index_5277ebc8.js
- web/.next/static/chunks/node_modules_next_dist_compiled_stream-http_index_10f74c95.js
- web/.next/static/chunks/node_modules_next_dist_shared_lib_1e2d2fb3._.js
- web/.next/static/chunks/node_modules_next_dist_shared_lib_917a4307._.js
- web/.next/static/chunks/node_modules_next_dynamic_d0f0e623.js
- web/.next/static/chunks/node_modules_next_fb53caac._.js
- web/.next/static/chunks/node_modules_react-dom_8a8085df._.js
- web/.next/static/chunks/node_modules_react-dom_cjs_react-dom_development_2b5e0eb3.js
- web/.next/static/chunks/node_modules_react_e3593a73._.js
- web/.next/static/chunks/pages/404-145ab2f5f2385f21.js
- web/.next/static/chunks/pages/FantasyPowerRankings-e494d1d30991587f.js
- web/.next/static/chunks/pages/PowerRankings-f9d18af84ede30d5.js
- web/.next/static/chunks/pages/_app-e9f05d0349dbb853.js
- web/.next/static/chunks/pages/_app.js
- web/.next/static/chunks/pages/_error-577d20cf4b946d58.js
- web/.next/static/chunks/pages/auth-de32ec0d5111cc72.js
- web/.next/static/chunks/pages/blog-dc497a59766ebf35.js
- web/.next/static/chunks/pages/blog/[slug]-740ab7fb997ea9c4.js
- web/.next/static/chunks/pages/buyLowSellHigh-f6a5890b57763229.js
- web/.next/static/chunks/pages/charts-bd9c84cb8939fc66.js
- web/.next/static/chunks/pages/db-fe714bf16c316beb.js
- web/.next/static/chunks/pages/db/upsert-projections-a545f2ee3f82f9a0.js
- web/.next/static/chunks/pages/draft-dashboard-0a16da35271d0145.js
- web/.next/static/chunks/pages/draft-dashboard.js
- web/.next/static/chunks/pages/drm-462e0f27877de892.js
- web/.next/static/chunks/pages/game-grid-8440f9a075d85413.js
- web/.next/static/chunks/pages/game-grid/[mode]-0da334b82ca68890.js
- web/.next/static/chunks/pages/game/[gameId]-fb5a69e55e0f3eb0.js
- web/.next/static/chunks/pages/goalies-5e66782b0024195c.js
- web/.next/static/chunks/pages/index-68e64ca9424627e9.js
- web/.next/static/chunks/pages/index.js
- web/.next/static/chunks/pages/lines-4a46ccaac2106c50.js
- web/.next/static/chunks/pages/lines/[abbreviation]-ad39d0b56fd1d84e.js
- web/.next/static/chunks/pages/lines/line-combo/[gameId]-b335750f55890829.js
- web/.next/static/chunks/pages/podfeed-4ed242ce3ec04695.js
- web/.next/static/chunks/pages/projections-6e5e9eb36281e56c.js
- web/.next/static/chunks/pages/shiftChart-d346110d71737764.js
- web/.next/static/chunks/pages/skoCharts-f6f0af9cf4b9719e.js
- web/.next/static/chunks/pages/stats-c9cc523a68179482.js
- web/.next/static/chunks/pages/stats/game/[gameId]-632e4dee9a64c538.js
- web/.next/static/chunks/pages/stats/player/[playerId]-2d274450b84e2df6.js
- web/.next/static/chunks/pages/stats/team/[teamAbbreviation]-cec1b1e8e72dbe73.js
- web/.next/static/chunks/pages/statsPlaceholder-fe6c9fea424ba34d.js
- web/.next/static/chunks/pages/teamStats-afea54a67a62390d.js
- web/.next/static/chunks/pages/teamStats/[teamAbbreviation]-46769c96f406e7f7.js
- web/.next/static/chunks/pages/test-016d086bd03103fe.js
- web/.next/static/chunks/pages/testLogoMaker-8731b10eb8c6e9d3.js
- web/.next/static/chunks/pages/trueGoalieValue-ad31f6906411f4d2.js
- web/.next/static/chunks/pages/wigoCharts-cfb059596cce6bc2.js
- web/.next/static/chunks/pages/xGoalsPage-aa0e03edfffd25ea.js
- web/.next/static/chunks/pages__app_2da965e7._.js
- web/.next/static/chunks/pages_draft-dashboard_2da965e7._.js
- web/.next/static/chunks/pages_index_2da965e7._.js
- web/.next/static/chunks/polyfills-42372ed130431b0a.js
- web/.next/static/chunks/turbopack-pages__app_1aff68a8._.js
- web/.next/static/chunks/turbopack-pages_draft-dashboard_b2c8138a._.js
- web/.next/static/chunks/turbopack-pages_index_027274df._.js
- web/.next/static/chunks/turbopack-pages_index_411be4c9._.js
- web/.next/static/chunks/webpack-16ee6e827bbb872b.js
- web/.next/static/development/_buildManifest.js
- web/.next/static/development/_ssgManifest.js
- web/.next/static/yqPaSsbJuc0g4RwM1x0nO/_buildManifest.js
- web/.next/static/yqPaSsbJuc0g4RwM1x0nO/_ssgManifest.js
- web/.next/webpack-loaders.js
- web/__tests__/vitest.setup.js
- web/components/GameGrid/utils/calcWeekScore.test.js
- web/components/GameGrid/utils/calcWinOdds.test.js
- web/components/PoissonDistributionChart.jsx
- web/components/TeamLandingPage/goalieTrends.js
- web/components/TeamLandingPage/teamStats.js
- web/components/WiGO/WigoDoughnutChart.js
- web/components/WiGO/WigoLineChart.js
- web/components/WiGO/wgoRadarChart.js
- web/lib/NHL/teamsInfo.js
- web/lib/apollo-client.js
- web/lib/sanity/sanity.js
- web/lib/sanity/sanity.server.js
- web/lib/supabase/GoaliePage/updateWeeklyData.js
- web/lib/supabase/Upserts/fetchPPTOIdata.js
- web/lib/supabase/Upserts/fetchPowerRankings.js
- web/lib/supabase/Upserts/fetchRollingGames.js
- web/lib/supabase/Upserts/fetchSKOskaterStats.js
- web/lib/supabase/Upserts/fetchSKOyears.js
- web/lib/supabase/Upserts/fetchSoSgameLog.js
- web/lib/supabase/Upserts/fetchStandings.js
- web/lib/supabase/Upserts/fetchWGOdata.js
- web/lib/supabase/Upserts/fetchWGOgoalieData.js
- web/lib/supabase/Upserts/fetchWGOgoalieStats.js
- web/lib/supabase/Upserts/fetchWGOskaterStats.js
- web/lib/supabase/Upserts/supabaseShifts.js
- web/lib/supabase/shotsByCoord.js
- web/lib/supabase/sosStandings.js
- web/next-seo.config.js
- web/next-sitemap.config.js
- web/tmp-test-sheets.mjs
- web/utils/fetchCurrentseason.js

## ts-prune (Unused TS exports)

- vitest.config.mts:5 - default
- contexts/RoundSummaryContext.tsx:18 - useRoundSummaryData
- hooks/useDebounce.ts:9 - useDebounce
- hooks/useGoals.tsx:11 - default (used in module)
- hooks/useGoals.tsx:310 - GoalIndicators
- hooks/useOffseason.ts:12 - useOffseason
- hooks/usePlayerRecommendations.ts:9 - Recommendation (used in module)
- hooks/usePlayerStats.ts:19 - usePlayerStats
- hooks/usePlayerWeeklyStats.ts:32 - WeeklyPerformanceData (used in module)
- hooks/usePlayerWeeklyStats.ts:190 - default
- hooks/useProcessedProjectionsData.tsx:36 - AggregatedStatValue (used in module)
- hooks/useProcessedProjectionsData.tsx:112 - CustomAdditionalProjectionSource (used in module)
- hooks/useProcessedProjectionsData.tsx:125 - UseProcessedProjectionsDataProps (used in module)
- hooks/useProcessedProjectionsData.tsx:143 - UseProcessedProjectionsDataReturn (used in module)
- hooks/useProjectionSourceAnalysis.ts:20 - useProjectionSourceAnalysis
- hooks/useProjectionSourceAnalysis.ts:6 - SourceControl (used in module)
- hooks/useProjectionSourceAnalysis.ts:13 - SourceControlsState
- hooks/useTeamAbbreviation.ts:9 - useTeamAbbreviation
- hooks/useTeamStats.ts:58 - default
- hooks/useTeamStats.ts:5 - TeamStats (used in module)
- hooks/useTeamStats.ts:33 - TeamGameStats (used in module)
- hooks/useTeamStatsFromDb.ts:154 - useTeamGameStats
- hooks/useTeamStatsFromDb.ts:8 - TeamStatsRecord (used in module)
- hooks/useTeamStatsFromDb.ts:10 - TeamRecord (used in module)
- hooks/useTeamStatsFromDb.ts:21 - TeamGameStats (used in module)
- hooks/useVORPCalculations.ts:5 - LeagueType (used in module)
- hooks/useVORPCalculations.ts:8 - DraftSettings (used in module)
- hooks/useVORPCalculations.ts:25 - UseVORPParams (used in module)
- hooks/useVORPCalculations.ts:37 - UseVORPResult (used in module)
- hooks/useWGOPlayerStats.ts:9 - useWGOSkaterStats
- hooks/useWGOPlayerStats.ts:57 - useWGOGoalieStats
- lib/drawHockeyRink.ts:15 - drawHockeyRink
- pages/_app.tsx:90 - default
- pages/_document.tsx:5 - default
- pages/charts.tsx:308 - default
- pages/draft-dashboard.tsx:12 - default
- pages/drm.tsx:48 - default
- pages/index.tsx:572 - getServerSideProps
- pages/index.tsx:748 - default (used in module)
- pages/podfeed.tsx:33 - default
- pages/skoCharts.tsx:311 - default
- pages/statsPlaceholder.tsx:297 - getStaticProps
- pages/statsPlaceholder.tsx:483 - default
- pages/teamStats.tsx:75 - default
- pages/testLogoMaker.tsx:51 - default
- pages/trueGoalieValue.tsx:919 - default
- pages/wigoCharts.tsx:380 - default
- pages/xGoalsPage.tsx:15 - default
- stories/Button.stories.ts:24 - default
- stories/Button.stories.ts:28 - Primary
- stories/Button.stories.ts:35 - Secondary
- stories/Button.stories.ts:41 - Large
- stories/Button.stories.ts:48 - Small
- stories/Button.tsx:5 - ButtonProps (used in module)
- stories/Header.stories.ts:22 - default
- stories/Header.stories.ts:25 - LoggedIn
- stories/Header.stories.ts:33 - LoggedOut
- stories/Header.tsx:10 - HeaderProps (used in module)
- stories/Page.stories.ts:15 - default
- stories/Page.stories.ts:18 - LoggedOut
- stories/Page.stories.ts:21 - LoggedIn
- styles/wigoColors.ts:57 - CHART_PALETTE (used in module)
- utils/analytics.ts:14 - calculateBayesianUpdate
- utils/analytics.ts:32 - calculateEMA
- utils/analytics.ts:50 - calculateRollingAverage
- utils/fetchScheduleData.ts:5 - fetchScheduleData
- utils/fetchWigoPlayerStats.ts:917 - fetchPercentilePlayerData
- utils/formattingUtils.ts:113 - formatTOIFromSecondsWithLeadingZero
- utils/memoize.ts:3 - memoizeAsync
- .next/types/routes.d.ts:56 - ParamsOf
- .next/types/routes.d.ts:62 - AppRoutes (used in module)
- .next/types/routes.d.ts:62 - PageRoutes (used in module)
- .next/types/routes.d.ts:62 - LayoutRoutes (used in module)
- .next/types/routes.d.ts:62 - RedirectRoutes (used in module)
- .next/types/routes.d.ts:62 - RewriteRoutes (used in module)
- .next/types/routes.d.ts:62 - ParamMap (used in module)
- components/common/OptimizedImage.tsx:15 - OptimizedImageProps (used in module)
- components/common/PanelStatus.tsx:5 - PanelStatusProps (used in module)
- components/common/PanelStatus.tsx:18 - PanelStatus (used in module)
- components/DateRangeMatrix/DateRangeMatrixForGames.tsx:20 - default
- components/DateRangeMatrix/index.tsx:31 - MySet
- components/DateRangeMatrix/index.tsx:416 - isForward (used in module)
- components/DateRangeMatrix/index.tsx:416 - isDefense (used in module)
- components/DateRangeMatrix/lineCombinationHelper.ts:6 - LinePairResult (used in module)
- components/DateRangeMatrix/utilities.ts:9 - Shift
- components/DraftDashboard/ImportCsvModal.tsx:10 - CsvPreviewRow (used in module)
- components/DraftDashboard/SuggestedPicks.tsx:9 - SuggestedPicksProps (used in module)
- components/GameGrid/OpponentMetricsTable.tsx:12 - TeamStats (used in module)
- components/GameGrid/TeamRow.tsx:20 - MatchUpCellData
- components/GoaliePage/goalieCalculations.ts:37 - rankingPoints (used in module)
- components/GoaliePage/goalieCalculations.ts:51 - calculateStandardDeviation (used in module)
- components/GoaliePage/goalieCalculations.ts:81 - calculateGameFantasyPoints (used in module)
- components/GoaliePage/goalieTypes.ts:55 - AggregatedGoalieData
- components/GoaliePage/goalieTypes.ts:97 - Week
- components/GoaliePage/goalieTypes.ts:114 - Season
- components/GoaliePage/goalieTypes.ts:120 - ApiGoalieData
- components/GoaliePage/goalieTypes.ts:123 - ApiSeasonData
- components/GoaliePage/goalieTypes.ts:130 - ApiResponse
- components/Layout/Layout.tsx:21 - Footer (used in module)
- components/LinemateMatrix/index.tsx:469 - LinemateMatrixInternal (used in module)
- components/LinemateMatrix/index.tsx:310 - OPTIONS (used in module)
- components/PlayerPickupTable/PlayerPickupTable.tsx:14 - UnifiedPlayerData (used in module)
- components/PlayerPickupTable/PlayerPickupTable.tsx:50 - PlayerWithPercentiles (used in module)
- components/PlayerPickupTable/PlayerPickupTable.tsx:55 - PlayerWithScores (used in module)
- components/PlayerPickupTable/PlayerPickupTable.tsx:62 - MetricKey (used in module)
- components/PlayerPickupTable/PlayerPickupTable.tsx:82 - MetricDefinition (used in module)
- components/PlayerPickupTable/PlayerPickupTable.tsx:165 - TeamWeekData (used in module)
- components/PlayerPickupTable/PlayerPickupTable.tsx:171 - PlayerPickupTableProps (used in module)
- components/PlayerPPTOIPerGameChart/PlayerPPTOIPerGameChart.tsx:310 - default
- components/PlayerStats/types.ts:4 - BaseGameLogEntry (used in module)
- components/PlayerStats/types.ts:22 - SkaterGameLogEntry (used in module)
- components/PlayerStats/types.ts:98 - GoalieGameLogEntry (used in module)
- components/PlayerStats/types.ts:348 - STAT_FORMATTERS (used in module)
- components/PlayerStats/types.ts:605 - CalendarDay
- components/PlayerStats/types.ts:615 - CalendarTooltipData
- components/PlayerStats/types.ts:622 - PerformanceLevel
- components/PlayerStats/types.ts:640 - StatFormatter
- components/PlayerStats/types.ts:641 - PercentileCalculator
- components/Projections/ProjectionSourceAnalysis.tsx:444 - ProjectionSourceAnalysis (used in module)
- components/TeamStatCard/index.ts:1 - default
- components/WiGO/fetchThreeYearAverages.ts:12 - fetchThreeYearAverages
- components/WiGO/ratingsConstants.ts:5 - OFFENSE_RATING_STATS
- components/WiGO/ratingsConstants.ts:44 - DEFENSE_RATING_STATS
- components/WiGO/ratingsConstants.ts:82 - HIGHER_IS_BETTER_MAP
- components/WiGO/TeamNameSVG.tsx:111 - default
- components/WiGO/types.ts:60 - SkaterStat
- components/WiGO/types.ts:80 - PlayerStats
- components/WiGO/types.ts:85 - YearlyCount (used in module)
- components/WiGO/types.ts:153 - YearlyRate (used in module)
- components/WiGO/types.ts:200 - ThreeYearCountsAverages (used in module)
- components/WiGO/types.ts:250 - ThreeYearRatesAverages (used in module)
- components/WiGO/types.ts:290 - CareerAverageCounts (used in module)
- components/WiGO/types.ts:340 - CareerAverageRates (used in module)
- components/WiGO/types.ts:406 - NSTRatesTable
- components/WiGO/types.ts:407 - NSTRatesOiTable
- lib/mappers/yahooPlayersToSheet.ts:17 - HEADERS (used in module)
- lib/NHL/NHL_API.ts:5 - fetchNHL
- lib/NHL/NHL_API.ts:3 - NHL_API_URL (used in module)
- lib/NHL/statsPageTypes.ts:3 - PlayerRow
- lib/NHL/statsPageTypes.ts:32 - GoaliePlayerRow
- lib/NHL/teamPageTypes.ts:17 - SoS
- lib/NHL/teamPageTypes.ts:22 - GoalieStat (used in module)
- lib/NHL/teamPageTypes.ts:38 - GoalieStats
- lib/NHL/teamPageTypes.ts:43 - TeamPowerRanking (used in module)
- lib/NHL/teamPageTypes.ts:53 - TeamStats (used in module)
- lib/NHL/teamPageTypes.ts:68 - Team (used in module)
- lib/NHL/teamPageTypes.ts:77 - Rank
- lib/NHL/teamPageTypes.ts:82 - GameStat
- lib/NHL/teamPageTypes.ts:98 - SortedTeamPowerRanking
- lib/NHL/teamPageTypes.ts:102 - PowerScoreConfig
- lib/NHL/teamPageTypes.ts:107 - PowerScoreTeam (used in module)
- lib/NHL/teamPageTypes.ts:113 - SortConfig
- lib/NHL/teamPageTypes.ts:118 - BoxscoreData
- lib/NHL/teamPageTypes.ts:136 - AggregatedTeamStats
- lib/NHL/TOI.ts:110 - default
- lib/NHL/types.ts:273 - TeamGameData (used in module)
- lib/NHL/types.ts:291 - GameSituation
- lib/NHL/types.ts:1593 - SKOSummarySkaterStat
- lib/NHL/types.ts:1611 - DRMShift
- lib/projectionsConfig/fantasyPointsConfig.ts:8 - DEFAULT_SKATER_FANTASY_POINTS (used in module)
- lib/projectionsConfig/fantasyPointsConfig.ts:26 - DEFAULT_GOALIE_FANTASY_POINTS (used in module)
- lib/projectionsConfig/formatTotalSecondsToMMSS.ts:3 - formatTotalSecondsToMMSS
- lib/projectionsConfig/statsMasterList.ts:281 - getStatDefinition
- lib/projectionsConfig/yahooConfig.ts:19 - YahooDirectStat (used in module)
- lib/projectionsConfig/yahooConfig.ts:25 - YAHOO_DIRECT_STATS_CONFIG
- lib/sanity/sanity.server.js:6 - sanityClient (used in module)
- lib/standardization/columnStandardization.ts:4 - defaultCanonicalColumnMap (used in module)
- lib/standardization/nameStandardization.ts:12 - canonicalNameMap (used in module)
- lib/standardization/nameStandardization.ts:889 - commonNicknamesToFormal (used in module)
- lib/supabase/database-generated.types.ts:1 - Json (used in module)
- lib/supabase/database-generated.types.ts:32465 - TablesInsert
- lib/supabase/database-generated.types.ts:32488 - TablesUpdate
- lib/supabase/database-generated.types.ts:32511 - Enums (used in module)
- lib/supabase/database-generated.types.ts:32526 - CompositeTypes (used in module)
- lib/supabase/database-generated.types.ts:32541 - Constants
- lib/sync/syncYahooPlayersToSheet.ts:16 - SyncOptions (used in module)
- pages/api/createComment.ts:8 - default
- pages/api/toi.ts:68 - default
- pages/api/toi.ts:12 - DateString (used in module)
- pages/auth/index.tsx:56 - default
- pages/blog/[slug].tsx:60 - getStaticPaths
- pages/blog/[slug].tsx:104 - getStaticProps
- pages/blog/[slug].tsx:328 - default
- pages/blog/index.tsx:40 - getStaticProps
- pages/blog/index.tsx:77 - default
- pages/db/index.tsx:25 - default
- pages/db/upsert-projections.tsx:145 - default
- pages/game/[gameId].tsx:13 - default (used in module)
- pages/game-grid/[mode].tsx:62 - getServerSideProps
- pages/game-grid/[mode].tsx:68 - default
- pages/game-grid/index.tsx:2 - getServerSideProps
- pages/game-grid/index.tsx:18 - default
- pages/lines/[abbreviation].tsx:94 - default
- pages/lines/[abbreviation].tsx:28 - PlayerBasic (used in module)
- pages/lines/[abbreviation].tsx:281 - getStaticProps
- pages/lines/[abbreviation].tsx:344 - getStaticPaths
- pages/lines/index.tsx:21 - RowData (used in module)
- pages/lines/index.tsx:65 - getStaticProps
- pages/lines/index.tsx:434 - default
- pages/projections/index.tsx:66 - ChartDataType (used in module)
- pages/projections/index.tsx:1539 - default
- pages/stats/index.tsx:52 - default
- pages/stats/index.tsx:787 - getServerSideProps
- pages/teamStats/[teamAbbreviation].tsx:261 - default
- pages/test/index.tsx:4 - default
- stories/WiGO/GameScoreLineChart.stories.tsx:16 - default
- stories/WiGO/GameScoreLineChart.stories.tsx:19 - Primary
- components/GameGrid/contexts/GameGridContext.tsx:23 - useTeams
- components/GameGrid/utils/calcWinOdds.ts:86 - isBackToBack (used in module)
- components/GameGrid/utils/date-func.tsx:46 - dateDiffInDays
- components/GameGrid/utils/useFourWeekSchedule.ts:22 - ScheduleArray (used in module)
- components/LineCombinations/PlayerCard/GoalieCard.tsx:38 - LineChange
- components/ShiftChart/PowerPlayAreaIndicators/index.tsx:15 - default
- lib/NHL/client/index.ts:52 - getGameLogs
- lib/NHL/client/index.ts:73 - getBoxscore
- lib/NHL/server/index.ts:148 - getSeasons
- lib/supabase/GoaliePage/calculateAverages.ts:5 - calculateAverages
- lib/supabase/GoaliePage/calculateGoalieRanking.ts:12 - calculateGoalieRankings
- lib/supabase/GoaliePage/fetchAllGoalies.ts:11 - fetchAllGoalies
- lib/supabase/GoaliePage/types.ts:70 - GoalieWithRanking
- lib/supabase/GoaliePage/types.ts:77 - Week
- lib/supabase/GoaliePage/types.ts:83 - LeagueAverage
- lib/supabase/utils/constants.ts:61 - STAT_LABELS
- lib/supabase/utils/constants.ts:85 - emptyPerGameAverages
- lib/supabase/utils/fetchAllGoalies.ts:12 - fetchAllGoalies
- lib/supabase/utils/fetchAllSkaters.ts:5 - fetchNonGoaliePlayerIds
- lib/supabase/utils/types.ts:72 - StatSummary (used in module)
- lib/supabase/utils/types.ts:93 - PlayerStatistics
- pages/api/Averages/[playerId].ts:10 - default
- pages/api/Averages/helpers.ts:12 - parseTable (used in module)
- pages/api/Averages/helpers.ts:40 - processRows (used in module)
- pages/api/CareerAverages/[playerId].ts:29 - default
- pages/api/cors/index.ts:3 - default
- pages/api/internal/sync-yahoo-players-to-sheet.ts:4 - default
- pages/api/SustainabilityStats/[playerId].ts:16 - default
- pages/api/Teams/[teamAbbreviation].ts:34 - default
- pages/api/Teams/[teamAbbreviation].ts:63 - parseTable (used in module)
- pages/api/Teams/[teamAbbreviation].ts:14 - Data (used in module)
- pages/api/Teams/nst-team-stats.ts:93 - safeParseNumber (used in module)
- pages/api/Teams/nst-team-stats.ts:102 - convertToSeconds (used in module)
- pages/api/Teams/nst-team-stats.ts:112 - default
- pages/api/ThreeYearAverages/[playerId].ts:226 - parseTime (used in module)
- pages/api/ThreeYearAverages/[playerId].ts:232 - default
- pages/api/ThreeYearAverages/[playerId].ts:285 - parseTable (used in module)
- pages/api/ThreeYearAverages/[playerId].ts:8 - Data (used in module)
- pages/api/ThreeYearAverages/[playerId].ts:63 - RatesData (used in module)
- pages/api/v1/season.ts:5 - default
- pages/lines/line-combo/[gameId].tsx:4 - default
- pages/stats/game/[gameId].tsx:3 - default
- pages/stats/player/[playerId].tsx:70 - default
- pages/stats/player/[playerId].tsx:797 - getServerSideProps
- pages/stats/team/[teamAbbreviation].tsx:75 - default
- pages/stats/team/[teamAbbreviation].tsx:450 - getServerSideProps
- pages/api/v1/db/calculate-wigo-stats.ts:201 - default
- pages/api/v1/db/check-missing-goalie-data.ts:463 - default
- pages/api/v1/db/cron-report.ts:16 - default
- pages/api/v1/db/manual-refresh-yahoo-token.ts:6 - default
- pages/api/v1/db/powerPlayTimeFrame.ts:11 - default
- pages/api/v1/db/run-fetch-wgo-data.ts:5 - default
- pages/api/v1/db/shift-charts.ts:1240 - default
- pages/api/v1/db/skaterArray.ts:649 - default
- pages/api/v1/db/update-games.ts:6 - default
- pages/api/v1/db/update-last-7-14-30.ts:333 - default
- pages/api/v1/db/update-nst-current-season.ts:665 - default
- pages/api/v1/db/update-nst-gamelog.ts:1636 - default
- pages/api/v1/db/update-nst-goalies.ts:516 - default
- pages/api/v1/db/update-nst-last-ten.ts:938 - default
- pages/api/v1/db/update-nst-player-reports.ts:789 - default
- pages/api/v1/db/update-PbP.ts:5 - default
- pages/api/v1/db/update-players.ts:7 - default (used in module)
- pages/api/v1/db/update-power-rankings.ts:7 - default
- pages/api/v1/db/update-rolling-games.ts:5 - default
- pages/api/v1/db/update-season-stats.ts:164 - default (used in module)
- pages/api/v1/db/update-season-stats.ts:331 - updateStats (used in module)
- pages/api/v1/db/update-season-stats.ts:328 - isGameFinished (used in module)
- pages/api/v1/db/update-seasons.ts:5 - default
- pages/api/v1/db/update-sko-stats.ts:1510 - default
- pages/api/v1/db/update-team-yearly-summary.ts:5 - default
- pages/api/v1/db/update-teams.ts:7 - default
- pages/api/v1/db/update-wgo-averages.ts:428 - default
- pages/api/v1/db/update-wgo-goalie-totals.ts:205 - default
- pages/api/v1/db/update-wgo-goalies.ts:199 - fetchDataForPlayer (used in module)
- pages/api/v1/db/update-wgo-goalies.ts:788 - default
- pages/api/v1/db/update-wgo-ly.ts:577 - default
- pages/api/v1/db/update-wgo-skaters.ts:1484 - default
- pages/api/v1/db/update-wgo-totals.ts:659 - default
- pages/api/v1/db/update-yahoo-players.ts:194 - default
- pages/api/v1/db/update-yahoo-weeks.ts:32 - default
- pages/api/v1/db/upsert-csv.ts:297 - default
- pages/api/v1/ml/create-materialized-view.ts:17 - default
- pages/api/v1/player/index.ts:4 - default
- pages/api/v1/schedule/[startDate].ts:6 - default
- pages/api/v1/webhooks/on-new-line-combo.ts:7 - default
- pages/api/v1/db/cron/update-stats-cron.ts:4 - default
- pages/api/v1/db/update-expected-goals/calculations.ts:29 - calculateExpectedGoals (used in module)
- pages/api/v1/db/update-expected-goals/calculations.ts:40 - generatePoissonProbabilityMatrix (used in module)
- pages/api/v1/db/update-expected-goals/calculations.ts:74 - calculateWinOdds (used in module)
- pages/api/v1/db/update-expected-goals/calculations.ts:110 - convertAmericanOddsToPercentage (used in module)
- pages/api/v1/db/update-expected-goals/fetchData.ts:115 - fetchGamesByDate (used in module)
- pages/api/v1/db/update-expected-goals/fetchData.ts:8 - LeagueAverages (used in module)
- pages/api/v1/db/update-expected-goals/fetchData.ts:37 - GameOdds (used in module)
- pages/api/v1/db/update-expected-goals/fetchData.ts:58 - GameWeek (used in module)
- pages/api/v1/db/update-expected-goals/fetchData.ts:64 - GamesResponse (used in module)
- pages/api/v1/db/update-expected-goals/index.ts:120 - default
- pages/api/v1/db/update-line-combinations/[id].ts:14 - default
- pages/api/v1/db/update-line-combinations/index.ts:6 - default
- pages/api/v1/db/update-player/[playerId].ts:6 - default (used in module)
- pages/api/v1/db/update-power-play-combinations/[gameId].ts:12 - default
- pages/api/v1/db/update-standings-details/index.ts:9 - default (used in module)
- pages/api/v1/db/update-stats/[gameId].ts:179 - default (used in module)
- pages/api/v1/player/[id]/index.ts:4 - default
- pages/api/v1/team/[seasonId]/index.ts:5 - default
- pages/api/v1/discord/send-message/line-combo/[gameId].ts:8 - default
- pages/api/v1/game/[id]/boxscore/index.ts:6 - default
- pages/api/v1/player/[id]/percentile-rank/index.ts:9 - default
- pages/api/v1/player/[id]/game-log/[season]/[type]/index.ts:6 - default

## Oldest 100 Files by Last Commit (web/)

- 2022-07-07 12:30:30 +1000  web/public/pictures/circle.png
- 2022-07-07 12:30:30 +1000  web/public/pictures/discord.png
- 2022-07-07 13:32:25 +1000  web/public/android-chrome-192x192.png
- 2022-07-07 13:32:25 +1000  web/public/android-chrome-512x512.png
- 2022-07-07 13:32:25 +1000  web/public/favicon-16x16.png
- 2022-07-07 13:32:25 +1000  web/public/favicon-32x32.png
- 2022-07-07 13:32:25 +1000  web/public/favicon.ico
- 2022-07-11 13:29:31 +1000  web/components/Banner/index.ts
- 2022-07-11 13:29:31 +1000  web/components/Layout/index.ts
- 2022-07-11 13:44:51 +1000  web/components/TeamStatCard/TeamStatCard.module.scss
- 2022-07-11 13:44:51 +1000  web/components/TeamStatCard/TeamStatCard.tsx
- 2022-07-11 13:44:51 +1000  web/components/TeamStatCard/index.ts
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/ANA.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/ARI.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/BOS.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/BUF.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/CAR.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/CBJ.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/CGY.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/CHI.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/COL.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/DAL.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/DET.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/EDM.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/FLA.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/LAK.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/MIN.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/MTL.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/NJD.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/NYI.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/NYR.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/OTT.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/PHI.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/PIT.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/SEA.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/SJS.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/STL.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/TBL.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/TOR.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/VAN.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/VGK.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/WPG.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/WSH.jpg
- 2022-07-11 13:44:51 +1000  web/public/teamCardPics/nsh.jpg
- 2022-07-12 15:37:01 +1000  web/components/Banner/Banner.tsx
- 2022-07-12 17:15:08 +1000  web/components/BlogPost/index.ts
- 2022-07-12 18:14:11 +1000  web/lib/sanity/config.js
- 2022-07-12 18:14:11 +1000  web/lib/sanity/sanity.js
- 2022-07-12 18:14:11 +1000  web/lib/sanity/sanity.server.js
- 2022-07-18 17:05:15 +1000  web/components/IconButton/index.ts
- 2022-07-18 17:05:15 +1000  web/public/pictures/share-button.svg
- 2022-07-19 11:38:35 +1000  web/components/CommentForm/index.ts
- 2022-07-19 12:35:00 +1000  web/components/Comments/index.ts
- 2022-07-19 13:33:35 +1000  web/components/RecentPosts/index.ts
- 2022-07-19 18:31:31 +1000  web/utils/formatDate.ts
- 2022-07-20 16:05:07 +1000  web/components/Spinner/index.ts
- 2022-07-20 16:05:39 +1000  web/pages/api/createComment.ts
- 2022-07-20 19:30:36 +1000  web/components/Tooltip/Tooltip.module.scss
- 2022-07-21 10:38:48 +1000  web/public/pictures/heart-filled.png
- 2022-07-21 10:38:48 +1000  web/public/pictures/heart-outlined.svg
- 2022-07-21 10:52:32 +1000  web/components/IconButton/IconButton.module.scss
- 2022-07-21 11:19:50 +1000  web/utils/scrollTop.ts
- 2022-07-21 12:03:59 +1000  web/next-sitemap.config.js
- 2022-07-21 12:55:48 +1000  web/next-seo.config.js
- 2022-07-26 12:32:25 +1000  web/components/PlayerBioCard/index.ts
- 2022-07-27 12:39:09 +1000  web/components/TimeOnIceChart/index.ts
- 2022-07-27 13:22:14 +1000  web/components/Options/index.ts
- 2022-08-02 12:40:34 +1000  web/components/PlayerAutocomplete/index.ts
- 2022-08-02 13:19:11 +1000  web/public/pictures/player-placeholder.jpg
- 2022-08-02 23:51:11 +1000  web/.vscode/launch.json
- 2022-08-03 12:29:25 +1000  web/components/ClientOnly/index.ts
- 2022-08-03 14:36:07 +1000  web/components/RadioOptions/index.ts
- 2022-08-03 17:17:33 +1000  web/components/TimeOptions/index.ts
- 2022-08-04 14:01:56 +1000  web/components/Chart/index.ts
- 2022-08-12 01:55:55 +1000  web/hooks/useSustainabilityStats.ts
- 2022-08-12 01:55:55 +1000  web/lib/NHL/TOI.ts
- 2022-08-15 18:09:06 +1000  web/components/CategoryCoverageChart/index.ts
- 2022-08-15 18:09:06 +1000  web/components/Chart/Chart.tsx
- 2022-08-24 14:32:34 +1000  web/public/pictures/IconSearch.png
- 2022-08-26 12:17:49 +1000  web/public/pictures/arrow.svg
- 2022-08-26 21:12:03 +1000  web/components/SustainabilityVSCareerChart/index.ts
- 2022-08-26 21:31:44 +1000  web/components/Options/Options.module.scss
- 2022-09-01 12:14:50 +1000  web/hooks/useHideableNavbar.ts
- 2022-09-13 19:07:28 +1000  web/components/RadioOptions/RadioOptions.tsx
- 2022-09-14 12:30:32 +1000  web/components/ChartTitle/ChartTitle.tsx
- 2022-09-14 12:30:32 +1000  web/components/ChartTitle/index.ts
- 2022-09-16 11:05:59 +1000  web/public/pictures/download.svg
- 2022-09-16 11:05:59 +1000  web/public/pictures/share.svg
- 2022-09-27 16:53:08 +1000  web/components/Layout/Header/index.ts
- 2022-09-27 16:53:08 +1000  web/components/Layout/MobileMenu/index.ts
- 2022-09-27 16:53:08 +1000  web/components/Layout/NavbarItems/index.ts
- 2022-09-27 16:53:08 +1000  web/components/SocialMedias/index.ts
- 2022-09-27 16:53:08 +1000  web/public/pictures/logo-fhfh.svg
- 2022-09-27 16:53:08 +1000  web/public/pictures/menu-arrow-drop-down.svg
- 2022-09-28 10:41:20 +1000  web/components/GameGrid/Switch/index.ts
- 2022-09-28 10:41:20 +1000  web/components/GameGrid/Toggle/index.ts
- 2022-09-28 10:41:20 +1000  web/components/GameGrid/index.ts
- 2022-10-03 13:14:36 +0800  web/components/PageTitle/PageTitle.tsx
- 2022-10-03 13:14:36 +0800  web/components/PageTitle/index.ts
- 2022-10-03 13:14:36 +0800  web/components/TimeAgo/index.ts

---
Re-run commands:
- In web/: npx -y knip --include files,exports --reporter markdown --no-exit-code
- In web/: npx -y dependency-cruiser --no-config -T json -x '^(node_modules|\.next|dist|build|out|coverage|tmp|\.cache)/' .
- In web/: npx -y ts-prune
