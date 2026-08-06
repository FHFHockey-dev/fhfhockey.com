from __future__ import annotations

import hashlib
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterator

from .challenger_math import (
    fit_hierarchical_hits,
    fit_horizon_residual_quantiles,
    hierarchical_hits_prediction,
)
from .contract import DEVELOPMENT_END, VALIDATION_CONTRACT_SHA256, VALIDATION_CONTRACT_VERSION
from .features import parse_toi
from .io import canonical_json, read_json, read_jsonl, write_json
from .model import ROLLING_ORIGIN_VALIDATION_FOLDS


BASE_CANDIDATES = (
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
)
CONTEXT_DIMENSIONS = 6


def _context_vector(row: dict[str, Any], base_candidate: str) -> list[float] | None:
    base = _value(row, base_candidate)
    position_prior = _value(row, "position_prior")
    if base is None or position_prior is None:
        return None
    features = row["features"]
    team_rate = features.get("team_position_rate")
    opponent_rate = features.get("opponent_allowed_position_rate")
    rest_days = features.get("rest_days")
    return [
        1.0,
        base,
        float(team_rate) if team_rate is not None else position_prior,
        float(opponent_rate) if opponent_rate is not None else position_prior,
        float(features.get("home_indicator") or 0),
        float(rest_days) if rest_days is not None else 0.0,
    ]


def _new_linear_stats() -> dict[str, Any]:
    return {
        "xtx": [[0.0] * CONTEXT_DIMENSIONS for _ in range(CONTEXT_DIMENSIONS)],
        "xty": [0.0] * CONTEXT_DIMENSIONS,
        "rows": 0,
    }


def _add_linear(stats: dict[str, Any], vector: list[float], outcome: float) -> None:
    for left in range(CONTEXT_DIMENSIONS):
        stats["xty"][left] += vector[left] * outcome
        for right in range(CONTEXT_DIMENSIONS):
            stats["xtx"][left][right] += vector[left] * vector[right]
    stats["rows"] += 1


def _solve_linear(stats: dict[str, Any]) -> list[float] | None:
    if stats["rows"] < CONTEXT_DIMENSIONS:
        return None
    matrix = [row[:] + [stats["xty"][index]] for index, row in enumerate(stats["xtx"])]
    for column in range(CONTEXT_DIMENSIONS):
        pivot = max(range(column, CONTEXT_DIMENSIONS), key=lambda row: abs(matrix[row][column]))
        if abs(matrix[pivot][column]) < 1e-10:
            return None
        matrix[column], matrix[pivot] = matrix[pivot], matrix[column]
        divisor = matrix[column][column]
        matrix[column] = [value / divisor for value in matrix[column]]
        for row in range(CONTEXT_DIMENSIONS):
            if row == column:
                continue
            factor = matrix[row][column]
            matrix[row] = [
                value - factor * pivot_value
                for value, pivot_value in zip(matrix[row], matrix[column])
            ]
    return [matrix[index][-1] for index in range(CONTEXT_DIMENSIONS)]


def _context_prediction(row: dict[str, Any], base_candidate: str, coefficients: list[float] | None) -> float | None:
    vector = _context_vector(row, base_candidate)
    if vector is None or coefficients is None:
        return _value(row, base_candidate)
    return max(0.0, sum(value * coefficient for value, coefficient in zip(vector, coefficients)))


def _groups(path: Path) -> Iterator[dict[str, dict[str, Any]]]:
    current_identity = None
    group: dict[str, dict[str, Any]] = {}
    for row in read_jsonl(path):
        identity = (
            row["game_id"], row["player_id"], row["issued_at"],
            row["team_game_horizon"], row["vintage_kind"],
        )
        if current_identity is not None and identity != current_identity:
            yield group
            group = {}
        current_identity = identity
        group[str(row["target_key"])] = row
    if group:
        yield group


def _fold(game_date: str) -> int | None:
    return next((
        index for index, (start, end) in enumerate(ROLLING_ORIGIN_VALIDATION_FOLDS, 1)
        if start <= game_date <= end
    ), None)


def _value(row: dict[str, Any], candidate: str) -> float | None:
    value = row["features"].get(candidate)
    if value is None and candidate != "position_prior":
        value = row["features"].get("position_prior")
    return None if value is None else max(0.0, float(value))


def _fit_line(stats: list[float]) -> tuple[float, float]:
    count, sum_x, sum_y, sum_xx, sum_xy = stats
    denominator = count * sum_xx - sum_x * sum_x
    if count < 2 or abs(denominator) < 1e-12:
        return 0.0, sum_y / count if count else 0.0
    slope = (count * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - slope * sum_x) / count
    return slope, intercept


