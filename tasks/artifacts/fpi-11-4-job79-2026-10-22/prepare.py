"""Materialize a pinned offline fixture; never edits canonical application files."""
import difflib
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

REPO = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = "6d5664f761132ab479a7febec60548d0fa9ee6ff"
SOURCE = "84cb1229cd1c1cdd037c43e660d2a181304ada51"
ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/fhfh-fpi-11-4-job79")
if ROOT.exists():
    raise SystemExit(f"Refusing to overwrite existing fixture: {ROOT}")

def git_file(ref, name):
    return subprocess.check_output(["git", "show", f"{ref}:{name}"], cwd=REPO).decode()

def write(name, content):
    dest = ROOT / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content)

def replace_once(text, before, after):
    assert text.count(before) == 1, before
    return text.replace(before, after, 1)

def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()

doc = "tasks/TASKS/cron-operations/cron-schedule.md"
base_doc = git_file(BASE, doc)
source_doc = git_file(SOURCE, doc)
def job_block(text, jobid):
    match = re.search(r'  \{\n    "jobid": ' + str(jobid) + r',\n.*?\n  \}', text, re.S)
    assert match
    return match.group()

candidate_doc = replace_once(base_doc, job_block(base_doc, 79), job_block(source_doc, 79))
note79 = source_doc[source_doc.index("-- 2026-10-22: job 79"):source_doc.index("-- 2026-10-17 read-only reconciliation")]
candidate_doc = replace_once(candidate_doc, "# ALL CRON JOBS:", note79 + "# ALL CRON JOBS:")
candidate_doc = replace_once(candidate_doc, "\n]\n```", ",\n" + job_block(source_doc, 399) + "\n]\n```")
applied399 = source_doc[source_doc.index("-- APPLIED 2026-10-22 as job 399"):]
candidate_doc += "\n----------------------------------------------------------------------------------\n" + applied399

changed = {doc: candidate_doc}
coord = "web/lib/cron/nstCoordination.ts"
coord_test = "web/lib/cron/nstCoordination.test.ts"
changed[coord] = git_file(SOURCE, coord)
changed[coord_test] = git_file(SOURCE, coord_test)
changed[coord_test] = replace_once(changed[coord_test], 'describe("nstCoordination", () => {', '''import { resolveNstGamelogRequestPlan } from "./nstBurstPlans";

describe("nstCoordination", () => {
  it("keeps retired job79 clearance advisory while preserving full-job pacing", () => {
    expect(NST_ACTIVE_DIRECT_CRON_STARTS.map((job) => job.jobName)).not.toContain("update-nst-gamelog");
    expect(getNstCronBurstClearance("update-nst-gamelog").allowed).toBe(false);
    expect(resolveNstGamelogRequestPlan({ queuedDates: 1, requestCount: 20 }))
      .toMatchObject({ burstAllowed: true, requestIntervalMs: 0 });
    expect(resolveNstGamelogRequestPlan({ queuedDates: 2, requestCount: 40 }))
      .toMatchObject({ burstAllowed: false, requestIntervalMs: 21_000 });
  });''')

plans = "web/lib/cron/nstBurstPlans.ts"
marker = "export function resolveNstGamelogRequestPlan("
# Transfer the shared advisory planner from e89's lineage, preserving the
# release branch's gamelog adapter and returned diagnostic fields.
changed[plans] = git_file(SOURCE, plans).split(marker)[0] + marker + git_file(BASE, plans).split(marker)[1]
for name in ["web/lib/cron/nstBurstPlans.test.ts", "web/lib/cron/nstRateLimitPolicy.ts", "web/lib/cron/nstRateLimitPolicy.test.ts"]:
    changed[name] = git_file(SOURCE, name)

combined_test = "web/lib/cron/combinedCronInventory.test.ts"
changed[combined_test] = replace_once(git_file(BASE, combined_test),
    '    expect(inventory.jobs).toHaveLength(86);', '''    expect(inventory.jobs).toHaveLength(86);
    // Isolated job79/job399 overlay: one retired, one added; other records unchanged.
    expect(inventory.jobs.some((job) => job.provider === "pg_cron" && job.name === "update-nst-gamelog")).toBe(false);
    expect(inventory.jobs).toContainEqual(expect.objectContaining({
      provider: "pg_cron", name: "route-runner-tick",
      routePath: "/api/v1/db/route-runner-tick", normalizedCronExpression: "* * * * *",
    }));''')
