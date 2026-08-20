from __future__ import annotations

import json
import hashlib
from contextlib import contextmanager
from pathlib import Path

import pytest

from modeling.player_forecasts.contract import (
    CONTRACT_SHA256,
    FANTASY_SEASON_CONTRACT_SHA256,
    FANTASY_SEASON_CONTRACT_VERSION,
    SEASON_CONTRACT_SHA256,
    VALIDATION_CONTRACT_SHA256,
    load_and_verify_contract,
)
from modeling.player_forecasts.advanced import (
    evaluate_fantasy_batch,
    freeze_advanced_sources,
)
from modeling.player_forecasts.contract import load_and_verify_validation_contract
from modeling.player_forecasts.contract import load_and_verify_season_contract
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
from modeling.player_forecasts import season as season_module
from modeling.player_forecasts.freeze import freeze_prospective_dataset
from modeling.player_forecasts.io import canonical_json, read_json, write_json
from modeling.player_forecasts.lockbox import evaluate_lockbox_once, evaluate_prospective_once
from modeling.player_forecasts.model import train_baseline
from modeling.player_forecasts.season import (
    _adjusted_defense_ratings,
    _assist_label_audit,
    _actuals_by_player,
    _fit_penalized_rate_glm,
    _glm_prediction,
    _deployment_evidence,
    _normalized_role_probabilities,
    _official_landing_assist_labels,
    _roster_adjusted_team_contexts,
    _official_game_status,
    _portable_canonical_json,
    _quantiles,
    _season_player_fallback_flags,
    _select_rate_policy,
    _team_contexts,
    evaluate_season_game,
    freeze_season_dataset,
)
from modeling.player_forecasts.rookies import (
    evaluate_rookie_transition_model,
    learn_rookie_transition_model,
    normalize_player_landing,
    rookie_projection_profile,
)


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


def test_season_contract_preserves_raw_assist_identity_and_zero_cost_boundary():
    contract = load_and_verify_season_contract()
    assert contract["seasonGamesPerTeam"] == 84
    assert contract["targets"]["derived"]["ASSISTS"] == "PRIMARY_ASSISTS + SECONDARY_ASSISTS"
    assert contract["targets"]["assistPolicy"].endswith("fixed 70:30 and 80:20 weighting is prohibited.")
    settled = contract["evidencePolicy"]["settledOutcomeLabels"]
    assert settled[0]["source"] == "WGO"
    assert "predictive feature" in settled[0]["scope"]
    assert "WGO" not in contract["evidencePolicy"]["excludedWithoutSeparateApproval"]
    assert contract["security"]["cronCanEditOrPublish"] is False


def test_season_team_query_uses_current_utah_mammoth_identity():
    assert "54, 55, 68" in season_module.TEAM_QUERY
    assert "54, 55, 59" not in season_module.TEAM_QUERY


def test_v4_season_contract_requires_learned_rookie_translations():
    contract = load_and_verify_season_contract(FANTASY_SEASON_CONTRACT_VERSION)
    assert contract["rookieModel"]["layers"] == [
        "nhl_roster_probability",
        "expected_nhl_games",
        "conditional_deployment_and_toi",
        "conditional_nhl_rate",
    ]
    assert "chronologically learned" in contract["rookieModel"]["translation"]
    assert contract["modeling"]["sourceEligibility"] == (
        season_module.FANTASY_SOURCE_ELIGIBILITY_POLICY
    )
    assert contract["modeling"]["sourceEligibility"]["minimumEligibleValidationFolds"] == 2


