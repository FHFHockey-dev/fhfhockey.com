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


# --- decision 66: starter-board baseline issuer -----------------------------

def _issuer_setup(tmp_path, monkeypatch):
    from datetime import datetime, timezone

    from modeling.player_forecasts import daily_board_baseline_issuance as module
    from tests.test_harness import baseline_issuance_fixture

    freeze, candidate = baseline_issuance_fixture(tmp_path)

    class Clock:
        @staticmethod
        def now(tz):
            return datetime(2026, 10, 10, 20, tzinfo=timezone.utc)

    monkeypatch.setattr(module, "datetime", Clock)
    return module, freeze, candidate


def test_issuer_labels_the_fixed_policy_when_no_selection_artifact(tmp_path, monkeypatch):
    module, freeze, candidate = _issuer_setup(tmp_path, monkeypatch)
    manifest = module.issue_baselines(freeze, candidate, tmp_path / "issued")
    assert manifest["selection"]["status"] == "no_selected_artifact"
    assert manifest["selection"]["policyRole"] == "separately_named_fixed_baseline"
    assert manifest["trainingCutoff"] == "2025-10-05"
    assert manifest["version"] == "starter-board-prospective-baselines-v1"  # issued policy unchanged
    module.verify_issued_baselines(tmp_path / "issued")


def test_issuer_consumes_only_the_exact_selected_artifact(tmp_path, monkeypatch):
    from modeling.player_forecasts.io import write_json

    module, freeze, candidate = _issuer_setup(tmp_path, monkeypatch)
    selection = tmp_path / "selection.json"
    write_json(selection, {
        "selectedPolicyVersion": module.POLICY["version"], "selectedPolicy": module.POLICY,
        "trainingCutoffAt": "2026-09-30T00:00:00+00:00", "selectionEvidence": {"heldOutGames": 10},
    })
    manifest = module.issue_baselines(freeze, candidate, tmp_path / "issued", selection)
    assert manifest["selection"]["status"] == "selected_artifact"
    assert manifest["selection"]["selectionEvidence"] == {"heldOutGames": 10}
    # A different policy, a stale/future artifact or a missing file is refused.
    write_json(selection, {"selectedPolicyVersion": "other-v9", "selectedPolicy": {}, "trainingCutoffAt": "2026-09-30T00:00:00+00:00"})
    with pytest.raises(ValueError, match="exact policy"):
        module.issue_baselines(freeze, candidate, tmp_path / "issued-2", selection)
    write_json(selection, {"selectedPolicyVersion": module.POLICY["version"], "selectedPolicy": module.POLICY,
        "trainingCutoffAt": "2026-12-01T00:00:00+00:00"})
    with pytest.raises(ValueError, match="stale"):
        module.issue_baselines(freeze, candidate, tmp_path / "issued-3", selection)
    with pytest.raises(ValueError, match="missing"):
        module.issue_baselines(freeze, candidate, tmp_path / "issued-4", tmp_path / "absent.json")
    assert not (tmp_path / "issued-2").exists() and not (tmp_path / "issued-4").exists()


# --- W2-7 D2 / decision 65: proper-score selection (new experiment) ----------

def test_squared_error_selection_prefers_the_true_mean_where_mae_prefers_zero():
    from modeling.player_forecasts.forge_walk_forward import PROPER_SCORE_SELECTION, select_method

    # Exact Poisson(0.2) frequencies on 1000 player-games (frozen fixture).
    outcomes = [0] * 819 + [1] * 164 + [2] * 16 + [3] * 1
    rows, labels = [], []
    for index, value in enumerate(outcomes):
        rows.append({"playerId": index, "gameId": 1, "teamId": 1, "membershipValid": True, "onTime": True,
                     "issuedAt": "2026-10-14T10:00:00-04:00",
                     "estimates": {"A": {"mean": 0.2}, "B": {"mean": 0.0}, "C": {"mean": 0.5}}})
        labels.append({"playerId": index, "gameId": 1, "teamId": 1, "gameDate": "2026-10-14",
                       "status": "positive_TOI", "availableAt": "2026-10-15T10:00:00-04:00", "value": value})
    cutoff = "2026-10-19T10:00:00-04:00"
    # The issued pilot rule (MAE) picks the zero forecast: .200 < .327.
    assert select_method(rows, labels, cutoff)["selected"] == "B"
    proper = select_method(rows, labels, cutoff, score="squared_error")
    assert proper["selected"] == "A"
    assert proper["methods"]["A"]["mse"] < proper["methods"]["B"]["mse"]
    assert proper["selectionPolicy"] == PROPER_SCORE_SELECTION


