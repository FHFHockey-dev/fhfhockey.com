#!/usr/bin/env python3
"""Validate JSONL evidence citations against the frozen source manifest.

The tool reads only the frozen manifest/source and audit JSONL artifacts. It
does not import application modules, access the network, or write files.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any, Iterator


LINE_TOKEN = re.compile(r"^(\d+)(?:-(\d+))?$")


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
            value["__jsonl_line__"] = line_number
            records.append(value)
    return records


def walk_evidence(value: Any) -> Iterator[Any]:
    if isinstance(value, dict):
        evidence = value.get("evidence_refs")
        if isinstance(evidence, list):
            yield from evidence
        for key, nested in value.items():
            if key not in {"evidence_refs", "__jsonl_line__"}:
                yield from walk_evidence(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from walk_evidence(nested)


def referenced_line_max(lines: Any) -> int | None:
    if lines is None:
        return None
    maximum = 0
    found = False
    for token in re.split(r"\s*,\s*", str(lines).strip()):
        match = LINE_TOKEN.fullmatch(token)
        if not match:
            return None
        found = True
        maximum = max(maximum, int(match.group(2) or match.group(1)))
    return maximum if found else None


def normalize_evidence(value: Any) -> tuple[dict[str, Any] | None, str]:
    if isinstance(value, dict):
        return value, str(value.get("method", "missing"))
    if not isinstance(value, str):
        return None, "invalid"
    if value.startswith("baseline-sha256:"):
        return None, "baseline-sha256"
    prefix, separator, remainder = value.partition(":")
    if not separator:
        return None, "unparsed-string"
    method = prefix
    lines = None
    path = remainder
    possible_path, possible_separator, possible_lines = remainder.rpartition(":")
    if possible_separator and referenced_line_max(possible_lines) is not None:
        path = possible_path
        lines = possible_lines
    return {"method": method, "path": path, "lines": lines}, method


def count_lines(path: Path) -> int:
    count = 0
    last = b""
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            count += chunk.count(b"\n")
            last = chunk[-1:] if chunk else last
    return count if not last or last == b"\n" else count + 1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--input", action="append", required=True)
    args = parser.parse_args()

    manifest_path = Path(args.manifest).resolve()
    source_root = Path(args.source_root).resolve()
    manifest = {
        record["path"]: record
        for record in load_jsonl(manifest_path)
    }
    inputs = [Path(item).resolve() for item in args.input]

    refs = 0
    methods: Counter[str] = Counter()
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    line_counts: dict[str, int] = {}

    for input_path in inputs:
        for record in load_jsonl(input_path):
            record_line = record.pop("__jsonl_line__")
            if "/private/var/folders/" in json.dumps(record):
                errors.append(
                    {"input": str(input_path), "line": record_line, "error": "temporary_path_leak"}
                )
            top_path = record.get("path") or record.get("source_path") or record.get("definition_path")
            top_hash = record.get("baseline_sha256")
            if isinstance(top_path, str) and top_hash and top_path in manifest:
                if top_hash != manifest[top_path].get("sha256"):
                    errors.append(
                        {"input": str(input_path), "line": record_line, "path": top_path, "error": "top_level_baseline_hash_mismatch"}
                    )
            for raw_evidence in walk_evidence(record):
                refs += 1
                evidence, method = normalize_evidence(raw_evidence)
                methods[method] += 1
                if evidence is None:
                    if method in {"invalid", "unparsed-string"}:
                        warnings.append(
                            {"input": str(input_path), "line": record_line, "warning": "unparsed_evidence_ref"}
                        )
                    continue
                relative = evidence.get("path")
                expected_hash = evidence.get("baseline_sha256") or evidence.get("sha256")
                if not isinstance(relative, str):
                    warnings.append(
                        {"input": str(input_path), "line": record_line, "warning": "evidence_path_missing"}
                    )
                    continue
                baseline = manifest.get(relative)
                if baseline is None:
                    if evidence.get("method") in {
                        "coverage",
                        "runtime-local",
                        "runtime-public",
                        "command",
                        "git-history",
                        "generated-metadata",
                        "receipt",
                    }:
                        continue
                    warnings.append(
                        {"input": str(input_path), "line": record_line, "path": relative, "warning": "path_not_in_frozen_manifest"}
                    )
                    continue
                if expected_hash and expected_hash != baseline.get("sha256"):
                    errors.append(
                        {"input": str(input_path), "line": record_line, "path": relative, "error": "baseline_hash_mismatch"}
                    )
                maximum = referenced_line_max(evidence.get("lines"))
                if maximum is not None and baseline.get("kind") == "file":
                    if relative not in line_counts:
                        line_counts[relative] = count_lines(source_root / relative)
                    if maximum > line_counts[relative]:
                        errors.append(
                            {
                                "input": str(input_path),
                                "line": record_line,
                                "path": relative,
                                "error": "line_out_of_bounds",
                                "referenced": maximum,
                                "available": line_counts[relative],
                            }
                        )

    result = {
        "inputs": [str(path) for path in inputs],
        "records": sum(len(load_jsonl(path)) for path in inputs),
        "evidence_refs": refs,
        "methods": dict(sorted(methods.items())),
        "errors": errors[:50],
        "error_count": len(errors),
        "warnings": warnings[:50],
        "warning_count": len(warnings),
        "result": "passed" if not errors else "failed",
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