def test_team_contexts_return_schedule_neutral_ratings():
    teams = [
        {"team_id": 1, "abbreviation": "NJD", "name": "New Jersey"},
        {"team_id": 2, "abbreviation": "NYI", "name": "Islanders"},
    ]
    rows = [
        {
            "season_id": 20252026,
            "team_id": 1,
            "opponent_team_id": 2,
            "goals_for": 4,
            "goals_against": 2,
            "shots_for": 32,
            "shots_against": 28,
            "pp_goals": 1,
            "pp_opportunities": 3,
            "pk_goals_against": 0,
            "pk_opportunities": 2,
        },
        {
            "season_id": 20252026,
            "team_id": 2,
            "opponent_team_id": 1,
            "goals_for": 2,
            "goals_against": 4,
            "shots_for": 28,
            "shots_against": 32,
            "pp_goals": 0,
            "pp_opportunities": 2,
            "pk_goals_against": 1,
            "pk_opportunities": 3,
        },
    ]
    contexts = _team_contexts(rows, teams)
    assert set(contexts) == {"1", "2"}
    assert contexts["1"]["ratings"]["overall"] > contexts["2"]["ratings"]["overall"]
    assert contexts["1"]["sampleGames"] == 1


def test_rookie_model_learns_league_transitions_and_separates_roster_probability():
    captures = []
    for player_id in range(100, 140):
        made_nhl = player_id % 2 == 0
        totals = [{
            "season": 20232024,
            "league": "AHL",
            "teamName": "Affiliate",
            "gamesPlayed": 60,
            "goals": 20,
            "assists": 30,
            "points": 50,
            "penaltyMinutes": 40,
            "plusMinus": 0,
        }]
        if made_nhl:
            totals.append({
                "season": 20242025,
                "league": "NHL",
                "teamName": "NHL Club",
                "gamesPlayed": 40,
                "goals": 8,
                "assists": 12,
                "points": 20,
                "penaltyMinutes": 16,
                "plusMinus": 0,
            })
        captures.append({
            "nhlPlayerId": player_id,
            "position": "C",
            "birthDate": "2002-01-01",
            "draftOverall": 64,
            "seasonTotals": totals,
        })
    model = learn_rookie_transition_model(captures)
    assert model["transitionCount"] == 40
    assert 0 < model["leagues"]["AHL"]["rosterProbability"] < 1
    assert 0 < model["leagues"]["AHL"]["equivalencyFactors"]["GOALS"] < 1

    prospect = {
        "nhlPlayerId": 999,
        "position": "C",
        "birthDate": "2003-01-01",
        "draftOverall": 80,
        "seasonTotals": [{
            "season": 20252026,
            "league": "AHL",
            "teamName": "Affiliate",
            "gamesPlayed": 65,
            "goals": 22,
            "assists": 28,
            "points": 50,
            "penaltyMinutes": 30,
            "plusMinus": 5,
        }],
    }
    profile = rookie_projection_profile(prospect, model)
    assert profile["rookie"] is True
    assert 0 < profile["rosterProbability"] < 1
    assert 0 < profile["expectedNhlGames"] <= 84
    assert profile["translatedConditionalRates"]["GOALS"] > 0
    assert profile["nhleMethod"] == "historical_league_transition_empirical_bayes_v1"


def test_rookie_validation_retains_generic_prior_when_holdout_support_is_missing():
    report = evaluate_rookie_transition_model([])
    assert report["eligibleForServing"] is False
    assert report["sufficientSupport"] is False
    assert report["fallbackPolicy"] == "retain_generic_prior_with_wider_uncertainty"


def test_advanced_freeze_rejects_an_unapproved_v4_receipt(tmp_path):
    receipt = tmp_path / "receipt.json"
    write_json(receipt, {
        "schemaVersion": "player-forecast-fantasy-v4-evaluation-v1",
        "contractVersion": FANTASY_SEASON_CONTRACT_VERSION,
        "contractChecksum": "invalid",
        "eligibleForAdvancedBatch": True,
        "receiptHash": "0" * 64,
    })
    with pytest.raises(RuntimeError, match="passing checksum-bound v4 receipt"):
        freeze_advanced_sources("postgresql://unused", tmp_path / "advanced", [], receipt)


