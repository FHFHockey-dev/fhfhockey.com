# PRD: Dead Code & Hidden Surface Audit

> **Implementation task list:** `tasks/TASKS/dead-code-cleanup/tasks-prd-dead-code-report.md`

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
| `web/pages/FantasyPowerRankings.js` | `/FantasyPowerRankings` | Retired empty placeholder. | No navigation or meaningful runtime; deleted under the approved pure-route cohort. | Removed. |
| `web/pages/PowerRankings.js` | `/PowerRankings` | Retired empty placeholder. | No navigation or meaningful runtime; deleted under the approved pure-route cohort. | Removed. |
| `web/pages/test/index.tsx` | `/test` | Retired line-combination test harness. | Its utility already has direct tests and supported route consumers; deleted under the approved pure-route cohort. | Removed. |
| `web/pages/testLogoMaker.tsx` | `/testLogoMaker` | Retired manual logo prototype. | No public link or second component consumer; route and exclusive implementation removed. | Removed. |
| `web/pages/cssTestingGrounds.tsx` + `web/pages/cssTestingGrounds.module.scss` | `/cssTestingGrounds` | Internal style-system sandbox. | Development/review copy, no public navigation. | Keep only if actively used; otherwise delete or move to Storybook/docs. |
| `web/pages/statsPlaceholder.tsx` | `/statsPlaceholder` | Old team-stats/SOS placeholder before current `/stats` and `/underlying-stats`. | Old local Windows path comment, duplicates current stats/team concepts, no links. | Delete after a quick screenshot/data parity check if desired. |
| `web/pages/xGoalsPage.tsx` | `/xGoalsPage` | Retired league-wide xGoals heatmap prototype. | No navigation or second component consumer; route and exclusive implementation removed. | Removed. |
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
| `webhooks/**` | retired separate Express app | Former duplicate long-running line-combo screenshot capture service. | Deleted after exact local consumer/config proof and read-only Vercel inventory found no standalone project; canonical Next.js route retained. |
| `functions/**` | separate Vercel/Python app | Hosted Python/NST helper functions. | Not dead: docs and `tasks/TASKS/xg-model/nst-migration/nst-direct-caller-inventory.md` identify `functions/api/fetch_team_table.py` as production-reachable. |
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
| `web/components/WiGO/WigoDoughnutChart.js`, `web/components/WiGO/WigoLineChart.js`, `web/components/WiGO/wgoRadarChart.js` | Old Chart.js WiGO visuals. | No inbound imports; newer WiGO dashboard components exist and route `/wigoCharts` remains in nav. | Deleted 2026-07-29 after exact static/dynamic consumer review. |
| `web/components/WiGO/TeamNameSVG.tsx` | SVG team-name renderer for old WiGO UI. | No inbound imports. | Deleted 2026-07-29. |
| `web/components/WiGO/fetchThreeYearAverages.ts` | Client fetch helper for old three-year averages endpoint. | No inbound imports. | Deleted 2026-07-29; active WiGO has no dependency on the helper. |
| `web/components/WiGO/ratingsConstants.ts` | Old WiGO rating constants. | No inbound imports. | Deleted 2026-07-29; active rating ownership remains in current WiGO modules. |

### Legacy Goalie / Team / Upsert Utilities

