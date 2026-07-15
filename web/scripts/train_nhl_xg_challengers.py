#!/usr/bin/env python3
"""Train offline-only xG challenger families on a frozen exported contract.

The input is produced by train-nhl-xg-baseline.ts --challengerDatasetPath.
This runner never connects to Supabase and never registers or promotes a model.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any, Callable

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--reference-dataset-artifact", type=Path)
    parser.add_argument("--reference-model-artifact", type=Path)
    parser.add_argument("--corrected-feature-contract", action="store_true")
    parser.add_argument(
        "--families",
        default="lightgbm,catboost,xgboost",
        help="Comma-separated subset of lightgbm,catboost,xgboost",
    )
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--estimators", type=int, default=200)
    parser.add_argument("--min-state-train", type=int, default=1000)
    parser.add_argument("--min-state-positives", type=int, default=25)
    return parser.parse_args()


def load_dataset(path: Path) -> tuple[dict[str, Any], str]:
    raw = gzip.decompress(path.read_bytes())
    actual_sha = hashlib.sha256(raw).hexdigest()
    digest_path = Path(f"{path}.sha256")
    if not digest_path.exists():
        raise RuntimeError(f"Missing dataset digest sidecar: {digest_path}")
    expected_sha = digest_path.read_text(encoding="utf-8").split()[0]
    if actual_sha != expected_sha:
        raise RuntimeError(
            f"Frozen dataset digest mismatch: expected {expected_sha}, got {actual_sha}"
        )
    payload = json.loads(raw)
    if payload.get("artifactKind") != "nhl_xg_offline_challenger_dataset":
        raise RuntimeError("Unsupported challenger dataset artifact kind")
    if payload.get("artifactVersion") != 1:
        raise RuntimeError("Unsupported challenger dataset artifact version")
    return payload, actual_sha


def align_reference_contract(
    payload: dict[str, Any],
    dataset_artifact_path: Path | None,
    model_artifact_path: Path | None,
    corrected_feature_contract: bool,
) -> tuple[dict[str, Any], dict[str, Any]]:
    result: dict[str, Any] = {"checked": False, "passed": None}
    if dataset_artifact_path is None and model_artifact_path is None:
        return payload, result
    if dataset_artifact_path is None or model_artifact_path is None:
        raise RuntimeError("Provide both reference dataset and model artifacts")
    dataset_artifact = json.loads(dataset_artifact_path.read_text(encoding="utf-8"))
    model_artifact = json.loads(model_artifact_path.read_text(encoding="utf-8"))
    reference_selected = {
            key: value
            for key, value in (model_artifact.get("selectedFeatures") or {}).items()
            if key in {"numeric", "boolean", "categorical"}
        }
    if corrected_feature_contract:
        reference_selected["boolean"] = [
            value for value in reference_selected.get("boolean", []) if value != "isShortSideMiss"
        ]
        reference_selected["categorical"] = [
            value for value in reference_selected.get("categorical", []) if value != "missReasonBucket"
        ]
        expected_feature_keys = [
            value
            for value in (model_artifact.get("featureKeys") or [])
            if value != "isShortSideMiss" and not value.startswith("missReasonBucket:")
        ]
    else:
        expected_feature_keys = model_artifact.get("featureKeys")
    feature_keys_exact = payload.get("featureKeys") == expected_feature_keys
    selected_features_exact = payload.get("selectedFeatures") == reference_selected
    if not feature_keys_exact or not selected_features_exact:
        raise RuntimeError("Reference champion feature contract mismatch")

    source_examples = {row["rowId"]: row for row in payload["examples"]}
    reference_row_ids = dataset_artifact.get("rowIds") or []
    missing_row_ids = [row_id for row_id in reference_row_ids if row_id not in source_examples]
    if missing_row_ids:
        raise RuntimeError(
            f"Current source rebuild is missing {len(missing_row_ids)} frozen reference rows"
        )
    split_by_game = {
        int(row["gameId"]): row["split"]
        for row in (dataset_artifact.get("splitAssignments") or [])
    }
    numeric_keys = payload["selectedFeatures"]["numeric"]
    source_transforms = (payload.get("featureTransforms") or {}).get("numericStandardization") or {}
    reference_transforms = (model_artifact.get("featureTransforms") or {}).get("numericStandardization") or {}
    if set(source_transforms) != set(numeric_keys) or (
        not corrected_feature_contract and set(reference_transforms) != set(numeric_keys)
    ):
        raise RuntimeError("Reference champion numeric-transform contract mismatch")

    aligned_examples: list[dict[str, Any]] = []
    for row_id in reference_row_ids:
        source = source_examples[row_id]
        features = list(source["features"])
        if not corrected_feature_contract:
            for index, key in enumerate(numeric_keys):
                source_transform = source_transforms[key]
                reference_transform = reference_transforms[key]
                raw_value = features[index] * source_transform["std"] + source_transform["mean"]
                features[index] = (
                    raw_value - reference_transform["mean"]
                ) / reference_transform["std"]
        split = split_by_game.get(int(source["gameId"]))
        if split is None:
            raise RuntimeError(f"Frozen split assignment missing for game {source['gameId']}")
        aligned_examples.append({**source, "split": split, "features": features})

    aligned_payload = {
        **payload,
        "splitConfig": dataset_artifact.get("splitConfig"),
        "splitStrategy": dataset_artifact.get("splitStrategy"),
        "featureTransforms": payload.get("featureTransforms")
        if corrected_feature_contract
        else model_artifact.get("featureTransforms"),
        "examples": aligned_examples,
    }
    aligned_split_counts = {
        name: sum(row["split"] == name for row in aligned_examples)
        for name in ("train", "validation", "test")
    }
    checks = {
        "referenceRowsPresent": True,
        "rowIdsExact": [row["rowId"] for row in aligned_examples] == reference_row_ids,
        "rowCountExact": len(aligned_examples) == dataset_artifact.get("rowCount"),
        "featureKeysExact": feature_keys_exact,
        "selectedFeaturesExact": selected_features_exact,
        "splitCountsExact": aligned_split_counts == dataset_artifact.get("splitCounts"),
        "featureTransformsAligned": corrected_feature_contract
        or aligned_payload.get("featureTransforms") == model_artifact.get("featureTransforms"),
        "correctedFeatureContract": corrected_feature_contract,
    }
    if not all(checks.values()):
        failed = [name for name, passed in checks.items() if not passed]
        raise RuntimeError(f"Reference champion alignment failed: {', '.join(failed)}")
    aligned_sha = hashlib.sha256(
        json.dumps(aligned_examples, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    return aligned_payload, {
        "checked": True,
        "passed": True,
        "artifactTag": model_artifact.get("artifactTag"),
        "checks": checks,
        "sourceRows": len(source_examples),
        "frozenRows": len(aligned_examples),
        "excludedPostArtifactRows": len(source_examples) - len(aligned_examples),
        "alignedExamplesSha256": aligned_sha,
        "championTest": (model_artifact.get("evaluation") or {}).get("test"),
    }


def build_model(family: str, seed: int, estimators: int) -> Any:
    if family == "lightgbm":
        from lightgbm import LGBMClassifier

        return LGBMClassifier(
            objective="binary",
            n_estimators=estimators,
            learning_rate=0.05,
            num_leaves=31,
            min_child_samples=50,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=1.0,
            random_state=seed,
            n_jobs=1,
            verbosity=-1,
        )
    if family == "catboost":
        from catboost import CatBoostClassifier

        return CatBoostClassifier(
            loss_function="Logloss",
            iterations=estimators,
            depth=6,
            learning_rate=0.05,
            l2_leaf_reg=3.0,
            random_seed=seed,
            thread_count=1,
            verbose=False,
            allow_writing_files=False,
        )
    if family == "xgboost":
        from xgboost import XGBClassifier

        return XGBClassifier(
            objective="binary:logistic",
            eval_metric="logloss",
            n_estimators=estimators,
            learning_rate=0.05,
            max_depth=4,
            min_child_weight=5,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_lambda=1.0,
            random_state=seed,
            n_jobs=1,
            tree_method="hist",
        )
    raise RuntimeError(f"Unsupported family: {family}")


def clipped(values: np.ndarray) -> np.ndarray:
    return np.clip(np.asarray(values, dtype=np.float64), 1e-7, 1 - 1e-7)


def fit_platt(raw_validation: np.ndarray, y_validation: np.ndarray) -> tuple[str, Callable[[np.ndarray], np.ndarray]]:
    positives = int(y_validation.sum())
    negatives = int(len(y_validation) - positives)
    if len(y_validation) < 20 or positives < 10 or negatives < 10:
        return "raw_insufficient_validation", clipped
    logits = np.log(clipped(raw_validation) / (1 - clipped(raw_validation))).reshape(-1, 1)
    calibrator = LogisticRegression(C=1_000_000.0, solver="lbfgs", random_state=42)
    calibrator.fit(logits, y_validation)

    def predict(raw: np.ndarray) -> np.ndarray:
        bounded = clipped(raw)
        transformed = np.log(bounded / (1 - bounded)).reshape(-1, 1)
        return clipped(calibrator.predict_proba(transformed)[:, 1])

    return "platt_validation", predict


def expected_calibration_error(y_true: np.ndarray, y_prob: np.ndarray, bins: int = 10) -> float:
    edges = np.linspace(0.0, 1.0, bins + 1)
    total = len(y_true)
    if total == 0:
        return math.nan
    value = 0.0
    for index in range(bins):
        lower, upper = edges[index], edges[index + 1]
        mask = (y_prob >= lower) & (y_prob < upper if index < bins - 1 else y_prob <= upper)
        count = int(mask.sum())
        if count:
            value += (count / total) * abs(float(y_true[mask].mean()) - float(y_prob[mask].mean()))
    return value


def metrics(y_true: np.ndarray, y_prob: np.ndarray) -> dict[str, Any]:
    if len(y_true) == 0:
        return {"rows": 0, "positives": 0, "brier": None, "logLoss": None, "auc": None, "ece10": None}
    probability = clipped(y_prob)
    auc = float(roc_auc_score(y_true, probability)) if len(np.unique(y_true)) == 2 else None
    return {
        "rows": int(len(y_true)),
        "positives": int(y_true.sum()),
        "positiveRate": float(y_true.mean()),
        "averagePrediction": float(probability.mean()),
        "brier": float(brier_score_loss(y_true, probability)),
        "logLoss": float(log_loss(y_true, probability, labels=[0, 1])),
        "auc": auc,
        "ece10": float(expected_calibration_error(y_true, probability)),
    }


def top_importance(model: Any, feature_keys: list[str], limit: int = 20) -> list[dict[str, Any]]:
    values = getattr(model, "feature_importances_", None)
    if values is None:
        return []
    ranked = sorted(enumerate(np.asarray(values, dtype=float)), key=lambda item: (-item[1], item[0]))[:limit]
    return [{"featureKey": feature_keys[index], "importance": float(value)} for index, value in ranked]


def main() -> None:
    args = parse_args()
    payload, dataset_sha = load_dataset(args.dataset)
    payload, reference_contract = align_reference_contract(
        payload,
        args.reference_dataset_artifact,
        args.reference_model_artifact,
        args.corrected_feature_contract,
    )
    requested = [value.strip() for value in args.families.split(",") if value.strip()]
    invalid = sorted(set(requested) - {"lightgbm", "catboost", "xgboost"})
    if invalid:
        raise RuntimeError(f"Unsupported families: {', '.join(invalid)}")

    examples = payload["examples"]
    x = np.asarray([row["features"] for row in examples], dtype=np.float32)
    y = np.asarray([row["label"] for row in examples], dtype=np.int8)
    splits = np.asarray([row["split"] for row in examples], dtype=object)
    states = np.asarray([(row.get("strengthState") or "unknown") for row in examples], dtype=object)
    train_mask, validation_mask, test_mask = splits == "train", splits == "validation", splits == "test"
    if not train_mask.any() or not validation_mask.any() or not test_mask.any():
        raise RuntimeError("Frozen challenger contract requires non-empty train, validation, and test splits")

    results: list[dict[str, Any]] = []
    for family_index, family in enumerate(requested):
        seed = args.seed + family_index
        global_model = build_model(family, seed, args.estimators)
        global_model.fit(x[train_mask], y[train_mask])
        raw_validation = global_model.predict_proba(x[validation_mask])[:, 1]
        calibration_method, global_calibrate = fit_platt(raw_validation, y[validation_mask])
        global_test = global_calibrate(global_model.predict_proba(x[test_mask])[:, 1])

        state_models: dict[str, tuple[Any, Callable[[np.ndarray], np.ndarray], str]] = {}
        state_reports: list[dict[str, Any]] = []
        for state in sorted(set(states.tolist())):
            state_train = train_mask & (states == state)
            state_validation = validation_mask & (states == state)
            state_test = test_mask & (states == state)
            positives = int(y[state_train].sum())
            negatives = int(state_train.sum() - positives)
            eligibility = (
                int(state_train.sum()) >= args.min_state_train
                and positives >= args.min_state_positives
                and negatives >= args.min_state_positives
                and int(state_validation.sum()) >= 20
                and int(state_test.sum()) > 0
            )
            if not eligibility:
                state_reports.append(
                    {
                        "strengthState": state,
                        "eligible": False,
                        "trainRows": int(state_train.sum()),
                        "trainPositives": positives,
                        "validationRows": int(state_validation.sum()),
                        "testRows": int(state_test.sum()),
                    }
                )
                continue
            model = build_model(family, seed, args.estimators)
            model.fit(x[state_train], y[state_train])
            raw_state_validation = model.predict_proba(x[state_validation])[:, 1]
            state_calibration_method, state_calibrate = fit_platt(raw_state_validation, y[state_validation])
            state_probability = state_calibrate(model.predict_proba(x[state_test])[:, 1])
            state_models[state] = (model, state_calibrate, state_calibration_method)
            state_reports.append(
                {
                    "strengthState": state,
                    "eligible": True,
                    "trainRows": int(state_train.sum()),
                    "trainPositives": positives,
                    "validationRows": int(state_validation.sum()),
                    "test": metrics(y[state_test], state_probability),
                    "calibration": state_calibration_method,
                }
            )

        test_indices = np.flatnonzero(test_mask)
        partitioned = np.array(global_test, copy=True)
        used_state_rows = 0
        for state, (model, calibrate, _) in state_models.items():
            local_positions = np.flatnonzero(states[test_mask] == state)
            if len(local_positions):
                source_indices = test_indices[local_positions]
                partitioned[local_positions] = calibrate(model.predict_proba(x[source_indices])[:, 1])
                used_state_rows += len(local_positions)

        results.append(
            {
                "family": family,
                "seed": seed,
                "global": {
                    "calibration": calibration_method,
                    "validation": metrics(y[validation_mask], global_calibrate(raw_validation)),
                    "test": metrics(y[test_mask], global_test),
                    "topFeatureImportance": top_importance(global_model, payload["featureKeys"]),
                },
                "statePartitioned": {
                    "test": metrics(y[test_mask], partitioned),
                    "stateModelCount": len(state_models),
                    "stateModelRows": used_state_rows,
                    "fallbackGlobalRows": int(test_mask.sum()) - used_state_rows,
                    "states": state_reports,
                },
            }
        )

    report = {
        "artifactKind": "nhl_xg_offline_challenger_evaluation",
        "artifactVersion": 1,
        "offlineOnly": True,
        "promotionAuthorized": False,
        "datasetPath": str(args.dataset),
        "datasetSha256": dataset_sha,
        "sourceCommitSha": payload.get("sourceCommitSha"),
        "predictionType": payload.get("predictionType"),
        "seasonScopes": payload.get("seasonScopes"),
        "testSeasons": payload.get("testSeasons"),
        "splitStrategy": payload.get("splitStrategy"),
        "featureFamily": payload.get("featureFamily"),
        "featureCount": len(payload["featureKeys"]),
        "rowCount": len(examples),
        "splitCounts": {name: int((splits == name).sum()) for name in ("train", "validation", "test")},
        "referenceContract": reference_contract,
        "configuration": {
            "families": requested,
            "seed": args.seed,
            "estimators": args.estimators,
            "minStateTrain": args.min_state_train,
            "minStatePositives": args.min_state_positives,
            "calibration": "Platt scaling fit only on frozen validation rows; raw fallback when support is insufficient",
        },
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(args.output), "datasetSha256": dataset_sha, "families": requested}))


if __name__ == "__main__":
    main()
