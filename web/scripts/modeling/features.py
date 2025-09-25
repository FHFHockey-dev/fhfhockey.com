#!/usr/bin/env python3
"""Feature engineering utilities for the sKO prediction pipeline."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd

LOG = logging.getLogger(__name__)


ROLLING_BASE_METRICS = [
    "points",
    "goals",
    "assists",
    "shots",
    "pp_points",
    "sh_points",
    "hits",
    "blocked_shots",
    "toi_per_game",
]

SHARE_METRICS = [
    "es_goals_for_percentage",
    "goals_pct",
    "sat_pct",
    "nst_oi_cf_pct",
    "nst_oi_ff_pct",
    "nst_oi_sf_pct",
    "nst_oi_gf_pct",
]


DEFAULT_TARGET_METRICS = (
    "points",
    "goals",
    "assists",
    "pp_points",
    "shots",
    "hits",
    "blocked_shots",
)


@dataclass
class FeatureBuilderConfig:
    """Runtime configuration for feature extraction tasks."""

    db_url: Optional[str] = None
    input_path: Optional[Path] = None
    output_dir: Path = Path("web/scripts/output")
    as_of_date: Optional[date] = None
    lookback_days: Optional[int] = 365
    min_date: Optional[date] = None
    max_date: Optional[date] = None
    player_ids: Optional[tuple[int, ...]] = None
    horizon_games: int = 5
    windows: Iterable[int] = (5, 10, 20)
    cv_window: int = 10
    min_games: int = 15
    target_metrics: tuple[str, ...] = DEFAULT_TARGET_METRICS
    append: bool = False

    def primary_target(self) -> str:
        return self.target_metrics[0]

    def target_column(self, metric: Optional[str] = None) -> str:
        metric = metric or self.primary_target()
        return f"target_{metric}_next_{self.horizon_games}"


def extract_features(config: FeatureBuilderConfig) -> pd.DataFrame:
    """Pull raw inputs and compute modeling features."""

    raw_df = load_source_data(config)
    if raw_df.empty:
        raise ValueError("No rows returned from source data for feature extraction")

    processed = engineer_features(raw_df, config)
    target_columns = [config.target_column(metric) for metric in config.target_metrics]
    primary_target_col = config.target_column()
    processed = processed.dropna(subset=[primary_target_col])
    if processed.empty:
        raise ValueError("Feature set is empty after filtering for target availability")

    LOG.info("Feature set contains %s rows and %s columns", *processed.shape)
    return processed


def load_source_data(config: FeatureBuilderConfig) -> pd.DataFrame:
    """Load raw player-game rows from a parquet/CSV file or the database."""

    if config.input_path is not None:
        if not config.input_path.exists():
            raise FileNotFoundError(f"Configured input_path does not exist: {config.input_path}")
        LOG.info("Loading player stats from %s", config.input_path)
        if config.input_path.suffix == ".parquet":
            df = pd.read_parquet(config.input_path)
        else:
            df = pd.read_csv(config.input_path, parse_dates=["date"])
        return apply_local_filters(df, config)

    if not config.db_url:
        raise ValueError("Either db_url or input_path must be provided to FeatureBuilderConfig")

    try:
        import sqlalchemy as sa  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "sqlalchemy is required to load data via db_url; install it or provide input_path"
        ) from exc

    engine = sa.create_engine(config.db_url)
    as_of = config.as_of_date or date.today()
    start_date = config.min_date
    if start_date is None and config.lookback_days is not None:
        start_date = as_of - timedelta(days=config.lookback_days)
    end_date = config.max_date or as_of

    LOG.info("Querying player_stats_unified up to %s (start_date=%s)", as_of, start_date)
    where_clauses = [
        "(:start_date IS NULL OR date >= :start_date)",
        "(:end_date IS NULL OR date <= :end_date)",
    ]
    if config.player_ids:
        where_clauses.append("player_id = ANY(:player_ids)")

    query = sa.text(
        f"""
        SELECT *
        FROM player_stats_unified
        WHERE {' AND '.join(where_clauses)}
        ORDER BY player_id, date
        """
    )

    with engine.connect() as conn:
        df = pd.read_sql_query(
            query,
            conn,
            params={
                "start_date": start_date,
                "end_date": end_date,
                "player_ids": list(config.player_ids) if config.player_ids else None,
            },
        )

    return apply_local_filters(df, config)


def apply_local_filters(df: pd.DataFrame, config: FeatureBuilderConfig) -> pd.DataFrame:
    work = df.copy()
    if "date" in work.columns:
        work["date"] = pd.to_datetime(work["date"])
        if config.min_date:
            work = work[work["date"] >= pd.Timestamp(config.min_date)]
        if config.max_date:
            work = work[work["date"] <= pd.Timestamp(config.max_date)]
    if config.player_ids:
        work = work[work["player_id"].isin(config.player_ids)]
    return work


def engineer_features(df: pd.DataFrame, config: FeatureBuilderConfig) -> pd.DataFrame:
    """Derive modeling features from the raw player-game data."""

    work = df.copy()
    work["date"] = pd.to_datetime(work["date"])  # ensure datetime semantics
    work = work.sort_values(["player_id", "date"]).reset_index(drop=True)

    # Ensure games_played is present so density features behave.
    if "games_played" not in work.columns:
        work["games_played"] = 1
    work["games_played"] = work["games_played"].fillna(0)

    work = add_cumulative_counters(work)
    work = add_rolling_averages(work, config)
    work = add_variability_features(work, config)
    work = add_share_features(work)
    work = add_schedule_features(work)
    work = compute_targets(work, config)

    # Filter to rows with sufficient history prior to prediction horizon.
    work = work[work["games_played_cum"] >= config.min_games]
    target_columns = [
        config.target_column(metric)
        for metric in config.target_metrics
        if config.target_column(metric) in work.columns
    ]
    feature_cols = build_feature_column_list(work, target_columns)
    return work[feature_cols]


def add_cumulative_counters(df: pd.DataFrame) -> pd.DataFrame:
    """Append cumulative games played counters per skater."""

    df["games_played_cum"] = df.groupby("player_id")["games_played"].cumsum()
    df["season_game_number"] = (
        df.groupby(["player_id", "season_id"]).cumcount() + 1
    )
    return df


def add_rolling_averages(df: pd.DataFrame, config: FeatureBuilderConfig) -> pd.DataFrame:
    """Compute rolling means for key counting stats."""

    available_metrics = [m for m in ROLLING_BASE_METRICS if m in df.columns]
    for metric in available_metrics:
        for window in config.windows:
            col_name = f"{metric}_ma{window}"
            df[col_name] = (
                df.groupby("player_id")[metric]
                .transform(lambda s: s.rolling(window, min_periods=1).mean())
            )

    return df


def add_variability_features(df: pd.DataFrame, config: FeatureBuilderConfig) -> pd.DataFrame:
    """Add rolling standard deviation and coefficient of variation features."""

    metric = "points"
    if metric not in df.columns:
        return df

    window = config.cv_window

    def _rolling_stat(series: pd.Series) -> pd.Series:
        rolling = series.rolling(window, min_periods=max(2, window // 2))
        mean = rolling.mean()
        std = rolling.std()
        cv = std / (mean.abs() + 1e-6)
        return cv

    df[f"{metric}_cv{window}"] = (
        df.groupby("player_id")[metric].transform(_rolling_stat)
    )

    return df


def add_share_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create centered share metrics with positive/negative splits."""

    for metric in SHARE_METRICS:
        if metric not in df.columns:
            continue
        series = pd.to_numeric(df[metric], errors="coerce")
        if series.isna().all():
            continue
        # Heuristically detect if the metric is stored [0,1] or [0,100].
        finite = series.dropna()
        if finite.empty:
            continue
        baseline = 0.5
        if finite.abs().max() > 1.5:
            baseline = 50.0
        centered = series - baseline
        df[f"{metric}_centered"] = centered
        df[f"{metric}_pos"] = centered.clip(lower=0)
        df[f"{metric}_neg"] = centered.clip(upper=0).abs()

    return df