| Files | Likely intent | Evidence | Recommendation |
| --- | --- | --- | --- |
| `web/lib/supabase/GoaliePage/calculateAverages.ts`, `calculateGoalieRanking.ts`, `calculateRanking.ts`, `fetchAllGoalies.ts`, `fetchGoalieDataForWeek.js`, `goaliePageWeeks.js`, `updateWeeklyData.ts`, `upsertGoalieData.js`, `types.ts` | Old goalie-page weekly aggregation/upsert layer. | Reported unused by `knip`; current goalie pages use newer `components/GoaliePage/*` and underlying-stats APIs. | Delete with legacy goalie route cleanup after checking any manual scripts. |
| `web/lib/supabase/Upserts/fetchPPTOIdata.js`, `fetchPowerRankings.js`, `fetchRollingGames.js`, `fetchSKOskaterStats.js`, `fetchSKOyears.js`, `fetchSoSgameLog.js`, `fetchStandings.js`, `fetchWGOgoalieData.js`, `fetchWGOgoalieStats.js`, `fetchWGOskaterStats.js`, `supabaseShifts.js` | Old standalone ingestion scripts/helpers. | CommonJS scripts with hard-coded env/bootstrap patterns; no inbound imports in web runtime. B-DRM NEW 22 removed `supabaseShifts.js` value-bearing credential logs locally; its self-executing entry point still requires value-free external-consumer inventory. | Candidate delete after confirming no external cron invokes them directly; do not retire the entry point or rotate a shared credential without the separate production checkpoint. |
| `web/lib/supabase/shotsByCoord.js`, `web/lib/supabase/sosStandings.js` | Old Supabase query helpers. | No inbound imports. | Delete if no manual script usage exists. |
| `web/lib/supabase/utils/calculations.ts`, `dataFetching.ts`, `fetchAllGoalies.ts`, `fetchAllSkaters.ts`, `statistics.ts`, `types.ts` | Older shared utility layer for goalie/skater stats. | Marked unused by `knip`; newer domain-specific helpers exist. | Delete only after legacy goalie/projections pages are removed. |

### Other Unused UI/Utility Files

| Files | Likely intent | Evidence | Recommendation |
| --- | --- | --- | --- |
| `web/components/DateRangeMatrix/DateRangeMatrixForGames.tsx` and the default export in `web/components/DateRangeMatrix/index.tsx` | Legacy wrappers around the unified raw/view and matrix-renderer paths. | Neither default wrapper has a runtime consumer; `/drm` uses `useDateRangeMatrixData`, `DateRangeMatrixView`, and props-only `LinePairGrid` directly. | Retain unchanged in quarantine; delete only after future explicit product-scope approval. |
| `web/components/PlayerPPTOIPerGameChart/PlayerPPTOIPerGameChart.tsx` | Old per-player PP TOI chart. | No inbound imports; reads `sko_pp_stats` directly. | Deleted 2026-07-29; current `PPTOIChart.tsx` remains consumed by legacy team detail. |
| `web/components/TeamLandingPage/teamStats.js` and `teamStats.scss` | React Router-era team stats module. | Imports `react-router-dom`, local `teamsInfo`, and CSS path inconsistent with Next app. No inbound imports. | Deleted 2026-07-29. |
| `web/components/TeamStatCard/*` | Standalone team stat card. | No inbound imports. | Deleted 2026-07-29. |
| `web/components/TeamPpPersonnelSnapshot/*` | PP personnel mini-module linking to `/lines/[team]`. | No inbound imports, but concept is product-relevant. | Deleted 2026-07-29 after exact current-consumer review. |
| `web/components/forge-dashboard/TopMoversCard.tsx` | Earlier team movers card. | Bounded re-audit confirmed zero inbound runtime imports; active `/trends` imports the shared `TopMovers` visualization directly. | Deleted 2026-07-29 as the sole proven-unused B-FORGE-COMBO wrapper. |
| `web/lib/NHL/NHL_API.ts` | Old wrapper around `statsapi.web.nhl.com/api/v1`. | Uses retired NHL API base; no inbound imports. | Deleted 2026-07-29. |
| `web/lib/projectionWeights.ts` | Integer projection source weight helpers. | No inbound imports. | Deleted 2026-07-29. |
| `web/lib/projectionsConfig/formatTotalSecondsToMMSS.ts` | Duplicate time formatter. | No inbound imports; `formatToMMSS.ts` and `formatDurationMmSs.ts` exist. | Deleted 2026-07-29. |
| `web/utils/analytics.ts` | Generic Bayesian/EMA/rolling average helpers. | No inbound imports. | Deleted 2026-07-29. |
| `web/utils/dateUtils.ts`, `web/utils/fetchScheduleData.ts`, `web/utils/memoize.ts` | Generic helpers. | Exact review disproves the grouped claim for `dateUtils`: `usePlayerWeeklyStats` actively imports it; the other two have no consumer. | Retain `dateUtils`; deleted `fetchScheduleData` and `memoize` 2026-07-29. |

