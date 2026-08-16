#!/usr/bin/env python3
"""Enforce the completed audit's cross-artifact completion gates."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AUDIT_RUN_ID = "REPO-AUDIT-2026-08-09-FROZEN-36536C3"
MANIFEST_SHA256 = "2634689a5aa2a130be38c50975ea52d038ba85321591ca24981ec3ecf771b56f"
STATUS_COUNTS = Counter(
    {
        "Complete": 67,
        "In progress — Near complete": 3,
        "In progress — Far from complete": 2,
        "Skeleton": 0,
        "Dead end": 0,
    }
)


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
    parser.add_argument("--source-root", required=True, type=Path)
    parser.add_argument("--require-final-receipt", action="store_true")
    args = parser.parse_args()
    audit_dir = args.audit_dir.resolve()
    source_root = args.source_root.resolve()
    errors: list[str] = []

    required_files = [
        "README.md",
        "audit-charter.md",
        "current-state.md",
        "audit-diary.md",
        "artifact-schemas.md",
        "coverage-ledger.jsonl",
        "inventory-ledger.jsonl",
        "route-ledger.jsonl",
        "dependency-edges.jsonl",
        "site-map.md",
        "responsive-ledger.jsonl",
        "enhancement-ledger.jsonl",
        "stylesheet-cleanup-plan.md",
        "documentation-cleanup-ledger.jsonl",
        "cleanup-guide.md",
        "validation-receipts.jsonl",
        "generate-audit-tasks-prompt.md",
        "generate-justified-tasks-prompt.md",
        "evidence/frozen-baseline.json",
        "evidence/frozen-source-manifest.jsonl",
        "evidence/live-worktree-drift.jsonl",
        "evidence/source-and-drift-integrity.json",
        "evidence/external-output-integrity.json",
        "evidence/package-integrity.json",
    ]
    for relative in required_files:
        path = audit_dir / relative
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"required artifact missing or empty: {relative}")

    manifest_path = audit_dir / "evidence/frozen-source-manifest.jsonl"
    manifest = read_jsonl(manifest_path)
    manifest_paths = {record["path"] for record in manifest}
    if sha256_file(manifest_path) != MANIFEST_SHA256:
        errors.append("frozen manifest SHA-256 mismatch")
    if len(manifest) != 3_580 or len(manifest_paths) != 3_580:
        errors.append("frozen manifest is not 3,580 unique paths")
    if any(not (source_root / path).exists() for path in manifest_paths):
        errors.append("frozen source root is missing one or more manifest paths")

    coverage = read_jsonl(audit_dir / "coverage-ledger.jsonl")
    frozen_coverage = [record for record in coverage if record.get("record_kind") == "file"]
    generated_coverage = [record for record in coverage if record.get("record_kind") == "audit_generated"]
    if len(frozen_coverage) != 3_580:
        errors.append(f"frozen coverage count is {len(frozen_coverage)}, expected 3,580")
    if {record["path"] for record in frozen_coverage} != manifest_paths:
        errors.append("frozen coverage paths do not equal the frozen manifest")
    frozen_statuses = Counter(record.get("audit_status") for record in frozen_coverage)
    if frozen_statuses != Counter({"audited": 3_570, "excluded": 10}):
        errors.append(f"frozen coverage statuses mismatch: {dict(frozen_statuses)}")
    if len({record["path"] for record in coverage}) != len(coverage):
        errors.append("coverage paths are duplicated")

    inventory = read_jsonl(audit_dir / "inventory-ledger.jsonl")
    if len(inventory) != 12_772:
        errors.append(f"inventory count is {len(inventory)}, expected 12,772")
    file_inventory = [record for record in inventory if record.get("inventory_kind") == "file"]
    if {record["path"] for record in file_inventory} != manifest_paths:
        errors.append("file inventory paths do not equal frozen manifest")
    inventory_kinds = Counter(record.get("inventory_kind") for record in inventory)
    if sum(inventory_kinds[item] for item in ("job_or_pipeline", "route_job_or_pipeline", "scheduled_job_declaration")) != 259:
        errors.append("job/pipeline/declaration inventory does not total 259")

    routes = read_jsonl(audit_dir / "route-ledger.jsonl")
    if len(routes) != 338:
        errors.append(f"route count is {len(routes)}, expected 338")
    ui_routes = [record for record in routes if record.get("qualifies_for_product_status") is True]
    non_ui_routes = [record for record in routes if record.get("qualifies_for_product_status") is False]
    if len(ui_routes) != 72 or len(non_ui_routes) != 266:
        errors.append(f"UI/non-UI route counts are {len(ui_routes)}/{len(non_ui_routes)}, expected 72/266")
    statuses = Counter(record.get("product_status") for record in ui_routes)
    for status, expected in STATUS_COUNTS.items():
        if statuses.get(status, 0) != expected:
            errors.append(f"product status {status!r} is {statuses.get(status, 0)}, expected {expected}")
    if any(record.get("product_status") is not None for record in non_ui_routes):
        errors.append("non-UI route received a product status")
    for route in ui_routes:
        if not route.get("status_confidence") or not route.get("status_rationale") or not route.get("verification_methods"):
            errors.append(f"{route.get('route_id')}: incomplete status evidence")
        if len(route.get("responsive_record_ids") or []) != 3:
            errors.append(f"{route.get('route_id')}: does not reference three responsive records")

    edges = read_jsonl(audit_dir / "dependency-edges.jsonl")
    if len(edges) != 14_602:
        errors.append(f"dependency edge count is {len(edges)}, expected 14,602")
    allowed_edges = {"imports", "renders", "navigates", "redirects", "rewrites", "auth_gates", "calls", "reads", "writes", "schedules", "produces", "consumes", "tests", "documents", "deploys"}
    invalid_edges = sorted({record.get("edge_type") for record in edges} - allowed_edges)
    if invalid_edges:
        errors.append(f"invalid edge types: {invalid_edges}")

    responsive = read_jsonl(audit_dir / "responsive-ledger.jsonl")
    viewport_pairs = {(record.get("route_id"), (record.get("viewport") or {}).get("name")) for record in responsive}
    if len(responsive) != 216 or len(viewport_pairs) != 216:
        errors.append("responsive ledger is not 216 unique route/viewport pairs")
    viewport_counts = Counter((record.get("viewport") or {}).get("name") for record in responsive)
    if viewport_counts != Counter({"desktop": 72, "tablet": 72, "mobile": 72}):
        errors.append(f"responsive viewport counts mismatch: {dict(viewport_counts)}")
    responsive_methods = Counter(record.get("verification_method") for record in responsive)
    if responsive_methods != Counter({"runtime-local": 1, "static-fallback": 215}):
        errors.append(f"responsive method counts mismatch: {dict(responsive_methods)}")

    enhancement = read_jsonl(audit_dir / "enhancement-ledger.jsonl")
    findings = [record for record in enhancement if record.get("record_type") == "justified_finding"]
    no_change = [record for record in enhancement if record.get("record_type") == "no_justified_change"]
    if len(findings) != 30 or len(no_change) != 5:
        errors.append(f"finding/no-change counts are {len(findings)}/{len(no_change)}, expected 30/5")
    if Counter(record.get("priority") for record in findings) != Counter({"P0": 3, "P1": 4, "P2": 13, "P3": 10}):
        errors.append("finding priority totals mismatch")
    source_candidate_ids = [candidate for record in findings for candidate in record.get("source_candidate_ids", [])]
    if len(source_candidate_ids) != 32 or len(set(source_candidate_ids)) != 32:
        errors.append("32 source candidates are not consumed exactly once")
    for finding in findings:
        if finding.get("priority") in {"P0", "P1"} and finding.get("primary_category") in {"security/privacy", "correctness"} and not finding.get("independent_verification_refs"):
            errors.append(f"{finding.get('finding_id')}: high-impact finding lacks independent verification")

    cleanup = read_jsonl(audit_dir / "documentation-cleanup-ledger.jsonl")
    cleanup_statuses = Counter(record.get("status") for record in cleanup)
    if len(cleanup) != 626 or cleanup_statuses != Counter({"Archive": 341, "Keep": 244, "Merge": 2, "Needs owner decision": 39}):
        errors.append(f"cleanup totals mismatch: {len(cleanup)} {dict(cleanup_statuses)}")
    if cleanup_statuses.get("Delete candidate", 0):
        errors.append("cleanup ledger contains a Delete candidate")

    receipts = read_jsonl(audit_dir / "validation-receipts.jsonl")
    receipt_ids = [record.get("receipt_id") for record in receipts]
    if receipt_ids != sorted(receipt_ids) or len(receipt_ids) != len(set(receipt_ids)):
        errors.append("validation receipt IDs are not unique and monotonic")
    if args.require_final_receipt:
        if not any(record.get("receipt_id") == "VAL-0015" and record.get("result") == "passed" for record in receipts):
            errors.append("final passed receipt VAL-0015 is missing")
    elif len(receipts) < 14:
        errors.append("fewer than 14 phase validation receipts")
    if not any(record.get("result") == "failed" for record in receipts):
        errors.append("substantive failed validation evidence was lost")
    if not any(record.get("result") == "stopped_safety_boundary" for record in receipts):
        errors.append("browser safety-stop evidence was lost")

    source_integrity = json.loads((audit_dir / "evidence/source-and-drift-integrity.json").read_text(encoding="utf-8"))
    if source_integrity["frozen_source_authority"].get("manifest_sha256") != MANIFEST_SHA256:
        errors.append("source/drift receipt has wrong manifest")
    if source_integrity["comparison"].get("post_baseline_changes_incorporated_into_audit") is not False:
        errors.append("source/drift receipt says drift was incorporated")
    if not all(item.get("unchanged_since_freeze") for item in source_integrity.get("pre_existing_user_changes", [])):
        errors.append("one or more pre-existing user changes no longer match the freeze")
    drift = read_jsonl(audit_dir / "evidence/live-worktree-drift.jsonl")
    if not drift or drift[0].get("record_type") != "live_drift_summary":
        errors.append("live drift summary is missing")
    if any(record.get("record_type") == "post_baseline_source_drift" and record.get("not_part_of_frozen_audit") is not True for record in drift):
        errors.append("a drift record is not marked outside the frozen audit")
    external = json.loads((audit_dir / "evidence/external-output-integrity.json").read_text(encoding="utf-8"))
    if external.get("result") != "passed" or external.get("verified_outputs") != 12:
        errors.append("external output integrity is not 12/12 passed")
    package = json.loads((audit_dir / "evidence/package-integrity.json").read_text(encoding="utf-8"))
    if package.get("result") != "passed" or package.get("errors"):
        errors.append("audit-package integrity has not passed")
    if package.get("coverage", {}).get("frozen_source_records") != 3_580:
        errors.append("package integrity receipt lost frozen coverage")

    readme = (audit_dir / "README.md").read_text(encoding="utf-8")
    schemas = (audit_dir / "artifact-schemas.md").read_text(encoding="utf-8")
    task_prompt = (audit_dir / "generate-audit-tasks-prompt.md").read_text(encoding="utf-8")
    canonical_task_prompt = (audit_dir / "generate-justified-tasks-prompt.md").read_text(encoding="utf-8")
    if len(re.findall(r"\b[\w’'-]+\b", readme)) > 3_200:
        errors.append("README exceeds the 3,200-word narrative/index limit")
    for token in ["## TL;DR", "3,580", "FIND-SEC-001", "In progress — Near complete", "Dead end", "zero Delete candidate", "Retained audit tooling"]:
        if token not in readme:
            errors.append(f"README missing required token: {token}")
    tool_names = sorted(path.name for path in (audit_dir / "tools").iterdir() if path.is_file())
    missing_tools = [name for name in tool_names if f"`{name}`" not in readme]
    if missing_tools:
        errors.append(f"README tool index missing: {missing_tools}")
    for token in ["Route status extension", "Enhancement variants", "Provenance domains", "Completion invariants"]:
        if token not in schemas:
            errors.append(f"artifact schema missing section: {token}")
    for token in ["task generation only", "parent task", "Atomic subtasks", "Finding IDs", "Affected paths", "Depends on", "Acceptance criteria", "Validation", "Risks", "Rollback", "Product decision gate", "traceability matrix", "no implementation occurred"]:
        if token.lower() not in task_prompt.lower():
            errors.append(f"task-generator prompt missing: {token}")
    for token in ["generate-audit-tasks-prompt.md", "task generation only", "Do not implement", "finding IDs", "affected paths", "dependencies", "acceptance criteria", "validation commands", "risks", "rollback notes", "product-decision gates"]:
        if token.lower() not in canonical_task_prompt.lower():
            errors.append(f"canonical task-generator entrypoint missing: {token}")

    package_manifest = read_jsonl(audit_dir / "evidence/audit-package-manifest.jsonl")
    package_paths = {record["path"] for record in package_manifest}
    actual_package_paths = {
        path.relative_to(audit_dir).as_posix()
        for path in audit_dir.rglob("*")
        if path.is_file()
    }
    if package_paths != actual_package_paths:
        errors.append("package manifest paths differ from retained package files")
    generated_paths = {record["path"].removeprefix("docs/repository-audit/") for record in generated_coverage}
    if generated_paths != actual_package_paths:
        errors.append("audit-generated coverage differs from retained package files")

    result = {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "record_type": "final_completion_validation",
        "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "result": "passed" if not errors else "failed",
        "errors": errors,
        "counts": {
            "frozen_files": len(manifest),
            "audit_generated_files": len(generated_coverage),
            "inventory_records": len(inventory),
            "routes": len(routes),
            "ui_routes": len(ui_routes),
            "endpoints": len(non_ui_routes),
            "dependency_edges": len(edges),
            "responsive_records": len(responsive),
            "canonical_findings": len(findings),
            "no_justified_change": len(no_change),
            "cleanup_records": len(cleanup),
            "validation_receipts": len(receipts),
            "live_drift_records": len([record for record in drift if record.get("record_type") == "post_baseline_source_drift"]),
        },
    }
    (audit_dir / "evidence/final-completion.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(json.dumps({"result": result["result"], "error_count": len(errors), "counts": result["counts"]}, indent=2, sort_keys=True))
    if errors:
        print(json.dumps({"errors": errors[:50]}, indent=2))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
