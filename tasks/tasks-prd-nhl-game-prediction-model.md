## Relevant Files

- `tasks/TASKS/prd-nhl-game-prediction-model.md` - Source PRD for scope, schema direction, phases, and acceptance criteria.
- `tasks/TASKS/nhl-game-prediction-model-research.md` - Research basis for feature families, validation approach, calibration, and operational guardrails.
- `web/rules/context/supabase-table-structure.md` - Existing Supabase table reference for core identity, WGO, NST, standings, games, and player tables.
- `web/rules/context/supabase-views.md` - Existing view reference, including unified player/goalie views and latest-only view caveats.
- `web/rules/context/power-ratings-tables.md` - Existing `team_power_ratings_daily` definition and rating math to audit before model use.
- `web/rules/context/forge-tables.md` - Existing FORGE runs, projections, game-strength, and roster-event schema reference.
- `web/rules/context/goalie-tables.md` - Existing goalie stats and `goalie_start_projections` schema reference.
- `web/rules/context/nst-team-tables-schemas.md` - NST team source table contracts for xG, shot, chance, and special-teams features.
- `web/rules/context/nst-goalie-table-schemas.md` - NST goalie source table contracts for goalie-quality features.
- `web/rules/context/player-table-schemas.md` - Player/skater source table contracts for optional lineup/player context.
- `web/lib/supabase/database-generated.types.ts` - Generated Supabase types to confirm deployed table and column contracts during implementation.
- `web/sql/ratings/002_create_analytics_trends_predictions_and_provenance.sql` - Existing `game_prediction_outputs`, `player_prediction_outputs`, and `source_provenance_snapshots` contract to reuse or extend.
- `web/sql/ratings/003_create_historical_line_source_tables.sql` - Existing lineup source table contract for NHL.com, DailyFaceoff, and GameDayTweets.
- `web/sql/ratings/007_create_lines_ccc.sql` - Existing CCC lineup source table contract.
- `web/sql/ratings/010_create_game_prediction_model_contracts.sql` - New migration defining append-only game prediction history, immutable feature snapshots, model-version metadata, and segmented model metrics.
- `web/lib/xg/binaryLogistic.ts` - Existing regularized logistic model utilities that may support a baseline model.
- `web/lib/xg/calibration.ts` - Existing calibration and probability metric utilities to reuse for game prediction evaluation.
- `web/scripts/train-nhl-xg-baseline.ts` - Existing model-training script patterns for dataset artifacts, validation, and calibration.
- `web/scripts/train-nhl-xg-baseline.test.ts` - Existing tests for modeling/calibration patterns that can guide new game-model tests.
- `web/scripts/audit-nhl-game-prediction-sources.ts` - Read-only audit script for planned Supabase source inventory and data coverage checks.
- `web/pages/api/v1/db/update-games.ts` - Existing NHL games ingestion/update endpoint to reuse or extend for schedule/result readiness.
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - Existing owner of `goalie_start_projections`.
- `web/pages/api/v1/db/update-team-power-ratings.ts` - Existing team power rating refresh route.
- `web/pages/api/v1/db/update-lineup-source-provenance.ts` - Existing source provenance and lineup source ingestion route.
- `web/pages/api/v1/db/cron-report.ts` - Existing cron/job reporting route to reuse or compare before adding prediction-specific job logging.
- `web/pages/api/v1/runs/latest.ts` - Existing FORGE run metadata route that may inform model run/status handling.
- `tasks/artifacts/nhl-game-prediction-supabase-source-audit.md` - Durable audit output for planned Supabase source availability, row coverage, date coverage, and planned-column presence.

### Notes

- Validate the live Supabase schema and data before relying on any planned table in model code.
- Unit tests should be placed alongside the code they test and should follow existing Vitest/Next API route conventions.
- Do not add prediction/model tables until the audit confirms existing contracts cannot safely support the requirement.

## Tasks

