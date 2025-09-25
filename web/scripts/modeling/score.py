#!/usr/bin/env python3
"""Generate sKO predictions using trained models."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from importance import extract_top_feature_contributions
from train import (
    TrainingConfig,
    derive_feature_columns,
    load_training_data,
)

PREDICTIONS_OUTPUT = Path("web/scripts/output/sko_predictions.parquet")
SPARKLINE_HISTORY_DAYS = 45
CV_WINDOW = 10


@dataclass
class ScoreConfig:
    models_dir: Path
    features_path: Path
    output_path: Path = PREDICTIONS_OUTPUT
    as_of_date: Optional[date] = None
    horizon_games: int = 5
    run_id: Optional[str] = None
    feature_columns: Optional[list[str]] = None
    target_models: dict[str, list[str]] = field(default_factory=dict)
    selected_model: Optional[str] = None


def load_manifest(models_dir: Path) -> dict[str, object]:
    manifest_path = models_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError("Model manifest not found; run train.py first.")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


MODEL_PRIORITY: tuple[str, ...] = ("lightgbm", "xgboost", "gbrt", "elastic_net")


def select_model_name(targets: dict[str, list[str]], target_key: str) -> str:
    available = targets.get(target_key) or []
    if not available:
        raise ValueError(
            f"No trained models found for target '{target_key}'. Run train.py to generate models."
        )
    for candidate in MODEL_PRIORITY:
        if candidate in available:
            return candidate
    return available[0]


def parse_env_config() -> ScoreConfig:
    training_config = TrainingConfig()
    manifest = load_manifest(training_config.model_dir)

    env_as_of = os.getenv("SKO_SCORE_AS_OF_DATE")
    as_of_date = None
    if env_as_of:
        as_of_date = datetime.fromisoformat(env_as_of).date()

    horizon_env = os.getenv("SKO_SCORE_HORIZON")
    horizon_games = int(horizon_env) if horizon_env else training_config.horizon_games

    targets = {
        key: list(value)
        for key, value in (manifest.get("targets") or {}).items()
    }
    feature_cols = manifest.get("feature_columns")
    target_col_key = f"target_points_next_{horizon_games}"
    selected_model = select_model_name(targets, target_col_key)

    return ScoreConfig(
        models_dir=training_config.model_dir,
        features_path=training_config.features_path,
        output_path=Path(
            os.getenv(
                "SKO_SCORE_OUTPUT_PATH",
                str(PREDICTIONS_OUTPUT),
            )
        ).expanduser(),
        as_of_date=as_of_date,
        horizon_games=horizon_games,
        run_id=manifest.get("run_id"),
        feature_columns=list(feature_cols) if feature_cols else None,
        target_models=targets,
        selected_model=selected_model,
    )


def resolve_feature_columns(dataset: pd.DataFrame, config: ScoreConfig) -> list[str]:
    if config.feature_columns:
        missing = [col for col in config.feature_columns if col not in dataset.columns]
        if missing:
            preview = ", ".join(missing[:5])
            raise ValueError(
                f"Feature columns referenced in manifest are missing from dataset: {preview}"
            )
        return list(config.feature_columns)

    feature_cols, _ = derive_feature_columns(dataset)
    return feature_cols


def smoothstep(x: float, t1: float, t2: float, minimum: float, maximum: float) -> float:
    if not np.isfinite(x) or not np.isfinite(t1) or not np.isfinite(t2) or t2 <= t1:
        return 1.0
    xr = np.clip((x - t1) / (t2 - t1), 0.0, 1.0)
    s = 3 * xr**2 - 2 * xr**3
    return minimum + (maximum - minimum) * (1.0 - s)


def compute_stability(history: pd.DataFrame) -> tuple[float, float | None, float | None, float | None]:
    cv_col = f"points_cv{CV_WINDOW}"
    series = history[cv_col].dropna()
    if series.empty:
        return 1.0, None, None, None
    current_cv = float(series.iloc[-1])
    t1 = float(series.quantile(0.5))
    t2 = float(series.quantile(0.9))
    multiplier = smoothstep(current_cv, t1, t2, 0.8, 1.0)
    return multiplier, current_cv, t1, t2


def load_model(model_path: Path):
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")
    return pd.read_pickle(model_path)


def compute_contributions(
    pipeline, X_matrix: np.ndarray, model_name: str
) -> tuple[np.ndarray, Optional[np.ndarray]]:
    """Generate predictions and optional feature contributions."""

    predictions = pipeline.predict(X_matrix)

    preprocess = getattr(pipeline, "named_steps", {}).get("preprocess")
    estimator = getattr(pipeline, "named_steps", {}).get("model", pipeline)

    transformed = X_matrix
    if preprocess is not None:
        transformed = preprocess.transform(X_matrix)

    contributions: Optional[np.ndarray] = None

    try:
        if model_name == "lightgbm" and hasattr(estimator, "predict"):
            contributions = estimator.predict(transformed, pred_contrib=True)
        elif model_name == "xgboost" and hasattr(estimator, "predict"):
            contributions = estimator.predict(transformed, pred_contribs=True)
        elif model_name == "elastic_net":
            coef = getattr(estimator, "coef_", None)
            if coef is not None:
                intercept = float(getattr(estimator, "intercept_", 0.0))
                contrib_core = transformed * coef
                intercept_column = np.full((contrib_core.shape[0], 1), intercept)
                contributions = np.hstack([contrib_core, intercept_column])
    except Exception as exc:  # pragma: no cover - guardrail
        print(f"Warning: failed to compute feature contributions for {model_name}: {exc}")
        contributions = None

    return predictions, contributions


def build_predictions(config: ScoreConfig) -> pd.DataFrame:
    dataset = load_training_data(TrainingConfig(features_path=config.features_path))
    feature_cols = resolve_feature_columns(dataset, config)

    max_dataset_date = dataset["date"].max()
    as_of_date = config.as_of_date or max_dataset_date.date()

    eligible = dataset[dataset["date"] <= pd.Timestamp(as_of_date)].copy()
    if eligible.empty:
        raise ValueError("No feature rows available on or before the requested as_of_date.")

    eligible.sort_values(["player_id", "date"], inplace=True)
    latest_indices = eligible.groupby("player_id")["date"].idxmax()
    latest_rows = eligible.loc[latest_indices].copy()

    model_name = config.selected_model or "gbrt"
    model_filename = f"target_points_next_{config.horizon_games}__{model_name}.pickle"
    model = load_model(config.models_dir / model_filename)

    X_inference = latest_rows[feature_cols].to_numpy()
    pred_points, contribution_matrix = compute_contributions(
        model, X_inference, model_name
    )

    contribution_matrix = (
        np.asarray(contribution_matrix) if contribution_matrix is not None else None
    )

    results = []
    for idx, (row, prediction) in enumerate(
        zip(latest_rows.itertuples(index=False), pred_points)
    ):
        player_history = eligible[eligible["player_id"] == row.player_id]
        player_history = player_history.tail(60)
        stability_multiplier, stability_cv, t1, t2 = compute_stability(player_history)

        pred_total = float(prediction)
        pred_per_game = pred_total / config.horizon_games if np.isfinite(prediction) else None
        sko = pred_total * stability_multiplier if np.isfinite(pred_total) else None

        top_features = None
        if contribution_matrix is not None and idx < contribution_matrix.shape[0]:
            try:
                top_features = extract_top_feature_contributions(
                    contribution_matrix[idx],
                    feature_cols,
                    top_n=5,
                    min_abs_contribution=0.01,
                )
            except ValueError as exc:
                print(
                    f"Warning: could not derive top features for player {row.player_id}: {exc}"
                )
                top_features = None

        results.append(
            {
                "player_id": int(row.player_id),
                "as_of_date": as_of_date.isoformat(),
                "horizon_games": config.horizon_games,
                "pred_points": pred_total if np.isfinite(pred_total) else None,
                "pred_points_per_game": pred_per_game if pred_per_game is not None else None,
                "stability_cv": stability_cv,
                "stability_multiplier": stability_multiplier,
                "top_features": top_features,
                "sko": sko if sko is not None else None,
                "model_name": f"sko-{model_name}",
                "model_version": config.run_id or "unknown",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    return pd.DataFrame(results)


def persist_predictions(df: pd.DataFrame, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False)
    return output_path


def main() -> None:
    config = parse_env_config()
    predictions = build_predictions(config)
    output_path = persist_predictions(predictions, config.output_path)
    print(f"Wrote {len(predictions)} predictions to {output_path}")


if __name__ == "__main__":
    main()
