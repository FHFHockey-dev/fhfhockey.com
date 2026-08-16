#!/usr/bin/env python3
"""Merge complete non-overlapping workstream shards into static evidence.

The tool reads only audit artifacts. It requires one valid disposition for
every frozen assignment before updating canonical coverage, and it preserves
all non-disposition records with source-shard provenance for coordinator
reconciliation. It does not classify routes or accept finding candidates.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


OWNERS = (
    "documentation-operations",
    "frontend-cms",
    "platform-data",
    "web-backend",
)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise RuntimeError(f"{path}:{line_number}: {error}") from error
            if not isinstance(value, dict):
                raise RuntimeError(f"{path}:{line_number}: expected object")
            records.append(value)
    return records


def record_ids(record: dict[str, Any]) -> list[str]:
    keys = (
        "entity_id",
        "db_object_id",
        "migration_id",
        "environment_id",
        "secret_store_id",
        "record_id",
    )
    return [str(record[key]) for key in keys if record.get(key)]


def record_paths(record: dict[str, Any]) -> list[str]:
    paths: list[str] = []
    for key in ("path", "definition_path"):
        if isinstance(record.get(key), str):
            paths.append(record[key])
    affected = record.get("affected_paths")
    if isinstance(affected, list):
        paths.extend(item for item in affected if isinstance(item, str))
    for evidence in record.get("evidence_refs", []):
        if isinstance(evidence, dict) and isinstance(evidence.get("path"), str):
            paths.append(evidence["path"])
    return sorted(set(paths))


def disposition_evidence(record: dict[str, Any]) -> list[Any]:
    """Normalize the two workstream disposition evidence field shapes."""
    evidence = record.get("evidence_refs")
    if evidence is None:
        evidence = record.get("evidence")
    if evidence is None:
        return []
    return evidence if isinstance(evidence, list) else [evidence]


def disposition_exclusion_code(record: dict[str, Any]) -> str | None:
    if record.get("audit_status") != "excluded":
        return None
    if record.get("exclusion_code"):
        return str(record["exclusion_code"])
    disposition = str(record.get("disposition", ""))
    if disposition == "secret_content_not_inspected":
        return "secret_content_not_inspected"
    if "binary" in disposition:
        return "binary_asset_deep_review_exclusion"
    return "bounded_deep_review_exclusion"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-root", required=True)
    args = parser.parse_args()

    root = Path(args.audit_root).resolve()
    assignment_root = root / "evidence" / "shards" / "assignments"
    shard_root = root / "evidence" / "shards" / "phase-2-3"
    merged_path = root / "evidence" / "shards" / "merged-static-records.jsonl"
    coverage_path = root / "coverage-ledger.jsonl"

    expected: dict[str, dict[str, Any]] = {}
    dispositions: dict[str, dict[str, Any]] = {}
    merged: list[dict[str, Any]] = []
    record_types: Counter[str] = Counter()
    source_counts: Counter[str] = Counter()
    entity_ids_by_path: dict[str, set[str]] = defaultdict(set)
    finding_ids_by_path: dict[str, set[str]] = defaultdict(set)

    for owner in OWNERS:
        assignment_path = assignment_root / f"{owner}.jsonl"
        shard_path = shard_root / f"{owner}.jsonl"
        if not assignment_path.is_file() or not shard_path.is_file():
            raise RuntimeError(f"required assignment/shard missing for {owner}")
        for assignment in load_jsonl(assignment_path):
            file_id = assignment["file_id"]
            if file_id in expected:
                raise RuntimeError(f"assignment overlap: {file_id}")
            expected[file_id] = assignment
        for index, record in enumerate(load_jsonl(shard_path), start=1):
            if "/private/var/folders/" in json.dumps(record):
                raise RuntimeError(f"temporary path leak: {owner} record {index}")
            record_type = str(record.get("record_type", "missing"))
            record_types[record_type] += 1
            source_counts[owner] += 1
            if record_type == "file_disposition":
                file_id = record.get("file_id")
                if file_id in dispositions:
                    raise RuntimeError(f"duplicate disposition: {file_id}")
                dispositions[str(file_id)] = record
                continue
            preserved = dict(record)
            preserved["source_workstream"] = owner
            preserved["source_shard_record"] = index
            merged.append(preserved)
            ids = record_ids(record)
            finding_id = record.get("finding_id")
            for path in record_paths(record):
                entity_ids_by_path[path].update(ids)
                if finding_id:
                    finding_ids_by_path[path].add(str(finding_id))

    missing = sorted(set(expected) - set(dispositions))
    extra = sorted(set(dispositions) - set(expected))
    if missing or extra:
        raise RuntimeError(f"disposition mismatch: missing={missing[:20]} extra={extra[:20]}")

    for file_id, disposition in dispositions.items():
        assignment = expected[file_id]
        if disposition.get("path") != assignment.get("path"):
            raise RuntimeError(f"path mismatch: {file_id}")
        if disposition.get("audit_status") not in {"audited", "excluded"}:
            raise RuntimeError(f"invalid audit status: {file_id}")
        reported_hash = disposition.get("baseline_sha256")
        if reported_hash and reported_hash != assignment.get("baseline_sha256"):
            raise RuntimeError(f"baseline hash mismatch: {file_id}")

    coverage_records = load_jsonl(coverage_path)
    frozen_seen: set[str] = set()
    for record in coverage_records:
        if record.get("record_kind") != "file":
            continue
        file_id = record["file_id"]
        disposition = dispositions[file_id]
        path = record["path"]
        record["audit_status"] = disposition["audit_status"]
        record["disposition"] = disposition.get("disposition")
        record["exclusion_code"] = disposition_exclusion_code(disposition)
        record["entity_ids"] = sorted(entity_ids_by_path.get(path, set()))
        record["finding_ids"] = sorted(finding_ids_by_path.get(path, set()))
        record["evidence_refs"] = disposition_evidence(disposition)
        record["audit_notes"] = disposition.get("notes")
        record["updated_at"] = "2026-08-09T14:00:00Z"
        frozen_seen.add(file_id)
    if frozen_seen != set(expected):
        raise RuntimeError("coverage frozen-file universe differs from assignments")

    with merged_path.open("w", encoding="utf-8", newline="\n") as output:
        for record in merged:
            output.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
    with coverage_path.open("w", encoding="utf-8", newline="\n") as output:
        for record in coverage_records:
            output.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")

    print(
        json.dumps(
            {
                "assignments": len(expected),
                "dispositions": len(dispositions),
                "merged_non_disposition_records": len(merged),
                "record_types": dict(sorted(record_types.items())),
                "source_records": dict(sorted(source_counts.items())),
                "result": "passed",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
