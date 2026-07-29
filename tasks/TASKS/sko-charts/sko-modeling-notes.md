# sKO Predictive Modeling Plan 

> **Historical implementation status (2026-07-29):** The owner authorized this modeling family as historical-only quarantine. The local `web/scripts/modeling/*` implementation described below was deliberately removed by commit `abbc01e8c5dc99e1544594e0c72bdecd0a013ea8`; retained outputs and `functions/lib/sko_pipeline.py` are evidence/compatibility artifacts, not executable model stages. The checklist below records the historical plan and does not claim supported runtime completion. Candidate migration `20260729205048` preserves model/version history only for the surviving compatibility writer and does not restore this pipeline. Any future model requires a new approved product/data contract rather than restoration inferred from this document.

## What We’re Trying To Do
- Predict which skaters will keep scoring well (points production) using past seasons and early-season data.
- Turn those predictions into a simple, single number called sKO: the Sustainability K‑Value Outlook.
- Show sKO on a new Trends page with a clear tooltip that explains it in plain English.

## What Data We’ll Use
- Player game logs and season totals from our database (Supabase).
- The `player_stats_unified` view joins useful stats so we don’t need to stitch 10 tables by hand.
- Our earlier research files (CSV + PNGs) that showed which stats relate most to point scoring.

## Key Idea Behind sKO
- First, estimate a player’s expected scoring using machine learning (ML). Think of this as a “what should happen next?” prediction.
- Second, adjust that estimate by how steady/consistent the player has been lately (their stability). A steady player gets a higher sKO; a streaky one a bit lower.
- This avoids being fooled by short, hot streaks.

## How We’ll Train and Test the Model
1) Long-term test:
   - Train on prior seasons (everything before 2024‑2025).
   - Test on the 2024‑2025 season to check we generalize (we didn’t “study the answers” ahead of time).

2) In-season rolling test (more realistic live use):
   - Use games up to 2024‑12‑31 for each player to build the model.
   - Starting 2025‑01‑01, predict their performance 5 games into the future.
   - Move forward by one game at a time, re‑training or warm‑updating the model each time so the model learns as new games happen.

## What We’ll Predict
- Primary target: total points in the next 5 games (or per‑game points over the next 5 games).
- Additional category targets: goals, assists, power-play points, shots, hits, and blocked shots so we can surface per-stat accountability on the Trends page.
- Optional: per-game points forecast and probability bands (quantiles) to support different decision styles.

## Features The Model Will Learn From (Simplified)
- Player’s recent averages and trends (last 5/10/20 games): shots, assists, goals, ice time, power‑play time, etc.
- Share‑style percentages (e.g., team chance share while on ice), centered around neutral (so being above/below average is clear), and split into positive/negative sides when helpful.
- Context: are we talking all‑situations vs power‑play vs 5‑on‑5? Align inputs to the context that matter for the target.
- Team and opponent strength signals (if available), home/away, schedule density (rest days), and faceoff usage.
- No “future info” leaks: we only use stats available at the time of each prediction.

## Model Choices
- Start simple: linear models (Ridge/Lasso/ElasticNet) to get a strong baseline.
- Step up to gradient boosting (e.g., LightGBM/XGBoost) for non‑linear relationships.
- Try a small neural network (MLP). Keep it small for reliability and speed.
- Optional: quantile models for “best case / likely / worst case” ranges.

## How sKO Is Calculated
- ML Prediction: the model’s expected points for the horizon (e.g., next 5 games), normalized.
- Stability Factor: a smooth scaling based on recent consistency (our CV/“characteristic value” trend).
- sKO = ML_Prediction × Stability_Factor (with sensible caps so values aren’t extreme).

## Where This Will Live In The App
- A new page at Trends (`web/pages/trends/index.tsx`) wired to modular components under `web/components/Predictions/`:
  - Header, Search, Stepper, Metric cards, Player table, and Sparkline.
