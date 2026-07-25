## Relevant Files

- `tasks/prd-sustainability-barometer.md` - Source PRD defining scope, requirements, and data model.
- `migrations/sql/2025xxxx_create_priors_tables.sql` - Migration: create `priors_cache`, `player_priors_cache`, config, distribution, queue, barometer tables.
- `migrations/sql/2025xxxx_seed_sigma_constants.sql` - Migration: seed fixed standard deviation constants (initial SD mode = fixed).
- `functions/lib/sustainability/config_loader.py` - Load active model configuration (weights, toggles, constants) from DB.
- `functions/lib/postgres.py` - Domain-neutral Postgres connection helper used by the unrelated NST Python endpoint.
- `functions/lib/sustainability/README.md` - Canonical TypeScript ownership and Python offline-only boundary.
- `functions/lib/sustainability/offline.py` - Shared fail-closed exception used by every retired Python persistence/orchestration entry point.
- `web/lib/sustainability/priors.ts` - Canonical paginated league/player prior reads and Supabase upserts.
- `web/lib/sustainability/priors.test.ts` - Pagination, player-batch, and concatenated-season identity regressions.
- `web/lib/sustainability/persist.ts` - Shared fail-fast bounded upsert helper for canonical Sustainability writers.
- `web/lib/sustainability/persist.test.ts` - Chunk boundaries, conflict keys, idempotency, and fail-fast persistence regressions.
- `web/lib/sustainability/score.ts` - Canonical paginated league-reference reads, score construction, and bounded score writes.
- `web/lib/sustainability/score.test.ts` - Complete ordered league-reference pagination regression.
- `web/lib/sustainability/windows.ts` - Canonical rolling-window construction and bounded window-z persistence.
- `web/pages/api/v1/sustainability/rebuild-priors.ts` - Audited prior route with bounded player batches, timing, and write-chunk counts.
- `web/pages/api/v1/sustainability/rebuild-window-z.ts` - Audited window-z route with prerequisite, batch, timing, and write-chunk evidence.
- `web/pages/api/v1/sustainability/rebuild-score.ts` - Audited score route with prerequisite, batch, timing, and write-chunk evidence.
- `web/pages/api/v1/sustainability/trends.ts` - Existing dashboard leaderboard-like route using the canonical l3/l5/l10/l20 score contract.
- `web/lib/sustainability/read.ts` - Existing single-window player and upcoming-projection read contract.
- `web/lib/sustainability/health.ts` - Exact-count/latest-snapshot health reader for canonical Sustainability outputs.
- `web/pages/api/internal/sustainability/health.ts` - Admin/cron-protected Sustainability health endpoint.
- `web/lib/sustainability/health.test.ts` - Exact-count, empty-table, and fail-closed health-reader regressions.
- `tasks/TASKS/three-pillars-analytics/sustainability/SUSTAINABILITY-RUNBOOK.md` - Canonical scheduled chain, retry/failure, ownership, and unsupported-feature boundary.
- `web/lib/supabase/pagination.ts` - Shared verified range-pagination and bounded filter-chunk helpers.
- `supabase/migrations/20260716112908_production_schema_baseline.sql` - Authoritative baseline for canonical Sustainability tables, keys, grants, and indexes.
- `functions/lib/env_loader.py` - Local helper to ingest `web/.env.local` for SUPABASE_DB_URL & related secrets in dev without exporting.
- `functions/lib/sustainability/priors.py` - League × position prior (Beta) computation utilities.
- `functions/lib/sustainability/player_priors.py` - Multi-season blending + posterior mean calculation.
- `functions/lib/sustainability/windows.py` - Rolling window builder (GAME, G5, G10, STD) with freshness enforcement.
- `functions/lib/sustainability/scoring.py` - Z-score, reliability weighting, soft clipping, contribution + sigmoid scoring.
- `functions/lib/sustainability/pipeline.py` - Nightly orchestration: end-to-end run, distribution snapshot, retro queue enqueue.
- `functions/lib/sustainability/retro_recompute.py` - Processes queued retro recompute tasks.
- `functions/api/sustainability/leaderboard.ts` - API endpoint for sustainability leaderboard (window filtering, pagination).
- `functions/api/players/summary_extend.ts` - Extends existing player summary with sustainability payload.
- `web/components/Sustainability/SustainabilityBadge.tsx` - Badge + tier color UI component.
- `web/components/Sustainability/SustainabilitySparkline.tsx` - Mini trend sparkline (GAME scores over recent N).
- `web/components/Sustainability/SustainabilityTooltip.tsx` - Tooltip rendering component breakdown (z_raw, z_soft, r, contrib).
- `web/lib/api/sustainabilityClient.ts` - Frontend client helpers to fetch sustainability data.
- `web/styles/sustainability.module.scss` - Styling for badge / tooltip / sparkline.
- `web/__tests__/sustainability/scoring.test.ts` - Unit tests for score formatting & guardrails.
- `functions/tests/test_priors.py` - Unit tests for Beta prior calculations & posterior blending.
- `functions/tests/test_scoring.py` - Unit tests for z-score → reliability → soft clip → contribution pipeline.
- `functions/tests/test_windows.py` - Tests for rolling window construction & freshness filtering.
- `functions/tests/test_pipeline_integration.py` - Integration test: sample data through full pipeline produces deterministic output.
- `migrations/sql/2025xxxx_seed_config.sql` - Seed initial model_sustainability_config row (model_version=1, weights, toggles, constants).
- `functions/lib/sustainability/constants.py` - Holds fallback fixed σ constants loader (if not in DB yet) & metric code enums.
- `functions/lib/sustainability/distribution.py` - Distribution snapshot + quintile assignment utilities.
- `functions/lib/sustainability/formatting.ts` - Frontend formatting helpers (score guardrails, tier colors, tooltip mapping).

