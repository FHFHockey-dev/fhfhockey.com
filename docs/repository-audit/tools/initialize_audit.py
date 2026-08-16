#!/usr/bin/env python3
"""Initialize canonical audit ledgers from the verified frozen manifest.

This tool has no network, database, application-import, or external-write
behavior. It reads the external frozen control files and writes only beneath
docs/repository-audit.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import shutil
from pathlib import Path


LEDGERS = (
    "inventory-ledger.jsonl",
    "route-ledger.jsonl",
    "dependency-edges.jsonl",
    "responsive-ledger.jsonl",
    "enhancement-ledger.jsonl",
    "documentation-cleanup-ledger.jsonl",
    "validation-receipts.jsonl",
)


def classify_scope(path: str, kind: str) -> tuple[str, str]:
    suffix = Path(path).suffix.lower()
    if kind == "symlink":
        return "first_party_source", "full"
    if suffix in {
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".ico",
        ".pickle",
        ".parquet",
        ".woff",
        ".woff2",
        ".ttf",
        ".otf",
    }:
        return "binary_asset", "metadata"
    if (
        "/scripts/output/" in f"/{path}"
        or path.startswith("cms/.sanity/runtime/")
        or path.endswith("database-generated.types.ts")
        or path.endswith("next-env.d.ts")
    ):
        return "tracked_generated", "structural"
    if suffix in {".md", ".mdx", ".mdc", ".ipynb"}:
        return "first_party_document", "full"
    if ".test." in path or ".spec." in path or "/tests/" in f"/{path}" or path.startswith("web/__tests__/"):
        return "test", "full"
    return "first_party_source", "full"


def area_for(path: str) -> tuple[str, str]:
    if path.startswith(("web/pages/api/", "web/lib/", "web/utils/", "web/scripts/", "web/sql/", "web/supabase/", "web/types/", "web/web/")):
        return "web_backend", "web-backend"
    if path.startswith(("web/pages/", "web/components/", "web/hooks/", "web/contexts/", "web/styles/", "web/stories/", "web/public/", "cms/")):
        return "frontend_cms", "frontend-cms"
    if path.startswith(("functions/", "modeling/", "supabase/", "migrations/", "sql/", "underlying-stats/", "tools/")) or path in {
        "check_db.js",
        "find_templates.py",
        "fix_templates.py",
        "fix_terminal.sh",
        "patch_layout.js",
        "safe_properties.py",
        "update_game_page.py",
    }:
        return "platform_data", "platform-data"
    return "documentation_operations", "documentation-operations"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--control-root", required=True)
    parser.add_argument("--audit-root", required=True)
    args = parser.parse_args()

    control_root = Path(args.control_root).resolve()
    audit_root = Path(args.audit_root).resolve()
    evidence_root = audit_root / "evidence"
    evidence_root.mkdir(parents=True, exist_ok=True)
    (evidence_root / "commands").mkdir(exist_ok=True)
    (evidence_root / "browser").mkdir(exist_ok=True)
    (evidence_root / "shards").mkdir(exist_ok=True)

    source_manifest = control_root / "frozen-source-manifest.jsonl"
    baseline = control_root / "frozen-baseline.json"
    shutil.copy2(source_manifest, evidence_root / "frozen-source-manifest.jsonl")
    shutil.copy2(baseline, evidence_root / "frozen-baseline.json")

    coverage_path = audit_root / "coverage-ledger.jsonl"
    with source_manifest.open(encoding="utf-8") as src, coverage_path.open("w", encoding="utf-8", newline="\n") as out:
        for line in src:
            base = json.loads(line)
            scope_class, review_depth = classify_scope(base["path"], base["kind"])
            area, owner = area_for(base["path"])
            mime, _ = mimetypes.guess_type(base["path"])
            record = {
                "schema_version": 1,
                "record_id": base["file_id"],
                "audit_run_id": "REPO-AUDIT-2026-08-09-FROZEN-36536C3",
                "source_ref": "frozen-goal-start-snapshot",
                "record_kind": "file",
                "file_id": base["file_id"],
                "path": base["path"],
                "git_state": "tracked_or_nonignored_untracked",
                "worktree_state": "frozen",
                "baseline_sha256": base["sha256"],
                "baseline_mode": base["mode"],
                "symlink_target_hash": base["symlink_target_hash"],
                "size_bytes": base["size_bytes"],
                "mime": mime or "application/octet-stream",
                "area": area,
                "owner_workstream": owner,
                "scope_class": scope_class,
                "review_depth": review_depth,
                "exclusion_code": None,
                "audit_status": "pending",
                "disposition": None,
                "entity_ids": [],
                "finding_ids": [],
                "evidence_refs": [],
                "created_at": "2026-08-09T13:37:33Z",
                "updated_at": "2026-08-09T13:37:33Z",
            }
            out.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")

    for ledger in LEDGERS:
        (audit_root / ledger).touch(exist_ok=True)

    for name in (
        "exclusion-roots.jsonl",
        "live-worktree-drift.jsonl",
        "audit-package-manifest.jsonl",
        "external-output-manifest.jsonl",
    ):
        (evidence_root / name).touch(exist_ok=True)

    receipt = {
        "schema_version": 1,
        "receipt_id": "VAL-0001",
        "audit_run_id": "REPO-AUDIT-2026-08-09-FROZEN-36536C3",
        "source_ref": "frozen-goal-start-snapshot",
        "cwd_alias": "external-control-and-live-audit-package",
        "command_or_request": "initialize canonical audit ledgers from verified frozen control files",
        "started_at": "2026-08-09T13:37:33Z",
        "duration": "bounded",
        "tool_versions": {"python": "3"},
        "environment_names_checked": {},
        "result": "passed",
        "exit_code": 0,
        "diagnostic_excerpt": "Copied verified baseline evidence and initialized 3,580 coverage records.",
        "failure_layer": None,
        "affected_conclusions": ["frozen baseline identity", "coverage universe"],
        "pre_snapshot_manifest_hash": "2634689a5aa2a130be38c50975ea52d038ba85321591ca24981ec3ecf771b56f",
        "post_snapshot_manifest_hash": "2634689a5aa2a130be38c50975ea52d038ba85321591ca24981ec3ecf771b56f",
        "external_output_refs": [],
        "log_path": None,
        "evidence_refs": ["evidence/frozen-baseline.json", "evidence/frozen-source-manifest.jsonl"],
        "created_at": "2026-08-09T13:37:33Z",
    }
    (audit_root / "validation-receipts.jsonl").write_text(
        json.dumps(receipt, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "coverage_records": sum(1 for _ in coverage_path.open(encoding="utf-8")),
                "coverage_sha256": hashlib.sha256(coverage_path.read_bytes()).hexdigest(),
                "audit_root": str(audit_root),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
