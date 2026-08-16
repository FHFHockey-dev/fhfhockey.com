#!/usr/bin/env python3
"""Validate one bounded workstream shard against its exact assignment."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


def load_jsonl(path: Path) -> list[dict]:
    records = []
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as error:
                raise RuntimeError(f"{path}:{line_number}: {error}") from error
            records.append(record)
    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assignment", required=True)
    parser.add_argument("--shard", required=True)
    args = parser.parse_args()

    assignment_path = Path(args.assignment).resolve()
    shard_path = Path(args.shard).resolve()
    assignment = load_jsonl(assignment_path)
    shard = load_jsonl(shard_path)
    expected = {record["file_id"]: record["path"] for record in assignment}

    dispositions = [
        record
        for record in shard
        if record.get("record_type") == "file_disposition"
    ]
    counts = Counter(record.get("file_id") for record in dispositions)
    duplicates = sorted(key for key, count in counts.items() if count != 1)
    actual = {record.get("file_id"): record.get("path") for record in dispositions}
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    path_mismatches = sorted(
        file_id
        for file_id in set(expected) & set(actual)
        if expected[file_id] != actual[file_id]
    )
    invalid_status = sorted(
        record.get("file_id")
        for record in dispositions
        if record.get("audit_status") not in {"audited", "excluded"}
    )
    temporary_path_leaks = [
        index
        for index, record in enumerate(shard, start=1)
        if "/private/var/folders/" in json.dumps(record)
    ]

    result = {
        "assignment_records": len(expected),
        "shard_records": len(shard),
        "file_dispositions": len(dispositions),
        "record_types": dict(
            sorted(Counter(record.get("record_type", "missing") for record in shard).items())
        ),
        "missing_file_ids": missing[:20],
        "unexpected_file_ids": unexpected[:20],
        "duplicate_file_ids": duplicates[:20],
        "path_mismatches": path_mismatches[:20],
        "invalid_status": invalid_status[:20],
        "temporary_path_leaks": temporary_path_leaks[:20],
    }
    valid = not any(
        (
            missing,
            unexpected,
            duplicates,
            path_mismatches,
            invalid_status,
            temporary_path_leaks,
        )
    )
    result["result"] = "passed" if valid else "failed"
    print(json.dumps(result, indent=2))
    if not valid:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
