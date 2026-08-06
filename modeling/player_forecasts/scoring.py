from __future__ import annotations

import math
from collections import defaultdict
from pathlib import Path
from typing import Any

from .io import read_json, read_jsonl
from .model import _paired_slate_bootstrap, prediction


def evaluate_range(freeze: Path, start: str | None, end: str) -> dict[str, Any]:
    artifact = read_json(freeze / "model-artifact.json")
    errors: dict[str, list[float]] = defaultdict(list)
    squared: dict[str, list[float]] = defaultdict(list)
    by_population: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for row in read_jsonl(freeze / "features.jsonl"):
        if row["game_date"] > end or (start and row["game_date"] < start):
            continue
        target = row["target_key"]
        population = str(row.get("population") or ("defense" if row.get("position") == "D" else "forward"))
        target_model = artifact.get("segments", {}).get(population, {}).get(target)
        if not target_model:
            target_model = artifact.get("targets", {}).get(target, {})
        candidate = target_model.get("candidate")
        if not candidate:
            continue
        estimate = prediction(row, candidate)
        if estimate is None:
            continue
        error = float(row["outcome"]) - estimate
        errors[target].append(abs(error))
        squared[target].append(error * error)
        by_population[population][target].append(abs(error))
    metrics = {}
    for target, values in sorted(errors.items()):
        metrics[target] = {
            "rows": len(values),
            "mae": sum(values) / len(values),
            "rmse": math.sqrt(sum(squared[target]) / len(squared[target])),
        }
    subgroups = {
        population: {
            target: {"rows": len(values), "mae": sum(values) / len(values)}
            for target, values in sorted(targets.items())
        }
        for population, targets in sorted(by_population.items())
    }
    return {"startInclusive": start, "endInclusive": end, "targets": metrics, "subgroups": subgroups}


def skill_score(model_loss: float, baseline_loss: float) -> float:
    denominator = max(abs(baseline_loss), 1e-12)
    return min(100.0, max(0.0, 50.0 + 50.0 * ((baseline_loss - model_loss) / denominator)))


def evaluate_lockbox_evidence(freeze: Path, start: str, end: str) -> dict[str, Any]:
    artifact = read_json(freeze / "model-artifact.json")
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in read_jsonl(freeze / "features.jsonl"):
        if not start <= row["game_date"] <= end:
            continue
        population = str(row.get("population") or ("defense" if row.get("position") == "D" else "forward"))
        grouped[(population, str(row["target_key"]))].append(row)
    segments: list[dict[str, Any]] = []
    for (population, target), rows in sorted(grouped.items()):
        target_model = artifact.get("segments", {}).get(population, {}).get(target)
        if not target_model:
            continue
        candidate = target_model["candidate"]
        model_pairs = [(prediction(row, candidate), float(row["outcome"])) for row in rows]
        baseline_pairs = [(prediction(row, "position_prior"), float(row["outcome"])) for row in rows]
        paired = [
            (model, baseline, outcome)
            for (model, outcome), (baseline, _) in zip(model_pairs, baseline_pairs)
            if model is not None and baseline is not None
        ]
        model_mae = sum(abs(outcome - model) for model, _, outcome in paired) / len(paired)
        baseline_mae = sum(abs(outcome - baseline) for _, baseline, outcome in paired) / len(paired)
        offsets = target_model.get("distribution", {}).get("residualQuantileOffsets", {})
        lower_offset, upper_offset = offsets.get("p10"), offsets.get("p90")
        coverage = None
        if isinstance(lower_offset, (int, float)) and isinstance(upper_offset, (int, float)):
            coverage = sum(
                1 for model, _, outcome in paired
                if max(0.0, model + lower_offset) <= outcome <= max(0.0, model + upper_offset)
            ) / len(paired)
        sparse = []
        for row in rows:
            if int(row["features"].get("history_count") or 0) >= 10:
                continue
            model = prediction(row, candidate)
            baseline = prediction(row, "position_prior")
            if model is not None and baseline is not None:
                sparse.append((model, baseline, float(row["outcome"])))
        sparse_regression = None
        if sparse:
            sparse_model = sum(abs(outcome - model) for model, _, outcome in sparse) / len(sparse)
            sparse_baseline = sum(abs(outcome - baseline) for _, baseline, outcome in sparse) / len(sparse)
            sparse_regression = (sparse_model - sparse_baseline) / max(abs(sparse_baseline), 1e-12)
        bootstrap = _paired_slate_bootstrap(rows, candidate)
        relative_lift = (baseline_mae - model_mae) / max(abs(baseline_mae), 1e-12)
        gates = {
            "minimumRelativeLift": relative_lift >= 0.02,
            "pairedLowerBoundPositive": (bootstrap.get("lower95") or 0) > 0,
            "eightyPercentCoverage": coverage is not None and abs(coverage - 0.8) <= 0.05,
            "sparseHistoryNonRegression": sparse_regression is None or sparse_regression <= 0.05,
        }
        segments.append({
            "population": population,
            "target": target,
            "candidate": candidate,
            "rows": len(paired),
            "modelMae": model_mae,
            "positionPriorMae": baseline_mae,
            "relativeLossReduction": relative_lift,
            "pairedSlateLower95AbsoluteReduction": bootstrap.get("lower95"),
            "eightyPercentCoverage": coverage,
            "eightyPercentCoverageError": abs(coverage - 0.8) if coverage is not None else None,
            "sparseHistoryRelativeRegression": sparse_regression,
            "gates": gates,
            "allGatesPass": all(gates.values()),
        })
    return {
        "scope": "conditional_skater_historical_core_only",
        "startInclusive": start,
        "endInclusive": end,
        "segments": segments,
        "allIncludedSegmentsPass": bool(segments) and all(segment["allGatesPass"] for segment in segments),
        "excludedTargets": artifact.get("excludedTargets", {}),
    }
