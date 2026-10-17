# Summarizes evidence/<dir>/*.json (vitest JSON reports) into evidence/<dir>-summary.txt. Run: python3 -I harness/summarize.py <dir>
import json, glob, os, sys
here = os.path.dirname(os.path.abspath(__file__)); review = os.path.dirname(here); name = sys.argv[1]
manifest = json.load(open(os.path.join(review, "mutants", "mutants-manifest.json")))
lines = [f"# {name}: per-mutant results (vitest JSON reports in evidence/{name}/)", ""]
for mutant in manifest:
    d = json.load(open(os.path.join(review, "evidence", name, f"{mutant}.json")))
    failed = d["numFailedTests"]; total = d["numTotalTests"]
    verdict = "SURVIVED" if failed == 0 else "KILLED"
    lines.append(f"{mutant:24} {verdict:8} {failed}/{total} failed  sha256 {manifest[mutant]['sha256'][:16]}  — {manifest[mutant]['description']}")
    for tr in d["testResults"]:
        for a in tr["assertionResults"]:
            if a["status"] != "passed":
                msg = (a.get("failureMessages") or [""])[0].split("\n")[0].replace("\x1b[90m", "")[:140]
                lines.append(f"    x {a['title'][:90]}\n        {msg}")
open(os.path.join(review, "evidence", f"{name}-summary.txt"), "w").write("\n".join(lines) + "\n")
print("\n".join(lines))