- [x] 1.0 Vet all planned Supabase source tables and views before implementation
  - [x] 1.1 Build a data-source inventory for every planned table/view: `games`, `teams`, `players`, `seasons`, `team_power_ratings_daily`, NST team tables including `nst_team_gamelogs_as_counts`, `nst_team_gamelogs_as_rates`, `nst_team_gamelogs_pp_counts`, `nst_team_gamelogs_pp_rates`, `nst_team_gamelogs_pk_counts`, and `nst_team_gamelogs_pk_rates`, `wgo_team_stats`, `nhl_standings_details`, `goalie_start_projections`, WGO goalie tables, `vw_goalie_stats_unified`, NST goalie tables including all/5v5/EV/PP/PK count and rate tables, `lineCombinations`, `lines_nhl`, `lines_dfo`, `lines_gdl`, `lines_ccc`, `forge_roster_events`, FORGE projection tables, `game_prediction_outputs`, `player_prediction_outputs`, `forge_runs`, and `source_provenance_snapshots`.
  - [x] 1.2 Confirm each planned table exists in the deployed Supabase schema with the expected primary keys, foreign keys, indexes, nullable fields, generated types, and date/time columns.
  - [x] 1.3 Validate identity joins across `games`, `teams`, `players`, team abbreviations, goalie IDs, player IDs, FORGE tables, NST tables, and WGO tables; document any many-to-one, stale-team, duplicate, or abbreviation-mapping problems.
  - [x] 1.4 Audit `team_power_ratings_daily` math for logical soundness: source joins, EWMA windows, z-scores, offense/defense sign direction, pace handling, special-teams fields, shrinkage behavior, and date alignment.
  - [x] 1.5 Audit NST team tables for expected hockey semantics: xGF/xGA, CF/CA, FF/FA, SF/SA, GF/GA, scoring chances, high-danger chances, per-60 rates, percentages, situations, and whether rows are game-level, cumulative, or snapshot-level.
  - [x] 1.6 Audit WGO team and standings tables for expected semantics: cumulative season values, home/road splits, l10 fields, power-play/penalty-kill definitions, penalties, shots, goals, and whether rows can be joined safely as of a prediction timestamp.
  - [x] 1.7 Audit goalie sources for expected semantics: `goalie_start_projections.start_probability`, `confirmed_status`, `projected_gsaa_per_60`, WGO goalie rest splits, NST goalie GSAA/xGA/high-danger fields, and whether starter probabilities sum sensibly by game/team.
  - [x] 1.8 Audit lineup/player context tables for current and historical coverage: `lineCombinations`, `lines_nhl`, `lines_dfo`, `lines_gdl`, `lines_ccc`, `forge_roster_events`, and FORGE projections; decide which are safe for training, which are current-only explanation inputs, and which must remain optional.
  - [x] 1.9 Audit `game_prediction_outputs`, `player_prediction_outputs`, `forge_runs`, and `source_provenance_snapshots` for storage fit, including whether each table preserves the required prediction history, provenance, freshness, and model metadata without overwriting useful evidence.
  - [x] 1.10 Run row-level data-quality checks for representative seasons and recent slates: row counts, missing required fields, duplicate keys, impossible probabilities, negative impossible rates, extreme outliers, date gaps, stale rows, and mismatched home/away teams.
  - [x] 1.11 Run as-of/leakage checks for every candidate feature source to prove historical training rows can be built using only data available before the prediction timestamp; explicitly reject latest-only views such as `nhl_team_data` for training.
  - [x] 1.12 Produce a source-to-feature data dictionary with required/optional flags, fallback behavior, freshness rules, as-of-safe join keys, and a go/no-go decision for each table before model work starts.

- [ ] 2.0 Finalize storage contracts for prediction history, feature snapshots, metrics, and jobs
  - [x] 2.1 Decide whether to extend `game_prediction_outputs` or create an append-only `game_prediction_history` table for multiple same-day pregame predictions.
  - [x] 2.2 Define immutable feature snapshot storage with game ID, prediction timestamp, model/version keys, source cutoff timestamps, feature payload, and source table provenance.
  - [x] 2.3 Define game-prediction metric storage by model name, model version, feature-set version, date range, segment, and metric values.
  - [x] 2.4 Define model version metadata storage, reusing `forge_runs` where practical and adding game-model-specific metadata only where needed.
  - [x] 2.5 Define prediction job logging requirements and reuse existing cron reporting if adequate; otherwise add a minimal prediction-job log table.
  - [ ] 2.6 Write Supabase migrations only for confirmed gaps and update generated Supabase types after migrations are applied.

