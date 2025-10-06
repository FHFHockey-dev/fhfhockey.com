"""Soft clipping of z-scores (Task 4.4).

Applies a smooth saturation to extreme z values to reduce the influence of
outliers before contribution weighting. Formula:

    z_clipped = tanh(z / c)

Where c is a calibration constant (default from config.constants['c'], e.g. 3.0).
This keeps values in (-1, 1) and approximately linear near 0.

Adds fields `zc_<metric>` for each provided metric where an existing `z_<metric>`
is present. ("zc" = z clipped.) Leaves original z-values intact.
"""
from __future__ import annotations

from math import tanh
from typing import Iterable, Dict, Any, List, Iterable


def apply_soft_clipping(
    rows: Iterable[Dict[str, Any]],
    metrics: Iterable[str],
    c: float = 3.0,
) -> List[Dict[str, Any]]:
    if c <= 0:
        raise ValueError("c must be > 0 for soft clipping")
    metrics = list(metrics)
    out: List[Dict[str, Any]] = []
    for r in rows:
        new_r = r.copy()
        for m in metrics:
            z_key = f"z_{m}"
            target_key = f"zc_{m}"
            z_val = r.get(z_key)
            if z_val is None:
                new_r[target_key] = None
                continue
            try:
                new_r[target_key] = tanh(float(z_val) / c)
            except Exception:
                new_r[target_key] = None
        out.append(new_r)
    return out


__all__ = ["apply_soft_clipping"]
