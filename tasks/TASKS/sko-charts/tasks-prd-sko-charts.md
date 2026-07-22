# sKO Charts and Pipeline — Reconciliation, Completion, and Burn-Down Tasks

## Relevant Files

- `tasks/TASKS/sko-charts/prd-sko-charts.md` - Current stability-CV sKO product/model PRD.
- `tasks/TASKS/sko-charts/prd-sko.md` - Earlier residual-P/60 sustainability concept retained as research input.
- `tasks/TASKS/sko-charts/sko-modeling-notes.md` - Modeling analysis and embedded checklist.
- `tasks/TASKS/sko-charts/sko-ownership-contract.md` - Reconciled PRD/runtime/formula/data/consumer/caller ownership matrix and promotion boundary.
- `tasks/TASKS/dead-code-cleanup/burn-down-plan.md` - Legacy SKO simplification and retirement scope merged here.
- `web/pages/skoCharts.tsx` - Quarantined legacy route.
- `web/pages/trends/index.tsx` - Current prediction leaderboard and Trends entry surface.
- `web/pages/trends/player/[playerId].tsx` - Current player prediction/trend detail surface.
- `web/pages/api/v1/ml/get-predictions-sko.ts` - Canonical prediction read API candidate.
- `web/pages/api/v1/ml/update-predictions-sko.ts` - Controlled prediction writer and cron/audit owner.
- `web/pages/api/v1/db/update-sko-stats.ts` - SKO source-stat ingestion route.
- `web/lib/supabase/utils/statistics.ts` - Characteristic-value, threshold, rolling, and confidence helpers.
- `web/lib/supabase/utils/calculations.ts` - Stable baseline GameScore calculation.
- `web/scripts/output/sko_*` - Retained generated artifacts from the deleted modeling implementation.
- `functions/lib/sko_pipeline.py` - External HTTP stage orchestrator requiring owner/stage verification or retirement.
- `web/components/Predictions/` - Reusable prediction UI.
- `web/lib/supabase/database-generated.types.ts` - Current SKO/prediction schema type evidence.

### Notes

- This list repairs the missing pair for both SKO PRDs and explicitly merges the SKO burn-down scope.
- The later stability-CV path remains the governing promotion requirement, but it is not current production behavior: the live compatibility writer persists a separate `baseline-moving-average` v0.2 score, the legacy GameScore/characteristic helpers are quarantined, and the offline ML scripts were deleted. NEW 9.2 owns the product-contract decision. The earlier residual-P/60 proposal remains Sustainability/Trends research, not a competing production score.
- `/skoCharts` is labeled legacy. New product work belongs on Trends/current prediction surfaces unless evidence proves a unique supported-route requirement.
- Historical checkmarks remain claims pending implementation and runtime/data verification.
- Unbounded Supabase history/player scans must paginate until a short page or use verified server-side aggregates.

## Tasks

- [ ] 1.0 Reconcile sKO definition, ownership, and route/data contracts
  - [x] 1.1 Map both PRDs, modeling notes, burn-down plan, Sustainability, Trends, and current code into one ownership matrix. Evidence (2026-07-22): `sko-ownership-contract.md` classifies every PRD, formula family, table/API, retained/deleted pipeline artifact, supported Trends surface, quarantine surface, and active caller without promoting incompatible implementations.
  - [x] 1.2 Mark `prd-sko.md` superseded for production score definition while preserving its research requirements under Sustainability/Trends. Evidence (2026-07-22): the older PRD remains explicitly superseded research; residual-P/60 work stays with Sustainability/Trends and is not relabeled as the live SKO writer.
  - [ ] 1.3 Freeze the current contract: GameScore, per-game characteristic value, rolling CV window, empirical/fallback thresholds, smooth `[0.8,1.0]` confidence multiplier, and stability-adjusted score.
  - [ ] 1.4 Define canonical grains, identifiers, as-of date, model version, horizon, provenance, freshness, and fallback semantics for predictions and metrics.
  - [x] 1.5 Verify active consumers use the canonical API/data contract and append legacy direct-table consumers as remediation/quarantine tasks. Evidence (2026-07-22): supported Trends pages use rolling/FORGE contracts and do not import the SKO reader bundle or legacy score helpers; the orphaned prediction components/API are recorded as P2 NEW 9.4 and remain quarantined.

