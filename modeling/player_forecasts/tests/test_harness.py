from __future__ import annotations

import json
import hashlib
from contextlib import contextmanager
from pathlib import Path

import pytest

from modeling.player_forecasts.contract import (
    CONTRACT_SHA256,
    VALIDATION_CONTRACT_SHA256,
    load_and_verify_contract,
)
from modeling.player_forecasts.contract import load_and_verify_validation_contract
from modeling.player_forecasts.aggregation import aggregate_rest_of_season
from modeling.player_forecasts.challenger_math import (
    assist_candidate_features,
    fit_hierarchical_hits,
    fit_horizon_residual_quantiles,
    hierarchical_hits_prediction,
    official_assist_expectation,
)
from modeling.player_forecasts.challenger_features import build_validation_features
from modeling.player_forecasts.challenger_inference import infer_conditional_game
from modeling.player_forecasts.challenger_model import verify_validation_challenger_artifact
from modeling.player_forecasts.features import build_features, parse_toi
from modeling.player_forecasts.horizons import reconstructed_vintages, team_schedules
from modeling.player_forecasts import freeze as freeze_module
from modeling.player_forecasts.freeze import freeze_prospective_dataset
from modeling.player_forecasts.io import canonical_json, read_json, write_json
from modeling.player_forecasts.lockbox import evaluate_lockbox_once, evaluate_prospective_once
from modeling.player_forecasts.model import train_baseline


def _jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text("".join(f"{json.dumps(row)}\n" for row in rows), encoding="utf-8")


def _freeze(tmp_path: Path) -> Path:
    write_json(tmp_path / "manifest.json", {"contractChecksum": CONTRACT_SHA256, "files": {}})
    _jsonl(tmp_path / "skaters.jsonl", [
        {"game_date": "2025-12-01", "season_id": 20252026, "game_id": 1, "player_id": 10, "position": "C", "goals": 1, "assists": 0, "shots_on_goal": 3, "blocked_shots": 0, "hits": 1, "penalty_minutes": 0, "toi": "18:00"},
        {"game_date": "2025-12-03", "season_id": 20252026, "game_id": 2, "player_id": 10, "position": "C", "goals": 0, "assists": 1, "shots_on_goal": 2, "blocked_shots": 1, "hits": 2, "penalty_minutes": 2, "toi": "17:30"},
        {"game_date": "2026-01-04", "season_id": 20252026, "game_id": 3, "player_id": 10, "position": "C", "goals": 1, "assists": 1, "shots_on_goal": 4, "blocked_shots": 0, "hits": 1, "penalty_minutes": 0, "toi": "19:00"},
    ])
    _jsonl(tmp_path / "goalies.jsonl", [])
    features = build_features(tmp_path)
    manifest = read_json(tmp_path / "manifest.json")
    manifest["features"] = features
    write_json(tmp_path / "manifest.json", manifest)
    train_baseline(tmp_path)
    return tmp_path


def test_contract_checksum_is_bound_to_canonical_document():
    assert load_and_verify_contract()["contractVersion"] == "player-forecasts-research-v1"


def test_validation_contract_preserves_consumed_lockbox():
    contract = load_and_verify_validation_contract()
    assert contract["evidencePolicy"]["consumedPrimaryLockbox"]["additionalEvaluationsAllowed"] == 0
    assert contract["acceptance"]["promotionEligible"] is False


def test_validation_challenger_verifier_enforces_lockbox_and_promotion_guards(tmp_path):
    payload = {
        "contractVersion": "player-forecasts-research-v2-validation",
        "contractChecksum": VALIDATION_CONTRACT_SHA256,
        "evidenceClassification": "validation_not_blind_evidence",
        "consumedLockboxRead": False,
        "promotionEligible": False,
        "segments": {"forward": {"hits": {"candidate": "career_rate"}}},
        "horizonCalibration": {"calibrations": {"forward:hits:H1": {"rows": 1}}},
    }
    payload["artifactChecksum"] = hashlib.sha256(canonical_json(payload).encode()).hexdigest()
    artifact_path = tmp_path / "artifact.json"
    write_json(artifact_path, payload)
    assert verify_validation_challenger_artifact(artifact_path)["promotionEligible"] is False
    payload["promotionEligible"] = True
    write_json(artifact_path, payload)
    with pytest.raises(RuntimeError, match="checksum mismatch"):
        verify_validation_challenger_artifact(artifact_path)


