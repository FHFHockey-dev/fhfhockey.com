# sKO Modeling Pipeline

This directory houses the end-to-end workflow for generating stability-adjusted skater projections. The scripts are scaffolds that will be expanded in subsequent iterations.

## Layout
- `features.py` — construct training datasets from `player_stats_unified`.
- `train.py` — fit baseline ElasticNet and gradient boosting models.
- `backtest.py` — run the rolling holdout evaluation and emit a markdown report.
- `upload_predictions.py` — push model outputs into `predictions_sko` through the Next.js API or Supabase client.
- `score.py` — generate the latest sKO predictions using trained models and write them to parquet for upload.
- `step_forward.py` — simulate day-by-day incremental updates and record timing metrics to `sko_step_timings.csv`.
- Accuracy instrumentation and metric logging will accompany the training step so we can surface transparency in the UI.

## Usage
Prerequisites:
- Python 3.10+
- Install dependencies: `pip install pandas sqlalchemy pyarrow scikit-learn scipy psycopg[binary]`
- Provide credentials via environment variables (files are auto-loaded from `.env`, `.env.local`, `web/.env`, `web/.env.local`):
  - `DATABASE_URL` (preferred) or `SUPABASE_DB_URL` pointing at the Postgres instance
  - Optionally `SKO_FEATURE_INPUT_PATH` for a cached parquet/CSV snapshot if DB access is unavailable

Optional environment variables:
- `SKO_FEATURE_AS_OF_DATE` (YYYY-MM-DD)
- `SKO_FEATURE_LOOKBACK_DAYS`
- `SKO_FEATURE_HORIZON`
- `SKO_FEATURE_WINDOWS` (comma-separated list, e.g. `5,10,20`)
- `SKO_FEATURE_CV_WINDOW`
- `SKO_FEATURE_INPUT_PATH`
- `SKO_FEATURE_TARGETS`

The training step reads `web/scripts/output/sko_features.parquet` and writes:
- Models → `web/scripts/output/models/`
- Holdout predictions → `web/scripts/output/sko_holdout_predictions.parquet`
- Metrics → `web/scripts/output/sko_metrics.parquet`
- `SKO_FEATURE_TARGETS` (comma-separated metrics, defaults to `points,goals,assists,pp_points,shots,hits,blocked_shots`)

1. Build features:
   ```bash
   python web/scripts/modeling/features.py
   ```
2. Train models:
   ```bash
   python web/scripts/modeling/train.py
   ```
3. Generate predictions:
   ```bash
   python web/scripts/modeling/score.py
   ```
4. Execute the backtest (optional):
   ```bash
   python web/scripts/modeling/backtest.py
   ```
5. Upload the latest predictions and metrics:
   ```bash
   python web/scripts/modeling/upload_predictions.py
   ```

Environment variables for database and Supabase credentials will be introduced as the scripts are implemented.
