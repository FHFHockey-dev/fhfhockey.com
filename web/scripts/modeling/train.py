#!/usr/bin/env python3
"""Model training pipeline for sKO predictions and transparency metrics."""

from __future__ import annotations

import copy
import json
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional
import time

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from pandas import DataFrame
from threadpoolctl import threadpool_limits

try:
    from sklearn.base import clone
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import ElasticNet
    from sklearn.metrics import mean_absolute_error, mean_squared_error
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
except ImportError as exc:  # pragma: no cover - dependency hint path
    raise ImportError(
        "scikit-learn is required for training. Install it via `pip install scikit-learn`."
    ) from exc

try:
    import lightgbm as lgb

    LIGHTGBM_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    LIGHTGBM_AVAILABLE = False

try:
    from xgboost import XGBRegressor

    XGBOOST_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    XGBOOST_AVAILABLE = False

try:
    from scipy.stats import spearmanr
except ImportError as exc:  # pragma: no cover - dependency hint path
    raise ImportError("scipy is required for spearman correlation. `pip install scipy`." ) from exc


IDENTIFIER_COLUMNS = {
    "player_id",
    "date",
    "season_id",
    "team_id",
    "games_played_cum",
    "season_game_number",
}


@dataclass
class TrainingConfig:
    """Settings for model training runs."""

    features_path: Path = Path("web/scripts/output/sko_features.parquet")
    model_dir: Path = Path("web/scripts/output/models")
    metrics_path: Path = Path("web/scripts/output/sko_metrics.parquet")
    predictions_path: Path = Path("web/scripts/output/sko_holdout_predictions.parquet")
    horizon_games: int = 5
    holdout_start: Optional[str] = "2025-01-01"
    seed: int = 42
    elasticnet_alpha: float = 0.1
    elasticnet_l1_ratio: float = 0.4
    gbrt_learning_rate: float = 0.05
    gbrt_max_depth: int = 3
    gbrt_estimators: int = 500
    lgb_learning_rate: float = 0.03
    lgb_num_leaves: int = 31
    lgb_estimators: int = 600
    xgb_learning_rate: float = 0.03
    xgb_max_depth: int = 4
    xgb_estimators: int = 800
    xgb_subsample: float = 0.9
    xgb_colsample_bytree: float = 0.8
    val_fraction: float = 0.1
    early_stopping_rounds: int = 50
    outer_n_jobs: int = -1
    inner_n_threads: int = 1
    run_id: uuid.UUID = field(default_factory=uuid.uuid4)


# ---------------------------------------------------------------------------
# Data loading and preparation helpers
# ---------------------------------------------------------------------------


def load_training_data(config: TrainingConfig) -> DataFrame:
    """Load feature matrix and target values."""

    try:
        df = pd.read_parquet(config.features_path)
    except ImportError as exc:  # pragma: no cover - dependency hint path
        raise ImportError(
            "Parquet support requires `pyarrow` or `fastparquet`. Install one via `pip install pyarrow`."
        ) from exc
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])

    df = df.replace([np.inf, -np.inf], np.nan)

    all_null_cols = [col for col in df.columns if df[col].isna().all()]
    if all_null_cols:
        df = df.drop(columns=all_null_cols)
        print(
            "Dropping columns with all-null values:",
            ", ".join(all_null_cols[:10]) + ("..." if len(all_null_cols) > 10 else ""),
        )

    zero_var_cols = df.select_dtypes(include=["number", "bool"]).columns[
        df.select_dtypes(include=["number", "bool"]).nunique() <= 1
    ].tolist()
    if zero_var_cols:
        df = df.drop(columns=zero_var_cols)
        print(
            "Dropping zero-variance numeric columns:",
            ", ".join(zero_var_cols[:10]) + ("..." if len(zero_var_cols) > 10 else ""),
        )
    return df


