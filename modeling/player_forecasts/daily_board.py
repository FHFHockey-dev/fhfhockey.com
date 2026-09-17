"""Offline daily-board evaluation. No database writes or model promotion.

Input rows are point-in-time exports with final settled labels and separately
computed comparator estimates. Supplying a present-day reconstruction never
turns it into historical news-availability evidence.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from .contract import LOCKBOX_END, LOCKBOX_START, repository_root
from .io import assert_output_outside_repository, canonical_json, read_json, write_json
from .model import _quantile

VERSION = "starter-board-evaluation-v1"
MODELS = ("forge", "season_rate", "recent_season", "role_aware", "empirical_bayes")
SEGMENTS = ("position", "usage_tier", "low_owned", "rookie", "injury_return", "traded", "uncertain_lineup")
PROBABILITY_TARGETS = ("participation", "goalie_start")
SEED = 20260915


def _timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamps must include a timezone")
    return parsed


def _finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def crps(samples: list[float], outcome: float) -> float:
    if not samples or not all(_finite(value) for value in samples):
        raise ValueError("CRPS requires finite scenario draws")
    ordered = sorted(samples)
    size = len(ordered)
    return sum(abs(value - outcome) for value in ordered) / size - sum(
        (2 * index - size + 1) * value for index, value in enumerate(ordered)
    ) / (size * size)


def joint_fantasy_samples(draws: list[dict[str, float]], weights: dict[str, float]) -> list[float]:
    """Score each joint draw before taking percentiles; preserve covariance."""
    if not all(_finite(value) for value in weights.values()):
        raise ValueError("nonfinite scoring weight")
    result = []
    for draw in draws:
        if any(not _finite(value) or value < 0 for value in draw.values()):
            raise ValueError("joint category outcomes must be finite and nonnegative")
        if any(not _finite(draw.get(key)) for key, weight in weights.items() if weight):
            raise ValueError("missing or nonfinite scoring category in a joint draw")
        if all(key in draw for key in ("SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE")):
            if not math.isclose(draw["SAVES_GOALIE"] + draw["GOALS_AGAINST_GOALIE"], draw["SHOTS_AGAINST_GOALIE"], abs_tol=1e-6):
                raise ValueError("goalie accounting identity violated")
        if "GOALS" in draw and "SHOTS_ON_GOAL" in draw and draw["GOALS"] > draw["SHOTS_ON_GOAL"]:
            raise ValueError("goals exceed shots")
        result.append(sum(draw[key] * weight for key, weight in weights.items() if weight))
    return result


def _metrics(rows: list[dict[str, Any]], model: str, probability: bool) -> dict[str, Any]:
    pairs = [(float(row["estimates"][model]), float(row["outcome"])) for row in rows]
    if not pairs:
        return {"rows": 0}
    errors = [estimate - outcome for estimate, outcome in pairs]
    report: dict[str, Any] = {"rows": len(pairs), "mae": sum(map(abs, errors)) / len(pairs),
        "rmse": math.sqrt(sum(error * error for error in errors) / len(pairs)), "bias": sum(errors) / len(pairs)}
    if probability:
        if any(not 0 <= estimate <= 1 or outcome not in (0, 1) for estimate, outcome in pairs):
            raise ValueError("probability estimates must be in [0,1] with binary labels")
        report["brier"] = sum(error * error for error in errors) / len(pairs)
        report["logLoss"] = -sum(outcome * math.log(max(1e-12, estimate)) + (1 - outcome) * math.log(max(1e-12, 1 - estimate)) for estimate, outcome in pairs) / len(pairs)
        report["calibrationBins"] = []
        for index in range(10):
            members = [(p, y) for p, y in pairs if min(9, int(p * 10)) == index]
            if members:
                report["calibrationBins"].append({"bin": index, "rows": len(members), "predicted": sum(p for p, _ in members) / len(members), "observed": sum(y for _, y in members) / len(members)})
    distributions = []
    for row in rows:
        samples = row.get("samples", {}).get(model)
        if not samples:
            continue
        low, high = _quantile(samples, 0.1), _quantile(samples, 0.9)
        outcome = float(row["outcome"])
        width = high - low
        interval_score = width + 10 * max(0, low - outcome) + 10 * max(0, outcome - high)
        distributions.append((crps(samples, outcome), float(low <= outcome <= high), width, interval_score))
    report["distribution"] = {"status": "evaluation_only", "rows": len(distributions),
        **({name: sum(item[index] for item in distributions) / len(distributions) for index, name in enumerate(("crps", "coverage80", "width80", "intervalScore80"))} if distributions else {})}
    return report


def _paired(rows: list[dict[str, Any]], baseline: str, unit: str, champion: str = "forge") -> dict[str, Any]:
    grouped: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        loss = (lambda estimate: (estimate - row["outcome"]) ** 2) if row["target_key"] in PROBABILITY_TARGETS else (lambda estimate: abs(estimate - row["outcome"]))
        key = row["game_date"] if unit == "slate" else f'{row["game_date"]}:{row["game_id"]}'
        grouped[key].append(loss(row["estimates"][baseline]) - loss(row["estimates"][champion]))
    units = [sum(values) / len(values) for _, values in sorted(grouped.items())]
    if not units:
        return {"units": 0}
    rng = random.Random(SEED)
    draws = [sum(rng.choice(units) for _ in units) / len(units) for _ in range(1000)]
    return {"units": len(units), "meanLossReduction": sum(units) / len(units),
        "lower95": _quantile(draws, 0.025), "upper95": _quantile(draws, 0.975)}


def _evidence_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    return {"targetRows": len(rows), "playerGames": len({(r["game_id"], r["player_id"]) for r in rows}),
        "games": len({r["game_id"] for r in rows}), "slates": len({r["game_date"] for r in rows})}


def evaluate_daily_board(rows: list[dict[str, Any]], *, training_end: str, validation_start: str, validation_end: str, game_type: int = 2) -> dict[str, Any]:
    if type(game_type) is not int or game_type not in (1, 2):
        raise ValueError("select preseason (1) or regular season (2) separately")
    for value in (training_end, validation_start, validation_end):
        if datetime.fromisoformat(value).date().isoformat() != value:
            raise ValueError("split dates must use YYYY-MM-DD")
    if not training_end < validation_start <= validation_end:
        raise ValueError("training and validation must be chronological and disjoint")
    accepted = []
    excluded: dict[str, int] = defaultdict(int)
    seen = set()
    game_checkpoints, checkpoints = {}, set()
    missing_comparators: dict[str, int] = defaultdict(int)
    for row in rows:
        if datetime.fromisoformat(row["game_date"]).date().isoformat() != row["game_date"]:
            raise ValueError("game dates must use YYYY-MM-DD")
        if LOCKBOX_START <= row["game_date"] <= LOCKBOX_END:
            raise ValueError("protected research holdout: use its existing governed workflow")
        if not validation_start <= row["game_date"] <= validation_end:
            excluded["outside_validation"] += 1
            continue
        if row.get("contractVersion") != VERSION or row.get("evidence_classification") not in ("captured_live", "historical_reconstruction"):
            raise ValueError("missing daily-board contract or evidence classification")
        # Historical exports are explicitly limited to type 2. Live captures must
        # establish the official type; calendar dates alone cannot identify it.
        row_type = row.get("game_type", 2 if row["evidence_classification"] == "historical_reconstruction" else None)
        if type(row_type) is not int or row_type not in (1, 2):
            raise ValueError("official game type required for live evaluation")
        if row_type != game_type:
            excluded["different_game_type"] += 1
            continue
        if not row.get("snapshot_hash") or not row.get("historical_team_membership_verified"):
            raise ValueError("captured input identity and cutoff-safe team membership required")
        if not _timestamp(row["maximum_feature_available_at"]) <= _timestamp(row["cutoff_at"]) < _timestamp(row["scheduled_start_at"]):
            raise ValueError("future information or postgame cutoff")
        if row.get("trained_through", training_end) > training_end:
            raise ValueError("model training crosses the declared training boundary")
        if row.get("settlement_status") != "final":
            excluded["unsettled"] += 1
            continue
        if row["evidence_classification"] == "captured_live":
            if not row.get("issued_at") or not row.get("settlement_received_at") or not row.get("settlement_hash"):
                raise ValueError("prospective evaluation requires issuance and settlement evidence")
            if not _timestamp(row["cutoff_at"]) <= _timestamp(row["issued_at"]) < _timestamp(row["scheduled_start_at"]) < _timestamp(row["settlement_received_at"]):
                raise ValueError("prospective forecast must be issued before puck drop and official settlement")
        conditioning = row["conditioning"]
        if conditioning not in ("conditional_playing", "conditional_start", "unconditional", "probability"):
            raise ValueError("unclassified projection semantics")
        if conditioning == "conditional_playing" and row.get("played") is not True:
            excluded["did_not_play_or_unknown"] += 1
            continue
        if conditioning == "conditional_start" and row.get("started") is not True:
            excluded["did_not_start_or_unknown"] += 1
            continue
        if row["target_key"] in PROBABILITY_TARGETS and conditioning != "probability":
            raise ValueError("probability target has incompatible conditioning")
        # Do not silently combine disjoint player subsets from different issues
        # of the same game. Selection must be declared before reading outcomes.
        checkpoint = row.get("checkpoint")
        if checkpoint is not None and (not isinstance(checkpoint, str) or not checkpoint.strip()):
            raise ValueError("invalid decision checkpoint")
        checkpoints.add(checkpoint)
        game_identity = (row["game_date"], row_type, _timestamp(row["scheduled_start_at"]), _timestamp(row["cutoff_at"]),
            _timestamp(row["issued_at"]) if row.get("issued_at") else None, row["snapshot_hash"], row["evidence_classification"], checkpoint)
        previous = game_checkpoints.setdefault(row["game_id"], game_identity)
        if previous != game_identity or len(checkpoints) > 1:
            raise ValueError("mixed decision checkpoints; select one declared checkpoint before evaluation")
        identity = (row["game_id"], row["player_id"], row["target_key"], conditioning)
        if identity in seen:
            raise ValueError("duplicate decision observation; select a declared checkpoint first")
        seen.add(identity)
        for model in MODELS:
            if not _finite(row.get("estimates", {}).get(model)):
                missing_comparators[model] += 1
        if not _finite(row.get("outcome")) or any(not _finite(row.get("estimates", {}).get(model)) for model in MODELS):
            excluded["missing_comparator_or_outcome"] += 1
            continue
        accepted.append(row)
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in accepted:
        groups[f'{row["target_key"]}:{row["conditioning"]}:{row["evidence_classification"]}'].append(row)
    reports = {}
    for key, members in sorted(groups.items()):
        probability = members[0]["target_key"] in PROBABILITY_TARGETS
        report = {"models": {model: _metrics(members, model, probability) for model in MODELS},
            "paired": {model: {unit: _paired(members, model, unit) for unit in ("game", "slate")} for model in MODELS if model != "forge"},
            "segments": {}, "ablations": {}, "evidence": _evidence_counts(members)}
        if probability:
            positives = sum(r["outcome"] == 1 for r in members)
            report["probabilityLabels"] = {"positive": positives, "negative": len(members) - positives,
                "bothClassesObserved": 0 < positives < len(members)}
        for segment in SEGMENTS:
            buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
            for row in members:
                buckets[str(row.get("segments", {}).get(segment, "unavailable"))].append(row)
            report["segments"][segment] = {value: {model: _metrics(bucket, model, probability) for model in MODELS} for value, bucket in sorted(buckets.items())}
        for ablation in ("without_trend", "without_opponent", "without_goalie", "without_rest_home", "without_teammates", "without_reconciliation"):
            paired = [row for row in members if _finite(row["estimates"].get(ablation))]
            report["ablations"][ablation] = {"rows": len(paired), "pairedSlates": _paired(paired, ablation, "slate")}
        reports[key] = report
    prospective = [r for r in accepted if r["evidence_classification"] == "captured_live" and r["game_type"] == 2]
    return {"contractVersion": VERSION, "promotionEligible": False, "seed": SEED, "gameType": game_type,
        "trainingEnd": training_end, "validationStart": validation_start, "validationEnd": validation_end,
        "inputHash": hashlib.sha256(canonical_json(rows).encode()).hexdigest(),
        "inputRows": len(rows), "evaluatedRows": len(accepted), "excluded": dict(excluded), "reports": reports,
        "evidence": _evidence_counts(accepted), "prospectiveRegularSeasonEvidence": _evidence_counts(prospective),
        "checkpoint": next(iter(checkpoints), None),
        "checkpointStatus": "declared" if checkpoints and None not in checkpoints else "unspecified",
        "missingComparatorRows": dict(missing_comparators),
        "limitations": ["Supplied comparator training and feature provenance require their own audits.",
            "Sample counts describe only the common evaluated comparator cohort, not all issued or settled forecasts.",
            "Unspecified checkpoints cannot establish a frozen prospective selection policy.",
            "Historical reconstructions cannot establish news-impact lift.", "No model promotion or interval certification is automatic."]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, action="append", required=True,
        help="Settled forecast JSONL; repeat for games sharing one declared checkpoint policy.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--training-end", required=True)
    parser.add_argument("--validation-start", required=True)
    parser.add_argument("--validation-end", required=True)
    parser.add_argument("--game-type", type=int, choices=(1, 2), default=2)
    args = parser.parse_args()
    assert_output_outside_repository(args.output, repository_root())
    contract_file = Path(__file__).resolve().parents[2] / "docs/start-chart/daily-board-contract-v1.json"
    contract = read_json(contract_file)
    if contract["contractVersion"] != VERSION or tuple(contract["requiredComparators"]) != MODELS:
        raise ValueError("daily-board contract mismatch")
    rows, inputs = [], []
    for path in args.input:
        raw = path.read_bytes()
        part = [json.loads(line) for line in raw.decode("utf-8").splitlines() if line.strip()]
        rows.extend(part)
        inputs.append({"path": str(path.resolve()), "sha256": hashlib.sha256(raw).hexdigest(), "rows": len(part)})
    report = evaluate_daily_board(rows, training_end=args.training_end, validation_start=args.validation_start, validation_end=args.validation_end, game_type=args.game_type)
    report["contractChecksum"] = hashlib.sha256(contract_file.read_bytes()).hexdigest()
    report["inputFiles"] = inputs
    report["evaluatorChecksum"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    if args.output.exists():
        if read_json(args.output) != report:
            raise ValueError("refusing to replace a different evaluation report")
        return
    args.output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    args.output.touch(mode=0o600, exist_ok=False)
    write_json(args.output, report)


if __name__ == "__main__":
    main()