- [ ] 3.0 Build the as-of-safe feature generation layer
  - [ ] 3.1 Implement a feature-source registry based on the vetted data dictionary, with each feature tagged by source table, timestamp cutoff, required/optional status, and fallback.
  - [ ] 3.2 Build schedule/context features from `games`, including home ice, rest days, back-to-backs, games-in-window, season, game type, and home/away team IDs.
  - [ ] 3.3 Build team-strength features from vetted `team_power_ratings_daily`, NST team sources, WGO team stats, and standings rows using only as-of-safe dated joins.
  - [ ] 3.4 Build goalie features by blending starter candidates from `goalie_start_projections` and goalie-quality rows from vetted WGO/NST goalie sources.
  - [ ] 3.5 Build optional lineup/player features from vetted lineup/FORGE/player sources, with coverage gates so missing player data never blocks game-level predictions.
  - [ ] 3.6 Build home-minus-away and matchup features for offense vs defense, goalie advantage, special teams, rest, and prior/team strength.
  - [ ] 3.7 Persist feature snapshots with enough payload and provenance to reproduce the exact model input for any stored prediction.
  - [ ] 3.8 Add tests for feature date cutoffs, fallback behavior, missing optional sources, goalie probability blending, and leakage prevention.

- [ ] 4.0 Implement the baseline pregame prediction model
  - [ ] 4.1 Create a baseline training dataset builder from stored feature snapshots and final game outcomes.
  - [ ] 4.2 Implement a regularized logistic baseline using home ice, rest, team rating differentials, goalie weighted quality, and selected team-form features.
  - [ ] 4.3 Add probability calibration using existing calibration utilities where possible.
  - [ ] 4.4 Generate home/away win probabilities, predicted winner, confidence label, top factor metadata, data freshness status, and model metadata.
  - [ ] 4.5 Persist latest public predictions to `game_prediction_outputs` and immutable prediction records to the chosen history contract.
  - [ ] 4.6 Add tests for probability bounds, home/away probability consistency, confidence labels, factor metadata, and persistence behavior.

- [ ] 5.0 Implement outcome capture, scoring, and model evaluation
  - [ ] 5.1 Confirm final game outcomes can be sourced from existing game/result ingestion or add the minimum result/evaluation linkage needed.
  - [ ] 5.2 Attach completed outcomes to pregame prediction history without mutating the original prediction payload.
  - [ ] 5.3 Calculate log loss, Brier score, calibration bins, accuracy, AUC where practical, and prediction coverage.
  - [ ] 5.4 Calculate segment metrics for early/late season, home/away favorites, confidence buckets, confirmed vs projected goalie, stale vs fresh data, and regular season vs playoffs.
  - [ ] 5.5 Store model metrics by model/version/date range and expose enough data for admin and public performance summaries.
  - [ ] 5.6 Add tests for scoring math, calibration bins, segment filters, and completed-game matching.

- [ ] 6.0 Add scheduled prediction, retraining, and promotion workflow
  - [ ] 6.1 Define prediction refresh timing for upcoming games and whether multiple same-day refreshes are enabled in v1.
  - [ ] 6.2 Add a prediction-generation route or job that builds fresh features, runs the production model, stores predictions, and records job status.
  - [ ] 6.3 Add a postgame scoring route or job that updates outcomes and model metrics after games complete.
  - [ ] 6.4 Add a candidate retraining workflow using time-aware validation and no random train/test splits.
  - [ ] 6.5 Add model promotion checks for log loss, Brier score, calibration, coverage, stability, and leakage audit status.
  - [ ] 6.6 Add monitoring for stale source tables, missing predictions, failed jobs, stale model age, missing-feature rate, and recent metric degradation.