def test_participation_uses_completed_team_games_not_82():
    from modeling.player_forecasts.season import _participation_summary

    def row(game: int, player: int, team: int, played: int = 1, started=None) -> dict:
        return {"season_id": 20262027, "game_id": game, "team_id": team, "nhl_player_id": player,
                "GAMES_PLAYED": played, "GAMES_STARTED": started}

    skaters = [row(game, 1, 10) for game in range(1, 21)]  # every one of 20 team games
    skaters += [row(game, 2, 10) for game in range(1, 11)]  # half of them
    goalies = [row(game, 30, 10, 1, 1 if game <= 12 else (None if game <= 14 else 0)) for game in range(1, 21)]
    summary = _participation_summary({"forward": skaters, "goalie": goalies})
    full = summary[("forward", 1)][20262027]
    assert full["appearances"] / full["opportunities"] == 1.0  # HEAD: 20 / 82 = .24
    assert summary[("forward", 2)][20262027]["opportunities"] == 20
    goalie = summary[("goalie", 30)][20262027]
    # Two games with an unknown credited start leave both counts.
    assert goalie["starts"] == 12 and goalie["startOpportunities"] == 18


def test_roster_adjusted_goals_against_counts_each_on_ice_event_once():
    from modeling.player_forecasts.season import _roster_adjusted_team_contexts

    def context() -> dict:
        return {"projectedGoalsFor": 3.0, "projectedGoalsAgainst": 3.0, "ratings": {}}

    def skater(player_id: int, team: int, suppression: float) -> dict:
        return {"teamId": team, "population": "forward", "playProbability": 1.0,
                "conditionalRates": {"GOALS": 0.2, "TOTAL_TOI": 1200.0},
                "ratingSignals": {"defenseSuppressionPer60": suppression}}

    def goalie(team: int) -> dict:
        return {"teamId": team, "population": "goalie", "playProbability": 1.0, "startProbability": 1.0,
                "conditionalRates": {"GOALS_AGAINST_GOALIE": 3.0}, "ratingSignals": {"goalieSaveRate": 0.9}}

    players = {}
    for index in range(5):
        players[str(index)] = skater(index, 1, 0.5)
        players[str(10 + index)] = skater(10 + index, 2, 0.0)
    players["98"], players["99"] = goalie(1), goalie(2)
    adjusted = _roster_adjusted_team_contexts({"1": context(), "2": context()}, players)
    gap = adjusted["2"]["projectedGoalsAgainst"] - adjusted["1"]["projectedGoalsAgainst"]
    # Five skaters sharing a 0.5/60 on-ice suppression save 0.5 goals per game,
    # not 5 x 0.5 x 20/60 = 0.833 (HEAD).
    assert gap == pytest.approx(0.5)


