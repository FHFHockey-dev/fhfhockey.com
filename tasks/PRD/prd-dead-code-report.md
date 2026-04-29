# PRD: Dead Code & Hidden Surface Audit

Generated: 2026-04-28

Scope: repository source files under `/Users/tim/Code/fhfhockey.com`, with generated/build/vendor output excluded from conclusions (`node_modules`, `.next`, cache folders, lockfiles). This pass treated a file as dead when it has no credible runtime entrypoint, no imports from production code, and no public-facing navigation/link path. Next.js route files are called out separately because they are technically reachable by URL even when hidden from the site.

## Method

- Enumerated all source files with `rg --files` and `find`.
- Built a lightweight import graph for `web` source files, resolving relative imports and the project aliases used in `tsconfig`.
- Enumerated Next.js routes from `web/pages/**`.
- Searched route/link usage through `Link`, `href`, `router.push`, `router.replace`, string route constants, and navigation config.
- Ran `knip --production --reporter compact` from `web` using a temp npm cache. Default npm cache was blocked by root-owned cache files.
- Reviewed candidate files by content to infer original intent and reduce false positives.

## Headline Findings

- The largest dead-code clusters are legacy analytics surfaces: old WiGO charts, old sKO/prediction charts, old goalie value pages/utilities, and old Supabase/NST upsert helpers.
- Several pages are not in the public navigation but are still valid product/admin routes. These should be documented or protected, not deleted blindly.
- The previous 2025 report included `.next` build artifacts in dependency-cruiser output. Those are generated artifacts and should not drive cleanup decisions.
- `knip` reported 143 unused files in production mode, but this includes tests, scripts, styles, and config false positives. The high-confidence subset is below.

## Public Surface Baseline

Main navigation currently exposes:

- `/`
- `/underlying-stats`
- `/game-grid` redirecting to `/game-grid/7-Day-Forecast`
- `/stats`
- `/trends`
- `/lines`
- `/drm`
- `/splits`
- `/draft-dashboard`
- `/start-chart`
- `/wigoCharts`
- `/shiftChart`
- `/variance/skaters`
- `/variance/goalies`
- `/blog`
- `/podfeed`

Additional in-product links expose dynamic/detail surfaces such as `/game/[gameId]`, `/stats/player/[playerId]`, `/stats/team/[teamAbbreviation]`, `/lines/[abbreviation]`, `/forge/dashboard`, `/forge/player/[playerId]`, `/forge/team/[teamId]`, `/trends/player/[playerId]`, and the underlying-stats player/goalie/team explorer routes.

## High-Confidence Dead Pages

These are public URL routes only by virtue of being in `pages/`, but they are not linked from the product surface and appear obsolete, empty, or development-only.

| File | Route | Likely intent | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| `web/pages/FantasyPowerRankings.js` | `/FantasyPowerRankings` | Placeholder for fantasy power rankings. | Component returns an empty `<div>`. No navigation or meaningful runtime. | Delete. |
| `web/pages/PowerRankings.js` | `/PowerRankings` | Placeholder for generic power rankings. | Component returns an empty `<div>`. No navigation or meaningful runtime. | Delete. |
| `web/pages/test/index.tsx` | `/test` | One-off line-combination test harness. | Renders `h`, calls `getLineCombinations(26)` in `useEffect`, no public links. | Delete or move to a real test. |
| `web/pages/testLogoMaker.tsx` | `/testLogoMaker` | Manual logo/component sandbox. | Hard-coded selector and inline demo styling, no public links. | Delete if `LogoMaker` is no longer actively developed. |
| `web/pages/cssTestingGrounds.tsx` + `web/pages/cssTestingGrounds.module.scss` | `/cssTestingGrounds` | Internal style-system sandbox. | Development/review copy, no public navigation. | Keep only if actively used; otherwise delete or move to Storybook/docs. |
| `web/pages/statsPlaceholder.tsx` | `/statsPlaceholder` | Old team-stats/SOS placeholder before current `/stats` and `/underlying-stats`. | Old local Windows path comment, duplicates current stats/team concepts, no links. | Delete after a quick screenshot/data parity check if desired. |
| `web/pages/xGoalsPage.tsx` | `/xGoalsPage` | League-wide xGoals heatmap prototype. | Thin wrapper around `components/HeatMap/xGoals`, no navigation. | Delete route; keep component only if referenced elsewhere. |
| `web/pages/trendsTestingGrounds.tsx` | `/trendsTestingGrounds` | Manual trends API rebuild/fetch tester. | Calls `/api/v1/trends/player-trends` and rebuild APIs from an unlinked form. | Delete or convert into protected admin tooling. |

