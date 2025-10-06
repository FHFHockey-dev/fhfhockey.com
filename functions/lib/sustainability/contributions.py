"""Metric contribution aggregation (Task 4.5 partial implementation).

Computes per-metric contribution:
    contrib_<metric> = weight_<metric> * r_<metric> * z_source
Where z_source is clipped z (zc_<metric>) if present else raw z_<metric>.

Adds:
  * contrib_<metric>
  * contrib_total (sum of available contrib_<metric>)

Does not yet perform logistic mapping or finishing residual integration (Tasks 4.6+).
"""
from __future__ import annotations

from typing import Iterable, Dict, Any, List


def compute_contributions(
    rows: Iterable[Dict[str, Any]],
    weights: Dict[str, float],
    metrics: Iterable[str],
    use_clipped: bool = True,
) -> List[Dict[str, Any]]:
    metrics = list(metrics)
    out: List[Dict[str, Any]] = []
    for r in rows:
        new_r = r.copy()
        total = 0.0
        for m in metrics:
            w = float(weights.get(m, 0.0))
            r_key = f"r_{m}"
            zc_key = f"zc_{m}"
            z_key = f"z_{m}"
            r_val = new_r.get(r_key)
            if r_val is None:
                new_r[f"contrib_{m}"] = None
                continue
            z_source = None
            if use_clipped and zc_key in new_r and new_r.get(zc_key) is not None:
                z_source = new_r.get(zc_key)
            else:
                z_source = new_r.get(z_key)
            if z_source is None:
                new_r[f"contrib_{m}"] = None
                continue
            contrib = w * r_val * z_source
            new_r[f"contrib_{m}"] = contrib
            total += contrib
        new_r["contrib_total"] = total
        out.append(new_r)
    return out


__all__ = ["compute_contributions"]
