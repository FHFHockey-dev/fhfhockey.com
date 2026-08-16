#!/usr/bin/env python3
"""Merge validated JSONL validation receipts into the canonical audit ledger."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--append", required=True)
    args = parser.parse_args()

    base_path = Path(args.base).resolve()
    append_path = Path(args.append).resolve()
    base_records = read_jsonl(base_path)
    append_records = read_jsonl(append_path)
    combined = [*base_records, *append_records]

    ids = [str(record.get("receipt_id", "")) for record in combined]
    if any(not receipt_id for receipt_id in ids):
        raise SystemExit("receipt without receipt_id")
    if len(ids) != len(set(ids)):
        raise SystemExit("duplicate receipt_id")
    if ids != sorted(ids):
        raise SystemExit("receipt IDs are not monotonically ordered")
    run_ids = {record.get("audit_run_id") for record in combined}
    if run_ids != {"REPO-AUDIT-2026-08-09-FROZEN-36536C3"}:
        raise SystemExit(f"unexpected audit_run_id values: {sorted(str(value) for value in run_ids)}")

    temporary = base_path.with_suffix(base_path.suffix + ".merge-tmp")
    temporary.write_text(
        "".join(json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n" for record in combined),
        encoding="utf-8",
    )
    os.replace(temporary, base_path)
    print(json.dumps({"base_records": len(base_records), "appended_records": len(append_records), "total": len(combined)}))


if __name__ == "__main__":
    main()
