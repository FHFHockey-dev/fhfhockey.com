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
	- [ ] 5.2 Add function to detect new games (max game_date processed per window_type) to limit scope.
	- [x] 5.3 Bulk insert canonical score-pipeline rows in bounded transactions. The active TypeScript owner splits player-prior, window-z, score, projection, and trend-band upserts into fail-fast batches of at most 400 rows and reports write-chunk counts from the three core bulk-writer routes (verified 2026-07-22; legacy draft-only barometer persistence remains superseded by Option A).
	- [ ] 5.4 Generate distribution snapshot (GAME window) percentiles & summary stats using `distribution.py`.
	- [ ] 5.5 Persist snapshot; update quintile mapping for *new* rows only.
	- [ ] 5.6 Implement retro recompute queue insertion when model_version or config_hash changes.
	- [ ] 5.7 Implement worker `retro_recompute.py` to process queue entries in small batches (idempotent, backoff on errors).
	- [ ] 5.8 Add logging & metrics (duration per phase, inserted row count, anomalies, extremes).
	- [ ] 5.9 Integration test: run full pipeline on fixture dataset & assert deterministic outputs.
	- [x] 5.10 Document the canonical scheduled route chain, exact retry identity, prerequisite/failure behavior, bounded read/write contracts, B-CRON-NST NEW 61 ownership dependency, Python offline-only boundary, and unimplemented distribution/retro semantics in the existing Sustainability runbook (verified 2026-07-22).

- [ ] 6.0 API Integration (Player Summary Extension & Leaderboard Endpoint)
	- [ ] 6.1 Extend existing player summary data access layer to join most recent GAME, G5, G10, STD scores (by game_date or season_id if STD).
	- [ ] 6.2 Implement leaderboard endpoint with parameters: window_type, min_games, min_score, rookie_only, page, page_size.
	- [ ] 6.3 Add query optimization: composite index usage; verify EXPLAIN plan.
	- [ ] 6.4 Return components breakdown optionally (?include=components) for debugging (rate limited / auth required).
	- [ ] 6.5 Add caching layer headers (ETag based on latest snapshot hash) for leaderboard responses.
	- [ ] 6.6 Add unit/integration test for API filters & pagination.
	- [ ] 6.7 Update OpenAPI / internal API docs (if present) or add markdown doc.

- [ ] 7.0 Frontend UI Components (Badge, Sparkline, Tooltip Integration)
	- [ ] 7.1 Implement `SustainabilityBadge` with tier color mapping (dynamic quantile labels) & accessible text.
	- [ ] 7.2 Implement `SustainabilitySparkline` fed by last N GAME scores (fallback skeleton if insufficient data).
	- [ ] 7.3 Implement `SustainabilityTooltip` showing component table (metric label, contrib, z_raw, z_soft, r, n) sorted by |contrib| desc.
	- [ ] 7.4 Integrate badge + sparkline into player list table columns; ensure responsive layout.
	- [ ] 7.5 Add formatting utilities (score formatting, percent to color scale) in `formatting.ts` with tests.
	- [ ] 7.6 Add loading / provisional state (display italic label or icon if status='provisional').
	- [ ] 7.7 Add unit tests (JSDOM / component tests) for rendering states & tooltip accessibility.
	- [ ] 7.8 Add storybook or minimal stories (if storybook present) for design QA.

- [ ] 8.0 Observability & QA (Logging, Snapshots, Random Recompute, Assertions)
	- [ ] 8.1 Implement structured logging (phase timings, anomaly counts) in pipeline.
	- [ ] 8.2 Add anomaly detector (|z_raw|>5) increment counters; persist extreme_flag in row.
	- [ ] 8.3 Implement random sample recompute function & log diff stats; alert if diff > tolerance.
	- [ ] 8.4 Implement nightly distribution drift detection (compare stdev & mean vs prior 7-day rolling average).
	- [ ] 8.5 Add health endpoint /api/internal/sustainability/health returning latest snapshot date & counts.
	- [ ] 8.6 Add test asserting all persisted scores in [0,100]; fail if outside.
	- [ ] 8.7 Add test verifying guardrails (0 & 100 only on raw thresholds) using synthetic S_raw values.
	- [ ] 8.8 Document log field schema for analytics ingestion.

- [ ] 9.0 Configuration Management & Versioning (DB-backed weights, toggles, model_version tracking)
	- [ ] 9.1 Implement admin (internal) function to insert new config version (deactivate previous) with validation.
	- [ ] 9.2 Add model_version stamping to every persisted barometer row and player_priors row.
	- [ ] 9.3 Add config_hash to barometer rows; test reproducibility of hash after reorder of JSON keys.
	- [ ] 9.4 Implement detection logic: if active config model_version > last processed version → enqueue retro recompute.
	- [ ] 9.5 Add migration or script to bump version and verify pipeline picks up new config.
	- [ ] 9.6 Add unit tests for version upgrade path (old rows untouched, new rows new version).
	- [ ] 9.7 Document versioning policy & A/B expansion path (future) in README or PRD appendix.

- [x] NEW 10.0 **P1 canonical schema/adapter ownership drift:** Option A is implemented. TypeScript/Supabase is the sole production owner; the disconnected Python adapter is removed after its only unrelated consumer moved to a domain-neutral connection helper, Python configuration/prior helpers require explicit injected clients, and Python persistence/incremental/snapshot/log/lock/retro paths fail closed while pure scoring remains offline. The current Supabase catalog, baseline, generated types, 21 focused Python tests, 14 TypeScript prior/pagination tests, TypeScript, lint, and compilation prove the boundary (closed 2026-07-22).

- [x] NEW 11.0 **P1 concatenated NHL season arithmetic:** `fetchPlayerSeasonCounts` subtracted integers from identifiers such as `20252026`, yielding nonexistent `20252025`/`20252024` history and silently zeroing prior-season contributions. Derive and validate `[20252026, 20242025, 20232024]`, retain full player-level batching/pagination, and prove all three live source seasons plus regression coverage (discovered and closed 2026-07-22).

- [x] NEW 12.0 **P1 canonical scheduled-pipeline completeness and payload safety:** the active league-skill reference read relied on one implicit PostgREST page, while player-prior, window-z, and score writers sent full route payloads in one request. Range-paginate the deterministic league reference; split every potentially large canonical Sustainability write into fail-fast batches of at most 400 rows; expose write-chunk metrics; retain composite-key idempotency; and document the exact scheduled chain, retries, ownership dependency, and intentionally absent distribution/retro semantics. Twenty-four focused tests, full TypeScript, scoped zero-error lint, formatting, and diff integrity prove the bounded implementation (discovered and closed 2026-07-22).

---
I have generated the high-level tasks based on the PRD. Ready to generate the sub-tasks? Respond with "Go" to proceed.
