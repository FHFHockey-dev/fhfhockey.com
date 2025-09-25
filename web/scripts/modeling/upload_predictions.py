#!/usr/bin/env python3
"""Upload sKO predictions, holdout predictions, and metrics to Supabase."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

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
        records.append(
            {
                **record,
                "created_at": record.get("created_at")
                or datetime.now(timezone.utc).isoformat(),
            }
        )
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
        if "created_at" not in record or record["created_at"] is None:
            record["created_at"] = datetime.now(timezone.utc).isoformat()
        records.append(record)
    return records


def prepare_metrics_records(df: pd.DataFrame) -> list[dict[str, object]]:
    if df.empty:
        return []

    records: list[dict[str, object]] = []
    for record in df.to_dict("records"):
        records.append(record)
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
            raise RuntimeError(f"Supabase upsert failed for {table}: {exc}") from exc
        if getattr(response, "error", None):  # type: ignore[attr-defined]
            raise RuntimeError(f"Supabase error for {table}: {response.error}")


def main() -> None:
    config = load_config()
    client = require_client(config)

    inference_df = load_parquet(config.inference_predictions_path)
    holdout_df = load_parquet(config.holdout_predictions_path)
    metrics_df = load_parquet(config.metrics_path)

    inference_records = prepare_inference_records(inference_df)
    holdout_records = prepare_holdout_records(holdout_df)
    metrics_records = prepare_metrics_records(metrics_df)

    if inference_records:
        upsert(
            client,
            config.inference_table,
            inference_records,
            config.upsert_limit,
            on_conflict="player_id,as_of_date,horizon_games",
        )
        print(f"Uploaded {len(inference_records)} inference predictions to {config.inference_table}")
    else:
        print("No inference predictions to upload")

    if holdout_records and config.holdout_table:
        upsert(
            client,
            config.holdout_table,
            holdout_records,
            config.upsert_limit,
            on_conflict="run_id,as_of_date,horizon_games,stat_key,model_name,player_id",
        )
        print(
            f"Uploaded {len(holdout_records)} holdout predictions to {config.holdout_table}"
        )
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
        print(f"Uploaded {len(metrics_records)} metric rows to {config.metrics_table}")
    else:
        print("No metric rows to upload")


if __name__ == "__main__":
    main()
