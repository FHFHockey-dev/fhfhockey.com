from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Iterable, Iterator


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(value, indent=2, sort_keys=True, default=str)}\n", encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> tuple[int, str]:
    path.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    count = 0
    with path.open("wb") as handle:
        for row in rows:
            encoded = f"{canonical_json(row)}\n".encode()
            handle.write(encoded)
            digest.update(encoded)
            count += 1
    return count, digest.hexdigest()


def read_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def require_database_url() -> str:
    value = os.environ.get("PLAYER_FORECAST_DATABASE_URL", "").strip()
    if not value:
        raise RuntimeError("PLAYER_FORECAST_DATABASE_URL is required")
    return value


def assert_output_outside_repository(path: Path, repository_root: Path) -> None:
    resolved = path.expanduser().resolve()
    try:
        resolved.relative_to(repository_root.resolve())
    except ValueError:
        return
    raise RuntimeError("research data and model artifacts must be written outside the repository")