def split_holdout(df: DataFrame, config: TrainingConfig) -> tuple[DataFrame, DataFrame]:
    """Split the dataset into train and validation segments based on holdout date."""

    if config.holdout_start is None:
        cutoff_index = int(len(df) * 0.8)
        return df.iloc[:cutoff_index].copy(), df.iloc[cutoff_index:].copy()

    cutoff_ts = pd.Timestamp(config.holdout_start)
    train_df = df[df["date"] < cutoff_ts].copy()
    holdout_df = df[df["date"] >= cutoff_ts].copy()
    if train_df.empty or holdout_df.empty:
        raise ValueError(
            "Time-based split produced an empty partition. Adjust `holdout_start` in TrainingConfig."
        )
    return train_df, holdout_df


def derive_feature_columns(df: DataFrame) -> tuple[list[str], list[str]]:
    """Determine feature and target columns from the dataset."""

    target_cols = [col for col in df.columns if col.startswith("target_")]
    if not target_cols:
        raise ValueError("No target columns found in dataset; run feature builder first.")

    candidate_cols = [
        col
        for col in df.columns
        if col not in IDENTIFIER_COLUMNS and col not in target_cols and not col.startswith("target_")
    ]

    numeric_cols = (
        df[candidate_cols]
        .select_dtypes(include=["number", "bool"])
        .columns.tolist()
    )

    dropped = sorted(set(candidate_cols) - set(numeric_cols))
    if dropped:
        preview = ", ".join(dropped[:10])
        suffix = "..." if len(dropped) > 10 else ""
        print(f"Skipping non-numeric feature columns: {preview}{suffix}")

    if not numeric_cols:
        raise ValueError(
            "No numeric feature columns found after excluding identifiers and targets."
        )
    return numeric_cols, target_cols


# ---------------------------------------------------------------------------
# Model factory helpers
# ---------------------------------------------------------------------------


class ModelSpec(dict):
    """Dictionary carrying estimator metadata (estimator + kind)."""


def build_model_registry(config: TrainingConfig) -> dict[str, ModelSpec]:
    """Return model specs keyed by identifier."""

    registry: dict[str, ModelSpec] = {
        "elastic_net": ModelSpec(
            estimator=ElasticNet(
                alpha=config.elasticnet_alpha,
                l1_ratio=config.elasticnet_l1_ratio,
                random_state=config.seed,
                max_iter=5000,
            ),
            kind="linear",
        ),
        "hist_gbrt": ModelSpec(
            estimator=HistGradientBoostingRegressor(
                learning_rate=config.gbrt_learning_rate,
                max_depth=config.gbrt_max_depth,
                max_iter=config.gbrt_estimators,
                random_state=config.seed,
                early_stopping=True,
            ),
            kind="tree",
        ),
    }

    if LIGHTGBM_AVAILABLE:
        registry["lightgbm"] = ModelSpec(
            estimator=lgb.LGBMRegressor(
                learning_rate=config.lgb_learning_rate,
                num_leaves=config.lgb_num_leaves,
                n_estimators=config.lgb_estimators,
                subsample=0.9,
                colsample_bytree=0.8,
                random_state=config.seed,
            ),
            kind="tree",
        )
    else:
        print("LightGBM not available; skipping lgbm model")

    if XGBOOST_AVAILABLE:
        registry["xgboost"] = ModelSpec(
            estimator=XGBRegressor(
                learning_rate=config.xgb_learning_rate,
                max_depth=config.xgb_max_depth,
                n_estimators=config.xgb_estimators,
                subsample=config.xgb_subsample,
                colsample_bytree=config.xgb_colsample_bytree,
                random_state=config.seed,
                objective="reg:squarederror",
                eval_metric="rmse",
                verbosity=0,
            ),
            kind="tree",
        )
    else:
        print("XGBoost not available; skipping xgb model")

    return registry


# ---------------------------------------------------------------------------
# Metrics utilities
# ---------------------------------------------------------------------------


def safe_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    mask = np.abs(y_true) > 1e-6
    if not np.any(mask):
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100.0)


