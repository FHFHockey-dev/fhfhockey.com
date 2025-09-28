"""Reliability weighting (Task 4.3).

Computes reliability factor r for each (player, window, metric) based on
effective sample size n and calibration constant k_r[metric]:

    r = sqrt( n / (n + k_r) )

Where:
  * n for binomial rate metrics is the trials count in the window
    (shots for sh_pct, on-ice shots for oish_pct, on-ice goals for ipp)
  * We cap n >= 0 and if k_r <= 0 fall back to r=1 (fully trusted).

The reliability factor will later scale each standardized deviation (z-score)
before contribution weighting & logistic scoring.
"""
from __future__ import annotations

from math import sqrt
from typing import Iterable, Dict, Any, List

RELIABILITY_METRICS = {
    "sh_pct": "shots",          # trials denominator
    "oish_pct": "onice_shots_for",
    "ipp": "onice_goals_for",   # IPP denominator (on-ice GF)
}


def compute_reliability(
    windows: Iterable[Dict[str, Any]],
    k_r: Dict[str, int | float],
    metrics: Iterable[str] | None = None,
    attach: bool = True,
) -> List[Dict[str, Any]]:
    """Annotate or compute reliability factors for each window.

    Parameters:
      windows: iterable of window dicts (mutability: we copy each row).
      k_r: mapping metric->k constant from config.
      metrics: optional subset; defaults to RELIABILITY_METRICS keys.
      attach: when True returns rows with added keys r_<metric> else returns rows with only reliability keys.

    Returns: new list of rows (copies) including r_<metric> fields.
    """
    if metrics is None:
        metrics = RELIABILITY_METRICS.keys()
    metrics = [m for m in metrics if m in RELIABILITY_METRICS]
    out: List[Dict[str, Any]] = []
    for row in windows:
        new_row = row.copy() if attach else {"player_id": row.get("player_id"), "window_type": row.get("window_type"), "game_date": row.get("game_date")}
        for metric in metrics:
            trials_field = RELIABILITY_METRICS[metric]
            trials_val = row.get(trials_field)
            k_val = float(k_r.get(metric, 0))
            if trials_val is None or trials_val < 0:
                trials_val = 0
            if k_val <= 0:
                r = 1.0 if trials_val > 0 else 0.0
            else:
                r = sqrt(trials_val / (trials_val + k_val)) if (trials_val + k_val) > 0 else 0.0
            new_row[f"r_{metric}"] = r
        out.append(new_row)
    return out


__all__ = ["compute_reliability", "RELIABILITY_METRICS"]
