## Relevant Files

- `tasks/goalie-forge.md` - Source PRD for goalie modeling requirements, standards, and release phases.
- `web/lib/projections/runProjectionV2.ts` - Main FORGE projection orchestrator where goalie starter and projection logic runs.
- `web/lib/projections/runProjectionV2.test.ts` - Unit tests for starter candidate filtering and probability edge-cases (B2B, stale goalies, legacy team leakage).
- `web/lib/projections/goalieModel.ts` - Goalie-specific modeling logic for priors, volatility, risk, and recommendations.
- `web/lib/projections/goalieModel.test.ts` - Unit tests for goalie model behavior and regression/volatility rules.
- `web/lib/projections/uncertainty.ts` - Quantile simulation helpers for goalie uncertainty output.
- `web/lib/projections/derived/buildGoalieGameV2.ts` - Builder for `forge_goalie_game` derived inputs used by goalie modeling.
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - Ingestion job for PbP + shifts inputs required before derived and projection runs.
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - Derived table build job for player/team/goalie game-strength inputs.
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - Goalie start prior generator (`goalie_start_projections`).
- `web/pages/api/v1/db/run-projection-v2.ts` - Endpoint to execute FORGE projection runs by date/range.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Accuracy scoring pipeline and calibration metrics persistence.
- `web/pages/api/v1/forge/goalies.ts` - Goalie FORGE read endpoint and diagnostics output.
- `web/pages/api/v1/forge/accuracy.ts` - Accuracy-series endpoint used by FORGE UI.
- `web/pages/FORGE.tsx` - FORGE UI surface for skater/goalie projections and uncertainty display.
- `web/styles/Forge.module.scss` - Styling for goalie cards, labels, and mode-specific UI controls.

### Notes

- Unit tests should be added next to code files they validate (e.g., `goalieModel.ts` and `goalieModel.test.ts`).
- Use `cd web && npm test -- <file>` for targeted tests and `cd web && npm exec tsc -- -p tsconfig.json --noEmit` for type safety checks.
- For long manual backfills, use `bypassMaxDuration=true` on ingestion/derived endpoints.

## Tasks

- [x] 1.0 Harden goalie starter probability modeling and candidate hygiene
  - [x] 1.1 Add strict candidate filtering to current-team active goalies (`players.team_id` + `position='G'`) with explicit override exceptions.
  - [x] 1.2 Add recency controls (`last_played_date`) with soft penalty after 30 days and near-elimination/hard exclusion for stale goalies.
  - [x] 1.3 Cap and rank candidate sets (target: max 2-3) using last-10 starts, recency, and confirmed/likely starter events.
  - [x] 1.4 Add back-to-back starter suppression logic with stronger penalties for game-1 starter in game-2 of B2B.
  - [x] 1.5 Add team-strength matchup heuristic (weaker team on B2B more likely backup, weak-opponent rest spot for starter).
  - [x] 1.6 Persist starter-selection diagnostics in uncertainty metadata (`source`, candidate list, l10_starts, recency fields).
  - [x] 1.7 Add unit tests for starter probability edge cases (B2B, stale goalies, legacy team goalie contamination).
- [x] 2.0 Upgrade goalie projection quality (SA, SV%, GA) with context-aware features and calibration
  - [x] 2.1 Add team defensive environment features (rolling SA/CA proxies, xGA proxies if available) into goalie SA estimation.
  - [x] 2.2 Add opponent offense/context features (rolling GF/shot generation, home/away split, rest) to GA/SV% modeling inputs.
  - [x] 2.3 Add workload/fatigue features (starts in last 7/14 days, B2B flags, travel proxy if available).
  - [x] 2.4 Rework save% prior blending to weight multi-season baseline + current-season signal + recency with sample-size-dependent shrinkage.
  - [x] 2.5 Add guardrails for small samples (stronger regression and confidence downgrades for low-shot windows).
  - [x] 2.6 Validate uplift with holdout comparisons against current baseline (MAE/RMSE on saves/GA).
