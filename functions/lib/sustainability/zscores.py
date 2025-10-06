"""Z-score preparation for sustainability scoring (Task 4.2).

Transforms per-player window aggregates into standardized deviations (z-scores)
relative to the player's posterior mean expectation for each rate metric.

Currently handled metrics (rate style): sh_pct, oish_pct, ipp
Future: finishing residuals, per-60 shot quality metrics once integrated.

Inputs:
  windows: iterable of window dicts output by windows.build_player_windows
  player_priors: list or mapping of player posterior rows (player_priors.compute_player_posteriors)
  sd_constants: mapping metric_code -> position_code -> sd_value (constants.load_sd_constants)

Process:
  1. Build lookup prior_mean[(player_id, stat_code)] = post_mean.
  2. For each window row, compute observed metric value (already present on window).
  3. z = (observed - expected) / sd  (if all pieces available & sd>0)
  4. Attach to row keys: z_<metric>, delta_<metric>, exp_<metric>

Returns new list (shallow copied rows) leaving inputs untouched.
"""
from __future__ import annotations

from typing import Iterable, Dict, Any, Tuple, List, Mapping

RATE_METRICS = ["sh_pct", "oish_pct", "ipp"]


def _build_prior_lookup(player_priors: Iterable[Dict[str, Any]] | Mapping) -> Dict[Tuple[int, str], float]:
    if isinstance(player_priors, dict):  # Already maybe keyed
        # Heuristic: if keys look like (player_id, stat_code) tuples, return as is (values assumed means)
        sample_key = next(iter(player_priors.keys()), None)
        if isinstance(sample_key, tuple) and len(sample_key) == 2:
            return {k: float(v) for k, v in player_priors.items()}
    out: Dict[Tuple[int, str], float] = {}
    for r in player_priors:
        pid = r.get("player_id")
        stat = r.get("stat_code")
        mean = r.get("post_mean")
        if pid is None or stat is None or mean is None:
            continue
        out[(int(pid), str(stat))] = float(mean)
    return out


def annotate_zscores(
    windows: Iterable[Dict[str, Any]],
    player_priors: Iterable[Dict[str, Any]] | Mapping,
    sd_constants: Dict[str, Dict[str, float]],
    metrics: Iterable[str] | None = None,
) -> List[Dict[str, Any]]:
    """Return new list of window rows with z-score annotations.

    metrics: optional subset override; defaults to RATE_METRICS intersection.
    """
    prior_lookup = _build_prior_lookup(player_priors)
    if metrics is None:
        metrics = RATE_METRICS
    metrics = [m for m in metrics if m in RATE_METRICS]

    out: List[Dict[str, Any]] = []
    for row in windows:
        new_row = row.copy()
        pid = row.get("player_id")
        pos = row.get("position_code") or "F"
        for metric in metrics:
            observed = row.get(metric)
            exp = prior_lookup.get((pid, metric))
            sd_val = sd_constants.get(metric, {}).get(pos)
            delta_key = f"delta_{metric}"
            z_key = f"z_{metric}"
            exp_key = f"exp_{metric}"
            new_row[exp_key] = exp
            if observed is None or exp is None or sd_val is None or sd_val <= 0:
                new_row[delta_key] = None
                new_row[z_key] = None
                continue
            delta = observed - exp
            new_row[delta_key] = delta
            new_row[z_key] = delta / sd_val
        out.append(new_row)
    return out


__all__ = [
    "RATE_METRICS",
    "annotate_zscores",
]