def test_v4_batch_receipt_reports_target_and_rookie_gates(tmp_path):
    artifact_dir = tmp_path / "artifact"
    artifact_dir.mkdir()
    policies = {}
    for population, targets in {
        "forward": season_module.SKATER_TARGETS + season_module.SKATER_FANTASY_V4_TARGETS,
        "defense": season_module.SKATER_TARGETS + season_module.SKATER_FANTASY_V4_TARGETS,
        "goalie": season_module.GOALIE_TARGETS + season_module.GOALIE_FANTASY_V4_TARGETS,
    }.items():
        policies[population] = {
            target: {
                "rows": 100,
                "players": 20,
                "modelFamily": "empirical_bayes_rate",
                "baselineModel": "population_rate",
                "validationMae": 0.9,
                "baselineMae": 1.0,
                "chronologicalLift": 0.1,
                "calibration80Coverage": 0.8,
                "calibrationMethod": "rolling_origin_randomized_conformal_p10_p90",
                "fallback": False,
            }
            for target in targets
        }
    artifact = {
        "contractVersion": FANTASY_SEASON_CONTRACT_VERSION,
        "contractChecksum": FANTASY_SEASON_CONTRACT_SHA256,
        "selectionEvidence": policies,
        "review": {"rookieModel": {"validation": {"eligibleForServing": True}}},
    }
    write_json(artifact_dir / "season-artifact.json", artifact)
    artifact_checksum = hashlib.sha256(
        (artifact_dir / "season-artifact.json").read_bytes()
    ).hexdigest()
    write_json(
        artifact_dir / "artifact-manifest.json",
        {"artifactChecksum": artifact_checksum},
    )
    write_json(artifact_dir / "training-report.json", {"targetPolicies": policies})
    receipt = evaluate_fantasy_batch(artifact_dir, tmp_path / "receipt.json")
    assert receipt["eligibleForAdvancedBatch"] is True
    assert receipt["blockers"] == []
    assert len(receipt["receiptHash"]) == 64


def test_official_player_landing_capture_keeps_actual_availability_and_non_nhl_history():
    capture = normalize_player_landing(
        {
            "playerId": 8481538,
            "firstName": {"default": "Judd"},
            "lastName": {"default": "Caulfield"},
            "position": "R",
            "birthDate": "2001-03-19",
            "currentTeamId": 24,
            "draftDetails": {"overallPick": 145},
            "seasonTotals": [{
                "season": 20252026,
                "leagueAbbrev": "AHL",
                "gameTypeId": 2,
                "gamesPlayed": 71,
                "goals": 17,
                "assists": 21,
                "points": 38,
            }],
        },
        expected_player_id=8481538,
        fetched_at="2026-08-18T12:00:00+00:00",
        source_hash="a" * 64,
    )
    assert capture["availableAt"] == "2026-08-18T12:00:00+00:00"
    assert capture["seasonTotals"][0]["league"] == "AHL"


def test_season_assist_label_audit_accepts_settled_disagreements_and_rejects_missing(
    tmp_path,
):
    rows = [
        {
            "season_id": 20232024,
            "game_id": 1,
            "game_date": "2024-01-01",
            "nhl_player_id": 10,
            "PRIMARY_ASSISTS": 1,
            "SECONDARY_ASSISTS": 1,
            "ASSIST_LABEL_ASSISTS": 2,
            "BOX_SCORE_ASSISTS": 1,
            "ASSIST_LABEL_SOURCE": "wgo_frozen_settled_outcome",
        },
        {
            "season_id": 20252026,
            "game_id": 2,
            "game_date": "2026-01-01",
            "nhl_player_id": 11,
            "PRIMARY_ASSISTS": 0,
            "SECONDARY_ASSISTS": 0,
            "ASSIST_LABEL_ASSISTS": 0,
            "BOX_SCORE_ASSISTS": 0,
            "ASSIST_LABEL_SOURCE": "normalized_play_by_play",
        },
    ]
    path = tmp_path / "skaters.jsonl"
    _jsonl(path, rows)
    audit = _assist_label_audit(path, "2026-08-13T12:00:00+00:00")
    assert audit["eligibleForTraining"] is True
    assert audit["resolvedBoxScoreDisagreements"] == 1
    assert audit["unresolvedRows"] == 0
    assert audit["sourceCounts"]["wgo_frozen_settled_outcome"] == 1
    assert audit["predictiveFeatureUse"] is False

    rows[1]["PRIMARY_ASSISTS"] = None
    rows[1]["ASSIST_LABEL_SOURCE"] = "unresolved"
    _jsonl(path, rows)
    invalid = _assist_label_audit(path, "2026-08-13T12:00:00+00:00")
    assert invalid["eligibleForTraining"] is False
    assert invalid["unresolvedRows"] == 1


