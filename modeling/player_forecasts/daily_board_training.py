"""Fit a bounded baseline policy and report real-data development performance."""
from __future__ import annotations

import argparse
import hashlib
from collections import defaultdict
from pathlib import Path
from typing import Any

from .contract import repository_root
from .daily_board import _metrics, _paired
from .daily_board_data import validate_range
from .daily_board_models import historical_baselines
from .io import assert_output_outside_repository, canonical_json, read_json, read_jsonl, write_json, write_jsonl

BASELINES = ("season_rate", "recent_season", "role_aware", "empirical_bayes")
WEIGHTS = {"GOALS": 3, "ASSISTS": 2, "PP_POINTS": 1, "SHOTS_ON_GOAL": 0.2, "HITS": 0.2, "BLOCKED_SHOTS": 0.25}

def _flat(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for row in rows:
        for target, estimates in row["estimates"].items():
            result.append({**row, "target_key": target, "outcome": row["outcomes"][target], "estimates": estimates})
        if row["population"] == "skater" and all(key in row["estimates"] for key in WEIGHTS):
            result.append({**row, "target_key": "DEFAULT_FANTASY_POINTS", "outcome": sum(row["outcomes"][key] * weight for key, weight in WEIGHTS.items()),
                "estimates": {model: sum(row["estimates"][key][model] * weight for key, weight in WEIGHTS.items()) for model in BASELINES}})
    return result

def train_daily_baselines(freeze: Path, output: Path, *, development_end: str, evaluation_start: str, evaluation_end: str, archived_forge: Path | None = None) -> dict[str, Any]:
    assert_output_outside_repository(output, repository_root())
    manifest = read_json(freeze / "manifest.json")
    validate_range(manifest["start"], manifest["end"])
    validate_range(evaluation_start, evaluation_end)
    if not manifest["start"] < development_end < evaluation_start <= evaluation_end <= manifest["end"]:
        raise ValueError("invalid chronological development/evaluation boundaries")
    history_file = freeze / "history.jsonl"
    if hashlib.sha256(history_file.read_bytes()).hexdigest() != manifest["files"]["history.jsonl"]["sha256"]:
        raise ValueError("history checksum mismatch")
    records = list(read_jsonl(history_file))
    # Fixed small grid; no repeated search or tuning against the evaluation period.
    trials = []
    for recent_weight, prior_minutes in ((0.25, 180), (0.5, 180), (0.75, 180), (0.5, 60), (0.5, 360)):
        features = historical_baselines([row for row in records if row["game_date"] <= development_end], recent_weight=recent_weight, prior_minutes=prior_minutes)
        rows = [row for row in _flat(features) if row["target_key"] == "DEFAULT_FANTASY_POINTS"]
        if not rows:
            raise ValueError("no eligible development examples")
        trials.append({"recentWeight": recent_weight, "priorMinutes": prior_minutes,
            "recentLoss": _metrics(rows, "recent_season", False)["mae"],
            "shrinkageLoss": _metrics(rows, "empirical_bayes", False)["mae"]})
    blend = min(trials[:3], key=lambda trial: (trial["recentLoss"], abs(trial["recentWeight"] - 0.5)))
    shrink = min(trials[1:], key=lambda trial: (trial["shrinkageLoss"], trial["priorMinutes"]))
    features = historical_baselines(records, recent_weight=blend["recentWeight"], prior_minutes=shrink["priorMinutes"])
    evaluation = _flat([row for row in features if evaluation_start <= row["game_date"] <= evaluation_end])
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in evaluation:
        groups[f'{row["population"]}:{row["target_key"]}'].append(row)
    reports = {}
    for key, rows in sorted(groups.items()):
        segments = {}
        for dimension in ("position", "usage_tier", "traded"):
            values = sorted({str(row["segments"][dimension]) for row in rows})
            segments[dimension] = {value: {model: _metrics([row for row in rows if str(row["segments"][dimension]) == value], model, False) for model in BASELINES} for value in values}
        reports[key] = {"models": {model: _metrics(rows, model, False) for model in BASELINES},
            "pairedAgainstSeason": {model: {unit: _paired(rows, "season_rate", unit, champion=model) for unit in ("game", "slate")} for model in BASELINES[1:]}, "segments": segments}
    archive = list(read_jsonl(archived_forge)) if archived_forge else []
    lookup = {(row["game_id"], row["player_id"]): row for row in archive}
    diagnostics = defaultdict(list)
    for row in evaluation:
        archived = lookup.get((row["game_id"], row["player_id"]))
        value = archived and archived["estimates"].get(row["target_key"])
        if isinstance(value, (float, int)):
            diagnostics[row["target_key"]].append({**row, "estimates": {**row["estimates"], "forge": value}})
    output.mkdir(parents=True, exist_ok=False)
    artifact = {"version": "starter-board-baseline-policy-v1", "developmentEnd": development_end,
        "recentWeight": blend["recentWeight"], "priorMinutes": shrink["priorMinutes"], "selectionTrials": trials,
        "sourceChecksum": manifest["files"]["history.jsonl"]["sha256"], "promotionEligible": False,
        "refitPolicy": "fixed policy; only completed game history advances; no evaluation-driven hyperparameter changes"}
    artifact["checksum"] = hashlib.sha256(canonical_json(artifact).encode()).hexdigest()
    write_json(output / "baseline-policy.json", artifact)
    _, feature_hash = write_jsonl(output / "evaluation-forecasts.jsonl", evaluation)
    report = {"version": "starter-board-development-report-v1", "artifactChecksum": artifact["checksum"],
        "forecastChecksum": feature_hash, "evaluationStart": evaluation_start, "evaluationEnd": evaluation_end,
        "evaluatedGames": len({row["game_id"] for row in evaluation}), "evaluatedSlates": len({row["game_date"] for row in evaluation}),
        "promotionEligible": False, "reports": reports,
        "archivedForgeDiagnostic": {"classification": "unreplayable_legacy_pregame_unknown_conditioning", "formalComparisonEligible": False,
            "games": len({row["game_id"] for rows in diagnostics.values() for row in rows}),
            "slates": len({row["game_date"] for rows in diagnostics.values() for row in rows}),
            "targets": {key: {model: _metrics(rows, model, False) for model in ("forge", *BASELINES)} for key, rows in sorted(diagnostics.items())}},
        "limitations": ["Historical reconstruction uses a disclosed two-calendar-day outcome lag; source arrival times are not synthesized.",
            "Current FORGE replay comparison remains required; archived FORGE values cannot certify superiority.",
            "Participation and official goalie-start labels are unavailable; probability fitting remains withheld.",
            "Strength-specific usage, injury/rookie/ownership segments and context ablations need additional verified features.",
            "No public uncertainty interval, serving coefficient, or promotion changed."]}
    write_json(output / "report.json", report)
    return report

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--freeze", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--development-end", required=True)
    parser.add_argument("--evaluation-start", required=True)
    parser.add_argument("--evaluation-end", required=True)
    parser.add_argument("--archived-forge", type=Path)
    args = parser.parse_args()
    report = train_daily_baselines(args.freeze, args.output, development_end=args.development_end,
        evaluation_start=args.evaluation_start, evaluation_end=args.evaluation_end, archived_forge=args.archived_forge)
    print(canonical_json({key: report[key] for key in ("artifactChecksum", "evaluatedGames", "evaluatedSlates", "promotionEligible")}))

if __name__ == "__main__":
    main()