## Root-Level And Generated/Temporary Candidates

| File/Directory | Likely intent | Recommendation |
| --- | --- | --- |
| `web/tmp-run-sync.ts`, `web/tmp-test-sheets.mjs`, `web/tmp-check-games.ts`, `web/tmp-check-pbp-games.ts`, `web/tmp-check-pbp-structure.js`, `web/tmp-check-seasons.js`, `web/tmp/**` | Temporary investigation scripts/artifacts. | Delete or move durable findings into `tasks/artifacts`. |
| `web/debug-goalies.ts` | Manual goalie debug script. | Delete if no longer used. |
| `web/web/scripts/output/**` | Nested generated model/output artifacts under duplicated `web/web` path. | Retain as owner-authorized historical SKO evidence; any future removal requires a new explicit checkpoint. |
| `yahoo_historical.log` | Historical Yahoo ingest log. | Forward-untracked and ignored on 2026-07-21 while its physical local copy remains; value-free sensitivity review found no high-confidence/current credential and did not justify history rewriting. |
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
5. Clean temporary/generated root files; preserve the explicitly retained historical SKO outputs.
6. Re-run `knip --production` and a focused build/test pass after each cleanup batch.

## Verification Notes

- `npx knip --production --no-progress --reporter compact` completed only with `npm_config_cache=/tmp/npm-cache` because the default npm cache has root-owned files.
- The first `knip` conclusion should be filtered: it reports Sass alias false positives and test/script entrypoints as unused.
- No files were deleted in this pass; this document is an audit update only.

## 2026-07-22 Current-State Refresh

- `rg --files` now counts 3,401 tracked paths, 2,050 web source/style files, 331 page entrypoints, and 256 API entrypoints. The current boundary also includes 48 package scripts, 20 Vercel cron definitions, the separately verified 64 active pg_cron jobs, one GitHub workflow, and distinct `functions` (53 files), `webhooks` (4), and `cms` (22) roots.
- Temporary-cache `knip` 5.88.1 completed `--production --no-progress --reporter compact` and returned the expected findings exit with 173 unused-file candidates. Tests, scripts, generated/framework/config entrypoints, separate apps, operational modules, and 126 Sass-alias resolution failures remain explicit false-positive classes; the raw count is not a deletion list.
- All original page, hidden-surface, operational, component/utility, and generated/temp candidate families were compared to current files, navigation/config, the latest SKO/DRM/CLEAN classifications, and the current scan. The named legacy component families remain candidates, but old upserts and operational modules retain manual/external-caller uncertainty and cannot pass the no-consumer or deletion gate from `knip` alone.
- The 24 previously tracked generated-state artifacts remain absent from Git and narrowly ignored. Their producers and durable conclusions remain; the four duplicated nested SKO outputs remain tracked as owner-authorized historical evidence with exact hash/size and secret/path-scan provenance.

### Named stub/development route dispositions

| Route | Current evidence | Disposition |
| --- | --- | --- |
| `/FantasyPowerRankings`, `/PowerRankings` | Both empty files had no navigation/config/runtime-link consumer. | Removed under the owner-approved pure-route cohort. |
| `/test` | Rendered only `h` and called already-tested line-combination code on mount; no product/config consumer. | Removed under the owner-approved pure-route cohort. |
| `/testLogoMaker` | Unlinked hard-coded manual logo selector; its component had no second consumer. | Route and exclusive component removed. |
| `/cssTestingGrounds` | Current reviewed/approved style-system catalog and referenced smoke surface. | Keep and document as a supported review surface; not dead. |
| `/statsPlaceholder` | Hidden legacy SoS/team-stats implementation with no product link; canonical `/stats` and `/underlying-stats` replacements exist. | Redirect/delete decision remains approval-gated; retain until replacement parity is explicitly accepted. |
| `/xGoalsPage` | Unlinked thin prototype wrapper; its xGoals component had no second consumer. | Route and exclusive component removed. |
| `/trendsTestingGrounds` | Unlinked but now read-only; mutation was removed during the Sustainability audit. | Keep as an explicitly quarantined diagnostics surface until its remaining checks move to tests/admin/runbook ownership. |

