# sKO Charts and Pipeline — Reconciliation, Completion, and Burn-Down Tasks

## Relevant Files

- `tasks/TASKS/sko-charts/prd-sko-charts.md` - Current stability-CV sKO product/model PRD.
- `tasks/TASKS/sko-charts/prd-sko.md` - Earlier residual-P/60 sustainability concept retained as research input.
- `tasks/TASKS/sko-charts/sko-modeling-notes.md` - Modeling analysis and embedded checklist.
- `tasks/TASKS/dead-code-cleanup/burn-down-plan.md` - Legacy SKO simplification and retirement scope merged here.
- `web/pages/skoCharts.tsx` - Quarantined legacy route.
- `web/pages/trends/index.tsx` - Current prediction leaderboard and Trends entry surface.
- `web/pages/trends/player/[playerId].tsx` - Current player prediction/trend detail surface.
- `web/pages/api/v1/ml/get-predictions-sko.ts` - Canonical prediction read API candidate.
- `web/pages/api/v1/ml/update-predictions-sko.ts` - Controlled prediction writer and cron/audit owner.
- `web/pages/api/v1/db/update-sko-stats.ts` - SKO source-stat ingestion route.
- `web/lib/supabase/utils/statistics.ts` - Characteristic-value, threshold, rolling, and confidence helpers.
- `web/lib/supabase/utils/calculations.ts` - Stable baseline GameScore calculation.
- `web/scripts/modeling/` - Backfill, training, scoring, upload, and artifact pipeline.
- `functions/api/sko_pipeline.py` - Monolithic pipeline proxy requiring segmentation or retirement.
- `web/components/Predictions/` - Reusable prediction UI.
- `web/lib/supabase/database-generated.types.ts` - Current SKO/prediction schema type evidence.

### Notes

- This list repairs the missing pair for both SKO PRDs and explicitly merges the SKO burn-down scope.
- Canonical behavior follows the later/current stability path: `sKO = GameScore × confidence multiplier`, using rolling characteristic value and empirical thresholds. The earlier residual-P/60 proposal is research input for Sustainability/Trends, not a competing production score.
- `/skoCharts` is labeled legacy. New product work belongs on Trends/current prediction surfaces unless evidence proves a unique supported-route requirement.
- Historical checkmarks remain claims pending implementation and runtime/data verification.
- Unbounded Supabase history/player scans must paginate until a short page or use verified server-side aggregates.

## Tasks

- [ ] 1.0 Reconcile sKO definition, ownership, and route/data contracts
  - [ ] 1.1 Map both PRDs, modeling notes, burn-down plan, Sustainability, Trends, and current code into one ownership matrix.
  - [ ] 1.2 Mark `prd-sko.md` superseded for production score definition while preserving its research requirements under Sustainability/Trends.
  - [ ] 1.3 Freeze the current contract: GameScore, per-game characteristic value, rolling CV window, empirical/fallback thresholds, smooth `[0.8,1.0]` confidence multiplier, and stability-adjusted score.
  - [ ] 1.4 Define canonical grains, identifiers, as-of date, model version, horizon, provenance, freshness, and fallback semantics for predictions and metrics.
  - [ ] 1.5 Verify active consumers use the canonical API/data contract and append legacy direct-table consumers as remediation/quarantine tasks.

- [ ] 2.0 Verify and finish source-stat, prediction, and metrics persistence
  - [ ] 2.1 Reconcile live schemas/migrations for `sko_skater_stats`, `sko_skater_years`, `predictions_sko`, and `predictions_sko_metrics` with generated types and code.
  - [ ] 2.2 Apply or repair missing migrations through the Supabase workflow, including RLS/API exposure appropriate to admin writers and read-only consumers.
  - [ ] 2.3 Verify `update-sko-stats` handles schema drift explicitly, paginates complete source reads, and does not silently skip model-required fields.
  - [ ] 2.4 Make prediction/metric upserts idempotent by stable player/as-of/horizon/model identity and preserve evaluation history.
  - [ ] 2.5 Add freshness, row-count, missing-player, and partial-write diagnostics for every persistence stage.

