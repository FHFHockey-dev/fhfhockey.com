#!/usr/bin/env python3
"""Validate retained metadata for disposable Phase 5 outputs.

The helper hashes only the explicitly indexed external files/tree. It does not
print log content, inspect environment files, import application modules, or
write outside the audit package.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import stat
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AUDIT_RUN_ID = "REPO-AUDIT-2026-08-09-FROZEN-36536C3"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def line_count(path: Path) -> int:
    value = path.read_bytes()
    return value.count(b"\n") + (1 if value and not value.endswith(b"\n") else 0)


def canonical_tree_receipt(root: Path) -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    allocated_bytes = 0
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        info = path.stat()
        allocated_bytes += getattr(info, "st_blocks", 0) * 512
        records.append(
            {
                "path": path.relative_to(root).as_posix(),
                "mode": f"{stat.S_IMODE(info.st_mode):04o}",
                "size_bytes": info.st_size,
                "sha256": sha256_file(path),
            }
        )
    serialized = "".join(
        json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n"
        for record in records
    ).encode("utf-8")
    return {
        "file_count": len(records),
        "allocated_kib": allocated_bytes // 1024,
        "reconciliation_tree_sha256": hashlib.sha256(serialized).hexdigest(),
        "hash_algorithm": "sha256(sorted compact JSONL of relative path, mode, size_bytes, sha256)",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", required=True, type=Path)
    parser.add_argument("--external-root", required=True, type=Path)
    args = parser.parse_args()
    audit_dir = args.audit_dir.resolve()
    external_root = args.external_root.resolve()
    records = [
        json.loads(line)
        for line in (audit_dir / "evidence/external-output-manifest.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
        if line.strip()
    ]
    errors: list[dict[str, Any]] = []
    observations: list[dict[str, Any]] = []
    for record in records:
        alias = Path(record["path_alias"])
        if alias.is_absolute() or ".." in alias.parts:
            errors.append({"record_id": record["record_id"], "error": "unsafe_path_alias"})
            continue
        path = external_root / alias
        observation: dict[str, Any] = {
            "record_id": record["record_id"],
            "kind": record["kind"],
            "path_alias": record["path_alias"],
            "exists": path.exists(),
        }
        if not path.exists():
            errors.append({"record_id": record["record_id"], "error": "missing_external_output"})
            observations.append(observation)
            continue
        if record["kind"] == "command_log":
            actual_hash = sha256_file(path)
            actual_bytes = path.stat().st_size
            actual_lines = line_count(path)
            observation.update(
                {
                    "sha256_matches": actual_hash == record["sha256"],
                    "bytes_match": actual_bytes == record["bytes"],
                    "lines_match": actual_lines == record["lines"],
                }
            )
            if not all(
                observation[key]
                for key in ("sha256_matches", "bytes_match", "lines_match")
            ):
                errors.append({"record_id": record["record_id"], "error": "log_metadata_mismatch"})
        elif record["kind"] == "generated_runtime_tree":
            receipt = canonical_tree_receipt(path)
            observation.update(receipt)
            observation["file_count_matches"] = receipt["file_count"] == record["file_count"]
            observation["capture_tree_sha256"] = record["tree_sha256"]
            observation["capture_hash_role"] = "Phase 5 capture-time receipt; reconciliation uses the documented algorithm above"
            if not observation["file_count_matches"]:
                errors.append({"record_id": record["record_id"], "error": "tree_file_count_mismatch"})
        elif record["kind"] == "disposable_baseline_path_mutation":
            actual_hash = sha256_file(path)
            observation["post_command_sha256_matches"] = actual_hash == record["post_command_sha256"]
            if not observation["post_command_sha256_matches"]:
                errors.append({"record_id": record["record_id"], "error": "post_command_hash_mismatch"})
        else:
            errors.append({"record_id": record["record_id"], "error": "unknown_output_kind"})
        observations.append(observation)

    result = {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "record_type": "external_disposable_output_integrity",
        "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "result": "passed" if not errors else "failed",
        "indexed_outputs": len(records),
        "verified_outputs": len(records) - len(errors),
        "errors": errors,
        "observations": observations,
        "boundary": "External/disposable outputs were never copied into frozen product-source paths.",
    }
    (audit_dir / "evidence/external-output-integrity.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "result": result["result"],
                "indexed_outputs": result["indexed_outputs"],
                "verified_outputs": result["verified_outputs"],
                "error_count": len(errors),
            },
            indent=2,
            sort_keys=True,
        )
    )
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
