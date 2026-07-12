## Relevant Files

- `tasks/TASKS/contextual-hockey-rankings/prd-rankings-ecosystem-alignment-audit.md` - Source PRD for this alignment and remediation task list.
- `tasks/TASKS/contextual-hockey-rankings/tasks-prd-rankings-ecosystem-alignment-audit.md` - Working task list updated as implementation and verification progress is made.
- `web/pages/rankings.tsx` - Main rankings workstation page, entity-aware headings, methodology panel, tab shell, entity-specific matrix composition, skater snapshot rank-mode wiring, and goalie workload snapshot notes.
- `web/components/Rankings/RankingsFilters.tsx` - Filter controls for entity, team, display mode, deployment/role, sample, source quality, and matrix column visibility.
- `web/components/Rankings/PlayerMatrixTable.tsx` - Skater matrix table, rank-mode rendering, score cells, source-state details, pagination, and legend.
- `web/components/Rankings/GoalieMatrixTable.tsx` - Goalie matrix table with workload columns, live goalie metric cells, compact accessible source-state markers, source legend, and source-pending metric contract notice.
- `web/components/Rankings/TeamMatrixTable.tsx` - Team matrix table with live team context metrics, compact accessible raw/stale/source-state markers, source legend, and source-pending team usage contract notice.
- `web/components/Rankings/PlayerSnapshotPanel.tsx` - Selected skater snapshot, rank-scope-aware strengths/weaknesses, composite provenance cards, current-contract MCM copy, and explanation copy.
- `web/lib/rankings/rankingUrlState.ts` - Canonical `/rankings` URL state, defaults, client request builders, and team-filter serialization.
- `web/lib/rankings/rankingTypes.ts` - Shared skater API request/response types, source metadata fields, and query parsing for contextual rankings.
- `web/lib/rankings/teamTokenResolver.ts` - Shared team-token resolver for numeric ids, abbreviations, and full team names.
- `web/lib/rankings/playerMatrix.ts` - Skater matrix API builder, durable/fallback source selection, composite overlays, page-scoped metric reads, response caching, and overall/deployment scope lookups.
- `web/lib/rankings/entityMetricRankingReader.ts` - Durable `entity_metric_rankings` reader with batched metric reads, narrowed selects, snapshot-date caching, and optional metadata hydration.
- `web/lib/rankings/rankingQueries.ts` - Metric Explorer snapshot-first ranking surface builder and rolling fallback source path.
- `web/lib/rankings/rankingCalculator.ts` - Dense rank, percentile, lower-is-better normalization, sample gates, and peer-group warning logic.
- `web/lib/rankings/rankingMetadata.ts` - Shared methodology glossary, including better-than-peer percentile semantics.
- `web/lib/rankings/metricDefinitions.ts` - Metric definitions, source quality flags, availability states, denominator metadata, planned relative metrics, and Results Luck / PP-points contracts.
- `web/lib/rankings/matrixMetricRegistry.ts` - Matrix metric groups, visible/default columns, planned metrics, current-contract composite tooltips, and caveat metadata.
- `web/lib/rankings/skaterCompositeWriter.ts` - Composite writer for offense, defense, current-contract MCM/BEAST, archetype proxies, and Results Luck provenance.
- `web/lib/rankings/entityMetricRankingWriter.ts` - Durable snapshot writer that now emits better-than-peer percentile explanation items from the shared calculator.
- `web/lib/rankings/skaterCompositeMethodology.ts` - Methodology contracts for current-contract MCM/BEAST, source-pending PP points, ratings, archetype proxies, and Results Luck.
- `web/lib/rankings/goalieMatrix.ts` - Goalie matrix source aggregation, raw/adjusted/core start-share role context, xGA/Shot, Value Signal, HD SV%, source-pending goalie metric contracts, metric rankings, and response caching.
- `web/lib/rankings/goalieMethodology.ts` - Goalie role, quality start, really bad start, steal game, and adjusted netshare methodology helpers.
- `web/lib/rankings/teamMatrix.ts` - Team matrix source aggregation, team style rows, WGO game-context metrics, raw/stale source warnings, source-pending team usage contracts, and response caching.
- `web/lib/rankings/teamStyleMethodology.ts` - Team style and game-context methodology helpers, source-backed context formulas, and source-pending line/pair/PP-unit contracts.
- `web/lib/rankings/teamUnitToiBuilder.ts` - Pure builder for durable team unit-TOI aggregate rows from NHL shift rows and power-play combination rows.
- `web/lib/rankings/teamUnitToiWriter.ts` - Supabase source fetcher and upsert helper for `team_unit_toi` rebuilds with paginated reads and chunked writes.
- `web/lib/rankings/entityCoverageContracts.ts` - Entity coverage contracts for live and planned skater, goalie, team metric coverage, and team usage source gaps.
- `web/lib/rankings/availableFilters.ts` - Published filter availability metadata for skaters, goalies, teams, tabs, live metrics, and source-pending metric contracts.
- `web/pages/api/v1/contextual-rankings.ts` - Metric Explorer API route using resolved team-token parsing and snapshot-first ranking for skater leaderboards.
- `web/pages/api/v1/contextual-rankings/matrix.ts` - Skater matrix API route using resolved team-token parsing.
- `web/__tests__/pages/rankings.test.tsx` - Page-level tests for rankings rendering, labels, controls, and entity mode behavior.
- `web/__tests__/pages/api/v1/contextual-rankings.test.ts` - Metric Explorer API route tests, including text team-token resolution.
- `web/__tests__/pages/api/v1/contextual-rankings-matrix.test.ts` - Skater matrix API route tests, including text team-token resolution and validation.
- `web/components/Rankings/RankingsFilters.test.tsx` - Filter-control tests for display labels, team input behavior, and entity-specific controls.
- `web/components/Rankings/PlayerMatrixTable.test.tsx` - Matrix rendering tests for rank scopes, source badges, and dense table states.
- `web/components/Rankings/GoalieTeamMatrixTable.test.tsx` - Goalie/team matrix component coverage for goalie workload columns, goalie xGA/Shot/HD SV%, team context columns, source-pending contract notices, accessible source-state markers, legends, and table states.
- `web/components/Rankings/PlayerSnapshotPanel.test.tsx` - Snapshot rank-scope switching, explanation, current-contract MCM, and composite-card provenance tests.
- `web/lib/rankings/rankingUrlState.test.ts` - URL-state and request-path tests, including skater team filter, goalie metric URL parsing, and selected-player stability behavior.
- `web/lib/rankings/rankingCalculator.test.ts` - Ranking math tests for percentile semantics, dense ranks, lower-is-better, and sample gates.
- `web/lib/rankings/rankingCalculator.lowerIsBetter.test.ts` - Lower-is-better percentile-direction tests for suppression metrics.
- `web/lib/rankings/teamTokenResolver.test.ts` - Unit tests for numeric, abbreviation, name, empty, and unknown team tokens.
- `web/lib/rankings/playerMatrix.test.ts` - Skater matrix API builder tests for durable source metadata, fallback behavior, rank scopes, and performance-sensitive fan-out.
- `web/lib/rankings/entityMetricRankingReader.test.ts` - Durable ranking reader tests for filters, metadata, and snapshot row interpretation.
- `web/lib/rankings/rankingQueries.test.ts` - Metric Explorer tests for snapshot-first ranking, source metadata, and rolling fallback behavior.
- `web/lib/rankings/entityMetricRankingWriter.test.ts` - Durable snapshot writer tests for better-than-peer explanation copy and insert mapping.
- `web/lib/rankings/rankingFormatters.test.ts` - Explanation formatter tests for better-than-peer percentile copy.
- `web/lib/rankings/skaterCompositeWriter.test.ts` - Composite writer tests for current-contract MCM/BEAST, PP-points exclusion/provenance, and source-freshness behavior.
- `web/lib/rankings/goalieMatrix.test.ts` - Goalie matrix tests for role buckets, raw/adjusted/core start-share context, adjusted netshare, xGA/Shot, Value Signal, HD SV%, and source-pending metric contracts.
- `web/lib/rankings/teamMatrix.test.ts` - Team matrix tests for style metrics, WGO game-context aggregation, source states, and future team-style contracts.
- `web/lib/rankings/teamStyleMethodology.test.ts` - Team style methodology tests for raw style formulas, WGO game-context formulas, and source-pending team usage contracts.
- `web/lib/rankings/teamUnitToiBuilder.test.ts` - Builder tests for 5v5 overlap math, skipped non-5v5 segments, PP unit aggregation, and combined source rows.
- `web/e2e/rankings.spec.ts` - Browser smoke test for core rankings flows after UX/performance changes.
- `web/scripts/check-rankings-matrix-performance.ts` - Multi-surface performance check for default skater matrix, Metric Explorer, goalie matrix, and team matrix budgets/source summaries.
- `web/scripts/check-rankings-source-health.ts` - Multi-surface source-health check for snapshot/fallback/source-state validation across skater, Metric Explorer, goalie, and team views.
- `web/scripts/check-team-unit-toi-source-health.ts` - Dry-run source-health check for the derived team unit-TOI aggregate endpoint.
- `web/pages/api/v1/db/update-team-unit-toi.ts` - Admin-only dry-run/live rebuild endpoint for durable `team_unit_toi` aggregate rows.
- `web/supabase/migrations/20260622150500_create_team_unit_toi.sql` - Supabase migration for the `team_unit_toi` table, indexes, RLS, grants, and public read policy.
- `web/package.json` - Adds the `check:team-unit-toi-source-health` script.
- `web/next.config.js` - Dev-server watch configuration and possible place to document/mitigate `EMFILE` behavior.