## Hidden Or Legacy Product Pages

These are not in main navigation and should be treated as hidden projects. Some are still reachable, but they do not appear to be first-class user-facing surfaces.

| File | Route | Likely intent | Current status | Recommendation |
| --- | --- | --- | --- | --- |
| `web/pages/buyLowSellHigh.js` | `/buyLowSellHigh` | Early buy-low/sell-high skater sustainability dashboard. | Direct client Supabase reads, old comments/TODOs, no nav. | Candidate delete after confirming no external bookmarks matter. |
| `web/pages/goalies.js` | `/goalies` | Original goalie value dashboard. | Largely superseded by `/variance/goalies`, `/underlying-stats/goalieStats`, and `/stats/player`. | Candidate delete or redirect to `/variance/goalies`. |
| `web/pages/trueGoalieValue.tsx` | `/trueGoalieValue` | Earlier “true goalie value” implementation. | Duplicates goalie page concepts and uses old shared goalie utilities. No nav. | Candidate delete or redirect to `/variance/goalies`. |
| `web/pages/teamStats.tsx` | `/teamStats` | Legacy team card index. | Links to `/teamStats/[teamAbbreviation]`, but current nav favors `/stats` and `/underlying-stats`. | Candidate delete/redirect after verifying `/teamStats/[teamAbbreviation]` replacement. |
| `web/pages/projections/index.tsx` | `/projections` | Legacy projection comparison dashboard. | Rich page, but hidden from nav and likely superseded by FORGE/start-chart workflows. | Product decision: either promote, protect, or delete. |
| `web/pages/skoCharts.tsx` | `/skoCharts` | Legacy sKO chart route. | Page explicitly says it is quarantined and not production-facing. | Keep only as quarantine notice; otherwise delete with lineage note in docs. |
| `web/pages/trendsDebug.tsx` | `/trendsDebug` | Rolling metric/sustainability debug workspace. | Debug/admin functionality, no nav. | Protect behind admin auth or delete after extracting useful checks into tests. |
| `web/pages/twitterEmbeds/index.tsx` | `/twitterEmbeds` | Manual/diagnostic page for CCC tweet embeds. | Uses server-side Supabase data, no nav. | Protect or delete if replaced by `/lines`/lineup ingestion UI. |
| `web/pages/FORGE.tsx` | `/FORGE` | Earlier uppercase FORGE landing/dashboard. | Internal links reference it through `ForgeRouteNav`, but main product route is `/forge/dashboard`. | Prefer redirect to `/forge/dashboard` or remove duplicate after checking nav behavior. |

## Hidden Admin/Operational Routes

These are not user-facing, but they appear intentionally operational rather than dead.

