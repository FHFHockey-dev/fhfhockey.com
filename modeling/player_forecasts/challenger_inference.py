from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

from .contract import VALIDATION_CONTRACT_SHA256, VALIDATION_CONTRACT_VERSION
from .io import canonical_json


def verify_validation_artifact(artifact: dict[str, Any]) -> None:
    supplied = artifact.get("artifactChecksum")
    unsigned = {key: value for key, value in artifact.items() if key != "artifactChecksum"}
    if hashlib.sha256(canonical_json(unsigned).encode()).hexdigest() != supplied:
        raise RuntimeError("validation challenger artifact checksum mismatch")
    if artifact.get("contractVersion") != VALIDATION_CONTRACT_VERSION:
        raise RuntimeError("validation challenger contract version mismatch")
    if artifact.get("contractChecksum") != VALIDATION_CONTRACT_SHA256:
        raise RuntimeError("validation challenger contract checksum mismatch")
    if artifact.get("promotionEligible") is not False:
        raise RuntimeError("validation challenger must remain non-promotion-eligible")


def infer_conditional_game(
    artifact: dict[str, Any],
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    verify_validation_artifact(artifact)
    required = {
        "player_id", "target_game_id", "population", "target_key", "team_game_horizon",
        "issued_at", "cutoff_at", "game_start_time", "team_id", "opponent_team_id", "home_away", "rest_days", "features",
    }
    missing = sorted(required - set(snapshot))
    if missing:
        raise ValueError("feature snapshot is missing: " + ", ".join(missing))
    issued_at = datetime.fromisoformat(str(snapshot["issued_at"]).replace("Z", "+00:00"))
    game_start = datetime.fromisoformat(str(snapshot["game_start_time"]).replace("Z", "+00:00"))
    if issued_at >= game_start:
        raise ValueError("forecast issuance must be strictly before puck drop")
    population = str(snapshot["population"])
    target = str(snapshot["target_key"])
    horizon = int(snapshot["team_game_horizon"])
    if not 1 <= horizon <= 10:
        raise ValueError("team_game_horizon must be between 1 and 10")
    segment = artifact.get("segments", {}).get(population, {}).get(target)
    if not segment:
        raise ValueError("artifact does not contain the requested population/target segment")
    candidate = str(segment["candidate"])
    value = snapshot["features"].get(candidate)
    if candidate.startswith("contextual_"):
        base_candidate = candidate.removeprefix("contextual_")
        base = snapshot["features"].get(base_candidate)
        position_prior = snapshot["features"].get("position_prior")
        context = artifact.get("finalContextModels", {}).get(
            f"{population}:{target}:{base_candidate}", {}
        )
        coefficients = context.get("coefficients")
        if base is not None and position_prior is not None and isinstance(coefficients, list):
            vector = [
                1.0,
                float(base),
                float(snapshot["features"].get("team_position_rate") or position_prior),
                float(snapshot["features"].get("opponent_allowed_position_rate") or position_prior),
                float(snapshot["features"].get("home_indicator") or 0),
                float(snapshot["features"].get("rest_days") or 0),
            ]
            value = max(0.0, sum(item * float(coefficient) for item, coefficient in zip(vector, coefficients)))
    fallback = False
    if value is None:
        value = snapshot["features"].get("position_prior")
        fallback = True
    if value is None:
        raise ValueError("feature snapshot has neither selected candidate nor position prior")
    estimate = max(0.0, float(value))
    calibration_key = f"{population}:{target}:H{horizon}"
    calibration = artifact.get("horizonCalibration", {}).get("calibrations", {}).get(calibration_key)
    if not calibration:
        raise ValueError("artifact is missing horizon calibration")
    offsets = calibration["residualQuantileOffsets"]
    quantiles = {
        key: max(0.0, estimate + float(offset))
        for key, offset in offsets.items()
        if offset is not None
    }
    return {
        "playerId": int(snapshot["player_id"]),
        "targetGameId": int(snapshot["target_game_id"]),
        "population": population,
        "targetKey": target,
        "conditioning": "conditional_playing",
        "teamGameHorizon": horizon,
        "issuedAt": snapshot["issued_at"],
        "cutoffAt": snapshot["cutoff_at"],
        "pointEstimate": estimate,
        "variance": max(0.0, float(calibration["residualVariance"])),
        "quantiles": quantiles,
        "candidate": candidate,
        "fallbackToPositionPrior": fallback,
        "pooledHorizonCalibrationFallback": bool(calibration["pooledFallback"]),
        "modelVersion": artifact["modelVersion"],
        "artifactChecksum": artifact["artifactChecksum"],
        "contractVersion": artifact["contractVersion"],
        "contractChecksum": artifact["contractChecksum"],
        "validationOnly": True,
        "promotionEligible": False,
    }