- [x] 3.0 Implement multi-scenario (top-2) goalie forecasting and distribution blending for next-5 outputs
  - [x] 3.1 Generate top-2 goalie starter scenarios per team/game with normalized probabilities.
  - [x] 3.2 Compute scenario-level goalie projections (SA, saves, GA, win/shutout) independently per candidate.
  - [x] 3.3 Blend scenario outputs into final projections using starter probabilities instead of hard top-1 only.
  - [x] 3.4 Extend uncertainty simulation to scenario mixtures so p10/p50/p90 reflect starter uncertainty.
  - [x] 3.5 Add horizon=5 support (or scaffold) with sequential schedule application and widening uncertainty bands.
  - [x] 3.6 Persist scenario metadata in `uncertainty.model` for explainability and debugging.
- [ ] 4.0 Strengthen goalie accuracy measurement, diagnostics, and calibration feedback loops
  - [ ] 4.1 Expand goalie stat-level diagnostics in accuracy pipeline (`saves`, `GA`, `win_prob`, `shutout_prob`) with daily and rolling aggregates.
  - [ ] 4.2 Add probability calibration outputs (Brier score + reliability bins) for starter, win, and shutout probabilities.
  - [ ] 4.3 Add interval coverage diagnostics for goalie uncertainty bands (`p10/p90` hit rates).
  - [ ] 4.4 Store calibration snapshots in run metadata and/or dedicated tables for trend monitoring.
  - [ ] 4.5 Add endpoint-level diagnostics payload to identify whether misses are driven by starter, SA, or SV% components.
  - [ ] 4.6 Define acceptance thresholds for launch gates (minimum calibration + error targets over last 30 days).
- [ ] 5.0 Improve data pipeline reliability and freshness guarantees for goalie FORGE dependencies
  - [ ] 5.1 Codify refresh order and dependency checks (games/teams/players → line combos → ingest → derived → goalie starts → projection run → accuracy run).
  - [ ] 5.2 Add preflight checks in run endpoint for required upstream freshness windows (with actionable errors).
  - [ ] 5.3 Add backfill-friendly range chunking and resumable behavior for ingestion/derived/projection jobs.
  - [ ] 5.4 Add stale-data detectors (e.g., missing recent goalie game rows, outdated players team assignments).
  - [ ] 5.5 Add cron/job observability for goalie-specific rows processed and data quality warnings.
  - [ ] 5.6 Document manual operator runbook with timeout bypass usage and validation checklist.
- [ ] 6.0 Expand API/UI transparency for goalie risk, confidence, and model explainability
  - [ ] 6.1 Extend `/api/v1/forge/goalies` response schema with explicit model version, scenario count, and calibration hints.
  - [ ] 6.2 Add API diagnostics for empty results (requested date/run vs fallback date/run, games scheduled, run metrics).
  - [ ] 6.3 Add UI display blocks for starter confidence drivers (recency, l10 starts, B2B, opponent strength).
  - [ ] 6.4 Add visual indicators for confidence tier and volatility/risk classes with tooltips for definitions.
  - [ ] 6.5 Add disclosure panel in FORGE goalie view for model limitations and data source caveats.
  - [ ] 6.6 Add regression tests/snapshots for API response shape and key UI rendering states.
- [ ] 7.0 Integrate additional Supabase goalie/team context signals discovered during schema audit
  - [ ] 7.1 Add goalie rest-split performance features from `wgo_goalie_stats` (`save_pct_days_rest_*`, `games_played_days_rest_*`) into save% adjustments.
  - [ ] 7.2 Add goalie quality-start stability features (`quality_starts`, `quality_starts_pct`) into volatility and confidence modeling.
  - [ ] 7.3 Add team strength priors from `nhl_team_data` (`xga`, `xga_per_game`, `xgf_per_game`) to shots-against and win context.
  - [ ] 7.4 Add team 5v5 environment features from `wgo_team_stats` (`save_pct_5v5`, `shooting_plus_save_pct_5v5`) to goalie context blending.
  - [ ] 7.5 Add NST team expected-goals context (`nst_team_stats` / `nst_team_all`: `xga`, `xga_per_60`) to opponent shot-danger adjustments.
  - [ ] 7.6 Add recency-weighted `lineCombinations.goalies` prior as a soft candidate boost (never hard-include stale/non-roster goalies).