### Notes

- Use the existing Vitest setup for unit/component tests and Playwright for real-browser smoke checks.
- Keep this pass additive and compatibility-preserving. Do not remove source-pending states or fabricate unavailable metrics.
- Preserve unrelated dirty worktree changes. Inspect `git status --short` before editing and keep changes scoped to the rankings ecosystem.
- Before adding any table, metric source, or source resolver, verify whether an equivalent table/helper already exists in the repo or Supabase.
- Baseline captured during task 1.0 on the existing local server at `http://localhost:3000`: skater matrix returned 10 rows from `entity_metric_rankings` in 16.6s, goalie matrix returned 10 of 98 in 17.0s, team matrix returned 10 of 32 in 10.9s, and Metric Explorer returned 100 rows from `rolling_player_game_metrics` in 26.0s.
- Default table population check for season `20252026`, snapshot `2026-04-16`, `season`/`5v5`: `entity_metric_rankings` had 13,192 matching rows and `skater_composite_ratings` had 1,552 matching rows.
- Browser baseline via Chrome confirmed skater, goalie, team, More Filters, rank-mode toggle, and Metric Explorer flows render without visible error states. It also confirmed current UX gaps: H1 remains `Player Rankings` for all entities, goalie/team Quick Info still shows `Points/60 Percentile`, source-state labels are dense in goalie/team rows, and Metric Explorer remains slow.
- A direct headless Playwright script could not run because the expected local Chromium binary was missing from the Playwright cache; Chrome browser-control was used for the task 1.5 baseline instead.
- From task 2.0 onward, this is an implementation backlog, not a continued audit. Source checks are included only where they directly unblock a concrete build step.
- Task 2.0 verification passed with `npm test -- --run __tests__/pages/rankings.test.tsx components/Rankings/RankingsFilters.test.tsx components/Rankings/PlayerSnapshotPanel.test.tsx` from `web`.
- Task 3.0 verification passed with `npm test -- --run lib/rankings/teamTokenResolver.test.ts lib/rankings/rankingUrlState.test.ts lib/rankings/rankingTypes.test.ts lib/rankings/playerMatrix.test.ts __tests__/pages/api/v1/contextual-rankings-matrix.test.ts __tests__/pages/api/v1/contextual-rankings.test.ts` from `web`; live resolver check returned `BOS` as team id `6` / `Boston Bruins`.
- Task 4.0 verification passed with `npm test -- --run lib/rankings/playerMatrix.test.ts lib/rankings/entityMetricRankingReader.test.ts __tests__/pages/rankings.test.tsx __tests__/pages/api/v1/contextual-rankings-matrix.test.ts` from `web`; a live matrix build without `ranking_source` returned `rankingSource: "entity_metric_rankings"`, 10 rows, snapshot `2026-04-16`, and no fallback reason in 17.4s, leaving performance improvement to task 6.0.
- Task 5.0 verification passed with `npm test -- --run lib/rankings/rankingQueries.test.ts lib/rankings/entityMetricRankingReader.test.ts lib/rankings/rankingTypes.test.ts __tests__/pages/api/v1/contextual-rankings.test.ts __tests__/pages/rankings.test.tsx` from `web`; a live Metric Explorer build for `sog_per_60`, season `20252026`, `season`/`5v5`, limit `100` returned `rankingSource: "entity_metric_rankings"`, 100 rows, snapshot `2026-04-16`, and no fallback reason in 6.1s, leaving response-budget improvement to task 6.0.
- Task 6.0 verification passed with `npm test -- --run lib/rankings/goalieMatrix.test.ts lib/rankings/teamMatrix.test.ts lib/rankings/playerMatrix.test.ts lib/rankings/entityMetricRankingReader.test.ts lib/rankings/rankingQueries.test.ts` from `web` and `npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/check-rankings-matrix-performance.ts --baseUrl http://localhost:3000 --warmRuns 1`; localhost timings were skater matrix 27ms cold / 7ms warm, Metric Explorer 4407ms cold / 1493ms warm, goalie matrix 8659ms cold / 9ms warm, and team matrix 3768ms cold / 8ms warm. Source health also passed and reported durable snapshots for default skater and common 5v5 Metric Explorer checks, rolling fallback for PP goals/60, goalie partial NST warnings, and team raw/stale style warnings.
- Task 7.0 verification passed with `npm test -- --run lib/rankings/rankingCalculator.test.ts lib/rankings/rankingCalculator.lowerIsBetter.test.ts lib/rankings/goalieMatrix.test.ts lib/rankings/teamMatrix.test.ts lib/rankings/entityMetricRankingWriter.test.ts lib/rankings/rankingFormatters.test.ts components/Rankings/PlayerMatrixTable.test.tsx __tests__/pages/rankings.test.tsx` from `web`; better-than-peer semantics now produce 100 for an untied best row, 0 for the worst row, shared tied-row percentiles based on strictly worse peers, and 100 for a one-row qualified peer group.
- Existing durable `entity_metric_rankings` rows store percentile values. The code path and writer contract now use better-than-peer semantics, but published snapshot rows should be regenerated before treating existing durable snapshot data as fully refreshed under the new semantics.
- Task 8.0 verification passed with `npm test -- --run components/Rankings/GoalieTeamMatrixTable.test.tsx components/Rankings/PlayerMatrixTable.test.tsx` from `web`; compact source-state marker search found no repeated visible `Source pending`, `Stale source`, `Raw context`, or `Source caveat` cell labels outside the skater legend.
- Task 9.0 verification passed with `npm test -- --run components/Rankings/PlayerSnapshotPanel.test.tsx lib/rankings/rankingUrlState.test.ts __tests__/pages/rankings.test.tsx` from `web`; skater snapshots now follow the active overall/deployment rank mode, metric explanations include peer/rank/sample/source context, composite cards expose methodology/source provenance, and selected-player snapshot state remains serialized across matrix URL changes.
- Task 10.0 verification passed with `npm test -- --run lib/rankings/skaterCompositeMethodology.test.ts lib/rankings/skaterCompositeWriter.test.ts lib/rankings/metricDefinitions.test.ts lib/rankings/matrixMetricRegistry.test.ts components/Rankings/PlayerSnapshotPanel.test.tsx components/Rankings/PlayerMatrixTable.test.tsx` from `web`; live MCM/BEAST now exclude source-pending `pp_points_per_60` with explicit provenance, Results Luck is presented as the current 100-centered index, relative 5v5 metrics remain planned until team-without-player baselines exist, and archetype contracts are labeled as current proxies.
- Task 11.0 verification passed with `npm test -- --run lib/rankings/goalieMatrix.test.ts lib/rankings/goalieMethodology.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/rankings.test.tsx` from `web`; goalie rows now expose raw selected-window start share, inferred top-two/core adjusted share, core share, role confidence, and role notes, while the matrix and snapshot UI show the workload context without presenting inferred injury/call-up status as certain.
- Task 12.0 verification passed with `npm test -- --run lib/rankings/goalieMatrix.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx lib/rankings/rankingUrlState.test.ts components/Rankings/RankingsFilters.test.tsx __tests__/pages/rankings.test.tsx lib/rankings/snapshot.test.ts` from `web`; xGA/Shot, Value Signal, and HD SV% are source-backed live goalie metrics from `goalie_stats_unified`/NST fields, while Relative SV% and Under Pressure are explicit source-pending contracts with required source fields.
- Task 13.0 verification passed with `npm test -- --run lib/rankings/teamStyleMethodology.test.ts lib/rankings/teamMatrix.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx lib/rankings/rankingUrlState.test.ts components/Rankings/RankingsFilters.test.tsx __tests__/pages/rankings.test.tsx lib/rankings/rankingMetadata.test.ts` from `web`; team matrix now publishes source-backed 1-Goal%, Home Edge, PP Opp/G, and Pen/60 metrics from `wgo_team_stats`, while Forward Top Load, Defense Pair Top Load, and PP1/PP2 Usage Share are explicit source-pending contracts because current lineup tables identify units but do not publish verified unit TOI shares.
- Task 13.0 targeted lint passed with `npm run lint -- --file lib/rankings/teamMatrix.ts --file lib/rankings/teamStyleMethodology.ts --file components/Rankings/TeamMatrixTable.tsx --file pages/rankings.tsx --file lib/rankings/availableFilters.ts --file lib/rankings/rankingUrlState.ts`; only existing `@next/next/no-img-element` warnings in `pages/rankings.tsx` were reported.
- A full `npx tsc --noEmit --pretty false` previously failed on rankings type issues in `entityMetricRankingReader.ts`, `goalieMatrix.ts`, and `rankingUrlState.test.ts`; the task 14.0 pass resolved the active build blockers and current full TypeScript verification now passes.
- During the task 14.0 pass, `entityMetricRankingReader.ts` and `goalieMatrix.ts` build blockers were fixed; `npx tsc --noEmit --pretty false` now passes from `web`.
- Task 14.0 verification passed with `npx tsc --noEmit --pretty false`, `npm test -- --run __tests__/pages/rankings.test.tsx __tests__/pages/api/v1/contextual-rankings-metadata.test.ts __tests__/pages/api/v1/contextual-rankings.test.ts __tests__/pages/api/v1/contextual-rankings-matrix.test.ts lib/rankings/playerMatrix.test.ts lib/rankings/goalieMatrix.test.ts lib/rankings/teamMatrix.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx`, and `npm run check:rankings-source-health -- --baseUrl http://localhost:3000` from `web`.
- Task 14.0 source health reported required source/methodology metadata for default skater matrix, Metric Explorer durable rows, Metric Explorer PP fallback, goalie matrix, and team matrix. It also confirmed `wgo_team_stats.home_road` is not published in the current live table, so Home Edge is now explicit Source Pending instead of crashing the team matrix or fabricating a value.
- Task 15.1 verification passed with `npm run dev:stable -- -p 3101` from `web`; `/rankings` returned HTTP 200 and the server output showed clean startup/compile with no `EMFILE` watcher errors.
- Task 15.2/15.4 verification confirmed `web/README.md`, `web/package.json`, and `web/playwright.config.ts` already document and wire the workspace-local Playwright cache. `npm run test:e2e:rankings:workspace -- --list` discovers `web/e2e/rankings.spec.ts`, and the stale `Player Rankings` assertion was updated to `Skater Rankings`.
- Task 15.3 verification passed with `npm run e2e:install:workspace` from `web`; Playwright downloaded Chromium, FFmpeg, and Chromium Headless Shell into `web/.ms-playwright`.
- After the workspace install, `PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e:rankings:workspace` still failed before page load with the documented Codex macOS sandbox launch error: `MachPortRendezvousServer ... Permission denied (1100)`. This confirms the install path is repaired, while actual browser execution still requires the host machine or CI runner described in `web/README.md`.
- Task 16.0 targeted verification passed with `npm test -- --run __tests__/pages/rankings.test.tsx components/Rankings/RankingsFilters.test.tsx lib/rankings/rankingUrlState.test.ts lib/rankings/rankingCalculator.test.ts lib/rankings/playerMatrix.test.ts lib/rankings/skaterCompositeWriter.test.ts lib/rankings/goalieMatrix.test.ts lib/rankings/teamMatrix.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx components/Rankings/PlayerMatrixTable.test.tsx components/Rankings/PlayerSnapshotPanel.test.tsx` from `web`.
- Task 16.0 performance verification passed with `npm run check:rankings-matrix-performance -- --baseUrl http://localhost:3000 --warmRuns 1`; warm timings were skater matrix 9ms, Metric Explorer 1491ms, goalie matrix 7ms, and team matrix 13ms, all within configured budgets.
- Task 16.0 WAR verification passed through `/api/v1/contextual-rankings/war`: status `source_pending`, row count `0`, rows `0`, methodology `source_pending`, and formula `null`.
- Task 16.0 Chrome smoke passed on `http://localhost:3000/rankings`: skater matrix, `team=BOS`, More Filters, rank-mode toggle, Metric Explorer, goalie matrix/snapshot sections, team matrix/snapshot sections, WAR Source Pending, and console-error checks all passed with no captured application console errors.
- Task 17.1 identified the existing durable snapshot rebuild path: `web/pages/api/v1/db/update-entity-metric-rankings.ts`. Local dry run command: `curl 'http://localhost:3000/api/v1/db/update-entity-metric-rankings?season=20252026&windows=season,last5,last10,last20&strength=5v5&position=all&deployment=all&min_gp=1&min_toi=300&dryRun=true'`. Local live upsert command, requiring explicit approval before use: `curl -X POST 'http://localhost:3000/api/v1/db/update-entity-metric-rankings?season=20252026&windows=season,last5,last10,last20&strength=5v5&position=all&deployment=all&min_gp=1&min_toi=300&dryRun=false&upsertChunkSize=500'`.
- Task 17.2 live rebuild/upsert was triggered through the local admin endpoint after explicit user action. The API response returned `success: true`, `dryRun: false`, `generatedRows: 52768`, and `rowsUpserted: 52768` across `season`, `last5`, `last10`, and `last20` windows for `20252026` / `5v5` / all skaters.
- Task 17.3 verified regenerated durable rows directly from `entity_metric_rankings`: `goals_per_60` has an untied best row at percentile `100`, worst qualified rows at `0`, and tied groups matching the strictly-worse-peer formula across all four rebuilt windows. Percentage metrics with tied best groups correctly do not receive a top `100` percentile under the strict tie semantics.
- Task 17.4 post-rebuild source health passed with `npm run check:rankings-source-health -- --baseUrl http://localhost:3000`. The skater matrix and 5v5 Metric Explorer checks used `entity_metric_rankings` snapshot `2026-04-16`; PP goals/60 remains an expected rolling fallback. Chrome page smoke passed on `/rankings?...sort_metric=goals_per_60...ranking_source=entity_metric_rankings` with rebuilt source/snapshot signals, no visible errors, and no console errors.
- Task 18.1-18.3 source inspection found raw/partial ingredients but no complete published team/game unit-TOI aggregate suitable for direct rankings use. `nhl_api_shift_rows` is well populated for `20252026` with 1,055,088 player-shift rows and can support derived on-ice overlap calculations. `shift_charts` has 34,345 rows for `20252026`, but only 4,366 rows with `line_combination` and 2,296 rows with `pairing_combination`; this is not enough coverage for season-level team usage metrics. `line_combinations` is not a verified current-game TOI source; latest sampled rows were 2023 playoff tweets. `powerPlayCombinations` has 38,723 rows with player `PPTOI`, unit labels, and `pp_share_of_team`, but team-style PP1/PP2 usage still needs an explicit unit-level aggregation rule before it can be published as a team metric.
- Task 20.1-20.4 implemented a durable `team_unit_toi` aggregate contract and rebuild path. The migration stores unit rows as pooled player-seconds with `toi_basis = pooled_player_seconds`, RLS enabled, public read policy, and indexes for latest/team/game lookups. The builder derives 5v5 forward-line and defense-pair overlap from `nhl_api_shift_rows`, resolves PP unit team identity from shift rows, and aggregates PP units from `powerPlayCombinations` without treating summed player PPTOI as raw clock seconds. Verification passed with `npm test -- --run lib/rankings/teamUnitToiBuilder.test.ts`, `npx tsc --noEmit --pretty false`, and `npm run check:team-unit-toi-source-health -- --baseUrl http://localhost:3000 --season 20252026 --gameIds 2025020001 --snapshotDate 2026-06-22`; the dry-run health check generated 22 rows from 856 shifts, 38 players, and 28 PP rows.
- Task 18.0/20.5 verification applied the live `team_unit_toi` migration and upserted the 20252026 snapshot dated `2026-06-22`. The persisted table has 12,929 rows: 2,563 forward-line rows across 524 games/31 teams, 2,797 defense-pair rows across 524 games/31 teams, and 7,569 power-play rows across 1,387 games/32 teams. Forward/defense usage remains explicitly caveated as partial strict-overlap coverage; PP coverage is broad. Team matrix now exposes live `forward_top_load_index`, `defense_pair_top_load_index`, and `pp1_pp2_usage_share` from `team_unit_toi`.
- Task 18.0/20.5 verification passed with `npm test -- --run lib/rankings/teamMatrix.test.ts lib/rankings/teamStyleMethodology.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/rankings.test.tsx`, `npm test -- --run lib/rankings/rankingUrlState.test.ts components/Rankings/RankingsFilters.test.tsx`, `npx tsc --noEmit --pretty false`, `npm run check:team-unit-toi-source-health -- --baseUrl http://localhost:3000 --season 20252026 --gameIds 2025020001 --snapshotDate 2026-06-22`, `npm run check:rankings-source-health -- --baseUrl http://localhost:3000`, a live team API smoke for `metric=forward_top_load_index`, and `npm run build`.
- Task 19.0 completed by deriving `home_road_point_pct_gap` from `wgo_team_stats.point_pct` joined to verified `games.homeTeamId`/`games.awayTeamId` venue identity. Live coverage for 20252026 is 2,700 mapped WGO team-game rows, split evenly across 1,350 home and 1,350 road rows, with 88 rows lacking venue identity excluded from venue-split math. Team source-pending contracts are now empty; team source metadata includes `games`, and the source-quality flags no longer include `home_road_split_source_pending`.
- Task 19.0 verification passed with `npm test -- --run lib/rankings/teamMatrix.test.ts lib/rankings/teamStyleMethodology.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/rankings.test.tsx lib/rankings/rankingUrlState.test.ts components/Rankings/RankingsFilters.test.tsx`, `npx tsc --noEmit --pretty false`, `npm run check:rankings-source-health -- --baseUrl http://localhost:3101`, and a live API smoke for `metric=home_road_point_pct_gap` on `http://localhost:3101`.
- Recommended targeted verification after implementation:

