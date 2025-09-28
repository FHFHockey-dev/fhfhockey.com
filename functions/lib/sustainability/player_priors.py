"""Player multi-season posterior blending (Tasks 3.4–3.7).

Responsibilities:
  * Fetch per-player per-season successes/trials for regression-prone metrics.
  * Apply multi-season weights (default target: 0.6, prev1: 0.3, prev2: 0.1) with re-normalization if seasons missing.
  * Compute blended successes & trials and Beta posterior means using league priors.
  * Flag rookies (no prior season data) for downstream usage.
  * Provide upsert stub for `player_priors_cache` (ON CONFLICT update semantics).

Metrics handled mirror league priors: sh_pct, oish_pct, ipp.

Data Model (expected from fetch function): rows shaped like:
  {
    'player_id': int,
    'season_id': int,
    'position_code': 'F'|'D',
    'sh_pct_successes': int, 'sh_pct_trials': int,
    'oish_pct_successes': int, 'oish_pct_trials': int,
    'ipp_successes': int, 'ipp_trials': int,
  }

League priors mapping input shape:
  {(season_id, position_code, stat_code): LeaguePriorRow}

Outputs for upsert:
  player_id, season_id (target), position_code, stat_code,
  successes_blend, trials_blend, post_mean, rookie_status, model_version
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Iterable, Any, Tuple, DefaultDict
import logging
from collections import defaultdict

from .priors import LeaguePriorRow
from .config_loader import SustainabilityConfig

PLAYER_PRIOR_METRICS = ["sh_pct", "oish_pct", "ipp"]
DEFAULT_SEASON_WEIGHTS = [0.6, 0.3, 0.1]  # target, prev1, prev2

logger = logging.getLogger("sustainability.player_priors")

try:  # optional db adapter
    from . import db_adapter
except Exception:  # pragma: no cover
    db_adapter = None  # type: ignore


def fetch_player_season_rows(db_client, season_ids: List[int]) -> Iterable[Dict[str, Any]]:
    """Placeholder multi-season fetch.

    Should return per-player per-season aggregates for all season_ids requested.
    Real implementation should join your fact tables.
    """
    if db_client is not None:
        getter = getattr(db_client, "fetch_player_season_rows", None)
        if callable(getter):
            return getter(season_ids)
    if db_adapter is not None:
        # Not implemented in adapter yet; return empty
        return []
    return []


def _metric_counts(row: Dict[str, Any], metric: str) -> Tuple[int, int]:
    return (
        int(row.get(f"{metric}_successes", 0) or 0),
        int(row.get(f"{metric}_trials", 0) or 0),
    )


def _normalize_weights(base: List[float]) -> List[float]:
    total = sum(base)
    if total <= 0:
        return [0 for _ in base]
    return [w / total for w in base]


def _season_order(target_season: int) -> List[int]:
    return [target_season, target_season - 1, target_season - 2]


def compute_player_posteriors(
    target_season: int,
    league_priors: Dict[Tuple[int, str, str], LeaguePriorRow],
    cfg: SustainabilityConfig,
    db_client=None,
    rows: Iterable[Dict[str, Any]] | None = None,
    season_weights: List[float] | None = None,
) -> List[Dict[str, Any]]:
    """Compute player posterior means for target season.

    Parameters:
        target_season: season for which priors will be written.
        league_priors: mapping keyed by (season_id, position_code, stat_code).
        cfg: loaded config (for model_version, maybe future toggles).
        db_client: optional client to fetch season rows if rows not given.
        rows: optional pre-fetched iterable for testing.
        season_weights: optional override weight list (len up to 3).
    """
    if season_weights is None:
        season_weights = DEFAULT_SEASON_WEIGHTS
    season_weights = season_weights[:3] + [0] * (3 - len(season_weights[:3]))

    target_and_history = _season_order(target_season)
    needed_seasons = set(target_and_history)
    if rows is None:
        rows = fetch_player_season_rows(db_client, list(needed_seasons))

    # Group by player -> season
    by_player: DefaultDict[int, Dict[int, Dict[str, Any]]] = defaultdict(dict)
    for r in rows:
        pid = r.get("player_id")
        season = r.get("season_id")
        if pid is None or season is None:
            continue
        by_player[int(pid)][int(season)] = r

    results: List[Dict[str, Any]] = []
    for player_id, season_map in by_player.items():
        target_row = season_map.get(target_season)
        if target_row is None:
            # No target season stats -> skip (optional: still create empty rookies?)
            continue
        position_code = target_row.get("position_code") or "F"
        # Build weights for available seasons in order
        avail_rows: List[Tuple[float, Dict[str, Any]]] = []
        weight_positions: List[float] = []
        for idx, season in enumerate(target_and_history):
            row = season_map.get(season)
            w = season_weights[idx] if row else 0.0
            if row and w > 0:
                avail_rows.append((w, row))
                weight_positions.append(w)
        if not avail_rows:
            continue
        norm = _normalize_weights(weight_positions)
        for i in range(len(avail_rows)):
            w, r = avail_rows[i]
            avail_rows[i] = (norm[i], r)

        rookie_status = len([s for s in season_map.keys() if s < target_season and season_map[s]]) == 0

        for metric in PLAYER_PRIOR_METRICS:
            successes_blend = 0.0
            trials_blend = 0.0
            for w, r in avail_rows:
                suc, tri = _metric_counts(r, metric)
                successes_blend += w * suc
                trials_blend += w * tri
            # Beta posterior with league prior
            prior_key = (target_season, position_code, metric)
            prior = league_priors.get(prior_key)
            if prior is None:
                # Can't compute without league prior; skip metric
                continue
            alpha_post = prior.alpha0 + successes_blend
            beta_post = prior.beta0 + max(trials_blend - successes_blend, 0)
            denom = alpha_post + beta_post
            if denom <= 0:
                post_mean = prior.league_mu
            else:
                post_mean = alpha_post / denom
            results.append(
                {
                    "player_id": player_id,
                    "season_id": target_season,
                    "position_code": position_code,
                    "stat_code": metric,
                    "successes_blend": successes_blend,
                    "trials_blend": trials_blend,
                    "post_mean": post_mean,
                    "rookie_status": rookie_status,
                    "model_version": cfg.model_version,
                }
            )
    logger.debug(
        "player_posteriors_computed players=%s rows=%s rookies=%s target_season=%s",
        len(by_player),
        len(results),
        sum(1 for r in results if r["rookie_status"]),
        target_season,
    )
    return results


def upsert_player_priors(db_client, rows: List[Dict[str, Any]]) -> int:
    """Persist player priors (stub)."""
    if not rows:
        return 0
    if db_client is not None:
        up = getattr(db_client, "upsert_player_priors", None)
        if callable(up):
            return up(rows)
    # Attempt module-level adapter
    try:  # pragma: no cover (depends on runtime env)
        from . import db_adapter as _dba
        return _dba.upsert_player_priors(rows)  # type: ignore[attr-defined]
    except Exception:
        return len(rows)


def summarize_player_posteriors(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    players = {r["player_id"] for r in rows}
    rookies = {r["player_id"] for r in rows if r.get("rookie_status")}
    metrics = {r["stat_code"] for r in rows}
    return {
        "players": len(players),
        "rows": len(rows),
        "rookie_players": len(rookies),
        "metrics": sorted(metrics),
    }


def log_player_posteriors_summary(rows: List[Dict[str, Any]]) -> None:
    summary = summarize_player_posteriors(rows)
    logger.info(
        "player_priors_summary players=%s rookies=%s rows=%s metrics=%s",
        summary["players"],
        summary["rookie_players"],
        summary["rows"],
        ",".join(summary["metrics"]),
    )


__all__ = [
    "PLAYER_PRIOR_METRICS",
    "compute_player_posteriors",
    "fetch_player_season_rows",
    "upsert_player_priors",
]
