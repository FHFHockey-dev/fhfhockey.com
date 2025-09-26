#!/usr/bin/env python3
"""Upload sKO predictions, holdout predictions, and metrics to Supabase."""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

import numpy as np
import pandas as pd
from postgrest import APIError
from supabase import Client, create_client

DEFAULT_INFERENCE_PATH = Path("web/scripts/output/sko_predictions.parquet")
DEFAULT_HOLDOUT_PATH = Path("web/scripts/output/sko_holdout_predictions.parquet")
DEFAULT_METRICS_PATH = Path("web/scripts/output/sko_metrics.parquet")

DEFAULT_INFERENCE_TABLE = "predictions_sko"
DEFAULT_HOLDOUT_TABLE = "predictions_sko_predictions"
DEFAULT_METRICS_TABLE = "predictions_sko_metrics"


@dataclass
class UploadConfig:
    inference_predictions_path: Path = DEFAULT_INFERENCE_PATH
    holdout_predictions_path: Path = DEFAULT_HOLDOUT_PATH
    metrics_path: Path = DEFAULT_METRICS_PATH
    inference_table: str = DEFAULT_INFERENCE_TABLE
    holdout_table: str = DEFAULT_HOLDOUT_TABLE
    metrics_table: str = DEFAULT_METRICS_TABLE
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    horizon_games: int = 5
    upsert_limit: int = 100


def bootstrap_env(files: Iterable[Path]) -> None:
    for path in files:
        if not path.exists():
            continue
        for raw_line in path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def load_config() -> UploadConfig:
    bootstrap_env([
        Path(".env"),
        Path(".env.local"),
        Path("web/.env"),
        Path("web/.env.local"),
    ])

    return UploadConfig(
        inference_predictions_path=Path(
            os.getenv("SKO_UPLOAD_INFERENCE_PATH", str(DEFAULT_INFERENCE_PATH))
        ).expanduser(),
        holdout_predictions_path=Path(
            os.getenv("SKO_UPLOAD_HOLDOUT_PATH", str(DEFAULT_HOLDOUT_PATH))
        ).expanduser(),
        metrics_path=Path(
            os.getenv("SKO_UPLOAD_METRICS_PATH", str(DEFAULT_METRICS_PATH))
        ).expanduser(),
        inference_table=os.getenv(
            "SKO_UPLOAD_INFERENCE_TABLE", DEFAULT_INFERENCE_TABLE
        ),
        holdout_table=os.getenv(
            "SKO_UPLOAD_HOLDOUT_TABLE", DEFAULT_HOLDOUT_TABLE
        ),
        metrics_table=os.getenv(
            "SKO_UPLOAD_METRICS_TABLE", DEFAULT_METRICS_TABLE
        ),
        supabase_url=os.getenv("SUPABASE_URL")
        or os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        supabase_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("NEXT_SUPABASE_SERVICE_ROLE_KEY"),
        horizon_games=int(os.getenv("SKO_UPLOAD_HORIZON", "5")),
        upsert_limit=int(os.getenv("SKO_UPLOAD_LIMIT", "100")),
    )