```bash
npm test -- --run __tests__/pages/rankings.test.tsx components/Rankings/RankingsFilters.test.tsx lib/rankings/rankingUrlState.test.ts lib/rankings/rankingCalculator.test.ts lib/rankings/playerMatrix.test.ts
npm test -- --run lib/rankings/skaterCompositeWriter.test.ts lib/rankings/goalieMatrix.test.ts lib/rankings/teamMatrix.test.ts
npm run check:rankings-matrix-performance
```

## Tasks

- [x] 1.0 Completed Setup Checkpoint: Baseline and guardrails
  - [x] 1.1 Re-read the PRD, original contextual rankings prompt, and current `/rankings` implementation before making code changes.
  - [x] 1.2 Capture current `git status --short` and identify unrelated dirty files to avoid touching.
  - [x] 1.3 Run or inspect the current default skater, goalie, team, and Metric Explorer API paths to confirm live response times, source metadata, and row counts.
  - [x] 1.4 Confirm whether `entity_metric_rankings` and `skater_composite_ratings` are populated for the supported season/window/strength contexts used by the default UI.
  - [x] 1.5 Record baseline browser behavior for skater, goalie, team, More Filters, rank-mode toggle, and Metric Explorer before UX edits.

- [x] 2.0 Ship entity-aware page identity and accurate control labels
  - [x] 2.1 Add a small page-label helper that returns entity-specific H1, title, description, snapshot labels, and quick-info labels for skaters, goalies, and teams.
  - [x] 2.2 Replace the static `Player Rankings` H1 with `Skater Rankings`, `Goalie Rankings`, or `Team Rankings` based on active entity.
  - [x] 2.3 Update `<Head>` title and description to use entity-aware or generic `Contextual Hockey Rankings` copy instead of player-only copy.
  - [x] 2.4 Update Quick Info so goalie mode references the active goalie metric, team mode references the active team metric, and skater mode references the active skater metric.
  - [x] 2.5 Rename the `Novel Score` display mode to `Metric Value` or `Raw Value` everywhere it appears.
  - [x] 2.6 Update existing page/filter tests so they assert the entity-aware labels and display-mode copy.

