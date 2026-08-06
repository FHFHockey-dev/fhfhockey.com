from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

CONTRACT_VERSION = "player-forecasts-research-v1"
CONTRACT_SHA256 = "9d4a30f5027e8b277015c592a39715e16d18c9a371dd352ddd4f0738868d9574"
VALIDATION_CONTRACT_VERSION = "player-forecasts-research-v2-validation"
VALIDATION_CONTRACT_SHA256 = "14832482d902ca02fa148be4b31eaa23fe57b5a2d4ac642d87ba14403a90f5ed"
DEVELOPMENT_END = "2026-01-02"
LOCKBOX_START = "2026-01-03"
LOCKBOX_END = "2026-04-16"
TARGET_SEASON = 20252026
GAME_TYPE = 2


def repository_root() -> Path:
    return Path(__file__).resolve().parents[2]


def contract_path() -> Path:
    return repository_root() / "docs" / "player-projections" / "research-contract-v1.json"


def validation_contract_path() -> Path:
    return repository_root() / "docs" / "player-projections" / "research-contract-v2-validation.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_and_verify_contract() -> dict[str, Any]:
    path = contract_path()
    checksum = sha256_file(path)
    if checksum != CONTRACT_SHA256:
        raise RuntimeError("research contract checksum mismatch")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("contractVersion") != CONTRACT_VERSION:
        raise RuntimeError("research contract version mismatch")
    return payload


def load_and_verify_validation_contract() -> dict[str, Any]:
    path = validation_contract_path()
    checksum = sha256_file(path)
    if checksum != VALIDATION_CONTRACT_SHA256:
        raise RuntimeError("validation research contract checksum mismatch")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("contractVersion") != VALIDATION_CONTRACT_VERSION:
        raise RuntimeError("validation research contract version mismatch")
    base = payload.get("baseContract", {})
    if base.get("version") != CONTRACT_VERSION or base.get("checksum") != CONTRACT_SHA256:
        raise RuntimeError("validation research contract base mismatch")
    return payload
