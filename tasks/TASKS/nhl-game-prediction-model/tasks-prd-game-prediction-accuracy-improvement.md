## Relevant Files

- `web/lib/game-predictions/espnOdds.ts` - Current ESPN odds parser; extend or pair with persisted odds ingestion.
- `web/pages/api/v1/game-predictions/espn-odds.ts` - Current public ESPN odds proxy used by `/nhl-predictions`.
- `web/lib/game-predictions/featureSources.ts` - Feature-source registry and feature-set version for market, multi-window, and model-candidate sources.
- `web/lib/game-predictions/featureBuilder.ts` - Builds immutable game prediction feature snapshots; add market, multi-window, season-phase, and close-score features here.
- `web/lib/game-predictions/featureBuilder.test.ts` - Regression tests for as-of filtering, rolling-window math, fallback flags, and feature payload shape.
- `web/lib/game-predictions/baselineModel.ts` - Current logistic baseline feature vector, model training, top factors, and prediction metadata.
- `web/lib/game-predictions/baselineModel.test.ts` - Tests for feature-vector changes, probability output, top-factor metadata, and candidate model hooks.
- `web/lib/game-predictions/accountability.ts` - Walk-forward backtests, ablation variants, baseline comparisons, calibration buckets, and promotion evidence.
- `web/lib/game-predictions/accountability.test.ts` - Tests for ablations, market baselines, season-phase segmentation, and promotion evidence summaries.
- `web/lib/game-predictions/evaluation.ts` - Model metrics and metric segments; add market-relative and season-phase segments if not already covered.
- `web/lib/game-predictions/evaluation.test.ts` - Unit tests for new metric segments and calibration behavior.
- `web/lib/game-predictions/adminHealth.ts` - Production health report and post-promotion segment monitoring.
- `web/pages/api/v1/game-predictions/feature-signal-analysis.ts` - Existing feature signal analysis endpoint; extend for mutual-information style ranking and leakage checks.
- `web/pages/api/v1/game-predictions/backtest-ablation.ts` - Dry-run comparison endpoint for feature/model variants before promotion.
- `web/pages/api/v1/game-predictions/accuracy-loop.ts` - Dry-run accuracy improvement loop endpoint combining feature-signal analysis, leakage checks, ablations, baseline comparisons, and promotion evidence.
- `web/__tests__/pages/api/v1/game-predictions/accuracy-loop.test.ts` - API route tests for accuracy-loop dry-run scope, candidate variant validation, and explicit evidence-persistence confirmation.
- `web/pages/api/v1/game-predictions/import-market-odds.ts` - Historical market-odds import endpoint with dry-run defaults, expected-game coverage checks, and explicit write confirmation.
- `web/__tests__/pages/api/v1/game-predictions/import-market-odds.test.ts` - API route tests for market-odds import dry-run behavior, expected-window coverage, blocked imports, and write confirmation.
- `web/scripts/import-historical-market-odds.ts` - Guarded historical odds import CLI with expected-game discovery, import-file contract output, dry-run defaults, and explicit write confirmation.
- `web/scripts/import-historical-market-odds.test.ts` - Unit tests for historical odds import parsing, manifest normalization, expected-game discovery, and provenance metadata attachment.
- `web/pages/api/v1/game-predictions/generate.ts` - Single-game serving prediction endpoint with explicit baseline-bootstrap opt-in.
- `web/pages/api/v1/game-predictions/forecast.ts` - Windowed serving prediction endpoint with explicit baseline-bootstrap opt-in.
- `web/__tests__/pages/api/v1/game-predictions/generate.test.ts` - API route tests for generate endpoint bootstrap opt-in behavior.
- `web/__tests__/pages/api/v1/game-predictions/forecast.test.ts` - API route tests for forecast endpoint bootstrap opt-in behavior and method guard.
- `web/pages/nhl-predictions.tsx` - Public prediction page; surface only validated model and market comparison details.
- `web/styles/NhlPredictions.module.scss` - Styling for any new model, market, or factor UI elements on the public page.
- `web/lib/game-predictions/publicPredictions.ts` - Public payload builder that filters serving rows and metrics to active production model versions.
- `web/lib/game-predictions/publicPredictions.test.ts` - Unit tests for public production gating, factor allowlists, and snapshot-only market display.
- `web/__tests__/pages/api/v1/game-predictions/latest.test.ts` - API route tests for the public latest-predictions payload boundary and cache/error behavior.
- `web/scripts/check-game-prediction-health.ts` - Read-only CLI runner for the admin health report and optional alert-failing monitoring mode.
- `web/scripts/check-game-prediction-health.test.ts` - Unit tests for health-check CLI parsing and summary output.
- `web/scripts/forecast-game-predictions.ts` - Guarded dry-run/write CLI runner for regenerating public game-prediction serving rows through the existing workflow.
- `web/scripts/forecast-game-predictions.test.ts` - Unit tests for forecast CLI parsing, write guardrails, date-window resolution, and summary output.