### Notes

- File paths represent proposed additions; exact naming may be adjusted during implementation.
- Python assumed for nightly batch (existing `functions/` Python environment). Frontend uses Next.js TypeScript.
- Migrations use raw SQL files in `migrations/sql/` (adjust if a migration framework is adopted).
- Retro recompute logic isolated for future scalability.
- Test files colocated by domain for clarity; more granular tests may be added later.

## Tasks

- [x] 1.0 Database Schema & Migrations. Option A makes the deployed TypeScript/Supabase contract canonical; the production catalog, checked-in baseline, generated types, primary keys, uniqueness, and barometer indexes were verified 2026-07-22 without a schema mutation.
	- [x] 1.1 Draft DDL for `priors_cache`, `player_priors_cache`, `model_player_game_barometers`, `model_sustainability_config`, `sustainability_distribution_snapshots`, `sustainability_recompute_queue` per PRD.
	- [x] 1.2 Add NOT NULL / PK / indexes (player_id + window_type + game_date, season_id + position_code + stat_code).
	- [x] 1.3 Add partial index for `model_player_game_barometers(window_type='GAME')` to speed leaderboard.
	- [x] 1.4 Create migration file `2025xxxx_create_priors_tables.sql` (Consolidated into `20250928_create_sustainability_core_tables.sql`; no separate stub needed.)
	- [x] 1.5 Create migration file `2025xxxx_seed_sigma_constants.sql` (Seed initial fixed SD constants).
	- [x] 1.6 Create migration file `2025xxxx_seed_config.sql` with initial model configuration (model_version=1).
    - [x] 1.7 Verify the authoritative schema, indexes, and constraints. The checked-in production baseline and a value-free live catalog query prove canonical `sustainability_priors`, `sustainability_player_priors`, and `model_player_game_barometers` columns, both prior primary keys, the barometer uniqueness contract, and nine supporting indexes (verified 2026-07-22). Legacy draft-only table names are superseded rather than migrated. Notes:
                * Core tables present: priors_cache, player_priors_cache, sustainability_sigma_constants, model_sustainability_config,
                    model_player_game_barometers, sustainability_distribution_snapshots, sustainability_recompute_queue.
                * Primary keys correct; composite PK for priors_cache (season_id, position_code, stat_code) and player_priors_cache (player_id, season_id, stat_code).
                * Barometers indexes include: player_window_date, window_score, GAME partial indexes, version_hash, newly added GAME score desc & player/date partials.
                * Added uniqueness on (player_id, window_type, game_date, model_version) prevents duplicate recalculations.
                * Suggested future (optional) index if leaderboard filters by rookie_status frequently: CREATE INDEX idx_barometers_rookie_window ON model_player_game_barometers(rookie_status, window_type) WHERE window_type='GAME'; (Defer until profiling.)
                * All CHECK constraints present (score range, raw range, window_type domain).
    - [x] 1.8 (Optional) Add foreign key constraints (player_id → players) if table exists and performance acceptable.
	- [x] 1.9 Document schema decisions in PRD appendices / update task list (Added: FK optional rationale, uniqueness strategy, partial indexes justification, rookie_status index deferred until profiling.)

