#!/usr/bin/env python3
"""Simulate day-by-day incremental training updates and record timings."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable, List, Optional

import pandas as pd

from features import FeatureBuilderConfig, load_source_data, load_env_files

BASE_OUTPUT_DIR = Path("web/scripts/output")
STEP_DB_URL: Optional[str] = None


@dataclass
class StepConfig:
    start_date: date
    end_date: date
    horizon_games: int = 5
    append: bool = True
    lookback_days: int = 365
    db_url: Optional[str] = None


@dataclass
class StepStats:
    as_of_date: date
    num_players: int
    feature_time: float
    train_time: float
    score_time: float
    upload_time: float


COMMAND_PREFIX = [".venv/bin/python"]


def run_cmd(args: List[str], env: dict[str, str]) -> float:
    start = time.perf_counter()
    process = os.spawnvpe(os.P_WAIT, COMMAND_PREFIX[0], COMMAND_PREFIX + args, env)
    if process != 0:
        raise RuntimeError(f"Command {' '.join(args)} failed with exit code {process}")
    return time.perf_counter() - start


def gather_players_for_date(target_date: date) -> list[int]:
    if STEP_DB_URL is None:
        raise RuntimeError("STEP_DB_URL is not configured")
    config = FeatureBuilderConfig(
        min_date=target_date,
        max_date=target_date,
        lookback_days=None,
        db_url=STEP_DB_URL,
    )
    df = load_source_data(config)
    if df.empty:
        return []
    return sorted(df["player_id"].dropna().astype(int).unique().tolist())


def step_forward(config: StepConfig) -> list[StepStats]:
    stats: list[StepStats] = []
    current = config.start_date
    env_base = os.environ.copy()

    while current < config.end_date:
        next_day = current + timedelta(days=1)
        player_ids = gather_players_for_date(next_day)
        if not player_ids:
            current = next_day
            continue

        env = env_base.copy()
        env["SKO_FEATURE_MIN_DATE"] = current.isoformat()
        env["SKO_FEATURE_APPEND"] = "true" if config.append else "false"
        env["SKO_FEATURE_LOOKBACK_DAYS"] = str(config.lookback_days)
        env["SKO_FEATURE_PLAYER_IDS"] = ",".join(map(str, player_ids))
        if config.db_url:
            env.setdefault("DATABASE_URL", config.db_url)
            env.setdefault("SUPABASE_DB_URL", config.db_url)

        try:
            feature_time = run_cmd(["web/scripts/modeling/features.py"], env)
            train_time = run_cmd(["web/scripts/modeling/train.py"], env)

            env["SKO_SCORE_AS_OF_DATE"] = next_day.isoformat()
            env["SKO_SCORE_HORIZON"] = str(config.horizon_games)
            score_time = run_cmd(["web/scripts/modeling/score.py"], env)

            upload_time = run_cmd(["web/scripts/modeling/upload_predictions.py"], env)
        except RuntimeError as exc:
            print(f"Skipping {next_day} due to error: {exc}")
            current = next_day
            continue

        stats.append(
            StepStats(
                as_of_date=next_day,
                num_players=len(player_ids),
                feature_time=feature_time,
                train_time=train_time,
                score_time=score_time,
                upload_time=upload_time,
            )
        )

        current = next_day

    return stats


def persist_stats(stats: Iterable[StepStats], path: Path) -> Path:
    df = pd.DataFrame(
        [
            {
                "as_of_date": s.as_of_date,
                "num_players": s.num_players,
                "feature_time": s.feature_time,
                "train_time": s.train_time,
                "score_time": s.score_time,
                "upload_time": s.upload_time,
                "total_time": s.feature_time + s.train_time + s.score_time + s.upload_time,
            }
            for s in stats
        ]
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    return path


def main() -> None:
    load_env_files([
        Path(".env"),
        Path(".env.local"),
        Path("web/.env"),
        Path("web/.env.local"),
    ])

    global STEP_DB_URL
    STEP_DB_URL = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not STEP_DB_URL:
        raise RuntimeError("DATABASE_URL or SUPABASE_DB_URL must be set for step simulation")
    start_date = date.fromisoformat(os.getenv("SKO_STEP_START", "2025-01-01"))
    end_date = date.fromisoformat(os.getenv("SKO_STEP_END", "2025-01-05"))
    horizon = int(os.getenv("SKO_STEP_HORIZON", "5"))
    lookback = int(os.getenv("SKO_STEP_LOOKBACK", "365"))

    stats = step_forward(
        StepConfig(
            start_date=start_date,
            end_date=end_date,
            horizon_games=horizon,
            append=True,
            lookback_days=lookback,
            db_url=STEP_DB_URL,
        )
    )

    output_path = BASE_OUTPUT_DIR / "sko_step_timings.csv"
    persist_stats(stats, output_path)
    for s in stats:
        print(
            f"{s.as_of_date}: {s.num_players} players | features {s.feature_time:.2f}s | "
            f"train {s.train_time:.2f}s | score {s.score_time:.2f}s | upload {s.upload_time:.2f}s"
        )
    print(f"Timings written to {output_path}")


if __name__ == "__main__":
    main()