def test_assist_decomposition_preserves_official_total_and_keeps_weighted_features_separate():
    assert official_assist_expectation(0.4, 0.2) == pytest.approx(0.6)
    features = assist_candidate_features(0.4, 0.2)
    assert features["decomposed_sum"] == pytest.approx(0.6)
    assert features["play_driver_70_30"] == pytest.approx(0.34)
    assert features["play_driver_80_20"] == pytest.approx(0.36)


def test_reconstructed_horizons_are_game_specific_and_stop_before_puck_drop():
    games = [
        {"id": index, "date": f"2025-10-{index:02d}", "start_time": f"2025-10-{index:02d}T23:00:00+00:00", "home_team_id": 1, "away_team_id": 2}
        for index in range(1, 13)
    ]
    schedule = team_schedules(games)[1]
    vintages = reconstructed_vintages(schedule, 12)
    checkpoints = [row for row in vintages if row["vintage_kind"] == "horizon_checkpoint"]
    assert [row["team_game_horizon"] for row in checkpoints] == list(range(10, 0, -1))
    assert all(row["opponent_team_id"] == 2 for row in vintages)
    assert all(row["issued_at"] < "2025-10-12T23:00:00+00:00" for row in vintages)


def test_horizon_calibration_does_not_invent_monotonic_widening():
    calibration = fit_horizon_residual_quantiles([
        {"population": "forward", "target_key": "hits", "team_game_horizon": 1, "outcome": 2, "prediction": 1},
        {"population": "forward", "target_key": "hits", "team_game_horizon": 10, "outcome": 1, "prediction": 1},
    ])
    assert calibration["monotonicWideningAssumed"] is False
    assert calibration["calibrations"]["forward:hits:H2"]["pooledFallback"] is True
    assert calibration["calibrations"]["forward:hits:H10"]["pooledFallback"] is False
    assert calibration["calibrations"]["forward:hits:H1"]["residualVariance"] == 0


def test_rest_of_season_keeps_conditional_and_unconditional_semantics_distinct():
    games = [
        {"mean": 1.0, "variance": 1.5, "plays_probability": 0.5, "schedule_revision_id": "r1"},
        {"mean": 2.0, "variance": 2.5, "plays_probability": 0.75, "schedule_revision_id": "r1"},
    ]
    conditional = aggregate_rest_of_season(games, semantics="conditional", season_to_date_actual=10)
    unconditional = aggregate_rest_of_season(games, semantics="unconditional", season_to_date_actual=10)
    assert conditional["remainingMean"] == pytest.approx(3)
    assert unconditional["remainingMean"] == pytest.approx(2)
    assert conditional["fullSeasonMean"] == pytest.approx(13)
    with pytest.raises(ValueError, match="plays_probability"):
        aggregate_rest_of_season([{"mean": 1, "variance": 1}], semantics="unconditional")


def test_hits_partial_pooling_learns_prior_strength_from_development_records():
    artifact = fit_hierarchical_hits([
        {"position": "C", "player_id": 1, "hits": 1, "time_on_ice_seconds": 1000},
        {"position": "C", "player_id": 2, "hits": 5, "time_on_ice_seconds": 1000},
        {"position": "C", "player_id": 3, "hits": 10, "time_on_ice_seconds": 1000},
    ])
    sparse = hierarchical_hits_prediction(
        artifact,
        position="C",
        prior_hits=0,
        prior_time_on_ice_seconds=10,
        projected_time_on_ice_seconds=1000,
    )
    established = hierarchical_hits_prediction(
        artifact,
        position="C",
        prior_hits=100,
        prior_time_on_ice_seconds=10000,
        projected_time_on_ice_seconds=1000,
    )
    position_mean = artifact["priors"]["C"]["meanRatePerSecond"] * 1000
    assert abs(sparse - position_mean) < abs(established - position_mean)