The later owner-approved cohort removes only the five classified pure empty/test/prototype routes and their three exclusive implementation files. Supported and quarantined routes remain unchanged.

Exact checkpoint `146ca692faf8b3469c05c91912a1e72ce90dcaa3` publishes the 11-row current-state reconciliation with source/master 11/35 and global 4,431/4,874 parity.

The 2026-07-22 parent-parity reconciliation closes parent 2.0 because all four generated/debris classification, cleanup, ignore, and no-consumer children are verified. B-DEAD is now 12/35 with 23 open; no additional file or route was removed.

## 2026-07-25 Candidate Delta Reconciliation

A fresh `knip` 5.88.1 production scan reports 174 raw unused-file candidates and 127 unresolved Sass-alias imports. The one-candidate increase from the published 173-row baseline is not treated as proof of deadness. Bounded source/history review keeps the renamed SKO reader and prediction UI in their existing B-SKO quarantine, keeps test/script-owned Sustainability and operational modules as explicit entrypoints/false positives, and removes moved API helpers from dead-code consideration because current imports consume their new library paths. No newly verified defect requires a duplicate NEW row; existing B-SKO, B-CLEAN, and route-removal gates retain their ownership.

This closes changed/new-candidate disposition row 1.4 and baseline parent 1.0 without deleting or modifying a route, component, utility, dependency, or external system. B-DEAD is 14/35 with 21 open.

## 2026-07-25 Operational Security Reconciliation

The standalone `webhooks` Express service is an operational mutation surface, not a dead-code candidate. Its prior bearer parser accepted any scheme whose last whitespace-delimited token matched `CRON_SECRET`, returned HTTP 200 on denial, and relayed raw mutation failures. The local boundary now requires one exact nonblank bearer through timing-safe comparison, returns fixed 401/500 responses, and has direct missing-config/malformed/wrong/exact-token coverage. The parallel Next.js line-combination route retains shared `adminOnly` authorization while removing its Puppeteer endpoint log and raw public error/stack response.

The `/db` page previously hid only selected cards while rendering the broader operational shell and running initial reads for non-admin visitors. It now waits for resolved auth state, renders only an access boundary to non-admin users, and gates its initial public-table and resume-state reads on administrator identity. Every downstream mutation/API boundary remains independently authorized.

The later ownership reconciliation proves the standalone service had no repository consumer or deployment configuration, the Production trigger targets the canonical Next.js route, and the only live Vercel team has no standalone webhook project. The six-file duplicate service is therefore retired. Current Production proves signed-out `/db` settles on an administrator-required shell without operational controls/tables, missing webhook auth returns 401 before work, the functions health owner returns 200, and CMS requires a Sanity login provider before any editor surface. A malformed bearer exposed Supabase parser detail; NEW 8.9 fixes that locally in the shared middleware, and NEW 8.3 remains open only for publication plus exact fixed Production denial. No webhook work, screenshot, upload, Discord call, deployment, database/storage write, or CMS/provider mutation occurred.

## 2026-07-29 Hidden Product Ownership Reconciliation

The current route-to-owner matrix supersedes the original hidden-page recommendations without authorizing a runtime change. `/goalies` is redirect compatibility for canonical `/variance/goalies`; `/skoCharts` is the B-SKO historical-only quarantine; `/FORGE` remains a supported Quick Read surface; `/trendsDebug` is the rolling-metrics validation console; and `/twitterEmbeds` is a bounded, sanitized Lines/GDL read surface. `/buyLowSellHigh`, `/trueGoalieValue`, `/teamStats*`, and `/projections` remain unchanged legacy families behind explicit redirect/removal/product approval.

Exact link/source scans plus the current FORGE, Trends Debug, Twitter Embeds, and trueGoalieValue suites (4 files/28 tests) support the classifications. This closes reconciliation/synchronization rows 4.1 and 4.4 only. Rows 3.3, 4.2, 4.3, 5.2–5.4, operational ownership, and final verification remain open. B-DEAD is 19/38 with 19 open; no route, component, utility, navigation, sitemap, rewrite, access policy, build, deployment, or external state changed.

## 2026-07-29 Hidden Product Quarantine and Admin Boundary

