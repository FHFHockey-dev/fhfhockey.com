"""Private home/opponent/recent-residual challengers for reconstructed forecasts."""
from __future__ import annotations

import argparse
import hashlib
import math
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

from .contract import repository_root
from .daily_board import _metrics, _paired
from .daily_board_data import VERSION as DATASET_VERSION, validate_range
from .daily_board_models import historical_baselines
from .daily_board_training import WEIGHTS
from .io import assert_output_outside_repository, canonical_json, read_json, read_jsonl, write_json, write_jsonl
from .season import _solve_ridge_system

CATEGORIES = tuple(WEIGHTS)
FEATURES = {"intercept": (), "home_only": ("home",), "opponent_only": ("opponent_residual",),
    "home_opponent": ("home", "opponent_residual"), "recent_residual_only": ("player_residual",),
    "home_opponent_recent": ("home", "opponent_residual", "player_residual")}
MODELS = ("recent_season", *FEATURES)
POLICY = {"version": "starter-board-context-v2", "recentWeight": 0.5, "historyLagDays": 2,
    "opponentGames": 5, "minimumOpponentGames": 2, "ridge": 10.0,
    "playerGames": 5, "minimumPlayerGames": 2,
    "fitLoss": "squared category residual; standardized features, unpenalized intercept",
    "primaryEvaluationLoss": "default fantasy points MAE", "refitPolicy": "frozen training coefficients; lagged history advances",
    "opponentFeature": "equal-game average player residual against opponent within available eligible cohort",
    "playerFeature": "mean of last five same-season player residuals against lagged recent/season baseline; minimum two games",
    "conditioning": "conditional_playing", "promotionEligible": False}


def _digest(value):
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


