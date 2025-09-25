#!/usr/bin/env python3
"""Model training pipeline for sKO predictions and transparency metrics."""

from __future__ import annotations

import json
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

import numpy as np
import pandas as pd
from pandas import DataFrame

try:
    from sklearn.base import clone
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import GradientBoostingRegressor
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


def build_model_registry(config: TrainingConfig) -> dict[str, Pipeline]:
    """Return the baseline models we want to train for each target."""

    common_numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    # For tree-based models scaling is optional, but keeping the pipeline unified simplifies code.
    tree_transformer = Pipeline(steps=[("imputer", SimpleImputer(strategy="median"))])

    elasticnet_pipeline = Pipeline(
        steps=[
            (
                "preprocess",
                ColumnTransformer(
                    transformers=[("num", common_numeric_transformer, slice(0, None))],
                    remainder="drop",
                ),
            ),
            (
                "model",
                ElasticNet(
                    alpha=config.elasticnet_alpha,
                    l1_ratio=config.elasticnet_l1_ratio,
                    random_state=config.seed,
                    max_iter=5000,
                ),
            ),
        ]
    )

    gbrt_pipeline = Pipeline(
        steps=[
            (
                "preprocess",
                ColumnTransformer(
                    transformers=[("num", tree_transformer, slice(0, None))],
                    remainder="drop",
                ),
            ),
            (
                "model",
                GradientBoostingRegressor(
                    random_state=config.seed,
                    learning_rate=config.gbrt_learning_rate,
                    max_depth=config.gbrt_max_depth,
                    n_estimators=config.gbrt_estimators,
                ),
            ),
        ]
    )

    registry: dict[str, Pipeline] = {
        "elastic_net": elasticnet_pipeline,
        "gbrt": gbrt_pipeline,
    }

    if LIGHTGBM_AVAILABLE:
        lgbm_pipeline = Pipeline(
            steps=[
                (
                    "preprocess",
                    ColumnTransformer(
                        transformers=[("num", tree_transformer, slice(0, None))],
                        remainder="drop",
                    ),
                ),
                (
                    "model",
                    lgb.LGBMRegressor(
                        objective="regression",
                        random_state=config.seed,
                        learning_rate=config.lgb_learning_rate,
                        n_estimators=config.lgb_estimators,
                        num_leaves=config.lgb_num_leaves,
                        subsample=0.9,
                        colsample_bytree=0.8,
                    ),
                ),
            ]
        )
        registry["lightgbm"] = lgbm_pipeline
    else:
        print("LightGBM not available; skipping lgbm model")

    if XGBOOST_AVAILABLE:
        xgb_pipeline = Pipeline(
            steps=[
                (
                    "preprocess",
                    ColumnTransformer(
                        transformers=[("num", tree_transformer, slice(0, None))],
                        remainder="drop",
                    ),
                ),
                (
                    "model",
                    XGBRegressor(
                        random_state=config.seed,
                        n_estimators=config.xgb_estimators,
                        learning_rate=config.xgb_learning_rate,
                        max_depth=config.xgb_max_depth,
                        subsample=config.xgb_subsample,
                        colsample_bytree=config.xgb_colsample_bytree,
                        objective="reg:squarederror",
                        n_jobs=-1,
                        missing=np.nan,
                    ),
                ),
            ]
        )
        registry["xgboost"] = xgb_pipeline
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


def train_models(
    df: DataFrame, config: TrainingConfig
) -> tuple[dict[str, dict[str, Pipeline]], DataFrame, DataFrame, list[str], list[str]]:
    """Fit baseline models per target and return trained artifacts and evaluation metrics."""

    feature_cols, target_cols = derive_feature_columns(df)
    train_df, holdout_df = split_holdout(df, config)

    if train_df.empty or holdout_df.empty:
        raise ValueError("Training or holdout split is empty; adjust configuration.")

    X_train = train_df[feature_cols]
    X_holdout = holdout_df[feature_cols]

    model_factory = build_model_registry(config)
    trained_models: dict[str, dict[str, Pipeline]] = defaultdict(dict)
    metrics_records: list[dict[str, object]] = []
    predictions_records: list[dict[str, object]] = []

    as_of_date = holdout_df["date"].max()
    if pd.isna(as_of_date):
        raise ValueError("Unable to determine as_of_date from holdout set")

    for target_col in target_cols:
        stat_key = stat_key_from_target(target_col, config.horizon_games)

        train_target = train_df[[target_col, "player_id", "date"]].dropna(subset=[target_col])
        holdout_target = holdout_df[[target_col, "player_id", "date"]].dropna(subset=[target_col])

        if train_target.empty or holdout_target.empty:
            continue

        y_train = train_target[target_col].to_numpy()
        y_holdout = holdout_target[target_col].to_numpy()

        X_train_slice = X_train.loc[train_target.index].to_numpy()
        X_holdout_slice = X_holdout.loc[holdout_target.index].to_numpy()

        for model_name, model in model_factory.items():
            model_instance = clone(model)
            model_instance.fit(X_train_slice, y_train)
            y_pred = model_instance.predict(X_holdout_slice)

            metrics_records.append(
                compute_metrics(
                    y_true=y_holdout,
                    y_pred=y_pred,
                    stat_key=stat_key,
                    model_name=model_name,
                    run_id=config.run_id,
                    config=config,
                    as_of_date=as_of_date,
                )
            )

            predictions_records.extend(
                {
                    "run_id": str(config.run_id),
                    "stat_key": stat_key,
                    "model_name": model_name,
                    "horizon_games": config.horizon_games,
                    "player_id": int(player_id),
                    "date": pd.Timestamp(prediction_date).date().isoformat(),
                    "actual": float(actual),
                    "predicted": float(predicted),
                }
                for player_id, prediction_date, actual, predicted in zip(
                    holdout_target["player_id"].to_numpy(),
                    holdout_target["date"].to_numpy(),
                    y_holdout,
                    y_pred,
                )
            )

            trained_models[target_col][model_name] = model_instance

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

    config = TrainingConfig()
    dataset = load_training_data(config)
    models, metrics_df, predictions_df, feature_columns, target_columns = train_models(
        dataset, config
    )

    if not models:
        raise RuntimeError("No models were trained. Ensure targets have sufficient data.")

    persist_models(models, config, feature_columns, target_columns)
    persist_metrics(metrics_df, predictions_df, config)

    print(
        f"Persisted {len(models)} target families with {len(metrics_df)} metric rows to {config.model_dir}"
    )


if __name__ == "__main__":
    main()