def _hits_artifact(freeze: Path, cutoff_exclusive: str) -> dict[str, Any]:
    return fit_hierarchical_hits(
        {
            "position": row["position"],
            "player_id": row["player_id"],
            "hits": row.get("hits") or 0,
            "time_on_ice_seconds": parse_toi(row.get("toi")) or 0,
        }
        for row in read_jsonl(freeze / "skaters.jsonl")
        if str(row["game_date"]) < cutoff_exclusive
    )


def _hierarchical_hits(row: dict[str, Any], artifact: dict[str, Any]) -> float | None:
    features = row["features"]
    projected_toi = features.get("projected_time_on_ice_seconds")
    if projected_toi is None:
        return _value(row, "position_prior")
    try:
        return hierarchical_hits_prediction(
            artifact,
            position=str(row["position"]),
            prior_hits=float(features.get("prior_events") or 0),
            prior_time_on_ice_seconds=float(features.get("prior_time_on_ice_seconds") or 0),
            projected_time_on_ice_seconds=float(projected_toi),
        )
    except ValueError:
        return _value(row, "position_prior")


def train_validation_challenger(freeze: Path) -> dict[str, Any]:
    manifest = read_json(freeze / "manifest.json")
    if manifest.get("contractChecksum") != VALIDATION_CONTRACT_SHA256:
        raise RuntimeError("validation freeze contract checksum mismatch")
    feature_path = freeze / str(manifest["validationFeatures"]["path"])
    component_training_losses: dict[tuple[int, str, str, str], list[float]] = defaultdict(lambda: [0.0, 0.0])
    assist_routing_losses: dict[tuple[int, str, str, str], list[float]] = defaultdict(lambda: [0.0, 0.0])
    line_stats: dict[tuple[int, str, str], list[float]] = defaultdict(lambda: [0.0] * 5)
    context_stats: dict[tuple[int, str, str, str], dict[str, Any]] = defaultdict(_new_linear_stats)
    final_context_stats: dict[tuple[str, str, str], dict[str, Any]] = defaultdict(_new_linear_stats)
    weighted_candidates: set[str] = set()
    for group in _groups(feature_path):
        assists = group.get("assists")
        if not assists or assists["vintage_kind"] != "horizon_checkpoint" or int(assists["team_game_horizon"]) != 1:
            continue
        population = str(assists["population"])
        game_date = str(assists["game_date"])
        for target in ("assists", "hits"):
            context_row = group.get(target)
            if not context_row:
                continue
            for candidate in BASE_CANDIDATES:
                vector = _context_vector(context_row, candidate)
                if vector is not None and game_date <= DEVELOPMENT_END:
                    _add_linear(
                        final_context_stats[(population, target, candidate)],
                        vector,
                        float(context_row["outcome"]),
                    )
        for fold_index, (fold_start, _) in enumerate(ROLLING_ORIGIN_VALIDATION_FOLDS, 1):
            if game_date >= fold_start:
                continue
            for target in ("assists", "hits"):
                context_row = group.get(target)
                if not context_row:
                    continue
                for candidate in BASE_CANDIDATES:
                    vector = _context_vector(context_row, candidate)
                    if vector is not None:
                        _add_linear(
                            context_stats[(fold_index, population, target, candidate)],
                            vector,
                            float(context_row["outcome"]),
                        )
            for target in ("primary_assists", "secondary_assists"):
                row = group.get(target)
                if not row:
                    continue
                outcome = float(row["outcome"])
                for candidate in BASE_CANDIDATES:
                    estimate = _value(row, candidate)
                    if estimate is not None:
                        stats = component_training_losses[(fold_index, population, target, candidate)]
                        stats[0] += abs(outcome - estimate)
                        stats[1] += 1
            for candidate, signal in assists["features"].items():
                if not candidate.startswith(("play_driver_70_30_", "play_driver_80_20_")) or signal is None:
                    continue
                weighted_candidates.add(candidate)
                stats = line_stats[(fold_index, population, candidate)]
                x = float(signal)
                y = float(assists["outcome"])
                stats[0] += 1
                stats[1] += x
                stats[2] += y
                stats[3] += x * x
                stats[4] += x * y
            history_group = "sparse" if int(assists["features"].get("history_count") or 0) < 10 else "established"
            routing_candidates = list(BASE_CANDIDATES) + [
                candidate for candidate in assists["features"] if candidate.startswith("decomposed_sum_")
            ]
            for candidate in routing_candidates:
                estimate = _value(assists, candidate)
                if estimate is not None:
                    stats = assist_routing_losses[(fold_index, population, history_group, candidate)]
                    stats[0] += abs(float(assists["outcome"]) - estimate)
                    stats[1] += 1

    component_winners: dict[tuple[int, str, str], str] = {}
    for fold_index in range(1, len(ROLLING_ORIGIN_VALIDATION_FOLDS) + 1):
        for population in ("forward", "defense"):
            for target in ("primary_assists", "secondary_assists"):
                choices = []
                for candidate in BASE_CANDIDATES:
                    candidate_stats = component_training_losses.get((fold_index, population, target, candidate))
                    if candidate_stats and candidate_stats[1]:
                        choices.append((candidate_stats[0] / candidate_stats[1], candidate))
                component_winners[(fold_index, population, target)] = min(choices)[1] if choices else "position_prior"
    line_models = {
        key: _fit_line(stats) for key, stats in line_stats.items()
    }
    context_models = {key: _solve_linear(stats) for key, stats in context_stats.items()}
    final_context_models = {key: _solve_linear(stats) for key, stats in final_context_stats.items()}
    assist_routing_winners: dict[tuple[int, str, str], str] = {}
    for fold_index in range(1, len(ROLLING_ORIGIN_VALIDATION_FOLDS) + 1):
        for population in ("forward", "defense"):
            for history_group in ("sparse", "established"):
                choices = [
                    (stats[0] / stats[1], candidate)
                    for (candidate_fold, candidate_population, candidate_group, candidate), stats
                    in assist_routing_losses.items()
                    if candidate_fold == fold_index and candidate_population == population
                    and candidate_group == history_group and stats[1]
                ]
                assist_routing_winners[(fold_index, population, history_group)] = (
                    min(choices)[1] if choices else "position_prior"
                )
    hits_by_fold = {
        fold_index: _hits_artifact(freeze, fold_start)
        for fold_index, (fold_start, _) in enumerate(ROLLING_ORIGIN_VALIDATION_FOLDS, 1)
    }

    losses: dict[tuple[str, str, str], list[float]] = defaultdict(lambda: [0.0, 0.0])
    horizon_losses: dict[tuple[str, str, str, int], list[float]] = defaultdict(lambda: [0.0, 0.0])
    sparse_losses: dict[tuple[str, str, str], list[float]] = defaultdict(lambda: [0.0, 0.0])

    def record(row: dict[str, Any], target: str, candidate: str, estimate: float | None) -> None:
        if estimate is None:
            return
        population = str(row["population"])
        loss = abs(float(row["outcome"]) - estimate)
        for stats in (
            losses[(population, target, candidate)],
            horizon_losses[(population, target, candidate, int(row["team_game_horizon"]))],
        ):
            stats[0] += loss
            stats[1] += 1
        if int(row["features"].get("history_count") or 0) < 10:
            stats = sparse_losses[(population, target, candidate)]
            stats[0] += loss
            stats[1] += 1

    for group in _groups(feature_path):
        assists = group.get("assists")
        if not assists or assists["vintage_kind"] != "horizon_checkpoint":
            continue
        fold_index = _fold(str(assists["game_date"]))
        if fold_index is None:
            continue
        population = str(assists["population"])
        for candidate in BASE_CANDIDATES:
            record(assists, "assists", candidate, _value(assists, candidate))
            record(
                assists,
                "assists",
                f"contextual_{candidate}",
                _context_prediction(
                    assists,
                    candidate,
                    context_models.get((fold_index, population, "assists", candidate)),
                ),
            )
            decomposed = f"decomposed_sum_{candidate}"
            if decomposed in assists["features"]:
                record(assists, "assists", decomposed, _value(assists, decomposed))
        primary = group.get("primary_assists")
        secondary = group.get("secondary_assists")
        if primary and secondary:
            primary_candidate = component_winners[(fold_index, population, "primary_assists")]
            secondary_candidate = component_winners[(fold_index, population, "secondary_assists")]
            primary_estimate = _value(primary, primary_candidate)
            secondary_estimate = _value(secondary, secondary_candidate)
            if primary_estimate is not None and secondary_estimate is not None:
                record(assists, "assists", "decomposed_independent_selected", primary_estimate + secondary_estimate)
        for candidate in weighted_candidates:
            signal = assists["features"].get(candidate)
            if signal is None:
                continue
            slope, intercept = line_models.get((fold_index, population, candidate), (0.0, 0.0))
            record(assists, "assists", f"calibrated_{candidate}", max(0.0, slope * float(signal) + intercept))
        history_group = "sparse" if int(assists["features"].get("history_count") or 0) < 10 else "established"
        routed_candidate = assist_routing_winners[(fold_index, population, history_group)]
        record(assists, "assists", "history_adaptive_assist", _value(assists, routed_candidate))
        hits = group.get("hits")
        if hits:
            for candidate in BASE_CANDIDATES:
                record(hits, "hits", candidate, _value(hits, candidate))
                record(
                    hits,
                    "hits",
                    f"contextual_{candidate}",
                    _context_prediction(
                        hits,
                        candidate,
                        context_models.get((fold_index, population, "hits", candidate)),
                    ),
                )
            record(hits, "hits", "hierarchical_opportunity", _hierarchical_hits(hits, hits_by_fold[fold_index]))

    winners: dict[tuple[str, str], str] = {}
    segments: dict[str, dict[str, Any]] = defaultdict(dict)
    for population in ("forward", "defense"):
        for target in ("assists", "hits"):
            choices = [
                (stats[0] / stats[1], candidate, int(stats[1]))
                for (candidate_population, candidate_target, candidate), stats in losses.items()
                if candidate_population == population and candidate_target == target and stats[1]
            ]
            if not choices:
                continue
            choices.sort()
            mae, winner, rows = choices[0]
            winners[(population, target)] = winner
            baseline = losses.get((population, target, "position_prior"), [0.0, 0.0])
            baseline_mae = baseline[0] / baseline[1] if baseline[1] else None
            sparse = sparse_losses.get((population, target, winner), [0.0, 0.0])
            sparse_baseline = sparse_losses.get((population, target, "position_prior"), [0.0, 0.0])
            segments[population][target] = {
                "candidate": winner,
                "developmentRollingOriginMae": mae,
                "positionPriorMae": baseline_mae,
                "relativeLossReduction": (
                    (baseline_mae - mae) / baseline_mae
                    if baseline_mae is not None and baseline_mae > 0 else None
                ),
                "evaluatedRows": rows,
                "candidateLeaderboard": [
                    {
                        "rank": rank,
                        "candidate": candidate,
                        "mae": candidate_mae,
                        "rows": candidate_rows,
                        "sparseHistoryLt10Mae": (
                            candidate_sparse[0] / candidate_sparse[1]
                            if (candidate_sparse := sparse_losses.get(
                                (population, target, candidate), [0.0, 0.0]
                            ))[1] else None
                        ),
                    }
                    for rank, (candidate_mae, candidate, candidate_rows) in enumerate(choices, 1)
                ],
                "sparseHistoryLt10": {
                    "rows": int(sparse[1]),
                    "mae": sparse[0] / sparse[1] if sparse[1] else None,
                    "positionPriorMae": sparse_baseline[0] / sparse_baseline[1] if sparse_baseline[1] else None,
                },
                "horizons": {
                    f"H{horizon}": {
                        "rows": int((values := horizon_losses.get((population, target, winner, horizon), [0.0, 0.0]))[1]),
                        "mae": values[0] / values[1] if values[1] else None,
                    }
                    for horizon in range(1, 11)
                },
            }

    residual_rows: list[dict[str, Any]] = []
    for group in _groups(feature_path):
        for target in ("assists", "hits"):
            row = group.get(target)
            if not row or row["vintage_kind"] != "horizon_checkpoint" or _fold(str(row["game_date"])) is None:
                continue
            population = str(row["population"])
            winner = winners.get((population, target))
            if not winner:
                continue
            fold_index = _fold(str(row["game_date"]))
            estimate = None
            if winner == "hierarchical_opportunity":
                estimate = _hierarchical_hits(row, hits_by_fold[int(fold_index)])
            elif winner == "decomposed_independent_selected":
                primary = group.get("primary_assists")
                secondary = group.get("secondary_assists")
                if primary and secondary:
                    estimate = (
                        (_value(primary, component_winners[(int(fold_index), population, "primary_assists")]) or 0)
                        + (_value(secondary, component_winners[(int(fold_index), population, "secondary_assists")]) or 0)
                    )
            elif winner.startswith("calibrated_"):
                raw = winner.removeprefix("calibrated_")
                signal = row["features"].get(raw)
                if signal is not None:
                    slope, intercept = line_models[(int(fold_index), population, raw)]
                    estimate = max(0.0, slope * float(signal) + intercept)
            elif winner == "history_adaptive_assist":
                history_group = "sparse" if int(row["features"].get("history_count") or 0) < 10 else "established"
                estimate = _value(
                    row,
                    assist_routing_winners[(int(fold_index), population, history_group)],
                )
            elif winner.startswith("contextual_"):
                base_candidate = winner.removeprefix("contextual_")
                estimate = _context_prediction(
                    row,
                    base_candidate,
                    context_models.get((int(fold_index), population, target, base_candidate)),
                )
            else:
                estimate = _value(row, winner)
            if estimate is not None:
                residual_rows.append({
                    "population": population,
                    "target_key": target,
                    "team_game_horizon": int(row["team_game_horizon"]),
                    "prediction": estimate,
                    "outcome": float(row["outcome"]),
                })

    payload = {
        "schemaVersion": "1.0.0-validation",
        "modelKey": "assist-decomposition-hierarchical-hits-challenger",
        "modelVersion": "development-validation-v1",
        "featureSchemaVersion": "historical-core-issued-vintages-v3-validation",
        "contractVersion": VALIDATION_CONTRACT_VERSION,
        "contractChecksum": VALIDATION_CONTRACT_SHA256,
        "trainingCutoffInclusive": DEVELOPMENT_END,
        "selectionPolicy": "rolling_origin_development_only",
        "evidenceClassification": "validation_not_blind_evidence",
        "consumedLockboxRead": False,
        "promotionEligible": False,
        "segments": segments,
        "assistComponentFoldWinners": {
            f"fold{fold}:{population}:{target}": candidate
            for (fold, population, target), candidate in sorted(component_winners.items())
        },
        "weightedAssistFoldCalibration": {
            f"fold{fold}:{population}:{candidate}": {"slope": model[0], "intercept": model[1]}
            for (fold, population, candidate), model in sorted(line_models.items())
        },
        "historyAdaptiveAssistFoldWinners": {
            f"fold{fold}:{population}:{history_group}": candidate
            for (fold, population, history_group), candidate in sorted(assist_routing_winners.items())
        },
        "finalContextModels": {
            f"{population}:{target}:{candidate}": {
                "coefficients": coefficients,
                "dimensions": [
                    "intercept", "base_candidate", "team_position_rate",
                    "opponent_allowed_position_rate", "home_indicator", "rest_days",
                ],
            }
            for (population, target, candidate), coefficients in sorted(final_context_models.items())
            if coefficients is not None
        },
        "finalDevelopmentHitsArtifact": _hits_artifact(freeze, "2026-01-03"),
        "horizonCalibration": fit_horizon_residual_quantiles(residual_rows),
        "limitations": [
            "conditional-on-playing skater evaluation only",
            "historical horizons use the final schedule and are validation-only",
            "the 2025-26 primary lockbox was already consumed and was not reevaluated",
            "prospective 2026-27 evidence is required before promotion",
        ],
    }
    payload["artifactChecksum"] = hashlib.sha256(canonical_json(payload).encode()).hexdigest()
    write_json(freeze / "validation-challenger-artifact.json", payload)
    return payload