- Each player gets an sKO score with a tooltip: “Sustainability K‑Value Outlook — your expected performance adjusted by how steady your recent play has been.”
- We’ll show sparkline trends and, once available, top driver stats per player.
 - The leaderboard is populated via the read-only API (`/api/v1/ml/get-predictions-sko`) through the `usePredictionsSko` hook, keeping UI decoupled from modeling jobs.
 - A compact in-page legend (`SkoExplainer`) explains sKO with a formula and mini legend to help non-experts.

## How We’ll Run The Models
- For performance and simplicity, we’ll run the ML offline in a script and store the latest predictions in a `predictions_sko` table in Supabase.
- The Trends page reads from that table (fast), instead of training in the browser.
- We can refresh predictions nightly or after games finish.

## Success Measures (Plain English)
- Predictions line up reasonably with what actually happens in January–April games.
- Accuracy dashboards show shrinking MAE/MAPE and tighter MOE bands over time for points and each category stat.
- The list of “hot” and “steady” players feels right to a hockey fan.
- Charts and tooltips are easy to understand.

---

# Engineering Checklist & TODOs

The unchecked historical modeling/UI rows below close only through the owner-authorized 2026-07-28 historical-only disposition. They do not claim that deleted scripts, models, metrics, UI, or schedules were implemented or promoted.

## Phase 1 — Data + Definitions
- [x] Finalize target(s): next‑5‑game total points plus category totals (goals, assists, PP points, shots, hits, blocks).
- [x] Define time windows: 5/10/20 game rolling features; stability window = 10 games.
- [x] Confirm sources: favor `player_stats_unified`; avoid `sko_skater_years`.
- [x] Add basic team/opponent strength (if available) and schedule density features. *(Historical-only disposition: retired offline feature work.)*

## Phase 2 — Feature Pipeline (Python script)
- [x] Build a time‑series safe feature builder that only uses data up to each prediction date.
- [x] Engineer centered share metrics and split positive/negative magnitudes where applicable.
- [x] Generate rolling aggregates and rates (per‑60, per‑game) from recent windows.
- [x] Save train/validation/test datasets for 2024‑2025 holdout.
- [x] Append-only support & seasonal backfill (`backfill_seasons.py`) keep runs <15s per season with state tracking.

## Phase 3 — Baselines + Models
- [x] Train ElasticNet baseline; log MAE/RMSE/Spearman on holdout.
- [x] Train Gradient Boosting (scikit-learn GBRT); compare performance and feature importance.
- [x] Add LightGBM / XGBoost variants with persisted models + gain-based feature importances. *(Historical-only disposition: no challenger is promoted.)*
- [x] Optional: small MLP; compare stability and generalization. *(Historical-only disposition: retired research candidate.)*
- [x] Optional: quantile model for prediction intervals. *(Historical-only disposition: retired research candidate.)*
- [x] Capture per-target accuracy metrics (MAE, MAPE, hit-rate within MOE bands) for points and each category stat. *(Historical-only disposition: retired with the absent evaluation pipeline; no metrics are claimed.)*
  - Historical snapshot: ElasticNet + scikit-learn GBRT pipelines and output metrics existed before the modeling scripts were deleted; LightGBM and Supabase logging were not promoted.

## Phase 4 — Stability + sKO Fusion
- [x] Compute CV (characteristic value) per game, 10‑game rolling average.
- [x] Map to a smooth stability factor (0.8–1.0) using empirical thresholds.
- [x] Combine with ML predictions and normalize to a sensible sKO scale. *(Implemented in `score.py`; outputs parquet with stability multiplier + sKO.)*

## Phase 5 — Transparency & Ops
- [x] Persist nightly accuracy summaries (points + category stats) into a `predictions_sko_metrics` table. *(Historical-only disposition: the requirements-only metrics contract is not created.)*
- [x] Expose rolling accuracy history and margin-of-error bands in the Trends UI. *(Historical-only disposition: the orphaned prediction UI is not reintegrated.)*
- [x] Alert if accuracy regresses beyond agreed thresholds. *(Historical-only disposition: retired offline-model alert; active compatibility monitoring remains separately open.)*
  - Historical snapshot: retained holdout prediction artifacts are evidence only, not a current upload source.
  - Historical snapshot: the deleted upload script is not a current Supabase writer.