audit_test = "web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts"
changed[audit_test] = replace_once(git_file(BASE, audit_test), '      "/api/v1/db/update-nst-gamelog",\n', "")
changed[audit_test] = replace_once(changed[audit_test], '      "cron-only": 26,', '      "cron-only": 27,')
changed[audit_test] = replace_once(changed[audit_test], '      "internal-server": 12,', '      "internal-server": 11,')

fixture_files = set(changed) | {
    "web/lib/cron/nstClassification.ts", "web/lib/cron/nstRateLimitPolicy.test.ts",
    "web/lib/cron/cronInventory.ts", "web/lib/cron/cronInventory.test.ts",
    "web/lib/cron/combinedCronInventory.ts", "web/lib/cron/cronAuditCoverage.ts",
    "web/lib/rollingForgePipeline.ts", "web/lib/rollingPlayerOperationalPolicy.ts",
    "web/lib/nst/requestBudget.ts", "web/lib/nst/requestBudget.test.ts",
    "web/vercel.json", "web/package.json", "web/tsconfig.json",
    "supabase/migrations/20260730091500_consolidate_scheduler_ownership.sql",
}
# Audit coverage tests read public source text; they never execute these routes.
rows = json.loads(re.search(r"```json\s*(\[.*?\])\s*```", candidate_doc, re.S).group(1))
coverage_source = git_file(BASE, "web/lib/cron/cronAuditCoverage.ts")
fixture_files.update(re.findall(r'"(web/[^"\n]+\.(?:ts|tsx))"', coverage_source))
for row in rows:
    route = row.get("route")
    if not row.get("active", True) or not route:
        continue
    stem = "web/pages" + route.split("?")[0]
    for suffix in [".ts", ".tsx", "/index.ts", "/index.tsx"]:
        check = subprocess.run(["git", "cat-file", "-e", f"{BASE}:{stem}{suffix}"], cwd=REPO, capture_output=True)
        if check.returncode == 0:
            fixture_files.add(stem + suffix)
            break

pins = {}
patch = []
for name in sorted(fixture_files):
    original = git_file(BASE, name)
    candidate = changed.get(name, original)
    write(name, candidate)
    pins[name] = {"base_sha256": digest(original), "candidate_sha256": digest(candidate), "changed": candidate != original}
    if name in changed:
        patch.append(f"diff --git a/{name} b/{name}\n")
        patch.extend(difflib.unified_diff(original.splitlines(True), candidate.splitlines(True), fromfile=f"a/{name}", tofile=f"b/{name}"))
        (OUT / "baseline" / name).parent.mkdir(parents=True, exist_ok=True)
        (OUT / "baseline" / name).write_text(original)

(ROOT / "web/node_modules").symlink_to(REPO / "web/node_modules", target_is_directory=True)
write("web/vitest.offline.config.mts", '''import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ resolve: { alias: { lib: path.resolve("lib") } },
  test: { environment: "node", maxWorkers: 1, fileParallelism: false,
    setupFiles: ["./offline.setup.ts"] } });
''')
write("web/offline.setup.ts", '''globalThis.fetch = async () => { throw new Error("Offline fixture forbids network requests"); };
''')
write("web/no-network.cjs", '''const deny = () => { throw new Error("Offline fixture forbids network connections"); };
require("node:net").Socket.prototype.connect = deny;
require("node:http").request = require("node:http").get = deny;
require("node:https").request = require("node:https").get = deny;
globalThis.fetch = deny;
''')
patch_text = "".join(patch)
(OUT / "candidate.patch").write_text(patch_text)
(OUT / "MANIFEST.json").write_text(json.dumps({"base": BASE, "source": SOURCE,
    "advisory_source": "e89dfdde58d2ce848947ab493710237223dcd440", "fixture": str(ROOT),
    "candidate_patch_sha256": digest(patch_text), "files": pins}, indent=2) + "\n")
print(json.dumps({"fixture": str(ROOT), "files": len(pins), "changed": sum(p["changed"] for p in pins.values()), "patch_sha256": digest(patch_text)}))
