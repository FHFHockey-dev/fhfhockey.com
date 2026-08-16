#!/usr/bin/env python3
"""Build the canonical Phase 6 enhancement and cleanup ledgers.

This audit-only helper reads frozen-snapshot-derived audit artifacts. It does not
import application modules, access the network or databases, or write outside
the audit package supplied with --audit-dir.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any, Iterable


AUDIT_RUN_ID = "REPO-AUDIT-2026-08-09-FROZEN-36536C3"


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError(f"{path}:{line_number}: expected an object")
            records.append(value)
    return records


def write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for record in records:
            handle.write(json.dumps(record, sort_keys=True, separators=(",", ":")))
            handle.write("\n")


def load_manifest(path: Path) -> dict[str, dict[str, Any]]:
    manifest = {record["path"]: record for record in read_jsonl(path)}
    if len(manifest) != 3_580:
        raise ValueError(f"expected 3,580 frozen paths, found {len(manifest)}")
    return manifest


def normalize_evidence_ref(
    value: Any, manifest: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    if isinstance(value, dict):
        result = dict(value)
        path = result.get("path")
        if path in manifest:
            expected_hash = manifest[path]["sha256"]
            supplied_hash = result.get("baseline_sha256") or result.get("sha256")
            if supplied_hash is not None and supplied_hash != expected_hash:
                raise ValueError(f"evidence hash mismatch for {path}")
            result.pop("sha256", None)
            result["baseline_sha256"] = expected_hash
        return result

    if not isinstance(value, str):
        raise ValueError(f"unsupported evidence reference: {value!r}")

    if ":" in value:
        method, remainder = value.split(":", 1)
        matching_paths = [
            path
            for path in manifest
            if remainder == path or remainder.startswith(path + ":")
        ]
        if matching_paths:
            path = max(matching_paths, key=len)
            result: dict[str, Any] = {
                "method": method,
                "path": path,
                "baseline_sha256": manifest[path]["sha256"],
            }
            suffix = remainder[len(path) :]
            if suffix.startswith(":") and suffix[1:]:
                result["lines"] = suffix[1:]
            return result
        if method in {"receipt", "command"}:
            return {"method": method, "path": remainder, "receipt": remainder}

    return {"method": "source-candidate-summary", "summary": value}


def canonical_source_candidate(
    candidate: dict[str, Any], manifest: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    raw_refs = candidate.get("evidence_refs")
    if raw_refs is None:
        raw_refs = candidate.get("evidence", [])
    normalized = [normalize_evidence_ref(item, manifest) for item in raw_refs]
    evidence_refs = [
        item for item in normalized if item.get("method") != "source-candidate-summary"
    ]
    evidence_summaries = [
        item["summary"]
        for item in normalized
        if item.get("method") == "source-candidate-summary"
    ]
    return {
        "candidate_id": candidate["finding_id"],
        "source_workstream": candidate.get("source_workstream")
        or candidate.get("workstream")
        or "phase-5-validation",
        "source_shard_record": candidate.get("source_shard_record"),
        "source_priority": candidate.get("priority") or candidate.get("severity"),
        "source_confidence": candidate.get("confidence"),
        "source_category": candidate.get("category")
        or candidate.get("dimensions"),
        "evidence_refs": evidence_refs,
        "evidence_summaries": evidence_summaries,
    }


def normalize_audit_artifact_ref(value: str) -> dict[str, Any]:
    path, separator, fragment = value.partition("#")
    result: dict[str, Any] = {"method": "generated-metadata", "path": path}
    if separator:
        result["fragment"] = fragment
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", required=True, type=Path)
    args = parser.parse_args()
    audit_dir = args.audit_dir.resolve()

    manifest = load_manifest(audit_dir / "evidence/frozen-source-manifest.jsonl")
    merged = read_jsonl(audit_dir / "evidence/shards/merged-static-records.jsonl")
    adjudications = json.loads(
        (audit_dir / "evidence/finding-adjudications.json").read_text(
            encoding="utf-8"
        )
    )
    if adjudications.get("audit_run_id") != AUDIT_RUN_ID:
        raise ValueError("adjudication run ID does not match this frozen audit")

    candidates = {
        record["finding_id"]: record
        for record in merged
        if record.get("record_type") == "finding_candidate"
    }
    if len(candidates) != 31:
        raise ValueError(f"expected 31 static candidates, found {len(candidates)}")
    for candidate in adjudications["additional_candidates"]:
        candidate_id = candidate["finding_id"]
        if candidate_id in candidates:
            raise ValueError(f"duplicate candidate ID {candidate_id}")
        candidates[candidate_id] = candidate
    if len(candidates) != 32:
        raise ValueError(f"expected 32 total candidates, found {len(candidates)}")

    decisions = adjudications["decisions"]
    used_candidate_ids = [
        candidate_id
        for decision in decisions
        for candidate_id in decision["source_candidate_ids"]
    ]
    duplicates = sorted(
        candidate_id
        for candidate_id, count in Counter(used_candidate_ids).items()
        if count != 1
    )
    if duplicates:
        raise ValueError(f"candidates assigned other than exactly once: {duplicates}")
    if set(used_candidate_ids) != set(candidates):
        missing = sorted(set(candidates) - set(used_candidate_ids))
        extra = sorted(set(used_candidate_ids) - set(candidates))
        raise ValueError(f"candidate accounting mismatch: missing={missing}, extra={extra}")

    finding_ids = [decision["canonical_id"] for decision in decisions]
    if len(finding_ids) != len(set(finding_ids)):
        raise ValueError("canonical finding IDs are not unique")

    enhancement_records: list[dict[str, Any]] = []
    for decision in decisions:
        sources = [candidates[item] for item in decision["source_candidate_ids"]]
        affected_paths = sorted(
            {path for source in sources for path in source.get("affected_paths", [])}
        )
        missing_paths = [path for path in affected_paths if path not in manifest]
        if missing_paths:
            raise ValueError(
                f"{decision['canonical_id']} has non-frozen affected paths: {missing_paths}"
            )
        enhancement_records.append(
            {
                "schema_version": 1,
                "audit_run_id": AUDIT_RUN_ID,
                "record_type": "justified_finding",
                "finding_id": decision["canonical_id"],
                "title": decision["title"],
                "primary_category": decision["primary_category"],
                "secondary_categories": decision["secondary_categories"],
                "priority": decision["priority"],
                "confidence": decision["confidence"],
                "finding_state": decision["finding_state"],
                "potentially_stale": decision["potentially_stale"],
                "summary": decision["summary"],
                "recommendation": decision["recommendation"],
                "expected_benefit": decision["expected_benefit"],
                "product_decision_gate": decision["product_decision_gate"],
                "affected_files": [
                    {
                        "path": path,
                        "baseline_sha256": manifest[path]["sha256"],
                    }
                    for path in affected_paths
                ],
                "source_candidate_ids": decision["source_candidate_ids"],
                "source_candidates": [
                    canonical_source_candidate(source, manifest) for source in sources
                ],
                "independent_verification_refs": decision[
                    "independent_verification_refs"
                ],
            }
        )

    for no_change in adjudications["no_justified_change_records"]:
        canonical_no_change = dict(no_change)
        canonical_no_change["evidence_refs"] = [
            normalize_audit_artifact_ref(item)
            for item in no_change.get("evidence_refs", [])
        ]
        enhancement_records.append(
            {
                "schema_version": 1,
                "audit_run_id": AUDIT_RUN_ID,
                "record_type": "no_justified_change",
                **canonical_no_change,
            }
        )
    if len(enhancement_records) != 35:
        raise ValueError(
            f"expected 35 enhancement records, found {len(enhancement_records)}"
        )

    cleanup_records = [
        record
        for record in merged
        if record.get("record_type") == "documentation_cleanup_candidate"
    ]
    if len(cleanup_records) != 621:
        raise ValueError(
            f"expected 621 documentation cleanup records, found {len(cleanup_records)}"
        )
    cleanup_records.extend(adjudications["supplemental_cleanup_records"])
    cleanup_ids = [record["cleanup_id"] for record in cleanup_records]
    if len(cleanup_ids) != len(set(cleanup_ids)):
        raise ValueError("cleanup IDs are not unique")
    allowed_statuses = {
        "Keep",
        "Archive",
        "Merge",
        "Delete candidate",
        "Needs owner decision",
    }
    invalid_statuses = sorted(
        {
            record.get("status")
            for record in cleanup_records
            if record.get("status") not in allowed_statuses
        }
    )
    if invalid_statuses:
        raise ValueError(f"invalid cleanup statuses: {invalid_statuses}")
    if any(record["status"] == "Delete candidate" for record in cleanup_records):
        raise ValueError("the adjudicated cleanup ledger must have zero Delete candidates")

    write_jsonl(audit_dir / "enhancement-ledger.jsonl", enhancement_records)
    write_jsonl(audit_dir / "documentation-cleanup-ledger.jsonl", cleanup_records)

    summary = {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "candidate_accounting": {
            "static_candidates": 31,
            "validation_candidates": 1,
            "used_exactly_once": len(used_candidate_ids),
            "canonical_findings": len(decisions),
        },
        "enhancement_records": {
            "total": len(enhancement_records),
            "justified_findings": len(decisions),
            "no_justified_change": len(
                adjudications["no_justified_change_records"]
            ),
            "priorities": dict(
                sorted(Counter(decision["priority"] for decision in decisions).items())
            ),
            "primary_categories": dict(
                sorted(
                    Counter(
                        decision["primary_category"] for decision in decisions
                    ).items()
                )
            ),
        },
        "cleanup_records": {
            "total": len(cleanup_records),
            "statuses": dict(
                sorted(Counter(record["status"] for record in cleanup_records).items())
            ),
        },
    }
    (audit_dir / "evidence/phase6-summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