- [ ] 7.0 Build the public NHL prediction analytics surface
  - [ ] 7.1 Create a stable backend API that returns latest eligible pregame predictions, matchup context, factor metadata, model version, and freshness status.
  - [ ] 7.2 Build the main NHL prediction page with upcoming game cards, home/away probabilities, predicted winner, confidence labels, and last-updated timestamps.
  - [ ] 7.3 Build the matchup detail view with team offense/defense comparison, goalie comparison, special teams, rest/schedule context, and optional player impact.
  - [ ] 7.4 Build the model performance section with accuracy, log loss, Brier score, calibration summary, evaluated game count, and date range.
  - [ ] 7.5 Ensure all displayed factor explanations come from stored model metadata or feature snapshots, not frontend-invented text.
  - [ ] 7.6 Keep the UI non-betting-oriented and avoid wagering language, certainty claims, and sportsbook-style recommendations.
  - [ ] 7.7 Add component/API tests for loading states, missing prediction states, stale-data warnings, probability display, and no-betting copy.

- [ ] 8.0 Add admin/debug visibility for data and model health
  - [ ] 8.1 Add an admin or developer-facing view/report for current production model, recent metrics, prediction coverage, data freshness issues, and failed jobs.
  - [ ] 8.2 Expose the table-vetting results and data-source go/no-go statuses in a durable report or dashboard section.
  - [ ] 8.3 Add drill-down support for a prediction's feature snapshot, source provenance, fallback flags, goalie confirmation state, and model version.
  - [ ] 8.4 Add alerts or report flags for schema drift, stale source rows, impossible metric values, starter probability anomalies, and unexplained prediction gaps.

- [ ] 9.0 Verify end-to-end behavior before launch
  - [ ] 9.1 Run the table-vetting checks against current Supabase data and resolve all blocker findings before training or publishing predictions.
  - [ ] 9.2 Backtest the baseline with walk-forward or season-held-out validation and document model quality against the baseline acceptance criteria.
  - [ ] 9.3 Run a dry-run slate prediction that stores feature snapshots, prediction history, latest serving rows, provenance, and job logs.
  - [ ] 9.4 Verify postgame scoring updates metrics without overwriting historical predictions.
  - [ ] 9.5 Verify the public page and API handle missing optional goalie/player data, stale sources, no-game days, and incomplete prediction coverage.
  - [ ] 9.6 Run the relevant unit/API/UI tests and document any manual validation that remains.

