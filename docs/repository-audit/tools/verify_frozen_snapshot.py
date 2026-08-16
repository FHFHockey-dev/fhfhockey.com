#!/usr/bin/env python3
"""Verify the canonical frozen snapshot against its durable manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
from pathlib import Path


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--manifest", required=True)
    args = parser.parse_args()

    source_root = Path(args.source_root).resolve()
    manifest_path = Path(args.manifest).resolve()
    records = [
        json.loads(line)
        for line in manifest_path.open(encoding="utf-8")
        if line.strip()
    ]
    errors: list[dict[str, str]] = []
    for record in records:
        path = source_root / record["path"]
        try:
            file_stat = path.lstat()
        except FileNotFoundError:
            errors.append({"kind": "missing", "path": record["path"]})
            continue
        actual_mode = f"{stat.S_IMODE(file_stat.st_mode):04o}"
        if actual_mode != record["mode"]:
            errors.append({"kind": "mode", "path": record["path"]})
            continue
        if record["kind"] == "symlink":
            target = os.readlink(path)
            actual_hash = hashlib.sha256(
                target.encode("utf-8", errors="surrogateescape")
            ).hexdigest()
        else:
            actual_hash = hash_file(path)
        if actual_hash != record["sha256"]:
            errors.append({"kind": "hash", "path": record["path"]})

    result = {
        "manifest_sha256": hash_file(manifest_path),
        "expected": len(records),
        "verified": len(records) - len(errors),
        "errors": errors[:20],
        "result": "passed" if not errors else "failed",
    }
    print(json.dumps(result, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