def test_validation_features_are_rebuilt_at_each_issued_cutoff(tmp_path):
    write_json(tmp_path / "manifest.json", {
        "contractChecksum": VALIDATION_CONTRACT_SHA256,
        "targetSeason": 20252026,
    })
    _jsonl(tmp_path / "games.jsonl", [
        {"id": 1, "date": "2025-10-01", "season_id": 20252026, "start_time": "2025-10-01T23:00:00+00:00", "home_team_id": 1, "away_team_id": 2},
        {"id": 2, "date": "2025-10-03", "season_id": 20252026, "start_time": "2025-10-03T23:00:00+00:00", "home_team_id": 2, "away_team_id": 1},
        {"id": 3, "date": "2025-10-05", "season_id": 20252026, "start_time": "2025-10-05T23:00:00+00:00", "home_team_id": 1, "away_team_id": 2},
    ])
    common = {
        "season_id": 20252026,
        "player_id": 10,
        "position": "C",
        "team_id": 1,
        "goals": 0,
        "shots_on_goal": 2,
        "blocked_shots": 0,
        "hits": 1,
        "penalty_minutes": 0,
        "toi": "18:00",
        "official_assist_decomposition_complete": True,
    }
    _jsonl(tmp_path / "skaters.jsonl", [
        {**common, "game_date": "2025-10-01", "start_time": "2025-10-01T23:00:00+00:00", "game_id": 1, "assists": 1, "primary_assists": 1, "secondary_assists": 0},
        {**common, "game_date": "2025-10-05", "start_time": "2025-10-05T23:00:00+00:00", "game_id": 3, "assists": 1, "primary_assists": 0, "secondary_assists": 1},
    ])
    result = build_validation_features(tmp_path)
    rows = [json.loads(line) for line in (tmp_path / result["path"]).read_text().splitlines()]
    target_assists = [row for row in rows if row["game_id"] == 3 and row["target_key"] == "assists"]
    by_horizon = {row["team_game_horizon"]: row for row in target_assists if row["vintage_kind"] == "horizon_checkpoint"}
    assert by_horizon[3]["features"]["history_count"] == 0
    assert by_horizon[2]["features"]["history_count"] == 1
    assert by_horizon[1]["cutoff_at"] < by_horizon[1]["game_start_time"]
    assert by_horizon[2]["features"]["decomposed_sum_career_rate"] == pytest.approx(1)


def test_validation_inference_is_horizon_bound_and_stays_non_promotable():
    unsigned = {
        "modelVersion": "test-v1",
        "contractVersion": "player-forecasts-research-v2-validation",
        "contractChecksum": VALIDATION_CONTRACT_SHA256,
        "promotionEligible": False,
        "segments": {"forward": {"hits": {"candidate": "career_rate"}}},
        "horizonCalibration": {"calibrations": {"forward:hits:H3": {
            "residualQuantileOffsets": {"p10": -1, "p50": 0, "p90": 2},
            "residualVariance": 1.5,
            "pooledFallback": False,
        }}},
    }
    artifact = {**unsigned, "artifactChecksum": hashlib.sha256(canonical_json(unsigned).encode()).hexdigest()}
    result = infer_conditional_game(artifact, {
        "player_id": 10,
        "target_game_id": 20,
        "population": "forward",
        "target_key": "hits",
        "team_game_horizon": 3,
        "issued_at": "2026-10-01T10:00:00+00:00",
        "cutoff_at": "2026-10-01T10:00:00+00:00",
        "game_start_time": "2026-10-05T23:00:00+00:00",
        "team_id": 1,
        "opponent_team_id": 2,
        "home_away": "home",
        "rest_days": 1,
        "features": {"career_rate": 1.25, "position_prior": 0.9},
    })
    assert result["pointEstimate"] == pytest.approx(1.25)
    assert result["quantiles"]["p10"] == pytest.approx(0.25)
    assert result["variance"] == pytest.approx(1.5)
    assert result["promotionEligible"] is False


def test_toi_parser_uses_seconds():
    assert parse_toi("18:30") == 1110


def test_features_never_use_same_day_or_future_outcomes(tmp_path):
    freeze = _freeze(tmp_path)
    rows = [json.loads(line) for line in (freeze / "features.jsonl").read_text().splitlines()]
    first_goals = next(row for row in rows if row["game_id"] == 1 and row["target_key"] == "goals")
    second_goals = next(row for row in rows if row["game_id"] == 2 and row["target_key"] == "goals")
    assert first_goals["features"]["history_count"] == 0
    assert second_goals["features"]["career_mean"] == 1


def test_training_replay_is_checksum_deterministic(tmp_path):
    freeze = _freeze(tmp_path)
    first = train_baseline(freeze)["artifactChecksum"]
    second = train_baseline(freeze)["artifactChecksum"]
    assert first == second


