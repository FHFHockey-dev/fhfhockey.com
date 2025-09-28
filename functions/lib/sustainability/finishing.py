"""Finishing residual metric annotation (Task 4.8).

Derives finishing residual metrics from window aggregates (goals vs expected goals proxy ixg):

  finish_res_cnt  = goals - ixg
  finish_res_rate = (goals - ixg) / shots   (if shots > 0)

Expectation baseline assumed 0 (no systematic over/under performance), so:
  delta_finish_res_cnt  == finish_res_cnt
  delta_finish_res_rate == finish_res_rate
  exp_* fields set to 0 for consistency with other z-score annotated metrics.

Standardization uses SD constants (per position) from sd_constants mapping. If SD missing or <=0
z-values are left as None. Reliability factors r_finish_res_* are set to 1.0 when the underlying
metric value is not None, else 0.0 (acts as stabilizer-style metric with full trust of observed).

Safeguards:
  * Division by zero for rate variant handled (returns None if shots <= 0)
  * ixg coerced to float; goals & shots coerced to numeric with defaults 0

Outputs (added to each row where applicable):
  finish_res_cnt, finish_res_rate,
  delta_finish_res_cnt, delta_finish_res_rate,
  exp_finish_res_cnt, exp_finish_res_rate (always 0),
  z_finish_res_cnt, z_finish_res_rate,
  r_finish_res_cnt, r_finish_res_rate

Design note: Keep this isolated so future alternative expected-goals model integrations only
modify this module while downstream scoring remains unchanged.
"""
from __future__ import annotations

from typing import Iterable, Dict, Any, List

FINISHING_COUNT_METRIC = "finish_res_cnt"
FINISHING_RATE_METRIC = "finish_res_rate"
FINISHING_METRICS = [FINISHING_RATE_METRIC, FINISHING_COUNT_METRIC]


def annotate_finishing_residuals(
    rows: Iterable[Dict[str, Any]],
    sd_constants: Dict[str, Dict[str, float]],
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        new_r = r.copy()
        goals = new_r.get("goals") or 0
        ixg = float(new_r.get("ixg") or 0.0)
        shots = new_r.get("shots") or 0
        pos = new_r.get("position_code") or "F"

        # Count residual
        res_cnt = goals - ixg
        new_r[FINISHING_COUNT_METRIC] = res_cnt
        new_r[f"delta_{FINISHING_COUNT_METRIC}"] = res_cnt
        new_r[f"exp_{FINISHING_COUNT_METRIC}"] = 0.0
        sd_cnt = sd_constants.get(FINISHING_COUNT_METRIC, {}).get(pos)
        if sd_cnt and sd_cnt > 0:
            new_r[f"z_{FINISHING_COUNT_METRIC}"] = res_cnt / sd_cnt
        else:
            new_r[f"z_{FINISHING_COUNT_METRIC}"] = None

        # Rate residual
        if shots > 0:
            res_rate = res_cnt / shots
        else:
            res_rate = None
        new_r[FINISHING_RATE_METRIC] = res_rate
        new_r[f"delta_{FINISHING_RATE_METRIC}"] = res_rate
        new_r[f"exp_{FINISHING_RATE_METRIC}"] = 0.0 if res_rate is not None else None
        sd_rate = sd_constants.get(FINISHING_RATE_METRIC, {}).get(pos)
        if res_rate is not None and sd_rate and sd_rate > 0:
            new_r[f"z_{FINISHING_RATE_METRIC}"] = res_rate / sd_rate
        else:
            new_r[f"z_{FINISHING_RATE_METRIC}"] = None

        # Reliability (stabilizer style: r=1 when value present, else 0)
        new_r[f"r_{FINISHING_COUNT_METRIC}"] = 1.0 if new_r[f"z_{FINISHING_COUNT_METRIC}"] is not None else 0.0
        new_r[f"r_{FINISHING_RATE_METRIC}"] = 1.0 if new_r[f"z_{FINISHING_RATE_METRIC}"] is not None else 0.0

        out.append(new_r)
    return out


__all__ = [
    "FINISHING_METRICS",
    "FINISHING_COUNT_METRIC",
    "FINISHING_RATE_METRIC",
    "annotate_finishing_residuals",
]