def verify_validation_challenger_artifact(path: Path) -> dict[str, Any]:
    artifact = read_json(path)
    expected_checksum = artifact.get("artifactChecksum")
    unsigned = {key: value for key, value in artifact.items() if key != "artifactChecksum"}
    actual_checksum = hashlib.sha256(canonical_json(unsigned).encode()).hexdigest()
    if not isinstance(expected_checksum, str) or expected_checksum != actual_checksum:
        raise RuntimeError("validation challenger artifact checksum mismatch")
    if artifact.get("contractVersion") != VALIDATION_CONTRACT_VERSION:
        raise RuntimeError("validation challenger artifact contract version mismatch")
    if artifact.get("contractChecksum") != VALIDATION_CONTRACT_SHA256:
        raise RuntimeError("validation challenger artifact contract checksum mismatch")
    if artifact.get("evidenceClassification") != "validation_not_blind_evidence":
        raise RuntimeError("validation challenger artifact evidence classification mismatch")
    if artifact.get("consumedLockboxRead") is not False or artifact.get("promotionEligible") is not False:
        raise RuntimeError("validation challenger artifact must remain non-promotable and lockbox-isolated")
    if not isinstance(artifact.get("segments"), dict) or not artifact["segments"]:
        raise RuntimeError("validation challenger artifact has no selected segments")
    calibrations = artifact.get("horizonCalibration", {}).get("calibrations")
    if not isinstance(calibrations, dict) or not calibrations:
        raise RuntimeError("validation challenger artifact has no horizon calibration")
    return {
        "artifactChecksum": actual_checksum,
        "contractVersion": VALIDATION_CONTRACT_VERSION,
        "contractChecksum": VALIDATION_CONTRACT_SHA256,
        "evidenceClassification": artifact["evidenceClassification"],
        "consumedLockboxRead": False,
        "promotionEligible": False,
    }