def test_lockbox_requires_confirmation_and_is_single_use(tmp_path, monkeypatch):
    freeze = _freeze(tmp_path / "freeze")
    receipt = tmp_path / "receipt.json"
    with pytest.raises(RuntimeError, match="confirmation"):
        evaluate_lockbox_once(freeze, receipt)
    monkeypatch.setenv("PLAYER_FORECAST_LOCKBOX_CONFIRM", "2025-26-primary-once")
    with pytest.raises(RuntimeError, match="not approved"):
        evaluate_lockbox_once(freeze, receipt)
    artifact = read_json(freeze / "model-artifact.json")
    artifact["lockboxReady"] = True
    artifact.pop("artifactChecksum")
    import hashlib
    artifact["artifactChecksum"] = hashlib.sha256(canonical_json(artifact).encode()).hexdigest()
    write_json(freeze / "model-artifact.json", artifact)
    evaluate_lockbox_once(freeze, receipt)
    with pytest.raises(RuntimeError, match="already exists"):
        evaluate_lockbox_once(freeze, receipt)

    monkeypatch.setenv("PLAYER_FORECAST_PROSPECTIVE_CONFIRM", "2026-27-fixed-artifact-once")
    with pytest.raises(RuntimeError, match="2026-27 target season"):
        evaluate_prospective_once(
            freeze,
            receipt,
            tmp_path / "prospective.json",
            "2026-10-01",
            "2026-10-31",
        )


def test_prospective_freeze_binds_fixed_artifact_and_target_season(tmp_path, monkeypatch):
    unsigned_artifact = {
        "contractChecksum": CONTRACT_SHA256,
        "contractVersion": "player-forecasts-research-v1",
        "modelKey": "fixed-test",
        "modelVersion": "v1",
        "featureSchemaVersion": "historical-core-v2",
        "promotionEligible": False,
        "targets": {"goals": {"candidate": "position_prior"}},
        "segments": {"forward": {"goals": {"candidate": "position_prior"}}},
    }
    artifact = {
        **unsigned_artifact,
        "artifactChecksum": hashlib.sha256(canonical_json(unsigned_artifact).encode()).hexdigest(),
    }
    unsigned_receipt = {
        "contractChecksum": CONTRACT_SHA256,
        "artifactChecksum": artifact["artifactChecksum"],
        "primaryEvaluationOrdinal": 1,
    }
    receipt = {
        **unsigned_receipt,
        "receiptChecksum": hashlib.sha256(canonical_json(unsigned_receipt).encode()).hexdigest(),
    }
    artifact_path = tmp_path / "fixed-artifact.json"
    receipt_path = tmp_path / "primary-receipt.json"
    write_json(artifact_path, artifact)
    write_json(receipt_path, receipt)

    @contextmanager
    def fake_connection(_database_url):
        yield object()

    rows = {
        "player_forecast_games": [
            {"id": 1, "date": "2026-04-01", "season_id": 20252026, "start_time": "2026-04-01T23:00:00Z", "type": 2, "home_team_id": 1, "away_team_id": 2},
            {"id": 2, "date": "2026-10-10", "season_id": 20262027, "start_time": "2026-10-10T23:00:00Z", "type": 2, "home_team_id": 1, "away_team_id": 2},
        ],
        "player_forecast_skaters": [
            {"game_date": "2026-04-01", "season_id": 20252026, "game_id": 1, "player_id": 10, "position": "C", "goals": 1, "assists": 0, "shots_on_goal": 2, "blocked_shots": 0, "hits": 1, "penalty_minutes": 0, "toi": "18:00"},
            {"game_date": "2026-10-10", "season_id": 20262027, "game_id": 2, "player_id": 10, "position": "C", "goals": 2, "assists": 1, "shots_on_goal": 4, "blocked_shots": 0, "hits": 1, "penalty_minutes": 0, "toi": "19:00"},
        ],
        "player_forecast_goalies": [],
    }
    monkeypatch.setattr(freeze_module, "readonly_connection", fake_connection)
    monkeypatch.setattr(
        freeze_module,
        "stream_query",
        lambda _connection, name, _query, _parameters: iter(rows[name]),
    )
    freeze = tmp_path / "prospective-freeze"
    manifest = freeze_prospective_dataset(
        "read-only-test",
        freeze,
        [20252026],
        artifact_path,
        receipt_path,
    )
    assert manifest["targetSeason"] == 20262027
    assert manifest["prospective"]["artifactChecksum"] == artifact["artifactChecksum"]
    features = build_features(freeze)
    manifest = read_json(freeze / "manifest.json")
    manifest["features"] = features
    write_json(freeze / "manifest.json", manifest)
    monkeypatch.setenv("PLAYER_FORECAST_PROSPECTIVE_CONFIRM", "2026-27-fixed-artifact-once")
    evidence = evaluate_prospective_once(
        freeze,
        receipt_path,
        tmp_path / "prospective-evidence.json",
        "2026-10-01",
        "2026-10-31",
    )
    assert evidence["evidenceKind"] == "untouched_prospective"
    assert evidence["tuningPermitted"] is False
    assert evidence["metrics"]["targets"]["goals"]["rows"] == 1
