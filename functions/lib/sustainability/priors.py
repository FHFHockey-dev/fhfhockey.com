"""League-level Beta prior computation utilities (Task 3.1).

Computes Beta prior parameters (alpha0, beta0) for luck / variance-heavy rate metrics
broken out by position. These priors are used to shrink player-level binomial rates.

Current modeled metrics (binomial style):
  - sh_pct       (player goals / player shots)
  - oish_pct     (on-ice goals for / on-ice shots for)
  - ipp          (player points / on-ice goals for)

Potential extension (toggle later):
  - oisv_pct (on-ice saves / on-ice shots against) — treated similarly but may be excluded
    for skater-focused modeling initially.

Design Notes:
  * We derive league_mu = successes / trials (with guard for trials=0).
  * Prior strength k (pseudo sample size) is sourced from configuration k_r[metric].
    This reuses reliability constant so that shrinkage aggressiveness and reliability
    curve are harmonized (simplifies initial calibration). Can be decoupled later.
  * alpha0 = league_mu * k, beta0 = (1 - league_mu) * k.
  * If trials == 0, we fall back to a neutral Beta(1,1) (uniform) and league_mu = 0.0.
  * Output records: {season_id, position_code, stat_code, alpha0, beta0, k, league_mu}.

Integration:
  Upstream must supply aggregated league counts per (season, position, metric).
  Provide a fetch function stub `fetch_league_aggregates` for DB integration.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Iterable, Any

from .config_loader import SustainabilityConfig

try:  # Import optional db adapter
    from . import db_adapter
except Exception:  # pragma: no cover
    db_adapter = None  # type: ignore

LEAGUE_PRIOR_METRICS = ["sh_pct", "oish_pct", "ipp"]  # Minimal initial set


@dataclass(frozen=True)
class LeaguePriorRow:
    season_id: int
    position_code: str
    stat_code: str
    alpha0: float
    beta0: float
    k: float
    league_mu: float


def fetch_league_aggregates(db_client, season_id: int) -> Iterable[Dict[str, Any]]:
    """Placeholder DB accessor returning league aggregate successes/trials.

    Expected each row to contain:
        season_id, position_code,
        sh_pct_successes, sh_pct_trials,
        oish_pct_successes, oish_pct_trials,
        ipp_successes, ipp_trials

    Replace this with actual SQL against your fact tables.
    Return empty iterable if no data.
    """
    if db_client is not None:
        getter = getattr(db_client, "fetch_league_aggregates", None)
        if callable(getter):
            return getter(season_id)
        return []
    if db_adapter is not None:
        try:
            return db_adapter.fetch_league_aggregates(season_id)  # type: ignore[attr-defined]
        except Exception:  # pragma: no cover
            return []
    return []


def upsert_league_priors(db_client, priors: List[LeaguePriorRow]) -> int:
    """Persist computed league priors into priors_cache.

    This is a stub. Real implementation should execute a bulk upsert (ON CONFLICT
    DO UPDATE) keyed by (season_id, position_code, stat_code).
    Returns number of rows intended for upsert.
    """
    if db_client is not None:
        up = getattr(db_client, "upsert_league_priors", None)
        if callable(up):
            return up([p.__dict__ for p in priors])
        return len(priors)
    if db_adapter is not None:
        try:
            return db_adapter.upsert_league_priors([p.__dict__ for p in priors])  # type: ignore[attr-defined]
        except Exception:  # pragma: no cover
            return 0
    # Example pseudo-logic (IMPLEMENT OUTSIDE this stub):
    # sql = """
    # INSERT INTO priors_cache(season_id, position_code, stat_code, alpha0, beta0, k, league_mu)
    # VALUES %s
    # ON CONFLICT (season_id, position_code, stat_code)
    # DO UPDATE SET alpha0=EXCLUDED.alpha0, beta0=EXCLUDED.beta0, k=EXCLUDED.k, league_mu=EXCLUDED.league_mu, updated_at=NOW();
    # """
    # db_client.bulk_upsert(sql, priors)
    return 0


def _extract_metric_counts(row: Dict[str, Any], metric: str) -> tuple[int, int]:
    return (
        int(row.get(f"{metric}_successes", 0) or 0),
        int(row.get(f"{metric}_trials", 0) or 0),
    )


def compute_league_beta_priors(
    season_id: int,
    db_client,
    cfg: SustainabilityConfig,
    aggregates: Iterable[Dict[str, Any]] | None = None,
) -> List[LeaguePriorRow]:
    """Compute league Beta priors for configured metrics.

    Parameters:
        season_id: Target season identifier.
        db_client: DB client (used if aggregates not supplied).
        cfg: Loaded sustainability configuration (for k_r constants).
        aggregates: Optional pre-fetched iterable of aggregate rows (for testing).

    Returns:
        List of LeaguePriorRow objects.
    """
    if aggregates is None:
        aggregates = fetch_league_aggregates(db_client, season_id)

    k_r_map = cfg.k_r
    out: List[LeaguePriorRow] = []
    for row in aggregates:
        pos = row.get("position_code")
        if not pos:
            continue
        for metric in LEAGUE_PRIOR_METRICS:
            successes, trials = _extract_metric_counts(row, metric)
            # Guard: some aggregates (e.g., points vs goals for IPP) can yield successes > trials
            if successes > trials and trials > 0:
                trials = successes  # expand denominator to avoid mu > 1; alternative is clamp
            if trials <= 0:
                league_mu = 0.0
                k = float(k_r_map.get(metric, 1))
                alpha0, beta0 = 1.0, 1.0  # neutral
            else:
                league_mu = successes / trials
                # Clamp league_mu to [0,1] just in case of anomalous data
                if league_mu < 0:
                    league_mu = 0.0
                elif league_mu > 1:
                    league_mu = 1.0
                k = float(k_r_map.get(metric, 1))
                alpha0 = league_mu * k
                beta0 = (1.0 - league_mu) * k
                # Guard: if league_mu near boundaries ensure non-zero beta components
                if alpha0 <= 0:
                    alpha0 = 0.5
                if beta0 <= 0:
                    beta0 = 0.5
            out.append(
                LeaguePriorRow(
                    season_id=season_id,
                    position_code=pos,
                    stat_code=metric,
                    alpha0=alpha0,
                    beta0=beta0,
                    k=k,
                    league_mu=league_mu,
                )
            )
    return out


__all__ = [
    "LeaguePriorRow",
    "LEAGUE_PRIOR_METRICS",
    "compute_league_beta_priors",
    "fetch_league_aggregates",
    "upsert_league_priors",
]
