#!/usr/bin/env python3
"""Create deterministic, non-overlapping workstream assignments.

Reads only the canonical coverage ledger and writes assignment shards beneath
the audit evidence directory. It does not inspect or execute application code.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit-root", required=True)
    args = parser.parse_args()

    root = Path(args.audit_root).resolve()
    coverage = root / "coverage-ledger.jsonl"
    assignment_root = root / "evidence" / "shards" / "assignments"
    assignment_root.mkdir(parents=True, exist_ok=True)

    records = [
        json.loads(line)
        for line in coverage.open(encoding="utf-8")
        if line.strip()
    ]
    owners = sorted({record["owner_workstream"] for record in records})
    counts: Counter[str] = Counter()
    seen: set[str] = set()

    for owner in owners:
        path = assignment_root / f"{owner}.jsonl"
        with path.open("w", encoding="utf-8", newline="\n") as out:
            for record in records:
                if record["owner_workstream"] != owner:
                    continue
                file_id = record["file_id"]
                if file_id in seen:
                    raise RuntimeError(f"duplicate assignment: {file_id}")
                seen.add(file_id)
                counts[owner] += 1
                out.write(
                    json.dumps(
                        {
                            "schema_version": 1,
                            "file_id": file_id,
                            "path": record["path"],
                            "baseline_sha256": record["baseline_sha256"],
                            "scope_class": record["scope_class"],
                            "review_depth": record["review_depth"],
                        },
                        ensure_ascii=False,
                        sort_keys=True,
                    )
                    + "\n"
                )

    if len(seen) != len(records):
        raise RuntimeError(
            f"assignment mismatch: assigned={len(seen)} coverage={len(records)}"
        )

    summary = {
        "schema_version": 1,
        "audit_run_id": "REPO-AUDIT-2026-08-09-FROZEN-36536C3",
        "total": len(records),
        "owners": dict(sorted(counts.items())),
        "unassigned": 0,
        "overlap": 0,
    }
    (assignment_root / "summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
