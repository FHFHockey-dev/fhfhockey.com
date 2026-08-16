#!/usr/bin/env python3
"""Validate audit-package files, hashes, provenance, and coverage separation."""

from __future__ import annotations

import argparse
import hashlib
import json
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


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", required=True, type=Path)
    args = parser.parse_args()
    audit_dir = args.audit_dir.resolve()
    manifest = read_jsonl(audit_dir / "evidence/audit-package-manifest.jsonl")
    coverage = read_jsonl(audit_dir / "coverage-ledger.jsonl")
    actual_paths = sorted(
        path.relative_to(audit_dir).as_posix()
        for path in audit_dir.rglob("*")
        if path.is_file()
    )
    manifest_paths = [record["path"] for record in manifest]
    errors: list[dict[str, Any]] = []

    if len(manifest_paths) != len(set(manifest_paths)):
        errors.append({"error": "duplicate_package_manifest_path"})
    missing = sorted(set(manifest_paths) - set(actual_paths))
    extra = sorted(set(actual_paths) - set(manifest_paths))
    if missing:
        errors.append({"error": "manifest_paths_missing", "paths": missing})
    if extra:
        errors.append({"error": "unmanifested_package_paths", "paths": extra})

    validated_hashes = 0
    self_referential = 0
    for record in manifest:
        path = audit_dir / record["path"]
        if not path.is_file():
            continue
        if path.stat().st_size != record["size_bytes"] and not record.get("self_referential_hash_omitted"):
            errors.append({"error": "size_mismatch", "path": record["path"]})
        if record.get("self_referential_hash_omitted"):
            self_referential += 1
            if record.get("sha256") is not None:
                errors.append({"error": "self_referential_hash_not_null", "path": record["path"]})
            continue
        if record.get("sha256") != sha256_file(path):
            errors.append({"error": "package_hash_mismatch", "path": record["path"]})
        else:
            validated_hashes += 1

    frozen_coverage = [record for record in coverage if record.get("record_kind") == "file"]
    generated_coverage = [record for record in coverage if record.get("record_kind") == "audit_generated"]
    generated_paths = [
        record["path"].removeprefix("docs/repository-audit/")
        for record in generated_coverage
    ]
    if len(frozen_coverage) != 3_580:
        errors.append({"error": "frozen_coverage_count", "actual": len(frozen_coverage)})
    if set(generated_paths) != set(actual_paths):
        errors.append(
            {
                "error": "audit_generated_coverage_mismatch",
                "missing": sorted(set(actual_paths) - set(generated_paths)),
                "extra": sorted(set(generated_paths) - set(actual_paths)),
            }
        )
    if len(generated_paths) != len(set(generated_paths)):
        errors.append({"error": "duplicate_audit_generated_coverage_path"})

    result = {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "record_type": "audit_package_integrity",
        "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "result": "passed" if not errors else "failed",
        "errors": errors,
        "package_files": len(actual_paths),
        "manifest_records": len(manifest),
        "validated_nonself_hashes": validated_hashes,
        "self_referential_hash_omissions": self_referential,
        "coverage": {
            "frozen_source_records": len(frozen_coverage),
            "audit_generated_records": len(generated_coverage),
            "missing_or_extra_generated_paths": len(set(actual_paths) ^ set(generated_paths)),
        },
        "provenance_domains": {
            "frozen_source": "evidence/frozen-source-manifest.jsonl",
            "audit_generated": "evidence/audit-package-manifest.jsonl",
            "external_disposable": "evidence/external-output-integrity.json",
            "live_drift": "evidence/live-worktree-drift.jsonl",
        },
    }
    (audit_dir / "evidence/package-integrity.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "result": result["result"],
                "error_count": len(errors),
                "package_files": len(actual_paths),
                "validated_nonself_hashes": validated_hashes,
                "self_referential_hash_omissions": self_referential,
            },
            indent=2,
            sort_keys=True,
        )
    )
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