- [ ] 3.0 Complete the modeling and explanation backlog under frozen contracts
  - [ ] 3.1 Add LightGBM and XGBoost challengers only after dependency/runtime review; pin versions and use identical season splits/leakage rules.
  - [ ] 3.2 Export gain/permutation importance and per-player `top_features` with stable key, direction, magnitude, and source context.
  - [ ] 3.3 Add context-aware and centered-share candidates only through AS/PP/5v5/ES alignment and no-recursive/outcome-leakage checks.
  - [ ] 3.4 Evaluate season-aware CV normalization and alternate rolling windows without changing the default before held-out evidence supports promotion.
  - [ ] 3.5 Report Top-X-percent effects, z-scores, calibration/error, and segment stability for model review.
  - [ ] 3.6 Keep baseline GameScore weights stable unless an approved candidate beats the frozen baseline under recorded gates.
  - [ ] 3.7 Test rolling/partial windows, empirical quantiles/fallbacks, smoothstep bounds, characteristic scores, feature exports, and determinism.

- [ ] 4.0 Segment the long-running pipeline into durable operational stages
  - [ ] 4.1 Inventory backfill, feature, train, score, metric, upload, and cleanup dependencies, runtimes, and artifacts.
  - [ ] 4.2 Replace monolithic execution with bounded idempotent stages that fit current runtime limits and resume from persisted state.
  - [ ] 4.3 Define stable inputs/outputs, artifact version/checksum, run identity, retry, partial-failure state, and stale-run recovery.
  - [ ] 4.4 Chain stages through existing cron/orchestration; a new paid queue/workflow is a strategy checkpoint.
  - [ ] 4.5 Deduplicate/lock overlapping runs across instances and prevent incomplete artifacts from becoming current.
  - [ ] 4.6 Test bounded slices, resume behavior, failure propagation, and idempotent upload.

- [ ] 5.0 Verify and finish canonical APIs and mutation controls
  - [ ] 5.1 Enforce admin/secret authorization on mutation routes without logging secrets or using public-key write fallbacks.
  - [ ] 5.2 Validate/filter/paginate prediction reads and return explicit freshness, coverage, and partial states.
  - [ ] 5.3 Include identity, prediction, sKO/CV inputs, top features, model/version, timestamps, and source warnings deterministically.
  - [ ] 5.4 Normalize operator-safe errors while preserving cron audit timing and row counts.
  - [ ] 5.5 Test authorization, pagination, empty/stale/partial states, determinism, and response schema.

- [ ] 6.0 Finish Trends prediction and transparency UI
  - [ ] 6.1 Verify search, sorting, date stepping, metrics, sparklines, leaderboard, detail, and explainability use canonical APIs.
  - [ ] 6.2 Surface per-player top drivers with honest direction/magnitude and model/source context.
  - [ ] 6.3 Build MAE/MAPE and margin-of-error history after persisted metric coverage is verified.
  - [ ] 6.4 Add explicit loading, empty, stale, sparse, partial, unavailable-model, and error states.
  - [ ] 6.5 Verify responsive, keyboard/accessibility, chart labeling/tooltips, and color-independent status.
  - [ ] 6.6 Ensure legacy `/skoCharts` links do not imply quarantined behavior is supported.

- [ ] 7.0 Execute the SKO legacy burn-down safely
  - [ ] 7.1 Re-verify every burn-down file/consumer against current imports, routes, cron, scripts, and runtime ownership.
  - [ ] 7.2 Classify each artifact as canonical, compatibility-only, quarantine, generated evidence, or deletion candidate and record its replacement.
  - [ ] 7.3 Narrow/rename legacy SKO fetch utilities so they cannot be mistaken for approved contracts.
  - [ ] 7.4 Remove only proven-unused files; mass deletion/route removal requires the super-goal checkpoint.
  - [ ] 7.5 Verify navigation, APIs, cron inventory, build resolution, and Trends after each cleanup batch.

- [ ] 8.0 Add runbook, monitoring, and end-to-end evidence
  - [ ] 8.1 Document environment names only, stage commands, schedules, artifacts, state files, expected rows, retries, rollback, and failures.
  - [ ] 8.2 Monitor last success, freshness, player/prediction coverage, schema drift, errors, artifact mismatch, and stalled stages.
  - [ ] 8.3 Verify source ingest → staged pipeline → persistence → read API → Trends UI on a bounded date.
  - [ ] 8.4 Verify no secrets/local absolute paths are committed and generated artifacts are intentional and bounded.
  - [ ] 8.5 Synchronize both PRDs, modeling notes, burn-down plan, this list, and master ledger with final evidence.

## NEW Tasks

- [ ] NEW 9.0 Append every verified defect, manual/provider dependency, model question, and optimization discovered during execution here before closure.