| File | Route | Purpose | Recommendation |
| --- | --- | --- | --- |
| `web/pages/db/index.tsx` | `/db` | Manual database/admin job launcher. | Keep only if protected by role/auth in runtime; otherwise protect or remove. |
| `web/pages/db/upsert-projections.tsx` | `/db/upsert-projections` | Manual projection CSV upsert/admin workflow. | Keep protected or remove if replaced by FORGE pipeline. |
| `web/pages/db/player-aliases.tsx` | `/db/player-aliases` | Player alias review admin UI. | Keep protected if active; otherwise move to admin docs/tooling. |
| `web/pages/api/v1/db/**` | `/api/v1/db/**` | Cron/manual ingestion and refresh endpoints. | Not user-facing. Do not delete from import graph alone; audit against cron inventory and external scheduler config. |
| `web/pages/api/v1/webhooks/on-new-line-combo.ts` | API route | Line-combo screenshot/webhook workflow. | Operational, not public product. Keep if webhook still configured. |
| `webhooks/**` | separate Express app | Long-running line-combo screenshot capture service. | Hidden project. Keep only if deployed/configured; otherwise archive/delete. |
| `functions/**` | separate Vercel/Python app | Hosted Python/NST helper functions. | Not dead: docs and `tasks/nst-direct-caller-inventory.md` identify `functions/api/fetch_team_table.py` as production-reachable. |
| `cms/**` | Sanity Studio | CMS for `/studio/**`. | Not dead: root README and `web/next.config.js` rewrite `/studio` to CMS URL. |

## High-Confidence Dead Components And Utilities

These had no inbound imports in the custom graph and were also reported by `knip --production`, excluding obvious test/config/script false positives.

### Legacy sKO / Prediction Chart Cluster

| Files | Likely intent | Evidence | Recommendation |
| --- | --- | --- | --- |
| `web/components/GameScoreChart/GameScoreChart.tsx`, `web/components/GameScoreChart/GameLogTable.tsx` | Visualize actual vs predicted legacy sKO game scores. | File comment explicitly says “Legacy sKO-only chart component” retained for lineage and not approved for live FORGE use. No inbound imports. | Delete or move lineage notes to docs. |
| `web/components/SkoLineChart/LineChart.tsx` | D3 line chart for old sum-of-z-score thresholds. | No inbound imports; sKO route is quarantined. | Delete with sKO cleanup. |
| `web/components/Predictions/*` including `PredictionsLeaderboard.tsx`, `PlayerTable.tsx`, `MetricCards.tsx`, `InfoPopover.tsx`, `SearchBox.tsx`, `Sparkline.tsx`, `Stepper.tsx`, `SkoExplainer.tsx` | Old prediction leaderboard UI around `/api/v1/ml/get-predictions-sko`. | `knip` marks cluster unused; no production page imports it. | Delete unless `/projections` or FORGE will intentionally revive it. |
| `web/lib/hooks/usePredictionsSko.ts`, `web/lib/trends/skoTypes.ts`, `web/lib/trends/skoUtils.ts` | Data hook/types used by the unused prediction cluster. | Marked unused by `knip`; only referenced by unused prediction components. | Delete with prediction cluster if no revival planned. |

### Legacy WiGO Chart Cluster

| Files | Likely intent | Evidence | Recommendation |
| --- | --- | --- | --- |
| `web/components/WiGO/WigoDoughnutChart.js`, `web/components/WiGO/WigoLineChart.js`, `web/components/WiGO/wgoRadarChart.js` | Old Chart.js WiGO visuals. | No inbound imports; newer WiGO dashboard components exist and route `/wigoCharts` remains in nav. | Delete after confirming current WiGO route does not use them dynamically. |
| `web/components/WiGO/TeamNameSVG.tsx` | SVG team-name renderer for old WiGO UI. | No inbound imports. | Delete. |
| `web/components/WiGO/fetchThreeYearAverages.ts` | Client fetch helper for old three-year averages endpoint. | No inbound imports. | Delete if endpoint is also retired. |
| `web/components/WiGO/ratingsConstants.ts` | Old WiGO rating constants. | No inbound imports. | Delete if not part of current scoring contract. |

### Legacy Goalie / Team / Upsert Utilities