- [ ] 2.0 Verify and finish source-stat, prediction, and metrics persistence
  - [x] 2.1 Reconcile live schemas/migrations for `sko_skater_stats`, `sko_skater_years`, `predictions_sko`, and `predictions_sko_metrics` with generated types and code. Evidence (2026-07-22): read-only live catalog, production-baseline DDL, generated types, and runtime references agree on three present tables and their exact keys/RLS/read policies; `predictions_sko_metrics` is absent from all four and remains an unimplemented planned contract documented in `sko-ownership-contract.md`.
  - [ ] 2.2 Apply or repair missing migrations through the Supabase workflow, including RLS/API exposure appropriate to admin writers and read-only consumers.
  - [x] 2.3 Verify `update-sko-stats` handles schema drift explicitly, paginates complete source reads, and does not silently skip model-required fields. Evidence (2026-07-22): all 16 NHL families share explicit cursor pagination; the active path emits one typed exact-28-column batch with canonical season identity and derived time-on-ice/IPP/SOG-per-60 fields; schema/write errors fail closed instead of triggering field-dropping retries. Focused helper/route tests pass 2 files/11 tests and full TypeScript passes.
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
  - [x] 5.2 Validate/filter/paginate prediction reads and return explicit freshness, coverage, and partial states. Evidence (2026-07-22): the public reader rejects invalid dates/ranges/ids/order/page sizes before data work, uses a stable date/player/horizon order with exact-count ranged pages capped at 2,000 rows, and returns page-scoped freshness plus coverage/has-more/partial metadata.
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
  - [x] 7.1 Re-verify every burn-down file/consumer against current imports, routes, cron, scripts, and runtime ownership. Evidence (2026-07-22): bounded file/import/caller/history searches cover the quarantined route/formulas/reader/UI, active protected writers and admin/cron callers, external HTTP orchestrator, deleted modeling executables, retained canonical-path outputs, and the previously omitted nested output copies now owned by NEW 9.12.
  - [x] 7.2 Classify each artifact as canonical, compatibility-only, quarantine, generated evidence, or deletion candidate and record its replacement. Evidence (2026-07-22): `sko-ownership-contract.md` assigns every grouped surface to supported adjacent ownership, operational compatibility, quarantine, deleted history, retained evidence, missing proposal, or archive/removal decision; no artifact is promoted or deleted by classification.
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
  - [ ] NEW 9.1 **P0 public privileged prediction writer:** `/api/v1/ml/update-predictions-sko` accepts unauthenticated GET/POST requests and executes reads/upserts with the service-role client. The shared fail-closed boundary passes local regression and exact branch-deployment 401/401/405 proof at commit `d20296a3238d376061a1e5bda100cc499b6f61b3`; keep this row open until the exact artifact is Production-targeted and the same value-free proof passes there (discovered 2026-07-22; branch artifact verified 2026-07-22).
  - [ ] NEW 9.2 **P1 production-score contract split:** the current writer persists `baseline-moving-average` v0.2 from recent points averages and points standard deviation, while the reconciled PRD calls quarantined GameScore/characteristic-value utilities the current stability-CV contract and the offline scripts describe ML-prediction × stability. Freeze one explicitly versioned product contract or keep each implementation quarantined with honest naming before closing definition/ownership work (discovered 2026-07-22).
  - [ ] NEW 9.3 **P1 documented modeling pipeline is no longer present:** commit `abbc01e8c5dc99e1544594e0c72bdecd0a013ea8` deliberately deleted `web/scripts/modeling/*`, but both PRDs, modeling notes, the task list, and tracked output artifacts still describe those scripts as executable owners. Reconcile the external `functions/lib/sko_pipeline.py` HTTP orchestrator and retained artifacts with an explicit restore, replacement, or historical-only disposition before pipeline/modeling tasks can close (discovered 2026-07-22).
  - [ ] NEW 9.4 **P2 prediction reader/UI is orphaned from supported Trends:** `PredictionsLeaderboard`, `InfoPopover`, `SkoExplainer`, and `usePredictionsSko` have no tracked page consumer, while `/trends` explicitly defers prediction-vs-actual/candlestick model surfaces and uses FORGE/rolling data instead. Keep the reader bundle quarantined or deliberately reintegrate it only after the score/data contract is promoted (discovered 2026-07-22).
  - [ ] NEW 9.5 **P0 public privileged SKO source-ingest writer:** `/api/v1/db/update-sko-stats` accepts unauthenticated requests and invokes broad `sko_skater_stats` service-role writes. The shared fail-closed boundary plus authenticated safe-405 method guard passes local regression and exact branch-deployment 401/401/405 proof at commit `d20296a3238d376061a1e5bda100cc499b6f61b3`; keep this row open until the exact artifact is Production-targeted and the same value-free proof passes there (discovered 2026-07-22; branch artifact verified 2026-07-22).
  - [x] NEW 9.6 **P1 source-ingest schema-learning and season-identity defect:** the active date writer now replaces its 236-field/error-learning payload and unscoped historical preload with one typed exact-28-column mapper, explicit canonical date-season resolution, derived `time_on_ice`/`ipp`/`sog_per_60`, and one fail-closed batch attempt. Exact-key/arithmetic/pagination/error regressions pass in the 2-file/11-test group plus full TypeScript (discovered and completed 2026-07-22).
  - [ ] NEW 9.7 **P1 prediction model-history identity collision:** the live `predictions_sko` primary key and writer conflict target are only `(player_id, as_of_date, horizon_games)`, so scoring the same player/date/horizon with a different `model_name` or `model_version` overwrites the prior model instead of preserving evaluation history. Resolve the canonical model-identity grain and migration/backfill compatibility before closing 1.4 or 2.4 (discovered 2026-07-22).
  - [x] NEW 9.8 **P1 incomplete and misordered prediction source reads:** default discovery now paginates ordered source rows until a short page, deduplicates/sorts the complete player set, and applies any operator limit only afterward with an explicit partial flag. Each player fetch selects the latest 60 rows descending and reverses them into chronological model input. Deterministic model, discovery, selected/processed/skipped, source cutoff/lag, series-length, and write-progress diagnostics pass the focused 6-test route/helper suite plus full TypeScript (discovered and completed 2026-07-22).
  - [ ] NEW 9.9 **P1 stale source stamped as current prediction:** the active daily writer defaults `as_of_date` to today without a freshness gate; production evidence on 2026-07-22 shows 107 current-dated predictions while the newest qualifying source game is 2026-04-16. Define the approved offseason/source-lag policy and expose source cutoff/lag before any freshness or current-prediction claim closes (discovered 2026-07-22).
  - [x] NEW 9.10 **P1 overprivileged public reader and credential-prefix logging:** `get-predictions-sko` now uses only the existing public read-only server client under the verified public SELECT policy; all service-role resolution, JWT decoding, credential-source warnings, and key-prefix logging are removed. Static scans plus the focused reader suite prove the bounded route no longer references or logs credentials (discovered and completed 2026-07-22).
  - [x] NEW 9.11 **P2 capped and identity-incomplete prediction response:** the reader now enforces strict dates/ranges/positive identifiers/order and bounded pages, selects exact-count deterministic ranges, includes `model_name`, `model_version`, and `updated_at`, and returns explicit page-scoped freshness/coverage/pagination/partial metadata. The dedicated reader suite passes 8/8 and the combined reader/writer group passes 2 files/14 tests plus full TypeScript (discovered and completed 2026-07-22).
  - [ ] NEW 9.12 **P2 duplicated unowned generated SKO artifacts:** four tracked files under the duplicated `web/web/scripts/output/` path have no runtime or documentation consumer; three parquet files differ from their newer canonical-path counterparts while the one-byte timing CSV is identical. The existing B-DEAD report already classifies the nested directory as an archive/removal decision. Preserve both evidence sets until retention/version provenance is approved under 8.4; do not infer deletion from generated naming alone (discovered 2026-07-22).
