#!/usr/bin/env python3
"""Generate sKO predictions using trained models."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

import numpy as np
import pandas as pd

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


def load_manifest(models_dir: Path) -> dict[str, object]:
    manifest_path = models_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError("Model manifest not found; run train.py first.")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def parse_env_config() -> ScoreConfig:
    training_config = TrainingConfig()
    manifest = load_manifest(training_config.model_dir)

    env_as_of = os.getenv("SKO_SCORE_AS_OF_DATE")
    as_of_date = None
    if env_as_of:
        as_of_date = datetime.fromisoformat(env_as_of).date()

    horizon_env = os.getenv("SKO_SCORE_HORIZON")
    horizon_games = int(horizon_env) if horizon_env else training_config.horizon_games

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
    )


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


def build_predictions(config: ScoreConfig) -> pd.DataFrame:
    dataset = load_training_data(TrainingConfig(features_path=config.features_path))
    feature_cols, _ = derive_feature_columns(dataset)

    max_dataset_date = dataset["date"].max()
    as_of_date = config.as_of_date or max_dataset_date.date()

    eligible = dataset[dataset["date"] <= pd.Timestamp(as_of_date)].copy()
    if eligible.empty:
        raise ValueError("No feature rows available on or before the requested as_of_date.")

    eligible.sort_values(["player_id", "date"], inplace=True)
    latest_indices = eligible.groupby("player_id")["date"].idxmax()
    latest_rows = eligible.loc[latest_indices].copy()

    model_path = config.models_dir / f"target_points_next_{config.horizon_games}__gbrt.pickle"
    model = load_model(model_path)

    X_inference = latest_rows[feature_cols].to_numpy()
    pred_points = model.predict(X_inference)

    results = []
    for row, prediction in zip(latest_rows.itertuples(index=False), pred_points):
        player_history = eligible[eligible["player_id"] == row.player_id]
        player_history = player_history.tail(60)
        stability_multiplier, stability_cv, t1, t2 = compute_stability(player_history)

        pred_total = float(prediction)
        pred_per_game = pred_total / config.horizon_games if np.isfinite(prediction) else None
        sko = pred_total * stability_multiplier if np.isfinite(pred_total) else None

        results.append(
            {
                "player_id": int(row.player_id),
                "as_of_date": as_of_date.isoformat(),
                "horizon_games": config.horizon_games,
                "pred_points": pred_total if np.isfinite(pred_total) else None,
                "pred_points_per_game": pred_per_game if pred_per_game is not None else None,
                "stability_cv": stability_cv,
                "stability_multiplier": stability_multiplier,
                "top_features": None,
                "sko": sko if sko is not None else None,
                "model_name": "sko-gbrt",
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