| Files | Likely intent | Evidence | Recommendation |
| --- | --- | --- | --- |
| `web/lib/supabase/GoaliePage/calculateAverages.ts`, `calculateGoalieRanking.ts`, `calculateRanking.ts`, `fetchAllGoalies.ts`, `fetchGoalieDataForWeek.js`, `goaliePageWeeks.js`, `updateWeeklyData.ts`, `upsertGoalieData.js`, `types.ts` | Old goalie-page weekly aggregation/upsert layer. | Reported unused by `knip`; current goalie pages use newer `components/GoaliePage/*` and underlying-stats APIs. | Delete with legacy goalie route cleanup after checking any manual scripts. |
| `web/lib/supabase/Upserts/fetchPPTOIdata.js`, `fetchPowerRankings.js`, `fetchRollingGames.js`, `fetchSKOskaterStats.js`, `fetchSKOyears.js`, `fetchSoSgameLog.js`, `fetchStandings.js`, `fetchWGOgoalieData.js`, `fetchWGOgoalieStats.js`, `fetchWGOskaterStats.js`, `supabaseShifts.js` | Old standalone ingestion scripts/helpers. | CommonJS scripts with hard-coded env/bootstrap patterns; no inbound imports in web runtime. | Candidate delete after confirming no external cron invokes them directly. |
| `web/lib/supabase/shotsByCoord.js`, `web/lib/supabase/sosStandings.js` | Old Supabase query helpers. | No inbound imports. | Delete if no manual script usage exists. |
| `web/lib/supabase/utils/calculations.ts`, `dataFetching.ts`, `fetchAllGoalies.ts`, `fetchAllSkaters.ts`, `statistics.ts`, `types.ts` | Older shared utility layer for goalie/skater stats. | Marked unused by `knip`; newer domain-specific helpers exist. | Delete only after legacy goalie/projections pages are removed. |

### Other Unused UI/Utility Files

| Files | Likely intent | Evidence | Recommendation |
| --- | --- | --- | --- |
| `web/components/DateRangeMatrix/DateRangeMatrixForGames.tsx` | Wrapper to embed DRM by team/date/mode. | No inbound imports; current `/drm` imports `DateRangeMatrix` directly. | Delete unless planned for game detail embedding. |
| `web/components/PlayerPPTOIPerGameChart/PlayerPPTOIPerGameChart.tsx` | Old per-player PP TOI chart. | No inbound imports; reads `sko_pp_stats` directly. | Delete. |
| `web/components/TeamLandingPage/teamStats.js` and `teamStats.scss` | React Router-era team stats module. | Imports `react-router-dom`, local `teamsInfo`, and CSS path inconsistent with Next app. No inbound imports. | Delete. |
| `web/components/TeamStatCard/*` | Standalone team stat card. | No inbound imports. | Delete unless Storybook coverage is desired. |
| `web/components/TeamPpPersonnelSnapshot/*` | PP personnel mini-module linking to `/lines/[team]`. | No inbound imports, but concept is product-relevant. | Either wire into team pages or delete. |
| `web/components/forge-dashboard/TopMoversCard.tsx` | Earlier team movers card. | No inbound imports; dashboard uses other forge-dashboard cards. | Delete if superseded. |
| `web/lib/NHL/NHL_API.ts` | Old wrapper around `statsapi.web.nhl.com/api/v1`. | Uses retired NHL API base; no inbound imports. | Delete. |
| `web/lib/projectionWeights.ts` | Integer projection source weight helpers. | No inbound imports. | Delete if projection UI no longer supports manual source weights. |
| `web/lib/projectionsConfig/formatTotalSecondsToMMSS.ts` | Duplicate time formatter. | No inbound imports; `formatToMMSS.ts` and `formatDurationMmSs.ts` exist. | Delete. |
| `web/utils/analytics.ts` | Generic Bayesian/EMA/rolling average helpers. | No inbound imports. | Delete or move formulas into a tested active module. |
| `web/utils/dateUtils.ts`, `web/utils/fetchScheduleData.ts`, `web/utils/memoize.ts` | Generic helpers. | Reported unused by `knip`; no inbound imports in custom graph. | Delete if no scripts require them. |

