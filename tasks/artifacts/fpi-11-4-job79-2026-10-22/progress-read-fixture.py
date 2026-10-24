"""Synthetic semantics only: not SQL execution, EXPLAIN, or runtime proof."""
from datetime import datetime, timedelta, timezone
import json

now = datetime(2026, 10, 22, 16, tzinfo=timezone.utc)
def row(age, *, scope="scope-A", job="update-nst-gamelog", status="success", blocked=False):
    return {"run_time": now - timedelta(hours=age), "job_name": job, "status": status,
            "details": {"nstProgress": {"scope": scope, "continuation": {"nextIndex": 20, "blocked": blocked}},
                        "unrelated_details": "synthetic-payload"}}

def lookup(rows, cutoff=None, success_only=False):
    matches = [r for r in rows if r["job_name"] == "update-nst-gamelog"
               and r["details"]["nstProgress"]["scope"] == "scope-A"
               and (cutoff is None or r["run_time"] >= cutoff)
               and (not success_only or r["status"] == "success")]
    return sorted(matches, key=lambda r: r["run_time"], reverse=True)[:2]

checks = []
def check(name, assertion):
    assert assertion, name
    checks.append(name)

rows = [row(3), row(1, status="failed", blocked=True), row(0, scope="scope-B"), row(0, job="another-job")]
found = lookup(rows)
check("job and exact scope exclude newer unrelated receipts", len(found) == 2 and found[0]["run_time"] == now - timedelta(hours=1))
check("latest failed/blocked receipt must remain visible", found[0]["details"]["nstProgress"]["continuation"]["blocked"])
check("success-only filter wrongly selects older acknowledgement", not lookup(rows, success_only=True)[0]["details"]["nstProgress"]["continuation"]["blocked"])
old = [row(100)]
check("unbounded explicit scope retains old acknowledgement", len(lookup(old)) == 1)
check("arbitrary TTL removes explicit acknowledgement", lookup(old, now - timedelta(hours=24)) == [])
tied = lookup([row(1), row(1, status="failed", blocked=True), row(2)])
check("two newest preserve ambiguity signal", len(tied) == 2 and tied[0]["run_time"] == tied[1]["run_time"])
projected = [{"run_time": r["run_time"], "nstProgress": r["details"]["nstProgress"]} for r in found]
check("narrow JSON projection preserves needed progress content", all(p["nstProgress"] == r["details"]["nstProgress"] for p, r in zip(projected, found)))
print(json.dumps({"kind": "synthetic semantics; no SQL or runtime calls", "passed": len(checks), "checks": checks}, indent=2))
