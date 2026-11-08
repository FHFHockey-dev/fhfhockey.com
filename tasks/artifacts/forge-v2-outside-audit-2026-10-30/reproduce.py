#!/usr/bin/env python3
"""Reproduce the five audit failures in a temporary pinned copy; no product edits or DB access."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import tempfile

ARTIFACT = Path(__file__).resolve().parent
REPOSITORY = ARTIFACT.parents[2]
BASE = "18e52a481589a314dc6a67663dd98d1fa8c48454"
CANDIDATE = "988423d385d76ecc2a59efea88d5391784060911"

def git(*args):
    return subprocess.check_output(["git", *args], cwd=REPOSITORY)

def main():
    version = subprocess.check_output(["node", "--version"], text=True).strip()
    if version != "v22.11.0":
        raise SystemExit("Use repository Node 22.11.0; found " + version)
    dependencies = REPOSITORY / "web/node_modules"
    if not (dependencies / "vitest/vitest.mjs").is_file():
        raise SystemExit("Existing web dependencies are required; this runner never installs dependencies.")
    snapshot = Path(tempfile.mkdtemp(prefix="forge-v2-outside-repro-"))
    for name in git("diff", "--name-only", BASE, CANDIDATE).decode().splitlines():
        destination = snapshot / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(git("show", CANDIDATE + ":" + name))
    for name in ["web/vitest.config.mts", "web/__tests__/vitest.setup.js"]:
        destination = snapshot / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(git("show", CANDIDATE + ":" + name))
    (snapshot / "web/node_modules").symlink_to(dependencies, target_is_directory=True)
    tests = []
    for source in sorted((ARTIFACT / "reproductions/web").rglob("outside-*.test.*")):
        relative = source.relative_to(ARTIFACT / "reproductions/web")
        destination = snapshot / "web" / relative
        shutil.copy2(source, destination)
        tests.append(str(relative))
    print("Temporary review snapshot:", snapshot, flush=True)
    lock = Path("/private/tmp/fhfh-heavy.lock")
    try:
        lock.mkdir()
    except FileExistsError:
        raise SystemExit("Shared heavy lock is in use; leave it alone and retry only after its owner releases it.")
    owner = lock / "owner.json"
    owner.write_text(json.dumps({"owner": "forge-v2-outside-audit-reproduction", "pid": os.getpid()}))
    try:
        environment = {k: v for k, v in os.environ.items() if k in {"PATH", "HOME", "TMPDIR", "TMP", "TEMP", "SHELL", "LANG"}}
        environment["NODE_ENV"] = "test"
        command = ["node", str(dependencies / "vitest/vitest.mjs"), "run", *tests, "--maxWorkers=1", "--minWorkers=1"]
        result = subprocess.run(command, cwd=snapshot / "web", env=environment, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        (snapshot / "audit-regressions.log").write_text(result.stdout)
        print(result.stdout)
        print("Expected on reviewed candidate: five failing assertions, exit 1.")
        return result.returncode
    finally:
        owner.unlink()
        lock.rmdir()

if __name__ == "__main__":
    sys.exit(main())
