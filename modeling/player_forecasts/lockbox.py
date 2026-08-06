from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .contract import CONTRACT_SHA256, LOCKBOX_END, LOCKBOX_START
from .io import canonical_json, read_json, write_json
from .scoring import evaluate_lockbox_evidence, evaluate_range


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def evaluate_lockbox_once(freeze: Path, receipt: Path) -> dict[str, Any]:
    if os.environ.get("PLAYER_FORECAST_LOCKBOX_CONFIRM") != "2025-26-primary-once":
        raise RuntimeError("lockbox confirmation is missing")
    if receipt.exists():
        raise RuntimeError("primary lockbox receipt already exists")
    manifest = read_json(freeze / "manifest.json")
    artifact = read_json(freeze / "model-artifact.json")
    if manifest.get("contractChecksum") != CONTRACT_SHA256 or artifact.get("contractChecksum") != CONTRACT_SHA256:
        raise RuntimeError("lockbox contract mismatch")
    unsigned_artifact = {key: value for key, value in artifact.items() if key != "artifactChecksum"}
    if hashlib.sha256(canonical_json(unsigned_artifact).encode()).hexdigest() != artifact.get("artifactChecksum"):
        raise RuntimeError("model artifact checksum mismatch")
    if artifact.get("lockboxReady") is not True:
        raise RuntimeError("model artifact is not approved for the primary lockbox")
    features = manifest.get("features", {})
    feature_path = freeze / "features.jsonl"
    if not feature_path.exists() or _file_sha256(feature_path) != features.get("sha256"):
        raise RuntimeError("sealed feature snapshot checksum mismatch")
    result = evaluate_range(freeze, LOCKBOX_START, LOCKBOX_END)
    payload = {
        "schemaVersion": "1.0.0",
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "contractChecksum": CONTRACT_SHA256,
        "manifestFiles": manifest["files"],
        "artifactChecksum": artifact["artifactChecksum"],
        "lockboxStartInclusive": LOCKBOX_START,
        "lockboxEndInclusive": LOCKBOX_END,
        "primaryEvaluationOrdinal": 1,
        "promotionEligible": False,
        "promotionBlockers": [
            "availability and goalie-start targets lack reconstructable lockbox labels",
            "candidate tournament and calibration are incomplete",
            "prospective operational SLO evidence is absent",
        ],
        "metrics": result,
    }
    payload["receiptChecksum"] = hashlib.sha256(canonical_json(payload).encode()).hexdigest()
    write_json(receipt, payload)
    return payload


def complete_lockbox_evidence_once(freeze: Path, receipt: Path, output: Path) -> dict[str, Any]:
    if output.exists():
        raise RuntimeError("lockbox evidence companion already exists")
    if not receipt.exists():
        raise RuntimeError("primary lockbox receipt is required")
    primary = read_json(receipt)
    artifact = read_json(freeze / "model-artifact.json")
    unsigned_receipt = {key: value for key, value in primary.items() if key != "receiptChecksum"}
    if hashlib.sha256(canonical_json(unsigned_receipt).encode()).hexdigest() != primary.get("receiptChecksum"):
        raise RuntimeError("primary lockbox receipt checksum mismatch")
    if primary.get("artifactChecksum") != artifact.get("artifactChecksum"):
        raise RuntimeError("primary receipt and artifact checksum mismatch")
    evidence = evaluate_lockbox_evidence(freeze, LOCKBOX_START, LOCKBOX_END)
    payload = {
        "schemaVersion": "1.0.0",
        "completedAt": datetime.now(timezone.utc).isoformat(),
        "contractChecksum": CONTRACT_SHA256,
        "primaryReceiptChecksum": primary["receiptChecksum"],
        "artifactChecksum": artifact["artifactChecksum"],
        "modelChangedAfterPrimaryReceipt": False,
        "tuningPermitted": False,
        "evidence": evidence,
        "promotionEligible": False,
        "promotionBlockers": [
            "playing probability and goalie targets are excluded from historical lockbox evidence",
            "prospective enriched validation and operational SLO evidence are absent",
        ],
    }
    payload["evidenceChecksum"] = hashlib.sha256(canonical_json(payload).encode()).hexdigest()
    write_json(output, payload)
    return payload


def evaluate_prospective_once(
    freeze: Path,
    primary_receipt: Path,
    output: Path,
    start_inclusive: str,
    end_inclusive: str,
) -> dict[str, Any]:
    if os.environ.get("PLAYER_FORECAST_PROSPECTIVE_CONFIRM") != "2026-27-fixed-artifact-once":
        raise RuntimeError("prospective confirmation is missing")
    if output.exists():
        raise RuntimeError("prospective evidence output already exists")
    if start_inclusive <= LOCKBOX_END or end_inclusive < start_inclusive:
        raise RuntimeError("prospective evaluation range is invalid")
    manifest = read_json(freeze / "manifest.json")
    artifact = read_json(freeze / "model-artifact.json")
    receipt = read_json(primary_receipt)
    if manifest.get("targetSeason") != 20262027:
        raise RuntimeError("prospective freeze must contain only the 2026-27 target season")
    prospective = manifest.get("prospective", {})
    unsigned_receipt = {key: value for key, value in receipt.items() if key != "receiptChecksum"}
    if hashlib.sha256(canonical_json(unsigned_receipt).encode()).hexdigest() != receipt.get("receiptChecksum"):
        raise RuntimeError("primary lockbox receipt checksum mismatch")
    if artifact.get("artifactChecksum") != receipt.get("artifactChecksum"):
        raise RuntimeError("prospective evidence must use the unchanged primary artifact")
    if prospective.get("artifactChecksum") != artifact.get("artifactChecksum") or prospective.get(
        "primaryReceiptChecksum"
    ) != receipt.get("receiptChecksum"):
        raise RuntimeError("prospective freeze binding is invalid")
    unsigned_artifact = {key: value for key, value in artifact.items() if key != "artifactChecksum"}
    if hashlib.sha256(canonical_json(unsigned_artifact).encode()).hexdigest() != artifact.get("artifactChecksum"):
        raise RuntimeError("model artifact checksum mismatch")
    feature_path = freeze / "features.jsonl"
    if not feature_path.exists() or _file_sha256(feature_path) != manifest.get("features", {}).get("sha256"):
        raise RuntimeError("prospective feature snapshot checksum mismatch")
    metrics = evaluate_range(freeze, start_inclusive, end_inclusive)
    if not metrics.get("targets"):
        raise RuntimeError("prospective evaluation range contains no eligible target rows")
    payload = {
        "schemaVersion": "1.0.0",
        "evidenceKind": "untouched_prospective",
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "contractChecksum": CONTRACT_SHA256,
        "primaryReceiptChecksum": receipt["receiptChecksum"],
        "artifactChecksum": artifact["artifactChecksum"],
        "season": 20262027,
        "startInclusive": start_inclusive,
        "endInclusive": end_inclusive,
        "modelChangedAfterPrimaryReceipt": False,
        "tuningPermitted": False,
        "promotionEligible": False,
        "metrics": metrics,
    }
    payload["evidenceChecksum"] = hashlib.sha256(canonical_json(payload).encode()).hexdigest()
    write_json(output, payload)
    return payload
