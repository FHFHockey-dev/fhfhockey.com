"""Turn blsh_replay.export_v1('2026-11-19') output (one JSON document, read-only) into the export directories the held readers
take, then the operator runs the v6 readback.ts over them (stage 1, stage 2 and the request-context reader).
Recut R' copy of readback_export.py (2026-11-21): the one difference is RUN_DATE, the real UTC day the hosted replay ran (the same
run_date given to arm-replay-get-dated.sql). It is written to context-pins.json as replayCaptureDay, the request-context reader's
independent pin for a replay captured later than the slate's day + 1.
Usage: psql -X -A -t -c "select blsh_replay.export_v1('2026-11-19')" > export.json
       python3 -I readback_export_dated.py export.json OUT_DIR DEPLOYMENT_ID GIT_SHA RUN_DATE
Writes OUT_DIR/{native,context}/{run.json,objects.json,objects/<path>} and OUT_DIR/{pins.json,context-pins.json}."""
import base64, json, re, sys
from pathlib import Path
data, out = json.loads(Path(sys.argv[1]).read_text()), Path(sys.argv[2])
deployment, sha, run_date = sys.argv[3], sys.argv[4], sys.argv[5]
if not re.fullmatch(r"2026-11-2[0-6]", run_date):
    raise SystemExit("RUN_DATE must be the replay's real UTC day, 2026-11-20..2026-11-26")
for part in ("native", "context"):
    block = data.get(part)
    if not block: continue
    d = out / part; (d / "objects").mkdir(parents=True, exist_ok=False)
    (d / "run.json").write_text(json.dumps(block["run"]) + "\n")
    (d / "objects.json").write_text(json.dumps([{k: v for k, v in o.items() if k != "b64"} for o in block["objects"]]) + "\n")
    for o in block["objects"]:
        assert ".." not in o["path"] and o["b64"] is not None, o["path"]
        f = d / "objects" / o["path"]; f.parent.mkdir(parents=True, exist_ok=True); f.write_bytes(base64.b64decode(o["b64"]))
if not data.get("native"):
    raise SystemExit("no native run in the sandbox export")
native = data["native"]["run"]
(out / "pins.json").write_text(json.dumps({"sourceDate": native["source_date"], "runId": native["run_id"], "deploymentId": deployment, "gitCommitSha": sha}) + "\n")
if data.get("context"):
    c = data["context"]["run"]
    (out / "context-pins.json").write_text(json.dumps({"sourceDate": native["source_date"], "nativeRunId": native["run_id"], "nativeManifestSHA256": native["manifest_sha256"],
        "runId": c["run_id"], "manifestSHA256": c["manifest_sha256"], "deploymentId": deployment, "gitCommitSha": sha, "replayCaptureDay": run_date}) + "\n")
print(json.dumps({"native": native["run_id"], "context": (data.get("context") or {}).get("run", {}).get("run_id")}))
