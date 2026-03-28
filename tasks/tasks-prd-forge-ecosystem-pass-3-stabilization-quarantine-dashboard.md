## Relevant Files

- `tasks/prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md` - Authoritative pass-3 PRD and the only planning artifact this task list should extend.
- `tasks/tasks-prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md` - Execution checklist for the stabilization, quarantine, freshness, and dashboard-polish work.
- `web/lib/rollingForgePipeline.ts` - Canonical stage-order contract that currently drifts from real storage behavior.
- `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` - Coordinator regression coverage for pipeline-spec metadata and stage sequencing.
- `web/__tests__/pages/api/v1/start-chart.test.ts` - Consumer-route regression test proving Start Chart reads skaters from `forge_player_projections` and exposes canonical-source metadata.
- `web/__tests__/pages/api/v1/forge/players.test.ts` - Consumer-route regression test covering canonical FORGE skater aggregates and response shape.
- `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` - End-to-end orchestration route whose operator messaging and stage assumptions must match the real pipeline.
- `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` - Coordinator response-contract test covering stage order, spec version, and downstream execution metadata.
- `web/pages/api/v1/db/run-projection-v2.ts` - Canonical projection execution endpoint whose preflight and operator-facing behavior may need freshness and deprecation updates.
- `web/lib/projections/run-forge-projections.ts` - Canonical FORGE projection runner and downstream storage writer.
- `web/lib/projections/runProjectionV2.ts` - Removed compatibility shim; keep only as a historical reference in this task log until adjacent docs are cleaned up.
- `web/pages/api/v1/db/update-start-chart-projections.ts` - Quarantined legacy downstream writer now explicitly marked transitional while it still materializes `player_projections`.
- `web/pages/api/v1/start-chart.ts` - Start-chart consumer API now re-pointed to canonical `forge_player_projections` for skaters while still joining `goalie_start_projections` for goalie context.
- `web/pages/api/v1/forge/players.ts` - Canonical player projection reader that should expose fallback and freshness state explicitly.
- `web/pages/api/v1/forge/goalies.ts` - Canonical goalie projection reader that should expose fallback and freshness state explicitly.
- `web/pages/api/v1/projections/players.ts` - Redundant legacy player-reader namespace that should be deprecated or merged.
- `web/pages/api/v1/projections/goalies.ts` - Redundant legacy goalie-reader namespace that should be deprecated or merged.
- `web/__tests__/pages/api/v1/projections/players.test.ts` - Regression test proving the legacy player projection namespace remains readable but explicitly deprecated in favor of `/api/v1/forge/players`.
- `web/__tests__/pages/api/v1/projections/goalies.test.ts` - Regression test proving the legacy goalie projection namespace remains readable but explicitly deprecated in favor of `/api/v1/forge/goalies`.
- `web/pages/api/v1/db/update-goalie-projections.ts` - Quarantined old goalie-start writer that should be disabled and removed from operational use.
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - Canonical goalie-start writer that should remain as the only supported write path.
- `web/__tests__/pages/api/v1/db/update-goalie-projections.test.ts` - Regression test proving the legacy goalie-start writer is gated and points callers to the v2 route.
- `web/pages/api/v1/db/update-team-power-ratings.ts` - Current team-ratings writer participating in the ambiguous dual-table story.
- `web/pages/api/v1/db/update-team-power-ratings-new.ts` - Alternate team-ratings writer that must be validated, quarantined, or retired.
- `web/lib/teamRatingsService.ts` - Shared service layer that currently reads across both team-ratings tables and needs a single canonical table decision.
- `web/lib/teamRatingsService.test.ts` - Regression coverage for the canonical team-ratings read path and same-table column-fallback behavior.
- `web/__tests__/pages/api/v1/db/update-team-power-ratings-new.test.ts` - Regression test proving the alternate `__new` team-ratings writer is quarantined and points callers to the canonical writer.
- `web/pages/api/v1/db/update-rolling-player-averages.ts` - Canonical rolling recompute operator surface where freshness checks and validation guidance should tighten.
- `web/__tests__/pages/api/v1/db/update-rolling-player-averages.test.ts` - Regression test covering rolling recompute execution-profile behavior and operator-facing dependency metadata.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Semantic owner for the rolling pipeline and a key surface for dependency/freshness enforcement.
- `web/pages/api/v1/db/update-line-combinations/index.ts` - Recent-gap line-combo builder that needs a clearer historical repair story.
- `web/pages/api/v1/db/update-line-combinations/[id].ts` - Per-game line-combo builder that remains a canonical upstream dependency.
- `web/__tests__/pages/api/v1/db/update-line-combinations.test.ts` - Regression test proving the line-combination bulk route distinguishes recent-gap healing from historical backfill.
- `web/pages/api/v1/db/update-power-play-combinations/index.ts` - Canonical bulk power-play combination repair route for date-range or explicit-game recovery.
- `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts` - Per-game power-play context builder that needs a batch or bulk-repair path.
- `web/__tests__/pages/api/v1/db/update-power-play-combinations.test.ts` - Regression test proving the bulk power-play combination route supports date ranges, explicit game IDs, and partial-failure reporting.
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - Canonical ingest stage that must remain in the documented dependency order.
- `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts` - Regression test proving the ingest route exposes the shared operator-order contract.
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - Canonical derived-builder stage that should stay aligned with stage-order and preflight guidance.
- `web/__tests__/pages/api/v1/db/build-projection-derived-v2.test.ts` - Regression test proving the derived-build route exposes the shared operator-order contract.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Accuracy stage that should only run against fresh canonical outputs.
- `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts` - Regression test proving projection accuracy now honors projection preflight freshness gates before validating historical outcomes.
- `web/pages/api/v1/db/update-rolling-games.ts` - Legacy loader route that should be audited for real usage, then gated or removed.
- `web/pages/api/v1/db/update-power-rankings.ts` - Legacy JS loader route that should be audited for real usage, then gated or removed.
- `web/__tests__/pages/api/v1/db/update-rolling-games.test.ts` - Regression test proving the legacy rolling-games wrapper is quarantined and points callers to the canonical rolling route.
- `web/__tests__/pages/api/v1/db/update-power-rankings.test.ts` - Regression test proving the legacy power-rankings loader is disabled and marked non-canonical.
- `web/pages/api/v1/forge/accuracy.ts` - Consumer reader that should continue reflecting canonical FORGE outputs after endpoint cleanup.
- `web/pages/api/v1/runs/latest.ts` - Latest-run metadata reader that can help expose active data date and fallback state.
- `web/pages/index.tsx` - Landing dashboard page that needs decomposition, hierarchy cleanup, and responsive polish.
- `web/styles/Home.module.scss` - Homepage stylesheet with the current desktop-first layout assumptions, including the hard `min-width`.
- `web/components/TransactionTrends/TransactionTrends.tsx` - Homepage insight module that needs stronger hierarchy, state handling, and mobile behavior.
- `web/components/TeamStandingsChart/TeamStandingsChart.tsx` - Homepage standings module that needs lighter presentation and better scanability.
- `web/lib/dashboard/dataFetchers.ts` - Dashboard data orchestration surface that may need clearer freshness and state contracts.
- `web/lib/dashboard/freshness.ts` - Shared freshness logic likely to support the new same-day vs fallback signaling.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` - Rolling pipeline regression coverage for dependency and contract changes.
- `web/lib/projections/runProjectionV2.test.ts` - Projection-runner regression coverage that should stay green while shim usage is retired.
- `web/lib/projections/module-imports.test.ts` - Import integrity coverage for projection module cleanup.
- `web/lib/projections/goaliePipeline.test.ts` - Goalie pipeline coverage relevant to old-vs-v2 writer cleanup.
- `web/__tests__/pages/api/v1/db/run-projection-v2.test.ts` - Projection execution regression test covering preflight normalization and shared dependency metadata.
- `web/lib/dashboard/normalizers.test.ts` - Dashboard data-shape regression coverage for homepage and reader-surface changes.
- `web/lib/dashboard/playerOwnership.test.ts` - Dashboard regression coverage for player-facing ranking and ownership presentation.
- `web/lib/dashboard/teamContext.test.ts` - Dashboard regression coverage for team-context cards and related homepage consumers.
- `web/lib/dashboard/topAddsScheduleContext.test.ts` - Coverage for schedule-context behavior that should remain stable during homepage refactors.
- `web/lib/dashboard/topAddsRanking.test.ts` - Coverage for homepage-facing ranking behavior and related normalization logic.

### Notes

- Treat `tasks/prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md` as the only pass-3 planning artifact. Do not create sidecar quarantine docs, endpoint inventories, or dashboard design notes for this pass.
- Prefer consolidating or deleting duplicate runtime surfaces instead of adding another compatibility layer.
- When deprecating or deleting a route, verify repo references, scheduler/cron ownership, and any documented operator usage before removal.
- Place tests alongside the code they verify when adding new coverage.
- Run targeted tests first, then broader integrity checks in `web`, such as `npx jest [optional/path/to/test/file]` and `npx tsc --noEmit`.

## Tasks

- [x] 1.0 Stabilize the canonical FORGE projection storage model, pipeline stage contract, and start-chart ownership story
  - [x] 1.1 Trace the real downstream storage chain from rolling recompute through projection execution and start-chart consumption, then document exactly where `forge_player_projections`, `goalie_start_projections`, and legacy `player_projections` diverge in behavior. [Deps: none] [Files: `web/lib/rollingForgePipeline.ts`, `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`, `web/pages/api/v1/db/update-start-chart-projections.ts`, `web/pages/api/v1/start-chart.ts`, `web/lib/projections/run-forge-projections.ts`] [AC: the active write/read contract for each table is explicit enough to support one canonical downstream model decision]
  - [x] 1.2 Choose and implement the canonical start-chart ownership model: either re-point the read layer to canonical FORGE outputs or explicitly isolate any remaining materialized start-chart output behind a clearly transitional contract. [Deps: 1.1] [Files: `web/pages/api/v1/db/update-start-chart-projections.ts`, `web/pages/api/v1/start-chart.ts`, `web/pages/start-chart.tsx`, `web/lib/projections/run-forge-projections.ts`] [AC: start-chart behavior no longer silently pretends legacy storage is canonical]
  - [x] 1.3 Update `rollingForgePipeline.ts` so stage names, produced tables, and operator-facing descriptions match real storage behavior instead of the outdated pass-through story. [Deps: 1.1] [Files: `web/lib/rollingForgePipeline.ts`] [AC: stage definitions are accurate enough to act as the operational source of truth]
  - [x] 1.4 Update `run-rolling-forge-pipeline.ts` so orchestration order, preflight language, and completion summaries match the corrected stage model and downstream ownership decisions. [Deps: 1.2, 1.3] [Files: `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`] [AC: pipeline execution messaging no longer implies outputs that are not actually produced]
  - [x] 1.5 Validate the repaired downstream model against the current consumers that matter most, including start-chart and FORGE reader routes, before any legacy surface is removed. [Deps: 1.2, 1.4] [Files: `web/pages/api/v1/start-chart.ts`, `web/pages/api/v1/forge/players.ts`, `web/pages/api/v1/forge/goalies.ts`, `web/pages/start-chart.tsx`] [AC: product-facing consumers read from an intentional, documented contract with no ambiguous fallback ownership]

- [x] 2.0 Quarantine, deprecate, or merge legacy endpoint and runner surfaces so one canonical read/write path is explicit
  - [x] 2.1 Remove `update-goalie-projections.ts` from active operational use by auditing internal callers, scheduler references, and runbook assumptions, then gate or delete it so `update-goalie-projections-v2.ts` is the only supported writer. [Deps: none] [Files: `web/pages/api/v1/db/update-goalie-projections.ts`, `web/pages/api/v1/db/update-goalie-projections-v2.ts`] [AC: the old goalie-start writer is no longer treated as a safe interchangeable path]
  - [x] 2.2 Collapse duplicate projection read namespaces by making `/api/v1/forge/players` and `/api/v1/forge/goalies` the canonical consumer family and deprecating `/api/v1/projections/players` plus `/api/v1/projections/goalies`. [Deps: none] [Files: `web/pages/api/v1/forge/players.ts`, `web/pages/api/v1/forge/goalies.ts`, `web/pages/api/v1/projections/players.ts`, `web/pages/api/v1/projections/goalies.ts`] [AC: there is one clearly preferred read namespace and the old namespace is either redirected, warned, or removed]
  - [x] 2.3 Audit remaining imports of `runProjectionV2.ts`, migrate them to `run-forge-projections.ts`, and remove the shim once no runtime or test path still needs it. [Deps: none] [Files: `web/lib/projections/runProjectionV2.ts`, `web/lib/projections/run-forge-projections.ts`, `web/pages/api/v1/db/run-projection-v2.ts`, `web/lib/projections/runProjectionV2.test.ts`, `web/lib/projections/module-imports.test.ts`] [AC: repo import usage no longer depends on the compatibility shim]
  - [x] 2.4 Compare `team_power_ratings_daily` and `team_power_ratings_daily__new`, choose one canonical owner, update `teamRatingsService` to read from only that table, and quarantine the alternate writer. [Deps: none] [Files: `web/pages/api/v1/db/update-team-power-ratings.ts`, `web/pages/api/v1/db/update-team-power-ratings-new.ts`, `web/lib/teamRatingsService.ts`] [AC: the service layer no longer reads across two tables to answer one product question]
  - [x] 2.5 Audit legacy loader routes such as `update-rolling-games.ts` and `update-power-rankings.ts`, then either remove them if unused or mark them as explicit legacy-only operator surfaces with warnings and no canonical status. [Deps: none] [Files: `web/pages/api/v1/db/update-rolling-games.ts`, `web/pages/api/v1/db/update-power-rankings.ts`] [AC: no legacy route remains silently adjacent to the canonical rolling/FORGE path]

- [x] 3.0 Repair freshness dependencies, bulk-builder recovery paths, and the operator-safe validation sequence across the rolling-to-FORGE chain
  - [x] 3.1 Encode the canonical dependency order across core entity refresh, skater sources, contextual builders, rolling recompute, ingest, derived builders, projection execution, and downstream readers so operators cannot mistake partial freshness for a healthy run. [Deps: none] [Files: `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`, `web/lib/rollingForgePipeline.ts`, `web/pages/api/v1/db/update-rolling-player-averages.ts`, `web/pages/api/v1/db/ingest-projection-inputs.ts`, `web/pages/api/v1/db/build-projection-derived-v2.ts`, `web/pages/api/v1/db/run-projection-v2.ts`] [AC: one operator-visible ordering contract exists and matches actual runtime dependencies]
  - [x] 3.2 Add or wire up a batch repair path for `powerPlayCombinations` so rolling validation no longer depends on manual per-game fan-out for bulk context recovery. [Deps: none] [Files: `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts`, related helper or wrapper route(s)] [AC: operators have one clear bulk path for restoring missing PP context before rolling validation]
  - [x] 3.3 Add a clearer historical repair path for `lineCombinations` so recent-gap healing and backfill behavior are distinct and operationally legible. [Deps: none] [Files: `web/pages/api/v1/db/update-line-combinations/index.ts`, `web/pages/api/v1/db/update-line-combinations/[id].ts`] [AC: historical versus recent repair behavior is explicit and does not rely on guesswork]
  - [x] 3.4 Tighten freshness and dependency preflight in the rolling and projection operator surfaces so stale upstream data blocks false validation rather than quietly producing believable-but-invalid outputs. [Deps: 3.1, 3.2, 3.3] [Files: `web/pages/api/v1/db/update-rolling-player-averages.ts`, `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`, `web/pages/api/v1/db/run-projection-v2.ts`, `web/pages/api/v1/db/run-projection-accuracy.ts`] [AC: routes fail or warn clearly when required upstream freshness conditions are not met]
  - [x] 3.5 Expose same-day vs fallback serving state in the key consumer readers so dashboard and validation workflows can tell whether they are seeing requested-date data or a fallback snapshot. [Deps: 3.4] [Files: `web/pages/api/v1/forge/players.ts`, `web/pages/api/v1/forge/goalies.ts`, `web/pages/api/v1/start-chart.ts`, `web/lib/dashboard/freshness.ts`, `web/lib/dashboard/dataFetchers.ts`] [AC: reader payloads or metadata make fallback date behavior explicit]

- [ ] 4.0 Improve run-surface observability, fallback visibility, and compatibility cleanup tracking for projection and dashboard consumers
  - [ ] 4.1 Standardize run summaries and endpoint metadata so active data date, fallback usage, row counts, and blocking freshness gaps are visible at scan speed for both operator routes and consumer readers. [Deps: 3.4, 3.5] [Files: `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`, `web/pages/api/v1/db/run-projection-v2.ts`, `web/pages/api/v1/db/run-projection-accuracy.ts`, `web/pages/api/v1/runs/latest.ts`, `web/pages/api/v1/forge/players.ts`, `web/pages/api/v1/forge/goalies.ts`] [AC: run and read surfaces expose enough metadata to diagnose stale or partial outputs without code spelunking]
  - [ ] 4.2 Keep the compatibility cleanup visible by inventorying remaining legacy field families, shim imports, duplicate readers, and transitional routes directly in maintained code comments or response metadata rather than letting them fade into implicit knowledge. [Deps: 2.2, 2.3, 2.5] [Files: `web/lib/projections/runProjectionV2.ts`, `web/lib/projections/run-forge-projections.ts`, `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`, related route handlers] [AC: surviving compatibility surfaces are explicitly marked temporary with a concrete removal direction]
  - [ ] 4.3 Add or extend regression coverage around pipeline-stage alignment, fallback-date signaling, goalie-writer exclusivity, and reader-namespace cleanup so stabilization work stays enforced after follow-up changes. [Deps: 1.4, 2.1, 2.2, 3.5] [Files: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`, `web/lib/projections/runProjectionV2.test.ts`, `web/lib/projections/module-imports.test.ts`, `web/lib/projections/goaliePipeline.test.ts`, `web/lib/dashboard/normalizers.test.ts`, `web/lib/dashboard/playerOwnership.test.ts`, `web/lib/dashboard/teamContext.test.ts`, `web/lib/dashboard/topAddsScheduleContext.test.ts`, `web/lib/dashboard/topAddsRanking.test.ts`] [AC: targeted tests cover the pass-3 stabilization promises that are easy to regress]

