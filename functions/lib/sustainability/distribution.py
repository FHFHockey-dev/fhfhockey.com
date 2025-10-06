"""Distribution snapshot & quintile assignment (Task 4.9).

Purpose:
  * Build a snapshot of score distribution (currently GAME window only) for a given
    model_version & config_hash.
  * Assign quintile tiers (1..5) to scored rows using snapshot thresholds.

Design Notes:
  * High score is better → Quintile 1 = top 20% (highest scores), Quintile 5 = bottom.
  * Threshold calculation uses empirical score cut points at cumulative probs
    [0.20, 0.40, 0.60, 0.80]. We store them ascending for clarity.
  * If insufficient rows (<5) we still produce snapshot; thresholds may have duplicates.
  * Assignment rule (given ascending thresholds t20 <= t40 <= t60 <= t80):
        if score >= t80 → quintile=1
        elif score >= t60 → quintile=2
        elif score >= t40 → quintile=3
        elif score >= t20 → quintile=4
        else → quintile=5
  * Provisional assignment: if no snapshot available we set row['quintile']=None and row['provisional_tier']=True

Persistence (DB):
  * Optional helper stubs: insert_distribution_snapshot, fetch_latest_distribution_snapshot expected in db_adapter.
  * This module remains functional without DB (pure in-memory calculation) to ease testing.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, date, timezone
from typing import List, Dict, Any, Iterable, Optional


@dataclass
class DistributionSnapshot:
    window_type: str
    model_version: int
    config_hash: str
    n: int
    t20: float
    t40: float
    t60: float
    t80: float
    created_at: str  # ISO timestamp

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


PERCENT_CUTS = [0.20, 0.40, 0.60, 0.80]


def _percentile(sorted_vals: List[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    if p <= 0:
        return float(sorted_vals[0])
    if p >= 1:
        return float(sorted_vals[-1])
    idx = int(round((len(sorted_vals) - 1) * p))
    return float(sorted_vals[idx])


def build_distribution_snapshot(
    rows: Iterable[Dict[str, Any]],
    window_type: str,
    model_version: int,
    config_hash: str,
) -> Optional[DistributionSnapshot]:
    scores = [float(r.get("score")) for r in rows if r.get("window_type") == window_type and r.get("score") is not None]
    if not scores:
        return None
    scores.sort()
    t20, t40, t60, t80 = (_percentile(scores, p) for p in PERCENT_CUTS)
    snap = DistributionSnapshot(
        window_type=window_type,
        model_version=model_version,
        config_hash=config_hash,
        n=len(scores),
        t20=t20,
        t40=t40,
        t60=t60,
        t80=t80,
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    return snap


def assign_quintiles(
    rows: Iterable[Dict[str, Any]],
    snapshot: Optional[DistributionSnapshot],
    window_filter: str = "GAME",
    score_field: str = "score",
    quintile_field: str = "quintile",
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        new_r = r.copy()
        if r.get("window_type") != window_filter:
            out.append(new_r)
            continue
        score = r.get(score_field)
        if snapshot is None or score is None:
            new_r[quintile_field] = None
            new_r["provisional_tier"] = True
            out.append(new_r)
            continue
        # Assignment: compare against thresholds ascending
        if score >= snapshot.t80:
            q = 1
        elif score >= snapshot.t60:
            q = 2
        elif score >= snapshot.t40:
            q = 3
        elif score >= snapshot.t20:
            q = 4
        else:
            q = 5
        new_r[quintile_field] = q
        new_r["provisional_tier"] = False
        out.append(new_r)
    return out


__all__ = [
    "DistributionSnapshot",
    "build_distribution_snapshot",
    "assign_quintiles",
]