- [x] 3.0 Make team filtering work the way the UI promises
  - [x] 3.1 Add a shared team-token resolver that accepts numeric ids, abbreviations, and team names, returning a canonical team id plus display metadata.
  - [x] 3.2 Use the resolver in skater matrix request parsing so `team=BOS` works and does not produce `Invalid query param: team`.
  - [x] 3.3 Use the resolver in Metric Explorer request parsing so single-metric skater leaderboards support the same team token behavior.
  - [x] 3.4 Preserve shareable URL state by keeping the user-entered team token in the URL while sending canonical ids to server-side ranking logic.
  - [x] 3.5 Render a clear empty/validation state for unknown teams, such as `No team matched BOSX`, instead of a raw API error row.
  - [x] 3.6 Add tests for numeric team id, abbreviation, name, empty team, unknown team, skater matrix path, and Metric Explorer path.

- [x] 4.0 Make durable ranking snapshots the default read path for skater leaderboards
  - [x] 4.1 Refactor skater matrix reads so all visible non-composite matrix cells for populated contexts are loaded from `entity_metric_rankings` in bounded, batched queries.
  - [x] 4.2 Refactor overall and deployment rank scopes to read only needed entity ids/metric keys instead of rebuilding full ranking surfaces.
  - [x] 4.3 Keep rolling-player fallback only for missing snapshot contexts and expose the fallback reason in API metadata and the methodology panel.
  - [x] 4.4 Add a snapshot-source badge or methodology line that clearly states when a matrix is using durable snapshots versus rolling fallback.
  - [x] 4.5 Add tests for durable snapshot success, missing snapshot fallback, fallback metadata, and no-fake-data unavailable states.

