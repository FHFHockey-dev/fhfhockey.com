"""Anomaly & extreme metrics (Task 5.8).

Computes summary statistics over scored window rows to support
operational monitoring and drift detection.

Definitions:
  * extreme_raw_z: count of component entries where |z| >= extreme_threshold.
  * clip_saturation: count where |zc| >= clip_saturation_threshold (default 0.98).

Input rows are expected to have components_json (dict of metric_code -> details)
when include_components=True was used. If components_json absent, returns zeros.
"""
from __future__ import annotations

from typing import Iterable, Dict, Any


def compute_anomaly_stats(
    rows: Iterable[Dict[str, Any]],
    extreme_threshold: float,
    clip_saturation_threshold: float = 0.98,
) -> Dict[str, Any]:
    total_components = 0
    extreme_count = 0
    clip_sat_count = 0
    for r in rows:
        comps = r.get("components_json")
        if not isinstance(comps, dict):
            continue
        for m, payload in comps.items():
            if not isinstance(payload, dict):
                continue
            z = payload.get("z")
            zc = payload.get("zc")
            if isinstance(z, (int, float)) and abs(z) >= extreme_threshold:
                extreme_count += 1
            if isinstance(zc, (int, float)) and abs(zc) >= clip_saturation_threshold:
                clip_sat_count += 1
            total_components += 1
    if total_components == 0:
        return {
            "total_components": 0,
            "extreme_raw_z": 0,
            "clip_saturation": 0,
            "pct_extreme": 0.0,
            "pct_clip_saturation": 0.0,
        }
    return {
        "total_components": total_components,
        "extreme_raw_z": extreme_count,
        "clip_saturation": clip_sat_count,
        "pct_extreme": extreme_count / total_components,
        "pct_clip_saturation": clip_sat_count / total_components,
    }


__all__ = ["compute_anomaly_stats"]