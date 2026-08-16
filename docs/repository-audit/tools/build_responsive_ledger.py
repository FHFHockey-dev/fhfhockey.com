#!/usr/bin/env python3
"""Build one desktop/tablet/mobile audit record for every qualifying UI route.

The helper parses only frozen source and audit-generated ledgers. It does not
import application modules, open a network connection, or execute product code.
"""

from __future__ import annotations

import argparse
import json
import posixpath
import re
from collections import defaultdict, deque
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


AUDIT_RUN_ID = "REPO-AUDIT-2026-08-09-FROZEN-36536C3"
LOCAL_EXTENSIONS = (
    "",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".css",
    ".scss",
    ".sass",
    ".json",
)
INDEX_EXTENSIONS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".scss")
STYLE_EXTENSIONS = (".css", ".scss", ".sass")
VIEWPORTS = (
    ("desktop", 1440, 900),
    ("tablet", 768, 1024),
    ("mobile", 390, 844),
)
STRUCTURAL_TAGS = ("main", "section", "article", "aside", "form", "table", "h1", "h2", "h3")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> None:
    path.write_text(
        "".join(json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n" for record in records),
        encoding="utf-8",
    )


def normalize_repo_path(path: str) -> str:
    normalized = posixpath.normpath(path)
    return normalized[2:] if normalized.startswith("./") else normalized


def resolve_module(source_path: str, target_id: str, known_paths: set[str]) -> str | None:
    if not target_id.startswith("module:"):
        return None
    specifier = target_id.removeprefix("module:")
    if not specifier or specifier.startswith(("@", "node:", "http:", "https:")):
        return None

    source_parent = str(PurePosixPath(source_path).parent)
    if specifier.startswith("."):
        base = normalize_repo_path(posixpath.join(source_parent, specifier))
    elif specifier.startswith(("web/", "cms/", "functions/", "modeling/", "webhooks/")):
        base = normalize_repo_path(specifier)
    elif source_path.startswith("web/") and specifier.split("/", 1)[0] in {
        "components",
        "contexts",
        "hooks",
        "lib",
        "pages",
        "styles",
        "utils",
    }:
        base = normalize_repo_path(f"web/{specifier}")
    elif source_path.startswith("cms/") and specifier.split("/", 1)[0] in {
        "components",
        "config",
        "schemas",
        "structure",
    }:
        base = normalize_repo_path(f"cms/{specifier}")
    else:
        return None

    candidates: list[str] = []
    for extension in LOCAL_EXTENSIONS:
        candidates.append(base if extension == "" else f"{base}{extension}")
    for extension in INDEX_EXTENSIONS:
        candidates.append(f"{base}/index{extension}")
    return next((candidate for candidate in candidates if candidate in known_paths), None)


def source_closure(
    entry_path: str,
    edges_by_source: dict[str, list[dict[str, Any]]],
    known_paths: set[str],
) -> set[str]:
    seen: set[str] = set()
    queue: deque[str] = deque([entry_path])
    while queue:
        current = queue.popleft()
        if current in seen or current not in known_paths:
            continue
        seen.add(current)
        for edge in edges_by_source.get(current, []):
            if edge.get("edge_type") not in {"imports", "renders"}:
                continue
            resolved = resolve_module(current, str(edge.get("to_id", "")), known_paths)
            if resolved and resolved not in seen:
                queue.append(resolved)
    return seen


def line_count(path: Path) -> int:
    with path.open("rb") as stream:
        return sum(1 for _ in stream)


def source_structure(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8", errors="replace")
    tag_counts = {
        tag: len(re.findall(rf"<{tag}(?:\s|>)", text, flags=re.IGNORECASE))
        for tag in STRUCTURAL_TAGS
    }
    return {
        "tag_counts": tag_counts,
        "aria_attribute_occurrences": len(re.findall(r"\baria-[a-z-]+\s*=", text)),
        "role_attribute_occurrences": len(re.findall(r"\brole\s*=", text)),
        "native_button_occurrences": len(re.findall(r"<button(?:\s|>)", text, flags=re.IGNORECASE)),
        "native_link_occurrences": len(re.findall(r"<(?:a|Link)(?:\s|>)", text)),
    }


def viewport_review(viewport: str, style_summary: dict[str, int]) -> str:
    branch = {
        "desktop": "desktop and minimum-width branches",
        "tablet": "tablet-range and adjacent breakpoint branches",
        "mobile": "small-screen and maximum-width branches",
    }[viewport]
    return (
        f"Static fallback inspected the route source, reachable component/style ownership, and {branch}. "
        f"The reachable style set contains {style_summary['style_files']} files and "
        f"{style_summary['media_queries']} media-query declarations. Static evidence cannot establish "
        "computed layout, clipping, target size, or visual overlap."
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-dir", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--runtime-receipt", required=True)
    args = parser.parse_args()

    audit_dir = Path(args.audit_dir).resolve()
    source_root = Path(args.source_root).resolve()
    runtime_receipt_path = Path(args.runtime_receipt).resolve()

    route_path = audit_dir / "route-ledger.jsonl"
    edge_path = audit_dir / "dependency-edges.jsonl"
    manifest_path = audit_dir / "evidence/frozen-source-manifest.jsonl"
    style_metrics_path = audit_dir / "evidence/style-metrics.json"
    frontend_shard_path = audit_dir / "evidence/shards/phase-2-3/frontend-cms.jsonl"

    routes = read_jsonl(route_path)
    edges = read_jsonl(edge_path)
    manifest_records = read_jsonl(manifest_path)
    manifest_by_path = {record["path"]: record for record in manifest_records}
    known_paths = set(manifest_by_path)
    style_metrics = json.loads(style_metrics_path.read_text(encoding="utf-8"))
    style_by_path = {record["path"]: record for record in style_metrics["files"]}
    runtime_receipt = json.loads(runtime_receipt_path.read_text(encoding="utf-8"))

    frontend_records = read_jsonl(frontend_shard_path)
    frontend_findings = {
        record["finding_id"]: record
        for record in frontend_records
        if record.get("record_type") == "finding_candidate"
    }

    edges_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for edge in edges:
        source_path = edge.get("source_path") or edge.get("from_id")
        if source_path in known_paths:
            edges_by_source[source_path].append(edge)

    global_closure = source_closure("web/pages/_app.tsx", edges_by_source, known_paths)
    global_style_paths = {path for path in global_closure if path.endswith(STYLE_EXTENSIONS)}

    qualifying_routes = [record for record in routes if record.get("qualifies_for_product_status") is True]
    if len(qualifying_routes) != 72:
        raise SystemExit(f"expected 72 qualifying UI routes, found {len(qualifying_routes)}")

    responsive_records: list[dict[str, Any]] = []
    ownership_records: list[dict[str, Any]] = []
    route_to_responsive_ids: dict[str, list[str]] = defaultdict(list)

    for route_index, route in enumerate(qualifying_routes, start=1):
        route_id = route["route_id"]
        source_path = route["source_path"]
        route_closure = source_closure(source_path, edges_by_source, known_paths)
        combined_closure = set(route_closure)
        if route.get("deployment_boundary") == "web-next-pages":
            combined_closure.update(global_closure)

        route_styles = sorted(path for path in route_closure if path.endswith(STYLE_EXTENSIONS))
        combined_styles = sorted(path for path in combined_closure if path.endswith(STYLE_EXTENSIONS))
        style_records = [style_by_path[path] for path in combined_styles if path in style_by_path]
        style_summary = {
            "style_files": len(style_records),
            "route_owned_or_reachable_style_files": len([path for path in route_styles if path in style_by_path]),
            "shared_shell_style_files": len([path for path in combined_styles if path in global_style_paths]),
            "files_with_media_queries": sum(1 for record in style_records if record["media_queries"]),
            "media_queries": sum(record["media_queries"] for record in style_records),
            "important_declarations": sum(record["important_declarations"] for record in style_records),
        }

        source_file = source_root / source_path
        source_manifest = manifest_by_path[source_path]
        source_lines = line_count(source_file)
        direct_render_targets = sorted(
            {
                edge["to_id"]
                for edge in edges_by_source.get(source_path, [])
                if edge.get("edge_type") == "renders"
            }
        )

        applicable_findings: list[str] = []
        for finding_id, finding in frontend_findings.items():
            affected = set(finding.get("affected_paths", []))
            if affected & combined_closure:
                applicable_findings.append(finding_id)

        shared_finding_ids = sorted(
            finding_id
            for finding_id in applicable_findings
            if set(frontend_findings[finding_id].get("affected_paths", [])) & global_closure
        )
        route_specific_finding_ids = sorted(set(applicable_findings) - set(shared_finding_ids))

        ownership_id = f"STYLEOWN-{route_index:04d}"
        ownership_records.append(
            {
                "schema_version": 1,
                "audit_run_id": AUDIT_RUN_ID,
                "record_id": ownership_id,
                "route_id": route_id,
                "pattern": route["pattern"],
                "source_path": source_path,
                "source_baseline_sha256": source_manifest["sha256"],
                "direct_render_targets": direct_render_targets,
                "reachable_local_source_file_count": len(route_closure),
                "route_style_paths": route_styles,
                "shared_shell_style_paths": sorted(global_style_paths) if route.get("deployment_boundary") == "web-next-pages" else [],
                "style_files": [
                    {
                        "path": record["path"],
                        "sha256": record["sha256"],
                        "kind": record["kind"],
                        "lines": record["lines"],
                        "media_queries": record["media_queries"],
                        "important_declarations": record["important_declarations"],
                    }
                    for record in style_records
                ],
                "style_summary": style_summary,
                "source_structure": source_structure(source_file),
                "shared_finding_ids": shared_finding_ids,
                "route_specific_finding_ids": route_specific_finding_ids,
                "evidence_refs": [
                    {
                        "method": "static-source",
                        "path": source_path,
                        "lines": f"1-{source_lines}",
                        "baseline_sha256": source_manifest["sha256"],
                        "confidence": "High",
                    },
                    "generated-metadata:evidence/style-metrics.json",
                    "generated-metadata:dependency-edges.jsonl",
                ],
                "limitations": [
                    "Static import reachability can over-approximate conditional rendering.",
                    "Styles injected by third-party runtime packages are represented as an operational boundary, not parsed as first-party styles.",
                ],
            }
        )

        for viewport_name, width, height in VIEWPORTS:
            responsive_id = f"RESP-{len(responsive_records) + 1:04d}"
            route_to_responsive_ids[route_id].append(responsive_id)
            is_runtime = route_id == runtime_receipt["route_id"] and viewport_name == runtime_receipt["viewport"]["name"]

            viewport_shared_findings = []
            if route.get("deployment_boundary") == "web-next-pages":
                if viewport_name == "desktop" and "FE-FINDING-002" in shared_finding_ids:
                    viewport_shared_findings.append("FE-FINDING-002")
                if viewport_name == "mobile" and "FE-FINDING-003" in shared_finding_ids:
                    viewport_shared_findings.append("FE-FINDING-003")

            visual_route_findings = [
                finding_id
                for finding_id in route_specific_finding_ids
                if frontend_findings[finding_id].get("category")
                in {"accessibility", "responsive-accessibility", "responsive-behavior"}
            ]

            if is_runtime:
                observation = runtime_receipt["observation"]
                verification_method = "runtime-local"
                confidence = "High"
                responsive_result = "rendered_without_root_horizontal_overflow"
                blocker = runtime_receipt["safety_stop"]["reason"]
                organization_review = (
                    "Rendered the frozen 404 surface at 1440x900. The H1, main landmark, shared header/nav, and footer were present; "
                    "the document width matched the viewport. One button lacked text or an aria-label under the bounded DOM heuristic."
                )
                evidence_refs: list[Any] = [
                    "runtime-local:evidence/runtime/404-desktop.json",
                    {
                        "method": "static-source",
                        "path": source_path,
                        "lines": f"1-{source_lines}",
                        "baseline_sha256": source_manifest["sha256"],
                        "confidence": "High",
                    },
                ]
            else:
                observation = None
                verification_method = "static-fallback"
                confidence = "Low"
                responsive_result = "not_runtime_verified"
                if route.get("deployment_boundary") == "cms-sanity":
                    blocker = "Sanity authentication/external service state was unavailable and the Studio runtime was not started."
                else:
                    blocker = (
                        "Further browser navigation stopped after the shared shell exposed third-party telemetry/static-resource requests "
                        "that the browser client could not guarantee intercepting; route data/auth services were also intentionally unavailable."
                    )
                organization_review = viewport_review(viewport_name, style_summary)
                evidence_refs = [
                    {
                        "method": "static-source",
                        "path": source_path,
                        "lines": f"1-{source_lines}",
                        "baseline_sha256": source_manifest["sha256"],
                        "confidence": "High",
                    },
                    f"generated-metadata:evidence/route-style-ownership.jsonl#{ownership_id}",
                ]

            responsive_records.append(
                {
                    "schema_version": 1,
                    "audit_run_id": AUDIT_RUN_ID,
                    "record_id": responsive_id,
                    "route_id": route_id,
                    "pattern": route["pattern"],
                    "product_status": route["product_status"],
                    "viewport": {"name": viewport_name, "width": width, "height": height},
                    "verification_method": verification_method,
                    "verification_confidence": confidence,
                    "responsive_result": responsive_result,
                    "runtime_observation": observation,
                    "organization_review": organization_review,
                    "style_ownership_id": ownership_id,
                    "style_summary": style_summary,
                    "route_specific_visual_change_disposition": (
                        "justified_change" if visual_route_findings else "no_justified_route_specific_visual_change"
                    ),
                    "route_specific_finding_ids": visual_route_findings,
                    "shared_shell_finding_ids": viewport_shared_findings,
                    "stylesheet_architecture_finding_ids": [
                        finding_id
                        for finding_id in applicable_findings
                        if frontend_findings[finding_id].get("category")
                        in {"stylesheet-maintainability", "stylesheet-architecture", "cleanup"}
                    ],
                    "verification_blocker": blocker,
                    "evidence_refs": evidence_refs,
                }
            )

    if len(responsive_records) != 216:
        raise SystemExit(f"expected 216 responsive records, found {len(responsive_records)}")
    if len({record["record_id"] for record in responsive_records}) != 216:
        raise SystemExit("duplicate responsive record IDs")
    route_viewports = {(record["route_id"], record["viewport"]["name"]) for record in responsive_records}
    if len(route_viewports) != 216:
        raise SystemExit("duplicate or missing route/viewport pair")

    updated_routes: list[dict[str, Any]] = []
    for route in routes:
        updated = dict(route)
        if route.get("qualifies_for_product_status") is True:
            updated["classification_stage"] = "phase5_status_retained_after_runtime_or_static_fallback"
            updated["responsive_record_ids"] = route_to_responsive_ids[route["route_id"]]
            updated["responsive_verification"] = "complete_three_viewports_runtime_or_explicit_static_fallback"
            if route["route_id"] == runtime_receipt["route_id"]:
                updated["runtime_state"] = "runtime_local_desktop_then_safety_stop"
                updated["runtime_verification"] = "runtime-local desktop; tablet/mobile static fallback"
                methods = list(dict.fromkeys([*updated.get("verification_methods", []), "runtime-local", "static-source"]))
            else:
                updated["runtime_state"] = "not_run_due_recorded_safety_or_service_boundary"
                updated["runtime_verification"] = "explicit static fallback for desktop/tablet/mobile"
                methods = list(dict.fromkeys([*updated.get("verification_methods", []), "static-source"]))
            updated["verification_methods"] = methods
            updated["phase5_evidence_refs"] = [
                *( ["runtime-local:evidence/runtime/404-desktop.json"] if route["route_id"] == runtime_receipt["route_id"] else [] ),
                f"generated-metadata:responsive-ledger.jsonl#{route_to_responsive_ids[route['route_id']][0]}-{route_to_responsive_ids[route['route_id']][-1]}",
            ]
        updated_routes.append(updated)

    write_jsonl(audit_dir / "responsive-ledger.jsonl", responsive_records)
    write_jsonl(audit_dir / "evidence/route-style-ownership.jsonl", ownership_records)
    write_jsonl(route_path, updated_routes)

    summary = {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "routes": len(qualifying_routes),
        "viewport_records": len(responsive_records),
        "viewport_counts": {
            name: sum(1 for record in responsive_records if record["viewport"]["name"] == name)
            for name, _, _ in VIEWPORTS
        },
        "verification_method_counts": {
            method: sum(1 for record in responsive_records if record["verification_method"] == method)
            for method in sorted({record["verification_method"] for record in responsive_records})
        },
        "runtime_routes": sorted({record["route_id"] for record in responsive_records if record["verification_method"] == "runtime-local"}),
        "static_fallback_routes": len({record["route_id"] for record in responsive_records if record["verification_method"] == "static-fallback"}),
        "no_justified_route_specific_visual_change_records": sum(
            1
            for record in responsive_records
            if record["route_specific_visual_change_disposition"] == "no_justified_route_specific_visual_change"
        ),
        "justified_route_specific_change_records": sum(
            1
            for record in responsive_records
            if record["route_specific_visual_change_disposition"] == "justified_change"
        ),
        "safety_stop_receipt": "evidence/runtime/404-desktop.json",
    }
    (audit_dir / "evidence/responsive-summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