- [x] 5.0 Convert Metric Explorer from request-time ranking to snapshot-first ranking
  - [x] 5.1 Route supported skater Metric Explorer requests through `entity_metric_rankings` when the metric/window/strength/peer-group snapshot exists.
  - [x] 5.2 Preserve the existing `ContextualRankingsResponse` shape so current table rendering and consumers continue to work.
  - [x] 5.3 Add explicit `sourceTable`, `rankingSource`, snapshot date, and fallback reason metadata to Metric Explorer responses.
  - [x] 5.4 Keep rolling fallback for metrics without durable rows, but show that fallback state in methodology UI.
  - [x] 5.5 Add tests proving `sog_per_60` and another common metric use snapshots when populated.

- [x] 6.0 Hit the performance budget for common rankings views
  - [x] 6.1 Reduce default skater matrix API response time from the baseline 16.6s toward the PRD target of under 2s after warmup.
  - [x] 6.2 Reduce Metric Explorer common metric response time from the baseline 26.0s toward the PRD target of under 3s after warmup.
  - [x] 6.3 Reduce goalie and team matrix avoidable query overhead where straightforward batching/caching can improve the baseline 17.0s and 10.9s responses.
  - [x] 6.4 Extend `check-rankings-matrix-performance.ts` so it checks default skater matrix, goalie matrix, team matrix, and Metric Explorer budgets.
  - [x] 6.5 Add source-health output for whether slow paths used durable snapshots, rolling fallback, or multi-source aggregation.
  - [x] 6.6 Keep performance changes behavior-preserving: ranks, percentiles, row counts, snapshot dates, and source warnings must remain correct.

