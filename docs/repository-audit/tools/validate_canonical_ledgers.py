#!/usr/bin/env python3
"""Validate Phase 4 canonical ledger coverage, schemas, and cross-references."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any


STATUS_VOCABULARY = {
    "Complete",
    "In progress — Near complete",
    "In progress — Far from complete",
    "Skeleton",
    "Dead end",
}
EDGE_VOCABULARY = {
    "imports",
    "renders",
    "navigates",
    "redirects",
    "rewrites",
    "auth_gates",
    "calls",
    "reads",
    "writes",
    "schedules",
    "produces",
    "consumes",
    "tests",
    "documents",
    "deploys",
}


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
                raise RuntimeError(f"{path}:{line_number}: expected JSON object")
            records.append(value)
    return records


def duplicates(values: list[Any]) -> list[Any]:
    counts = Counter(values)
    return sorted(value for value, count in counts.items() if count != 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-root", required=True)
    args = parser.parse_args()
    root = Path(args.audit_root).resolve()

    coverage = load_jsonl(root / "coverage-ledger.jsonl")
    manifest = load_jsonl(root / "evidence" / "frozen-source-manifest.jsonl")
    merged = load_jsonl(root / "evidence" / "shards" / "merged-static-records.jsonl")
    inventory = load_jsonl(root / "inventory-ledger.jsonl")
    routes = load_jsonl(root / "route-ledger.jsonl")
    edges = load_jsonl(root / "dependency-edges.jsonl")
    site_map = (root / "site-map.md").read_text(encoding="utf-8")

    errors: list[dict[str, Any]] = []
    manifest_paths = {record["path"] for record in manifest}
    coverage_paths = {
        record["path"] for record in coverage if record.get("record_kind") == "file"
    }
    inventory_files = {
        record["path"] for record in inventory if record.get("inventory_kind") == "file"
    }
    if manifest_paths != coverage_paths:
        errors.append({"error": "manifest_coverage_path_universe_mismatch"})
    if manifest_paths != inventory_files:
        errors.append(
            {
                "error": "manifest_inventory_file_universe_mismatch",
                "missing": sorted(manifest_paths - inventory_files)[:20],
                "extra": sorted(inventory_files - manifest_paths)[:20],
            }
        )

    for field, records in (
        ("inventory_id", inventory),
        ("route_id", routes),
        ("edge_id", edges),
    ):
        duplicate_ids = duplicates([record.get(field) for record in records])
        if duplicate_ids:
            errors.append({"error": f"duplicate_{field}", "values": duplicate_ids[:20]})

    ui_routes = [route for route in routes if route.get("qualifies_for_product_status")]
    non_ui_routes = [route for route in routes if not route.get("qualifies_for_product_status")]
    if len(ui_routes) != 72:
        errors.append({"error": "ui_route_count", "actual": len(ui_routes), "expected": 72})
    if len(non_ui_routes) != 266:
        errors.append(
            {"error": "non_ui_route_count", "actual": len(non_ui_routes), "expected": 266}
        )
    invalid_ui_status = [
        route["route_id"]
        for route in ui_routes
        if route.get("product_status") not in STATUS_VOCABULARY
    ]
    if invalid_ui_status:
        errors.append({"error": "invalid_or_missing_ui_status", "routes": invalid_ui_status})
    invalid_non_ui_status = [
        route["route_id"] for route in non_ui_routes if route.get("product_status") is not None
    ]
    if invalid_non_ui_status:
        errors.append({"error": "non_ui_status_assigned", "routes": invalid_non_ui_status})
    infrastructure_status = [
        route["route_id"]
        for route in ui_routes
        if Path(str(route.get("source_path"))).name in {"_app.tsx", "_document.tsx"}
    ]
    if infrastructure_status:
        errors.append({"error": "framework_infrastructure_received_status", "routes": infrastructure_status})

    source_counts = Counter(record.get("record_type") for record in merged)
    route_boundary_counts = Counter(route.get("deployment_boundary") for route in routes)
    expected_boundary_counts = {
        "web-next-pages": 70,
        "cms-sanity": 2,
        "web-next-api": source_counts["proposed_endpoint"],
        "functions-python-vercel": 9,
    }
    if dict(route_boundary_counts) != expected_boundary_counts:
        errors.append(
            {
                "error": "route_boundary_count_mismatch",
                "actual": dict(route_boundary_counts),
                "expected": expected_boundary_counts,
            }
        )

    invalid_edge_types = sorted(
        {edge.get("edge_type") for edge in edges if edge.get("edge_type") not in EDGE_VOCABULARY}
    )
    if invalid_edge_types:
        errors.append({"error": "invalid_edge_types", "values": invalid_edge_types})
    route_ids = {route["route_id"] for route in routes}
    dangling_route_targets = sorted(
        {
            edge.get("route_target_id")
            for edge in edges
            if edge.get("route_target_id") and edge.get("route_target_id") not in route_ids
        }
    )
    if dangling_route_targets:
        errors.append({"error": "dangling_route_target_ids", "values": dangling_route_targets})

    temporary_path_leaks = []
    for ledger_name, records in (
        ("inventory", inventory),
        ("routes", routes),
        ("edges", edges),
    ):
        for index, record in enumerate(records, start=1):
            if "/private/var/folders/" in json.dumps(record):
                temporary_path_leaks.append({"ledger": ledger_name, "line": index})
    if temporary_path_leaks:
        errors.append({"error": "temporary_path_leaks", "values": temporary_path_leaks[:20]})

    for status in STATUS_VOCABULARY:
        if f"### {status}" not in site_map:
            errors.append({"error": "site_map_missing_status_section", "status": status})
    missing_ui_patterns = [route["pattern"] for route in ui_routes if md_token(route["pattern"]) not in site_map]
    if missing_ui_patterns:
        errors.append({"error": "site_map_missing_ui_patterns", "values": missing_ui_patterns[:20]})
    missing_endpoint_sources = [
        route["source_path"]
        for route in non_ui_routes
        if str(route.get("source_path")) not in site_map
    ]
    if missing_endpoint_sources:
        errors.append(
            {"error": "site_map_missing_endpoint_sources", "values": missing_endpoint_sources[:20]}
        )

    result = {
        "manifest_paths": len(manifest_paths),
        "inventory_records": len(inventory),
        "inventory_kind_counts": dict(sorted(Counter(record["inventory_kind"] for record in inventory).items())),
        "route_records": len(routes),
        "route_boundary_counts": dict(sorted(route_boundary_counts.items())),
        "ui_status_counts": dict(sorted(Counter(route["product_status"] for route in ui_routes).items())),
        "dependency_edges": len(edges),
        "edge_type_counts": dict(sorted(Counter(edge["edge_type"] for edge in edges).items())),
        "error_count": len(errors),
        "errors": errors[:50],
        "result": "passed" if not errors else "failed",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


def md_token(value: str) -> str:
    return str(value).replace("|", "\\|")


if __name__ == "__main__":
    main()
