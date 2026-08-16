#!/usr/bin/env python3
"""Refresh audit-generated coverage and package provenance.

The tool reads and writes only docs/repository-audit. Baseline FILE records are
preserved byte-for-data-equivalent; AUDIT records are regenerated from the
current package. Self-referential ledger/manifest hashes are intentionally null.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


SELF_REFERENTIAL = {
    "coverage-ledger.jsonl",
    "evidence/audit-package-manifest.jsonl",
    "evidence/final-completion.json",
    "evidence/package-integrity.json",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-root", required=True)
    args = parser.parse_args()

    root = Path(args.audit_root).resolve()
    coverage_path = root / "coverage-ledger.jsonl"
    package_manifest_path = root / "evidence" / "audit-package-manifest.jsonl"

    baseline_records = []
    if coverage_path.exists():
        for line in coverage_path.open(encoding="utf-8"):
            if not line.strip():
                continue
            record = json.loads(line)
            if record.get("record_kind") == "file":
                baseline_records.append(record)

    artifact_paths = sorted(
        path.relative_to(root).as_posix()
        for path in root.rglob("*")
        if path.is_file()
    )
    audit_records = []
    manifest_records = []
    for index, relative in enumerate(artifact_paths, start=1):
        path = root / relative
        digest = None if relative in SELF_REFERENTIAL else sha256(path)
        audit_records.append(
            {
                "schema_version": 1,
                "record_id": f"AUDIT-{index:06d}",
                "audit_run_id": "REPO-AUDIT-2026-08-09-FROZEN-36536C3",
                "source_ref": "audit-generated",
                "record_kind": "audit_generated",
                "file_id": f"AUDIT-{index:06d}",
                "path": f"docs/repository-audit/{relative}",
                "git_state": "audit_package_addition",
                "worktree_state": "audit_generated",
                "baseline_sha256": digest,
                "baseline_mode": f"{path.stat().st_mode & 0o777:04o}",
                "symlink_target_hash": None,
                "size_bytes": path.stat().st_size,
                "mime": "application/octet-stream",
                "area": "audit_package",
                "owner_workstream": "coordinator",
                "scope_class": "audit_generated",
                "review_depth": "provenance",
                "exclusion_code": None,
                "audit_status": "audited",
                "disposition": "retained audit artifact",
                "entity_ids": [],
                "finding_ids": [],
                "evidence_refs": ["README.md tool and artifact index at completion"],
                "created_at": "2026-08-09T13:37:33Z",
                "updated_at": "2026-08-09T13:37:33Z",
                "self_referential_hash_omitted": relative in SELF_REFERENTIAL,
            }
        )
        manifest_records.append(
            {
                "schema_version": 1,
                "record_id": f"PKG-{index:06d}",
                "path": relative,
                "size_bytes": path.stat().st_size,
                "sha256": digest,
                "self_referential_hash_omitted": relative in SELF_REFERENTIAL,
            }
        )

    with coverage_path.open("w", encoding="utf-8", newline="\n") as output:
        for record in [*baseline_records, *audit_records]:
            output.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")

    with package_manifest_path.open("w", encoding="utf-8", newline="\n") as output:
        for record in manifest_records:
            output.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")

    print(
        json.dumps(
            {
                "baseline_records": len(baseline_records),
                "audit_generated_records": len(audit_records),
                "package_manifest_records": len(manifest_records),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
