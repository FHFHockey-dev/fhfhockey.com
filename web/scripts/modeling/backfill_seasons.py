#!/usr/bin/env python3
"""Incremental season backfill pipeline for sKO features."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd

from features import (
    FeatureBuilderConfig,
    extract_features,
    load_env_files,
    persist_features,
)

STATE_PATH = Path("web/scripts/output/sko_backfill_state.json")
SEASON_OUTPUT_DIR = Path("web/scripts/output/seasons")
DEFAULT_SEASONS = (
    "20222023",
    "20232024",
    "20242025",
)


@dataclass
class BackfillState:
    processed: list[str]
    last_updated: Optional[str] = None

    @classmethod
    def load(cls) -> "BackfillState":
        if STATE_PATH.exists():
            data = json.loads(STATE_PATH.read_text())
            processed = [str(val) for val in data.get("processed", [])]
            return cls(processed=processed, last_updated=data.get("last_updated"))
        return cls(processed=[])

    def mark_complete(self, season_id: str) -> None:
        if season_id not in self.processed:
            self.processed.append(season_id)
        self.last_updated = datetime.now(UTC).isoformat()
        STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        STATE_PATH.write_text(
            json.dumps(
                {
                    "processed": self.processed,
                    "last_updated": self.last_updated,
                },
                indent=2,
            )
        )


def choose_next_season(candidate_seasons: Iterable[str], state: BackfillState) -> Optional[str]:
    for season in candidate_seasons:
        if season not in state.processed:
            return season
    return None


def _season_bounds(season_id: str) -> tuple[datetime | None, datetime | None]:
    if len(season_id) != 8:
        return None, None
    start_year = int(season_id[:4])
    end_year = int(season_id[4:])
    start = datetime(start_year, 7, 1)
    end = datetime(end_year, 7, 1)
    return start, end


def build_features_for_season(season_id: str, append: bool = True) -> Path:
    min_date, max_date = _season_bounds(season_id)
    config = FeatureBuilderConfig(
        append=append,
        lookback_days=None,
        min_date=min_date.date() if min_date else None,
        max_date=max_date.date() if max_date else None,
        db_url=os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL"),
    )
    dataset = extract_features(config)

    SEASON_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    season_path = SEASON_OUTPUT_DIR / f"sko_features_{season_id}.parquet"
    dataset.to_parquet(season_path, index=False)

    persist_features(dataset, config)
    return season_path


def main() -> None:
    load_env_files(
        [
            Path(".env"),
            Path(".env.local"),
            Path("web/.env"),
            Path("web/.env.local"),
        ]
    )

    env_seasons = os.environ.get("SKO_BACKFILL_SEASONS")
    if env_seasons:
        seasons: list[str] = []
        for token in env_seasons.split(","):
            token = token.strip()
            if not token:
                continue
            seasons.append(token)
        candidate_seasons = tuple(seasons)
    else:
        candidate_seasons = DEFAULT_SEASONS

    if not candidate_seasons:
        raise ValueError("No seasons specified for backfill")

    state = BackfillState.load()
    next_season = choose_next_season(candidate_seasons, state)
    if next_season is None:
        print("All seasons listed in SKO_BACKFILL_SEASONS have already been processed.")
        return

    print(f"[sKO] Backfilling season {next_season}...")
    season_path = build_features_for_season(next_season)
    state.mark_complete(next_season)

    preview = pd.read_parquet(season_path)
    if not preview.empty:
        min_date = preview["date"].min()
        max_date = preview["date"].max()
        rows = len(preview)
    else:
        min_date = max_date = None
        rows = 0

    message = (
        f"Season {next_season} processed: {rows} rows spanning "
        f"{min_date} → {max_date}. Persisted to {season_path} and appended to master features."
    )
    print(message)


if __name__ == "__main__":
    main()