def compute_margin_of_error(residuals: np.ndarray, coverage: float = 0.8) -> float:
    if residuals.size == 0:
        return float("nan")
    percentile = coverage * 100.0
    return float(np.percentile(np.abs(residuals), percentile))


def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    stat_key: str,
    model_name: str,
    run_id: uuid.UUID,
    config: TrainingConfig,
    as_of_date: pd.Timestamp,
) -> dict[str, object]:
    residuals = y_true - y_pred
    mae = mean_absolute_error(y_true, y_pred)
    mse = mean_squared_error(y_true, y_pred)
    rmse = float(np.sqrt(mse))
    mape = safe_mape(y_true, y_pred)
    spearman_corr, _ = spearmanr(y_true, y_pred)
    moe = compute_margin_of_error(residuals)
    hit_rate = float(np.mean(np.abs(residuals) <= moe)) if np.isfinite(moe) else float("nan")

    return {
        "run_id": str(run_id),
        "as_of_date": as_of_date.date().isoformat(),
        "horizon_games": config.horizon_games,
        "stat_key": stat_key,
        "model_name": model_name,
        "sample_size": int(len(y_true)),
        "mae": float(mae),
        "mape": float(mape),
        "rmse": float(rmse),
        "spearman_r": float(spearman_corr) if spearman_corr is not None else float("nan"),
        "margin_of_error": float(moe),
        "hit_rate_within_moe": hit_rate,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def stat_key_from_target(target_col: str, horizon: int) -> str:
    prefix = "target_"
    suffix = f"_next_{horizon}"
    if target_col.startswith(prefix) and target_col.endswith(suffix):
        return target_col[len(prefix) : -len(suffix)]
    return target_col


# ---------------------------------------------------------------------------
# Training loop
# ---------------------------------------------------------------------------


def make_time_validation_split(dates: np.ndarray, val_fraction: float) -> tuple[np.ndarray, np.ndarray]:
    """Generate train/validation indices while keeping chronological order."""

    if val_fraction <= 0 or dates.size < 8:
        return np.arange(dates.size), np.array([], dtype=int)

    order = np.argsort(dates)
    val_size = max(1, int(np.floor(val_fraction * dates.size)))
    if val_size >= dates.size:
        return order, np.array([], dtype=int)

    val_indices = order[-val_size:]
    train_indices = order[:-val_size]
    return train_indices, val_indices


def train_models(
    df: DataFrame, config: TrainingConfig
) -> tuple[dict[str, dict[str, Pipeline]], DataFrame, DataFrame, list[str], list[str]]:
    """Fit baseline models per target and return trained artifacts and evaluation metrics."""

    feature_cols, target_cols = derive_feature_columns(df)
    train_df, holdout_df = split_holdout(df, config)

    if train_df.empty or holdout_df.empty:
        raise ValueError("Training or holdout split is empty; adjust configuration.")

    train_df = train_df.reset_index(drop=True)
    holdout_df = holdout_df.reset_index(drop=True)

    X_train_df = train_df[feature_cols]
    X_holdout_df = holdout_df[feature_cols]

    linear_preprocess = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    tree_preprocess = Pipeline(
        steps=[("imputer", SimpleImputer(strategy="median"))]
    )

    linear_preprocess.fit(X_train_df)
    tree_preprocess.fit(X_train_df)

    X_train_linear = linear_preprocess.transform(X_train_df).astype(np.float32)
    X_holdout_linear = linear_preprocess.transform(X_holdout_df).astype(np.float32)
    X_train_tree = tree_preprocess.transform(X_train_df).astype(np.float32)
    X_holdout_tree = tree_preprocess.transform(X_holdout_df).astype(np.float32)

    model_factory = build_model_registry(config)
    trained_models: dict[str, dict[str, Pipeline]] = defaultdict(dict)
    metrics_records: list[dict[str, object]] = []
    predictions_records: list[dict[str, object]] = []

    as_of_date = holdout_df["date"].max()
    if pd.isna(as_of_date):
        raise ValueError("Unable to determine as_of_date from holdout set")

    tasks: list[dict[str, object]] = []

    for target_col in target_cols:
        stat_key = stat_key_from_target(target_col, config.horizon_games)

        train_target = train_df[[target_col, "player_id", "date"]].dropna(subset=[target_col])
        holdout_target = holdout_df[[target_col, "player_id", "date"]].dropna(subset=[target_col])

        if train_target.empty or holdout_target.empty:
            continue

        train_idx = train_target.index.to_numpy()
        holdout_idx = holdout_target.index.to_numpy()
        y_train_full = train_target[target_col].to_numpy(dtype=np.float32)
        y_holdout = holdout_target[target_col].to_numpy(dtype=np.float32)
        train_dates = train_target["date"].to_numpy()

        for model_name, spec in model_factory.items():
            kind = spec.get("kind", "tree")
            if kind == "linear":
                X_train_all = X_train_linear
                X_holdout_all = X_holdout_linear
            else:
                X_train_all = X_train_tree
                X_holdout_all = X_holdout_tree

            X_train_target = X_train_all[train_idx]
            X_holdout_target = X_holdout_all[holdout_idx]

            fit_indices, val_indices = make_time_validation_split(train_dates, config.val_fraction)
            X_fit = X_train_target[fit_indices]
            y_fit = y_train_full[fit_indices]
            X_val = X_train_target[val_indices] if val_indices.size else None
            y_val = y_train_full[val_indices] if val_indices.size else None

            tasks.append(
                {
                    "target_col": target_col,
                    "stat_key": stat_key,
                    "model_name": model_name,
                    "kind": kind,
                    "estimator": spec["estimator"],
                    "X_fit": X_fit,
                    "y_fit": y_fit,
                    "X_val": X_val,
                    "y_val": y_val,
                    "X_holdout": X_holdout_target,
                    "y_holdout": y_holdout,
                    "holdout_player_ids": holdout_target["player_id"].to_numpy(dtype=int),
                    "holdout_dates": holdout_target["date"].to_numpy(),
                }
            )

    if not tasks:
        raise RuntimeError("No viable training tasks were generated; check data availability.")

    def fit_one(task: dict[str, object]) -> dict[str, object]:
        estimator = clone(task["estimator"])
        model_name = task["model_name"]
        X_fit = task["X_fit"]
        y_fit = task["y_fit"]
        X_val = task["X_val"]
        y_val = task["y_val"]

        with threadpool_limits(limits=config.inner_n_threads):
            if model_name == "lightgbm":
                estimator.set_params(n_jobs=config.inner_n_threads)
                if X_val is not None and X_val.size:
                    callbacks = [
                        lgb.early_stopping(
                            stopping_rounds=config.early_stopping_rounds,
                            verbose=False,
                        )
                    ]
                    estimator.fit(
                        X_fit,
                        y_fit,
                        eval_set=[(X_val, y_val)],
                        eval_metric="l2",
                        callbacks=callbacks,
                    )
                else:
                    estimator.fit(X_fit, y_fit)
            elif model_name == "xgboost":
                estimator.set_params(
                    n_jobs=config.inner_n_threads,
                    tree_method="hist",
                    max_bin=256,
                )
                if X_val is not None and X_val.size:
                    estimator.set_params(
                        early_stopping_rounds=config.early_stopping_rounds,
                    )
                    estimator.fit(
                        X_fit,
                        y_fit,
                        eval_set=[(X_val, y_val)],
                        verbose=False,
                    )
                else:
                    estimator.fit(X_fit, y_fit, verbose=False)
            elif model_name == "hist_gbrt":
                estimator.set_params(max_bins=255)
                estimator.fit(X_fit, y_fit)
            else:
                estimator.fit(X_fit, y_fit)

            y_pred = estimator.predict(task["X_holdout"])

        metrics = compute_metrics(
            y_true=task["y_holdout"],
            y_pred=y_pred,
            stat_key=task["stat_key"],
            model_name=model_name,
            run_id=config.run_id,
            config=config,
            as_of_date=as_of_date,
        )

        return {
            "task": task,
            "model": estimator,
            "metrics": metrics,
            "predictions": y_pred,
        }

    results = Parallel(n_jobs=config.outer_n_jobs, prefer="threads")(
        delayed(fit_one)(task) for task in tasks
    )

    for result in results:
        task = result["task"]
        model = result["model"]
        metrics_records.append(result["metrics"])

        holdout_player_ids = task["holdout_player_ids"]
        holdout_dates = task["holdout_dates"]
        y_holdout = task["y_holdout"]
        preds = result["predictions"]

        predictions_records.extend(
            {
                "run_id": str(config.run_id),
                "stat_key": task["stat_key"],
                "model_name": task["model_name"],
                "horizon_games": config.horizon_games,
                "player_id": int(player_id),
                "date": pd.Timestamp(pred_date).date().isoformat(),
                "actual": float(actual),
                "predicted": float(pred),
            }
            for player_id, pred_date, actual, pred in zip(
                holdout_player_ids,
                holdout_dates,
                y_holdout,
                preds,
            )
        )

        preprocess = linear_preprocess if task["kind"] == "linear" else tree_preprocess
        pipeline = Pipeline([
            ("preprocess", copy.deepcopy(preprocess)),
            ("model", model),
        ])
        trained_models[task["target_col"]][task["model_name"]] = pipeline

    metrics_df = pd.DataFrame(metrics_records)
    predictions_df = pd.DataFrame(predictions_records)

    if metrics_df.empty:
        print("Warning: metrics dataframe is empty")
    if predictions_df.empty:
        print("Warning: predictions dataframe is empty")
    return trained_models, metrics_df, predictions_df, feature_cols, target_cols


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def persist_models(
    models: dict[str, dict[str, Pipeline]],
    config: TrainingConfig,
    feature_columns: list[str],
    target_columns: list[str],
) -> None:
    """Serialize trained models to disk."""

    config.model_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "run_id": str(config.run_id),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "targets": {
            target: list(model_dict.keys()) for target, model_dict in models.items()
        },
        "feature_columns": feature_columns,
        "target_columns": target_columns,
    }

    for target, model_dict in models.items():
        for model_name, model in model_dict.items():
            filename = f"{target}__{model_name}.pickle"
            output_path = config.model_dir / filename
            pd.to_pickle(model, output_path)

    manifest_path = config.model_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def persist_metrics(metrics_df: DataFrame, predictions_df: DataFrame, config: TrainingConfig) -> None:
    """Persist evaluation metrics and holdout predictions for transparency."""

    config.metrics_path.parent.mkdir(parents=True, exist_ok=True)
    config.predictions_path.parent.mkdir(parents=True, exist_ok=True)

    if not metrics_df.empty:
        metrics_df.to_parquet(config.metrics_path, index=False)
    if not predictions_df.empty:
        predictions_df.to_parquet(config.predictions_path, index=False)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def main() -> None:
    """Entry point for running training from the CLI."""

    wall_start = time.perf_counter()
    config = TrainingConfig()
    load_start = time.perf_counter()
    dataset = load_training_data(config)
    load_elapsed = time.perf_counter() - load_start

    train_start = time.perf_counter()
    models, metrics_df, predictions_df, feature_columns, target_columns = train_models(
        dataset, config
    )
    train_elapsed = time.perf_counter() - train_start

    if not models:
        raise RuntimeError("No models were trained. Ensure targets have sufficient data.")

    persist_start = time.perf_counter()
    persist_models(models, config, feature_columns, target_columns)
    persist_metrics(metrics_df, predictions_df, config)
    persist_elapsed = time.perf_counter() - persist_start

    total_elapsed = time.perf_counter() - wall_start

    print(
        (
            f"Persisted {len(models)} target families with {len(metrics_df)} metric rows to {config.model_dir}"
            f" (load={load_elapsed:.2f}s train={train_elapsed:.2f}s persist={persist_elapsed:.2f}s total={total_elapsed:.2f}s)"
        )
    )


if __name__ == "__main__":
    main()