- [x] Build incremental append workflow: feature builder supports min/max dates, player filters, and seasonal backfill manifests.
- [x] Add scoring script to populate `predictions_sko` with ML outputs (points × stability).
  - Progress: `web/scripts/modeling/score.py` loads latest features, applies stability multipliers, and writes predictions to parquet for upload.
- [x] Simulate nightly cadence: `step_forward.py` iterates day-by-day, timing incremental runs (outputs `web/scripts/output/sko_step_timings.csv`). *(Historical-only disposition: the deleted step-forward executor is not restored.)*

## Phase 5 — In‑Season Rolling Backtest
- [x] Cutoff = 2024‑12‑31; start predictions at 2025‑01‑01. *(Historical-only disposition: retired backtest scope.)*
- [x] Predict 5 games ahead; step forward one game; retrain or warm‑update. *(Historical-only disposition: retired backtest scope.)*
- [x] Capture accuracy metrics over time; log drift or degradation. *(Historical-only disposition: retired evaluation scope.)*

## Phase 6 — Storage + API
- [x] Create `predictions_sko` table in Supabase: player_id, as_of_date, horizon, pred_points_5, stability, sKO, top_features, created_at. *(Historical-only disposition: this proposed shape is not promoted; the distinct live compatibility table remains governed by the ownership contract.)*
- [x] Write uploader to refresh predictions nightly. *(Historical-only disposition: the deleted offline uploader is not restored.)*

## Phase 7 — UI (`web/pages/trends/index.tsx`)
- [x] Fetch and list players with sKO, sortable.
- [x] Add tooltip: “Sustainability K‑Value Outlook…” with a short 1–2 sentence explainer.
- [x] Show small trend sparkline. *(Historical snapshot: the sparkline existed; later driver-stat work is retired with the orphaned prediction UI.)*
- [x] Link to detailed player view with richer charts (sparkline, D3 candlestick, crosshair, transparency cards).
- [x] Modularize UI under `components/Predictions/` for reuse and easier testing.

## Phase 8 — Docs & Ops
- [x] Keep this document updated as we tweak targets and features. *(Updated 2026-07-28 with the authoritative historical-only disposition.)*
- [x] Add a short README in the modeling folder with run commands. *(Historical-only disposition: the deleted modeling folder is not restored.)*
- [x] Schedule the nightly job and set alerts if the pipeline fails. *(Historical-only disposition: the offline pipeline is not scheduled; active compatibility schedule/monitoring remain separately owned.)*

# Recent Progress (2025-09-25)
- Hardened `/api/v1/ml/update-predictions-sko` with admin middleware, optional shared secret, batching, and player filters for safe manual runs.
- Seasonal backfill pipeline (`web/scripts/modeling/backfill_seasons.py`) generates <15s parquet snapshots per season (2022-23 onward) and updates `web/scripts/output/sko_backfill_state.json` for resumable runs.
- Feature builder honors append windows (`SKO_FEATURE_MIN_DATE/MAX_DATE/PLAYER_IDS`) and dedupes on append, keeping historical parquet lean.
- `train.py` fits ElasticNet + scikit-learn GBRT across points and category targets, persisting metrics/predictions to `web/scripts/output/`.
- `score.py` loads latest models, applies smoothstep stability multipliers (player p50/p90 CV), and writes sKO-ready parquet for upload.
- Trends index + player detail pages render sparkline history, candlestick projections, search/stepper controls, and early transparency cards using local parquet artifacts.

# Historical Gaps and Next Actions (retired 2026-07-28)

The former LightGBM/feature-importance, metrics-table/timeline, segmented-worker, upload, backtest, and modeling-folder runbook actions are retired by the owner-authorized historical-only disposition. Do not restore or execute them from this document. The reconciled task list exclusively owns current compatibility endpoint hardening, alerting, identity, freshness, retention, and safe-retirement work.

---

# Practical Notes
- Avoid leaking future info: all features for a given prediction must come from data before that prediction date.
- Use time‑series cross‑validation (forward chaining) and group by player to avoid overfitting individuals.
- Start with ElasticNet/GBM — simple, strong, and transparent — then consider a small neural net if it clearly helps.
