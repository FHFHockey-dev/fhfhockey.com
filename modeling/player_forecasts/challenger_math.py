from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable

from .model import _quantile


def official_assist_expectation(primary: float, secondary: float) -> float:
    return max(0.0, float(primary)) + max(0.0, float(secondary))


def assist_candidate_features(primary: float, secondary: float) -> dict[str, float]:
    primary_value = max(0.0, float(primary))
    secondary_value = max(0.0, float(secondary))
    return {
        "decomposed_sum": official_assist_expectation(primary_value, secondary_value),
        "play_driver_70_30": 0.7 * primary_value + 0.3 * secondary_value,
        "play_driver_80_20": 0.8 * primary_value + 0.2 * secondary_value,
    }


def fit_horizon_residual_quantiles(
    rows: Iterable[dict[str, Any]],
    probabilities: tuple[float, ...] = (0.1, 0.25, 0.5, 0.75, 0.9),
) -> dict[str, Any]:
    grouped: dict[tuple[str, str, int], list[float]] = defaultdict(list)
    pooled: dict[tuple[str, str], list[float]] = defaultdict(list)
    for row in rows:
        key = (str(row["population"]), str(row["target_key"]), int(row["team_game_horizon"]))
        residual = float(row["outcome"]) - float(row["prediction"])
        grouped[key].append(residual)
        pooled[key[:2]].append(residual)
    calibrations: dict[str, Any] = {}
    for population, target in sorted(pooled):
        for horizon in range(1, 11):
            values = grouped.get((population, target, horizon))
            fallback = not values
            source = values or pooled[(population, target)]
            residual_mean = sum(source) / len(source)
            residual_variance = sum((value - residual_mean) ** 2 for value in source) / max(1, len(source) - 1)
            identity = f"{population}:{target}:H{horizon}"
            calibrations[identity] = {
                "population": population,
                "targetKey": target,
                "teamGameHorizon": horizon,
                "rows": len(source),
                "pooledFallback": fallback,
                "residualMean": residual_mean,
                "residualVariance": residual_variance,
                "residualQuantileOffsets": {
                    f"p{int(probability * 100)}": _quantile(source, probability)
                    for probability in probabilities
                },
            }
    return {
        "method": "population_target_horizon_empirical_residual_quantiles",
        "monotonicWideningAssumed": False,
        "calibrations": calibrations,
    }


def fit_hierarchical_hits(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    by_position_player: dict[tuple[str, int], list[float]] = defaultdict(lambda: [0.0, 0.0])
    for record in records:
        exposure = float(record["time_on_ice_seconds"])
        if exposure <= 0:
            continue
        key = (str(record["position"]), int(record["player_id"]))
        by_position_player[key][0] += float(record["hits"])
        by_position_player[key][1] += exposure
    by_position: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for (position, _), (events, exposure) in by_position_player.items():
        by_position[position].append((events / exposure, exposure))
    priors: dict[str, dict[str, float | None]] = {}
    for position, rates_and_exposure in sorted(by_position.items()):
        rates = [rate for rate, _ in rates_and_exposure]
        mean = sum(rates) / len(rates)
        variance = sum((rate - mean) ** 2 for rate in rates) / max(1, len(rates) - 1)
        if mean > 0 and variance > 0:
            alpha = mean * mean / variance
            beta = mean / variance
        else:
            alpha = None
            beta = None
        priors[position] = {
            "meanRatePerSecond": mean,
            "gammaAlpha": alpha,
            "gammaBetaSeconds": beta,
            "players": len(rates),
        }
    return {
        "method": "poisson_gamma_position_partial_pooling",
        "fitScope": "development_only",
        "priors": priors,
    }


def hierarchical_hits_prediction(
    artifact: dict[str, Any],
    *,
    position: str,
    prior_hits: float,
    prior_time_on_ice_seconds: float,
    projected_time_on_ice_seconds: float,
) -> float:
    prior = artifact.get("priors", {}).get(position)
    if not prior:
        raise ValueError("position prior is missing")
    alpha = prior.get("gammaAlpha")
    beta = prior.get("gammaBetaSeconds")
    if alpha is None or beta is None:
        rate = float(prior["meanRatePerSecond"])
    else:
        rate = (max(0.0, prior_hits) + float(alpha)) / (
            max(0.0, prior_time_on_ice_seconds) + float(beta)
        )
    return rate * max(0.0, projected_time_on_ice_seconds)
