# sKO Predictive Modeling Plan 

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

## Phase 1 — Data + Definitions
- [x] Finalize target(s): next‑5‑game total points plus category totals (goals, assists, PP points, shots, hits, blocks).
- [x] Define time windows: 5/10/20 game rolling features; stability window = 10 games.
- [x] Confirm sources: favor `player_stats_unified`; avoid `sko_skater_years`.
- [ ] Add basic team/opponent strength (if available) and schedule density features. *(Schedule density + rest flags are in place; team/opponent strength still pending.)*

## Phase 2 — Feature Pipeline (Python script)
- [x] Build a time‑series safe feature builder that only uses data up to each prediction date.
- [x] Engineer centered share metrics and split positive/negative magnitudes where applicable.
- [x] Generate rolling aggregates and rates (per‑60, per‑game) from recent windows.
- [x] Save train/validation/test datasets for 2024‑2025 holdout.
- [x] Append-only support & seasonal backfill (`backfill_seasons.py`) keep runs <15s per season with state tracking.

## Phase 3 — Baselines + Models
- [x] Train ElasticNet baseline; log MAE/RMSE/Spearman on holdout.
- [x] Train Gradient Boosting (scikit-learn GBRT); compare performance and feature importance.
- [ ] Add LightGBM / XGBoost variants with persisted models + gain-based feature importances.
- [ ] Optional: small MLP; compare stability and generalization.
- [ ] Optional: quantile model for prediction intervals.
- [ ] Capture per-target accuracy metrics (MAE, MAPE, hit-rate within MOE bands) for points and each category stat.
  - Progress: ElasticNet + scikit-learn GBRT pipelines implemented in `web/scripts/modeling/train.py`, metrics saved to `web/scripts/output/sko_metrics.parquet`; LightGBM integration + Supabase logging remain.

## Phase 4 — Stability + sKO Fusion
- [x] Compute CV (characteristic value) per game, 10‑game rolling average.
- [x] Map to a smooth stability factor (0.8–1.0) using empirical thresholds.
- [x] Combine with ML predictions and normalize to a sensible sKO scale. *(Implemented in `score.py`; outputs parquet with stability multiplier + sKO.)*

## Phase 5 — Transparency & Ops
- [ ] Persist nightly accuracy summaries (points + category stats) into a `predictions_sko_metrics` table. *(Uploader scaffolding ready; needs nightly trigger + Supabase schema deployment.)*
- [ ] Expose rolling accuracy history and margin-of-error bands in the Trends UI. *(Metrics cards exist; timeline charts pending.)*
- [ ] Alert if accuracy regresses beyond agreed thresholds.
  - Progress: Training run emits holdout prediction snapshots for downstream upload (`web/scripts/output/sko_holdout_predictions.parquet`).
  - Progress: Upload script (`web/scripts/modeling/upload_predictions.py`) prepares Supabase upserts for metrics/predictions once tables are available.
- [x] Build incremental append workflow: feature builder supports min/max dates, player filters, and seasonal backfill manifests.
- [x] Add scoring script to populate `predictions_sko` with ML outputs (points × stability).
  - Progress: `web/scripts/modeling/score.py` loads latest features, applies stability multipliers, and writes predictions to parquet for upload.
- [ ] Simulate nightly cadence: `step_forward.py` iterates day-by-day, timing incremental runs (outputs `web/scripts/output/sko_step_timings.csv`). *(Script present; serverless trigger still timing out.)*

## Phase 5 — In‑Season Rolling Backtest
- [ ] Cutoff = 2024‑12‑31; start predictions at 2025‑01‑01.
- [ ] Predict 5 games ahead; step forward one game; retrain or warm‑update.
- [ ] Capture accuracy metrics over time; log drift or degradation.

## Phase 6 — Storage + API
- [ ] Create `predictions_sko` table in Supabase: player_id, as_of_date, horizon, pred_points_5, stability, sKO, top_features, created_at. *(Migration drafted in `migrations/20250924_create_predictions_sko.sql`; needs review + deploy.)*
- [ ] Write uploader to refresh predictions nightly. *(Uploader script ready; waiting on table deployment + cron.)*

## Phase 7 — UI (`web/pages/trends/index.tsx`)
- [x] Fetch and list players with sKO, sortable.
- [x] Add tooltip: “Sustainability K‑Value Outlook…” with a short 1–2 sentence explainer.
- [x] Show small trend sparkline. *(Driver stats pending `top_features`.)*
- [x] Link to detailed player view with richer charts (sparkline, D3 candlestick, crosshair, transparency cards).
- [x] Modularize UI under `components/Predictions/` for reuse and easier testing.

## Phase 8 — Docs & Ops
- [ ] Keep this document updated as we tweak targets and features.
- [ ] Add a short README in the modeling folder with run commands.
- [ ] Schedule the nightly job and set alerts if the pipeline fails.

# Recent Progress (2025-09-25)
- Hardened `/api/v1/ml/update-predictions-sko` with admin middleware, optional shared secret, batching, and player filters for safe manual runs.
- Seasonal backfill pipeline (`web/scripts/modeling/backfill_seasons.py`) generates <15s parquet snapshots per season (2022-23 onward) and updates `web/scripts/output/sko_backfill_state.json` for resumable runs.
- Feature builder honors append windows (`SKO_FEATURE_MIN_DATE/MAX_DATE/PLAYER_IDS`) and dedupes on append, keeping historical parquet lean.
- `train.py` fits ElasticNet + scikit-learn GBRT across points and category targets, persisting metrics/predictions to `web/scripts/output/`.
- `score.py` loads latest models, applies smoothstep stability multipliers (player p50/p90 CV), and writes sKO-ready parquet for upload.
- Trends index + player detail pages render sparkline history, candlestick projections, search/stepper controls, and early transparency cards using local parquet artifacts.

# Outstanding Gaps & Risks
- LightGBM / XGBoost still missing; without feature importances we cannot surface `top_features` in the UI.
- Transparency timeline (MAE/MAPE history) not yet built; blocked on metrics ingestion to Supabase.
- Vercel worker (`functions/api/sko_pipeline.py`) currently proxies the long pipeline and hits a ~15s timeout; need sub-300s segmented workflow.
- Supabase tables (`predictions_sko`, `predictions_sko_metrics`) pending migration approval; uploader remains dormant.
- Step-forward simulation OK locally but serverless trigger returns 500 due to runtime; needs refactor before enabling cron.

# Next Actions
1. Integrate LightGBM / XGBoost into `train.py`, persist models, and capture gain-based feature importances.
2. Extend `score.py` to emit per-player `top_features` JSON and ensure schema matches UI expectations.
3. Apply Supabase migrations (`migrations/20250924_create_predictions_sko.sql`, forthcoming metrics table) then enable `upload_predictions.py` to upsert.
4. Rework serverless orchestration: chain seasonal backfill, date-slice scoring, and uploads into <300s Vercel invocations.
5. Build transparency history chart (MAE/MAPE bands) in Trends UI once metrics table populated.
6. Document cron + alerting runbook in `web/scripts/modeling/README.md` after pipeline stabilizes.

---

# Practical Notes
- Avoid leaking future info: all features for a given prediction must come from data before that prediction date.
- Use time‑series cross‑validation (forward chaining) and group by player to avoid overfitting individuals.
- Start with ElasticNet/GBM — simple, strong, and transparent — then consider a small neural net if it clearly helps.

