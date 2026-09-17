"""Private joint-game distribution challenger. No serving or calibration claims."""
from __future__ import annotations

import argparse
import hashlib
import math
import random
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from .contract import repository_root
from .daily_board import _timestamp, joint_fantasy_samples
from .daily_board_data import validate_range
from .io import assert_output_outside_repository, canonical_json, read_json, write_json, write_jsonl
from .model import _quantile

VERSION = "starter-board-joint-scenarios-v1"
STRENGTHS = ("EV", "PP", "PK")
SKATER_CATEGORIES = ("GOALS", "ASSISTS", "SHOTS_ON_GOAL", "PP_POINTS", "HITS", "BLOCKED_SHOTS", "TIME_ON_ICE_PER_GAME") + tuple(
    f"{s}_{category}" for s in STRENGTHS for category in ("GOALS", "ASSISTS", "SHOTS_ON_GOAL", "TOI"))
GOALIE_CATEGORIES = ("SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE", "WINS_GOALIE", "SHUTOUTS_GOALIE", "TIME_ON_ICE_PER_GAME")


def _number(value, low=0, high=math.inf):
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def _probabilities(values):
    return bool(values) and all(_number(p, 0, 1) for p in values) and math.isclose(sum(values), 1, abs_tol=1e-9)


def _choose(rng, items, weights):
    threshold = rng.random() * sum(weights)
    for item, weight in zip(items, weights):
        threshold -= weight
        if threshold < 0:
            return item
    return items[-1]


def _count(rng, mean):
    if mean <= 0:
        return 0
    elapsed, count = 0.0, 0
    while True:
        elapsed += rng.expovariate(mean)
        if elapsed >= 1:
            return count
        count += 1
        if count > 10000:
            raise ValueError("scenario event budget exceeded; do not truncate draws")


