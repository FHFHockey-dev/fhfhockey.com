#!/usr/bin/env python3
"""Build canonical Phase 4 inventory, route, and dependency ledgers.

The helper parses only the frozen source manifest/snapshot and existing audit
artifacts. It never imports application modules or performs network, database,
authentication, scheduling, migration, or deployment work. Outputs are limited
to the audit package supplied by --audit-root.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


AUDIT_RUN_ID = "REPO-AUDIT-2026-08-09-FROZEN-36536C3"
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

INVENTORY_TYPES = {
    "route",
    "entity",
    "proposed_entity",
    "proposed_endpoint",
    "proposed_pipeline_job",
    "route_job_pipeline",
    "db_migration",
    "db_object",
    "config_entity",
    "script_entity",
    "scheduled_job",
    "test_suite_observation",
    "environment_reference",
    "environment_variable_reference",
    "secret_store_reference",
}

TEXT_SUFFIXES = {
    ".cjs",
    ".css",
    ".env",
    ".graphql",
    ".html",
    ".ini",
    ".ipynb",
    ".js",
    ".json",
    ".jsonc",
    ".jsx",
    ".md",
    ".mdx",
    ".mjs",
    ".py",
    ".scss",
    ".sh",
    ".sql",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}

STATUS_OVERRIDES = {
    "/game/[gameId]": {
        "product_status": "In progress — Far from complete",
        "confidence": "Medium",
        "rationale": (
            "The route has substantive final/postgame behavior, but its primary pregame "
            "variant always renders GamePreview and can replace unavailable analytics with "
            "credible fabricated values. A required primary outcome is therefore unreliable, "
            "not merely cosmetically incomplete."
        ),
        "verification_methods": ["static-source", "independent-static-verification"],
    },
    "/staging-studio": {
        "product_status": "In progress — Far from complete",
        "confidence": "Low",
        "rationale": (
            "Sanity declares an intentional staging editor workspace, but neither the CMS "
            "deployment config nor the web proxy declares its direct/deep-link rewrite. The "
            "workspace is substantive while its required deployed entry contract remains "
            "unavailable or unproven."
        ),
        "verification_methods": ["static-source", "config"],
    },
}

MANIFEST_BY_PATH: dict[str, dict[str, Any]] = {}


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


def write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as output:
        for record in records:
            output.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def evidence_of(record: dict[str, Any]) -> list[Any]:
    evidence = record.get("evidence_refs")
    if evidence is None:
        evidence = record.get("evidence")
    if evidence is None:
        return []
    return evidence if isinstance(evidence, list) else [evidence]


def canonical_evidence(
    record: dict[str, Any], path: str | None, default_method: str = "static-source"
) -> tuple[list[Any], list[Any]]:
    """Separate formal source citations from workstream-local review metadata."""
    formal: list[Any] = []
    metadata: list[Any] = []
    for item in evidence_of(record):
        if isinstance(item, str) and re.match(r"^[a-z][a-z0-9_-]*:", item):
            formal.append(item)
        elif isinstance(item, dict) and (
            isinstance(item.get("path"), str)
            or item.get("method")
            in {
                "command",
                "coverage",
                "generated-metadata",
                "git-history",
                "receipt",
                "runtime-local",
                "runtime-public",
            }
        ):
            formal.append(item)
        else:
            metadata.append(item)
    if path and not any(
        isinstance(item, dict) and item.get("path") == path for item in formal
    ):
        baseline = MANIFEST_BY_PATH.get(path)
        if baseline:
            formal.append(
                {
                    "method": default_method,
                    "path": path,
                    "baseline_sha256": baseline.get("sha256"),
                    "confidence": "High",
                }
            )
    return formal, metadata


def source_record_id(record: dict[str, Any]) -> str | None:
    for key in (
        "entity_id",
        "db_object_id",
        "migration_id",
        "route_id",
        "record_id",
        "job_id",
        "env_id",
        "environment_id",
        "secret_store_id",
        "observation_id",
    ):
        if record.get(key):
            return str(record[key])
    return None


def source_path(record: dict[str, Any]) -> str | None:
    for key in ("path", "source_path", "definition_path"):
        if isinstance(record.get(key), str):
            return record[key]
    return None


def record_name(record: dict[str, Any]) -> str | None:
    for key in ("name", "pattern", "pattern_or_name", "intended_purpose", "purpose"):
        if record.get(key) is not None:
            return str(record[key])
    return None


def inventory_kind(record_type: str) -> str:
    return {
        "route": "ui_route",
        "entity": "entity",
        "proposed_entity": "entity",
        "proposed_endpoint": "api_endpoint",
        "proposed_pipeline_job": "job_or_pipeline",
        "route_job_pipeline": "route_job_or_pipeline",
        "db_migration": "database_migration",
        "db_object": "database_object_change",
        "config_entity": "configuration",
        "script_entity": "script",
        "scheduled_job": "scheduled_job_declaration",
        "test_suite_observation": "test_suite_observation",
        "environment_reference": "environment_name_reference",
        "environment_variable_reference": "environment_name_reference",
        "secret_store_reference": "secret_store_name_reference",
    }[record_type]


def build_inventory(
    coverage: list[dict[str, Any]], merged: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for file_record in coverage:
        if file_record.get("record_kind") != "file":
            continue
        formal_evidence, evidence_metadata = canonical_evidence(
            file_record, file_record["path"], "coverage"
        )
        candidates.append(
            {
                "audit_run_id": AUDIT_RUN_ID,
                "inventory_kind": "file",
                "canonical_key": f"file:{file_record['path']}",
                "name": Path(file_record["path"]).name,
                "path": file_record["path"],
                "line": None,
                "baseline_sha256": file_record.get("baseline_sha256"),
                "confidence": "High",
                "audit_status": file_record.get("audit_status"),
                "audit_disposition": file_record.get("disposition"),
                "source_workstream": file_record.get("owner_workstream"),
                "source_record_type": "coverage_file",
                "source_record_id": file_record.get("file_id"),
                "evidence_refs": formal_evidence,
                "details": {
                    "scope_class": file_record.get("scope_class"),
                    "review_depth": file_record.get("review_depth"),
                    "exclusion_code": file_record.get("exclusion_code"),
                    "finding_ids": file_record.get("finding_ids", []),
                    "entity_ids": file_record.get("entity_ids", []),
                    "notes": file_record.get("audit_notes"),
                    "file_review_metadata": evidence_metadata,
                },
            }
        )

    omitted = {
        "audit_run_id",
        "schema_version",
        "record_type",
        "source_workstream",
        "source_shard_record",
        "evidence_refs",
        "evidence",
    }
    for record in merged:
        record_type = str(record.get("record_type", ""))
        if record_type not in INVENTORY_TYPES:
            continue
        path = source_path(record)
        name = record_name(record)
        source_id = source_record_id(record)
        formal_evidence, evidence_metadata = canonical_evidence(record, path)
        candidates.append(
            {
                "audit_run_id": AUDIT_RUN_ID,
                "inventory_kind": inventory_kind(record_type),
                "canonical_key": ":".join(
                    part
                    for part in (record_type, source_id, path, name)
                    if part is not None
                ),
                "name": name,
                "path": path,
                "line": record.get("line"),
                "baseline_sha256": record.get("baseline_sha256"),
                "confidence": record.get("confidence", "Medium"),
                "audit_status": "audited",
                "audit_disposition": record.get(
                    "audit_disposition", record.get("disposition", "structurally inventoried")
                ),
                "source_workstream": record.get("source_workstream"),
                "source_record_type": record_type,
                "source_record_id": source_id,
                "evidence_refs": formal_evidence,
                "details": {
                    **{key: value for key, value in record.items() if key not in omitted},
                    "source_evidence_metadata": evidence_metadata,
                },
            }
        )

    candidates.sort(
        key=lambda record: (
            record["inventory_kind"],
            record.get("path") or "",
            record.get("name") or "",
            record.get("source_record_id") or "",
        )
    )
    for index, record in enumerate(candidates, start=1):
        record["schema_version"] = 1
        record["inventory_id"] = f"INV-{index:06d}"
    return candidates


def ui_route_record(source: dict[str, Any]) -> dict[str, Any]:
    pattern = str(source["pattern"])
    status = str(source["product_status"])
    confidence = str(source.get("confidence", "Medium"))
    rationale = str(source.get("status_rationale", ""))
    methods = list(source.get("verification_methods", []))
    override = STATUS_OVERRIDES.get(pattern)
    if override:
        status = override["product_status"]
        confidence = override["confidence"]
        rationale = override["rationale"]
        methods = override["verification_methods"]
    if status not in STATUS_VOCABULARY:
        raise RuntimeError(f"invalid UI product status for {pattern}: {status}")
    source_file = str(source["source_path"])
    formal_evidence, evidence_metadata = canonical_evidence(source, source_file)
    boundary = "cms-sanity" if source.get("route_kind") == "cms_studio" else "web-next-pages"
    routing_contracts: list[dict[str, Any]] = []
    if source.get("redirect_or_rewrite"):
        routing_contracts.append(
            {
                "kind": "source-declared redirect/rewrite/alias",
                "target": source["redirect_or_rewrite"],
            }
        )
    if pattern == "/studio":
        routing_contracts.extend(
            [
                {
                    "kind": "web proxy rewrite",
                    "source": "web/next.config.js",
                    "target": "${CMS_URL}/studio/:path*",
                },
                {
                    "kind": "CMS SPA rewrite",
                    "source": "cms/vercel.json",
                    "target": "/index.html",
                },
            ]
        )
    if pattern == "/staging-studio":
        routing_contracts.append(
            {
                "kind": "missing matching deployment rewrite",
                "source": "cms/vercel.json and web/next.config.js",
                "target": None,
            }
        )
    return {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "surface_type": "user_facing_ui",
        "deployment_boundary": boundary,
        "source_route_id": source.get("route_id"),
        "pattern": pattern,
        "source_path": source_file,
        "baseline_sha256": source.get("baseline_sha256"),
        "route_kind": source.get("route_kind"),
        "methods": ["GET", "HEAD"],
        "qualifies_for_product_status": True,
        "product_status": status,
        "source_product_status_proposal": source.get("product_status"),
        "status_confidence": confidence,
        "status_rationale": rationale,
        "classification_stage": "phase4_static_adjudication",
        "verification_methods": methods,
        "runtime_state": source.get("runtime_state"),
        "runtime_verification": "pending_phase5",
        "responsive_verification": "pending_phase5",
        "rendering_mode": source.get("rendering_mode"),
        "title_or_purpose": source.get("title_or_purpose"),
        "dynamic_params": source.get("dynamic_params", []),
        "variants": source.get("variants", []),
        "variant_evidence": source.get("variants", []),
        "auth": {
            "ui_gate": source.get("auth_evidence"),
            "endpoint_gate": "not_applicable",
        },
        "routing_contracts": routing_contracts,
        "dependencies": source.get("dependencies", []),
        "finding_ids": source.get("finding_ids", []),
        "evidence_refs": formal_evidence,
        "source_evidence_metadata": evidence_metadata,
        "source_workstream": source.get("source_workstream"),
        "incoming_relationships": [],
        "incoming_counts": {},
    }


def endpoint_route_record(source: dict[str, Any]) -> dict[str, Any]:
    formal_evidence, evidence_metadata = canonical_evidence(source, source.get("source_path"))
    return {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "surface_type": "api_or_server_endpoint",
        "deployment_boundary": "web-next-api",
        "source_route_id": source.get("route_id"),
        "pattern": source.get("pattern"),
        "source_path": source.get("source_path"),
        "baseline_sha256": source.get("baseline_sha256"),
        "route_kind": source.get("route_kind"),
        "methods": source.get("methods", []),
        "qualifies_for_product_status": False,
        "product_status": None,
        "status_confidence": None,
        "status_rationale": "Non-UI framework endpoint; inventoried without a page product status.",
        "classification_stage": "not_applicable_non_ui",
        "verification_methods": source.get("verification_methods", []),
        "runtime_state": source.get("runtime_state"),
        "runtime_verification": "pending_or_static_only_phase5",
        "rendering_mode": source.get("rendering_mode"),
        "dynamic_params": source.get("dynamic_params", []),
        "variants": source.get("variants", []),
        "auth": {
            "ui_gate": "not_applicable",
            "endpoint_gate_by_method": source.get("auth_by_method", {}),
        },
        "routing_contracts": source.get("redirect_or_rewrite"),
        "side_effect_by_method": source.get("side_effect_by_method", {}),
        "cache_behavior": source.get("cache_behavior"),
        "db_objects": source.get("db_objects", []),
        "rpc_calls": source.get("rpc_calls", []),
        "external_hosts": source.get("external_hosts", []),
        "external_integrations": source.get("external_integrations", []),
        "scheduler_owners": source.get("scheduler_owners", []),
        "tests": source.get("tests", []),
        "finding_ids": source.get("finding_ids", []),
        "evidence_refs": formal_evidence,
        "source_evidence_metadata": evidence_metadata,
        "source_workstream": source.get("source_workstream"),
        "incoming_relationships": [],
        "incoming_counts": {},
    }


def platform_route_record(source: dict[str, Any]) -> dict[str, Any]:
    subtype = source.get("subtype")
    formal_evidence, evidence_metadata = canonical_evidence(source, source.get("path"))
    return {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "surface_type": (
            "serverless_text_endpoint" if subtype == "serverless_ui_text" else "api_or_server_endpoint"
        ),
        "deployment_boundary": "functions-python-vercel",
        "source_route_id": source.get("record_id"),
        "pattern": source.get("pattern_or_name"),
        "source_path": source.get("path"),
        "baseline_sha256": None,
        "route_kind": subtype,
        "methods": source.get("methods", []),
        "qualifies_for_product_status": False,
        "product_status": None,
        "status_confidence": None,
        "status_rationale": (
            "Operational text/API surface, not an independently user-facing product page."
        ),
        "classification_stage": "not_applicable_non_ui",
        "verification_methods": ["static-source", "config"],
        "runtime_state": source.get("deployment_reachability"),
        "runtime_verification": "pending_or_static_only_phase5",
        "rendering_mode": "Python Vercel function",
        "dynamic_params": [],
        "variants": [],
        "auth": {
            "ui_gate": "not_applicable",
            "endpoint_gate_by_method": source.get("auth"),
        },
        "routing_contracts": source.get("deployment_reachability"),
        "side_effect_by_method": source.get("side_effect_class"),
        "data_flow": source.get("data_flow"),
        "authority_status": source.get("authority_status"),
        "finding_ids": [],
        "evidence_refs": formal_evidence,
        "source_evidence_metadata": evidence_metadata,
        "source_workstream": source.get("source_workstream"),
        "incoming_relationships": [],
        "incoming_counts": {},
    }


def build_routes(merged: list[dict[str, Any]]) -> list[dict[str, Any]]:
    routes: list[dict[str, Any]] = []
    for source in merged:
        record_type = source.get("record_type")
        if record_type == "route":
            routes.append(ui_route_record(source))
        elif record_type == "proposed_endpoint":
            routes.append(endpoint_route_record(source))
        elif record_type == "route_job_pipeline" and source.get("subtype") in {
            "serverless_ui_text",
            "server_endpoint",
        }:
            routes.append(platform_route_record(source))
    routes.sort(
        key=lambda record: (
            record["deployment_boundary"],
            record.get("pattern") or "",
            record.get("source_path") or "",
        )
    )
    for index, route in enumerate(routes, start=1):
        route["route_id"] = f"ROUTE-{index:04d}"
    ui = [record for record in routes if record["qualifies_for_product_status"]]
    if len(ui) != 72:
        raise RuntimeError(f"expected 72 product-status UI routes, found {len(ui)}")
    if any(record.get("product_status") not in STATUS_VOCABULARY for record in ui):
        raise RuntimeError("one or more UI routes lack an exact status")
    if any(
        record.get("product_status") is not None
        for record in routes
        if not record["qualifies_for_product_status"]
    ):
        raise RuntimeError("non-UI route received a product status")
    return routes


def normalize_relationship(relationship: str) -> str:
    value = relationship.lower()
    if "scheduled" in value:
        return "schedules"
    if "workflow executes" in value or "starts local server" in value or "lifecycle" in value:
        return "calls"
    if "test" in value or "browser spec" in value:
        return "tests"
    if "loads" in value or "depends on env" in value:
        return "reads"
    if "output tracing" in value:
        return "deploys"
    return "calls"


def normalize_edge_type(value: str | None) -> str:
    if value == "documents_supersession":
        return "documents"
    normalized = str(value or "calls")
    if normalized not in EDGE_VOCABULARY:
        return "calls"
    return normalized


def strip_url_state(value: str) -> str:
    return value.split("#", 1)[0].split("?", 1)[0]


def route_pattern_matches(pattern: str, target: str) -> bool:
    target_path = strip_url_state(target)
    if pattern == target_path:
        return True
    pattern_parts = [part for part in pattern.split("/") if part]
    target_parts = [part for part in target_path.split("/") if part]
    if len(pattern_parts) != len(target_parts):
        return False
    for expected, actual in zip(pattern_parts, target_parts):
        if expected.startswith("[") and expected.endswith("]"):
            continue
        if expected != actual:
            return False
    return True


def route_target_id(routes: list[dict[str, Any]], target: Any) -> str | None:
    if not isinstance(target, str) or not target.startswith("/"):
        return None
    if strip_url_state(target) == "/":
        web_root = [
            route
            for route in routes
            if route.get("pattern") == "/"
            and route.get("deployment_boundary") == "web-next-pages"
        ]
        return str(web_root[0]["route_id"]) if len(web_root) == 1 else None
    matches = [
        route
        for route in routes
        if route_pattern_matches(str(route["pattern"]), target)
    ]
    if len(matches) == 1:
        return str(matches[0]["route_id"])
    return None


def base_edges(merged: list[dict[str, Any]], routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for source in merged:
        record_type = source.get("record_type")
        if record_type in {"edge", "proposed_edge"}:
            edge_type = normalize_edge_type(source.get("edge_type"))
            from_id = source.get("from_id")
            to_id = source.get("to_id")
            edge_source_path = source.get("source_path") or from_id
            formal_evidence, evidence_metadata = canonical_evidence(source, edge_source_path)
            result.append(
                {
                    "edge_type": edge_type,
                    "from_id": from_id,
                    "to_id": to_id,
                    "route_target_id": route_target_id(routes, to_id),
                    "source_path": edge_source_path,
                    "line": source.get("line"),
                    "confidence": source.get("confidence", "Medium"),
                    "detection_method": source.get("detection_method", "workstream-static-analysis"),
                    "evidence_refs": formal_evidence,
                    "finding_ids": source.get("finding_ids", []),
                    "source_workstream": source.get("source_workstream"),
                    "source_edge_id": source.get("edge_id"),
                    "details": {
                        "source_details": source.get("details"),
                        "source_evidence_metadata": evidence_metadata,
                    },
                }
            )
        elif record_type == "dependency_edge":
            relationship = str(source.get("relationship", ""))
            target = source.get("target")
            edge_source_path = source.get("source")
            formal_evidence, evidence_metadata = canonical_evidence(source, edge_source_path)
            result.append(
                {
                    "edge_type": normalize_relationship(relationship),
                    "from_id": source.get("source"),
                    "to_id": target,
                    "route_target_id": route_target_id(routes, target),
                    "source_path": source.get("source"),
                    "line": None,
                    "confidence": "High",
                    "detection_method": "configuration-declaration",
                    "evidence_refs": formal_evidence,
                    "finding_ids": [],
                    "source_workstream": source.get("source_workstream"),
                    "source_edge_id": source.get("edge_id"),
                    "details": {
                        "relationship": relationship,
                        "source_evidence_metadata": evidence_metadata,
                    },
                }
            )
    return result


def add_operational_edges(
    edges: list[dict[str, Any]], merged: list[dict[str, Any]], routes: list[dict[str, Any]]
) -> None:
    for source in merged:
        record_type = source.get("record_type")
        if record_type == "scheduled_job":
            target = source.get("request_path") or source.get("endpoint_path")
            formal_evidence, evidence_metadata = canonical_evidence(source, source.get("path"), "config")
            edges.append(
                {
                    "edge_type": "schedules",
                    "from_id": source.get("job_id"),
                    "to_id": target,
                    "route_target_id": route_target_id(routes, target),
                    "source_path": source.get("path"),
                    "line": None,
                    "confidence": "High",
                    "detection_method": "vercel-cron-config",
                    "evidence_refs": formal_evidence,
                    "finding_ids": [],
                    "source_workstream": source.get("source_workstream"),
                    "source_edge_id": source.get("job_id"),
                    "details": {
                        "schedule": source.get("schedule"),
                        "source_evidence_metadata": evidence_metadata,
                    },
                }
            )
        elif record_type == "route_job_pipeline" and source.get("subtype") in {
            "scheduled_job",
            "environment_managed_scheduled_job",
        }:
            target = source.get("target")
            formal_evidence, evidence_metadata = canonical_evidence(source, source.get("path"))
            edges.append(
                {
                    "edge_type": "schedules",
                    "from_id": source.get("record_id"),
                    "to_id": target,
                    "route_target_id": route_target_id(routes, target),
                    "source_path": source.get("path"),
                    "line": None,
                    "confidence": source.get("confidence", "Medium"),
                    "detection_method": "active-migration-scheduler-declaration",
                    "evidence_refs": formal_evidence,
                    "finding_ids": [],
                    "source_workstream": source.get("source_workstream"),
                    "source_edge_id": source.get("record_id"),
                    "details": {
                        "schedule": source.get("schedule"),
                        "source_evidence_metadata": evidence_metadata,
                    },
                }
            )
        elif record_type == "proposed_pipeline_job":
            formal_evidence, evidence_metadata = canonical_evidence(source, source.get("path"))
            for consumer in source.get("static_consumers", []) or []:
                edges.append(
                    {
                        "edge_type": "consumes",
                        "from_id": consumer,
                        "to_id": source.get("job_id"),
                        "route_target_id": None,
                        "source_path": source.get("path"),
                        "line": None,
                        "confidence": source.get("confidence", "Medium"),
                        "detection_method": "static-job-consumer",
                        "evidence_refs": formal_evidence,
                        "finding_ids": source.get("finding_ids", []),
                        "source_workstream": source.get("source_workstream"),
                        "source_edge_id": source.get("job_id"),
                        "details": {"source_evidence_metadata": evidence_metadata},
                    }
                )

    for route in routes:
        auth = route.get("auth", {})
        ui_gate = auth.get("ui_gate")
        gate = (
            auth.get("endpoint_gate_by_method")
            if ui_gate in {None, "not_applicable"}
            else ui_gate
        )
        serialized = json.dumps(gate, sort_keys=True) if isinstance(gate, dict) else str(gate)
        if not gate or serialized in {
            "not_applicable",
            "no UI auth gate evidenced",
            "{}",
            "null",
        }:
            continue
        if "none_observed" in serialized and not any(
            token in serialized
            for token in ("admin", "bearer", "authenticated", "secret", "oauth", "signed")
        ):
            continue
        edges.append(
            {
                "edge_type": "auth_gates",
                "from_id": route["route_id"],
                "to_id": f"auth-boundary:{serialized}",
                "route_target_id": None,
                "source_path": route.get("source_path"),
                "line": None,
                "confidence": route.get("status_confidence") or "High",
                "detection_method": "route-auth-adjudication",
                "evidence_refs": route.get("evidence_refs", []),
                "finding_ids": route.get("finding_ids", []),
                "source_workstream": route.get("source_workstream"),
                "source_edge_id": None,
                "details": gate,
            }
        )

    # Cross-workstream route consumer missed by the separate TypeScript/Python
    # scans: the authenticated webhook launches a browser against the dynamic
    # line-combination UI to capture its current rendered output.
    bridge_path = "web/pages/api/v1/webhooks/on-new-line-combo.ts"
    bridge_target = "/lines/line-combo/${gameId}?isScreenshot=1"
    bridge_baseline = MANIFEST_BY_PATH.get(bridge_path, {})
    edges.append(
        {
            "edge_type": "calls",
            "from_id": bridge_path,
            "to_id": bridge_target,
            "route_target_id": route_target_id(routes, bridge_target),
            "source_path": bridge_path,
            "line": 95,
            "confidence": "High",
            "detection_method": "coordinator-cross-workstream-static-reconciliation",
            "evidence_refs": [
                {
                    "method": "static-source",
                    "path": bridge_path,
                    "lines": "95",
                    "baseline_sha256": bridge_baseline.get("sha256"),
                    "confidence": "High",
                }
            ],
            "finding_ids": [],
            "source_workstream": "coordinator",
            "source_edge_id": "CROSS-ROUTE-LINE-COMBO-001",
            "details": "Playwright page.goto consumer of the dynamic UI route.",
        }
    )


def route_reference_scan(
    source_root: Path,
    manifest: dict[str, dict[str, Any]],
    coverage_by_path: dict[str, dict[str, Any]],
    routes: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    routes_by_pattern: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for route in routes:
        if route.get("pattern") != "/" and str(route.get("pattern", "")).startswith("/"):
            routes_by_pattern[str(route["pattern"])].append(route)
    unambiguous_routes = {
        pattern: matching[0]
        for pattern, matching in routes_by_pattern.items()
        if len(matching) == 1
    }
    patterns = sorted(
        unambiguous_routes,
        key=len,
        reverse=True,
    )
    combined = re.compile(
        r"(?<![A-Za-z0-9_-])(?:"
        + "|".join(re.escape(pattern) for pattern in patterns)
        + r")(?![A-Za-z0-9_/-])"
    )
    refs: list[dict[str, Any]] = []
    scanned = 0
    skipped_binary = 0
    skipped_secret_like = 0
    skipped_oversized = 0
    skipped_non_text_suffix = 0
    decode_failures = 0
    ui_matches = 0
    non_ui_matches = 0
    max_size = 2 * 1024 * 1024

    for path in sorted(manifest):
        coverage = coverage_by_path[path]
        source_path = source_root / path
        if coverage.get("scope_class") == "binary_asset":
            skipped_binary += 1
            continue
        if Path(path).name.startswith(".env"):
            skipped_secret_like += 1
            continue
        if manifest[path].get("size_bytes", 0) > max_size:
            skipped_oversized += 1
            continue
        suffix = Path(path).suffix.lower()
        if suffix not in TEXT_SUFFIXES:
            skipped_non_text_suffix += 1
            continue
        try:
            text = source_path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            decode_failures += 1
            continue
        scanned += 1
        source_class = (
            "test"
            if coverage.get("scope_class") == "test"
            else "documentation"
            if coverage.get("scope_class") == "first_party_document"
            else "configuration"
            if suffix in {".json", ".jsonc", ".toml", ".yaml", ".yml"}
            else "source"
        )
        for line_number, line in enumerate(text.splitlines(), start=1):
            for match in combined.finditer(line):
                pattern = match.group(0)
                route = unambiguous_routes[pattern]
                if path == route.get("source_path"):
                    continue
                if route["qualifies_for_product_status"]:
                    ui_matches += 1
                    edge_type = {
                        "test": "tests",
                        "documentation": "documents",
                        "configuration": "documents",
                        "source": "navigates",
                    }[source_class]
                else:
                    non_ui_matches += 1
                    edge_type = (
                        "tests"
                        if source_class == "test"
                        else "documents"
                        if source_class in {"documentation", "configuration"}
                        else "calls"
                    )
                refs.append(
                    {
                        "edge_type": edge_type,
                        "from_id": path,
                        "to_id": pattern,
                        "route_target_id": route["route_id"],
                        "source_path": path,
                        "line": line_number,
                        "confidence": "Medium",
                        "detection_method": f"exact-route-literal-scan:{source_class}",
                        "evidence_refs": [
                            {
                                "method": (
                                    "test-source"
                                    if source_class == "test"
                                    else "documentation"
                                    if source_class in {"documentation", "configuration"}
                                    else "static-source"
                                ),
                                "path": path,
                                "lines": str(line_number),
                                "baseline_sha256": manifest[path].get("sha256"),
                                "confidence": "Medium",
                            }
                        ],
                        "finding_ids": [],
                        "source_workstream": coverage.get("owner_workstream"),
                        "source_edge_id": None,
                        "details": {"matched_literal": pattern},
                    }
                )
    summary = {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "scan_id": "ROUTE-REF-SCAN-001",
        "method": "exact UI-route and endpoint literal scan over bounded frozen text files",
        "scanned_files": scanned,
        "matched_references": len(refs),
        "matched_ui_references": ui_matches,
        "matched_non_ui_references": non_ui_matches,
        "ambiguous_duplicate_patterns_skipped": sorted(
            pattern for pattern, matching in routes_by_pattern.items() if len(matching) > 1
        ),
        "skipped_binary_assets": skipped_binary,
        "skipped_secret_like_names_without_content_read": skipped_secret_like,
        "skipped_over_2_mib": skipped_oversized,
        "skipped_non_text_suffix": skipped_non_text_suffix,
        "decode_failures": decode_failures,
        "limitations": [
            "The scan supplements AST/navigation edges; it does not infer that every literal is a clickable link.",
            "Dynamic runtime URLs are primarily covered by AST/source-derived edges and bounded cross-system reconciliation.",
            "The root '/' route is excluded from literal scanning because it cannot be distinguished from ordinary path syntax.",
            "No absence result is used as Dead end evidence.",
        ],
    }
    return refs, summary


def dedupe_edges(edges: list[dict[str, Any]], routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for edge in edges:
        if not edge.get("route_target_id"):
            edge["route_target_id"] = route_target_id(routes, edge.get("to_id"))
    edges.sort(
        key=lambda edge: (
            edge.get("edge_type") or "",
            str(edge.get("from_id") or ""),
            str(edge.get("to_id") or ""),
            int(edge.get("line") or 0),
            str(edge.get("detection_method") or ""),
        )
    )
    result: list[dict[str, Any]] = []
    seen: set[tuple[Any, ...]] = set()
    for edge in edges:
        key = (
            edge.get("edge_type"),
            edge.get("from_id"),
            edge.get("to_id"),
            edge.get("line"),
            edge.get("detection_method"),
        )
        if key in seen:
            continue
        seen.add(key)
        result.append(edge)
    for index, edge in enumerate(result, start=1):
        edge["schema_version"] = 1
        edge["audit_run_id"] = AUDIT_RUN_ID
        edge["edge_id"] = f"EDGE-{index:06d}"
    return result


def attach_incoming(routes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> None:
    incoming: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for edge in edges:
        target = edge.get("route_target_id")
        if target:
            incoming[str(target)].append(
                {
                    "edge_id": edge["edge_id"],
                    "edge_type": edge["edge_type"],
                    "from_id": edge.get("from_id"),
                    "source_path": edge.get("source_path"),
                    "line": edge.get("line"),
                    "confidence": edge.get("confidence"),
                    "detection_method": edge.get("detection_method"),
                }
            )
    for route in routes:
        refs = incoming.get(route["route_id"], [])
        route["incoming_relationships"] = refs
        route["incoming_counts"] = dict(sorted(Counter(ref["edge_type"] for ref in refs).items()))


def main() -> None:
    global MANIFEST_BY_PATH

    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-root", required=True)
    parser.add_argument("--source-root", required=True)
    args = parser.parse_args()

    audit_root = Path(args.audit_root).resolve()
    source_root = Path(args.source_root).resolve()
    coverage = load_jsonl(audit_root / "coverage-ledger.jsonl")
    merged = load_jsonl(audit_root / "evidence" / "shards" / "merged-static-records.jsonl")
    manifest_records = load_jsonl(audit_root / "evidence" / "frozen-source-manifest.jsonl")
    manifest = {record["path"]: record for record in manifest_records}
    MANIFEST_BY_PATH = manifest
    coverage_by_path = {
        record["path"]: record
        for record in coverage
        if record.get("record_kind") == "file"
    }
    if set(manifest) != set(coverage_by_path):
        raise RuntimeError("frozen manifest and coverage path universes differ")

    inventory = build_inventory(coverage, merged)
    routes = build_routes(merged)
    edges = base_edges(merged, routes)
    add_operational_edges(edges, merged, routes)
    route_refs, route_scan_summary = route_reference_scan(
        source_root, manifest, coverage_by_path, routes
    )
    edges.extend(route_refs)
    edges = dedupe_edges(edges, routes)
    attach_incoming(routes, edges)

    write_jsonl(audit_root / "inventory-ledger.jsonl", inventory)
    write_jsonl(audit_root / "route-ledger.jsonl", routes)
    write_jsonl(audit_root / "dependency-edges.jsonl", edges)
    (audit_root / "evidence" / "route-reference-scan.json").write_text(
        json.dumps(route_scan_summary, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    result = {
        "inventory_records": len(inventory),
        "inventory_file_records": sum(record["inventory_kind"] == "file" for record in inventory),
        "route_records": len(routes),
        "ui_route_records": sum(record["qualifies_for_product_status"] for record in routes),
        "non_ui_route_records": sum(not record["qualifies_for_product_status"] for record in routes),
        "ui_status_counts": dict(
            sorted(
                Counter(
                    record["product_status"]
                    for record in routes
                    if record["qualifies_for_product_status"]
                ).items()
            )
        ),
        "dependency_edges": len(edges),
        "edge_type_counts": dict(sorted(Counter(edge["edge_type"] for edge in edges).items())),
        "route_literal_scan": route_scan_summary,
        "output_sha256": {
            "inventory-ledger.jsonl": sha256(audit_root / "inventory-ledger.jsonl"),
            "route-ledger.jsonl": sha256(audit_root / "route-ledger.jsonl"),
            "dependency-edges.jsonl": sha256(audit_root / "dependency-edges.jsonl"),
        },
        "result": "passed",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