- [x] 7.0 Standardize rank and percentile semantics to match the original vision
  - [x] 7.1 Implement the selected “better than X% of qualified peers” percentile semantics, with the best qualified entity displaying 100 where mathematically appropriate.
  - [x] 7.2 Preserve dense raw rank semantics for tied rows.
  - [x] 7.3 Ensure lower-is-better metrics still rank and color as better-is-greener after the percentile change.
  - [x] 7.4 Update legends, methodology copy, tooltips, snapshot copy, and API explanation items to use one consistent percentile definition.
  - [x] 7.5 Add tests for best row, worst row, ties, one-row peer groups, lower-is-better metrics, and below-minimum samples.

- [x] 8.0 Make row explanations and source states useful without table clutter
  - [x] 8.1 Replace repeated visible cell text like `Source caveat`, `Raw context`, and `Stale source` with compact indicators in skater, goalie, and team matrices.
  - [x] 8.2 Preserve full source detail in tooltip/title text, methodology panel content, row-level source summaries, or snapshot notes.
  - [x] 8.3 Update matrix legends so users can interpret source indicators without reading implementation wording.
  - [x] 8.4 Ensure source-state indicators are accessible through text or aria labels, not color alone.
  - [x] 8.5 Add component tests proving source-state information is still present after visual compaction.

