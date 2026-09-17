"""Daily usage/rate baselines and portable regularized probability models.

These functions fit research candidates. Nothing here changes a serving model.
"""
from __future__ import annotations

import hashlib
import math
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from .io import canonical_json
from .daily_board import _timestamp

TARGETS = ("GOALS", "ASSISTS", "SHOTS_ON_GOAL", "PP_POINTS", "HITS", "BLOCKED_SHOTS", "TIME_ON_ICE_PER_GAME",
    "SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE")

def _number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

def historical_baselines(records: list[dict[str, Any]], *, recent_weight: float = 0.5, prior_minutes: float = 300,
                         candidates: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Reconstructed completed-game history; no same-day or future outcomes.

    A conservative two-calendar-day lag is an explicit reconstruction assumption,
    NOT an invented source publication/receipt timestamp. Actual timestamps remain
    in the source freeze. News and nonappearance targets are excluded here.
    Explicit candidates request means without supplying outcome placeholders;
    they are never admitted into player history or population rate pools.
    """
    if not 0 <= recent_weight <= 1 or prior_minutes <= 0:
        raise ValueError("invalid baseline policy")
    ordered = sorted(records, key=lambda row: (row["game_date"], row["game_id"], row["player_id"]))
    if candidates is not None and any("outcomes" in row for row in candidates):
        raise ValueError("pregame candidates must not contain outcomes")
    requested = ordered if candidates is None else sorted(candidates, key=lambda row: (row["game_date"], row["game_id"], row["player_id"]))
    players: dict[int, list[dict[str, Any]]] = defaultdict(list)
    pooled: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    index = 0
    results = []
    for row in requested:
        allowed_date = (date.fromisoformat(row["game_date"]) - timedelta(days=2)).isoformat()
        while index < len(ordered) and ordered[index]["game_date"] <= allowed_date:
            old = ordered[index]
            index += 1
            if not old.get("historical_team_membership_verified"):
                continue
            players[old["player_id"]].append(old)
            exposure = old["outcomes"].get("TIME_ON_ICE_PER_GAME")
            for target in TARGETS:
                observed = old["outcomes"].get(target)
                if _number(observed) and _number(exposure) and exposure > 0:
                    stats = pooled[old["population"], target]
                    stats[0] += observed
                    stats[1] += exposure
                    stats[2] += 1
        history = players[row["player_id"]]
        if not history or not row.get("historical_team_membership_verified"):
            continue
        # Position and team context used as features come from prior rows.
        current_season = [old for old in history if old["season_id"] == row["season_id"]]
        season = current_season or history
        recent = history[-5:]
        recent_usage = [old["outcomes"].get("TIME_ON_ICE_PER_GAME") for old in recent]
        recent_usage = [value for value in recent_usage if _number(value) and value > 0]
        if not recent_usage:
            continue
        minutes = sum(recent_usage) / len(recent_usage)
        estimates = {}
        for target in TARGETS:
            if candidates is None and not _number(row["outcomes"].get(target)):
                continue
            available = [old for old in season if _number(old["outcomes"].get(target)) and _number(old["outcomes"].get("TIME_ON_ICE_PER_GAME")) and old["outcomes"]["TIME_ON_ICE_PER_GAME"] > 0]
            recent_values = [old["outcomes"][target] for old in recent if _number(old["outcomes"].get(target))]
            if not available or not recent_values:
                continue
            total = sum(old["outcomes"][target] for old in available)
            exposure = sum(old["outcomes"]["TIME_ON_ICE_PER_GAME"] for old in available)
            mean = total / len(available)
            prior_total, prior_exposure, prior_games = pooled[row["population"], target]
            prior_rate = prior_total / prior_exposure if prior_exposure else total / exposure
            role_aware = minutes if target == "TIME_ON_ICE_PER_GAME" else minutes * total / exposure
            shrinkage = ((total + prior_total / max(1, prior_games) * 10) / (len(available) + 10)
                if target == "TIME_ON_ICE_PER_GAME" else minutes * (total + prior_minutes * prior_rate) / (exposure + prior_minutes))
            estimates[target] = {"season_rate": mean,
                "recent_season": (1 - recent_weight) * mean + recent_weight * sum(recent_values) / len(recent_values),
                "role_aware": role_aware, "empirical_bayes": shrinkage}
        results.append({"game_id": row["game_id"], "player_id": row["player_id"], "game_date": row["game_date"],
            "team_id": row["team_id"], "population": row["population"], "outcomes": row.get("outcomes", {}), "estimates": estimates,
            "conditioning": "conditional_playing", "evidence_classification": "historical_reconstruction",
            "feature_time_basis": "completed_game_date_plus_two_days", "maximum_feature_game_date": history[-1]["game_date"],
            "feature_hash": hashlib.sha256(canonical_json([old["row_hash"] for old in history]).encode()).hexdigest(),
            "segments": {"position": history[-1]["position"], "traded": history[-1]["team_id"] != row["team_id"],
                "usage_tier": "high" if minutes >= 20 else "medium" if minutes >= 12 else "low"},
            "policy": {"recentWeight": recent_weight, "priorMinutes": prior_minutes}})
    return results

def fit_logistic(records: list[dict[str, Any]], feature_names: list[str], *, ridge: float = 1.0, iterations: int = 1000) -> dict[str, Any]:
    """Labels require a complete pregame candidate list and official settlement."""
    if not feature_names or ridge <= 0 or iterations < 1:
        raise ValueError("invalid logistic policy")
    for row in records:
        if row.get("label") not in (0, 1) or not row.get("label_verified") or not row.get("candidate_list_complete"):
            raise ValueError("participation requires verified positive/negative labels and complete candidate lists")
        if any(not _number(row.get("features", {}).get(name)) for name in feature_names):
            raise ValueError("missing or nonfinite feature; do not silently impute")
        if not _timestamp(row["maximum_feature_available_at"]) <= _timestamp(row["cutoff_at"]) < _timestamp(row["scheduled_start_at"]):
            raise ValueError("future probability feature")
    if {row["label"] for row in records} != {0, 1}:
        raise ValueError("both positive and negative labels are required")
    count = len(records)
    means = [sum(row["features"][name] for row in records) / count for name in feature_names]
    scales = [max(1e-6, math.sqrt(sum((row["features"][name] - mean) ** 2 for row in records) / count)) for name, mean in zip(feature_names, means)]
    vectors = [[1.0] + [(row["features"][name] - mean) / scale for name, mean, scale in zip(feature_names, means, scales)] for row in records]
    weights = [0.0] * (len(feature_names) + 1)
    for _ in range(iterations):
        gradient = [0.0] * len(weights)
        for vector, row in zip(vectors, records):
            logit = max(-35, min(35, sum(a * b for a, b in zip(weights, vector))))
            error = 1 / (1 + math.exp(-logit)) - row["label"]
            for index, value in enumerate(vector):
                gradient[index] += error * value
        for index in range(len(weights)):
            weights[index] -= 0.1 * (gradient[index] + (ridge * weights[index] if index else 0)) / count
    artifact = {"version": "starter-board-logistic-v1", "features": feature_names, "means": means, "scales": scales,
        "weights": weights, "rows": count, "positiveLabels": sum(row["label"] for row in records),
        "ridge": ridge, "iterations": iterations, "promotionEligible": False,
        "inputHash": hashlib.sha256(canonical_json(records).encode()).hexdigest()}
    artifact["checksum"] = hashlib.sha256(canonical_json(artifact).encode()).hexdigest()
    return artifact

def logistic_probability(artifact: dict[str, Any], features: dict[str, float]) -> float | None:
    if any(not _number(features.get(name)) for name in artifact["features"]):
        return None
    vector = [1.0] + [(features[name] - mean) / scale for name, mean, scale in zip(artifact["features"], artifact["means"], artifact["scales"])]
    logit = max(-35, min(35, sum(a * b for a, b in zip(artifact["weights"], vector))))
    return 1 / (1 + math.exp(-logit))

def goalie_start_probabilities(probabilities: list[float], temperature: float = 1) -> list[float]:
    if not _number(temperature) or temperature <= 0 or not probabilities or any(not _number(p) or not 0 <= p <= 1 for p in probabilities) or not math.isclose(sum(probabilities), 1, abs_tol=1e-6):
        raise ValueError("complete team goalie probability mass required")
    largest = max(probabilities)
    weights = [math.exp((math.log(p) - math.log(largest)) / temperature) if p else 0 for p in probabilities]
    return [weight / sum(weights) for weight in weights]

def fit_goalie_temperature(games: list[dict[str, Any]]) -> dict[str, Any]:
    if not games or any(game.get("label_verified") is not True or game["labels"].count(1) != 1 or len(game["labels"]) < 2
        or any(type(label) is not int or label not in (0, 1) for label in game["labels"]) or len(game["labels"]) != len(game["probabilities"]) for game in games):
        raise ValueError("one official starter label per complete team candidate list required")
    losses = {}
    for temperature in (0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0):
        losses[temperature] = sum(-math.log(max(1e-12, goalie_start_probabilities(game["probabilities"], temperature)[game["labels"].index(1)])) for game in games) / len(games)
    selected = min(losses, key=lambda value: (losses[value], abs(value - 1)))
    return {"version": "starter-board-goalie-temperature-v1", "temperature": selected, "trainingLogLoss": losses[selected],
        "teamGames": len(games), "selectionTrials": [{"temperature": t, "logLoss": loss} for t, loss in losses.items()],
        "promotionEligible": False}