def test_unavailable_assist_split_is_not_zero_split_history(tmp_path):
    """M-PFC-110 (Astra fixture): game 1 has two official assists with no
    A1/A2 split; game 2 has one verified A1. At game 2's cutoff the A1 history
    must not contain a 0 from game 1, while total assists keep game 1."""
    from modeling.player_forecasts.challenger_features import build_validation_features
    from modeling.player_forecasts.contract import VALIDATION_CONTRACT_SHA256
    from modeling.player_forecasts.io import write_json

    def jsonl(path, rows):
        path.write_text("".join(json.dumps(row) + "\n" for row in rows))

    write_json(tmp_path / "manifest.json", {"contractChecksum": VALIDATION_CONTRACT_SHA256, "targetSeason": 20252026})
    jsonl(tmp_path / "games.jsonl", [
        {"id": game, "date": f"2025-10-0{2 * game - 1}", "season_id": 20252026,
         "start_time": f"2025-10-0{2 * game - 1}T23:00:00+00:00", "home_team_id": 1, "away_team_id": 2}
        for game in (1, 2, 3)
    ])
    common = {"season_id": 20252026, "player_id": 10, "position": "C", "team_id": 1, "goals": 0,
              "shots_on_goal": 2, "blocked_shots": 0, "hits": 1, "penalty_minutes": 0, "toi": "18:00"}
    jsonl(tmp_path / "skaters.jsonl", [
        {**common, "game_date": "2025-10-01", "start_time": "2025-10-01T23:00:00+00:00", "game_id": 1,
         "assists": 2, "primary_assists": 0, "secondary_assists": 0, "official_assist_decomposition_complete": False},
        {**common, "game_date": "2025-10-03", "start_time": "2025-10-03T23:00:00+00:00", "game_id": 2,
         "assists": 1, "primary_assists": 1, "secondary_assists": 0, "official_assist_decomposition_complete": True},
    ])
    result = build_validation_features(tmp_path)
    rows = [json.loads(line) for line in (tmp_path / result["path"]).read_text().splitlines()]
    at_game_2 = {row["target_key"]: row for row in rows
                 if row["game_id"] == 2 and row["vintage_kind"] == "horizon_checkpoint" and row["team_game_horizon"] == 1}
    assert at_game_2["assists"]["features"]["career_rate"] == 2
    # HEAD: A1 career_rate 0 with history_count 1 (the unavailable split as 0).
    assert at_game_2["assists"]["features"].get("decomposed_sum_career_rate") is None
    assert at_game_2["primary_assists"]["features"]["history_count"] == 0
    assert result["assistSplitHistoryPolicy"] == "complete_official_decomposition_only_v2"


def test_back_to_back_uses_the_nhl_schedule_date_not_the_utc_day():
    from modeling.player_forecasts.season import _schedule_contexts_by_team

    schedule = [
        # Oct 9, 7:30 pm PT (02:30Z on Oct 10), then Oct 10 at 7 pm ET.
        {"game_id": 1, "scheduled_start_at": "2026-10-10T02:30:00Z", "home_team_id": 1, "away_team_id": 2},
        {"game_id": 2, "scheduled_start_at": "2026-10-10T23:00:00Z", "home_team_id": 3, "away_team_id": 1},
    ]
    games = _schedule_contexts_by_team(schedule)[1]
    # HEAD (UTC days): rest 0, not a back-to-back.
    assert games[1]["rest_days"] == 1 and games[1]["is_back_to_back"] is True


# --- pp_shot_support: dependency pins verified at their commit ---------------

def test_pp_support_pins_are_checked_at_their_commit_not_the_working_tree(tmp_path, monkeypatch):
    import hashlib as _hashlib

    from modeling.player_forecasts import pp_shot_support as support

    root = support.repository_root()
    # Later lanes edited these files; the working tree differs from the pins...
    changed = [path for path, pin in support.BASELINE_DEPENDENCIES.items()
               if _hashlib.sha256((root / path).read_bytes()).hexdigest() != pin]
    assert changed, "fixture assumption: at least one pinned file has changed since the pin"
    # ...yet the reproduction still verifies against the pinned commit.
    support.verify_baseline_dependencies(root)
    # Simulate an edit to the working tree copy: still verifies.
    monkeypatch.setattr(support.Path, "read_bytes", lambda self: b"edited", raising=False)
    support.verify_baseline_dependencies(root)


def test_pp_support_pin_mismatch_and_missing_commit_fail_closed(monkeypatch):
    from modeling.player_forecasts import pp_shot_support as support

    root = support.repository_root()
    first = next(iter(support.BASELINE_DEPENDENCIES))
    with monkeypatch.context() as patch:
        patch.setitem(support.BASELINE_DEPENDENCIES, first, "0" * 64)
        with pytest.raises(ValueError, match="dependency changed"):
            support.verify_baseline_dependencies(root)
    monkeypatch.setattr(support, "DEPENDENCY_PIN_SHA", "f" * 40)
    with pytest.raises(ValueError, match="unavailable"):
        support.verify_baseline_dependencies(root)