- [x] 9.0 Align skater snapshots and composite cards with deployment-relative analysis
  - [x] 9.1 Make the skater snapshot read the active Overall vs Deployment rank mode and show strengths/weaknesses from the same scope.
  - [x] 9.2 Include visible peer group, raw rank, percentile, qualified peer count, sample confidence, and source-state context in snapshot explanations.
  - [x] 9.3 Add methodology/source provenance to Offense Rating, Defensive Impact, MCM/BEAST, and Results Luck cards.
  - [x] 9.4 Keep selected-player URL state stable when filters, pagination, rank mode, or selected rows change.
  - [x] 9.5 Add tests for snapshot rank-scope switching, selected-player stability, and composite-card source copy.

- [x] 10.0 Complete the skater-original metric contract gaps
  - [x] 10.1 Resolve MCM/BEAST PP-points behavior by either implementing verified `pp_points_per_60` input rows or explicitly excluding PP points with provenance until available.
  - [x] 10.2 Make `skaterCompositeMethodology.ts`, `skaterCompositeWriter.ts`, `metricDefinitions.ts`, and visible methodology copy agree on the actual MCM/BEAST component list.
  - [x] 10.3 Keep relative 5v5 GF% and xGF% hidden/planned until team-without-player baselines are actually implemented.
  - [x] 10.4 Position Results Luck as the current 100-centered Results Luck Index, or add a separate source-pending original-formula Luck Score if the original ratio metric remains a product requirement.
  - [x] 10.5 Label Shoot First, Pass First, and Play Driver as current proxy/current-contract scores unless exact original formulas are implemented in this pass.
  - [x] 10.6 Add tests for MCM/BEAST component provenance, Results Luck copy, proxy labels, and planned relative 5v5 metrics.

- [x] 11.0 Implement goalie workload context closer to the original vision
  - [x] 11.1 Add raw start share and adjusted/core start share fields to the goalie ranking row contract.
  - [x] 11.2 Implement top-two/core-goalie denominator logic for likely injury/call-up scenarios.
  - [x] 11.3 Add role confidence and source notes so inferred call-up adjustments are never presented as certain.
  - [x] 11.4 Update goalie matrix and goalie snapshot UI to show raw share, adjusted share, role bucket, and role confidence clearly.
  - [x] 11.5 Add tests for workhorse, starter, tandem lead, tandem secondary, backup, reserve, and injury call-up denominator cases.

- [x] 12.0 Add the next set of original goalie metrics or explicit source-pending contracts
  - [x] 12.1 Reuse existing goalie sources to implement xGA per shot against when verified numerator/denominator fields exist.
  - [x] 12.2 Reuse existing goalie/team sources to implement relative SV% versus team without goalie when the exclusion baseline can be computed safely.
  - [x] 12.3 Add an MVP/value signal based on relative SV%, GSAx/GSAA, or a documented source-backed combination.
  - [x] 12.4 Add high-danger save context or keep it as source-pending with exact missing source requirements.
  - [x] 12.5 Add Under Pressure profile/quadrant or keep it as source-pending with exact missing source requirements.
  - [x] 12.6 Add goalie matrix, methodology, source metadata, and tests for each implemented or explicitly source-pending metric.

- [x] 13.0 Build the first concrete team coaching-style metrics from the original vision
  - [x] 13.1 Implement forward line rolling/top-load index from verified line/deployment and TOI sources, or publish an explicit source-pending contract if verified unit TOI is unavailable.
  - [x] 13.2 Implement defense pair rolling/top-load index from verified pair/deployment and TOI sources, or publish an explicit source-pending contract if verified unit TOI is unavailable.
  - [x] 13.3 Implement PP1/PP2 usage share from verified power-play unit sources, or publish an explicit source-pending contract if verified PP unit TOI is unavailable.
  - [x] 13.4 Implement at least one game-context style metric from verified sources, such as one-goal game frequency, home/road split, rest split, period scoring tendency, or discipline.
  - [x] 13.5 Add team methodology contracts with source tables, denominator descriptions, caveats, and raw/adjusted labels.
  - [x] 13.6 Surface implemented team-style metrics in the team matrix and team snapshot without presenting raw context as adjusted coaching talent.
  - [x] 13.7 Add tests for each implemented team-style metric and its source-state behavior.

