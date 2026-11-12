"""L15 (2026-11-12): Python twin of web/lib/fantasy-projections/evaluator.ts v2.

The golden file is written by the Vitest twin (WRITE_SEASON_PARITY=1); this
module must reproduce it exactly, means, variances, quantiles and hashes.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from modeling.player_forecasts.season import (
    _aggregate_components,
    _normal_quantile,
    _participation_mixture_quantile,
    _reconcile,
    _reconcile_with_clamps,
    _team_deployment,
    _target_multiplier,
    evaluate_season_game,
)

FIXTURE = (
    Path(__file__).resolve().parents[3]
    / "web/lib/fantasy-projections/__fixtures__/season-evaluator-parity-v2.json"
)


def _fixture() -> dict:
    return json.loads(FIXTURE.read_text())


def _python_game(game: dict) -> dict:
    return {
        "game_id": game["gameId"],
        "team_id": game["teamId"],
        "opponent_team_id": game["opponentTeamId"],
        "is_home": game["isHome"],
        "is_back_to_back": bool(game.get("isBackToBack")),
        "scheduled_start_at": game["scheduledStartAt"],
    }


def _evaluate(fixture: dict, player_id: int, game_id: int) -> dict:
    case = next(
        entry for entry in fixture["cases"]
        if entry["fhfhPlayerId"] == player_id and entry["game"]["gameId"] == game_id
    )
    return evaluate_season_game(
        fixture["artifact"], fixture["artifact"]["players"][str(player_id)], _python_game(case["game"])
    )


def _assert_same(actual, expected, where="root"):
    if isinstance(expected, dict):
        assert isinstance(actual, dict), where
        assert sorted(actual) == sorted(expected), f"{where}: keys {sorted(set(actual) ^ set(expected))}"
        for key in expected:
            _assert_same(actual[key], expected[key], f"{where}.{key}")
    elif isinstance(expected, list):
        assert isinstance(actual, list) and len(actual) == len(expected), where
        for index, (left, right) in enumerate(zip(actual, expected)):
            _assert_same(left, right, f"{where}[{index}]")
    elif isinstance(expected, float) or isinstance(actual, float):
        assert actual == pytest.approx(expected, rel=0, abs=1e-9), where
    else:
        assert actual == expected, where


def test_python_twin_reproduces_typescript_golden_vectors():
    fixture = _fixture()
    assert all("expected" in case for case in fixture["cases"]), "regenerate with WRITE_SEASON_PARITY=1"
    for case in fixture["cases"]:
        actual = _evaluate(fixture, case["fhfhPlayerId"], case["game"]["gameId"])
        _assert_same(actual, case["expected"], f"case {case['fhfhPlayerId']}:{case['game']['gameId']}")
        assert actual["componentHash"] == case["expected"]["componentHash"]
    for entry in fixture["aggregates"]:
        components = [_evaluate(fixture, entry["fhfhPlayerId"], game_id) for game_id in entry["gameIds"]]
        population = components[0]["population"]
        actual = _aggregate_components(components, population, entry["actuals"])
        _assert_same(actual, entry["expected"], f"aggregate {entry['fhfhPlayerId']}")
        assert actual["aggregateHash"] == entry["expected"]["aggregateHash"]


def test_goalie_outcomes_take_no_game_context_multiplier():
    team = {"paceMultiplier": 1.2}
    effect = {"homeMultiplier": 1.3}
    for target in ("WINS_GOALIE", "LOSSES_GOALIE", "OTL_GOALIE", "SHUTOUTS_GOALIE", "QUALITY_STARTS_GOALIE"):
        assert _target_multiplier(target, "goalie", team, team, team, {"is_home": True}, effect) == 1.0
    fixture = _fixture()
    first = _evaluate(fixture, 20, 2026020001)
    second = _evaluate(fixture, 21, 2026020001)
    assert first["conditionalMeans"]["WINS_GOALIE"] == 0.5
    assert first["unconditionalMeans"]["WINS_GOALIE"] + second["unconditionalMeans"]["WINS_GOALIE"] == pytest.approx(0.5)


def test_bernoulli_participation_and_single_multiplier_variance_fallback():
    fixture = _fixture()
    goalie = _evaluate(fixture, 20, 2026020001)
    assert goalie["variances"]["GAMES_PLAYED"] == pytest.approx(0.25)
    assert goalie["variances"]["GAMES_STARTED"] == pytest.approx(0.45 * 0.55)
    skater = _evaluate(fixture, 10, 2026020001)
    mean = 3.1 * 1.2
    assert skater["variances"]["SHOTS_ON_GOAL"] == pytest.approx(0.8 * mean + 0.16 * mean * mean)
    assert "variance_poisson_fallback:SHOTS_ON_GOAL" in skater["momentFlags"]
    assert skater["missingTargets"] == ["TAKEAWAYS"]
    assert "TAKEAWAYS" not in skater["unconditionalMeans"]


def test_undefined_ratios_are_omitted_not_zero():
    empty = _reconcile({}, "goalie")
    for key in ("SAVES_GOALIE", "SAVE_PERCENTAGE", "GOALS_AGAINST_AVERAGE", "WIN_PERCENTAGE_GOALIE"):
        assert key not in empty
    values, clamps = _reconcile_with_clamps(
        {"SHOTS_AGAINST_GOALIE": 1, "GOALS_AGAINST_GOALIE": 2, "GAMES_PLAYED": 0.8,
         "WINS_GOALIE": 0.6, "LOSSES_GOALIE": 0.6, "OTL_GOALIE": 0.2},
        "goalie",
    )
    # PR9: SA = SV + GA holds and decisions fit inside appearances.
    assert values["SHOTS_AGAINST_GOALIE"] == values["SAVES_GOALIE"] + values["GOALS_AGAINST_GOALIE"]
    assert values["WINS_GOALIE"] + values["LOSSES_GOALIE"] + values["OTL_GOALIE"] == pytest.approx(0.8)
    assert {clamp["rule"] for clamp in clamps} == {
        "goals_against_capped_at_shots_against",
        "decisions_scaled_to_appearances",
    }


def test_participation_atom_quantiles_match_the_typescript_formula():
    assert _participation_mixture_quantile(0.1, 0.8, 2.0, 1.0, False) == 0.0
    assert _participation_mixture_quantile(0.9, 0.8, 2.0, 1.0, False) == pytest.approx(
        2 + _normal_quantile(0.875), abs=1e-12
    )
    assert _normal_quantile(0.875) == pytest.approx(1.1503493803760083, abs=1e-8)
    assert _participation_mixture_quantile(0.5, 0.8, 1.0, 0.0, False) == 1.0
    # Plus-minus may go negative below the atom.
    assert _participation_mixture_quantile(0.05, 0.9, 0.0, 1.0, True) < 0


def test_team_deployment_is_an_ice_time_order_with_id_ties():
    def forward(player_id: int, toi: float, play: float) -> dict:
        return {
            "fhfhPlayerId": player_id,
            "population": "forward",
            "playProbability": play,
            "conditionalRates": {"TOTAL_TOI": toi},
        }

    players = [forward(3, 1000, 1), forward(1, 1300, 0), forward(2, 1000, 1)]
    deployment = _team_deployment(players)
    assert deployment["basis"] == "projected_ice_time_order"
    assert deployment["forwardLines"][0] == [2, 3, 1]
    assert _team_deployment(list(reversed(players)))["forwardLines"] == deployment["forwardLines"]
    assert deployment["powerPlayUnits"] is None and deployment["penaltyKillUnits"] is None
    assert math.isfinite(len(deployment["goalieOrder"]))


# --- advanced v5 producer (advanced.py) -------------------------------------

from modeling.player_forecasts.advanced import (  # noqa: E402
    PLAYER_ON_ICE_QUERY,
    _advanced_game_target_moments,
    _build_advanced_observations,
)


def _row_with_primary_assists() -> dict:
    # Astra W3-5 PR2 fixture: conditional A1 .4, variance .4, appearance .8.
    probability = 0.8
    variance = probability * 0.4 + probability * (1 - probability) * 0.4 ** 2
    return {
        "probability": probability,
        "conditional": {"PRIMARY_ASSISTS": 0.4},
        "unconditional": {"PRIMARY_ASSISTS": 0.32},
        "baseline": {"PRIMARY_ASSISTS": 0.3},
        "variances": {"PRIMARY_ASSISTS": variance},
        "quantiles": {"p10": {"PRIMARY_ASSISTS": 0.0}, "p50": {"PRIMARY_ASSISTS": 0.3}, "p90": {"PRIMARY_ASSISTS": 1.0733953795}},
    }


def test_expected_assist_alias_keeps_the_source_variance():
    row = _row_with_primary_assists()
    moments = _advanced_game_target_moments(
        {}, 10, "forward", "EXPECTED_PRIMARY_ASSISTS", row["probability"],
        row["conditional"], row["unconditional"], row["baseline"], row["variances"], row["quantiles"],
    )
    # Was .1753829136 (rebuilt from the zero-clipped interval); TS carries .3456.
    assert moments[2] == pytest.approx(0.3456, abs=1e-12)
    assert moments[1] == 0.32
    # No source head in the row: the alias is unknown, not 0.
    assert _advanced_game_target_moments(
        {}, 10, "forward", "EXPECTED_SECONDARY_ASSISTS", 0.8, {}, {}, {}, {}, {"p10": {}, "p50": {}, "p90": {}},
    ) is None


def test_advanced_residual_variance_and_unknown_rate():
    artifact = {
        "players": {"10": {"rates": {"SHOT_ATTEMPTS": 4}}},
        "targetPolicies": {"forward": {"SHOT_ATTEMPTS": {"baselineRate": 3, "residual80PerGame": 4}}},
    }
    empty = {"p10": {}, "p50": {}, "p90": {}}
    moments = _advanced_game_target_moments(artifact, 10, "forward", "SHOT_ATTEMPTS", 1.0, {}, {}, {}, {}, empty)
    sigma = 4 / 1.2815515655446004
    assert moments[2] == pytest.approx(sigma ** 2)  # not 16 (C17)
    # Interval mean ± residual: the absolute-error interval the gate validated.
    assert moments[3] == pytest.approx(0.0)
    assert moments[5] == pytest.approx(8.0)
    assert _advanced_game_target_moments(artifact, 10, "forward", "EXPECTED_GOALS", 1.0, {}, {}, {}, {}, empty) is None


def test_empty_net_shots_stay_out_of_player_xg(tmp_path):
    def write(name: str, rows: list[dict]) -> None:
        (tmp_path / name).write_text("".join(json.dumps(row) + "\n" for row in rows))

    for name in ("player_on_ice.jsonl", "team_xg.jsonl", "player_rebounds.jsonl", "goalie_xg.jsonl"):
        write(name, [])
    shot = {
        "game_id": 1, "game_date": "2026-01-01", "event_owner_team_id": 1, "shooter_player_id": 8,
        "is_unblocked_shot_attempt": True, "is_shot_on_goal": True, "shot_distance_feet": 50,
        "is_penalty_shot_event": False, "is_shootout_event": False,
    }
    write("shot_features.jsonl", [
        {**shot, "event_id": 1, "is_empty_net_event": False},
        {**shot, "event_id": 2, "is_empty_net_event": True},
    ])
    write("shot_predictions.jsonl", [
        {"prediction_type": "shot_goal", "model_version": "m", "game_id": 1, "event_id": 1,
         "game_date": "2026-01-01", "event_owner_team_id": 1, "shooter_player_id": 8, "xg": 0.1},
        {"prediction_type": "shot_goal", "model_version": "m", "game_id": 1, "event_id": 2,
         "game_date": "2026-01-01", "event_owner_team_id": 1, "shooter_player_id": 8, "xg": 0.6},
    ])
    observations = _build_advanced_observations(
        tmp_path, {10: {"nhlPlayerId": 8, "population": "forward"}}, {"approvedModels": []},
    )
    skater = observations["skaterGames"][(10, 1)]
    assert skater["values"]["EXPECTED_GOALS"] == pytest.approx(0.1)  # decision 7, was 0.7
    assert observations["excludedEmptyNetXgRows"] == 1
    # On-ice xG sums exclude empty-net events and report them apart.
    assert "and not is_empty_net_event" in PLAYER_ON_ICE_QUERY
    assert "on_ice_empty_net_expected_goals_for" in PLAYER_ON_ICE_QUERY


def test_unknown_actual_makes_the_season_total_unknown(tmp_path):
    fixture = _fixture()
    components = [_evaluate(fixture, 11, 2026020001)]
    aggregate = _aggregate_components(components, "defense", {"GOALS": None, "SHOTS_ON_GOAL": 5})
    assert "GOALS" in aggregate["missingTargets"]
    assert "GOALS" not in aggregate["means"] and "POINTS" not in aggregate["means"]
    assert aggregate["means"]["SHOTS_ON_GOAL"] == pytest.approx(
        5 + sum(c["unconditionalMeans"]["SHOTS_ON_GOAL"] for c in components)
    )
