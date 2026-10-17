"""Generate a review-only patch; never writes to the application or scheduler."""
from pathlib import Path
import difflib
import hashlib
import json

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
candidate = BASE / "candidate"
changes = {}

path = "web/lib/rosterScheduleData/source.ts"
before = (ROOT / path).read_text()
needle = "  signal?: AbortSignal;\n}): Promise<{"
assert before.count(needle) == 1
after = before.replace(needle, "  signal?: AbortSignal;\n  readSchedulePage?: (date: string) => ReturnType<typeof getScheduleDaily>;\n}): Promise<{")
needle = "await getScheduleDaily(cursor, args.signal)"
assert after.count(needle) == 1
after = after.replace(needle, "await (args.readSchedulePage ? args.readSchedulePage(cursor) : getScheduleDaily(cursor, args.signal))")
changes[path] = after

path = "web/lib/cron/cronInventory.ts"
before = (ROOT / path).read_text()
needle = 'const JSON_JOB_ROUTE_ALIASES: Record<string, string> = {\n'
assert before.count(needle) == 1
changes[path] = before.replace(needle, needle + '  "refresh-roster-optimizer-schedule": "/api/v1/db/refresh-roster-optimizer-schedule",\n')

path = "web/pages/api/v1/db/cron-report.ts"
before = (ROOT / path).read_text()
needle = '  "update-roster-optimizer-schedule": [\n'
assert before.count(needle) == 1
after = before.replace(needle, '  "refresh-roster-optimizer-schedule": ["/api/v1/db/refresh-roster-optimizer-schedule"],\n' + needle)
needle = 'const ROUTE_TARGET_TABLE_MAP: Record<string, string> = {\n'
assert after.count(needle) == 1
changes[path] = after.replace(needle, needle + '  "/api/v1/db/refresh-roster-optimizer-schedule": "roster_optimizer_team_games",\n')

for path, content in changes.items():
    target = candidate / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)

paths = sorted(str(path.relative_to(candidate)) for path in candidate.rglob("*.ts"))
patch = []
for path in paths:
    old_path = ROOT / path
    before = old_path.read_text() if old_path.exists() else ""
    after = (candidate / path).read_text()
    patch.extend(difflib.unified_diff(before.splitlines(True), after.splitlines(True),
        fromfile=f"a/{path}" if old_path.exists() else "/dev/null", tofile=f"b/{path}"))
(BASE / "implementation.patch").write_text("".join(patch))

# Activation is intentionally a separate diff. Fill in the real jobid after an
# approved scheduler registration; null does not claim a production job exists.
path = "tasks/TASKS/cron-operations/cron-schedule.md"
before = (ROOT / path).read_text()
entry = json.loads((BASE / "canonical-entry.proposed.json").read_text())
marker = "```json\n[\n"
assert before.count(marker) == 1
after = before.replace(marker, marker + "  " + json.dumps(entry, indent=2).replace("\n", "\n  ") + ",\n", 1)
(BASE / "canonical-register-activation.patch").write_text("".join(difflib.unified_diff(
    before.splitlines(True), after.splitlines(True), fromfile=f"a/{path}", tofile=f"b/{path}")))

evidence_paths = paths + [
    "AGENTS.md", "mise-en-place.md", "web/vercel.json",
    "web/pages/api/v1/db/update-roster-optimizer-schedule.ts",
    "web/lib/rosterScheduleData/refreshGuard.ts", "web/lib/rosterScheduleData/planningInputs.ts",
    "web/lib/rosterScheduleOptimizer/workspace.ts", "web/pages/api/v1/start-chart.ts",
    "tasks/TASKS/cron-operations/cron-schedule.md",
]
hashes = {path: hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
          for path in evidence_paths if (ROOT / path).exists()}
(BASE / "source-bindings.json").write_text(json.dumps({"sourceSha256": hashes,
    "candidateSha256": {path: hashlib.sha256((candidate / path).read_bytes()).hexdigest() for path in paths}}, indent=2) + "\n")
print(f"Prepared {len(paths)} candidate paths; shared files unchanged.")