- [ ] 10.0 NEW: Resolve source-audit warnings before enabling dependent model features
  - [ ] 10.1 Decide how game-prediction features should handle the 232 recent `vw_goalie_stats_unified` rows with null `team_id`.
  - [ ] 10.2 Decide whether `lines_ccc` rows with null `game_id` can be mapped to games or must remain current-only lineup context.
  - [ ] 10.3 Treat `players.team_id` as optional/stale for player-context features unless a later roster reconciliation proves current-team coverage is reliable.
  - [ ] 10.4 Define a source-freshness/provenance rule for `team_power_ratings_daily` rows whose rating date is newer than the upstream NST gamelog source dates, so derived or forward-filled ratings are not misread as newly observed NST data.
  - [ ] 10.5 Add freshness gates for NST team sources: gamelog tables currently top out at 2026-04-11 and snapshot tables at 2026-03-21, so model features must record stale/fallback state instead of treating them as current.
  - [ ] 10.6 Treat `nst_team_5v5`, `nst_team_all`, `nst_team_pp`, and `nst_team_pk` as cumulative/snapshot tables, not one-game logs; use gamelog tables for rolling game-window features.
  - [ ] 10.7 Avoid using stored PP/PK `xgf_pct` fields directly until their special-teams percentage semantics are confirmed; prefer recomputing required percentages from vetted numerator/denominator fields or using raw/rate fields.
  - [ ] 10.8 Handle NST count/rate pairing gaps before joining paired gamelog features: all-situation has 22 count rows without rate pairs and 32 rate rows without count pairs; PK has 20 rate rows without count pairs.
  - [ ] 10.9 Investigate the 32 non-one-game `gp` rows in NST gamelog rate/special-teams tables and exclude or classify them before building game-window features.
  - [ ] 10.10 Handle the 151 recent `wgo_team_stats` rows with null `game_id` and null `opponent_id` before using WGO opponent-aware team-game features.
  - [ ] 10.11 Treat extreme WGO per-game rows as outliers requiring review or robust clipping before model training: 46 rows with goals per game above 8 and 2 rows with shots per game above 60.
  - [ ] 10.12 Resolve or normalize `goalie_start_projections` warning rows before goalie blending: 9 extreme `projected_gsaa_per_60` rows and 27 game/team groups whose starter probabilities do not sum to roughly 1.
  - [ ] 10.13 Treat recent `wgo_goalie_stats` as goalie-game rows, but review or robustly clip the 58 extreme GAA rows before training goalie-quality features.
  - [ ] 10.14 Do not use `wgo_goalie_stats_totals` as a historical training feature unless a snapshot/as-of rule is added; keep it current-prior or fallback-only for v1.
  - [ ] 10.15 Add freshness gates for NST goalie sources, which currently top out at 2026-04-09, so stale NST goalie quality does not masquerade as current goalie form.
  - [ ] 10.16 Clip or filter low-TOI NST goalie rate outliers before model use, especially PK rates where 1,070 rows exceeded the initial plausibility threshold.
  - [ ] 10.17 Keep `lineCombinations` optional and add fallback handling for the 50 audited 2025-10-01+ game/team sides without line-combination rows.
  - [ ] 10.18 Treat `lines_nhl`, `lines_dfo`, `lines_gdl`, and `lines_ccc` as sparse/current lineup context only until broader historical backfill is proven; `lines_ccc` currently has 7 accepted observed rows with null `game_id`.
  - [ ] 10.19 Gate FORGE player/goalie/team projections by freshness before use as optional context; audited projection tables currently top out at 2026-04-16.
  - [ ] 10.20 Treat `forge_roster_events` as unavailable optional context for v1 unless ingestion is populated; the audited table is empty.
  - [ ] 10.21 Treat `game_prediction_outputs` and `player_prediction_outputs` as latest/serving tables until append-only prediction history is added; their current primary keys do not include `computed_at`, `prediction_id`, `feature_snapshot_id`, or `run_id`.
  - [ ] 10.22 Add immutable feature snapshot storage or embed immutable feature payloads/source cutoffs in append-only prediction history before using stored predictions for evaluation.
  - [ ] 10.23 Reuse `forge_runs` only for shared run metadata unless game-model metrics are written with explicit model name, model version, feature-set version, date range, and segment keys; audited latest `as_of_date` is 2026-04-16.
  - [ ] 10.24 Expand and freshness-gate `source_provenance_snapshots` before relying on it as the sole source-freshness authority; audited rows include null and expired `freshness_expires_at` values.
  - [ ] 10.25 Regenerate or repair Supabase generated types after storage migrations because the local generated types do not currently expose `game_prediction_outputs`, `player_prediction_outputs`, or `source_provenance_snapshots`.
  - [ ] 10.26 Handle team-feature as-of gaps: 56 audited game/team sides lack team-power or standings context inside the 14-day lookback, 88 sides lack strict pregame team-power/WGO rows before game date, and 32 sides have same-day-only team-power rows.
  - [ ] 10.27 Keep `nhl_team_data` excluded from historical training because it is a latest-only display view even though it exists in the live database.
  - [ ] 10.28 Do not use historical `goalie_start_projections` rows for backtests unless a pregame-safe snapshot/backfill is created; 5,270 audited rows were created and updated after scheduled puck drop.
  - [ ] 10.29 Treat line-source tables and `lineCombinations` as current/explanation-only unless pregame provenance is added; `lineCombinations` has no `observed_at`, while audited `lines_nhl` and `lines_gdl` include post-start observations.
  - [ ] 10.30 Treat FORGE projection tables as optional/current context for backtests unless timestamp-level provenance is added; most audited rows have `as_of_date` on or after the linked game date.