- [x] 2.0 Configuration & Constants Initialization. All nine children are implemented; the current configuration/constants, deterministic-hash, fallback, validation, scoring, and benchmark group passes within 28 focused tests and Python compilation (verified 2026-07-22).
	- [x] 2.1 Implement `config_loader.py` to fetch active config row (latest active TRUE and highest model_version).
	- [x] 2.2 Validate presence of required keys (weights, toggles, constants, k_r map, c, sd_mode, freshness_days) (Enhanced validation added: k_r coverage, guardrails bounds, freshness_days > 0).
	- [x] 2.3 Implement hash generation (stable JSON canonicalization + SHA256) for config_hash. (Added `build_config_hash_payload` to isolate semantic fields; refactored `load_config`.)
	- [x] 2.4 Implement fallback to environment-embedded default if DB row missing (fail gracefully, log warning). (Added structured warnings + debug summary log.)
	- [x] 2.5 Add unit tests to confirm deterministic hash for semantically identical JSON ordering. (Created `functions/tests/test_config_loader.py` with hash stability + fallback scenarios.)
	- [x] 2.6 Add function to upsert new config version (future admin utility) — behind feature flag. (Stub `upsert_new_config_version` added raising ConfigUpsertError until DB integration.)
	- [x] 2.7 Store metric code enum & mapping (human label) in `constants.py`. (Added `METRIC_CODES`, `HUMAN_LABELS`.)
	- [x] 2.8 Implement loader for fixed SD constants table (or embedded JSON) returning dict keyed by metric × position_code. (Added `load_sd_constants` with graceful fallback merge.)
	- [x] 2.9 Add validation: raise if any required metric weight missing while toggle indicates active. (Added `cross_validate_weights_vs_toggles` + tests.)

