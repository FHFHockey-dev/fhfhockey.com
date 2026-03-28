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
- `web/__tests__/pages/api/v1/runs/latest.test.ts` - Regression test proving the latest-run reader exposes scan-friendly run metadata instead of only raw row payloads.
- `web/lib/api/scanSummary.ts` - Shared scan-summary helper that standardizes active data date, fallback usage, row counts, and blocking issue counts across run and reader surfaces.
- `web/lib/projections/compatibilityInventory.ts` - Shared compatibility cleanup ledger for removed shim paths, duplicate reader namespaces, and surviving transitional routes.
- `web/pages/index.tsx` - Landing dashboard page that needs decomposition, hierarchy cleanup, and responsive polish.
- `web/styles/Home.module.scss` - Homepage stylesheet with the current desktop-first layout assumptions, including the hard `min-width`.
- `web/components/TransactionTrends/TransactionTrends.tsx` - Homepage insight module that needs stronger hierarchy, state handling, and mobile behavior.
- `web/components/TeamStandingsChart/TeamStandingsChart.tsx` - Homepage standings module that needs lighter presentation and better scanability.
- `web/lib/dashboard/dataFetchers.ts` - Dashboard data orchestration surface that may need clearer freshness and state contracts.
- `web/lib/dashboard/freshness.ts` - Shared freshness logic likely to support the new same-day vs fallback signaling.
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` - Rolling pipeline regression coverage for dependency and contract changes.
- `web/lib/projections/runProjectionV2.test.ts` - Historical test filename that still carries projection-runner regression coverage after the shim removal.
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

- [x] 4.0 Improve run-surface observability, fallback visibility, and compatibility cleanup tracking for projection and dashboard consumers
  - [x] 4.1 Standardize run summaries and endpoint metadata so active data date, fallback usage, row counts, and blocking freshness gaps are visible at scan speed for both operator routes and consumer readers. [Deps: 3.4, 3.5] [Files: `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`, `web/pages/api/v1/db/run-projection-v2.ts`, `web/pages/api/v1/db/run-projection-accuracy.ts`, `web/pages/api/v1/runs/latest.ts`, `web/pages/api/v1/forge/players.ts`, `web/pages/api/v1/forge/goalies.ts`] [AC: run and read surfaces expose enough metadata to diagnose stale or partial outputs without code spelunking]
  - [x] 4.2 Keep the compatibility cleanup visible by inventorying remaining legacy field families, shim imports, duplicate readers, and transitional routes directly in maintained code comments or response metadata rather than letting them fade into implicit knowledge. [Deps: 2.2, 2.3, 2.5] [Files: `web/lib/projections/runProjectionV2.ts`, `web/lib/projections/run-forge-projections.ts`, `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`, related route handlers] [AC: surviving compatibility surfaces are explicitly marked temporary with a concrete removal direction]
  - [x] 4.3 Add or extend regression coverage around pipeline-stage alignment, fallback-date signaling, goalie-writer exclusivity, and reader-namespace cleanup so stabilization work stays enforced after follow-up changes. [Deps: 1.4, 2.1, 2.2, 3.5] [Files: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`, `web/lib/projections/runProjectionV2.test.ts`, `web/lib/projections/module-imports.test.ts`, `web/lib/projections/goaliePipeline.test.ts`, `web/lib/dashboard/normalizers.test.ts`, `web/lib/dashboard/playerOwnership.test.ts`, `web/lib/dashboard/teamContext.test.ts`, `web/lib/dashboard/topAddsScheduleContext.test.ts`, `web/lib/dashboard/topAddsRanking.test.ts`] [AC: targeted tests cover the pass-3 stabilization promises that are easy to regress]