def validate_game(game):
    validate_range(game["gameDate"], game["gameDate"])
    if type(game.get("gameId")) is not int or game["gameId"] <= 0 or type(game.get("gameType")) is not int or game["gameType"] != 2:
        raise ValueError("joint simulator requires one regular-season game")
    cutoff, start, available = (_timestamp(game[k]) for k in ("cutoffAt", "scheduledStartAt", "maximumFeatureAvailableAt"))
    if not available <= cutoff < start:
        raise ValueError("future features or post-start cutoff")
    if start.astimezone(ZoneInfo("America/New_York")).date().isoformat() != game["gameDate"]:
        raise ValueError("scheduled start disagrees with the NHL slate date")
    if game.get("evidenceClassification") not in ("captured_live", "historical_reconstruction", "controlled_fixture"):
        raise ValueError("explicit evidence classification required")
    if game.get("probabilityStatus") not in ("modeled", "controlled_fixture") or (game["probabilityStatus"] == "controlled_fixture" and game["evidenceClassification"] != "controlled_fixture"):
        raise ValueError("modeled participation probabilities required; parser confidence is not probability")
    if not isinstance(game.get("scenarioArtifactId"), str) or not game["scenarioArtifactId"].strip():
        raise ValueError("probability/deployment artifact identity required")
    policy = game["policy"]
    if policy.get("reliefAssumption") != "none" or not _number(policy.get("paceShape"), 0.01, 100000):
        raise ValueError("explicit no-relief assumption and positive pace shape required")
    if not _number(policy.get("overtimeShotRateMultiplier"), 0, 10) or not _number(policy.get("homeShootoutWinProbability"), 0, 1):
        raise ValueError("explicit overtime and shootout policy required")
    teams = game["teams"]
    if len(teams) != 2 or {t.get("side") for t in teams} != {"home", "away"}:
        raise ValueError("one home and one away team required")
    team_ids, player_ids = set(), set()
    for team in teams:
        if type(team.get("teamId")) is not int or team["teamId"] <= 0 or team["teamId"] in team_ids:
            raise ValueError("distinct positive team identities required")
        team_ids.add(team["teamId"])
        if not 5 <= len(team["skaters"]) <= 30 or not 1 <= len(team["goalies"]) <= 4:
            raise ValueError("bounded complete candidate lists required")
        for player in (*team["skaters"], *team["goalies"]):
            pid = player.get("playerId")
            if type(pid) is not int or pid <= 0 or pid in player_ids:
                raise ValueError("unique positive player identities required")
            player_ids.add(pid)
        for player in team["skaters"]:
            if not all(_number(player.get(key), 0, 2) for key in ("hitsPerMinute", "blocksPerMinute")):
                raise ValueError("conditional hit/block rates required")
            for strength in STRENGTHS:
                rates = player["strengths"][strength]
                if not _number(rates.get("shotsPerMinute"), 0, 2) or not _number(rates.get("goalProbability"), 0, 1) or not _number(rates.get("assistWeight"), 0, 100):
                    raise ValueError("conditional strength rates required")
        for goalie in team["goalies"]:
            if not all(_number(goalie["goalOddsMultiplier"].get(s), 0.01, 100) for s in STRENGTHS):
                raise ValueError("conditional goalie odds effects required")
        if any(not _probabilities(team["assistCountProbabilities"].get(s, [])) or len(team["assistCountProbabilities"][s]) != 3 for s in STRENGTHS):
            raise ValueError("probabilities for zero/one/two assists required")
    scenarios = game["scenarios"]
    if not 1 <= len(scenarios) <= 128 or not _probabilities([s.get("probability") for s in scenarios]):
        raise ValueError("complete joint scenario probabilities must sum to one")
    for scenario in scenarios:
        clock = scenario["regulationMinutes"]
        if set(clock) != {"EV", "homePP", "awayPP"} or not all(_number(v, 0, 60) for v in clock.values()) or not math.isclose(sum(clock.values()), 60, abs_tol=1e-8):
            raise ValueError("regulation state clocks must sum to 60 minutes")
        for team in teams:
            side = team["side"]
            deployment = scenario[side]
            if type(deployment["goalieId"]) is not int or deployment["goalieId"] not in {p["playerId"] for p in team["goalies"]}:
                raise ValueError("scenario goalie is not a team candidate")
            usage = deployment["usage"]
            ids = [p["playerId"] for p in usage]
            if not 5 <= len(usage) <= 20 or any(type(pid) is not int for pid in ids) or len(ids) != len(set(ids)) or not set(ids) <= {p["playerId"] for p in team["skaters"]}:
                raise ValueError("distinct active team skaters required")
            state_clock = {"EV": clock["EV"], "PP": clock[f"{side}PP"], "PK": clock["awayPP" if side == "home" else "homePP"]}
            for player in usage:
                if set(player["minutes"]) != set(STRENGTHS) or not all(_number(player["minutes"][s], 0, state_clock[s]) for s in STRENGTHS):
                    raise ValueError("individual deployment exceeds state clock")
                if sum(player["minutes"].values()) <= 0 or not _number(player.get("overtimeShare"), 0, 1):
                    raise ValueError("active appearance and bounded overtime share required")
            for strength in STRENGTHS:
                if not math.isclose(sum(p["minutes"][strength] for p in usage), state_clock[strength] * (4 if strength == "PK" else 5), abs_tol=1e-8):
                    raise ValueError("deployment must preserve team strength minutes")
            if not math.isclose(sum(p["overtimeShare"] for p in usage), 3, abs_tol=1e-8):
                raise ValueError("overtime deployment must preserve three skaters")
            # Every possible scorer needs enough positive teammate weights for
            # the requested assist count; never silently turn missing rates into
            # extra unassisted goals.
            profiles = {p["playerId"]: p for p in team["skaters"]}
            for strength in STRENGTHS:
                required = max(i for i, p in enumerate(team["assistCountProbabilities"][strength]) if p > 0)
                for overtime in (False, True) if strength == "EV" else (False,):
                    exposure = {p["playerId"]: p["overtimeShare"] if overtime else p["minutes"][strength] for p in usage}
                    eligible = {pid for pid, minutes in exposure.items() if minutes > 0 and profiles[pid]["strengths"][strength]["assistWeight"] > 0}
                    for pid, minutes in exposure.items():
                        rates = profiles[pid]["strengths"][strength]
                        if minutes > 0 and rates["shotsPerMinute"] > 0 and rates["goalProbability"] > 0 and len(eligible - {pid}) < required:
                            raise ValueError("insufficient distinct eligible assist recipients")


