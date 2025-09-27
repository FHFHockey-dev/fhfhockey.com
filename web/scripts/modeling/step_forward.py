#!/usr/bin/env python3
"""Simulate day-by-day incremental training updates and record timings.

Enhancements:
    * Auto-range mode (SKO_STEP_AUTORANGE=1): derive start/end from data if not provided.
        - Start: if predictions exist and not reset, resume from latest base_as_of_date; else min(game_date)-pad.
        - End: max(game_date)+1 day (exclusive) unless explicitly supplied.
    * Reset mode (SKO_STEP_RESET=1): ignore existing predictions and rebuild from scratch.
    * Skip-existing (SKO_STEP_SKIP_EXISTING=1): do not re-run a day if a base run already exists.
    * Start padding days configurable (SKO_STEP_START_PAD_DAYS, default=1) to generate first forecast_value=1 for earliest game date.
    * More robust latest base detection (uses base_as_of_date on forecast_value=1 rows rather than max(as_of_date)).
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable, List, Optional

import pandas as pd
import sqlalchemy as sa

from features import FeatureBuilderConfig, load_source_data, load_env_files

BASE_OUTPUT_DIR = Path("web/scripts/output")
STEP_DB_URL: Optional[str] = None


@dataclass
class StepConfig:
    start_date: date
    end_date: date
    horizon_games: int = 5
    forecast_days: int = 5
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


def fetch_latest_base_date(db_url: str | None) -> Optional[date]:
    """Return the latest base_as_of_date that produced forecast_value=1 predictions.

    Using base_as_of_date instead of max(as_of_date) avoids jumping ahead due to future horizon rows.
    """
    if not db_url:
        return None
    try:
        engine = sa.create_engine(db_url)
        with engine.connect() as conn:
            result = conn.execute(
                sa.text(
                    """
                    SELECT max(base_as_of_date)
                    FROM predictions_sko
                    WHERE forecast_scope='day'
                      AND forecast_value=1
                      AND stat_key='points'
                      AND base_as_of_date IS NOT NULL
                    """
                )
            )
            raw = result.scalar()
            if raw is None:
                return None
            return raw if isinstance(raw, date) else date.fromisoformat(str(raw))
    except Exception as exc:  # pragma: no cover
        print(f"Warning: unable to determine latest base date: {exc}")
        return None


def fetch_game_date_bounds(db_url: str | None) -> tuple[Optional[date], Optional[date]]:
    if not db_url:
        return (None, None)
    try:
        engine = sa.create_engine(db_url)
        with engine.connect() as conn:
            res = conn.execute(
                sa.text("SELECT min(date) as min_d, max(date) as max_d FROM player_stats_unified")
            ).first()
            if not res:
                return (None, None)
            min_d, max_d = res[0], res[1]
            if min_d and not isinstance(min_d, date):
                min_d = date.fromisoformat(str(min_d))
            if max_d and not isinstance(max_d, date):
                max_d = date.fromisoformat(str(max_d))
            return (min_d, max_d)
    except Exception as exc:  # pragma: no cover
        print(f"Warning: unable to determine game date bounds: {exc}")
        return (None, None)


def base_run_exists(db_url: str | None, base_date: date) -> bool:
    if not db_url:
        return False
    try:
        engine = sa.create_engine(db_url)
        with engine.connect() as conn:
            res = conn.execute(
                sa.text(
                    """
                    SELECT 1 FROM predictions_sko
                    WHERE base_as_of_date=:d
                      AND forecast_scope='day'
                      AND forecast_value=1
                      AND stat_key='points'
                    LIMIT 1
                    """
                ),
                {"d": base_date.isoformat()},
            ).first()
            return res is not None
    except Exception as exc:  # pragma: no cover
        print(f"Warning: unable to test existing base run for {base_date}: {exc}")
        return False


def step_forward(config: StepConfig) -> list[StepStats]:
    stats: list[StepStats] = []
    current = config.start_date
    env_base = os.environ.copy()

    while current < config.end_date:
        next_day = current + timedelta(days=1)
        player_ids = gather_players_for_date(current)
        if not player_ids:
            current = next_day
            continue

        env = env_base.copy()
        history_start = current - timedelta(days=config.lookback_days)
        env["SKO_FEATURE_MIN_DATE"] = history_start.isoformat()
        env["SKO_FEATURE_MAX_DATE"] = current.isoformat()
        env["SKO_FEATURE_AS_OF_DATE"] = current.isoformat()
        env["SKO_FEATURE_APPEND"] = "true" if config.append else "false"
        env["SKO_FEATURE_LOOKBACK_DAYS"] = str(config.lookback_days)
        env["SKO_FEATURE_PLAYER_IDS"] = ",".join(map(str, player_ids))
        env["SKO_FEATURE_TARGET_MODE"] = "days"
        env["SKO_FEATURE_FORECAST_DAYS"] = str(config.forecast_days)
        env["SKO_FEATURE_HORIZON"] = str(config.forecast_days)
        if config.db_url:
            env.setdefault("DATABASE_URL", config.db_url)
            env.setdefault("SUPABASE_DB_URL", config.db_url)

        env["SKO_TRAIN_AS_OF_DATE"] = current.isoformat()
        env["SKO_TRAIN_TARGET_MODE"] = "days"
        env["SKO_TRAIN_FORECAST_DAYS"] = str(config.forecast_days)
        env["SKO_TRAIN_HORIZON"] = str(config.forecast_days)

        try:
            feature_time = run_cmd(["web/scripts/modeling/features.py"], env)
            train_time = run_cmd(["web/scripts/modeling/train.py"], env)

            env["SKO_SCORE_BASE_AS_OF_DATE"] = current.isoformat()
            env["SKO_SCORE_TARGET_MODE"] = "days"
            env["SKO_SCORE_FORECAST_DAYS"] = str(config.forecast_days)
            score_time = run_cmd(["web/scripts/modeling/score.py"], env)

            env["SKO_UPLOAD_INCLUDE_HOLDOUT"] = os.getenv(
                "SKO_UPLOAD_INCLUDE_HOLDOUT",
                "true"
            )
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
    autorange = os.getenv("SKO_STEP_AUTORANGE", "0").lower() in {"1", "true", "yes"}
    reset = os.getenv("SKO_STEP_RESET", "0").lower() in {"1", "true", "yes"}
    skip_existing = os.getenv("SKO_STEP_SKIP_EXISTING", "0").lower() in {"1", "true", "yes"}
    start_pad_days = int(os.getenv("SKO_STEP_START_PAD_DAYS", "1"))

    start_env = os.getenv("SKO_STEP_START")
    end_env = os.getenv("SKO_STEP_END")

    latest_base = None if reset else fetch_latest_base_date(STEP_DB_URL)
    min_game, max_game = fetch_game_date_bounds(STEP_DB_URL) if autorange else (None, None)

    if start_env:
        start_date = date.fromisoformat(start_env)
    elif autorange:
        if latest_base and not reset:
            # Resume exactly at the latest base (loop uses while current < end, so this base runs again unless skip flag) 
            start_date = latest_base
        elif min_game:
            start_date = min_game - timedelta(days=start_pad_days)
        else:
            start_date = date.fromisoformat("2025-01-05")
    else:
        if latest_base and not reset:
            start_date = latest_base
        else:
            start_date = date.fromisoformat("2025-01-05")

    if end_env:
        end_date = date.fromisoformat(end_env)
    elif autorange and max_game:
        # exclusive upper bound: +1 to ensure last game gets a base run the day before
        end_date = max_game + timedelta(days=1)
    else:
        end_date = start_date + timedelta(days=int(os.getenv("SKO_STEP_DAYS", "1")))

    horizon = int(os.getenv("SKO_STEP_HORIZON", "5"))
    lookback = int(os.getenv("SKO_STEP_LOOKBACK", "365"))

    print(f"[step-forward] advancing from {start_date} to {end_date}")

    # Wrapper around original loop to optionally skip existing base days.
    base_config = StepConfig(
        start_date=start_date,
        end_date=end_date,
        horizon_games=horizon,
        forecast_days=horizon,
        append=True,
        lookback_days=lookback,
        db_url=STEP_DB_URL,
    )

    if not skip_existing:
        stats = step_forward(base_config)
    else:
        # Custom loop reproducing step_forward with existence test per day
        stats: list[StepStats] = []
        current = base_config.start_date
        while current < base_config.end_date:
            if base_run_exists(STEP_DB_URL, current):
                print(f"[skip] base_as_of_date {current} already present (forecast_value=1)")
                current += timedelta(days=1)
                continue
            day_stats = step_forward(
                StepConfig(
                    start_date=current,
                    end_date=current + timedelta(days=1),
                    horizon_games=base_config.horizon_games,
                    forecast_days=base_config.forecast_days,
                    append=base_config.append,
                    lookback_days=base_config.lookback_days,
                    db_url=base_config.db_url,
                )
            )
            stats.extend(day_stats)
            current += timedelta(days=1)

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