- [x] 5.0 Refactor the landing dashboard into a more cohesive, responsive, summary-first experience without expanding into a full-site redesign
  - [x] 5.1 Break `web/pages/index.tsx` into clearer homepage sections or shared components so hero content, data loading, module state, and layout concerns are no longer concentrated in one large page file. [Deps: none] [Files: `web/pages/index.tsx`, optional new homepage component files] [AC: homepage responsibilities are separated enough to support targeted polish without another monolith]
  - [x] 5.2 Rework the first viewport around a concise product story that highlights today’s slate, schedule context, and next-click actions instead of leading with dense utility blocks. [Deps: 5.1] [Files: `web/pages/index.tsx`, `web/styles/Home.module.scss`] [AC: the top of the page communicates what the product helps a fantasy hockey user do today]
  - [x] 5.3 Remove the hard desktop-only layout assumptions, including the `min-width: 1300px` behavior, and redesign section spacing so tablet and mobile layouts feel deliberate rather than squeezed. [Deps: 5.1] [Files: `web/styles/Home.module.scss`, `web/pages/index.tsx`] [AC: homepage layout works cleanly on mobile, tablet, and desktop without horizontal-force hacks]
  - [x] 5.4 Add consistent loading, empty, error, and stale-state presentation across homepage modules so panels do not look current when their data is degraded or missing. [Deps: 3.5, 5.1] [Files: `web/pages/index.tsx`, `web/lib/dashboard/dataFetchers.ts`, `web/lib/dashboard/freshness.ts`, homepage component files] [AC: homepage states are visually and semantically consistent across modules]
  - [x] 5.5 Refine `TransactionTrends` so it reads as a first-class homepage insight card with better hierarchy, spacing, and summary framing instead of an isolated table block. [Deps: 5.1, 5.4] [Files: `web/components/TransactionTrends/TransactionTrends.tsx`, `web/pages/index.tsx`, `web/styles/Home.module.scss`] [AC: the module is easier to scan quickly and feels integrated with the homepage visual system]
  - [x] 5.6 Refine `TeamStandingsChart` and adjacent standings/injuries presentation so the homepage emphasizes compact insight first and expandable detail second. [Deps: 5.1, 5.4] [Files: `web/components/TeamStandingsChart/TeamStandingsChart.tsx`, `web/pages/index.tsx`, `web/styles/Home.module.scss`] [AC: standings-related content no longer dominates the page with raw table weight]