def simulate_game(game, *, seed: int, draws: int) -> dict:
    validate_game(game)
    if type(seed) is not int or type(draws) is not int or not 1 <= draws <= 10000:
        raise ValueError("integer seed and 1–10000 draws required")
    rng = random.Random(seed)
    teams = {t["side"]: t for t in game["teams"]}
    profiles = {p["playerId"]: p for t in teams.values() for p in (*t["skaters"], *t["goalies"])}
    policy = game["policy"]
    output = []
    for index in range(draws):
        scenario_index = _choose(rng, list(range(len(game["scenarios"]))), [s["probability"] for s in game["scenarios"]])
        scenario = game["scenarios"][scenario_index]
        pace = rng.gammavariate(policy["paceShape"], 1 / policy["paceShape"])
        stats = {p["playerId"]: {key: 0 for key in categories} for t in teams.values()
            for candidates, categories in ((t["skaters"], SKATER_CATEGORIES), (t["goalies"], GOALIE_CATEGORIES)) for p in candidates}
        goals = {"home": 0, "away": 0}
        usages = {side: {p["playerId"]: p for p in scenario[side]["usage"]} for side in teams}

        def shot(side, strength, shooter_weights, assist_weights):
            opponent = "away" if side == "home" else "home"
            shooter = _choose(rng, list(shooter_weights), list(shooter_weights.values()))
            stats[shooter]["SHOTS_ON_GOAL"] += 1
            stats[shooter][f"{strength}_SHOTS_ON_GOAL"] += 1
            p = profiles[shooter]["strengths"][strength]["goalProbability"]
            # The goalie effect is keyed by the attacking team's strength.
            multiplier = profiles[scenario[opponent]["goalieId"]]["goalOddsMultiplier"][strength]
            probability = p * multiplier / (1 - p + p * multiplier)
            if rng.random() >= probability:
                return False
            stats[shooter]["GOALS"] += 1
            stats[shooter][f"{strength}_GOALS"] += 1
            goals[side] += 1
            if strength == "PP":
                stats[shooter]["PP_POINTS"] += 1
            count = _choose(rng, [0, 1, 2], teams[side]["assistCountProbabilities"][strength])
            candidates = {pid: weight for pid, weight in assist_weights.items() if pid != shooter and weight > 0}
            for _ in range(count):
                recipient = _choose(rng, list(candidates), list(candidates.values()))
                candidates.pop(recipient)
                stats[recipient]["ASSISTS"] += 1
                stats[recipient][f"{strength}_ASSISTS"] += 1
                if strength == "PP":
                    stats[recipient]["PP_POINTS"] += 1
            return True

        def weights(side, strength, overtime=False):
            exposure = {pid: p["overtimeShare"] if overtime else p["minutes"][strength] for pid, p in usages[side].items()}
            return ({pid: minutes * profiles[pid]["strengths"][strength]["shotsPerMinute"] for pid, minutes in exposure.items()},
                {pid: minutes * profiles[pid]["strengths"][strength]["assistWeight"] for pid, minutes in exposure.items()})

        for side in teams:
            for strength in STRENGTHS:
                shots, assists = weights(side, strength)
                for _ in range(_count(rng, sum(shots.values()) * pace)):
                    shot(side, strength, shots, assists)
        overtime, shootout = 0.0, False
        if goals["home"] == goals["away"]:
            ot_weights = {side: weights(side, "EV", True) for side in teams}
            intensities = {side: sum(ot_weights[side][0].values()) * pace * policy["overtimeShotRateMultiplier"] for side in teams}
            total = sum(intensities.values())
            overtime = 5.0
            elapsed, events = 0.0, 0
            while total > 0:
                elapsed += rng.expovariate(total)
                if elapsed >= 5:
                    break
                events += 1
                if events > 10000:
                    raise ValueError("overtime event budget exceeded; do not truncate draws")
                side = _choose(rng, list(intensities), list(intensities.values()))
                if shot(side, "EV", *ot_weights[side]):
                    overtime = elapsed
                    break
        if goals["home"] == goals["away"]:
            shootout = True
            winner = "home" if rng.random() < policy["homeShootoutWinProbability"] else "away"
        else:
            winner = max(goals, key=goals.get)
        for side, team in teams.items():
            for pid, usage in usages[side].items():
                minutes = sum(usage["minutes"].values()) + usage["overtimeShare"] * overtime
                stats[pid]["TIME_ON_ICE_PER_GAME"] = minutes
                for strength in STRENGTHS:
                    stats[pid][f"{strength}_TOI"] = usage["minutes"][strength] + (usage["overtimeShare"] * overtime if strength == "EV" else 0)
                stats[pid]["HITS"] = _count(rng, minutes * profiles[pid]["hitsPerMinute"] * pace)
                stats[pid]["BLOCKED_SHOTS"] = _count(rng, minutes * profiles[pid]["blocksPerMinute"] * pace)
            opponent = "away" if side == "home" else "home"
            goalie = stats[scenario[side]["goalieId"]]
            goalie["SHOTS_AGAINST_GOALIE"] = sum(stats[p["playerId"]]["SHOTS_ON_GOAL"] for p in teams[opponent]["skaters"])
            goalie["GOALS_AGAINST_GOALIE"] = goals[opponent]
            goalie["SAVES_GOALIE"] = goalie["SHOTS_AGAINST_GOALIE"] - goals[opponent]
            goalie["WINS_GOALIE"] = int(side == winner)
            goalie["SHUTOUTS_GOALIE"] = int(goals[opponent] == 0)
            goalie["TIME_ON_ICE_PER_GAME"] = 60 + overtime
        output.append({"draw": index, "scenario": scenario_index, "pace": pace, "overtimeMinutes": overtime,
            "shootout": shootout, "winnerTeamId": teams[winner]["teamId"], "hockeyGoals": goals,
            "officialScore": {side: goals[side] + int(shootout and side == winner) for side in teams},
            "players": {str(pid): categories for pid, categories in stats.items()}})
    return {"version": VERSION, "gameId": game["gameId"], "seed": seed, "draws": output,
        "evidenceClassification": game["evidenceClassification"],
        "inputHash": hashlib.sha256(canonical_json(game).encode()).hexdigest(),
        "distributionStatus": "unvalidated_research_only", "promotionEligible": False,
        "limitations": ["Explicit joint roster/deployment probabilities and conditional rates are required; no parser-confidence probabilities.",
            "No relief, goalie pulling, empty-net goals, or overtime penalties. Fixed regulation special-team clocks.",
            "Deployment is fixed within each selected scenario; overtime uses supplied three-skater shares.",
            "Hits and blocks are conditionally independent given usage and shared pace.",
            "Shootout score adjustments do not create individual goals, shots, saves or goals allowed.",
            "Model assumptions and marginal means need empirical evaluation; no public interval eligibility is established."]}


