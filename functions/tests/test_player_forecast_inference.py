import importlib.util
import hashlib
import json
import os
from pathlib import Path

from lib.player_forecasts import run_inference_contract, validate_inference_job


VALID_JOB = {
    "jobId": "3f9f6986-e278-4ad6-b815-a780c104e99f",
    "scopeKey": "game:2026020001:team:10",
    "gameId": 2026020001,
    "teamId": 10,
    "teamGameHorizon": 10,
    "sourceHighWatermark": "2026-11-01T10:00:00Z",
    "codeVersion": "test-sha",
    "releaseChannel": "shadow",
    "executionMode": "contract_only",
    "researchContractVersion": "player-forecasts-research-v1",
    "researchContractChecksum": "9d4a30f5027e8b277015c592a39715e16d18c9a371dd352ddd4f0738868d9574",
}

VALIDATION_CONTRACT = {
    "researchContractVersion": "player-forecasts-research-v2-validation",
    "researchContractChecksum": "14832482d902ca02fa148be4b31eaa23fe57b5a2d4ac642d87ba14403a90f5ed",
}


def _load_api_module():
    path = Path(__file__).parents[1] / "api" / "player_forecasts" / "infer.py"
    spec = importlib.util.spec_from_file_location("player_forecast_infer_api", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_contract_accepts_horizon_ten_and_emits_no_model_output():
    result = run_inference_contract(validate_inference_job(VALID_JOB))
    assert result["success"] is True
    assert result["researchGate"] == "approved"
    assert result["outputs"] == []


def test_contract_rejects_horizon_above_ten():
    payload = {**VALID_JOB, "teamGameHorizon": 11}
    try:
        validate_inference_job(payload)
    except ValueError as error:
        assert "between 1 and 10" in str(error)
    else:
        raise AssertionError("expected invalid horizon to fail")


def test_api_requires_authentication(monkeypatch):
    module = _load_api_module()
    monkeypatch.setenv("PLAYER_FORECAST_INFERENCE_SECRET", "test-secret")
    client = module.app.test_client()
    response = client.post("/", json=VALID_JOB)
    assert response.status_code == 401


def test_api_returns_research_gate_receipt(monkeypatch):
    module = _load_api_module()
    monkeypatch.setenv("PLAYER_FORECAST_INFERENCE_SECRET", "test-secret")
    client = module.app.test_client()
    response = client.post(
        "/",
        json=VALID_JOB,
        headers={"Authorization": "Bearer test-secret"},
    )
    assert response.status_code == 200
    assert response.get_json()["researchGate"] == "approved"
    os.environ.pop("PLAYER_FORECAST_INFERENCE_SECRET", None)


def test_health_reports_contract_without_exposing_secret(monkeypatch):
    module = _load_api_module()
    monkeypatch.setenv("PLAYER_FORECAST_INFERENCE_SECRET", "test-secret")
    client = module.app.test_client()
    response = client.get("/", headers={"Authorization": "Bearer test-secret"})
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["contractChecksum"] == VALID_JOB["researchContractChecksum"]
    assert "test-secret" not in str(payload)


def _signed(value, checksum_key):
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return {**value, checksum_key: hashlib.sha256(encoded).hexdigest()}


def test_inference_requires_flag_and_replays_identically(monkeypatch):
    artifact = _signed({
        "id": "artifact-1",
        "contractVersion": VALID_JOB["researchContractVersion"],
        "contractChecksum": VALID_JOB["researchContractChecksum"],
        "featureSchemaVersion": "historical-core-v1",
        "promotionEligible": False,
        "targets": {"shots_on_goal": {"candidate": "last_5_mean", "developmentMae": 1.2}},
        "segments": {"forward": {"shots_on_goal": {
            "candidate": "last_5_mean",
            "developmentMae": 1.1,
            "distribution": {
                "kind": "negative_binomial",
                "parameters": {"dispersion": 2.0},
                "residualQuantileOffsets": {"p10": -1.0, "p50": 0.0, "p90": 2.0},
            },
        }}},
    }, "artifactChecksum")
    snapshot = _signed({
        "id": "snapshot-1",
        "contractChecksum": VALID_JOB["researchContractChecksum"],
        "sourceHighWatermark": VALID_JOB["sourceHighWatermark"],
        "rows": [{
            "playerId": 8478402,
            "population": "forward",
            "targetKey": "shots_on_goal",
            "conditioning": "conditional_playing",
            "features": {"last_5_mean": 3.4, "position_prior": 2.1},
        }],
    }, "contentHash")
    payload = {**VALID_JOB, "executionMode": "inference", "modelArtifact": artifact, "featureSnapshots": [snapshot]}
    job = validate_inference_job(payload)
    try:
        run_inference_contract(job)
    except ValueError as error:
        assert "disabled" in str(error)
    else:
        raise AssertionError("disabled inference should fail closed")
    monkeypatch.setenv("PLAYER_FORECAST_ENABLE_INFERENCE", "true")
    first = run_inference_contract(job)
    second = run_inference_contract(job)
    assert first == second
    assert first["outputs"][0]["pointEstimate"] == 3.4
    assert first["outputs"][0]["distributionKind"] == "negative_binomial"
    assert first["outputs"][0]["quantiles"] == {"p10": 2.4, "p50": 3.4, "p90": 5.4}


def test_inference_rejects_tampered_snapshot(monkeypatch):
    monkeypatch.setenv("PLAYER_FORECAST_ENABLE_INFERENCE", "true")
    artifact = _signed({
        "contractVersion": VALID_JOB["researchContractVersion"],
        "contractChecksum": VALID_JOB["researchContractChecksum"],
        "featureSchemaVersion": "historical-core-v1",
        "promotionEligible": False,
        "targets": {},
    }, "artifactChecksum")
    snapshot = {"contentHash": "incorrect", "rows": [], "contractChecksum": VALID_JOB["researchContractChecksum"], "sourceHighWatermark": VALID_JOB["sourceHighWatermark"]}
    job = validate_inference_job({**VALID_JOB, "executionMode": "inference", "modelArtifact": artifact, "featureSnapshots": [snapshot]})
    try:
        run_inference_contract(job)
    except ValueError as error:
        assert "checksum mismatch" in str(error)
    else:
        raise AssertionError("tampered snapshot should fail")


def test_validation_challenger_uses_horizon_calibration_and_stays_private(monkeypatch):
    monkeypatch.setenv("PLAYER_FORECAST_ENABLE_INFERENCE", "true")
    artifact = _signed({
        "modelVersion": "development-validation-v1",
        "contractVersion": VALIDATION_CONTRACT["researchContractVersion"],
        "contractChecksum": VALIDATION_CONTRACT["researchContractChecksum"],
        "promotionEligible": False,
        "segments": {"forward": {"hits": {
            "candidate": "career_rate",
            "developmentRollingOriginMae": 0.9,
        }}},
        "horizonCalibration": {"calibrations": {"forward:hits:H3": {
            "residualQuantileOffsets": {"p10": -1.0, "p50": 0.0, "p90": 2.0},
            "residualVariance": 1.5,
            "pooledFallback": False,
        }}},
    }, "artifactChecksum")
    snapshot = _signed({
        "id": "snapshot-v2",
        "contractChecksum": VALIDATION_CONTRACT["researchContractChecksum"],
        "sourceHighWatermark": VALID_JOB["sourceHighWatermark"],
        "rows": [{
            "playerId": 8478402,
            "population": "forward",
            "targetKey": "hits",
            "conditioning": "conditional_playing",
            "issuedAt": "2026-11-01T10:00:00Z",
            "gameStartTime": "2026-11-04T23:00:00Z",
            "features": {"career_rate": 1.25, "position_prior": 0.9},
        }],
    }, "contentHash")
    payload = {
        **VALID_JOB,
        **VALIDATION_CONTRACT,
        "teamGameHorizon": 3,
        "executionMode": "inference",
        "modelArtifact": artifact,
        "featureSnapshots": [snapshot],
    }
    result = run_inference_contract(validate_inference_job(payload))
    output = result["outputs"][0]
    assert output["pointEstimate"] == 1.25
    assert output["quantiles"] == {"p10": 0.25, "p50": 1.25, "p90": 3.25}
    assert output["distribution"]["variance"] == 1.5
    assert output["fallbackFlags"] == ["validation_only"]


def test_validation_challenger_applies_fold_trained_context(monkeypatch):
    monkeypatch.setenv("PLAYER_FORECAST_ENABLE_INFERENCE", "true")
    artifact = _signed({
        "modelVersion": "development-validation-v1",
        "contractVersion": VALIDATION_CONTRACT["researchContractVersion"],
        "contractChecksum": VALIDATION_CONTRACT["researchContractChecksum"],
        "promotionEligible": False,
        "segments": {"defense": {"hits": {
            "candidate": "contextual_career_rate",
            "developmentRollingOriginMae": 0.8,
        }}},
        "finalContextModels": {"defense:hits:career_rate": {
            "dimensions": [
                "intercept", "base_candidate", "team_position_rate",
                "opponent_allowed_position_rate", "home_indicator", "rest_days",
            ],
            "coefficients": [0.0, 1.0, 1.0, 1.0, 1.0, 1.0],
        }},
        "horizonCalibration": {"calibrations": {"defense:hits:H1": {
            "residualQuantileOffsets": {"p50": 0.0},
            "residualVariance": 1.0,
            "pooledFallback": False,
        }}},
    }, "artifactChecksum")
    snapshot = _signed({
        "id": "snapshot-context-v2",
        "contractChecksum": VALIDATION_CONTRACT["researchContractChecksum"],
        "sourceHighWatermark": VALID_JOB["sourceHighWatermark"],
        "rows": [{
            "playerId": 8478402,
            "population": "defense",
            "targetKey": "hits",
            "conditioning": "conditional_playing",
            "issuedAt": "2026-11-01T10:00:00Z",
            "gameStartTime": "2026-11-02T23:00:00Z",
            "features": {
                "career_rate": 2.0,
                "position_prior": 0.5,
                "team_position_rate": 3.0,
                "opponent_allowed_position_rate": 4.0,
                "home_indicator": 1,
                "rest_days": 2,
            },
        }],
    }, "contentHash")
    result = run_inference_contract(validate_inference_job({
        **VALID_JOB,
        **VALIDATION_CONTRACT,
        "teamGameHorizon": 1,
        "executionMode": "inference",
        "modelArtifact": artifact,
        "featureSnapshots": [snapshot],
    }))
    assert result["outputs"][0]["pointEstimate"] == 12.0
