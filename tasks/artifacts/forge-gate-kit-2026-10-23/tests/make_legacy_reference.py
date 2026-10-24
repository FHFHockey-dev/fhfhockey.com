"""Optional offline reference regeneration against the three historical scorer files.

Usage: python3 tests/make_legacy_reference.py /path/to/fhfhockey.com
Reads source code only; generates and scores synthetic fixtures in a temp directory.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from fixtures import write_fixture


def main(repo):
    relative = {
        "score_gate.py": "tasks/artifacts/forge-task2-gate-2026-10-22/score_gate.py",
        "score_pair.py": "tasks/artifacts/forge-task3-gate-2026-10-22/score_pair.py",
        "gate_ci.py": "tasks/artifacts/forge-gate-kit-2026-10-23/gate_ci.py",
        "mz.py": "tasks/artifacts/forge-task4-gate-2026-10-22/mz.py",
    }
    # Pin reads to the delegated baseline, so regeneration also works after installation.
    sources = {name: subprocess.check_output(["git", "show", f"2a5092d37:{path}"], cwd=repo) for name, path in relative.items()}
    result = {"source_commit": "2a5092d37", "sources": {relative[n]: hashlib.sha256(b).hexdigest() for n, b in sources.items()},
              "fixture_sha256": hashlib.sha256(Path(__file__).with_name("fixtures.py").read_bytes()).hexdigest(),
              "pair": {}, "deciles": {}, "ci": {}, "mz": {}}
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        for name, source in sources.items():
            (root / name).write_bytes(source)
        out, base, cand, act, hb = write_fixture(root)
        # Legacy MZ/paired position extraction depends on compact key order. Same data.
        for path in out.glob("*/*.json"):
            path.write_text(json.dumps(json.loads(path.read_text()), separators=(",", ":")))
        def run(name, args):
            return subprocess.check_output([sys.executable, "-B", str(root/name), *map(str, args)], cwd=root, text=True)
        pair = run("score_pair.py", [out, base, cand, act, hb])
        group = None
        for line in pair.splitlines():
            if line.startswith("## "):
                group = line[3:]
                result["pair"][group], result["deciles"][group] = {}, {}
            cells = [c.strip() for c in line.strip("|").split("|")]
            if group and cells[0] in ("G", "A", "PPP", "SOG", "HIT", "BLK", "FP"):
                if len(cells) == 8:
                    result["pair"][group][cells[0]] = cells[1:]
                elif len(cells) == 12:
                    result["deciles"][group].setdefault(cells[0], {})[cells[1]] = cells[2:]
        for v, original in (("va", "f"), ("vc", "candidate")):
            shutil.copytree(out / original, out / v)
        ci = run("gate_ci.py", [root / "score_gate.py", out, act, hb])
        for line in ci.splitlines():
            cells = [c.strip() for c in line.strip("|").split("|")]
            if cells[0] in ("G", "A", "PPP", "SOG", "HIT", "BLK", "FP"):
                v = {"va": "f", "vc": "candidate"}[cells[1]]
                result["ci"].setdefault(cells[0], {})[v] = cells[2:]
        mz = run("mz.py", [out, "f,candidate", act, hb])
        for line in mz.splitlines():
            cells = [c.strip() for c in line.strip("|").split("|")]
            if cells[0] in ("G", "A", "PPP", "SOG", "FP"):
                result["mz"][cells[0]] = cells[1:]
        result["legacy_mz_d_lines"] = [line for line in mz.splitlines() if "D in top" in line]
    Path(__file__).with_name("legacy_reference.json").write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
