#!/usr/bin/env python3
"""Verify/extract R2's pinned source; rerun its unchanged combined regression.

Requires existing Node 22.11.0/npm dependencies. Does not install or contact services.
The retained R2 candidate currently exits 1 on the known goalie-cache receipt failure.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument("--dependencies", required=True, type=Path)
parser.add_argument("--check-only", action="store_true")
args = parser.parse_args()
packet = Path(__file__).resolve().parent
pins = json.loads((packet / "SOURCE-PINS.json").read_text())["files"]
integrity = json.loads((packet / "INTEGRITY.json").read_text())
archive = packet / "combined-source.tar.gz"
digest = lambda value: hashlib.sha256(value).hexdigest()
assert digest(archive.read_bytes()) == integrity["sourceArchiveSha256"]
assert digest((packet / "SOURCE-PINS.json").read_bytes()) == integrity["sourceManifestSha256"]
with tarfile.open(archive) as source:
    actual = {member.name: digest(source.extractfile(member).read()) for member in source.getmembers()}
    assert actual == pins, "Archive and manifest differ"
    snapshot = Path(tempfile.mkdtemp(prefix="fhfh-task2-r2-verify-"))
    source.extractall(snapshot, filter="data")
assert all(digest((snapshot / name).read_bytes()) == pin for name, pin in pins.items())
dependencies = args.dependencies.resolve(strict=True)
assert (dependencies / ".bin/vitest").is_file()
assert digest((dependencies.parent / "package-lock.json").read_bytes()) == pins["web/package-lock.json"]
node = shutil.which("node")
npm = shutil.which("npm")
assert node and npm
assert subprocess.check_output([node, "--version"], text=True).strip() == "v22.11.0"
os.symlink(dependencies, snapshot / "web/node_modules")
print(f"Verified {len(pins)} pinned files in {snapshot}", flush=True)
if args.check_only:
    raise SystemExit(0)
environment = {
    "PATH": f"{snapshot / 'verification/bin'}:{Path(node).parent}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    "TMPDIR": tempfile.gettempdir(), "CI": "true", "NODE_ENV": "test", "NO_COLOR": "1",
    "NODE_OPTIONS": f"--require={snapshot / 'verification/network-fence.cjs'}",
}
command = json.loads((packet / "COMBINED-COMMAND.json").read_text())["argv"]
command[0] = npm
result = subprocess.run(command, cwd=snapshot / "web", env=environment)
assert all(digest((snapshot / name).read_bytes()) == pin for name, pin in pins.items())
raise SystemExit(result.returncode)