def test_official_landing_resolution_preserves_assist_order_and_special_teams():
    labels = _official_landing_assist_labels({
        "summary": {
            "scoring": [{
                "goals": [
                    {
                        "playerId": 10,
                        "strength": "pp",
                        "assists": [{"playerId": 11}, {"playerId": 12}],
                    },
                    {
                        "playerId": 11,
                        "strength": "sh",
                        "assists": [{"playerId": 12}],
                    },
                ]
            }]
        }
    })
    assert labels[10] == {
        "primary": 0,
        "secondary": 0,
        "pp": 0,
        "sh": 0,
        "ppGoals": 1,
        "shGoals": 0,
    }
    assert labels[11] == {
        "primary": 1,
        "secondary": 0,
        "pp": 1,
        "sh": 0,
        "ppGoals": 0,
        "shGoals": 1,
    }
    assert labels[12] == {
        "primary": 1,
        "secondary": 1,
        "pp": 1,
        "sh": 1,
        "ppGoals": 0,
        "shGoals": 0,
    }


def test_official_resolution_closes_source_conflicts_and_settled_disagreements(
    tmp_path,
    monkeypatch,
):
    path = tmp_path / "skaters.jsonl"
    _jsonl(path, [
        {
            "season_id": 20252026,
            "game_id": 2025020001,
            "game_date": "2026-01-01",
            "nhl_player_id": 10,
            "PRIMARY_ASSISTS": None,
            "SECONDARY_ASSISTS": None,
            "ASSIST_LABEL_ASSISTS": None,
            "BOX_SCORE_ASSISTS": 1,
            "ASSIST_LABEL_SOURCE": "source_conflict",
            "PP_ASSISTS": None,
            "SH_ASSISTS": None,
            "PP_GOALS": None,
            "SH_GOALS": None,
        },
        {
            "season_id": 20252026,
            "game_id": 2025020001,
            "game_date": "2026-01-01",
            "nhl_player_id": 11,
            "PRIMARY_ASSISTS": 1,
            "SECONDARY_ASSISTS": 0,
            "ASSIST_LABEL_ASSISTS": 1,
            "BOX_SCORE_ASSISTS": 0,
            "ASSIST_LABEL_SOURCE": "normalized_play_by_play",
            "PP_ASSISTS": 0,
            "SH_ASSISTS": 0,
            "PP_GOALS": 0,
            "SH_GOALS": 0,
        },
    ])
    payload = {
        "id": 2025020001,
        "gameState": "OFF",
        "summary": {"scoring": [{"goals": [{
            "playerId": 12,
            "strength": "ev",
            "assists": [{"playerId": 10}],
        }]}]},
    }
    monkeypatch.setattr(
        season_module,
        "_fetch_json_capture",
        lambda _url: (payload, "a" * 64),
    )
    initial = _assist_label_audit(path, "2026-08-13T12:00:00+00:00")
    captures = season_module._resolve_unresolved_assist_labels(
        path,
        initial,
        "2026-08-13T12:00:00+00:00",
    )
    final = _assist_label_audit(path, "2026-08-13T12:00:00+00:00")
    rows = list(season_module.read_jsonl(path))
    assert final["eligibleForTraining"] is True
    assert final["resolvedBoxScoreDisagreements"] == 0
    assert [row["ASSIST_LABEL_SOURCE"] for row in rows] == [
        "official_gamecenter_landing_resolution",
        "official_gamecenter_landing_resolution",
    ]
    assert captures[0]["checkedRows"] == 2
    assert captures[0]["correctedRows"] == 2
    assert captures[0]["resolvedUnresolvedRows"] == 1