- [ ] 5.0 Refactor the landing dashboard into a more cohesive, responsive, summary-first experience without expanding into a full-site redesign
  - [ ] 5.1 Break `web/pages/index.tsx` into clearer homepage sections or shared components so hero content, data loading, module state, and layout concerns are no longer concentrated in one large page file. [Deps: none] [Files: `web/pages/index.tsx`, optional new homepage component files] [AC: homepage responsibilities are separated enough to support targeted polish without another monolith]
  - [ ] 5.2 Rework the first viewport around a concise product story that highlights today’s slate, schedule context, and next-click actions instead of leading with dense utility blocks. [Deps: 5.1] [Files: `web/pages/index.tsx`, `web/styles/Home.module.scss`] [AC: the top of the page communicates what the product helps a fantasy hockey user do today]
  - [ ] 5.3 Remove the hard desktop-only layout assumptions, including the `min-width: 1300px` behavior, and redesign section spacing so tablet and mobile layouts feel deliberate rather than squeezed. [Deps: 5.1] [Files: `web/styles/Home.module.scss`, `web/pages/index.tsx`] [AC: homepage layout works cleanly on mobile, tablet, and desktop without horizontal-force hacks]
  - [ ] 5.4 Add consistent loading, empty, error, and stale-state presentation across homepage modules so panels do not look current when their data is degraded or missing. [Deps: 3.5, 5.1] [Files: `web/pages/index.tsx`, `web/lib/dashboard/dataFetchers.ts`, `web/lib/dashboard/freshness.ts`, homepage component files] [AC: homepage states are visually and semantically consistent across modules]
  - [ ] 5.5 Refine `TransactionTrends` so it reads as a first-class homepage insight card with better hierarchy, spacing, and summary framing instead of an isolated table block. [Deps: 5.1, 5.4] [Files: `web/components/TransactionTrends/TransactionTrends.tsx`, `web/pages/index.tsx`, `web/styles/Home.module.scss`] [AC: the module is easier to scan quickly and feels integrated with the homepage visual system]
  - [ ] 5.6 Refine `TeamStandingsChart` and adjacent standings/injuries presentation so the homepage emphasizes compact insight first and expandable detail second. [Deps: 5.1, 5.4] [Files: `web/components/TeamStandingsChart/TeamStandingsChart.tsx`, `web/pages/index.tsx`, `web/styles/Home.module.scss`] [AC: standings-related content no longer dominates the page with raw table weight]

