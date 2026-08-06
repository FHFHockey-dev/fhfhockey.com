from __future__ import annotations

import math
from typing import Any, Iterable


NORMAL_QUANTILES = {
    0.1: -1.2815515655446004,
    0.25: -0.6744897501960817,
    0.5: 0.0,
    0.75: 0.6744897501960817,
    0.9: 1.2815515655446004,
}


def _component_moments(component: dict[str, Any], unconditional: bool) -> tuple[float, float]:
    mean = float(component["mean"])
    variance = max(0.0, float(component["variance"]))
    if not unconditional:
        return mean, variance
    probability = component.get("plays_probability")
    if probability is None:
        raise ValueError("unconditional aggregation requires plays_probability for every game")
    probability = float(probability)
    if not 0 <= probability <= 1:
        raise ValueError("plays_probability must be between zero and one")
    return probability * mean, probability * variance + probability * (1 - probability) * mean * mean


def aggregate_rest_of_season(
    components: Iterable[dict[str, Any]],
    *,
    semantics: str,
    season_to_date_actual: float = 0.0,
) -> dict[str, Any]:
    if semantics not in {"conditional", "unconditional"}:
        raise ValueError("semantics must be conditional or unconditional")
    games = list(components)
    if not games:
        raise ValueError("rest-of-season aggregation requires at least one game")
    moments = [_component_moments(game, semantics == "unconditional") for game in games]
    remaining_mean = sum(mean for mean, _ in moments)
    remaining_variance = sum(variance for _, variance in moments)
    standard_deviation = math.sqrt(remaining_variance)
    remaining_quantiles = {
        f"p{int(probability * 100)}": max(0.0, remaining_mean + z_score * standard_deviation)
        for probability, z_score in NORMAL_QUANTILES.items()
    }
    return {
        "scope": "rest_of_season",
        "semantics": semantics,
        "games": len(games),
        "remainingMean": remaining_mean,
        "remainingVariance": remaining_variance,
        "remainingQuantiles": remaining_quantiles,
        "fullSeasonMean": season_to_date_actual + remaining_mean,
        "fullSeasonQuantiles": {
            key: season_to_date_actual + value for key, value in remaining_quantiles.items()
        },
        "seasonToDateActual": float(season_to_date_actual),
        "aggregationMethod": "independent_game_moments_normal_approximation",
        "scheduleRevisionIdentity": games[0].get("schedule_revision_id"),
    }