- [x] 6.0 Validate dispositions, complete remaining deprecation decisions, and prepare the pass-3 remediation handoff for implementation follow-through
  - [x] 6.1 Run targeted regression tests for rolling, projection, goalie, and dashboard surfaces touched by the stabilization work, then fix any pass-3 regressions before broader validation. [Deps: 1.5, 2.5, 3.5, 4.3, 5.6] [Files: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`, `web/lib/projections/runProjectionV2.test.ts`, `web/lib/projections/module-imports.test.ts`, `web/lib/projections/goaliePipeline.test.ts`, `web/lib/dashboard/normalizers.test.ts`, `web/lib/dashboard/playerOwnership.test.ts`, `web/lib/dashboard/teamContext.test.ts`, `web/lib/dashboard/topAddsScheduleContext.test.ts`, `web/lib/dashboard/topAddsRanking.test.ts`] [AC: targeted touched-scope tests pass]
  - [x] 6.2 Run repository-level integrity checks for the touched surfaces, including import/type validation in `web`, to confirm that deprecations and homepage refactors did not leave unresolved runtime paths behind. [Deps: 6.1] [Files: `web/**`] [AC: touched-scope type/import validation passes cleanly]
  - [x] 6.3 Reconcile the final implementation outcome against the PRD’s endpoint registry, quarantine ledger, freshness risks, and remediation plan so every high-risk surface has a concrete disposition and next action. [Deps: 6.1, 6.2] [Files: `tasks/prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`, `tasks/tasks-prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`] [AC: no meaningful pass-3 surface is left in an undocumented ambiguous state]
  - [x] 6.4 Capture any unresolved follow-up work as implementation next steps inside this task file or the source PRD rather than creating new pass-3 planning markdown. [Deps: 6.3] [Files: `tasks/prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`, `tasks/tasks-prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`] [AC: the handoff is implementation-ready without creating more pass-3 planning sprawl]

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

### 4.1 Scan-Speed Summary Contract

- Added `web/lib/api/scanSummary.ts` so run and reader endpoints can return one shared `scanSummary` contract with `activeDataDate`, `requestedDate`, `fallbackApplied`, `rowCounts`, `blockingIssueCount`, and concise notes.
- `/api/v1/forge/players` and `/api/v1/forge/goalies` now expose scan-friendly top-level summaries alongside their existing `serving` and diagnostics metadata, so fallback context and returned row counts are visible without opening deeper payload sections.
- `/api/v1/db/run-rolling-forge-pipeline` now derives a top-level pipeline `scanSummary` from stage results and child-route summaries, including rolling/projection/accuracy row counts plus blocking freshness or stage-failure counts.
- `/api/v1/db/run-projection-v2` and `/api/v1/db/run-projection-accuracy` now expose the same `scanSummary` contract across ready, partial, blocked, timeout, and dependency-error responses, so operators can see active date, row counts, and blocker counts at a glance.
- `/api/v1/runs/latest` no longer returns only the raw run row; it now also exposes scan-friendly latest-run metadata, including active run date, latest run status, and row counts extracted from `forge_runs.metrics`.
- Added or updated regression coverage for rolling-pipeline summary metadata, projection-run summary metadata, projection-accuracy summary metadata, FORGE reader summaries, goalie reader snapshot shape, and the new latest-run reader contract.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts __tests__/pages/api/v1/db/run-projection-v2.test.ts __tests__/pages/api/v1/db/run-projection-accuracy.test.ts __tests__/pages/api/v1/forge/players.test.ts __tests__/pages/api/v1/forge/goalies.test.ts __tests__/pages/api/v1/runs/latest.test.ts`
- `npx tsc --noEmit`

### 4.2 Compatibility Cleanup Inventory

- Added `web/lib/projections/compatibilityInventory.ts` as the maintained cleanup ledger for the removed `runProjectionV2.ts` shim, the still-readable deprecated `/api/v1/projections/*` reader namespace, and the surviving transitional route inventory.
- `run-forge-projections.ts` now carries an explicit canonical-runner note pointing maintainers to that ledger, so the removed-shim replacement path is documented in live code rather than only in old task context.
- `fetchRollingPlayerAverages.ts` now carries a focused compatibility inventory comment block for the remaining `gp_pct_*` and related GP-family aliases, including the removal condition tied to the later participation-schema migration.
- `/api/v1/db/run-projection-v2` and `/api/v1/db/run-rolling-forge-pipeline` now return a shared `compatibilityInventory` block so operators can see the removed shim path, duplicate reader namespaces, and transitional route inventory without reopening task docs.
- `/api/v1/forge/players`, `/api/v1/forge/goalies`, and `/api/v1/start-chart` now return narrow route-level compatibility metadata so canonical readers explicitly advertise their deprecated sibling namespace or transitional materializer relationship.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts __tests__/pages/api/v1/db/run-projection-v2.test.ts __tests__/pages/api/v1/forge/players.test.ts __tests__/pages/api/v1/forge/goalies.test.ts __tests__/pages/api/v1/start-chart.test.ts`
- `npx tsc --noEmit`

### 4.3 Targeted Regression Coverage

- Extended `web/lib/projections/module-imports.test.ts` so the cleanup inventory and filesystem state must agree that `web/lib/projections/runProjectionV2.ts` is gone and `run-forge-projections.ts` is the canonical replacement path.
- Extended `web/lib/projections/goaliePipeline.test.ts` so the pipeline spec must keep `/api/v1/db/update-goalie-projections-v2` as the goalie-start writer stage and must not reintroduce `/api/v1/db/update-goalie-projections` as a live pipeline endpoint.
- Extended `web/lib/dashboard/normalizers.test.ts` so start-chart normalization explicitly tolerates fallback-serving metadata, scan summaries, and compatibility inventory fields without changing the normalized dashboard shape.
- These additions keep the pass-3 promises covered at the library level even if route-level response contracts evolve again later.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run lib/projections/module-imports.test.ts lib/projections/goaliePipeline.test.ts lib/dashboard/normalizers.test.ts`
- `npx tsc --noEmit`

### 5.1 Homepage Responsibility Split

- `web/pages/index.tsx` now acts as the homepage orchestrator instead of owning schedule fetch logic, date navigation, standings sorting, injury pagination, and every render block inline.
- Added `web/components/HomePage/useHomepageGames.ts` to hold the client-side schedule refresh, live-game overlay hydration, standings-record attachment, current-date state, and hero heading text selection.
- Added `web/components/HomePage/HomepageGamesSection.tsx` for the top games hero block so the first viewport layout is isolated from page-level data bootstrap concerns.
- Added `web/components/HomePage/HomepageStandingsInjuriesSection.tsx` so standings ordering, injury pagination, and both table renderers now live with the module they belong to instead of bloating `index.tsx`.
- This keeps the current homepage content order intact while giving later polish tasks a cleaner place to update hero messaging, module states, and layout without re-growing one page-file monolith.
- Validation for this sub-task:
- `npx tsc --noEmit`

### 5.2 First-Viewport Product Story

- Reworked `web/components/HomePage/HomepageGamesSection.tsx` so the page now opens with a concise slate hero instead of dropping directly into the dense games utility header.
- The new top block now explains the homepage value in one pass, summarizes the current slate with date/slate/live-or-upcoming context, and adapts the supporting copy when games are live, merely upcoming, or absent on the selected date.
- Added direct next-click actions for `/start-chart`, `/goalies`, and `/trends` so the homepage points users toward the core decision surfaces instead of making them infer where to go next.
- Updated `web/styles/Home.module.scss` with dedicated first-viewport hero, summary-card, and action-link styling while keeping the downstream games grid and lower sections intact for the next layout tasks.
- Validation for this sub-task:
- `npx tsc --noEmit`

### 5.3 Responsive Layout Cleanup

- Removed the homepage-level `min-width: 1300px` assumption from `web/styles/Home.module.scss` and replaced the shell sizing with fluid max-width, clamp-based spacing, and inline padding that works across desktop, tablet, and mobile without horizontal forcing.
- Replaced the mixed grid-plus-flex games layout with a true responsive grid using `auto-fit` card sizing, so the slate cards now reflow naturally instead of depending on brittle flex-basis math tuned for desktop widths.
- Added a non-mobile collapse point for the new slate hero so its summary rail and intro content stack cleanly on tablet-sized layouts instead of waiting until the smallest breakpoint.
- Converted the standings-and-injuries area to an explicit grid with a tablet two-column state and mobile single-column fallback, making the lower homepage modules feel intentionally arranged rather than desktop-only sections squeezed smaller.
- Tightened supporting wrapper rules like `chartContainer` and mobile card widths so the page no longer relies on horizontal-overflow escape hatches to stay usable.
- Validation for this sub-task:
- `npx tsc --noEmit`

### 5.4 Consistent Homepage Module States

- Added `buildHomepageModulePresentation` to `web/lib/dashboard/freshness.ts` so homepage modules can derive one shared loading/empty/error/stale presentation contract instead of inventing their own state language.
- Added `web/lib/dashboard/freshness.test.ts` to lock down that state-priority logic, including the stale-path behavior that had no direct regression coverage before.
- `web/components/HomePage/useHomepageGames.ts` now exposes loading, error, and last-updated state for the slate module, and `web/components/HomePage/HomepageGamesSection.tsx` now renders a shared status panel when the slate is refreshing, unavailable, empty, or stale.
- `web/pages/index.tsx` now preserves SSR error context for standings and injuries via explicit props instead of collapsing every failure into silent empty arrays, and `web/components/HomePage/HomepageStandingsInjuriesSection.tsx` now renders those conditions through the same shared status treatment.
- `web/components/TransactionTrends/TransactionTrends.tsx` now treats stale and empty responses as first-class panel states, not just loading/error edge cases.
- `web/components/TeamStandingsChart/TeamStandingsChart.tsx` now exposes loading, empty, error, and stale presentation instead of silently drawing nothing when its fetch fails or returns no usable history.
- Validation for this sub-task:
- `./node_modules/.bin/vitest --run lib/dashboard/freshness.test.ts`
- `npx tsc --noEmit`

### 5.5 Transaction Trends Summary Framing

- Reworked `web/components/TransactionTrends/TransactionTrends.tsx` so the module now opens with a short market-pulse explanation and a compact summary strip before the detailed riser/faller tables.
- Added summary cards for the active window/filter scope, the current lead riser, and the current lead faller so the module communicates the main signal immediately before users read row-by-row tables.
- Updated `web/components/TransactionTrends/TransactionTrends.module.scss` with matching summary-card styling, spacing, and mobile collapse behavior so the module reads as a homepage insight card instead of an isolated data table block.
- The underlying filters, tables, pagination, and stale-state behavior from `5.4` remain intact; this task changed hierarchy and scanability rather than data semantics.
- Validation for this sub-task:
- `npx tsc --noEmit`

### 5.6 Standings Insight Hierarchy

- Reworked `web/components/TeamStandingsChart/TeamStandingsChart.tsx` so the module now opens with a compact standings-signal header that explains what the chart is for before exposing the full control surface and team toggle matrix.
- Added chart-level summary stats for current metric, view mode, and selected-team count in `web/components/TeamStandingsChart/TeamStandingsChart.module.scss`, making the chart read as a quick insight card first and a full exploration tool second.
- Softened the adjacent standings and injuries chrome in `web/styles/Home.module.scss` by reducing header weight, lightening table separators, and toning down hover/table-header emphasis so those lower modules support the chart instead of visually competing with it.
- This keeps the detailed standings and injury tables available, but the homepage no longer treats them as the dominant visual payload in the standings area.
- Validation for this sub-task:
- `npx tsc --noEmit`

### 6.1 Targeted Regression Validation

- Ran the pass-3 touched-scope regression slice across rolling, projection, goalie, and dashboard library contracts:
- `./node_modules/.bin/vitest --run lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts lib/projections/runProjectionV2.test.ts lib/projections/module-imports.test.ts lib/projections/goaliePipeline.test.ts lib/dashboard/normalizers.test.ts lib/dashboard/playerOwnership.test.ts lib/dashboard/teamContext.test.ts lib/dashboard/topAddsScheduleContext.test.ts lib/dashboard/topAddsRanking.test.ts lib/dashboard/freshness.test.ts`
- Result: all targeted tests passed (`10` files, `122` tests), so no additional pass-3 regression fixes were needed before moving to broader integrity checks.

### 6.2 Touched-Surface Integrity Checks

- Ran touched-surface import/type validation for `web`:
- `npx tsc --noEmit`
- Ran a runtime-contract regression slice across the touched operator and reader routes:
- `./node_modules/.bin/vitest --run __tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts __tests__/pages/api/v1/db/run-projection-v2.test.ts __tests__/pages/api/v1/db/run-projection-accuracy.test.ts __tests__/pages/api/v1/forge/players.test.ts __tests__/pages/api/v1/forge/goalies.test.ts __tests__/pages/api/v1/start-chart.test.ts __tests__/pages/api/v1/runs/latest.test.ts`
- Result: both checks passed cleanly (`7` files, `16` tests on the route slice), so the deprecations, metadata additions, and homepage refactors did not leave unresolved touched-scope runtime paths behind.

### 6.3 PRD Reconciliation and Disposition Lock

- Updated `tasks/prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md` so the endpoint registry, quarantine ledger, freshness review, deprecation candidates, and remediation plan now match implemented pass-3 reality instead of pre-implementation assumptions.
- Closed the largest stale claims in the PRD:
- `/api/v1/start-chart` is now documented as a canonical skater reader over `forge_player_projections`, not a legacy `player_projections` consumer.
- `rollingForgePipeline.ts` and `/api/v1/db/run-rolling-forge-pipeline` are now documented as aligned with the real stage-8 legacy-materialization story instead of being treated as spec-drifted.
- Disabled routes (`update-goalie-projections.ts`, `update-team-power-ratings-new.ts`, `update-rolling-games.ts`, `update-power-rankings.ts`) are now documented as `410 Gone` quarantine surfaces rather than live alternates.
- The removed `runProjectionV2.ts` shim is now documented as deleted runtime debt with docs-cleanup follow-up only.
- Reframed the freshness section around residual risk instead of already-fixed problems:
- builder repair gaps are now documented as scope-selection risk rather than missing capabilities
- fallback-serving risk is now documented as metadata-interpretation risk rather than silent behavior
- `update-start-chart-projections.ts` is explicitly called out as the remaining transitional legacy materializer
- Rewrote the landing-page audit and improvement plan to distinguish completed pass-3 homepage work from optional later polish, so the PRD no longer reads as if the homepage refactor never happened.
- Documented the remaining concrete follow-up set for `6.4`: verify hidden callers before deleting `410` routes, map remaining `player_projections` consumers, clean stale `runProjectionV2.ts` docs, decide long-term `goalie_start_projections` ownership, and optionally continue homepage polish after browser verification.

### 6.4 Follow-Up Queue Capture

- Kept the unresolved post-pass-3 work inside the existing pass-3 artifacts instead of creating any new planning markdown.
- The source PRD now carries the high-level residual queue under `Remaining Follow-Up After Pass 3`.
- This task file now carries the implementation next-step queue in explicit follow-up task groups so future work can continue directly from the same handoff artifact.
- No additional pass-3 planning documents are needed; the PRD and this task file remain the only active handoff sources.

- [x] 7.0 Clean up stale documentation and task references that still describe `runProjectionV2.ts` as an active projection-runner file
  - [x] 7.1 Update active docs and task guides that still describe `web/lib/projections/runProjectionV2.ts` as a live runtime path so the repo no longer teaches the removed shim as current architecture. [Deps: 2.3] [Files: `FORGE_EXPLAINED.md`, `tasks/*.md`, related active runbooks/docs] [AC: active guidance points to `run-forge-projections.ts` unless a historical note is explicitly marked as historical]

- [ ] 8.0 Retire quarantined legacy operator routes now that pass-3 marked their canonical replacements and disabled their runtime behavior
  - [ ] 8.1 Audit hidden schedulers, cron jobs, benchmarks, logs, and operator runbooks for continued use of disabled `410 Gone` routes: `update-goalie-projections.ts`, `update-team-power-ratings-new.ts`, `update-rolling-games.ts`, and `update-power-rankings.ts`. [Deps: 6.4] [Files: `vercel.json`, scheduler inventories, runbooks, observability surfaces, related docs] [AC: every disabled legacy route has a documented caller audit result]
  - [ ] 8.2 Delete the disabled legacy operator routes whose caller audit is clear, and update any surviving docs or runbooks that still reference them. [Deps: 8.1] [Files: `web/pages/api/v1/db/update-goalie-projections.ts`, `web/pages/api/v1/db/update-team-power-ratings-new.ts`, `web/pages/api/v1/db/update-rolling-games.ts`, `web/pages/api/v1/db/update-power-rankings.ts`, related docs/tests] [AC: no disabled legacy operator route remains without an explicit retention reason]

### 7.1 Active Runner-Path Docs Cleanup

- Updated `FORGE_EXPLAINED.md` so the refresh-order guidance now points to the canonical runner in `run-forge-projections.ts` instead of the removed `runProjectionV2` shim name.
- Updated `tasks/tasks-prd-sustainability-trends-audit.md` so its relevant-files inventory now describes `run-forge-projections.ts` as the live engine and no longer lists `runProjectionV2.ts` as an active compatibility surface.
- Updated the active pass-3 checklist itself so its relevant-files inventory no longer teaches `web/lib/projections/runProjectionV2.ts` as a current file and now labels `runProjectionV2.test.ts` as a historical test filename.
- Added explicit historical notes to `tasks/prd-run-forge-projections-modularization.md` and `tasks/tasks-prd-run-forge-projections-modularization.md` so their pre-rename references remain valid as migration history without reading as current architecture guidance.
- Validation for this sub-task:
- `rg -n "runProjectionV2\\.ts|runProjectionV2\\b" FORGE_EXPLAINED.md tasks web -g '!web/node_modules'`
- Result: remaining matches are intentional historical migration notes, task-history entries, compatibility inventory metadata, or test filenames rather than active docs teaching the removed shim as the current runtime path.

- [ ] 9.0 Retire the remaining transitional start-chart legacy materialization after consumer verification
  - [ ] 9.1 Map all remaining readers, jobs, docs, and manual workflows that still rely on `player_projections` or `/api/v1/db/update-start-chart-projections`. [Deps: 6.4] [Files: `web/**`, docs, task files, observability surfaces] [AC: the remaining `player_projections` dependency graph is explicit enough to support deletion or replacement]
  - [ ] 9.2 Delete or replace `update-start-chart-projections.ts` once `player_projections` consumers are either retired or intentionally migrated to canonical FORGE read logic. [Deps: 9.1] [Files: `web/pages/api/v1/db/update-start-chart-projections.ts`, related readers/tests/docs] [AC: the legacy start-chart materializer is no longer an ambiguous surviving side channel]

- [ ] 10.0 Resolve the remaining ownership and verification questions left open by pass 3
  - [ ] 10.1 Decide whether `goalie_start_projections` should remain a shared table name or be renamed/wrapped under clearer FORGE ownership in a later pass, then document the decision in active operator guidance. [Deps: 6.4] [Files: `tasks/prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md`, active runbooks/docs, related route metadata] [AC: the table’s long-term ownership story is explicit]
  - [ ] 10.2 Verify whether support-only WGO writers such as `update-wgo-ly.ts` and adjacent helper tables still have active product consumers, and quarantine or retire them if they do not. [Deps: 6.4] [Files: `web/pages/api/v1/db/update-wgo-ly.ts`, related WGO writers/readers/docs] [AC: support-only WGO surfaces have an explicit keep-or-retire decision]
  - [ ] 10.3 Run browser-level homepage verification for the new summary-first landing experience, then decide whether card-first standings/injuries or a lightweight “today in fantasy” summary layer should become a later implementation slice. [Deps: 5.6, 6.4] [Files: `web/pages/index.tsx`, `web/components/HomePage/**`, `web/components/TransactionTrends/**`, `web/components/TeamStandingsChart/**`, `web/styles/Home.module.scss`] [AC: homepage follow-up is driven by observed UX gaps instead of another speculative redesign pass]
