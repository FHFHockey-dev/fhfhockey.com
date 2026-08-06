from __future__ import annotations

import hashlib
import math
import random
from collections import defaultdict
from pathlib import Path
from typing import Any

from .contract import CONTRACT_SHA256, CONTRACT_VERSION, DEVELOPMENT_END
from .io import canonical_json, read_json, read_jsonl, write_json

CANDIDATES = (
    "position_prior",
    "previous_season_rate",
    "career_rate",
    "multi_season_weighted_rate",
    "season_to_date_rate",
    "last_5_mean",
    "last_10_mean",
    "last_20_mean",
    "ewma_0_05",
    "ewma_0_1",
    "ewma_0_2",
    "ewma_0_35",
    "ewma_0_5",
    "empirical_bayes_opportunity_adjusted_rate",
)

ROLLING_ORIGIN_VALIDATION_FOLDS = (
    ("2025-10-21", "2025-11-15"),
    ("2025-11-16", "2025-12-10"),
    ("2025-12-11", DEVELOPMENT_END),
)


def prediction(row: dict[str, Any], candidate: str) -> float | None:
    value = row["features"].get(candidate)
    if value is None and candidate != "position_prior":
        value = row["features"].get("position_prior")
    return None if value is None else max(0.0, float(value))


def _quantile(values: list[float], probability: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = probability * (len(ordered) - 1)
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _distribution(target: str, pairs: list[tuple[float, float]]) -> dict[str, Any]:
    estimates = [estimate for estimate, _ in pairs]
    outcomes = [outcome for _, outcome in pairs]
    residuals = [outcome - estimate for estimate, outcome in pairs]
    mean = sum(outcomes) / len(outcomes)
    variance = sum((value - mean) ** 2 for value in outcomes) / max(1, len(outcomes) - 1)
    if target == "time_on_ice_seconds":
        kind = "gamma"
        shape = (mean * mean / variance) if variance > 0 else None
        parameters = {"shape": shape, "scale": (variance / mean) if mean > 0 else None}
    elif target == "penalty_minutes":
        kind = "hurdle_negative_binomial"
        positive = [value for value in outcomes if value > 0]
        parameters = {"zeroProbability": 1 - len(positive) / len(outcomes)}
    else:
        kind = "negative_binomial"
        dispersion = (mean * mean / (variance - mean)) if variance > mean else None
        parameters = {"dispersion": dispersion}
    offsets = {
        f"p{int(probability * 100)}": _quantile(residuals, probability)
        for probability in (0.1, 0.25, 0.5, 0.75, 0.9)
    }
    coverage = sum(
        1 for estimate, outcome in pairs
        if estimate + (offsets["p10"] or 0) <= outcome <= estimate + (offsets["p90"] or 0)
    ) / len(pairs)
    return {
        "kind": kind,
        "parameters": parameters,
        "residualQuantileOffsets": offsets,
        "eightyPercentCoverage": coverage,
        "eightyPercentCoverageError": abs(coverage - 0.8),
        "rows": len(estimates),
    }


def _calibration(pairs: list[tuple[float, float]]) -> dict[str, float | int | None]:
    estimates = [estimate for estimate, _ in pairs]
    outcomes = [outcome for _, outcome in pairs]
    estimate_mean = sum(estimates) / len(estimates)
    outcome_mean = sum(outcomes) / len(outcomes)
    denominator = sum((value - estimate_mean) ** 2 for value in estimates)
    slope = (
        sum((estimate - estimate_mean) * (outcome - outcome_mean) for estimate, outcome in pairs) / denominator
        if denominator > 0 else None
    )
    intercept = outcome_mean - slope * estimate_mean if slope is not None else None
    return {"intercept": intercept, "slope": slope, "rows": len(pairs)}


def _paired_slate_bootstrap(
    rows: list[dict[str, Any]], candidate: str, *, iterations: int = 2000,
) -> dict[str, float | int | None]:
    by_date: dict[str, list[float]] = defaultdict(list)
    model_losses: list[float] = []
    baseline_losses: list[float] = []
    for row in rows:
        estimate = prediction(row, candidate)
        baseline = prediction(row, "position_prior")
        if estimate is None or baseline is None:
            continue
        outcome = float(row["outcome"])
        model_loss = abs(outcome - estimate)
        baseline_loss = abs(outcome - baseline)
        by_date[row["game_date"]].append(baseline_loss - model_loss)
        model_losses.append(model_loss)
        baseline_losses.append(baseline_loss)
    dates = sorted(by_date)
    if not dates:
        return {"rows": 0, "slates": 0, "relativeLossReduction": None, "lower95": None}
    slate_means = [sum(by_date[date]) / len(by_date[date]) for date in dates]
    randomizer = random.Random(20260802)
    samples = [
        sum(randomizer.choice(slate_means) for _ in dates) / len(dates)
        for _ in range(iterations)
    ]
    baseline_mae = sum(baseline_losses) / len(baseline_losses)
    model_mae = sum(model_losses) / len(model_losses)
    return {
        "rows": len(model_losses),
        "slates": len(dates),
        "relativeLossReduction": (baseline_mae - model_mae) / max(abs(baseline_mae), 1e-12),
        "pairedAbsoluteLossReduction": baseline_mae - model_mae,
        "lower95": _quantile(samples, 0.025),
        "iterations": iterations,
    }


def train_baseline(freeze: Path) -> dict[str, Any]:
    manifest = read_json(freeze / "manifest.json")
    if manifest.get("contractChecksum") != CONTRACT_SHA256:
        raise RuntimeError("freeze contract checksum mismatch")
    losses: dict[tuple[str, str, str], list[float]] = defaultdict(list)
    fold_losses: dict[tuple[str, str, str, int], list[float]] = defaultdict(list)
    support: dict[tuple[str, str], int] = defaultdict(int)
    rows_by_segment: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in read_jsonl(freeze / "features.jsonl"):
        if row["game_date"] > DEVELOPMENT_END:
            continue
        fold_index = next((index for index, (start, end) in enumerate(ROLLING_ORIGIN_VALIDATION_FOLDS, 1) if start <= row["game_date"] <= end), None)
        if fold_index is None:
            continue
        target = str(row["target_key"])
        population = str(row.get("population") or ("defense" if row.get("position") == "D" else "forward"))
        support[(population, target)] += 1
        rows_by_segment[(population, target)].append(row)
        for candidate in CANDIDATES:
            estimate = prediction(row, candidate)
            if estimate is not None:
                losses[(population, target, candidate)].append(abs(float(row["outcome"]) - estimate))
                fold_losses[(population, target, candidate, fold_index)].append(abs(float(row["outcome"]) - estimate))
    segments: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for population, target in sorted(support):
        choices = []
        for candidate in CANDIDATES:
            values = losses.get((population, target, candidate), [])
            if values:
                choices.append((sum(values) / len(values), candidate, len(values)))
        if choices:
            mae, candidate, rows = min(choices)
            source_rows = rows_by_segment[(population, target)]
            pairs = [
                (estimate, float(row["outcome"]))
                for row in source_rows
                if (estimate := prediction(row, candidate)) is not None
            ]
            sparse_pairs = [
                (prediction(row, candidate), float(row["outcome"]))
                for row in source_rows if int(row["features"].get("history_count") or 0) < 10
                and prediction(row, candidate) is not None
            ]
            sparse_baseline_pairs = [
                (prediction(row, "position_prior"), float(row["outcome"]))
                for row in source_rows if int(row["features"].get("history_count") or 0) < 10
                and prediction(row, "position_prior") is not None
            ]
            sparse_mae = (sum(abs(outcome - estimate) for estimate, outcome in sparse_pairs) / len(sparse_pairs)) if sparse_pairs else None
            sparse_baseline_mae = (
                sum(abs(outcome - estimate) for estimate, outcome in sparse_baseline_pairs) / len(sparse_baseline_pairs)
            ) if sparse_baseline_pairs else None
            segments[population][target] = {
                "candidate": candidate,
                "developmentMae": mae,
                "evaluatedRows": rows,
                "distribution": _distribution(target, pairs),
                "calibration": _calibration(pairs),
                "pairedPositionPriorComparison": _paired_slate_bootstrap(source_rows, candidate),
                "subgroups": {
                    "sparseHistoryLt10": {
                        "rows": len(sparse_pairs),
                        "mae": sparse_mae,
                        "baselineMae": sparse_baseline_mae,
                        "relativeLossRegression": (
                            (sparse_mae - sparse_baseline_mae) / max(abs(sparse_baseline_mae), 1e-12)
                            if sparse_mae is not None and sparse_baseline_mae is not None else None
                        ),
                    },
                },
                "rollingOriginFolds": [
                    {
                        "fold": index,
                        "validationStartInclusive": start,
                        "validationEndInclusive": end,
                        "rows": len(values := fold_losses.get((population, target, candidate, index), [])),
                        "mae": (sum(values) / len(values)) if values else None,
                    }
                    for index, (start, end) in enumerate(ROLLING_ORIGIN_VALIDATION_FOLDS, 1)
                ],
            }
    winners: dict[str, dict[str, Any]] = {}
    for target in sorted({target for _, target in support}):
        choices = [
            (details["developmentMae"], population, details)
            for population, targets in segments.items()
            if (details := targets.get(target)) is not None
        ]
        if choices:
            _, population, details = min(choices)
            winners[target] = {**details, "defaultPopulation": population}
    payload = {
        "schemaVersion": "1.0.0",
        "modelKey": "historical-core-baseline-tournament",
        "modelVersion": "development-v2",
        "createdAt": manifest.get("createdAt"),
        "contractVersion": CONTRACT_VERSION,
        "contractChecksum": CONTRACT_SHA256,
        "trainingCutoffInclusive": DEVELOPMENT_END,
        "selectionPolicy": "rolling_origin_validation_within_development_window",
        "featureSchemaVersion": "historical-core-v2",
        "targets": winners,
        "segments": segments,
        "review": {
            "developmentOnly": True,
            "lockboxObserved": False,
            "postCutoffInputs": 0,
            "deterministicBootstrapSeed": 20260802,
            "candidateCount": len(CANDIDATES),
            "conditionalSkaterTargetsComplete": len(winners) == 7,
        },
        "goalieStartPolicy": {
            "status": "blocked_no_reconstructable_candidate_set",
            "historicalCoreEligible": False,
            "prospectiveEnrichedEligible": True,
            "requirements": [
                "cutoff-safe team goalie candidate set",
                "audited starter-versus-relief label",
                "team identity on every historical goalie outcome",
                "prospective source observations with authentic available_at timestamps",
            ],
            "fallback": "emit no historical starts forecast; never relabel appearances as starts",
        },
        "excludedTargets": {
            "plays": "historical nonappearance candidate sets are not reconstructable",
            "starts": "historical goalie starter candidate sets are not reconstructable",
            "goalieConditionalStart": "starter-versus-relief identity is not audited in the sealed freeze",
        },
        "limitations": [
            "conditional appearance outcomes only",
            "playing and starting probabilities await prospective labels",
            "goalie conditional-start targets await an audited historical starter label",
            "artifact is not promotion eligible",
        ],
        "promotionEligible": False,
        "lockboxReady": False,
    }
    encoded = canonical_json(payload).encode()
    payload["artifactChecksum"] = hashlib.sha256(encoded).hexdigest()
    write_json(freeze / "model-artifact.json", payload)
    return payload


def seal_for_lockbox(freeze: Path) -> dict[str, Any]:
    artifact = read_json(freeze / "model-artifact.json")
    unsigned = {key: value for key, value in artifact.items() if key != "artifactChecksum"}
    if hashlib.sha256(canonical_json(unsigned).encode()).hexdigest() != artifact.get("artifactChecksum"):
        raise RuntimeError("model artifact checksum mismatch")
    failures: list[str] = []
    required_targets = {
        "goals", "assists", "shots_on_goal", "blocked_shots", "hits",
        "penalty_minutes", "time_on_ice_seconds",
    }
    for population in ("forward", "defense"):
        targets = artifact.get("segments", {}).get(population, {})
        missing = sorted(required_targets - set(targets))
        if missing:
            failures.append(f"{population} missing targets: {', '.join(missing)}")
        for target, details in targets.items():
            comparison = details.get("pairedPositionPriorComparison", {})
            distribution = details.get("distribution", {})
            sparse = details.get("subgroups", {}).get("sparseHistoryLt10", {})
            if (comparison.get("relativeLossReduction") or 0) < 0.02:
                failures.append(f"{population}/{target} relative lift below 2%")
            if (comparison.get("lower95") or 0) <= 0:
                failures.append(f"{population}/{target} paired lower bound is not positive")
            coverage_error = distribution.get("eightyPercentCoverageError")
            if not isinstance(coverage_error, (int, float)) or coverage_error > 0.05:
                failures.append(f"{population}/{target} interval coverage error exceeds 5 points")
            if (sparse.get("relativeLossRegression") or 0) > 0.05:
                failures.append(f"{population}/{target} sparse-history regression exceeds 5%")
    if failures:
        raise RuntimeError("lockbox review failed: " + "; ".join(failures))
    artifact["lockboxReady"] = True
    artifact["lockboxReview"] = {
        "status": "ready_for_single_conditional_skater_evaluation",
        "developmentGatesPassed": True,
        "lockboxObserved": False,
        "scope": ["forward_conditional_playing", "defense_conditional_playing"],
        "excludedFromPrimaryEvidence": ["plays", "starts", "goalie_conditional_start"],
        "promotionEligible": False,
    }
    artifact.pop("artifactChecksum", None)
    artifact["artifactChecksum"] = hashlib.sha256(canonical_json(artifact).encode()).hexdigest()
    write_json(freeze / "model-artifact.json", artifact)
    return artifact


def verify_model_artifact(path: Path) -> dict[str, Any]:
    artifact = read_json(path)
    unsigned = {key: value for key, value in artifact.items() if key != "artifactChecksum"}
    actual = hashlib.sha256(canonical_json(unsigned).encode()).hexdigest()
    if actual != artifact.get("artifactChecksum"):
        raise RuntimeError("model artifact checksum mismatch")
    return {
        "verified": True,
        "artifactChecksum": artifact["artifactChecksum"],
        "contractChecksum": artifact.get("contractChecksum"),
    }


def verify_serving_bundle(artifact_path: Path, receipt_path: Path, evidence_path: Path) -> dict[str, Any]:
    artifact_identity = verify_model_artifact(artifact_path)
    receipt = read_json(receipt_path)
    evidence = read_json(evidence_path)
    unsigned_receipt = {key: value for key, value in receipt.items() if key != "receiptChecksum"}
    unsigned_evidence = {key: value for key, value in evidence.items() if key != "evidenceChecksum"}
    receipt_checksum = hashlib.sha256(canonical_json(unsigned_receipt).encode()).hexdigest()
    evidence_checksum = hashlib.sha256(canonical_json(unsigned_evidence).encode()).hexdigest()
    if receipt_checksum != receipt.get("receiptChecksum"):
        raise RuntimeError("primary lockbox receipt checksum mismatch")
    if evidence_checksum != evidence.get("evidenceChecksum"):
        raise RuntimeError("lockbox evidence checksum mismatch")
    if receipt.get("artifactChecksum") != artifact_identity["artifactChecksum"]:
        raise RuntimeError("primary receipt and artifact checksum mismatch")
    if evidence.get("artifactChecksum") != artifact_identity["artifactChecksum"]:
        raise RuntimeError("evidence and artifact checksum mismatch")
    if evidence.get("primaryReceiptChecksum") != receipt_checksum:
        raise RuntimeError("evidence and primary receipt checksum mismatch")
    return {
        **artifact_identity,
        "receiptChecksum": receipt_checksum,
        "evidenceChecksum": evidence_checksum,
    }
