#!/usr/bin/env python3
"""Generate the human-readable site and operational map from canonical ledgers.

Reads and writes only the audit package. The exhaustive machine-readable source
of truth remains route-ledger.jsonl, inventory-ledger.jsonl, and
dependency-edges.jsonl.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


STATUS_ORDER = [
    "Complete",
    "In progress — Near complete",
    "In progress — Far from complete",
    "Skeleton",
    "Dead end",
]


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as stream:
        for line in stream:
            if line.strip():
                records.append(json.loads(line))
    return records


def md(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, (list, dict)):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    text = str(value).replace("|", "\\|").replace("\n", " ")
    return text if text else "—"


def compact_mapping(value: Any) -> str:
    if not isinstance(value, dict):
        return md(value)
    return "; ".join(f"{key}: {item}" for key, item in sorted(value.items())) or "—"


def hierarchy_lines(routes: list[dict[str, Any]]) -> list[str]:
    tree: dict[str, Any] = {}
    root_route = next((route for route in routes if route["pattern"] == "/"), None)
    for route in routes:
        if route["pattern"] == "/":
            continue
        node = tree
        for part in [part for part in route["pattern"].split("/") if part]:
            node = node.setdefault(part, {})
        node["__route__"] = route

    output = []
    if root_route:
        output.append(f"- `/` — {root_route['product_status']} ({root_route['status_confidence']})")

    def walk(node: dict[str, Any], prefix: list[str], depth: int) -> None:
        for name in sorted(key for key in node if key != "__route__"):
            child = node[name]
            path = "/" + "/".join([*prefix, name])
            route = child.get("__route__")
            suffix = (
                f" — {route['product_status']} ({route['status_confidence']})"
                if route
                else ""
            )
            output.append(f"{'  ' * depth}- `{path}`{suffix}")
            walk(child, [*prefix, name], depth + 1)

    walk(tree, [], 0)
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-root", required=True)
    args = parser.parse_args()
    root = Path(args.audit_root).resolve()
    routes = load_jsonl(root / "route-ledger.jsonl")
    inventory = load_jsonl(root / "inventory-ledger.jsonl")
    edges = load_jsonl(root / "dependency-edges.jsonl")

    ui_routes = sorted(
        (route for route in routes if route["qualifies_for_product_status"]),
        key=lambda route: route["pattern"].lower(),
    )
    endpoints = sorted(
        (route for route in routes if not route["qualifies_for_product_status"]),
        key=lambda route: (
            route["deployment_boundary"],
            route.get("pattern") or "",
            route.get("source_path") or "",
        ),
    )
    outgoing_by_path: dict[str, list[dict[str, Any]]] = defaultdict(list)
    incoming_by_id: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for edge in edges:
        if edge.get("source_path"):
            outgoing_by_path[str(edge["source_path"])].append(edge)
        if edge.get("to_id"):
            incoming_by_id[str(edge["to_id"])].append(edge)

    lines = [
        "# Exhaustive Site and Operational Map",
        "",
        "This map describes the frozen audit snapshot. The JSONL ledgers are authoritative; this Markdown keeps the relationships browsable. Product statuses below are the Phase 4 static adjudications and will be updated only by bounded Phase 5 runtime/responsive evidence, never by live-worktree drift.",
        "",
        "## Scope and status criteria",
        "",
        f"- User-facing UI surfaces with exactly one product status: {len(ui_routes)}.",
        f"- Non-UI HTTP/server surfaces inventoried without a product status: {len(endpoints)}.",
        "- Framework infrastructure (`_app`, `_document`, helpers, configuration proxies) remains in the inventory ledger and is not forced into the page vocabulary.",
        "- No Next.js middleware file exists in the frozen source. Auth is mapped independently at UI and endpoint layers.",
        "",
        "Status definitions:",
        "",
        "- Complete — fulfills its current purpose end-to-end with no missing primary outcome.",
        "- In progress — Near complete — all primary outcomes work; remaining gaps are bounded and non-blocking.",
        "- In progress — Far from complete — substantive functionality exists, but a required primary outcome or data flow is missing, broken, or unusable.",
        "- Skeleton — principally scaffolding, placeholder/demo/mock content, or a shell without a completed primary outcome.",
        "- Dead end — at least two independent affirmative evidence items prove abandonment, supersession without compatibility purpose, true unreachability, or no valid current purpose.",
        "",
        "Absence of an incoming link is never treated as Dead end evidence. Dynamic deep links, callbacks, redirects, hidden/internal tools, authentication entry, tests, documentation, external consumers, and compatibility contracts are considered separately.",
        "",
        "## UI route hierarchy",
        "",
        *hierarchy_lines(ui_routes),
        "",
        "## Product-status inventory",
    ]

    for status in STATUS_ORDER:
        grouped = [route for route in ui_routes if route["product_status"] == status]
        lines.extend(
            [
                "",
                f"### {status}",
                "",
                "| Route | Boundary | Source | Confidence | Auth/current entry contract | Incoming relationships | Direct component/API/data dependencies | Variants and rationale |",
                "|---|---|---|---|---|---|---|---|",
            ]
        )
        if not grouped:
            lines.append("| _None_ | — | — | — | — | — | — | — |")
            continue
        for route in grouped:
            outgoing = [
                edge
                for edge in outgoing_by_path.get(route.get("source_path") or "", [])
                if edge.get("edge_type")
                in {"calls", "reads", "writes", "produces", "consumes", "renders"}
            ]
            targets = []
            for edge in outgoing:
                target = str(edge.get("to_id"))
                if target not in targets:
                    targets.append(target)
            dependency_summary = (
                f"{len(route.get('dependencies', []))} declared modules; "
                f"{len(outgoing)} direct data/render edges"
            )
            if targets:
                dependency_summary += "; " + ", ".join(targets[:5])
                if len(targets) > 5:
                    dependency_summary += f" (+{len(targets) - 5})"
            incoming = compact_mapping(route.get("incoming_counts", {}))
            if not route.get("incoming_relationships"):
                incoming = "No frozen static incoming edge; framework/deep-link purpose retained; not Dead end evidence"
            auth = route.get("auth", {}).get("ui_gate")
            if route.get("routing_contracts"):
                auth = f"{auth}; routing={md(route['routing_contracts'])}"
            variants = md(route.get("variants", []))
            rationale = route.get("status_rationale") or ""
            lines.append(
                "| "
                + " | ".join(
                    md(value)
                    for value in (
                        route["pattern"],
                        route["deployment_boundary"],
                        route["source_path"],
                        route["status_confidence"],
                        auth,
                        incoming,
                        dependency_summary,
                        f"{variants}; {rationale}",
                    )
                )
                + " |"
            )

    lines.extend(
        [
            "",
            "## Redirects, rewrites, aliases, and auth boundaries",
            "",
            "| Surface | Contract | Source | Auth |",
            "|---|---|---|---|",
        ]
    )
    for route in routes:
        routing = route.get("routing_contracts")
        auth = route.get("auth")
        if routing or (
            route["qualifies_for_product_status"]
            and auth
            and auth.get("ui_gate") not in {None, "no UI auth gate evidenced"}
        ):
            lines.append(
                f"| {md(route['deployment_boundary'] + ':' + str(route['pattern']))} | {md(routing)} | {md(route.get('source_path'))} | {md(auth)} |"
            )
    auth_edge_count = sum(edge["edge_type"] == "auth_gates" for edge in edges)
    lines.extend(
        [
            "",
            f"The dependency ledger contains {auth_edge_count} normalized `auth_gates` edges. An absent gate is recorded as static `none_observed`, not as proof of deployment exposure or safety.",
            "",
            "## API and server endpoints",
            "",
            "Every endpoint below is non-UI and therefore has no page product status.",
            "",
            "| Boundary | Pattern | Methods | Auth by method | Side effects | Scheduler/incoming evidence | Source | Runtime/deployment state |",
            "|---|---|---|---|---|---|---|---|",
        ]
    )
    for route in endpoints:
        auth = route.get("auth", {}).get("endpoint_gate_by_method")
        side_effect = route.get("side_effect_by_method")
        incoming = compact_mapping(route.get("incoming_counts", {}))
        scheduler = route.get("scheduler_owners") or []
        scheduler_summary = f"{incoming}; owners={md(scheduler)}"
        lines.append(
            "| "
            + " | ".join(
                md(value)
                for value in (
                    route["deployment_boundary"],
                    route["pattern"],
                    route.get("methods", []),
                    auth,
                    side_effect,
                    scheduler_summary,
                    route.get("source_path"),
                    route.get("runtime_state"),
                )
            )
            + " |"
        )

    operational_kinds = {
        "job_or_pipeline",
        "route_job_or_pipeline",
        "scheduled_job_declaration",
    }
    operations = sorted(
        (record for record in inventory if record["inventory_kind"] in operational_kinds),
        key=lambda record: (
            record["inventory_kind"],
            record.get("path") or "",
            record.get("name") or "",
        ),
    )
    lines.extend(
        [
            "",
            "## Background jobs and data pipelines",
            "",
            f"The canonical inventory contains {len(operations)} job/pipeline/declaration records. Declarations and implementations are separate records where the repository contains both.",
            "",
            "| Kind | ID/name | Trigger or schedule | Side-effect class | Output/target/static consumers | Source | Graph relationships |",
            "|---|---|---|---|---|---|---|",
        ]
    )
    for record in operations:
        details = record.get("details", {})
        trigger = (
            details.get("trigger_surface")
            or details.get("schedule")
            or details.get("subtype")
            or details.get("scheduler_ownership")
        )
        side_effect = details.get("side_effect_class") or details.get("effect_class")
        output = (
            details.get("target")
            or details.get("outputs")
            or details.get("declared_targets")
            or details.get("static_consumers")
        )
        source_id = record.get("source_record_id")
        related = [
            edge
            for edge in edges
            if source_id and source_id in {str(edge.get("from_id")), str(edge.get("to_id"))}
        ]
        relationship_counts = compact_mapping(Counter(edge["edge_type"] for edge in related))
        lines.append(
            "| "
            + " | ".join(
                md(value)
                for value in (
                    record["inventory_kind"],
                    source_id or record.get("name"),
                    trigger,
                    side_effect,
                    output,
                    record.get("path"),
                    relationship_counts,
                )
            )
            + " |"
        )

    integration_edges: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for edge in edges:
        target = str(edge.get("to_id") or "")
        if target.startswith("EXT:") or target.startswith("INTEGRATION:"):
            integration_edges[target].append(edge)
    lines.extend(
        [
            "",
            "## External integrations and operational boundaries",
            "",
            "| Integration/boundary | Relationship count | Relationship types | Representative source paths |",
            "|---|---:|---|---|",
        ]
    )
    for target, related in sorted(integration_edges.items()):
        paths = []
        for edge in related:
            path = edge.get("source_path")
            if path and path not in paths:
                paths.append(path)
        lines.append(
            f"| {md(target)} | {len(related)} | {md(dict(Counter(edge['edge_type'] for edge in related)))} | {md(paths[:8])} |"
        )

    lines.extend(
        [
            "",
            "## Structured evidence indexes",
            "",
            "- `route-ledger.jsonl` — all 338 UI/API/server route records, status scope, variants, auth, writes, schedulers, and incoming relationships.",
            "- `inventory-ledger.jsonl` — all 3,580 frozen files plus 9,192 entity/entrypoint/configuration/job/database/environment records.",
            f"- `dependency-edges.jsonl` — all {len(edges):,} normalized import/render/navigation/redirect/rewrite/auth/call/read/write/schedule/produce/consume/test/document/deploy relationships.",
            "- `evidence/route-reference-scan.json` — exact-literal scan scope, exclusions, limitations, and counts.",
            "",
            "The ledgers preserve full evidence references. This map intentionally avoids duplicating every component/import edge as prose.",
        ]
    )
    (root / "site-map.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "ui_routes": len(ui_routes),
                "endpoints": len(endpoints),
                "operations": len(operations),
                "integration_boundaries": len(integration_edges),
                "lines": len(lines),
                "result": "passed",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