def require_client(config: UploadConfig) -> Client:
    if not config.supabase_url or not config.supabase_key:
        raise RuntimeError(
            "Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )
    return create_client(config.supabase_url, config.supabase_key)


def to_native(value: Any) -> Any:
    """Convert numpy/pandas objects into JSON-serialisable Python types."""

    if isinstance(value, dict):
        return {str(k): to_native(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_native(v) for v in value]
    if isinstance(value, tuple):
        return [to_native(v) for v in value]
    if isinstance(value, np.ndarray):
        return [to_native(v) for v in value.tolist()]
    if isinstance(value, (np.generic,)):
        return value.item()
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, pd.Series):
        return [to_native(v) for v in value.tolist()]
    return value


def load_parquet(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_parquet(path)


def prepare_inference_records(df: pd.DataFrame) -> list[dict[str, object]]:
    if df.empty:
        return []

    required = {
        "player_id",
        "as_of_date",
        "horizon_games",
        "pred_points",
        "pred_points_per_game",
        "stability_cv",
        "stability_multiplier",
        "sko",
        "model_name",
        "model_version",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Inference predictions parquet missing columns: {', '.join(sorted(missing))}"
        )

    records: list[dict[str, object]] = []
    for record in df.to_dict("records"):
        native = to_native(record)
        native["created_at"] = native.get("created_at") or datetime.now(timezone.utc).isoformat()
        records.append(native)
    return records


def prepare_holdout_records(df: pd.DataFrame) -> list[dict[str, object]]:
    if df.empty:
        return []

    if "date" in df.columns and "as_of_date" not in df.columns:
        df = df.rename(columns={"date": "as_of_date"})

    required = {
        "run_id",
        "as_of_date",
        "horizon_games",
        "stat_key",
        "model_name",
        "player_id",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Holdout predictions parquet missing columns: {', '.join(sorted(missing))}"
        )

    records: list[dict[str, object]] = []
    for record in df.to_dict("records"):
        native = to_native(record)
        if "created_at" not in native or native["created_at"] is None:
            native["created_at"] = datetime.now(timezone.utc).isoformat()
        records.append(native)
    return records


def prepare_metrics_records(df: pd.DataFrame) -> list[dict[str, object]]:
    if df.empty:
        return []

    records: list[dict[str, object]] = []
    for record in df.to_dict("records"):
        records.append(to_native(record))
    return records


def chunk(records: list[dict[str, object]], size: int) -> Iterable[list[dict[str, object]]]:
    for index in range(0, len(records), size):
        yield records[index : index + size]


def upsert(
    client: Client,
    table: str,
    records: list[dict[str, object]],
    chunk_size: int,
    on_conflict: Optional[str] = None,
) -> None:
    for batch in chunk(records, chunk_size):
        try:
            response = client.table(table).upsert(batch, on_conflict=on_conflict).execute()
        except APIError as exc:
            payload = exc.args[0] if exc.args else {}
            code = payload.get("code") if isinstance(payload, dict) else None
            if code == "42P10" and on_conflict:
                # Retry with plain insert when the conflict target is unavailable.
                response = client.table(table).insert(batch).execute()
            else:
                raise RuntimeError(f"Supabase upsert failed for {table}: {exc}") from exc
        if getattr(response, "error", None):  # type: ignore[attr-defined]
            raise RuntimeError(f"Supabase error for {table}: {response.error}")


def main() -> None:
    wall_start = time.perf_counter()
    config = load_config()
    client = require_client(config)

    load_start = time.perf_counter()
    inference_df = load_parquet(config.inference_predictions_path)
    holdout_df = load_parquet(config.holdout_predictions_path)
    metrics_df = load_parquet(config.metrics_path)
    load_elapsed = time.perf_counter() - load_start

    inference_records = prepare_inference_records(inference_df)
    holdout_records = prepare_holdout_records(holdout_df)
    metrics_records = prepare_metrics_records(metrics_df)

    upsert_start = time.perf_counter()
    inference_count = len(inference_records)
    holdout_count = len(holdout_records)
    metrics_count = len(metrics_records)

    if inference_records:
        upsert(
            client,
            config.inference_table,
            inference_records,
            config.upsert_limit,
            on_conflict="player_id,as_of_date,horizon_games",
        )
        print(f"Uploaded {inference_count} inference predictions to {config.inference_table}")
    else:
        print("No inference predictions to upload")

    if holdout_records and config.holdout_table:
        upsert(
            client,
            config.holdout_table,
            holdout_records,
            config.upsert_limit,
            on_conflict="run_id,player_id,stat_key,model_name,as_of_date",
        )
        print(f"Uploaded {holdout_count} holdout predictions to {config.holdout_table}")
    else:
        print("No holdout predictions to upload")

    if metrics_records:
        upsert(
            client,
            config.metrics_table,
            metrics_records,
            config.upsert_limit,
            on_conflict="as_of_date,horizon_games,stat_key,model_name",
        )
        print(f"Uploaded {metrics_count} metric rows to {config.metrics_table}")
    else:
        print("No metric rows to upload")

    upsert_elapsed = time.perf_counter() - upsert_start
    total_elapsed = time.perf_counter() - wall_start
    print(
        "Upload timings load={:.2f}s upsert={:.2f}s total={:.2f}s".format(
            load_elapsed,
            upsert_elapsed,
            total_elapsed,
        )
    )


if __name__ == "__main__":
    main()
