"""Run pinned offline fixtures. Network calls throw; no ignored env files load."""
import json
import os
from pathlib import Path
import subprocess
import sys

OUT = Path(__file__).resolve().parent
ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/fhfh-fpi-11-4-job79")
WEB = ROOT / "web"
env = {"PATH": os.environ["PATH"], "NODE_ENV": "test", "CI": "1",
       "NODE_OPTIONS": f"--require={WEB / 'no-network.cjs'}"}
prefix = ["npm", "test", "--", "--run", "--config", "vitest.offline.config.mts"]
results = {}
def run(label, command):
    result = subprocess.run(command, cwd=WEB, env=env, capture_output=True, text=True)
    (OUT / f"{label}.log").write_text(result.stdout + result.stderr)
    results[label] = {"command": command, "exit_code": result.returncode}
    print(json.dumps({"check": label, "exit_code": result.returncode}), flush=True)
    return result.returncode

# Control: retirement alone must reproduce the pacing regression.
planner = WEB / "lib/cron/nstBurstPlans.ts"
candidate = planner.read_text()
try:
    planner.write_text((OUT / "baseline/web/lib/cron/nstBurstPlans.ts").read_text())
    red = run("retirement-only-red", prefix + ["lib/cron/nstCoordination.test.ts", "-t", "keeps retired job79 clearance advisory"])
finally:
    planner.write_text(candidate)

green = run("candidate-tests", prefix + [
    "lib/cron/nstCoordination.test.ts", "lib/cron/nstBurstPlans.test.ts",
    "lib/cron/nstRateLimitPolicy.test.ts", "lib/nst/requestBudget.test.ts",
    "lib/cron/cronInventory.test.ts", "lib/cron/combinedCronInventory.test.ts",
    "__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts",
])
(OUT / "CHECKS.json").write_text(json.dumps(results, indent=2) + "\n")
raise SystemExit(0 if red != 0 and green == 0 else 1)