- [ ] 6.0 Validate dispositions, complete remaining deprecation decisions, and prepare the pass-3 remediation handoff for implementation follow-through
  - [ ] 6.1 Run targeted regression tests for rolling, projection, goalie, and dashboard surfaces touched by the stabilization work, then fix any pass-3 regressions before broader validation. [Deps: 1.5, 2.5, 3.5, 4.3, 5.6] [Files: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`, `web/lib/projections/runProjectionV2.test.ts`, `web/lib/projections/module-imports.test.ts`, `web/lib/projections/goaliePipeline.test.ts`, `web/lib/dashboard/normalizers.test.ts`, `web/lib/dashboard/playerOwnership.test.ts`, `web/lib/dashboard/teamContext.test.ts`, `web/lib/dashboard/topAddsScheduleContext.test.ts`, `web/lib/dashboard/topAddsRanking.test.ts`] [AC: targeted touched-scope tests pass]
  - [ ] 6.2 Run repository-level integrity checks for the touched surfaces, including import/type validation in `web`, to confirm that deprecations and homepage refactors did not leave unresolved runtime paths behind. [Deps: 6.1] [Files: `web/**`] [AC: touched-scope type/import validation passes cleanly]
  - [ ] 6.3 Reconcile the final implementation outcome against the PRD’s endpoint registry, quarantine ledger, freshness risks, and remediation plan so every high-risk surface has a concrete disposition and next action. [Deps: 6.1, 6.2] [Files: `tasks/prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`, `tasks/tasks-prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`] [AC: no meaningful pass-3 surface is left in an undocumented ambiguous state]
  - [ ] 6.4 Capture any unresolved follow-up work as implementation next steps inside this task file or the source PRD rather than creating new pass-3 planning markdown. [Deps: 6.3] [Files: `tasks/prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`, `tasks/tasks-prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`] [AC: the handoff is implementation-ready without creating more pass-3 planning sprawl]

### 1.1 Storage Chain Findings

- `rolling_player_game_metrics` remains the canonical rolling output produced by `/api/v1/db/update-rolling-player-averages`.
- `run-forge-projections.ts` is the canonical projection writer. It upserts skater outputs into `forge_player_projections`, team outputs into `forge_team_projections`, and goalie outputs into `forge_goalie_projections`.
- `run-forge-projections.ts` does not read `player_projections`. Its goalie context depends on `goalie_start_projections`, making that table a shared upstream dependency for the canonical runner.
- `run-rolling-forge-pipeline.ts` still models `/api/v1/db/update-start-chart-projections` as the stage-8 downstream consumer refresh after projection execution.
- `rollingForgePipeline.ts` claims the downstream consumer stage produces `start_chart_projections`, but no such table is written by the current start-chart updater.
- `/api/v1/db/update-start-chart-projections` does not read `forge_player_projections`. It rebuilds skater-facing rows from `rolling_player_game_metrics`, `lineCombinations`, `team_power_ratings_daily`, and `goalie_start_projections`, then upserts those results into legacy `player_projections`.
- `/api/v1/start-chart` reads skaters from `player_projections` and goalies from `goalie_start_projections`. If the requested date has no games or rows, it falls back to the prior date and then to the latest available `player_projections` date.
- The current divergence is structural, not just naming drift:
- Canonical FORGE skater outputs live in `forge_player_projections`, but start-chart skater outputs are recomputed separately into `player_projections`.
- `goalie_start_projections` is shared by both the canonical runner and the start-chart chain, so the goalie leg is partly aligned while the skater leg is not.
- The pipeline spec treats start-chart as a downstream projection consumer, but the implementation still uses a legacy skater storage model and fallback logic that can mask stale data.

### 1.2 Start-Chart Ownership Decision

- `/api/v1/start-chart` is now the canonical read layer for the slate UI, and its skater leg now reads from `forge_player_projections` instead of legacy `player_projections`.
- The start-chart API now derives legacy UI fields such as aggregate goals, assists, shots, fantasy points, and matchup grade from canonical FORGE skater rows plus current team-rating context instead of trusting pre-materialized legacy rows.
- The goalie leg remains on `goalie_start_projections` for now, matching the shared dependency already used by the canonical FORGE runner.
- `/api/v1/db/update-start-chart-projections` remains quarantined and still writes `player_projections`, but its response now marks that path as legacy-only transitional materialization rather than a canonical output surface.
- Validation for this sub-task: `npx tsc --noEmit` in `web` passed after the read-path swap.

### 1.3 Pipeline Spec Corrections

- Stage 8 was renamed from a generic downstream-consumer label to `Legacy Start Chart And Accuracy` so the stage name now reflects the actual routes it coordinates.
- The stage operator surface now states `legacy start-chart materialization and accuracy refresh` instead of implying a canonical downstream projection refresh.
- The stage `produces` list now reflects real writes:
- `player_projections (legacy transitional)` for the quarantined start-chart materializer.
- `forge_projection_results`
- `forge_projection_accuracy_daily`
- `forge_projection_accuracy_player`
- `forge_projection_accuracy_stat_daily`
- `forge_projection_calibration_daily`
- The pipeline spec version was bumped to `rolling-forge-pipeline-v2` because the public metadata contract changed.
- Validation for this sub-task: `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` passed.

### 1.4 Coordinator Messaging And Summary Updates

- `run-rolling-forge-pipeline.ts` now returns explicit `executionControls` so operators can see whether downstream legacy materialization, accuracy refresh, and stop-on-failure behavior were enabled for the run.
- The route now returns a `downstreamSummary` block that makes the stage-8 contract explicit:
- Start Chart skaters are read canonically from `forge_player_projections`.
- `/api/v1/db/update-start-chart-projections` is a legacy transitional materializer.
- Accuracy refresh is optional and separately signaled.
- The stage-8 skip reason was updated so `includeDownstream=false` no longer reads like a generic downstream refresh toggle; it now states that legacy start-chart materialization and accuracy refresh were disabled by request.
- The stage-8 accuracy skip reason now states that the legacy start-chart materializer still ran when `includeAccuracy=false`.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`
- `npx tsc --noEmit`

### 1.5 Downstream Consumer Validation

- Added a new `/api/v1/start-chart` regression test that proves the route now reads skaters from `forge_player_projections`, preserves the existing UI-facing aggregate fields, and explicitly reports `legacyPlayerProjectionsUsed: false`.
- Added a new `/api/v1/forge/players` regression test that locks down the canonical FORGE skater reader response shape and aggregate stat math.
- Re-ran the existing `/api/v1/forge/goalies` regression test so both canonical FORGE reader families were validated alongside the repaired Start Chart reader.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/start-chart.test.ts __tests__/pages/api/v1/forge/players.test.ts __tests__/pages/api/v1/forge/goalies.test.ts`
- `npm run test:full`
- `npx tsc --noEmit`

### 2.1 Legacy Goalie Writer Audit And Gating

- Repo audit result: no active runtime imports, pipeline references, cron schedule entries, or operator runbook instructions still point to `/api/v1/db/update-goalie-projections`; all current in-repo operational references already point to `/api/v1/db/update-goalie-projections-v2`.
- The remaining mentions of `update-goalie-projections.ts` in the repo are documentation and task-artifact references describing it as quarantined legacy surface area.
- `/api/v1/db/update-goalie-projections` now returns `410 Gone` for supported methods and explicitly directs callers to `/api/v1/db/update-goalie-projections-v2`.
- The old route no longer performs the legacy `calculate_goalie_start_projections` RPC, so it cannot act as a silent alternate writer for `goalie_start_projections`.
- Added regression coverage in `web/__tests__/pages/api/v1/db/update-goalie-projections.test.ts` to lock down the disabled-route behavior.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/update-goalie-projections.test.ts __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`
- `npx tsc --noEmit`

### 2.2 Projection Reader Namespace Deprecation

- `/api/v1/forge/players` and `/api/v1/forge/goalies` remain the canonical reader family.
- `/api/v1/projections/players` and `/api/v1/projections/goalies` were kept readable for compatibility, but both routes now emit explicit deprecation headers and JSON metadata pointing callers at the canonical `/api/v1/forge/*` successors.
- This keeps legacy filtered callers from breaking immediately while removing any ambiguity about which namespace is preferred going forward.
- Added regression tests for both deprecated routes so the deprecation contract stays explicit.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/projections/players.test.ts __tests__/pages/api/v1/projections/goalies.test.ts __tests__/pages/api/v1/forge/players.test.ts __tests__/pages/api/v1/forge/goalies.test.ts`
- `npx tsc --noEmit`

### 2.3 Projection Runner Shim Removal

- Runtime and test import audit result: no remaining `web/**` imports depend on `web/lib/projections/runProjectionV2.ts`.
- The only surviving `runProjectionV2` references in `web` are symbol names such as `runProjectionV2ForDate` and test variable names; they already resolve through `run-forge-projections.ts` or route-level mocks.
- Removed `web/lib/projections/runProjectionV2.ts`, so the compatibility shim no longer exists in the runtime graph.
- Stale historical references still exist in markdown/task documents outside the runtime path; those were discovered during this audit and were converted into explicit follow-up work instead of being left implicit.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run lib/projections/module-imports.test.ts lib/projections/runProjectionV2.test.ts __tests__/pages/api/v1/db/run-projection-v2.test.ts`
- `npx tsc --noEmit`

### 2.4 Team Power Ratings Canonicalization

- Table audit result: `team_power_ratings_daily` and `team_power_ratings_daily__new` currently expose the same column set in generated database types, so there is no schema-only reason to keep the shared read path ambiguous.
- Canonical ownership decision: `team_power_ratings_daily` remains the single supported read/write table because direct product readers already treat it as the primary source and `/api/v1/db/update-team-power-ratings` is the established writer.
- `web/lib/teamRatingsService.ts` now reads only `team_power_ratings_daily`; it no longer queries `team_power_ratings_daily__new` as a silent fallback for the same product response.
- The service kept its missing-column fallback for extended rating fields, but that fallback now retries against the same canonical table with the core column set instead of hopping to an alternate table.
- `/api/v1/db/update-team-power-ratings-new` now returns `410 Gone` and explicitly marks the `team_power_ratings_daily__new` path as quarantined, with `/api/v1/db/update-team-power-ratings` identified as the replacement writer.
- Added regression coverage for both the canonical single-table read path and the disabled alternate writer contract.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run lib/teamRatingsService.test.ts __tests__/pages/api/v1/db/update-team-power-ratings-new.test.ts`
- `npx tsc --noEmit`

### 2.5 Legacy Loader Route Quarantine

- Audit result: both `/api/v1/db/update-rolling-games` and `/api/v1/db/update-power-rankings` still appear in in-repo scheduler documentation and cron benchmark inventories, so they were not treated as safely deletable dead files.
- The audit evidence includes the legacy schedule entries in `web/rules/cron-schedule.md` plus benchmark and normalized-inventory artifacts that still name `update-rolling-games-recent` and `update-power-rankings` as scheduled HTTP jobs.
- `/api/v1/db/update-rolling-games` no longer loads `lib/supabase/Upserts/fetchRollingGames.js`; it now returns `410 Gone`, marks itself as a quarantined legacy surface, and directs operators to `/api/v1/db/update-rolling-player-averages` as the canonical rolling output path for `rolling_player_game_metrics`.
- `/api/v1/db/update-power-rankings` no longer loads `lib/supabase/Upserts/fetchPowerRankings.js`; it now returns `410 Gone` and explicitly states that it has no supported canonical operator status inside the rolling-to-FORGE pipeline.
- Added regression coverage so both legacy loader routes remain visibly disabled instead of silently acting like interchangeable operator surfaces.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/update-rolling-games.test.ts __tests__/pages/api/v1/db/update-power-rankings.test.ts`
- `npx tsc --noEmit`

### 3.1 Canonical Dependency Order Contract

- Added a shared `rolling-forge-operator-order-v1` dependency contract in `web/lib/rollingForgePipeline.ts` so the canonical operator order is no longer implicit in stage IDs alone.
- The shared contract now states the healthy-run rule, the validation rule, stage-by-stage ordering, and several explicit false-healthy signals that explain why later-stage success does not excuse stale prerequisites.
- `/api/v1/db/run-rolling-forge-pipeline` now returns the full dependency contract alongside the stage execution results, making the operator-visible order explicit in the coordinating surface itself.
- `/api/v1/db/update-rolling-player-averages`, `/api/v1/db/ingest-projection-inputs`, `/api/v1/db/build-projection-derived-v2`, and `/api/v1/db/run-projection-v2` now each return the stage-specific slice of that same contract so the route-local operator message stays aligned with the shared pipeline definition.
- `run-projection-v2` now exposes that projection execution depends on both `rolling_player_recompute` and `projection_derived_build`, matching the preflight gates that already enforced those assumptions in code.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts __tests__/pages/api/v1/db/run-projection-v2.test.ts __tests__/pages/api/v1/db/update-rolling-player-averages.test.ts __tests__/pages/api/v1/db/ingest-projection-inputs.test.ts __tests__/pages/api/v1/db/build-projection-derived-v2.test.ts`
- `npx tsc --noEmit`

### 3.2 Bulk Power-Play Combination Repair Path

- Added `/api/v1/db/update-power-play-combinations` as the canonical batch repair route for `powerPlayCombinations`, supporting either a `startDate`/`endDate` window or an explicit `gameIds` list.
- The existing per-game route at `/api/v1/db/update-power-play-combinations/[gameId]` now exports its update helper so the batch route can reuse the same write logic instead of duplicating the builder implementation.
- The new batch route returns explicit processed/failed counts plus per-game failure details, so operators can rerun a larger repair scope without hiding partial failures behind a single success flag.
- `run-rolling-forge-pipeline.ts` stage 3 now calls the batch route once for the requested date window instead of manually fan-out invoking the per-game route for each game ID.
- `rollingForgePipeline.ts` now lists the batch route in the contextual-builders stage so the operator-visible route inventory matches the new canonical repair surface.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/update-power-play-combinations.test.ts __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`
- `npx tsc --noEmit`

### 3.3 Line Combination Historical Repair Split

- `/api/v1/db/update-line-combinations` now distinguishes between `recent_gap` healing and `historical_backfill` repair instead of treating both workflows as one implicit `count`-driven scan.
- The default route behavior remains `recent_gap`, preserving the current-season, missing-combo healer that scans a recent candidate window and updates only games with incomplete line-combination rows.
- A new explicit `historical_backfill` mode now requires either `gameIds` or a `startDate`/`endDate` range, making historical repair intentional instead of guesswork driven by the recent-gap route.
- Both modes now return `repairMode` and scope metadata so operators can tell whether they just ran a small recent-gap heal or a broader historical backfill.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/update-line-combinations.test.ts __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`
- `npx tsc --noEmit`

### 3.4 Freshness Gate Tightening

- `fetchRollingPlayerAverages.ts` now always computes source-tail freshness diagnostics strongly enough to produce a concrete blocker count in the returned run summary, even when optional diagnostics are otherwise minimized.
- `/api/v1/db/update-rolling-player-averages` now returns the rolling run summary and a `freshnessGate` block, and it fails with `422` when upstream freshness blockers remain unless the operator explicitly opts into `bypassFreshnessBlockers=true`.
- `run-projection-v2.ts` now exports its projection preflight helper so downstream validation surfaces can reuse the same dependency gate instead of inventing a separate notion of freshness health.
- `/api/v1/db/run-projection-accuracy` now runs projection freshness preflight before validating a requested projection window and returns `422` with the preflight result when stale prerequisites would make the accuracy output misleading; `bypassPreflight=true` remains the explicit override.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/update-rolling-player-averages.test.ts __tests__/pages/api/v1/db/run-projection-accuracy.test.ts lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`
- `npx tsc --noEmit`

### 3.5 Reader Serving-State Metadata

- Added a shared `RequestedDateServingState` contract in `web/lib/dashboard/freshness.ts` so reader routes can report one explicit answer to the same question: is this the requested date or a fallback snapshot?
- `/api/v1/forge/players`, `/api/v1/forge/goalies`, and `/api/v1/start-chart` now each return a `serving` block with `requestedDate`, `resolvedDate`, `fallbackApplied`, `isSameDay`, `state`, and a route-specific fallback `strategy`.
- The start-chart route now distinguishes between `previous_date_with_games` fallback and `latest_available_with_data`, so its older slate behavior is explicit instead of being inferred indirectly from `dateUsed`.
- `web/lib/dashboard/dataFetchers.ts` now types these reader payloads with the shared `serving` contract, so dashboard and validation callers can consume one consistent metadata shape instead of reverse-engineering separate date fields.
- Added regression coverage proving:
- `/api/v1/forge/players` reports both same-day and latest-available fallback serving state.
- `/api/v1/forge/goalies` reports same-day and fallback serving state while preserving existing diagnostics.
- `/api/v1/start-chart` reports same-day canonical serving and previous-date slate fallback serving.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/forge/players.test.ts __tests__/pages/api/v1/forge/goalies.test.ts __tests__/pages/api/v1/start-chart.test.ts`
- `npx tsc --noEmit`

- [ ] 7.0 Clean up stale documentation and task references that still describe `runProjectionV2.ts` as an active projection-runner file
  - [ ] 7.1 Update active docs and task guides that still describe `web/lib/projections/runProjectionV2.ts` as a live runtime path so the repo no longer teaches the removed shim as current architecture. [Deps: 2.3] [Files: `FORGE_EXPLAINED.md`, `tasks/*.md`, related active runbooks/docs] [AC: active guidance points to `run-forge-projections.ts` unless a historical note is explicitly marked as historical]
