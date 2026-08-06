from dataclasses import dataclass
from datetime import datetime
from typing import Any


RESEARCH_CONTRACT_VERSION = "player-forecasts-research-v1"
RESEARCH_CONTRACT_SHA256 = "9d4a30f5027e8b277015c592a39715e16d18c9a371dd352ddd4f0738868d9574"
VALIDATION_CONTRACT_VERSION = "player-forecasts-research-v2-validation"
VALIDATION_CONTRACT_SHA256 = "14832482d902ca02fa148be4b31eaa23fe57b5a2d4ac642d87ba14403a90f5ed"
APPROVED_RESEARCH_CONTRACTS = {
    RESEARCH_CONTRACT_VERSION: RESEARCH_CONTRACT_SHA256,
    VALIDATION_CONTRACT_VERSION: VALIDATION_CONTRACT_SHA256,
}


@dataclass(frozen=True)
class InferenceJob:
    job_id: str
    scope_key: str
    game_id: int
    team_id: int
    team_game_horizon: int
    source_high_watermark: str
    code_version: str
    release_channel: str
    execution_mode: str
    research_contract_version: str
    research_contract_checksum: str
    model_artifact: dict[str, Any] | None
    feature_snapshots: tuple[dict[str, Any], ...]


def _required_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value.strip()


def _positive_integer(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{key} must be a positive integer")
    return value


def validate_inference_job(payload: dict[str, Any]) -> InferenceJob:
    if not isinstance(payload, dict):
        raise ValueError("request body must be a JSON object")
    horizon = _positive_integer(payload, "teamGameHorizon")
    if horizon > 10:
        raise ValueError("teamGameHorizon must be between 1 and 10")
    watermark = _required_string(payload, "sourceHighWatermark")
    try:
        datetime.fromisoformat(watermark.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("sourceHighWatermark must be an ISO-8601 timestamp") from error
    release_channel = _required_string(payload, "releaseChannel")
    if release_channel != "shadow":
        raise ValueError("only the shadow release channel is allowed before promotion")
    execution_mode = _required_string(payload, "executionMode")
    if execution_mode not in {"contract_only", "inference"}:
        raise ValueError("executionMode must be contract_only or inference")
    contract_version = _required_string(payload, "researchContractVersion")
    contract_checksum = _required_string(payload, "researchContractChecksum")
    if APPROVED_RESEARCH_CONTRACTS.get(contract_version) != contract_checksum:
        raise ValueError("research contract version or checksum does not match the approved runtime")
    model_artifact = payload.get("modelArtifact")
    feature_snapshots = payload.get("featureSnapshots", [])
    if execution_mode == "inference":
        if not isinstance(model_artifact, dict):
            raise ValueError("modelArtifact must be supplied for inference")
        if not isinstance(feature_snapshots, list) or not feature_snapshots:
            raise ValueError("featureSnapshots must be a non-empty array for inference")
        if not all(isinstance(snapshot, dict) for snapshot in feature_snapshots):
            raise ValueError("each feature snapshot must be an object")
    return InferenceJob(
        job_id=_required_string(payload, "jobId"),
        scope_key=_required_string(payload, "scopeKey"),
        game_id=_positive_integer(payload, "gameId"),
        team_id=_positive_integer(payload, "teamId"),
        team_game_horizon=horizon,
        source_high_watermark=watermark,
        code_version=_required_string(payload, "codeVersion"),
        release_channel=release_channel,
        execution_mode=execution_mode,
        research_contract_version=contract_version,
        research_contract_checksum=contract_checksum,
        model_artifact=model_artifact,
        feature_snapshots=tuple(feature_snapshots),
    )
