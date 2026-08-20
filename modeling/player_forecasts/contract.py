from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

CONTRACT_VERSION = "player-forecasts-research-v1"
CONTRACT_SHA256 = "9d4a30f5027e8b277015c592a39715e16d18c9a371dd352ddd4f0738868d9574"
VALIDATION_CONTRACT_VERSION = "player-forecasts-research-v2-validation"
VALIDATION_CONTRACT_SHA256 = "14832482d902ca02fa148be4b31eaa23fe57b5a2d4ac642d87ba14403a90f5ed"
SEASON_CONTRACT_VERSION = "player-forecasts-research-v3-season"
SEASON_CONTRACT_SHA256 = "29c6766f63ba9a8dbf8890cb6a388418945134b70217d58e9d8645b34dc36b93"
FANTASY_SEASON_CONTRACT_VERSION = "player-forecasts-research-v4-season-fantasy"
FANTASY_SEASON_CONTRACT_SHA256 = "e0b10f508d4f3e96b93cb3b203930e05d15c1f75dcc969030e4a04f20de18150"
ADVANCED_SEASON_CONTRACT_VERSION = "player-forecasts-research-v5-season-advanced"
ADVANCED_SEASON_CONTRACT_SHA256 = "9b91e7d1de540664f404cc518222e61fcb837127a25916ee735f37d7a185a435"
SEASON_CONTRACTS = {
    SEASON_CONTRACT_VERSION: (
        "research-contract-v3-season.json",
        SEASON_CONTRACT_SHA256,
    ),
    FANTASY_SEASON_CONTRACT_VERSION: (
        "research-contract-v4-season-fantasy.json",
        FANTASY_SEASON_CONTRACT_SHA256,
    ),
    ADVANCED_SEASON_CONTRACT_VERSION: (
        "research-contract-v5-season-advanced.json",
        ADVANCED_SEASON_CONTRACT_SHA256,
    ),
}
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


def season_contract_path(version: str = SEASON_CONTRACT_VERSION) -> Path:
    try:
        filename, _ = SEASON_CONTRACTS[version]
    except KeyError as error:
        raise RuntimeError(f"unsupported season research contract: {version}") from error
    return repository_root() / "docs" / "player-projections" / filename


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


def load_and_verify_season_contract(
    version: str = SEASON_CONTRACT_VERSION,
) -> dict[str, Any]:
    path = season_contract_path(version)
    checksum = sha256_file(path)
    _, expected_checksum = SEASON_CONTRACTS[version]
    if checksum != expected_checksum:
        raise RuntimeError("season research contract checksum mismatch")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("contractVersion") != version:
        raise RuntimeError("season research contract version mismatch")
    if payload.get("seasonId") != 20262027:
        raise RuntimeError("season research contract target mismatch")
    return payload