## Root-Level And Generated/Temporary Candidates

| File/Directory | Likely intent | Recommendation |
| --- | --- | --- |
| `web/tmp-run-sync.ts`, `web/tmp-test-sheets.mjs`, `web/tmp-check-games.ts`, `web/tmp-check-pbp-games.ts`, `web/tmp-check-pbp-structure.js`, `web/tmp-check-seasons.js`, `web/tmp/**` | Temporary investigation scripts/artifacts. | Delete or move durable findings into `tasks/artifacts`. |
| `web/debug-goalies.ts` | Manual goalie debug script. | Delete if no longer used. |
| `web/web/scripts/output/**` | Nested generated model/output artifacts under duplicated `web/web` path. | Treat as generated artifacts; decide whether to archive outside source control. |
| `yahoo_historical.log` | Historical Yahoo ingest log. | Delete from repo if not needed for an audit trail; logs should not be source files. |
| `check_db.js`, `find_templates.py`, `fix_templates.py`, `safe_properties.py`, `update_game_page.py`, `fix_terminal.sh` | One-off maintenance scripts. | Keep only if documented; otherwise delete/archive. |
| `underlying-stats/**` at repo root | Older standalone service/types parallel to `web/lib/underlying-stats`. | No runtime linkage found. Candidate delete after confirming it is not used by external scripts. |

## Not Dead Despite Tool Flags

These were flagged by the import graph or `knip`, but should not be deleted based on this pass.

- `web/next.config.js`, `web/next-sitemap.config.js`, `web/vercel.json`: framework/deploy entrypoints.
- `web/lib/supabase/database-generated.types.ts`: generated type surface; unused exports are expected.
- `web/scripts/**`: many are package-script targets or manual operational scripts, not app imports.
- `web/tests/**`, `web/__tests__/**`, `*.test.ts`, `*.test.tsx`: test entrypoints.
- `web/styles/_panel.scss`, `web/styles/mixins.scss`, `web/styles/vars.scss`: Sass partials are used through Sass resolution that `knip` misreported as unresolved.
- `cms/**`: Sanity Studio, surfaced via `/studio/**`.
- `functions/**`: separate serverless app; `functions/api/fetch_team_table.py` is documented as production-reachable.
- Dynamic detail routes such as `/stats/player/[playerId]`, `/stats/team/[teamAbbreviation]`, `/trends/player/[playerId]`, `/forge/player/[playerId]`, `/forge/team/[teamId]`, and underlying-stats detail routes: they are linked through runtime data rather than static nav arrays.

## Recommended Cleanup Order

1. Delete empty/stub routes first: `FantasyPowerRankings.js`, `PowerRankings.js`, `/test`.
2. Delete temporary/debug routes or protect them: `testLogoMaker`, `cssTestingGrounds`, `trendsTestingGrounds`, `trendsDebug`, `twitterEmbeds`.
3. Decide legacy product replacements, then delete or redirect: `goalies`, `trueGoalieValue`, `buyLowSellHigh`, `teamStats`, `projections`, `FORGE`, `skoCharts`.
4. Remove the dead component clusters once their pages are deleted: legacy sKO/prediction, WiGO chart, goalie utility, old upsert helper clusters.
5. Clean temporary/generated root files and nested generated outputs.
6. Re-run `knip --production` and a focused build/test pass after each cleanup batch.

## Verification Notes

- `npx knip --production --no-progress --reporter compact` completed only with `npm_config_cache=/tmp/npm-cache` because the default npm cache has root-owned files.
- The first `knip` conclusion should be filtered: it reports Sass alias false positives and test/script entrypoints as unused.
- No files were deleted in this pass; this document is an audit update only.
