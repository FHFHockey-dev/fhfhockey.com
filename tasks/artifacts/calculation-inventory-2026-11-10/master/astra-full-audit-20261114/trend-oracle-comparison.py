"""Compare retained oracle metadata only; never imports/runs the application."""
import json
import subprocess
from pathlib import Path

BEFORE = "bbb85af7b^"
AFTER = "29451c57304866d54abd2a3302625f0696472ab0"
PREFIX = "web/lib/projections/pregameCapture/__fixtures__/world/oracle/"

def blob(pin, path):
    return json.loads(subprocess.check_output(["git", "show", f"{pin}:{path}"]))

def inspect(a, b, path, changes):
    assert type(a) is type(b), path
    if isinstance(a, dict):
        assert a.keys() == b.keys(), path
        for key in a:
            inspect(a[key], b[key], path + [key], changes)
    elif isinstance(a, list):
        assert len(a) == len(b), path
        for i, (old, new) in enumerate(zip(a, b)):
            if old == new:
                continue
            if path[-1:] == ["reads"]:
                old_source, new_source = old["request"][0], new["request"][0]
                allowed = ((old_source["method"], old_source["args"][0], new_source["method"], new_source["args"][0])
                           == ("from", "sustainability_trend_bands", "rpc", "forge_latest_trend_bands"))
                resumed = old_source == new_source and old_source["args"][0] == "forge_runs"
                assert allowed or resumed, (path, i)
                changes.append({"path": path + [i], "kind": "trend_read" if allowed else "resumed_forge_runs_read"})
            elif path[-1:] == ["writes"]:
                assert old["table"] == new["table"] == "forge_runs", (path, i)
                assert old.keys() == new.keys() == {"table", "hash"}, (path, i)
                changes.append({"path": path + [i], "kind": "forge_runs_write_hash"})
            else:
                inspect(old, new, path + [i], changes)
    else:
        assert a == b, (path, a, b)

files = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", AFTER, "--", PREFIX], text=True).splitlines()
results = []
for name in files:
    changes = []
    inspect(blob(BEFORE, name), blob(AFTER, name), [], changes)
    results.append({"file": name, "changes": changes})
assert len(results) == 14
out = {"passed": True, "before": subprocess.check_output(["git", "rev-parse", BEFORE], text=True).strip(), "after": AFTER,
       "files": results, "boundary": "All retained fields other than listed read entries and forge_runs hashes are exactly unchanged. Full write payloads are not retained in these oracles; counter-only payload equivalence is owner-reported, not independently reproduced."}
Path(__file__).with_suffix(".json").write_text(json.dumps(out, indent=2) + "\n")
print(json.dumps({"passed": True, "files": len(results), "changes": sum(len(r["changes"]) for r in results)}))