### Notes

- This task list is generated from the game-prediction accuracy-improvement plan informed by `gmalbert/hockey-predictions`, `gschwaeb/NHL_Game_Prediction`, and `JNoel71/NHL-Game-Prediction-Model`.
- Do not copy repo code directly into production. Port durable concepts into the existing FHFH prediction architecture: immutable feature snapshots, strict as-of rules, append-only prediction history, accountability backtests, and model-version promotion gates.
- Use `npx tsc --noEmit --pretty false` and targeted Vitest files after implementation changes.
- Primary promotion metrics are log loss, Brier score, calibration, and enough evaluated games. Accuracy is useful but must not be the sole promotion metric.
- Guardrail: do not train on current/future ESPN odds. Odds can become a model feature only after historical odds snapshots are stored with `captured_at` before prediction cutoff/puck drop.
- 2026-06-15 live guardrail evidence: health check shows no active production model and 0/1 trusted pre-cutoff market-odds source games for the current serving window. A bounded dry-run accuracy loop still suppresses `homeMarketNoVigProbability` and rejects candidate promotion, so 6.1 and 7.1-7.5 remain intentionally open.
- Historical odds backfill prep now supports `npm run import:historical-market-odds -- --print-expected-games ...` to emit the exact expected game IDs and required import-file columns before any write is possible.
- The accuracy-loop CLI now includes `nextActions.marketOddsBackfill` whenever market odds are not training-eligible, including the matching `--print-expected-games` command and strict provenance guardrail for the evaluated window.

## Tasks

- [x] 1.0 Persist market odds as a first-class prediction source
  - [x] 1.1 Design a minimal odds snapshot contract keyed by game, provider, captured time, home/away team, moneyline, spread, total, and source URL/provenance.
  - [x] 1.2 Add an ingestion path that stores ESPN odds snapshots before games start instead of only fetching odds at page-render time.
  - [x] 1.3 Add source freshness metadata and stale/fallback warnings for odds availability.
  - [x] 1.4 Add a no-vig market probability helper for home/away moneyline.
  - [x] 1.5 Add a market baseline comparison to accountability: market pick, no-vig Brier/log loss where available, and model-vs-market deltas.
  - [x] 1.6 Keep live odds out of historical training until pregame-safe historical odds snapshots exist.

- [x] 2.0 Add highest-leverage multi-window team features
  - [x] 2.1 Extend `TeamRecentFormFeatures` with 20-game, 40-game, and season-to-date windows from NST gamelog rows.
  - [x] 2.2 Add xGF%, shot/Fenwick share, GF%, xGA/60, goals for/against per game, and point percentage for those windows where source data supports them.
  - [x] 2.3 Add early-season cross-season prior features using prior-season rows only when current-season sample size is thin.
  - [x] 2.4 Add strict no-cross current-season variants so ablations can compare cross-season prior value.
  - [x] 2.5 Add close-score and 5v5-close xG/share features only if existing stored data supports leak-free reconstruction.
  - [x] 2.6 Add deterministic tests for rolling-window ordering, source-as-of filtering, cross/no-cross fallback, and empty-window behavior.

