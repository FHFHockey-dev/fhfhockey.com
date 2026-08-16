#!/usr/bin/env python3
"""Compare the live source tree with the frozen audit baseline.

The helper reads filesystem metadata, hashes non-secret in-scope files, and
uses bounded local Git metadata. It never reads secret-like file contents,
imports application modules, or accesses network/database services. Outputs
are restricted to the supplied audit directory.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import stat
import subprocess
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AUDIT_RUN_ID = "REPO-AUDIT-2026-08-09-FROZEN-36536C3"
BASELINE_HEAD = "36536c3f1cbf065c34dc0ee5eceec2094e17d858"
BASELINE_MANIFEST_SHA256 = "2634689a5aa2a130be38c50975ea52d038ba85321591ca24981ec3ecf771b56f"
AUDIT_PREFIX = "docs/repository-audit/"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def run_git(repo_root: Path, *args: str) -> bytes:
    git_environment = os.environ.copy()
    git_environment["GIT_OPTIONAL_LOCKS"] = "0"
    return subprocess.run(
        ["git", "-C", str(repo_root), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=git_environment,
    ).stdout


def nul_paths(value: bytes) -> list[str]:
    return [
        item.decode("utf-8", errors="surrogateescape")
        for item in value.split(b"\0")
        if item
    ]


def parse_porcelain(value: bytes) -> dict[str, str]:
    tokens = value.split(b"\0")
    result: dict[str, str] = {}
    index = 0
    while index < len(tokens):
        token = tokens[index]
        index += 1
        if not token:
            continue
        text = token.decode("utf-8", errors="surrogateescape")
        if len(text) < 4:
            continue
        status_code = text[:2]
        path = text[3:]
        result[path] = status_code
        if "R" in status_code or "C" in status_code:
            if index < len(tokens) and tokens[index]:
                old_path = tokens[index].decode(
                    "utf-8", errors="surrogateescape"
                )
                index += 1
                result[old_path] = status_code
    return result


def is_secret_like(relative: str) -> bool:
    lowered_parts = [part.lower() for part in Path(relative).parts]
    basename = lowered_parts[-1] if lowered_parts else ""
    if any(part == ".env" or part.startswith(".env.") for part in lowered_parts):
        return True
    if basename in {".npmrc", ".pypirc", ".netrc", "id_rsa", "id_ed25519"}:
        return True
    return Path(basename).suffix in {".pem", ".key", ".p12", ".pfx"}


def inspect_path(path: Path, allow_content: bool) -> dict[str, Any]:
    info = path.lstat()
    mode = f"{stat.S_IMODE(info.st_mode):04o}"
    if stat.S_ISLNK(info.st_mode):
        kind = "symlink"
        digest = (
            sha256_bytes(
                os.readlink(path).encode("utf-8", errors="surrogateescape")
            )
            if allow_content
            else None
        )
    elif stat.S_ISREG(info.st_mode):
        kind = "file"
        digest = sha256_file(path) if allow_content else None
    else:
        kind = "other"
        digest = None
    return {
        "kind": kind,
        "mode": mode,
        "size_bytes": info.st_size,
        "sha256": digest,
    }


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True, type=Path)
    parser.add_argument("--audit-dir", required=True, type=Path)
    args = parser.parse_args()
    repo_root = args.repo_root.resolve()
    audit_dir = args.audit_dir.resolve()
    if audit_dir != repo_root / "docs/repository-audit":
        raise SystemExit("audit output must be docs/repository-audit")

    manifest_path = audit_dir / "evidence/frozen-source-manifest.jsonl"
    if sha256_file(manifest_path) != BASELINE_MANIFEST_SHA256:
        raise SystemExit("frozen manifest identity mismatch")
    manifest_records = read_jsonl(manifest_path)
    manifest = {record["path"]: record for record in manifest_records}
    if len(manifest) != 3_580:
        raise SystemExit(f"expected 3,580 frozen paths, found {len(manifest)}")

    frozen_baseline = json.loads(
        (audit_dir / "evidence/frozen-baseline.json").read_text(encoding="utf-8")
    )
    baseline_changed = {
        record["path"]: record for record in frozen_baseline["changed_files"]
    }
    live_branch = run_git(repo_root, "branch", "--show-current").decode().strip()
    live_head = run_git(repo_root, "rev-parse", "HEAD").decode().strip()
    porcelain = run_git(
        repo_root, "status", "--porcelain=v1", "-z", "--untracked-files=all"
    )
    porcelain_status = parse_porcelain(porcelain)
    tracked = set(nul_paths(run_git(repo_root, "ls-files", "-z")))
    nonignored_untracked = set(
        nul_paths(
            run_git(
                repo_root,
                "ls-files",
                "--others",
                "--exclude-standard",
                "-z",
            )
        )
    )

    secret_paths = sorted(path for path in manifest if is_secret_like(path))
    changes: list[dict[str, Any]] = []
    deleted: list[dict[str, Any]] = []
    added: list[dict[str, Any]] = []
    compared_nonsecret = 0
    inferred_secret_unchanged = 0

    for relative, baseline in sorted(manifest.items()):
        live_path = repo_root / relative
        if not live_path.exists() and not live_path.is_symlink():
            record = {
                "change_kind": "deleted",
                "path": relative,
                "baseline_sha256": None if is_secret_like(relative) else baseline["sha256"],
                "live_sha256": None,
                "content_handling": "metadata_only_secret_safety" if is_secret_like(relative) else "hash_compared",
            }
            deleted.append(record)
            continue
        if is_secret_like(relative):
            live = inspect_path(live_path, allow_content=False)
            baseline_was_changed = relative in baseline_changed
            live_is_changed = relative in porcelain_status
            if (
                live_head == BASELINE_HEAD
                and not baseline_was_changed
                and not live_is_changed
                and live["kind"] == baseline["kind"]
                and live["mode"] == baseline["mode"]
                and live["size_bytes"] == baseline["size_bytes"]
            ):
                inferred_secret_unchanged += 1
                continue
            changes.append(
                {
                    "change_kind": "modified_or_unverifiable_secret_path",
                    "path": relative,
                    "baseline_sha256": None,
                    "live_sha256": None,
                    "baseline_mode": baseline["mode"],
                    "live_mode": live["mode"],
                    "content_handling": "metadata_only_secret_safety",
                    "status_code": porcelain_status.get(relative),
                }
            )
            continue

        live = inspect_path(live_path, allow_content=True)
        compared_nonsecret += 1
        if (
            live["kind"] != baseline["kind"]
            or live["mode"] != baseline["mode"]
            or live["sha256"] != baseline["sha256"]
        ):
            changes.append(
                {
                    "change_kind": "modified",
                    "path": relative,
                    "baseline_sha256": baseline["sha256"],
                    "live_sha256": live["sha256"],
                    "baseline_mode": baseline["mode"],
                    "live_mode": live["mode"],
                    "content_handling": "hash_compared",
                    "status_code": porcelain_status.get(relative),
                }
            )

    live_source_paths = {
        path
        for path in tracked | nonignored_untracked
        if not path.startswith(AUDIT_PREFIX)
    }
    for relative in sorted(live_source_paths - set(manifest)):
        live_path = repo_root / relative
        secret = is_secret_like(relative)
        live = inspect_path(live_path, allow_content=not secret)
        added.append(
            {
                "change_kind": "added",
                "path": relative,
                "baseline_sha256": None,
                "live_sha256": live["sha256"],
                "live_mode": live["mode"],
                "content_handling": "metadata_only_secret_safety" if secret else "hash_compared",
                "status_code": porcelain_status.get(relative),
                "git_membership": "tracked" if relative in tracked else "nonignored_untracked",
            }
        )

    # Convert exact-content delete/add pairs into deterministic rename records.
    added_by_hash: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in added:
        if record.get("live_sha256"):
            added_by_hash[record["live_sha256"]].append(record)
    remaining_deleted: list[dict[str, Any]] = []
    consumed_added_ids: set[int] = set()
    for old in deleted:
        digest = old.get("baseline_sha256")
        candidates = [
            item for item in added_by_hash.get(digest, []) if id(item) not in consumed_added_ids
        ]
        if len(candidates) == 1:
            new = candidates[0]
            consumed_added_ids.add(id(new))
            changes.append(
                {
                    "change_kind": "renamed",
                    "old_path": old["path"],
                    "new_path": new["path"],
                    "baseline_sha256": digest,
                    "live_sha256": new["live_sha256"],
                    "content_handling": "exact_hash_pair",
                    "status_code": new.get("status_code"),
                }
            )
        else:
            remaining_deleted.append(old)
    changes.extend(remaining_deleted)
    changes.extend(item for item in added if id(item) not in consumed_added_ids)
    changes.sort(key=lambda item: (item["change_kind"], item.get("path") or item.get("old_path", "")))

    audit_files = sorted(
        path.relative_to(repo_root).as_posix()
        for path in audit_dir.rglob("*")
        if path.is_file()
    )
    counts = Counter(record["change_kind"] for record in changes)
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    summary = {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "record_id": "DRIFT-0000",
        "record_type": "live_drift_summary",
        "compared_at": now,
        "frozen_branch": frozen_baseline["branch"],
        "frozen_head": frozen_baseline["head"],
        "live_branch": live_branch,
        "live_head": live_head,
        "frozen_files": len(manifest),
        "fully_hash_compared_nonsecret_paths": compared_nonsecret,
        "secret_like_paths_metadata_only": secret_paths,
        "secret_like_paths_unchanged_inferred_from_same_head_clean_status_and_metadata": inferred_secret_unchanged,
        "post_baseline_source_drift_records": len(changes),
        "post_baseline_source_drift_counts": dict(sorted(counts.items())),
        "audit_package_files_excluded_as_expected_additions": len(audit_files),
        "porcelain_receipt_sha256": sha256_bytes(porcelain),
        "conclusion": (
            "No post-baseline source drift detected; audit-package additions are separate."
            if not changes
            else "Post-baseline source drift is listed separately and was not incorporated into the frozen audit."
        ),
    }
    drift_records = [summary]
    for index, change in enumerate(changes, 1):
        drift_records.append(
            {
                "schema_version": 1,
                "audit_run_id": AUDIT_RUN_ID,
                "record_id": f"DRIFT-{index:04d}",
                "record_type": "post_baseline_source_drift",
                "compared_at": now,
                "not_part_of_frozen_audit": True,
                **change,
            }
        )
    drift_path = audit_dir / "evidence/live-worktree-drift.jsonl"
    drift_path.write_text(
        "".join(
            json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n"
            for record in drift_records
        ),
        encoding="utf-8",
    )

    user_change_results = []
    for relative, baseline_change in sorted(baseline_changed.items()):
        live_path = repo_root / relative
        live = inspect_path(live_path, allow_content=True)
        user_change_results.append(
            {
                "path": relative,
                "baseline_worktree_sha256": baseline_change["worktree_sha256"],
                "live_sha256": live["sha256"],
                "unchanged_since_freeze": live["sha256"] == baseline_change["worktree_sha256"],
            }
        )

    receipt = {
        "schema_version": 1,
        "audit_run_id": AUDIT_RUN_ID,
        "record_type": "source_and_drift_integrity_receipt",
        "created_at": now,
        "frozen_source_authority": {
            "branch": frozen_baseline["branch"],
            "head": frozen_baseline["head"],
            "file_count": len(manifest),
            "manifest_sha256": BASELINE_MANIFEST_SHA256,
        },
        "live_repository": {
            "branch": live_branch,
            "head": live_head,
            "source_drift_records": len(changes),
            "audit_package_files": len(audit_files),
            "nonignored_untracked_source_paths": len(
                [path for path in nonignored_untracked if not path.startswith(AUDIT_PREFIX)]
            ),
        },
        "comparison": {
            "fully_hash_compared_nonsecret_paths": compared_nonsecret,
            "secret_like_paths_metadata_only": len(secret_paths),
            "secret_values_opened_or_printed": False,
            "post_baseline_changes_incorporated_into_audit": False,
        },
        "pre_existing_user_changes": user_change_results,
        "live_drift_ledger": "evidence/live-worktree-drift.jsonl",
    }
    (audit_dir / "evidence/source-and-drift-integrity.json").write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "result": "passed",
                "post_baseline_source_drift_records": len(changes),
                "post_baseline_source_drift_counts": dict(sorted(counts.items())),
                "fully_hash_compared_nonsecret_paths": compared_nonsecret,
                "secret_like_paths_metadata_only": len(secret_paths),
                "audit_package_files": len(audit_files),
                "pre_existing_user_changes_unchanged": all(
                    item["unchanged_since_freeze"] for item in user_change_results
                ),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
