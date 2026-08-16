#!/usr/bin/env python3
"""Generate bounded stylesheet architecture metrics from frozen source.

This parser never imports application modules. It reads CSS/Sass text and an
optional static edge shard, then writes one JSON evidence artifact supplied by
the caller beneath the audit package or external temporary storage.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


STYLE_SUFFIXES = (".css", ".scss", ".sass")
COMMENT = re.compile(r"/\*.*?\*/", re.S)
MEDIA = re.compile(r"@media\s*([^\{]+)", re.I)
HEX = re.compile(r"(?<![\w-])#[0-9a-fA-F]{3,8}\b")
DIMENSION = re.compile(r"(?<![\w.-])-?(?:\d*\.\d+|\d+)(?:px|rem|em|vh|vw|%)\b", re.I)
SASS_VAR = re.compile(r"(?m)^\s*(\$[\w-]+)\s*:")
CSS_VAR = re.compile(r"(?m)(--[\w-]+)\s*:")
CSS_VAR_USE = re.compile(r"var\(\s*(--[\w-]+)")
MIXIN_DEF = re.compile(r"@mixin\s+([\w-]+)")
MIXIN_USE = re.compile(r"@include\s+([\w-]+)")
DIRECTIVE = re.compile(r"(?m)^\s*@(use|forward|import)\s+([^;]+);")
RULE_BLOCK = re.compile(r"([^{}]+)\{([^{}]+)\}", re.S)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", "", COMMENT.sub("", text))


def normalize_block(body: str) -> str:
    declarations = []
    for part in body.split(";"):
        normalized = re.sub(r"\s+", " ", part.strip())
        if ":" in normalized:
            declarations.append(normalized)
    return ";".join(sorted(declarations))


def specificity(selector: str) -> tuple[int, int, int]:
    clean = re.sub(r":{1,2}[\w-]+(?:\([^)]*\))?", "", selector)
    ids = len(re.findall(r"#[\w-]+", clean))
    classes = len(re.findall(r"\.[\w-]+|\[[^\]]+\]", clean))
    elements = len(
        [
            token
            for token in re.split(r"[\s>+~,*]+", re.sub(r"[#.][\w-]+|\[[^\]]+\]", " ", clean))
            if re.fullmatch(r"[a-zA-Z][\w-]*", token)
        ]
    )
    return ids, classes, elements


def load_edges(path: Path | None) -> dict[str, set[str]]:
    consumers: dict[str, set[str]] = defaultdict(set)
    if path is None:
        return consumers
    with path.open(encoding="utf-8") as stream:
        for line in stream:
            if not line.strip():
                continue
            record = json.loads(line)
            if record.get("record_type") != "edge" or record.get("edge_type") != "imports":
                continue
            target = str(record.get("to_id", ""))
            if not target.startswith("module:") or not target.lower().endswith(STYLE_SUFFIXES):
                continue
            source = str(record.get("from_id", ""))
            specifier = target.removeprefix("module:")
            if specifier.startswith("."):
                resolved = (Path(source).parent / specifier).as_posix()
            elif specifier.startswith(("components/", "styles/", "pages/", "stories/")):
                resolved = f"web/{specifier}"
            elif specifier.startswith("cms/"):
                resolved = specifier
            else:
                resolved = specifier
            consumers[resolved].add(source)
    return consumers


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--edge-shard")
    args = parser.parse_args()

    root = Path(args.source_root).resolve()
    output = Path(args.output).resolve()
    edges = load_edges(Path(args.edge_shard).resolve() if args.edge_shard else None)
    style_paths = sorted(
        path
        for path in root.rglob("*")
        if path.is_file()
        and path.name.lower().endswith(STYLE_SUFFIXES)
        and "node_modules" not in path.parts
    )

    exact_groups: dict[str, list[str]] = defaultdict(list)
    normalized_groups: dict[str, list[str]] = defaultdict(list)
    block_groups: dict[str, dict[str, Any]] = {}
    media_conditions: Counter[str] = Counter()
    color_values: Counter[str] = Counter()
    dimension_values: Counter[str] = Counter()
    color_files: dict[str, set[str]] = defaultdict(set)
    dimension_files: dict[str, set[str]] = defaultdict(set)
    file_records = []
    directives: Counter[str] = Counter()
    sass_variables: Counter[str] = Counter()
    css_variables: Counter[str] = Counter()
    css_variable_uses: Counter[str] = Counter()
    mixin_defs: Counter[str] = Counter()
    mixin_uses: Counter[str] = Counter()
    specificity_hotspots = []

    for path in style_paths:
        relative = path.relative_to(root).as_posix()
        text = path.read_text(encoding="utf-8", errors="replace")
        stripped = COMMENT.sub("", text)
        exact_groups[sha256_text(text)].append(relative)
        normalized_groups[sha256_text(normalize_text(text))].append(relative)
        media_source = re.sub(r"#\{([^{}]+)\}", r"\1", stripped)
        conditions = [re.sub(r"\s+", " ", item.strip()) for item in MEDIA.findall(media_source)]
        media_conditions.update(conditions)
        colors = [item.lower() for item in HEX.findall(stripped)]
        dimensions = [item.lower() for item in DIMENSION.findall(stripped)]
        color_values.update(colors)
        dimension_values.update(dimensions)
        for value in set(colors):
            color_files[value].add(relative)
        for value in set(dimensions):
            dimension_files[value].add(relative)
        directive_rows = DIRECTIVE.findall(stripped)
        directives.update(kind for kind, _ in directive_rows)
        sass_variables.update(SASS_VAR.findall(stripped))
        css_variables.update(CSS_VAR.findall(stripped))
        css_variable_uses.update(CSS_VAR_USE.findall(stripped))
        mixin_defs.update(MIXIN_DEF.findall(stripped))
        mixin_uses.update(MIXIN_USE.findall(stripped))

        selector_count = 0
        max_specificity = (0, 0, 0)
        max_selector = ""
        repeated_block_count = 0
        for selector_text, body in RULE_BLOCK.findall(stripped):
            if selector_text.lstrip().startswith("@"):
                continue
            for selector in selector_text.split(","):
                selector = re.sub(r"\s+", " ", selector.strip())
                if not selector:
                    continue
                selector_count += 1
                score = specificity(selector)
                if score > max_specificity:
                    max_specificity, max_selector = score, selector
            normalized_body = normalize_block(body)
            if len(normalized_body) >= 32:
                digest = sha256_text(normalized_body)
                group = block_groups.setdefault(
                    digest,
                    {"normalized_declarations": normalized_body, "occurrences": []},
                )
                group["occurrences"].append({"path": relative, "selector": re.sub(r"\s+", " ", selector_text.strip())[:300]})
                repeated_block_count += 1
        if max_specificity >= (1, 3, 0) or max_specificity >= (2, 0, 0):
            specificity_hotspots.append(
                {"path": relative, "selector": max_selector[:300], "specificity": list(max_specificity)}
            )
        first_rule = min(
            (match.start() for match in RULE_BLOCK.finditer(stripped) if not match.group(1).lstrip().startswith("@")),
            default=len(stripped),
        )
        late_directives = [
            {"kind": match.group(1), "line": stripped.count("\n", 0, match.start()) + 1}
            for match in DIRECTIVE.finditer(stripped)
            if match.start() > first_rule
        ]
        file_records.append(
            {
                "path": relative,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "kind": "module" if ".module." in path.name else "global",
                "extension": path.suffix.lower(),
                "lines": len(text.splitlines()),
                "lexical_selector_fragments": selector_count,
                "media_queries": len(conditions),
                "important_declarations": stripped.count("!important"),
                "literal_colors": len(colors),
                "literal_dimensions": len(dimensions),
                "sass_variable_definitions": len(SASS_VAR.findall(stripped)),
                "css_variable_definitions": len(CSS_VAR.findall(stripped)),
                "mixin_definitions": len(MIXIN_DEF.findall(stripped)),
                "mixin_includes": len(MIXIN_USE.findall(stripped)),
                "directives": [{"kind": kind, "target": target.strip()} for kind, target in directive_rows],
                "late_directives": late_directives,
                "static_consumers": sorted(edges.get(relative, set())),
                "parsed_rule_blocks": repeated_block_count,
            }
        )

    duplicate_blocks = [
        {"sha256": digest, **group}
        for digest, group in block_groups.items()
        if len(group["occurrences"]) > 1
    ]
    duplicate_blocks.sort(key=lambda item: (-len(item["occurrences"]), item["sha256"]))
    specificity_hotspots.sort(key=lambda item: (tuple(-x for x in item["specificity"]), item["path"]))
    result = {
        "schema_version": 1,
        "audit_run_id": "REPO-AUDIT-2026-08-09-FROZEN-36536C3",
        "source_ref": "frozen-goal-start-snapshot",
        "summary": {
            "files": len(file_records),
            "modules": sum(1 for row in file_records if row["kind"] == "module"),
            "global": sum(1 for row in file_records if row["kind"] == "global"),
            "extensions": dict(sorted(Counter(row["extension"] for row in file_records).items())),
            "lines": sum(row["lines"] for row in file_records),
            "lexical_selector_fragments": sum(row["lexical_selector_fragments"] for row in file_records),
            "media_queries": sum(row["media_queries"] for row in file_records),
            "important_declarations": sum(row["important_declarations"] for row in file_records),
            "literal_color_occurrences": sum(row["literal_colors"] for row in file_records),
            "literal_dimension_occurrences": sum(row["literal_dimensions"] for row in file_records),
            "directives": dict(sorted(directives.items())),
            "sass_variable_definitions": sum(sass_variables.values()),
            "css_variable_definitions": sum(css_variables.values()),
            "css_variable_uses": sum(css_variable_uses.values()),
            "mixin_definitions": sum(mixin_defs.values()),
            "mixin_includes": sum(mixin_uses.values()),
            "late_directives": sum(len(row["late_directives"]) for row in file_records),
            "files_without_static_consumer": sum(1 for row in file_records if not row["static_consumers"]),
        },
        "media_conditions": media_conditions.most_common(),
        "repeated_colors": [
            {"value": value, "occurrences": count, "files": sorted(color_files[value])}
            for value, count in color_values.most_common(60)
            if count > 1
        ],
        "repeated_dimensions": [
            {"value": value, "occurrences": count, "files": sorted(dimension_files[value])}
            for value, count in dimension_values.most_common(80)
            if count > 1
        ],
        "sass_variables": dict(sorted(sass_variables.items())),
        "css_variables": dict(sorted(css_variables.items())),
        "css_variable_uses": dict(sorted(css_variable_uses.items())),
        "mixin_definitions": dict(sorted(mixin_defs.items())),
        "mixin_includes": dict(sorted(mixin_uses.items())),
        "exact_file_duplicates": [paths for paths in exact_groups.values() if len(paths) > 1],
        "normalized_file_duplicates": [paths for paths in normalized_groups.values() if len(paths) > 1],
        "duplicate_rule_blocks": duplicate_blocks[:100],
        "specificity_proxies": {
            "important_declarations": sum(row["important_declarations"] for row in file_records),
            "top_important_files": [
                {"path": row["path"], "important_declarations": row["important_declarations"]}
                for row in sorted(file_records, key=lambda item: (-item["important_declarations"], item["path"]))[:30]
                if row["important_declarations"]
            ],
            "interpretation": "!important is a specificity/layering pressure proxy; nested Sass is not assigned a fabricated computed specificity.",
        },
        "files": file_records,
        "limitations": [
            "Selector parsing is lexical and does not execute Sass nesting or interpolation.",
            "No computed-specificity claim is made from nested Sass; !important counts are retained as a bounded layering-pressure proxy.",
            "Static consumer absence is discovery evidence only; runtime/CMS/D3/string-built classes can be valid consumers.",
            "Repeated values and rule blocks are metrics, not automatic consolidation recommendations.",
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "summary": result["summary"]}, indent=2))


if __name__ == "__main__":
    main()