- [x] 3.0 Add season-phase modeling context
  - [x] 3.1 Compute each team’s games played as of prediction cutoff and emit a matchup phase: early, middle, late, playoff when applicable.
  - [x] 3.2 Add season phase as metadata, a feature candidate, and an evaluation segment.
  - [x] 3.3 Add ablations that train/evaluate early, middle, and late segments separately before considering separate production models.
  - [x] 3.4 Compare phase-specific performance to the current single-model baseline.
  - [x] 3.5 Keep separate phase models as candidates only if they improve probability metrics without calibration damage.

- [x] 4.0 Add candidate model and feature-selection tracks
  - [x] 4.1 Extend feature-signal analysis to rank features using mutual-information-style scoring alongside existing correlation/logistic signals.
  - [x] 4.2 Add leakage checks for every candidate feature: latest-only views, same-day rows, post-start observations, and current odds.
  - [x] 4.3 Add a candidate model interface that can evaluate non-logistic variants without changing production serving contracts.
  - [x] 4.4 Add an ExtraTrees-inspired candidate model track as `nhl_game_extratrees_candidate_v1` or equivalent if the runtime/tooling supports it cleanly.
  - [x] 4.5 Compare logistic, logistic-plus-new-features, market-anchored logistic, and tree/ensemble candidates through walk-forward backtests.
  - [x] 4.6 Preserve top-factor or explanation metadata for any promoted model; do not promote a black-box output without public explanation support.

- [x] 5.0 Add market-aware and uncertainty-aware features safely
  - [x] 5.1 Add `homeMarketNoVigProbability`, `awayMarketNoVigProbability`, and model-market delta only from historical odds snapshots captured before cutoff.
  - [x] 5.2 Add goalie projected-start uncertainty as a numeric feature, not only metadata.
  - [x] 5.3 Add goalie confirmation-state segments to evaluate confirmed vs projected starter performance.
  - [x] 5.4 Add odds-availability and goalie-uncertainty penalties to data-quality metadata where appropriate.
  - [x] 5.5 Use market probability first as a baseline and calibration reference before allowing it into candidate model training.

- [ ] 6.0 Run the accuracy improvement loop
  - [ ] 6.1 Ingest or backfill each new source into dated, provenance-aware storage.
  - [x] 6.2 Add the feature to immutable feature snapshots with strict as-of rules.
  - [x] 6.3 Backfill historical feature snapshots for an agreed evaluation window.
  - [x] 6.4 Run feature-signal analysis and leakage checks.
  - [x] 6.5 Run dry-run ablations against current production, goal-differential baseline, standings baseline, and market baseline.
  - [x] 6.6 Evaluate log loss, Brier score, calibration, accuracy, rolling accuracy, and segment stability.
  - [x] 6.7 Promote only if the candidate beats the current model on probability quality without worse calibration or unexplained segment regressions.
  - [x] 6.8 Surface new public-page factors only after the promoted model actually consumes those features.

- [ ] 7.0 Promote and monitor the improved model
  - [ ] 7.1 Bump `GAME_PREDICTION_FEATURE_SET_VERSION` only after tests and backtest evidence are committed.
  - [ ] 7.2 Bump model version only for the selected candidate after promotion criteria are met.
  - [ ] 7.3 Persist promotion evidence in model-version metadata: date range, evaluated games, metrics, baselines, and excluded features.
  - [ ] 7.4 Regenerate public predictions and accountability dashboards for the promoted version.
  - [ ] 7.5 Verify `/nhl-predictions` renders market comparison, model factors, and performance panels without layout regressions.
  - [x] 7.6 Monitor post-promotion performance by season phase, goalie confirmation state, stale-source state, and market-edge bucket.