def add_schedule_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add schedule density and rest-related features."""

    def _per_player(group: pd.DataFrame) -> pd.DataFrame:
        player_id = group.name
        ordered = group.sort_values("date").copy()
        idx = pd.DatetimeIndex(ordered["date"], name="date")
        played = ordered["games_played"].fillna(0).clip(lower=0).astype(float)
        played_series = pd.Series(played.values, index=idx)
        ordered["games_last_7d"] = (
            played_series.rolling("7D", closed="left").sum().to_numpy()
        )
        ordered["games_last_14d"] = (
            played_series.rolling("14D", closed="left").sum().to_numpy()
        )
        ordered["days_since_last_game"] = ordered["date"].diff().dt.days.astype("float")
        ordered["back_to_back"] = (ordered["days_since_last_game"] <= 1).astype(float)
        ordered["player_id"] = player_id
        return ordered

    return df.groupby("player_id", group_keys=False).apply(
        _per_player, include_groups=False
    )


def compute_targets(df: pd.DataFrame, config: FeatureBuilderConfig) -> pd.DataFrame:
    """Compute next horizon totals for each requested metric."""

    horizon = config.horizon_games

    def _future_sum(series: pd.Series) -> pd.Series:
        shifted = series.shift(-1)
        return (
            shifted.rolling(window=horizon, min_periods=horizon).sum().astype(float)
        )

    for metric in config.target_metrics:
        if metric not in df.columns:
            LOG.debug("Skipping target %s; column missing", metric)
            continue
        target_col = config.target_column(metric)
        df[target_col] = df.groupby("player_id")[metric].transform(_future_sum)
    return df


def build_feature_column_list(df: pd.DataFrame, target_cols: Iterable[str]) -> list[str]:
    """Return an ordered list of identifier, feature, and target columns."""

    id_columns = [
        col
        for col in ["player_id", "date", "season_id", "team_id", "games_played_cum"]
        if col in df.columns
    ]
    feature_columns = sorted(
        {
            col
            for col in df.columns
            if col not in id_columns and col not in target_cols and not col.startswith("Unnamed")
        }
    )
    return id_columns + feature_columns + list(target_cols)


def persist_features(df: pd.DataFrame, config: FeatureBuilderConfig) -> Path:
    """Write the engineered dataset to disk for downstream training."""

    config.output_dir.mkdir(parents=True, exist_ok=True)
    output_path = config.output_dir / "sko_features.parquet"
    if config.append and output_path.exists():
        existing = pd.read_parquet(output_path)
        combined = pd.concat([existing, df], ignore_index=True)
        if "date" in combined.columns:
            combined.sort_values(["player_id", "date"], inplace=True)
        combined = combined.drop_duplicates(subset=["player_id", "date"], keep="last")
        df = combined
    df.to_parquet(output_path, index=False)
    return output_path


def parse_windows(env_value: Optional[str], fallback: Iterable[int]) -> Iterable[int]:
    if not env_value:
        return fallback
    parsed: list[int] = []
    for part in env_value.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            parsed.append(int(part))
        except ValueError:
            LOG.warning("Ignoring invalid window value: %s", part)
    return tuple(parsed) if parsed else fallback


def parse_optional_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    value = value.strip()
    if not value or value.lower() == "none":
        return None
    try:
        return int(value)
    except ValueError:
        LOG.warning("Ignoring invalid integer value: %s", value)
        return None


def parse_metrics(value: Optional[str], fallback: Iterable[str]) -> tuple[str, ...]:
    if not value:
        return tuple(fallback)
    parsed = tuple(filter(None, (part.strip() for part in value.split(","))))
    return parsed or tuple(fallback)


def load_env_files(paths: Iterable[Path]) -> None:
    """Best-effort parser for .env style files without extra dependencies."""

    for path in paths:
        if not path.exists():
            continue
        for raw_line in path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def main() -> None:
    """Entry point for CLI usage."""

    logging.basicConfig(level=logging.INFO)

    load_env_files(
        [
            Path(".env"),
            Path(".env.local"),
            Path("web/.env"),
            Path("web/.env.local"),
        ]
    )
    env = os.environ

    input_path_env = env.get("SKO_FEATURE_INPUT_PATH")
    input_path = Path(input_path_env).expanduser() if input_path_env else None

    as_of_env = env.get("SKO_FEATURE_AS_OF_DATE")
    as_of_date = None
    if as_of_env:
        as_of_date = pd.to_datetime(as_of_env).date()

    lookback_days = parse_optional_int(env.get("SKO_FEATURE_LOOKBACK_DAYS"))
    horizon_games = parse_optional_int(env.get("SKO_FEATURE_HORIZON")) or 5
    cv_window = parse_optional_int(env.get("SKO_FEATURE_CV_WINDOW")) or 10
    target_metrics = parse_metrics(env.get("SKO_FEATURE_TARGETS"), DEFAULT_TARGET_METRICS)
    windows = parse_windows(env.get("SKO_FEATURE_WINDOWS"), (5, 10, 20))

    min_date_env = env.get("SKO_FEATURE_MIN_DATE")
    min_date = pd.to_datetime(min_date_env).date() if min_date_env else None
    max_date_env = env.get("SKO_FEATURE_MAX_DATE")
    max_date = pd.to_datetime(max_date_env).date() if max_date_env else None

    player_ids_env = env.get("SKO_FEATURE_PLAYER_IDS")
    player_ids: Optional[tuple[int, ...]] = None
    if player_ids_env:
        parsed_ids: list[int] = []
        for token in player_ids_env.split(","):
            token = token.strip()
            if not token:
                continue
            try:
                parsed_ids.append(int(token))
            except ValueError:
                LOG.warning("Ignoring invalid player id: %s", token)
        if parsed_ids:
            player_ids = tuple(sorted(set(parsed_ids)))

    append_flag = env.get("SKO_FEATURE_APPEND", "false").lower() in {"1", "true", "yes"}

    config_kwargs = {
        "db_url": env.get("DATABASE_URL") or env.get("SUPABASE_DB_URL"),
        "input_path": input_path,
        "as_of_date": as_of_date,
        "horizon_games": horizon_games,
        "windows": windows,
        "cv_window": cv_window,
        "target_metrics": target_metrics,
        "min_date": min_date,
        "max_date": max_date,
        "player_ids": player_ids,
        "append": append_flag,
    }
    if lookback_days is not None:
        config_kwargs["lookback_days"] = lookback_days

    config = FeatureBuilderConfig(**config_kwargs)
    dataset = extract_features(config)
    output_path = persist_features(dataset, config)
    print(f"Features saved to {output_path}")


if __name__ == "__main__":
    main()
