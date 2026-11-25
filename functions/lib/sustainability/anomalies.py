"""Summarize anomaly diagnostics in scored offline windows."""

from __future__ import annotations

from typing import Any, Iterable


def compute_anomaly_stats(
    rows: Iterable[dict[str, Any]],
    extreme_threshold: float,
    clip_saturation_threshold: float = 0.98,
) -> dict[str, int | float]:
    """Count extreme raw z values and saturated clips across component objects."""
    total_components = 0
    extreme_raw_z = 0
    clip_saturation = 0
    for row in rows:
        components = row.get("components_json")
        if not isinstance(components, dict):
            continue
        for component in components.values():
            if not isinstance(component, dict):
                continue
            total_components += 1
            z = component.get("z")
            zc = component.get("zc")
            if isinstance(z, (int, float)) and abs(z) >= extreme_threshold:
                extreme_raw_z += 1
            if isinstance(zc, (int, float)) and abs(zc) >= clip_saturation_threshold:
                clip_saturation += 1
    return {
        "total_components": total_components,
        "extreme_raw_z": extreme_raw_z,
        "clip_saturation": clip_saturation,
        "pct_extreme": extreme_raw_z / total_components if total_components else 0.0,
        "pct_clip_saturation": clip_saturation / total_components if total_components else 0.0,
    }
