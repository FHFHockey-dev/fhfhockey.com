"""Validate patch application, narrow TypeScript and lint without network access."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

OUT = Path(__file__).resolve().parent
REPO = OUT.parents[2]
manifest = json.loads((OUT / "MANIFEST.json").read_text())
ROOT = Path(manifest["fixture"])
WEB = ROOT / "web"
changed = [name for name, pin in manifest["files"].items() if pin["changed"]]
ts_paths = [name.removeprefix("web/") for name in changed if name.endswith(".ts")]
env = {"PATH": os.environ["PATH"], "NODE_ENV": "test", "CI": "1",
       "NODE_OPTIONS": f"--require={WEB / 'no-network.cjs'}"}
checks = {}
def run(label, command, cwd=WEB):
    result = subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True)
    (OUT / f"{label}.log").write_text(result.stdout + result.stderr)
    checks[label] = {"command": command, "exit_code": result.returncode}
    return result.returncode

for name, pin in manifest["files"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == pin["candidate_sha256"], name

with tempfile.TemporaryDirectory(prefix="fhfh-job79-patchcheck-") as target:
    for name in changed:
        dest = Path(target) / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes((OUT / "baseline" / name).read_bytes())
    assert run("patch-check", ["git", "apply", "--check", "--whitespace=error-all", str(OUT / "candidate.patch")], target) == 0
    assert run("patch-apply-fixture", ["git", "apply", str(OUT / "candidate.patch")], target) == 0
    for name in changed:
        assert hashlib.sha256((Path(target) / name).read_bytes()).hexdigest() == manifest["files"][name]["candidate_sha256"], name

(WEB / "tsconfig.offline.json").write_text(json.dumps({"extends": "./tsconfig.json", "include": ts_paths,
    "exclude": ["node_modules"]}, indent=2) + "\n")
config = subprocess.check_output(["git", "show", f"{manifest['base']}:web/eslint.config.mjs"], cwd=REPO)
(WEB / "eslint.config.mjs").write_bytes(config)
lock = Path("/private/tmp/fhfh-heavy.lock")
try:
    lock.mkdir()
except FileExistsError:
    raise SystemExit("Shared check lock is occupied; no check started or lock removed.")
try:
    checks["typecheck_lock"] = "acquired and released by FPI-11.4"
    run("typecheck", ["npm", "exec", "--offline", "--", "tsc", "--noEmit", "-p", "tsconfig.offline.json"])
finally:
    lock.rmdir()
run("lint", ["npm", "exec", "--offline", "--", "eslint", "--config", "eslint.config.mjs"] + ts_paths)
(OUT / "STATIC-CHECKS.json").write_text(json.dumps(checks, indent=2) + "\n")
print(json.dumps(checks, indent=2))
raise SystemExit(int(any(c.get("exit_code", 0) for c in checks.values() if isinstance(c, dict))))
