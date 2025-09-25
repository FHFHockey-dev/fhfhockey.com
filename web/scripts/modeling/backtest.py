#!/usr/bin/env python3
"""Backtesting scaffolding for sKO modeling."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pandas as pd


@dataclass
class BacktestConfig:
    """Parameters controlling the rolling backtest routine."""

    features_path: Path = Path("web/scripts/output/sko_features.parquet")
    model_dir: Path = Path("web/scripts/output/models")
    report_path: Path = Path("web/scripts/output/backtest_report.md")
    evaluation_start: str = "2025-01-01"
    evaluation_end: Optional[str] = None
    horizon_games: int = 5


def load_features(config: BacktestConfig) -> pd.DataFrame:
    """Load feature data required for backtesting."""

    return pd.read_parquet(config.features_path)


def run_backtest(df: pd.DataFrame, config: BacktestConfig) -> dict[str, float]:
    """Execute the rolling backtest and return summary metrics."""

    raise NotImplementedError("Backtest routine not yet implemented")


def write_report(metrics: dict[str, float], config: BacktestConfig) -> Path:
    """Persist a simple markdown report summarizing performance."""

    report_lines = ["# sKO Backtest Report", "", *[f"- {k}: {v}" for k, v in metrics.items()]]
    config.report_path.parent.mkdir(parents=True, exist_ok=True)
    config.report_path.write_text("\n".join(report_lines), encoding="utf-8")
    return config.report_path


def main() -> None:
    """Entry point for running the backtest."""

    config = BacktestConfig()
    dataset = load_features(config)
    metrics = run_backtest(dataset, config)
    report_path = write_report(metrics, config)
    print(f"Backtest report written to {report_path}")


if __name__ == "__main__":
    main()