Five retained legacy routes across four families now use one shared visible quarantine notice with `noindex,nofollow` and a named canonical destination: buy-low/sell-high and legacy team stats point to Underlying Stats, true goalie value points to Variance, and legacy projections point to FORGE. Their behavior remains available for bookmarks; no redirect or route removal was required.

The active `/trendsDebug` page now resolves administrator identity before mounting the validation console, so loading and denied states start no console data access. `/api/v1/debug/rolling-player-metrics` uses the existing fail-closed `adminOnly` middleware while retaining its read-only validation contract for authorized operators.

The notice, page, and API suites pass 22/22 tests; full TypeScript passes; scoped ESLint reports zero errors and only the pre-existing `teamStats` image warning. This closes 4.2, 4.3, and parent 4.0. B-DEAD is 22/38 with 16 open. Route deletion/redirect approval, component/utility consumer proof and deletion, external operational ownership, and final verification remain open. No hosted build, deployment, database, provider, schedule, shared checkout, push, or external state changed.

## 2026-07-29 Targeted Component and Utility Cleanup

Exact path, symbol, runtime, script, config, separate-root, and documentation scans isolate 14 zero-consumer files from the broader candidate set. The bounded removal deletes the retired NHL API wrapper, duplicate time formatter, unused projection-weight/analytics/schedule/memoize utilities, obsolete PPTOI chart, React Router-era team stats pair, standalone TeamStatCard, and unwired Team PP personnel snapshot: 1,313 lines total.

The review also disproves the grouped deletion claim for `web/utils/dateUtils.ts`: `usePlayerWeeklyStats` actively imports `getWeekStartDates`, so P3 NEW 8.4 records its retention before any deletion. Current `PPTOIChart.tsx`, retained route dependencies, historical SKO/prediction evidence, DRM quarantine, and old operational upserts with manual/external-caller uncertainty remain untouched. Thus 5.2 remains open rather than overstating complete consumer proof.

Deleted-path/symbol scans are empty, full TypeScript passes, and the current Variance and Underlying Team Stats suites pass 2 files/8 tests. This closes 5.3/5.4 and NEW 8.4. B-DEAD is 25/39 with 14 open. No build, deployment, database, provider, schedule, credential, shared checkout, push, or external state changed.

The follow-on active-WiGO check proves the three old Chart.js visuals, `TeamNameSVG`, `fetchThreeYearAverages`, and `ratingsConstants` have no static, dynamic, script, config, workflow, separate-root, or current route consumer. All six files (668 lines) are deleted. The current WiGO cohort passes 9 files/28 tests and full TypeScript; exact deleted-symbol scans are empty. Cumulative targeted cleanup is 20 files/1,981 lines. This strengthens closed 5.3/5.4 but does not close 5.2 while operational/manual/external-caller and owner-quarantined clusters remain. No build or external state changed.

## 2026-07-30 Final Verification Refresh

The post-cleanup `knip` 5.88.1 production scan reports 155 raw unused-file candidates, down from 174 before the bounded removals. Its 164 unresolved imports are exclusively Sass alias-analysis false positives; the exact Production build succeeds. Tests, scripts, framework/config entrypoints, manual operational modules, quarantined surfaces, and separate apps remain intentional non-deletion classes. The scan initially exposed three undeclared transitive packages across four active imports; the canonical manifest and lock now directly own already-locked `@sanity/client` 3.4.1, `domhandler` 5.0.3, and `progress` 2.0.3, and the rerun reports zero unlisted dependencies.

Exact deleted-path checks find none of the 20 removed files restored. Route/config comparison preserves all approval-gated routes, 48 package scripts, 20 Vercel cron definitions, and every canonical replacement link. Guarded recovery `96ccea804` is READY/Production as `dpl_HCFwiK4yAPeXUG3QzC3R28NtYvsc`; seven public shells return 200, both unauthenticated rolling routes return 401, populated Start Chart desktop/mobile plus bounded restored-reader surfaces pass, and deployment-scoped runtime-error/5xx queries are empty. Final integrity row 7.3 and parent 7.0 close; B-DEAD is 33/41 with eight open. No migration or writer ran.