- [x] 3.0 Prior & Posterior Computation Modules (League + Player). The canonical TypeScript implementation now performs complete paginated league aggregation, current-player batching, three-season history reads, and exact Supabase upserts; 14 focused prior/pagination tests and live source/schema counts pass (verified 2026-07-22).
	- [x] 3.1 Implement `priors.py` function `compute_league_beta_priors(season_id)` returning list of {season_id, position_code, stat_code, alpha0, beta0, k, league_mu}. (Added `priors.py` + unit tests `test_priors.py`.)
	- [x] 3.2 Aggregate successes/trials for shp, oishp, ipp, and ppshp from canonical `player_totals_unified`. `fetchLeagueMeans` now range-paginates every ordered row before pooling counts (verified 2026-07-22).
	- [x] 3.3 Upsert league priors to authoritative `sustainability_priors` on `(season_id, position_group, stat_code)`; the live schema has 22 rows and the exact primary key (verified 2026-07-22).
	- [x] 3.4 Fetch complete current plus prior-two-season player counts. Current-season identities are fully paginated, offset/limit is applied to players rather than raw season rows, and selected IDs are fetched through bounded filter chunks with per-chunk pagination (verified 2026-07-22).
	- [x] 3.5 Implement weight normalization if seasons missing (rookie case) and set rookie_status flag. (Automatic normalization logic + rookie detection.)
	- [x] 3.6 Calculate posterior mean with Beta update using league prior (store model_version from config). (Posterior math in `compute_player_posteriors`.)
	- [x] 3.7 Upsert canonical `sustainability_player_priors` rows with blended/posterior fields on the deployed composite primary key. Production currently contains 5,152 rows (verified 2026-07-22).
	- [x] 3.8 Add unit tests for: correct Beta posterior when no history; correct weighted blend with partial seasons; reproducibility. (Added tests in `test_player_priors.py` including reproducibility & rookie summary.)
	- [x] 3.9 Add logging summary (#players processed, rookies, changes vs prior run). (Added `summarize_player_posteriors` & `log_player_posteriors_summary`.)

- [x] 4.0 Rolling Window & Scoring Engine (Reliability, Soft Clip, Contributions). All twelve children have current deterministic coverage; the complete configuration/prior/window/scoring/finishing/benchmark group passes 28 focused tests and Python compilation (verified 2026-07-22).
	- [x] 4.1 Implement `windows.py` to build GAME, G5, G10, STD aggregates with freshness filter (<= freshness_days default 45).
	- [x] 4.2 Provide builder returning exposures & rates for each metric (shots, goals, on-ice GF/SF, points, ixG, ICF, HDCF, minutes if needed). (Implemented via `windows.py` & verified in tests.)
	- [x] 4.3 Implement scoring util: raw z (luck metrics) vs posterior baseline; raw z (stabilizers) vs position mean/σ. (Implemented as `zscores.annotate_zscores` for rate metrics sh_pct, oish_pct, ipp.)
	- [x] 4.4 Implement reliability r = sqrt(n/(n+k_r)) for sh_pct, oish_pct, ipp; r=1 for stabilizers (placeholder). (Implemented in `reliability.compute_reliability`.)
	- [x] 4.5 Implement soft clip function tanh-based with configurable c. (Implemented in `clipping.apply_soft_clipping` + unit tests + integrated prerequisite for contributions.)
	- [x] 4.6 Compute contrib per metric (weights * r * zc) producing contrib_<metric> & contrib_total (Implemented in `contributions.compute_contributions` with tests). Pending logistic score & formatted integer S moved to new 4.7.
	- [x] 4.7 Accumulate logistic score S_raw & formatted integer S (final mapping) using contrib_total. (Implemented in `scoring.apply_logistic_scoring`; integrated via `run_full_scoring_pipeline` including soft clipping → contributions → logistic → components_json. Added integration test `functions/tests/test_full_scoring_pipeline.py`.)
	- [x] 4.8 Implement finishing residual components (rate & count) conditional on toggle; ensure no division by zero. (Added `finishing.py` with annotate_finishing_residuals, integrated into `run_full_scoring_pipeline`, tests in `test_finishing.py`.)
	- [x] 4.9 Implement quintile assignment placeholder using prior snapshot (fallback: None => mark provisional_tier until snapshot available). (Added `distribution.py` with snapshot builder & in-memory quintile assignment; integrated into `run_full_scoring_pipeline` returning `snapshot` and assigning `quintile` + `provisional_tier` fields.)
	- [x] 4.10 Pack components_json with required fields (z_raw, z_soft, r, n, weight, contrib, extreme flag). (Enhanced `scoring.build_components_json` to include obs, exp, n, extreme, rookie, weight, z, zc, contrib, r; pipeline passes configurable threshold.)
	- [x] 4.11 Add unit tests for scoring edge cases: zero exposures, extreme high z, reliability scaling, formatting guardrails. (Added `test_scoring_edge_cases.py`: covers zero trials contribution=0, clipping saturation, reliability monotonicity, guardrail bounds not hitting 0/100, finishing residual rate None when shots=0.)
	- [x] 4.12 Benchmark scoring function on synthetic dataset (≥5k players × 4 windows) ensure runtime acceptable (< threshold) & record metrics. (Added `benchmark.py` with synthetic generator + orchestrated run timing; added `test_benchmark.py` fast-mode verifying structure.)

- [ ] 5.0 Nightly Pipeline Orchestration & Retro Recompute Queue
	- [ ] 5.1 Implement `pipeline.py` main orchestration run: load config → priors → player priors → new games → windows → scoring → persistence. (In progress: added `orchestrator.py` with `orchestrate_full_run` performing full scoring flow & returning structured summary; pending: incremental new game detection, run logging persistence, DB locking, retro queue trigger.)
	- [x] 5.2 Compare the newest `player_stats_unified` source date with the newest persisted score `sourceCutoffs.observed.player_stats_source_date`; skip already-processed source work before prerequisites/builds and retain explicit `force=true` replay behavior (verified 2026-07-23).
	- [x] 5.3 Bulk insert canonical score-pipeline rows in bounded transactions. The active TypeScript owner splits player-prior, window-z, score, projection, and trend-band upserts into fail-fast batches of at most 400 rows and reports write-chunk counts from the three core bulk-writer routes (verified 2026-07-22; legacy draft-only barometer persistence remains superseded by Option A).
	- [x] 5.4 Generate deterministic canonical `l3/l5/l10/l20` distribution snapshots on complete runs with count/min/max/mean/population-stdev and interpolated p10/p25/p50/p75/p90; expose them in the audited run receipt (verified 2026-07-23).
	- [ ] 5.5 Persist snapshot; update quintile mapping for *new* rows only.
	- [ ] 5.6 Implement retro recompute queue insertion when model_version or config_hash changes.
	- [ ] 5.7 Implement worker `retro_recompute.py` to process queue entries in small batches (idempotent, backoff on errors).
	- [x] 5.8 Canonical score rebuilds emit structured named phase durations, processed/built/written/chunk counts, pre-clamp extreme-row counts, replay diff statistics, and distribution-drift status through fixed audited fields (verified 2026-07-23).
	- [ ] 5.9 Integration test: run full pipeline on fixture dataset & assert deterministic outputs.
	- [x] 5.10 Document the canonical scheduled route chain, exact retry identity, prerequisite/failure behavior, bounded read/write contracts, B-CRON-NST NEW 61 ownership dependency, Python offline-only boundary, and unimplemented distribution/retro semantics in the existing Sustainability runbook (verified 2026-07-22).

- [x] 6.0 API Integration (Player Summary Extension & Leaderboard Endpoint). Canonical four-window player summaries, latest-snapshot leaderboard filters/pagination, indexed reads, protected components, conditional caching, focused tests, and internal documentation are complete (verified 2026-07-23).
	- Dependency order: resolve NEW 14 window/route ownership → implement 6.1/6.2 → verify 6.3 and secure 6.4 → add 6.5 → close 6.6/6.7.
	- [x] 6.1 Extend the existing player summary data access layer with the latest canonical `l3`, `l5`, `l10`, and `l20` score for one player. The additive `summary=true` route mode preserves the existing single-window response, selects one deterministic latest row per window, and returns score plus model/config provenance; the focused read/route/runtime group passes 3 files/7 tests (verified 2026-07-23).
	- [x] 6.2 Implement the latest-snapshot leaderboard endpoint with canonical `window_type`, `min_games`, `min_score`, `rookie_only`, `page`, and bounded `page_size` parameters. Current-season games and deterministic prior-season rookie identity come from complete range-paginated `player_totals_unified` reads (verified 2026-07-23).
	- [x] 6.3 Verify the production `idx_susscore_date_win` composite index with read-only `EXPLAIN (FORMAT JSON)`: snapshot discovery uses an index-only backward scan and exact snapshot/window row selection uses an index scan (verified 2026-07-23).
	- [x] 6.4 Return `components` only for `include=components` after the existing admin/cron boundary authorizes the request; public and invalid-credential component requests fail closed (verified 2026-07-23).
	- [x] 6.5 Emit a deterministic SHA-256 response ETag and public shared-cache headers; matching `If-None-Match` returns 304, while protected component responses are `private, no-store` (verified 2026-07-23).
	- [x] 6.6 Cover canonical filters, deterministic score/player ordering, rookie/minimum-game behavior, response pagination, authorization, ETag headers, and 304 handling in the focused 3-file/10-test group (verified 2026-07-23).
	- [x] 6.7 Document player summary, leaderboard parameters, exact rookie/minimum-game semantics, caching, component authorization, pagination, and composite-index proof in `web/README.md` (verified 2026-07-23).

- [x] 7.0 Frontend UI Components (Badge, Sparkline, Tooltip Integration). The canonical dashboard player surface now consumes reusable, tested Sustainability signal components (verified 2026-07-23).
	- [x] 7.1 Implement `SustainabilityBadge` with dynamically derived lower/upper quantile tiers, token-backed colors, formatted score, and complete accessible text (verified 2026-07-23).
	- [x] 7.2 Implement `SustainabilitySparkline` from the last ten canonical-window scores over a bounded 90-day, chunked/paginated history read, with a truthful insufficient-data fallback (verified 2026-07-23).
	- [x] 7.3 Implement an accessible disclosure/table tooltip showing metric, contribution, canonical z values, and explicit unavailable reliability/sample fields sorted by absolute contribution (verified 2026-07-23).
	- [x] 7.4 Integrate badge, score sparkline, and component disclosure into both Trust/Fade player lists without nesting interactive controls inside player links (verified 2026-07-23).
	- [x] 7.5 Add tested Sustainability score formatting, quantile thresholds, and tier mapping in `components/sustainability/formatting.ts` (verified 2026-07-23).
	- [x] 7.6 Surface guardrail-degraded rows as italic, explicitly announced provisional badges and retain the existing loading/error/empty states (verified 2026-07-23).
	- [x] 7.7 Add a shared JSDOM component suite covering dynamic/provisional badge semantics, sparkline/fallback accessibility, and contribution sorting; focused integration/helper/normalizer coverage passes 4 files/39 tests (verified 2026-07-23).
	- [x] 7.8 Add the Storybook `Sustainability/Player signal` story covering ready/provisional badges, score history, and component disclosure (verified 2026-07-23).

- [x] 8.0 Observability & QA (Logging, Snapshots, Random Recompute, Assertions). Canonical score telemetry, extremes, replay verification, nightly drift, health, range/boundary guards, and operational documentation are complete (verified 2026-07-23).
	- [x] 8.1 The canonical score pipeline emits one structured event and audited response fields with named prerequisite/player/reference/build/persist phase timings, processed/written counts, and anomaly count (verified 2026-07-23).
	- [x] 8.2 Detect finite pre-clamp raw z values with `|z|>5`, persist `extremeFlag`, sorted metric names, and threshold in canonical score components, and report the exact extreme-row count from each score rebuild (verified 2026-07-23).
	- [x] 8.3 Randomly sample at most 25 rebuilt rows, compare against stored same-snapshot/window/player values before persistence, report requested/compared/missing/max/mean diff, and emit a fixed alert when the 0.01 tolerance is exceeded (verified 2026-07-23).
	- [x] 8.4 The existing active nightly `runAll=true` score job now range-paginates the complete current/prior-seven-day `l10` population, compares mean/stdev with the prior daily average, and reports/alerts beyond a five-point tolerance without adding a cron or flag (verified 2026-07-23).
	- [x] 8.5 Add health endpoint `/api/internal/sustainability/health` returning exact row counts and latest snapshot dates for the canonical score, trend-band, and projection outputs. The route is GET-only and protected by the existing admin/cron boundary; focused empty-table/error tests, TypeScript, lint, formatting, and diff integrity pass (verified 2026-07-22).
	- [x] 8.6 Assert all persisted scores remain finite and within [0,100]. A value-free production aggregate proves 247,024/247,024 rows valid with minimum 0 and maximum 100; current guardrail tests cover clipped and invalid inputs (verified 2026-07-22).
	- [x] 8.7 Verify exact-endpoint guardrails with synthetic `s_raw` values. Canonical v2 keeps two-decimal fractional persistence; unqualified stored 0/100 values are replaced with the derived fractional score and warned, while threshold-qualified endpoints remain exact. The focused score/guardrail/runtime suite passes 6/6 (verified 2026-07-23).
	- [x] 8.8 Document the exact scheduled-route response and `cron_job_audit` field schema, nullable/not-applicable counter semantics, success interpretation, bounded diagnostic fields, and forbidden secret values in the canonical runbook (verified 2026-07-22).

- [x] 9.0 Configuration Management & Versioning. The local canonical v2 migration, config loader, first-class score/prior provenance, version-triggered queue receipt, generated types, tests, and runbook policy are complete; NEW 15 retains executable/application proof (verified 2026-07-25).
	- [x] 9.1 Add service-only `activate_sustainability_config` with exact +1 revision validation, one-active-row locking, canonical weight/config validation, previous-row deactivation, and one transactional recompute receipt (verified 2026-07-25).
	- [x] 9.2 Add nonblank first-class string `model_version` to canonical `sustainability_scores` and `sustainability_player_priors`; new score/prior writers stamp the loaded active v2 identity (verified 2026-07-25).
	- [x] 9.3 Add first-class `config_hash` to canonical score/prior rows and configuration. Stable recursive-key hashing reproduces canonical `fnv1a_91691726` independent of JSON key order and fails closed on mismatch (verified 2026-07-25).
	- [x] 9.4 Config activation enqueues one unique queued/running recompute identity under the same transaction after the exact revision advances; no silent active-version drift is possible (verified locally 2026-07-25).
	- [x] 9.5 CLI-generated migration `20260725223034_add_sustainability_version_provenance.sql` preserves v1 as legacy, seeds compatible canonical revision 2, and makes score/prior routes load that active config before writes (verified locally 2026-07-25).
	- [x] 9.6 Focused config/migration/route/read/provenance coverage proves legacy rows are retained, new rows carry first-class v2 identity, tampered/incompatible config fails closed, and exactly one active row is required (verified 2026-07-25).
	- [x] 9.7 The canonical versioning, historical-fidelity, recompute, and future A/B promotion policy is documented in `web/README.md`, the PRD, and the Sustainability runbook (verified 2026-07-25).

- [x] NEW 10.0 **P1 canonical schema/adapter ownership drift:** Option A is implemented. TypeScript/Supabase is the sole production owner; the disconnected Python adapter is removed after its only unrelated consumer moved to a domain-neutral connection helper, Python configuration/prior helpers require explicit injected clients, and Python persistence/incremental/snapshot/log/lock/retro paths fail closed while pure scoring remains offline. The current Supabase catalog, baseline, generated types, 21 focused Python tests, 14 TypeScript prior/pagination tests, TypeScript, lint, and compilation prove the boundary (closed 2026-07-22).

- [x] NEW 11.0 **P1 concatenated NHL season arithmetic:** `fetchPlayerSeasonCounts` subtracted integers from identifiers such as `20252026`, yielding nonexistent `20252025`/`20252024` history and silently zeroing prior-season contributions. Derive and validate `[20252026, 20242025, 20232024]`, retain full player-level batching/pagination, and prove all three live source seasons plus regression coverage (discovered and closed 2026-07-22).

- [x] NEW 12.0 **P1 canonical scheduled-pipeline completeness and payload safety:** the active league-skill reference read relied on one implicit PostgREST page, while player-prior, window-z, and score writers sent full route payloads in one request. Range-paginate the deterministic league reference; split every potentially large canonical Sustainability write into fail-fast batches of at most 400 rows; expose write-chunk metrics; retain composite-key idempotency; and document the exact scheduled chain, retries, ownership dependency, and intentionally absent distribution/retro semantics. Twenty-four focused tests, full TypeScript, scoped zero-error lint, formatting, and diff integrity prove the bounded implementation (discovered and closed 2026-07-22).

- [x] NEW 13.0 **P1 persisted score-format/version contract drift:** canonical v2 intentionally retains two-decimal `s_100` precision and defines `s_raw` as the pre-sigmoid contribution logit. Current value-free production evidence covers 249,520 rows: 217,724 are fractional; all 20,563 exact 100 and 8,754 exact zero rows meet the 0.995/0.005 probability thresholds, with zero invalid endpoints. Because both historical forms satisfy one numeric v2 contract, no rewrite/version bump is required. Shared runtime constants, PRD formula/persistence language, fail-closed persisted-row endpoint guards, and the 3-file/6-test focused suite now agree; UI-only integer formatting remains presentation rather than persistence (closed 2026-07-23).

- [x] NEW 14.0 **P1 canonical API/window ownership drift:** deployed `l3/l5/l10/l20` is canonical and draft `GAME/G5/G10/STD` is retired. Additive player summary plus latest-snapshot leaderboard/filter/pagination/index/authenticated-components/ETag/docs rows 6.1–6.7 are complete without breaking the default player response; the focused group passes 3 files/10 tests, TypeScript, production read-only index-plan proof, and diff integrity (closed 2026-07-23).

- [ ] NEW 15.0 **P1 canonical version/config provenance drift:** the local canonical repair is complete. CLI-generated migration `20260725223034` preserves existing score components when present, labels the remaining score/prior history `legacy_unversioned`, adds first-class version/hash columns, constrains one active compatible v2 config, removes browser mutation grants, creates a forced-RLS service-only recompute queue, and exposes one security-invoker fixed-search-path activation RPC. Score/prior routes load and validate the active config before writes, response telemetry exposes its revision/version/hash, generated types agree, and 9 focused files/26 tests plus full TypeScript pass. Keep the root open for executable migration/rollback/ACL/queue proof on an authorized isolated database, exact Production application before code publication, and bounded worker/replay evidence; do not treat the unused draft barometer table as canonical (updated 2026-07-25).

- [x] NEW 16.0 **P1 canonical source-advance provenance key drift:** incremental detection read obsolete `observed.player_stats_source_date` while current provenance writes `observed.player_stats_unified`, forcing already-processed sources down the fail-open path. Read the canonical key first, retain the old key only as compatibility, and cover both shapes directly (discovered and closed 2026-07-25).

---
I have generated the high-level tasks based on the PRD. Ready to generate the sub-tasks? Respond with "Go" to proceed.