def test_season_freeze_can_refresh_current_state_from_verified_historical_core(
    tmp_path, monkeypatch
):
    base = tmp_path / "base"
    base.mkdir()
    _jsonl(base / "games.jsonl", [{"season_id": 20252026, "game_id": 1}])
    _jsonl(base / "skaters.jsonl", [{
        "season_id": 20252026,
        "game_id": 1,
        "game_date": "2026-01-01",
        "nhl_player_id": 8480001,
        "PRIMARY_ASSISTS": 0,
        "SECONDARY_ASSISTS": 0,
        "ASSIST_LABEL_ASSISTS": 0,
        "BOX_SCORE_ASSISTS": 0,
        "ASSIST_LABEL_SOURCE": "normalized_play_by_play",
    }])
    _jsonl(base / "goalies.jsonl", [])
    _jsonl(base / "team_history.jsonl", [{"season_id": 20252026, "team_id": 1}])
    base_audit = _assist_label_audit(
        base / "skaters.jsonl", "2026-08-01T00:00:00+00:00"
    )
    base_audit["preResolutionSourceCounts"] = {
        "normalized_play_by_play": 1,
        "source_conflict": 2,
    }
    base_audit["officialGamecenterResolutions"] = [{
        "checkedRows": 3,
        "correctedRows": 2,
    }]
    write_json(base / "assist-label-audit.json", base_audit)
    write_json(base / "teams.json", [{"team_id": 1, "abbreviation": "AAA", "name": "A"}])
    write_json(base / "season.json", {"id": 20262027, "number_of_games": 84})
    files = {}
    for name, path, rows in (
        ("games", base / "games.jsonl", 1),
        ("skaters", base / "skaters.jsonl", 1),
        ("goalies", base / "goalies.jsonl", 0),
        ("team_history", base / "team_history.jsonl", 1),
        ("assist_label_audit", base / "assist-label-audit.json", 1),
        ("teams", base / "teams.json", 1),
        ("season", base / "season.json", 1),
    ):
        files[name] = {
            "path": path.name,
            "rows": rows,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
    write_json(base / "manifest.json", {
        "createdAt": "2026-08-01T00:00:00+00:00",
        "contractChecksum": SEASON_CONTRACT_SHA256,
        "seasonId": 20262027,
        "trainingCutoffSeason": 20252026,
        "historySeasons": [20232024, 20242025, 20252026, 20262027],
        "files": files,
    })

    class Result:
        def fetchall(self):
            return [{
                "fhfh_player_id": 9,
                "nhl_player_id": 8480001,
                "canonical_name": "Resolved Player",
                "position": "C",
                "team_id": 1,
                "lifecycle_status": "active_nhl",
                "verification_status": "verified",
                "source_provenance": {},
            }]

    class Connection:
        def execute(self, _query, _parameters=()):
            return Result()

    @contextmanager
    def fake_connection(_database_url):
        yield Connection()

    monkeypatch.setattr(season_module, "readonly_connection", fake_connection)
    monkeypatch.setattr(season_module, "stream_query", lambda *_args: iter(()))
    monkeypatch.setattr(season_module, "_official_state", lambda _teams: ([{
        "game_id": 2026020001,
        "game_type": 2,
        "scheduled_start_at": "2026-10-01T23:00:00Z",
        "home_team_id": 1,
        "away_team_id": 2,
        "game_status": "scheduled",
        "source_revision_key": "revision",
    }], [{
        "nhl_player_id": 8480001,
        "team_id": 1,
        "position": "C",
        "player_name": "Resolved Player",
        "official_roster": True,
    }], []))

    output = tmp_path / "refreshed"
    manifest = freeze_season_dataset("postgresql://local", output, [], base)

    assert manifest["baseFreeze"]["inheritedHistoricalFiles"] == [
        "games", "skaters", "goalies", "team_history"
    ]
    assert manifest["publicationBlockers"]["unmappedOfficialRosterPlayers"] == 0
    assert manifest["assistLabelPolicy"]["detectedSourceConflictRows"] == 2
    assert manifest["assistLabelPolicy"]["officialGamecenterCheckedRows"] == 3
    assert manifest["assistLabelPolicy"]["officialGamecenterCorrectedRows"] == 2
    assert read_json(output / "player-pool.json")[0]["fhfh_player_id"] == 9
    assert (output / "skaters.jsonl").read_bytes() == (base / "skaters.jsonl").read_bytes()


def test_season_game_evaluation_is_deterministic_and_uses_portable_hashing():
    player = {
        "fhfhPlayerId": 10,
        "population": "forward",
        "playProbability": 0.75,
        "conditionalRates": {
            "GAMES_PLAYED": 1,
            "GOALS": 0.25,
            "PRIMARY_ASSISTS": 0.2,
            "SECONDARY_ASSISTS": 0.1,
        },
        "conditionalVariances": {},
        "deployment": {"roleProbabilities": {"F1": 0.7, "alternative": 0.3}},
        "fallbackFlags": [],
    }
    artifact = {
        "teams": {
            "1": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
            "2": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
        }
    }
    game = {"game_id": 2026020001, "team_id": 1, "opponent_team_id": 2}
    first = evaluate_season_game(artifact, player, game)
    second = evaluate_season_game(artifact, player, game)
    assert first == second
    assert first["unconditionalMeans"]["ASSISTS"] == pytest.approx(0.225)
    assert first["quantiles"]["p90"]["GAMES_PLAYED"] <= 1
    assert "e-" not in _portable_canonical_json({"small": 0.0000560308})


def test_season_game_does_not_apply_own_team_offense_to_player_rates_twice():
    player = {
        "fhfhPlayerId": 10,
        "population": "forward",
        "playProbability": 1,
        "conditionalRates": {"GAMES_PLAYED": 1, "GOALS": 0.5},
        "conditionalVariances": {},
        "deployment": {},
        "fallbackFlags": [],
    }
    game = {"game_id": 2026020001, "team_id": 1, "opponent_team_id": 2}
    neutral = evaluate_season_game({"teams": {
        "1": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
        "2": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
    }}, player, game)
    strong_team = evaluate_season_game({"teams": {
        "1": {"offenseMultiplier": 1.3, "defenseMultiplier": 1, "paceMultiplier": 1},
        "2": {"offenseMultiplier": 1, "defenseMultiplier": 1, "paceMultiplier": 1},
    }}, player, game)
    assert strong_team["conditionalMeans"]["GOALS"] == neutral["conditionalMeans"]["GOALS"]


def test_season_derived_quantiles_are_ordered_and_propagate_primitive_uncertainty():
    goalie = _quantiles(
        {
            "SHOTS_AGAINST_GOALIE": 1000,
            "GOALS_AGAINST_GOALIE": 90,
            "TOTAL_TOI": 120000,
        },
        {
            "SHOTS_AGAINST_GOALIE": 10000,
            "GOALS_AGAINST_GOALIE": 400,
            "TOTAL_TOI": 1000000,
        },
        "goalie",
    )
    for target in ("SAVES_GOALIE", "SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE"):
        assert goalie["p10"][target] <= goalie["p50"][target] <= goalie["p90"][target]

    skater = _quantiles(
        {"GOALS": 20, "PRIMARY_ASSISTS": 25, "SECONDARY_ASSISTS": 15},
        {"GOALS": 9, "PRIMARY_ASSISTS": 16, "SECONDARY_ASSISTS": 9},
        "forward",
    )
    assert skater["p10"]["ASSISTS"] < skater["p50"]["ASSISTS"] < skater["p90"]["ASSISTS"]
    assert skater["p50"]["POINTS"] == pytest.approx(60)


def test_season_defense_rating_rewards_team_and_opponent_adjusted_suppression():
    common = {
        "season_id": 20252026,
        "game_id": 1,
        "game_date": "2026-01-01",
        "team_id": 1,
        "opponent_team_id": 2,
        "position": "D",
        "toi_seconds": 1200,
        "team_chances_against": 30,
        "team_goals_against": 3,
    }
    ratings = _adjusted_defense_ratings([
        {**common, "nhl_player_id": 10, "chances_against": 5, "goals_against": 0},
        {**common, "nhl_player_id": 11, "chances_against": 15, "goals_against": 2},
    ])
    assert ratings[10] > ratings[11]
    assert _season_player_fallback_flags(False, "defense", 10, ratings) == []
    assert _season_player_fallback_flags(False, "forward", 99, ratings) == [
        "defense_rating_plus_minus_fallback"
    ]


def test_season_actuals_require_pregame_completion_and_source_availability(tmp_path):
    _jsonl(tmp_path / "games.jsonl", [
        {"game_id": 1, "start_time": "2026-10-01T23:00:00+00:00"},
        {"game_id": 2, "start_time": "2026-10-02T23:00:00+00:00"},
    ])
    _jsonl(tmp_path / "skaters.jsonl", [
        {
            "season_id": 20262027,
            "game_id": 1,
            "nhl_player_id": 10,
            "source_available_at": "2026-10-02T07:00:00+00:00",
            "GOALS": 1,
        },
        {
            "season_id": 20262027,
            "game_id": 2,
            "nhl_player_id": 10,
            "source_available_at": "2026-10-02T07:00:00+00:00",
            "GOALS": 99,
        },
    ])
    _jsonl(tmp_path / "goalies.jsonl", [])
    before_available = _actuals_by_player(tmp_path, "2026-10-02T06:00:00+00:00")
    after_available = _actuals_by_player(tmp_path, "2026-10-02T10:00:00+00:00")
    assert before_available == {}
    assert after_available[10]["GOALS"] == 1


@pytest.mark.parametrize(("payload", "expected"), [
    ({"gameState": "FUT", "gameScheduleState": "OK"}, "scheduled"),
    ({"gameState": "LIVE", "gameScheduleState": "OK"}, "started"),
    ({"gameState": "OFF", "gameScheduleState": "OK"}, "final"),
    ({"gameState": "FUT", "gameScheduleState": "PPD"}, "postponed"),
])
def test_season_schedule_normalizes_official_game_state(payload, expected):
    assert _official_game_status(payload) == expected


def test_season_penalized_glm_fits_a_finite_nonnegative_rate():
    rows = [
        {
            "game_date": f"2025-10-{game + 1:02d}",
            "season_id": 20252026,
            "nhl_player_id": player,
            "GOALS": (player + game) % 3,
            "TOTAL_TOI": 900 + player * 10,
        }
        for player in range(1, 13)
        for game in range(2)
    ]
    coefficients = _fit_penalized_rate_glm(rows, "GOALS", 0.85, 10.0, None)
    assert coefficients is not None
    prediction = _glm_prediction(coefficients, 0.5, 1000, "GOALS")
    assert 0 <= prediction < 100


def test_season_target_tournament_serves_population_baseline_when_challengers_lose():
    rows = []
    for player in range(1, 13):
        historical = 0 if player % 2 else 10
        rows.append({
            "game_date": "2025-10-01",
            "season_id": 20252026,
            "nhl_player_id": player,
            "GOALS": historical,
            "TOTAL_TOI": 1000,
        })
        for game_date in ("2025-11-01", "2025-12-16", "2026-02-16"):
            rows.append({
                "game_date": game_date,
                "season_id": 20252026,
                "nhl_player_id": player,
                "GOALS": 10 - historical,
                "TOTAL_TOI": 1000,
            })
    policy = _select_rate_policy(rows, "GOALS")
    assert policy["modelFamily"] == "population_rate"
    assert policy["baselineModel"] == "population_rate"
    assert policy["validationMae"] == pytest.approx(policy["baselineMae"])
    assert policy["chronologicalLift"] == 0
    assert policy["fallback"] is True
    assert 0.75 <= policy["calibration80Coverage"] <= 0.85
    assert policy["calibrationMethod"] == "rolling_origin_randomized_conformal_p10_p90"
    assert policy["intervalVarianceScale"] >= 0


def test_season_deployment_evidence_uses_processed_sources_and_reconciles_roles():
    evidence = _deployment_evidence(
        [{
            "season_id": 20252026,
            "nhl_player_id": 10,
            "deployment_group": "forward",
            "deployment_code": "F2_C",
            "share": 0.6,
            "games": 20,
            "team_ids": [1],
            "source_table": "lineCombinations",
        }],
        [{
            "source_table": "lines_nhl",
            "capture_key": "trusted-1",
            "team_id": 1,
            "available_at": "2026-08-12T12:00:00+00:00",
            "line_1_player_ids": [10],
            "line_2_player_ids": [],
            "line_3_player_ids": [],
            "line_4_player_ids": [],
            "pair_1_player_ids": [],
            "pair_2_player_ids": [],
            "pair_3_player_ids": [],
            "goalie_1_player_id": None,
            "goalie_2_player_id": None,
            "scratches_player_ids": [],
            "injured_player_ids": [],
        }],
        "2026-08-13T12:00:00+00:00",
    )
    probabilities = _normalized_role_probabilities(
        dict(evidence[(10, 1)]["families"]["forwardLine"])
    )
    assert max(probabilities, key=probabilities.get) == "F1"
    assert sum(probabilities.values()) == pytest.approx(1)


def test_season_team_context_is_recomputed_from_current_roster_membership():
    contexts = {
        str(team_id): {
            "teamId": team_id,
            "offenseMultiplier": 1,
            "defenseMultiplier": 1,
            "paceMultiplier": 1,
            "ratings": {"pace": 50},
            "projectedGoalsFor": 3,
            "projectedGoalsAgainst": 3,
            "sampleGames": 82,
        }
        for team_id in (1, 2)
    }
    players = {
        "10": {
            "teamId": 1,
            "poolStatus": "verified_active",
            "population": "forward",
            "playProbability": 1,
            "conditionalRates": {"GOALS": 2, "PP_GOALS": 1, "PP_ASSISTS": 0, "TOTAL_TOI": 1200, "PK_TOI": 0},
            "ratingSignals": {"defenseSuppressionPer60": 0},
        },
        "11": {
            "teamId": 2,
            "poolStatus": "verified_active",
            "population": "forward",
            "playProbability": 1,
            "conditionalRates": {"GOALS": 1, "PP_GOALS": 0, "PP_ASSISTS": 0, "TOTAL_TOI": 1200, "PK_TOI": 0},
            "ratingSignals": {"defenseSuppressionPer60": 0},
        },
    }
    adjusted = _roster_adjusted_team_contexts(contexts, players)
    assert adjusted["1"]["ratings"]["offense"] > adjusted["2"]["ratings"]["offense"]
    assert adjusted["1"]["scheduleNeutralGoalDifferential"] > adjusted["2"]["scheduleNeutralGoalDifferential"]


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
