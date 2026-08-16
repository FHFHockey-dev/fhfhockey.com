#!/usr/bin/env python3
"""Validate Phase 5 responsive, runtime, validation, and external-output artifacts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


VIEWPORTS = {
    "desktop": (1440, 900),
    "tablet": (768, 1024),
    "mobile": (390, 844),
}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", required=True)
    args = parser.parse_args()

    audit_dir = Path(args.audit_dir).resolve()
    routes = read_jsonl(audit_dir / "route-ledger.jsonl")
    responsive = read_jsonl(audit_dir / "responsive-ledger.jsonl")
    ownership = read_jsonl(audit_dir / "evidence/route-style-ownership.jsonl")
    manifest = read_jsonl(audit_dir / "evidence/frozen-source-manifest.jsonl")
    external = read_jsonl(audit_dir / "evidence/external-output-manifest.jsonl")
    receipts = read_jsonl(audit_dir / "validation-receipts.jsonl")
    style_metrics = json.loads((audit_dir / "evidence/style-metrics.json").read_text(encoding="utf-8"))
    runtime = json.loads((audit_dir / "evidence/runtime/404-desktop.json").read_text(encoding="utf-8"))

    errors: list[str] = []
    qualifying = {route["route_id"]: route for route in routes if route.get("qualifies_for_product_status") is True}
    ownership_by_id = {record["record_id"]: record for record in ownership}
    manifest_by_path = {record["path"]: record for record in manifest}
    style_by_path = {record["path"]: record for record in style_metrics["files"]}
    external_ids = {record["record_id"] for record in external}

    if len(qualifying) != 72:
        errors.append(f"expected 72 qualifying routes, found {len(qualifying)}")
    if len(responsive) != 216:
        errors.append(f"expected 216 responsive records, found {len(responsive)}")
    if len(ownership) != 72 or len(ownership_by_id) != 72:
        errors.append("style ownership must contain 72 unique records")
    if len(external) != 12 or len(external_ids) != 12:
        errors.append("external output manifest must contain 12 unique records")

    pair_set: set[tuple[str, str]] = set()
    responsive_by_route: dict[str, list[str]] = {route_id: [] for route_id in qualifying}
    runtime_records = 0
    for record in responsive:
        route_id = record.get("route_id")
        viewport = record.get("viewport", {})
        viewport_name = viewport.get("name")
        pair = (str(route_id), str(viewport_name))
        if pair in pair_set:
            errors.append(f"duplicate route/viewport pair {pair}")
        pair_set.add(pair)
        if route_id not in qualifying:
            errors.append(f"responsive record references nonqualifying route {route_id}")
            continue
        expected_size = VIEWPORTS.get(str(viewport_name))
        if not expected_size or (viewport.get("width"), viewport.get("height")) != expected_size:
            errors.append(f"unexpected viewport dimensions for {record.get('record_id')}")
        route = qualifying[route_id]
        if record.get("pattern") != route.get("pattern") or record.get("product_status") != route.get("product_status"):
            errors.append(f"route/status mismatch for {record.get('record_id')}")
        ownership_record = ownership_by_id.get(record.get("style_ownership_id"))
        if not ownership_record or ownership_record.get("route_id") != route_id:
            errors.append(f"style ownership mismatch for {record.get('record_id')}")
        if record.get("verification_method") == "runtime-local":
            runtime_records += 1
            if route_id != runtime.get("route_id") or viewport_name != runtime.get("viewport", {}).get("name"):
                errors.append(f"runtime record disagrees with runtime receipt: {record.get('record_id')}")
        responsive_by_route[route_id].append(record["record_id"])

    if len(pair_set) != 216:
        errors.append(f"expected 216 unique route/viewport pairs, found {len(pair_set)}")
    if runtime_records != 1:
        errors.append(f"expected one runtime-local record, found {runtime_records}")

    for route_id, route in qualifying.items():
        expected_ids = responsive_by_route.get(route_id, [])
        if len(expected_ids) != 3:
            errors.append(f"route {route_id} has {len(expected_ids)} responsive records")
        if route.get("responsive_record_ids") != expected_ids:
            errors.append(f"route ledger responsive IDs disagree for {route_id}")

    for record in ownership:
        route = qualifying.get(record.get("route_id"))
        if not route or route.get("pattern") != record.get("pattern"):
            errors.append(f"ownership route mismatch for {record.get('record_id')}")
        source_manifest = manifest_by_path.get(record.get("source_path"))
        if not source_manifest or source_manifest.get("sha256") != record.get("source_baseline_sha256"):
            errors.append(f"ownership source hash mismatch for {record.get('record_id')}")
        seen_style_paths: set[str] = set()
        for style in record.get("style_files", []):
            path = style.get("path")
            if path in seen_style_paths:
                errors.append(f"duplicate style path {path} in {record.get('record_id')}")
            seen_style_paths.add(path)
            manifest_record = manifest_by_path.get(path)
            metric_record = style_by_path.get(path)
            if not manifest_record or manifest_record.get("sha256") != style.get("sha256"):
                errors.append(f"style manifest hash mismatch for {path}")
            if not metric_record or metric_record.get("sha256") != style.get("sha256"):
                errors.append(f"style metric hash mismatch for {path}")

    receipt_ids = [record.get("receipt_id") for record in receipts]
    if len(receipt_ids) != len(set(receipt_ids)) or receipt_ids != sorted(receipt_ids):
        errors.append("validation receipt IDs are duplicate or unordered")
    for receipt in receipts:
        for external_ref in receipt.get("external_output_refs", []):
            if external_ref not in external_ids:
                errors.append(f"receipt {receipt.get('receipt_id')} references missing external output {external_ref}")

    leak_targets = [
        audit_dir / "responsive-ledger.jsonl",
        audit_dir / "evidence/route-style-ownership.jsonl",
        audit_dir / "evidence/responsive-summary.json",
        audit_dir / "evidence/runtime/404-desktop.json",
        audit_dir / "evidence/external-output-manifest.jsonl",
        audit_dir / "validation-receipts.jsonl",
    ]
    for path in leak_targets:
        text = path.read_text(encoding="utf-8")
        if "/private/var/" in text or "validation-bodhex" in text and path.name != "external-output-manifest.jsonl":
            errors.append(f"temporary absolute path leaked into {path.relative_to(audit_dir)}")

    summary = {
        "qualifying_routes": len(qualifying),
        "responsive_records": len(responsive),
        "style_ownership_records": len(ownership),
        "runtime_records": runtime_records,
        "external_output_records": len(external),
        "validation_receipts": len(receipts),
        "error_count": len(errors),
        "errors": errors[:50],
        "result": "passed" if not errors else "failed",
    }
    print(json.dumps(summary, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