def _valid(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def context_features(records: list[dict]) -> dict:
    """Opponent history contains only residuals of forecasts made from older games.

    Outcomes are attached for fitting/scoring, never used in their own features.
    This is a retrospective appearance cohort, not a pregame candidate pool.
    """
    ordered = sorted(records, key=lambda r: (r["game_date"], r["game_id"], r["player_id"]))
    if ordered:
        validate_range(ordered[0]["game_date"], ordered[-1]["game_date"])
    seen, contexts = set(), {}
    for row in ordered:
        identity = row["game_id"], row["player_id"]
        if identity in seen:
            raise ValueError("duplicate context player game")
        seen.add(identity)
        if row.get("evidence_classification") != "historical_reconstruction" or row.get("settlement_status") != "final":
            raise ValueError("settled historical reconstruction required")
        if row.get("historical_team_membership_verified") and type(row.get("home")) is bool:
            key = row["game_id"], row["team_id"]
            value = row["game_date"], row["opponent_team_id"], row["home"], row["season_id"]
            if key in contexts and contexts[key] != value:
                raise ValueError("conflicting historical game context")
            contexts[key] = value
    for (game, team), (day, opponent, home, season) in contexts.items():
        other = contexts.get((game, opponent))
        if team == opponent or (other is not None and other != (day, team, not home, season)):
            raise ValueError("conflicting opposing-team context")
    eligible, exclusions = [], Counter()
    valid_records = []
    for row in ordered:
        if row["population"] != "skater":
            continue
        observed = row["outcomes"]
        if not all(_valid(observed.get(c)) and observed[c] == int(observed[c]) for c in CATEGORIES):
            exclusions["incomplete_or_invalid_categories"] += 1
        elif observed["GOALS"] > observed["SHOTS_ON_GOAL"] or observed["PP_POINTS"] > observed["GOALS"] + observed["ASSISTS"]:
            exclusions["category_accounting_conflict"] += 1
        elif not _valid(observed.get("TIME_ON_ICE_PER_GAME")) or observed["TIME_ON_ICE_PER_GAME"] == 0:
            exclusions["invalid_appearance_exposure"] += 1
        else:
            valid_records.append(row)
    source = {(r["game_id"], r["player_id"]): r for r in valid_records}
    base = historical_baselines(valid_records, recent_weight=POLICY["recentWeight"])
    exclusions["no_eligible_player_baseline"] = len(valid_records) - len(base)
    for row in base:
        original = source[row["game_id"], row["player_id"]]
        if row["population"] != "skater":
            continue
        if type(original.get("home")) is not bool:
            exclusions["missing_home_context"] += 1
            continue
        if not all(c in row["estimates"] and _valid(row["outcomes"].get(c)) for c in CATEGORIES):
            exclusions["incomplete_categories"] += 1
            continue
        eligible.append({**row, "home": int(original["home"]), "season_id": original["season_id"],
            "opponent_team_id": original["opponent_team_id"],
            "context_source_hash": _digest({k: original[k] for k in ("game_id", "game_date", "team_id", "opponent_team_id", "home", "season_id")})})
    # Aggregate each opponent game before admission so incomplete iterations cannot
    # change its weight. This is a cohort residual, never a full-team total.
    games = defaultdict(list)
    for row in eligible:
        games[row["game_date"], row["game_id"], row["season_id"], row["opponent_team_id"]].append(row)
    grouped = []
    for (day, game, season, opponent), rows in sorted(games.items()):
        grouped.append({"date": day, "game_id": game, "season_id": season, "opponent": opponent,
            "residuals": {c: sum(r["outcomes"][c] - r["estimates"][c]["recent_season"] for r in rows) / len(rows) for c in CATEGORIES},
            "hash": _digest([{k: r[k] for k in ("player_id", "outcomes", "feature_hash", "context_source_hash")} for r in rows])})
    history, index, result = defaultdict(list), 0, []
    player_history, player_index = defaultdict(list), 0
    for row in eligible:
        allowed = (date.fromisoformat(row["game_date"]) - timedelta(days=POLICY["historyLagDays"])).isoformat()
        while index < len(grouped) and grouped[index]["date"] <= allowed:
            old = grouped[index]
            history[old["season_id"], old["opponent"]].append(old)
            index += 1
        while player_index < len(eligible) and eligible[player_index]["game_date"] <= allowed:
            old = eligible[player_index]
            player_history[old["season_id"], old["player_id"]].append(old)
            player_index += 1
        past = history[row["season_id"], row["opponent_team_id"]][-POLICY["opponentGames"]:]
        if len(past) < POLICY["minimumOpponentGames"]:
            exclusions["insufficient_opponent_history"] += 1
            continue
        player_past = player_history[row["season_id"], row["player_id"]][-POLICY["playerGames"]:]
        if len(player_past) < POLICY["minimumPlayerGames"]:
            exclusions["insufficient_player_residual_history"] += 1
            continue
        features = {c: {"home": row["home"], "opponent_residual": sum(p["residuals"][c] for p in past) / len(past),
            "player_residual": sum(p["outcomes"][c] - p["estimates"][c]["recent_season"] for p in player_past) / len(player_past)} for c in CATEGORIES}
        result.append({**row, "features": features, "opponent_history_games": [p["game_id"] for p in past],
            "player_residual_history_games": [p["game_id"] for p in player_past],
            "maximum_feature_game_date": max(row["maximum_feature_game_date"], past[-1]["date"], player_past[-1]["game_date"]),
            "feature_hash": _digest([POLICY, row["feature_hash"], row["context_source_hash"], [p["hash"] for p in past],
                [{k: p[k] for k in ("game_id", "player_id", "outcomes", "feature_hash")} for p in player_past]])})
    return {"rows": result, "exclusions": dict(exclusions), "baselineRows": len(base),
        "inputSkaterRows": sum(r.get("population") == "skater" for r in ordered)}


def fit_context(rows: list[dict]) -> dict:
    if not rows:
        raise ValueError("no eligible context training rows")
    models = {}
    for category in CATEGORIES:
        models[category] = {}
        for model, names in FEATURES.items():
            means = [sum(r["features"][category][n] for r in rows) / len(rows) for n in names]
            scales = [max(1e-6, math.sqrt(sum((r["features"][category][n] - mean) ** 2 for r in rows) / len(rows))) for n, mean in zip(names, means)]
            size = len(names) + 1
            matrix, vector = [[0.0] * size for _ in range(size)], [0.0] * size
            for row in rows:
                x = [1.0] + [(row["features"][category][n] - mean) / scale for n, mean, scale in zip(names, means, scales)]
                y = row["outcomes"][category] - row["estimates"][category]["recent_season"]
                for i in range(size):
                    vector[i] += x[i] * y
                    for j in range(size):
                        matrix[i][j] += x[i] * x[j]
            weights = _solve_ridge_system(matrix, vector, POLICY["ridge"])
            if weights is None or not all(math.isfinite(w) for w in weights):
                raise ValueError("context fit failed")
            models[category][model] = {"features": names, "means": means, "scales": scales, "weights": weights}
    return {"policy": POLICY, "models": models, "trainingRows": len(rows),
        "trainingHash": _digest([{k: r[k] for k in ("game_id", "player_id", "feature_hash", "outcomes")} for r in rows])}


def predict_context(row: dict, artifact: dict) -> dict:
    if artifact.get("policy") != POLICY:
        raise ValueError("context model policy mismatch")
    estimates = {c: {"recent_season": row["estimates"][c]["recent_season"]} for c in CATEGORIES}
    for category in CATEGORIES:
        for model, fitted in artifact["models"][category].items():
            x = [1.0] + [(row["features"][category][n] - mean) / scale for n, mean, scale in zip(fitted["features"], fitted["means"], fitted["scales"])]
            estimates[category][model] = max(0.0, estimates[category]["recent_season"] + sum(a * b for a, b in zip(x, fitted["weights"])))
    adjustments = Counter()
    for model in MODELS:
        for category, ceiling in (("GOALS", estimates["SHOTS_ON_GOAL"][model]),
            ("PP_POINTS", min(estimates["GOALS"][model], estimates["SHOTS_ON_GOAL"][model]) + estimates["ASSISTS"][model])):
            if estimates[category][model] > ceiling:
                adjustments[model] += 1
                estimates[category][model] = ceiling
    estimates["DEFAULT_FANTASY_POINTS"] = {m: sum(estimates[c][m] * w for c, w in WEIGHTS.items()) for m in MODELS}
    return {**row, "estimates": estimates, "outcomes": {**row["outcomes"],
        "DEFAULT_FANTASY_POINTS": sum(row["outcomes"][c] * w for c, w in WEIGHTS.items())}, "reconciliationCounts": dict(adjustments)}


def evaluate_context_freeze(freeze: Path, output: Path, *, training_end: str, evaluation_start: str, evaluation_end: str) -> dict:
    assert_output_outside_repository(output, repository_root())
    manifest = read_json(freeze / "manifest.json")
    if manifest.get("contractVersion") != DATASET_VERSION:
        raise ValueError("daily-board historical dataset contract required")
    validate_range(manifest["start"], manifest["end"])
    validate_range(evaluation_start, evaluation_end)
    allowed = (date.fromisoformat(evaluation_start) - timedelta(days=POLICY["historyLagDays"])).isoformat()
    if not manifest["start"] <= training_end <= allowed < evaluation_start <= evaluation_end <= manifest["end"]:
        raise ValueError("invalid chronological boundaries or training outcome lag")
    checksum = hashlib.sha256((freeze / "history.jsonl").read_bytes()).hexdigest()
    if checksum != manifest["files"]["history.jsonl"]["sha256"]:
        raise ValueError("history checksum mismatch")
    records = list(read_jsonl(freeze / "history.jsonl"))
    if len(records) != manifest["rows"] or any(not manifest["start"] <= r["game_date"] <= manifest["end"] for r in records):
        raise ValueError("frozen row count or dates disagree")
    built = context_features(records)
    artifact = fit_context([r for r in built["rows"] if r["game_date"] <= training_end])
    artifact.update(trainingEnd=training_end, sourceChecksum=checksum, promotionEligible=False)
    evaluated = [predict_context(r, artifact) for r in built["rows"] if evaluation_start <= r["game_date"] <= evaluation_end]
    reports = {}
    for category in (*CATEGORIES, "DEFAULT_FANTASY_POINTS"):
        rows = [{**r, "target_key": category, "outcome": r["outcomes"][category], "estimates": r["estimates"][category]} for r in evaluated]
        reports[category] = {"models": {m: _metrics(rows, m, False) for m in MODELS},
            "pairedAgainstBaseline": {m: {u: _paired(rows, "recent_season", u, champion=m) for u in ("game", "slate")} for m in FEATURES},
            "incrementalContext": {m: {u: _paired(rows, m, u, champion="home_opponent") for u in ("game", "slate")} for m in ("intercept", "home_only", "opponent_only")},
            "incrementalRecentResidual": {m: {u: _paired(rows, m, u, champion="home_opponent_recent") for u in ("game", "slate")}
                for m in ("home_opponent", "recent_residual_only")},
            "segments": {d: {str(v): {m: _metrics([r for r in rows if r["segments"][d] == v], m, False) for m in MODELS}
                for v in sorted({r["segments"][d] for r in rows})} for d in ("position", "usage_tier", "traded")}}
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    _, forecast_hash = write_jsonl(output / "evaluation.jsonl", evaluated)
    write_json(output / "model.json", artifact)
    report = {"version": POLICY["version"], "status": "historical_descriptive_only" if evaluated else "insufficient_evaluation_history",
        "sourceChecksum": checksum, "forecastChecksum": forecast_hash, "modelChecksum": _digest(artifact),
        "codeHashes": {name: hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest() for name in
            ("daily_board_context.py", "daily_board_models.py", "daily_board_training.py", "daily_board.py", "daily_board_data.py", "season.py", "io.py", "contract.py", "model.py")},
        "trainingEnd": training_end, "evaluationStart": evaluation_start, "evaluationEnd": evaluation_end,
        "trainingRows": artifact["trainingRows"], "evaluatedPlayerGames": len(evaluated),
        "evaluatedGames": len({r["game_id"] for r in evaluated}), "evaluatedSlates": len({r["game_date"] for r in evaluated}),
        "inputEvaluationSkaterRows": sum(r.get("population") == "skater" and evaluation_start <= r["game_date"] <= evaluation_end for r in records),
        "historyExclusions": built["exclusions"], "reports": reports, "promotionEligible": False, "servingDecision": "retain_FORGE",
        "reconciliationCounts": dict(sum((Counter(r["reconciliationCounts"]) for r in evaluated), Counter())),
        "limitations": ["Historical reconstructed appearance cohort with a two-day outcome lag, not observed pregame news arrival.",
            "Opponent residuals describe eligible observed players, not complete team defensive totals.",
            "All challengers share a cohort requiring at least two lagged player residuals; sparse players remain excluded.",
            "Fixed ridge and feature definitions; one chronological split does not establish prospective improvement.",
            "Rest, goalie identity, teammate deployment and original FORGE modifier ablations remain unevaluated.",
            "Rookie, injury-return and ownership segments lack verified labels; small available segments remain inconclusive.",
            "Legacy strength placeholders are unused; only box-score totals enter this challenger.",
            "No participation model, current-FORGE comparison, calibrated distribution or promotion is established."]}
    write_json(output / "report.json", report)
    for name in ("model.json", "evaluation.jsonl", "report.json"):
        (output / name).chmod(0o600)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("freeze", "output"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    for name in ("training-end", "evaluation-start", "evaluation-end"):
        parser.add_argument(f"--{name}", required=True)
    report = evaluate_context_freeze(**vars(parser.parse_args()))
    print(canonical_json({k: report[k] for k in ("status", "evaluatedGames", "evaluatedSlates", "evaluatedPlayerGames", "promotionEligible")}))


if __name__ == "__main__":
    main()
