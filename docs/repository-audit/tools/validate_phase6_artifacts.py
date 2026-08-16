#!/usr/bin/env python3
"""Validate Phase 6 canonical findings, cleanup records, and guides."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


AUDIT_RUN_ID = "REPO-AUDIT-2026-08-09-FROZEN-36536C3"
FINDING_ID = re.compile(r"^FIND-[A-Z0-9]+-\d{3}$")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f"{path}:{line_number}: expected object")
            records.append(value)
    return records


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", required=True, type=Path)
    args = parser.parse_args()
    audit_dir = args.audit_dir.resolve()
    errors: list[str] = []

    manifest_records = read_jsonl(audit_dir / "evidence/frozen-source-manifest.jsonl")
    manifest = {record["path"]: record for record in manifest_records}
    frozen_prefixes = {
        prefix
        for path in manifest
        for prefix in ["/".join(path.split("/")[:index]) for index in range(1, len(path.split("/")))]
    }
    merged = read_jsonl(audit_dir / "evidence/shards/merged-static-records.jsonl")
    static_candidates = {
        record["finding_id"]: record
        for record in merged
        if record.get("record_type") == "finding_candidate"
    }
    source_cleanup = {
        record["cleanup_id"]: record
        for record in merged
        if record.get("record_type") == "documentation_cleanup_candidate"
    }
    adjudications = json.loads(
        (audit_dir / "evidence/finding-adjudications.json").read_text(encoding="utf-8")
    )
    additional_candidates = {
        record["finding_id"]: record
        for record in adjudications["additional_candidates"]
    }
    all_candidate_ids = set(static_candidates) | set(additional_candidates)

    enhancement = read_jsonl(audit_dir / "enhancement-ledger.jsonl")
    findings = [record for record in enhancement if record.get("record_type") == "justified_finding"]
    no_change = [record for record in enhancement if record.get("record_type") == "no_justified_change"]
    if len(enhancement) != 35 or len(findings) != 30 or len(no_change) != 5:
        fail(errors, f"enhancement counts are {len(enhancement)}/{len(findings)}/{len(no_change)}, expected 35/30/5")

    finding_ids = [record.get("finding_id") for record in findings]
    if len(finding_ids) != len(set(finding_ids)):
        fail(errors, "canonical finding IDs are not unique")
    for record in findings:
        finding_id = record.get("finding_id")
        if not isinstance(finding_id, str) or not FINDING_ID.fullmatch(finding_id):
            fail(errors, f"invalid canonical finding ID {finding_id!r}")
        if record.get("audit_run_id") != AUDIT_RUN_ID:
            fail(errors, f"{finding_id}: wrong audit run ID")
        if record.get("priority") not in {"P0", "P1", "P2", "P3"}:
            fail(errors, f"{finding_id}: invalid priority")
        if not record.get("recommendation") or not record.get("expected_benefit"):
            fail(errors, f"{finding_id}: missing recommendation or benefit")
        source_ids = record.get("source_candidate_ids") or []
        if not source_ids:
            fail(errors, f"{finding_id}: no source candidate")
        if [item.get("candidate_id") for item in record.get("source_candidates", [])] != source_ids:
            fail(errors, f"{finding_id}: source candidate records are out of order or incomplete")
        for affected in record.get("affected_files", []):
            path = affected.get("path")
            if path not in manifest:
                fail(errors, f"{finding_id}: affected path is not frozen: {path}")
                continue
            if affected.get("baseline_sha256") != manifest[path]["sha256"]:
                fail(errors, f"{finding_id}: affected hash mismatch: {path}")
        for source in record.get("source_candidates", []):
            for evidence in source.get("evidence_refs", []):
                path = evidence.get("path")
                if path in manifest and evidence.get("baseline_sha256") != manifest[path]["sha256"]:
                    fail(errors, f"{finding_id}: evidence hash mismatch: {path}")
        if (
            record.get("priority") in {"P0", "P1"}
            and record.get("primary_category") in {"security/privacy", "correctness"}
            and not record.get("independent_verification_refs")
        ):
            fail(errors, f"{finding_id}: high-impact security/correctness finding lacks independent verification")
        for ref in record.get("independent_verification_refs", []):
            artifact_path = ref.split("#", 1)[0]
            if not (audit_dir / artifact_path).is_file():
                fail(errors, f"{finding_id}: verification artifact missing: {artifact_path}")

    used_candidates = [candidate_id for record in findings for candidate_id in record["source_candidate_ids"]]
    counts = Counter(used_candidates)
    if set(used_candidates) != all_candidate_ids:
        fail(errors, f"candidate coverage mismatch: missing={sorted(all_candidate_ids - set(used_candidates))}, extra={sorted(set(used_candidates) - all_candidate_ids)}")
    repeated = sorted(candidate_id for candidate_id, count in counts.items() if count != 1)
    if repeated:
        fail(errors, f"candidates not used exactly once: {repeated}")

    no_change_ids = [record.get("record_id") for record in no_change]
    if len(no_change_ids) != len(set(no_change_ids)) or any(not item for item in no_change_ids):
        fail(errors, "no-change IDs are missing or duplicated")
    required_no_change_categories = {"performance", "observability", "visual organization", "dependencies", "tests"}
    represented = {category for record in no_change for category in record.get("categories", [])}
    if not required_no_change_categories <= represented:
        fail(errors, f"missing no-change categories: {sorted(required_no_change_categories - represented)}")
    for record in no_change:
        for ref in record.get("evidence_refs", []):
            artifact_path = ref.get("path") if isinstance(ref, dict) else ref.split("#", 1)[0]
            if not (audit_dir / artifact_path).is_file():
                fail(errors, f"{record.get('record_id')}: evidence artifact missing: {artifact_path}")

    cleanup = read_jsonl(audit_dir / "documentation-cleanup-ledger.jsonl")
    if len(cleanup) != 626:
        fail(errors, f"cleanup count is {len(cleanup)}, expected 626")
    cleanup_ids = [record.get("cleanup_id") for record in cleanup]
    if len(cleanup_ids) != len(set(cleanup_ids)) or any(not item for item in cleanup_ids):
        fail(errors, "cleanup IDs are missing or duplicated")
    statuses = Counter(record.get("status") for record in cleanup)
    expected_statuses = Counter({"Archive": 341, "Keep": 244, "Merge": 2, "Needs owner decision": 39})
    if statuses != expected_statuses:
        fail(errors, f"cleanup statuses {dict(statuses)} do not match {dict(expected_statuses)}")
    if statuses.get("Delete candidate", 0):
        fail(errors, "cleanup ledger contains a Delete candidate")
    canonical_cleanup = {record["cleanup_id"]: record for record in cleanup}
    for cleanup_id, source in source_cleanup.items():
        if canonical_cleanup.get(cleanup_id) != source:
            fail(errors, f"{cleanup_id}: canonical record differs from source shard")
    for source in adjudications["supplemental_cleanup_records"]:
        if canonical_cleanup.get(source["cleanup_id"]) != source:
            fail(errors, f"{source['cleanup_id']}: supplemental record differs from adjudication")
    for record in cleanup:
        path = record.get("path")
        if path not in manifest and path not in frozen_prefixes:
            fail(errors, f"{record.get('cleanup_id')}: path is not in the frozen universe: {path}")
        evidence = record.get("evidence") or {}
        supplied_hash = evidence.get("baseline_sha256")
        if path in manifest and supplied_hash and supplied_hash != manifest[path]["sha256"]:
            fail(errors, f"{record.get('cleanup_id')}: baseline hash mismatch")

    stylesheet_plan = (audit_dir / "stylesheet-cleanup-plan.md").read_text(encoding="utf-8")
    cleanup_guide = (audit_dir / "cleanup-guide.md").read_text(encoding="utf-8")
    for token in ["166 stylesheets", "84,475 lines", "551 media queries", "395 `!important`", "FIND-STYLE-001", "FIND-STYLE-002", "FIND-STYLE-003", "Safe migration sequence"]:
        if token not in stylesheet_plan:
            fail(errors, f"stylesheet plan missing required evidence token: {token}")
    for token in ["626 records", "| Keep | 244", "| Archive | 341", "| Merge | 2", "| Needs owner decision | 39", "| Delete candidate | 0", "DOC-CLEAN-000547"]:
        if token not in cleanup_guide:
            fail(errors, f"cleanup guide missing required evidence token: {token}")

    for path in [
        audit_dir / "enhancement-ledger.jsonl",
        audit_dir / "documentation-cleanup-ledger.jsonl",
        audit_dir / "stylesheet-cleanup-plan.md",
        audit_dir / "cleanup-guide.md",
    ]:
        text = path.read_text(encoding="utf-8")
        if "/private/var/" in text or "/Users/tim/" in text:
            fail(errors, f"temporary or developer-local absolute path leaked into {path.name}")

    result = {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "result": "passed" if not errors else "failed",
        "errors": errors,
        "counts": {
            "static_candidates": len(static_candidates),
            "validation_candidates": len(additional_candidates),
            "canonical_findings": len(findings),
            "no_justified_change": len(no_change),
            "cleanup_records": len(cleanup),
            "cleanup_statuses": dict(sorted(statuses.items())),
        },
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
