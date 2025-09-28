"""Logistic scoring & components packaging (Task 4.7: A).

Takes rows with contribution totals and produces:
  * score_raw: probability-like value in (0,1) after guardrails
  * score: 0–100 integer scaled from score_raw
  * components_json: per-metric diagnostic payload (optional builder)

Formula:
    p = 1 / (1 + exp(-contrib_total))
Then apply guardrails (lower_raw, upper_raw) from config:
    p_g = lower + (upper - lower) * p

Finally score = round(100 * p_g).
"""
from __future__ import annotations

from math import exp
from typing import Iterable, Dict, Any, List, Iterable


def logistic(x: float) -> float:
    # Stable logistic for moderate x (contrib values expected modest due to clipping/weights)
    try:
        if x >= 0:
            z = exp(-x)
            return 1.0 / (1.0 + z)
        else:
            z = exp(x)
            return z / (1.0 + z)
    except OverflowError:  # pragma: no cover (extreme safeguard)
        return 0.0 if x < 0 else 1.0


def apply_logistic_scoring(
    rows: Iterable[Dict[str, Any]],
    guardrails: Dict[str, float],
    scale: int = 100,
    contrib_field: str = "contrib_total",
    score_raw_field: str = "score_raw",
    score_field: str = "score",
) -> List[Dict[str, Any]]:
    lower = float(guardrails.get("lower_raw", 0.01))
    upper = float(guardrails.get("upper_raw", 0.99))
    if not (0 < lower < upper < 1):  # safety fallback
        lower, upper = 0.01, 0.99
    span = upper - lower
    out: List[Dict[str, Any]] = []
    for r in rows:
        new_r = r.copy()
        contrib = new_r.get(contrib_field)
        if contrib is None:
            new_r[score_raw_field] = None
            new_r[score_field] = None
            out.append(new_r)
            continue
        p = logistic(float(contrib))
        p_g = lower + span * p
        if p_g < 0:
            p_g = 0.0
        elif p_g > 1:
            p_g = 1.0
        new_r[score_raw_field] = p_g
        new_r[score_field] = int(round(scale * p_g))
        if new_r[score_field] < 0:
            new_r[score_field] = 0
        elif new_r[score_field] > scale:
            new_r[score_field] = scale
        out.append(new_r)
    return out


def build_components_json(
    row: Dict[str, Any],
    metrics: Iterable[str],
    weights: Dict[str, float],
    include_missing: bool = False,
) -> Dict[str, Any]:
    comp: Dict[str, Any] = {}
    for m in metrics:
        z = row.get(f"z_{m}")
        zc = row.get(f"zc_{m}")
        r_val = row.get(f"r_{m}")
        contrib = row.get(f"contrib_{m}")
        if not include_missing and (contrib is None and r_val is None and z is None):
            continue
        comp[m] = {
            "weight": weights.get(m),
            "z": z,
            "zc": zc,
            "r": r_val,
            "contrib": contrib,
        }
    return comp


def attach_components_json(
    rows: Iterable[Dict[str, Any]],
    metrics: Iterable[str],
    weights: Dict[str, float],
    field_name: str = "components_json",
    include_missing: bool = False,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        new_r = r.copy()
        new_r[field_name] = build_components_json(new_r, metrics, weights, include_missing=include_missing)
        out.append(new_r)
    return out


__all__ = [
    "apply_logistic_scoring",
    "build_components_json",
    "attach_components_json",
]
