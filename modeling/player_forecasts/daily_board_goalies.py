"""Private chronological goalie calibration from immutable settled FORGE bundles.

The calibrated estimates are retrospective challengers, not issued prospective
forecasts. This command neither promotes a model nor changes public serving.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

from .contract import repository_root
from .daily_board import VERSION as ROW_VERSION, _metrics, _paired, _timestamp
from .daily_board_data import validate_range
from .daily_board_models import fit_goalie_temperature, goalie_start_probabilities
from .daily_board_settlement import JOIN_VERSION
from .io import assert_output_outside_repository, canonical_json, read_json, write_json, write_jsonl

VERSION = "starter-board-goalie-calibration-v1"


def goalie_groups(forecasts: list[dict], settled: list[dict]) -> dict:
    """Never shrink the issued goalie pool to the subset with observed labels."""
    groups, labels, identities, checkpoints = defaultdict(list), {}, set(), {}
    for row in settled:
        if row.get("target_key") != "goalie_start":
            continue
        key = row["game_id"], row["player_id"]
        if key in labels:
            raise ValueError("duplicate settled goalie")
        labels[key] = row
    for row in forecasts:
        if row.get("target_key") != "goalie_start":
            continue
        key = row["game_id"], row["player_id"]
        if key in identities:
            raise ValueError("duplicate issued goalie")
        identities.add(key)
        if (row.get("contractVersion") != ROW_VERSION or row.get("conditioning") != "probability"
            or row.get("population") != "goalie" or row.get("evidence_classification") != "captured_live"
            or row.get("checkpoint") != "frozen_final_pregame" or row.get("historical_team_membership_verified") is not True
            or not row.get("snapshot_hash") or not row.get("revision_id")):
            raise ValueError("frozen issued goalie provenance required")
        validate_range(row["game_date"], row["game_date"])
        if type(row.get("game_type")) is not int or row["game_type"] not in (1, 2):
            raise ValueError("official preseason or regular-season game type required")
        checkpoint = tuple(row.get(k) for k in ("game_date", "game_type", "snapshot_hash", "revision_id", "cutoff_at", "issued_at", "scheduled_start_at"))
        if checkpoints.setdefault(row["game_id"], checkpoint) != checkpoint:
            raise ValueError("mixed goalie decision checkpoints")
        if not _timestamp(row["maximum_feature_available_at"]) <= _timestamp(row["cutoff_at"]) <= _timestamp(row["issued_at"]) < _timestamp(row["scheduled_start_at"]):
            raise ValueError("future goalie feature or late issuance")
        groups[row["game_id"], row["team_id"]].append(row)
    if set(labels) - identities:
        raise ValueError("outcome goalie outside issued probability pool")
    result, exclusions = [], Counter()
    for (game, team), members in sorted(groups.items()):
        members.sort(key=lambda r: r["player_id"])
        probabilities = [r.get("estimates", {}).get("forge") for r in members]
        goalie_start_probabilities(probabilities)  # Validates rather than renormalizing an incomplete pool.
        observed = [labels.get((game, r["player_id"])) for r in members]
        if len(members) < 2 or any(r is None for r in observed):
            exclusions["incomplete_candidate_labels"] += 1
            continue
        for issued, actual in zip(members, observed):
            if any(actual.get(k) != v for k, v in issued.items()):
                raise ValueError("settled goalie differs from issued forecast")
            if (actual.get("settlement_status") != "final" or not actual.get("settlement_hash")
                or type(actual.get("outcome")) is not int or actual["outcome"] not in (0, 1)
                or not _timestamp(actual["scheduled_start_at"]) < _timestamp(actual["settlement_received_at"])):
                raise ValueError("official settled binary goalie label required")
        if sum(r["outcome"] for r in observed) != 1:
            exclusions["starter_not_unique_in_issued_pool"] += 1
            continue
        result.append({"game_id": game, "team_id": team, "game_date": members[0]["game_date"],
            "game_type": members[0]["game_type"], "probabilities": probabilities,
            "labels": [r["outcome"] for r in observed], "label_verified": True, "rows": observed})
    return {"groups": result, "exclusions": dict(exclusions), "issuedTeamGames": len(groups)}


def train_goalie_calibration(bundles: list[Path], output: Path, *, calibration_start: str, calibration_end: str,
                            evaluation_start: str, evaluation_end: str, game_type: int = 2) -> dict:
    assert_output_outside_repository(output, repository_root())
    validate_range(calibration_start, calibration_end)
    validate_range(evaluation_start, evaluation_end)
    if calibration_end >= evaluation_start or type(game_type) is not int or game_type not in (1, 2):
        raise ValueError("separate chronological calibration/evaluation partitions and official game type required")
    if not 1 <= len(bundles) <= 512:
        raise ValueError("one to 512 settled game bundles required")
    forecasts, settled, inputs, seen = [], [], [], set()
    for bundle in bundles:
        manifest = read_json(bundle / "manifest.json")
        provenance = manifest.get("inputs", {}).get("forecastProvenance") or {}
        if (manifest.get("version") != JOIN_VERSION or manifest.get("evidenceClassification") != "captured_live"
            or provenance.get("status") != "artifact_integrity_revision_links_and_pregame_timing_verified"
            or provenance.get("sourceOrigin") != "immutable_database_records"):
            raise ValueError("audited frozen FORGE settlement bundle required")
        validate_range(manifest["gameDate"], manifest["gameDate"])
        if manifest["gameId"] in seen:
            raise ValueError("select one frozen revision per game")
        seen.add(manifest["gameId"])
        if set(manifest.get("files", {})) != {"forecasts.jsonl", "settled.jsonl", "unresolved.json"}:
            raise ValueError("incomplete settlement bundle")
        loaded = {}
        for name, checksum in manifest["files"].items():
            raw = (bundle / name).read_bytes()
            if hashlib.sha256(raw).hexdigest() != checksum:
                raise ValueError("settlement bundle checksum mismatch")
            if name.endswith("jsonl"):
                loaded[name] = [json.loads(line) for line in raw.decode().splitlines() if line.strip()]
        if len(loaded["forecasts.jsonl"]) != manifest["issuedTargetRows"] or len(loaded["settled.jsonl"]) != manifest["settledTargetRows"]:
            raise ValueError("settlement row counts disagree")
        for row in loaded["forecasts.jsonl"] + loaded["settled.jsonl"]:
            if (row.get("game_id"), row.get("game_date"), row.get("game_type")) != (manifest["gameId"], manifest["gameDate"], manifest["gameType"]):
                raise ValueError("settlement game identity mismatch")
        forecasts.extend(loaded["forecasts.jsonl"])
        settled.extend(loaded["settled.jsonl"])
        inputs.append({"path": str(bundle.resolve()), "manifestSha256": hashlib.sha256((bundle / "manifest.json").read_bytes()).hexdigest()})
    built = goalie_groups(forecasts, settled)
    same_type = [g for g in built["groups"] if g["game_type"] == game_type]
    calibration = [g for g in same_type if calibration_start <= g["game_date"] <= calibration_end]
    evaluation = [g for g in same_type if evaluation_start <= g["game_date"] <= evaluation_end]
    if calibration and evaluation and max(_timestamp(r["settlement_received_at"]) for g in calibration for r in g["rows"]) > min(_timestamp(r["cutoff_at"]) for g in evaluation for r in g["rows"]):
        raise ValueError("calibration outcomes arrived after an evaluation cutoff")
    model = fit_goalie_temperature(calibration) if calibration else None
    predictions = []
    for game in evaluation if model else []:
        probabilities = goalie_start_probabilities(game["probabilities"], model["temperature"])
        predictions.extend({**row, "estimates": {"forge": row["estimates"]["forge"], "calibrated": p},
            "challengerEvidence": "retrospective_not_issued", "challengerIssuedAt": None}
            for row, p in zip(game["rows"], probabilities))
    report = {"version": VERSION, "status": "retrospective_calibration_diagnostic" if predictions else "insufficient_evidence",
        "gameType": game_type, "calibrationStart": calibration_start, "calibrationEnd": calibration_end,
        "evaluationStart": evaluation_start, "evaluationEnd": evaluation_end, "inputs": inputs,
        "inputHash": hashlib.sha256(canonical_json(inputs).encode()).hexdigest(), "calibrationTeamGames": len(calibration),
        "evaluationTeamGames": len(evaluation), "evaluatedGames": len({r["game_id"] for r in predictions}),
        "evaluatedSlates": len({r["game_date"] for r in predictions}), "exclusions": built["exclusions"],
        "differentGameTypeTeamGames": len(built["groups"]) - len(same_type),
        "models": {name: _metrics(predictions, name, True) for name in ("forge", "calibrated")},
        "paired": {unit: _paired(predictions, "forge", unit, champion="calibrated") for unit in ("game", "slate")},
        "promotionEligible": False, "servingDecision": "retain_FORGE", "prospectiveChallengerGames": 0,
        "limitations": ["Challenger temperatures were not issued before these outcomes; results are retrospective diagnostics.",
            "Artifact checks do not independently authenticate database or provider origins; retain upstream export audits.",
            "Incomplete candidate labels are excluded as whole teams; excluded teams may differ systematically.",
            "No participation fit, prospective calibration, interval validation or model promotion follows from this report."]}
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    _, forecast_hash = write_jsonl(output / "evaluation.jsonl", predictions)
    write_json(output / "model.json", model)
    report["modelChecksum"] = hashlib.sha256((output / "model.json").read_bytes()).hexdigest()
    report["forecastChecksum"] = forecast_hash
    report["codeHashes"] = {name: hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest()
        for name in ("daily_board_goalies.py", "daily_board_models.py", "daily_board.py", "daily_board_settlement.py", "daily_board_data.py", "model.py", "io.py")}
    write_json(output / "report.json", report)
    for path in output.iterdir():
        path.chmod(0o600)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, action="append", required=True)
    parser.add_argument("--output", type=Path, required=True)
    for key in ("calibration-start", "calibration-end", "evaluation-start", "evaluation-end"):
        parser.add_argument(f"--{key}", required=True)
    parser.add_argument("--game-type", type=int, choices=(1, 2), default=2)
    args = vars(parser.parse_args())
    report = train_goalie_calibration(args.pop("bundle"), **args)
    print(canonical_json({key: report[key] for key in ("status", "calibrationTeamGames", "evaluationTeamGames", "prospectiveChallengerGames")}))


if __name__ == "__main__":
    main()
