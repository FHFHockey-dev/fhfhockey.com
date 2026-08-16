#!/usr/bin/env python3
"""Atomically replace an exact string value in a JSONL audit artifact."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any


def replace_value(value: Any, old: str, new: str) -> tuple[Any, int]:
    if isinstance(value, str):
        return (new, 1) if value == old else (value, 0)
    if isinstance(value, list):
        result: list[Any] = []
        replacements = 0
        for item in value:
            updated, count = replace_value(item, old, new)
            result.append(updated)
            replacements += count
        return result, replacements
    if isinstance(value, dict):
        result_dict: dict[str, Any] = {}
        replacements = 0
        for key, item in value.items():
            updated, count = replace_value(item, old, new)
            result_dict[key] = updated
            replacements += count
        return result_dict, replacements
    return value, 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--old", required=True)
    parser.add_argument("--new", required=True)
    parser.add_argument("--expected", required=True, type=int)
    args = parser.parse_args()

    path = Path(args.input).resolve()
    records = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    updated_records: list[dict[str, Any]] = []
    total = 0
    for record in records:
        updated, count = replace_value(record, args.old, args.new)
        updated_records.append(updated)
        total += count
    if total != args.expected:
        raise SystemExit(f"expected {args.expected} replacements, found {total}")

    temporary = path.with_suffix(path.suffix + ".rewrite-tmp")
    temporary.write_text(
        "".join(json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n" for record in updated_records),
        encoding="utf-8",
    )
    os.replace(temporary, path)
    print(json.dumps({"path": path.name, "records": len(records), "replacements": total}))


if __name__ == "__main__":
    main()