def write_game_scenarios(source: Path, output: Path, *, seed: int, draws: int, weights: dict) -> dict:
    assert_output_outside_repository(output, repository_root())
    game = read_json(source)
    result = simulate_game(game, seed=seed, draws=draws)
    issued_at = datetime.now(timezone.utc)
    if game["evidenceClassification"] == "captured_live" and not _timestamp(game["cutoffAt"]) <= issued_at < _timestamp(game["scheduledStartAt"]):
        raise ValueError("live forecast must finish after cutoff and before puck drop")
    summary = {}
    for team in game["teams"]:
        for population, key in (("skater", "skaters"), ("goalie", "goalies")):
            profile = weights[population]
            for player in team[key]:
                pid = player["playerId"]
                values = [draw["players"][str(pid)] for draw in result["draws"]]
                fantasy = joint_fantasy_samples(values, profile)
                probability = sum(s["probability"] for s in game["scenarios"] if
                    (s[team["side"]]["goalieId"] == pid if population == "goalie" else any(p["playerId"] == pid for p in s[team["side"]]["usage"])))
                summary[str(pid)] = {"population": population, "participationProbability": probability,
                    "goalieStartProbability": probability if population == "goalie" else None,
                    "means": {key: sum(v[key] for v in values) / draws for key in values[0]},
                    "fantasyMean": sum(fantasy) / draws, "researchOnlyFantasyP10": _quantile(fantasy, 0.1),
                    "researchOnlyFantasyP90": _quantile(fantasy, 0.9)}
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    count, digest = write_jsonl(output / "draws.jsonl", result.pop("draws"))
    write_json(output / "input.json", game)
    for name in ("draws.jsonl", "input.json"):
        (output / name).chmod(0o600)
    issued_at = datetime.now(timezone.utc)
    if game["evidenceClassification"] == "captured_live" and issued_at >= _timestamp(game["scheduledStartAt"]):
        raise ValueError("live artifact publication passed puck drop; no completed report")
    report = {**result, "drawCount": count, "drawsSha256": digest, "players": summary, "weights": weights,
        "issuedAt": issued_at.isoformat() if game["evidenceClassification"] == "captured_live" else None,
        "pythonVersion": sys.version, "codeHashes": {name: hashlib.sha256((Path(__file__).parent / name).read_bytes()).hexdigest()
            for name in ("daily_board_scenarios.py", "daily_board.py", "daily_board_data.py", "model.py", "contract.py", "io.py")}}
    write_json(output / "report.json", report)
    (output / "report.json").chmod(0o600)
    if game["evidenceClassification"] == "captured_live" and datetime.now(timezone.utc) >= _timestamp(game["scheduledStartAt"]):
        (output / "report.json").unlink()
        raise ValueError("live artifact publication passed puck drop; no completed report")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--scoring", type=Path, required=True, help="Explicit skater and goalie weight maps.")
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--draws", type=int, default=1000)
    args = parser.parse_args()
    report = write_game_scenarios(args.input, args.output, seed=args.seed, draws=args.draws, weights=read_json(args.scoring))
    print(canonical_json({key: report[key] for key in ("gameId", "drawCount", "drawsSha256", "distributionStatus")}))


if __name__ == "__main__":
    main()