- [x] 14.0 Keep availability, methodology, and source metadata synchronized
  - [x] 14.1 Update `availableFilters.ts` so entity tabs, metrics, source-pending options, and disabled reasons match the implemented surface.
  - [x] 14.2 Ensure all ranking APIs expose source tables, snapshot dates, methodology versions, source-quality flags, source warnings, and fallback reasons.
  - [x] 14.3 Ensure the methodology panel renders accurate metadata for skater matrix, Metric Explorer, goalie matrix, team matrix, and WAR.
  - [x] 14.4 Extend source-health checks for missing snapshots, stale snapshots, null-only metric contexts, and fallback-heavy contexts.
  - [x] 14.5 Add tests or script assertions for source metadata on the default skater matrix, Metric Explorer, goalie matrix, and team matrix.

- [x] 15.0 Make local verification reliable
  - [x] 15.1 Confirm the recommended dev command can serve `/rankings` without repeated `EMFILE` watcher errors.
  - [x] 15.2 Repair or document the local Playwright browser installation path so `web/e2e/rankings.spec.ts` can run from a clean workspace.
  - [x] 15.3 Verify whether `npm run e2e:install:workspace` installs Chromium into the repo-local `.ms-playwright` cache without relying on a missing global cache.
  - [x] 15.4 Update package scripts or docs if the current browser install path is insufficient.

- [x] 16.0 Final implementation verification for original-vision alignment
  - [x] 16.1 Run targeted rankings unit and component tests for URL state, page rendering, filters, ranking math, matrix APIs, composites, goalies, and teams.
  - [x] 16.2 Run the rankings performance check script and confirm default skater matrix / Metric Explorer targets are met or explicitly documented.
  - [x] 16.3 Run a real-browser rankings smoke covering skaters, goalies, teams, More Filters, team filtering with `BOS`, Metric Explorer, rank-mode toggle, and source-state display.
  - [x] 16.4 Verify source-pending WAR and unavailable metrics still render as pending/unavailable rather than fake values.
  - [x] 16.5 Verify no Chrome console errors appear in the target rankings flows.
  - [x] 16.6 Document any remaining original-vision gaps as explicit follow-up tasks instead of leaving them only in prose.

- [x] 17.0 NEW: Regenerate durable skater ranking snapshots after percentile semantics change
  - [x] 17.1 Add or identify an approved script/command for rebuilding `entity_metric_rankings` with the updated better-than-peer percentile semantics.
  - [x] 17.2 Run the rebuild for the supported skater contexts used by `/rankings`, including default `20252026`, `season`, `5v5` contexts.
  - [x] 17.3 Verify regenerated durable rows show an untied best row at 100, worst qualified row at 0, and tied rows based on strictly worse peers.
  - [x] 17.4 Re-run rankings source health and page smoke checks after regeneration.

- [x] 18.0 NEW: Add verified team unit-usage TOI sources for top-load and PP-unit metrics
  - [x] 18.1 Add or identify a source that publishes team/game forward-line TOI seconds and team forward TOI seconds.
  - [x] 18.2 Add or identify a source that publishes team/game defense-pair TOI seconds and team defense TOI seconds.
  - [x] 18.3 Add or identify a source that publishes PP1/PP2 unit membership plus unit PP TOI seconds and team PP TOI seconds.
  - [x] 18.4 Replace the source-pending team usage contracts with live Forward Top Load, Defense Pair Top Load, and PP1/PP2 Usage Share metrics once source coverage is verified.

- [x] 19.0 NEW: Add verified team home/road split source for Home Edge
  - [x] 19.1 Add or identify a source that publishes team/game home-road flags aligned to `wgo_team_stats` rows.
  - [x] 19.2 Re-enable live `home_road_point_pct_gap` once the source can compute home point percentage minus road point percentage without guessing venue.
  - [x] 19.3 Update `availableFilters.ts`, `teamStyleMethodology.ts`, team matrix metadata, and source-health expectations after Home Edge is backed by verified data.

- [x] 20.0 NEW: Build durable derived team unit-TOI aggregate before publishing team usage metrics
  - [x] 20.1 Define a `team_unit_toi` or equivalent aggregate contract with `season_id`, `snapshot_date`, `team_id`, `game_id`, `unit_type`, `unit_number`, `unit_toi_seconds`, `team_unit_pool_toi_seconds`, source table, and coverage metadata.
  - [x] 20.2 Implement a builder from `nhl_api_shift_rows` that derives even-strength forward trio and defense pair overlap seconds by team/game without relying on stale `line_combinations` rows.
  - [x] 20.3 Define the PP unit aggregation rule from `powerPlayCombinations` and `getPowerPlayBlocks` so PP1/PP2 unit seconds are not confused with summed player PPTOI.
  - [x] 20.4 Add source-health coverage checks for team/game coverage, unit counts, and incomplete-game/source gaps before wiring metrics into the team matrix.
  - [x] 20.5 Use the durable aggregate to replace source-pending Forward Top Load, Defense Pair Top Load, and PP1/PP2 Usage Share contracts with live team metrics.
