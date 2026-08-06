import hashlib
import json
import os
from datetime import datetime
from typing import Any

from .contracts import InferenceJob, VALIDATION_CONTRACT_VERSION


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def _verified_payload(value: dict[str, Any], checksum_key: str, label: str) -> dict[str, Any]:
    checksum = value.get(checksum_key)
    if not isinstance(checksum, str) or not checksum:
        raise ValueError(f"{label} checksum is required")
    canonical_payload = value.get("canonicalPayload")
    if isinstance(canonical_payload, str):
        actual = hashlib.sha256(canonical_payload.encode()).hexdigest()
        unsigned = json.loads(canonical_payload)
    else:
        unsigned = {key: item for key, item in value.items() if key != checksum_key}
        actual = hashlib.sha256(_canonical(unsigned)).hexdigest()
    if actual != checksum:
        raise ValueError(f"{label} checksum mismatch")
    return unsigned


def run_deterministic_inference(job: InferenceJob) -> dict[str, Any]:
    if os.environ.get("PLAYER_FORECAST_ENABLE_INFERENCE", "").strip().lower() != "true":
        raise ValueError("statistical inference is disabled")
    if job.model_artifact is None:
        raise ValueError("model artifact is required")
    artifact = _verified_payload(job.model_artifact, "artifactChecksum", "model artifact")
    if (
        artifact.get("contractVersion") != job.research_contract_version
        or artifact.get("contractChecksum") != job.research_contract_checksum
    ):
        raise ValueError("model artifact research contract mismatch")
    if artifact.get("promotionEligible") is not False:
        raise ValueError("only the preregistered non-promotable baseline is supported by this worker")
    target_models = artifact.get("targets", {})
    if not isinstance(target_models, dict) or not isinstance(artifact.get("segments", {}), dict):
        raise ValueError("model artifact targets are invalid")

    outputs: list[dict[str, Any]] = []
    for encoded_snapshot in job.feature_snapshots:
        snapshot = _verified_payload(encoded_snapshot, "contentHash", "feature snapshot")
        if snapshot.get("contractChecksum") != job.research_contract_checksum:
            raise ValueError("feature snapshot research contract mismatch")
        if snapshot.get("sourceHighWatermark") != job.source_high_watermark:
            raise ValueError("feature snapshot source watermark mismatch")
        rows = snapshot.get("rows")
        if not isinstance(rows, list):
            raise ValueError("feature snapshot rows are invalid")
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError("feature row is invalid")
            target_key = row.get("targetKey")
            population = row.get("population")
            target_model = (
                artifact.get("segments", {}).get(population, {}).get(target_key)
                if isinstance(artifact.get("segments"), dict) else None
            ) or target_models.get(target_key)
            features = row.get("features")
            if not isinstance(target_model, dict) or not isinstance(features, dict):
                continue
            if job.research_contract_version == VALIDATION_CONTRACT_VERSION:
                issued_at = row.get("issuedAt")
                game_start_time = row.get("gameStartTime")
                if not isinstance(issued_at, str) or not isinstance(game_start_time, str):
                    raise ValueError("validation feature row requires issuedAt and gameStartTime")
                if datetime.fromisoformat(issued_at.replace("Z", "+00:00")) >= datetime.fromisoformat(
                    game_start_time.replace("Z", "+00:00")
                ):
                    raise ValueError("forecast issuance must be strictly before puck drop")
            candidate = target_model.get("candidate")
            estimate = features.get(candidate) if isinstance(candidate, str) else None
            if isinstance(candidate, str) and candidate.startswith("contextual_"):
                base_candidate = candidate.removeprefix("contextual_")
                base = features.get(base_candidate)
                position_prior = features.get("position_prior")
                context_model = artifact.get("finalContextModels", {}).get(
                    f"{population}:{target_key}:{base_candidate}", {}
                )
                coefficients = context_model.get("coefficients") if isinstance(context_model, dict) else None
                if (
                    isinstance(base, (int, float)) and not isinstance(base, bool)
                    and isinstance(position_prior, (int, float)) and not isinstance(position_prior, bool)
                    and isinstance(coefficients, list)
                ):
                    vector = [
                        1.0,
                        float(base),
                        float(features.get("team_position_rate") or position_prior),
                        float(features.get("opponent_allowed_position_rate") or position_prior),
                        float(features.get("home_indicator") or 0),
                        float(features.get("rest_days") or 0),
                    ]
                    estimate = max(0.0, sum(
                        value * float(coefficient)
                        for value, coefficient in zip(vector, coefficients)
                    ))
            if estimate is None and candidate != "position_prior":
                estimate = features.get("position_prior")
            if isinstance(estimate, bool) or not isinstance(estimate, (int, float)):
                continue
            distribution = target_model.get("distribution") if isinstance(target_model.get("distribution"), dict) else {}
            calibration = {}
            if job.research_contract_version == VALIDATION_CONTRACT_VERSION:
                calibration = artifact.get("horizonCalibration", {}).get("calibrations", {}).get(
                    f"{population}:{target_key}:H{job.team_game_horizon}", {}
                )
                if not calibration:
                    raise ValueError("validation artifact horizon calibration is missing")
            offsets = (
                calibration.get("residualQuantileOffsets")
                if isinstance(calibration.get("residualQuantileOffsets"), dict)
                else distribution.get("residualQuantileOffsets")
                if isinstance(distribution.get("residualQuantileOffsets"), dict)
                else {}
            )
            quantiles = {
                key: max(0.0, float(estimate) + float(offset))
                for key, offset in offsets.items()
                if isinstance(offset, (int, float)) and not isinstance(offset, bool)
            } or None
            outputs.append({
                "featureSnapshotId": snapshot.get("id"),
                "gameId": job.game_id,
                "teamId": job.team_id,
                "playerId": row.get("playerId"),
                "population": population,
                "targetKey": target_key,
                "conditioning": row.get("conditioning", "conditional_playing"),
                "teamGameHorizon": job.team_game_horizon,
                "pointEstimate": max(0.0, float(estimate)),
                "probability": None,
                "distributionKind": distribution.get(
                    "kind",
                    "negative_binomial" if target_key in {"assists", "hits"} else "deterministic_baseline",
                ),
                "distribution": {
                    "candidate": candidate,
                    "developmentMae": target_model.get(
                        "developmentMae", target_model.get("developmentRollingOriginMae")
                    ),
                    "parameters": distribution.get("parameters", {}),
                    "variance": calibration.get("residualVariance"),
                    "pooledHorizonCalibrationFallback": calibration.get("pooledFallback", False),
                    "promotionEligible": False,
                },
                "quantiles": quantiles,
                "sourceHighWatermark": job.source_high_watermark,
                "fallbackFlags": [
                    "validation_only" if job.research_contract_version == VALIDATION_CONTRACT_VERSION
                    else "historical_core_baseline"
                ],
            })
    outputs.sort(key=lambda row: (str(row["playerId"]), str(row["targetKey"])))
    return {
        "success": True,
        "mode": "inference",
        "researchGate": "approved",
        "modelArtifactId": artifact.get("id"),
        "artifactChecksum": job.model_artifact["artifactChecksum"],
        "featureSchemaVersion": artifact.get("featureSchemaVersion"),
        "outputs": outputs,
        "message": "Deterministic private-shadow inference completed.",
    }
