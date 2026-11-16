"""Prepare an ownership decision packet, not a hand-back or Git mutation."""
import csv
import hashlib
import json
import subprocess
from collections import defaultdict
from pathlib import Path

E = Path(__file__).parent
ROOT = E.parents[4]
M = E.parent

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True)

release_path = ROOT / "tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/fix-sprint/CLAUDE-OWNERSHIP-RELEASE-TO-ASTRA-20261114.tsv"
released = list(csv.DictReader(release_path.open(), delimiter="\t"))
assert len(released) == 988
head, master = git("rev-parse", "HEAD").strip(), git("rev-parse", "master").strip()
dirty = set(git("diff", "--name-only").splitlines()) | set(git("diff", "--cached", "--name-only").splitlines())
diff_master = set(git("diff", "--name-only", master, head).splitlines())
evidence = defaultdict(set)
for r in csv.DictReader((M / "ASTRA-FULL-AUDIT-LEDGER-20261114.tsv").open(), delimiter="\t"):
    evidence[r["path"]].add(r["test_that_pins_it"])
(E / "HANDBACK-PATH-EVIDENCE.json").write_text(json.dumps({p: sorted(v) for p,v in evidence.items()}, indent=2) + "\n")

rows = []
for r in released:
    path = r["path"]
    state = "clean at snapshot"
    if path in dirty:
        state = "PRESERVE AND EXPLICITLY TRANSFER: concurrent dirty diff; Astra made no app edit"
    rows.append({"path": path, "original_rule": r["hand_back_rule"], "proposed_owner": "Claude; TJ decision pending" if r["hand_back_rule"] == "decide with TJ" else "Claude; hand-back not yet posted",
                 "astra_audit_commits": "none", "uncommitted_changes": state,
                 "checks": "Source audited at 89da739cb; exact per-path test/oracle descriptions in HANDBACK-PATH-EVIDENCE.json (distinguishes run, source-only, and proposed checks); no new app suite claimed",
                 "local_release_comparison": "differs from local master; release/deployment status not inferred" if path in diff_master else "same bytes as local master; hosted SHA not reverified",
                 "open_findings": ",".join(sorted({x["id"] for x in json.loads((E / 'finding-catalog.json').read_text()) if path in x['ledger_paths']}))})
with (E / "HANDBACK-PATHS-DRAFT.tsv").open("w") as f:
    w = csv.DictWriter(f, rows[0].keys(), delimiter="\t"); w.writeheader(); w.writerows(rows)
shared = [r for r in released if r["hand_back_rule"] == "decide with TJ"]
assert len(shared) == 37
packet = ["# Ownership decision packet — draft, no hand-back posted", "",
          f"Snapshot HEAD `{head}`, local master `{master}`. No Astra application commits or fixes. The frozen audit remains at 89da739cb.", "",
          "TJ must decide these 37 shared paths before the required general hand-back. Proposed disposition: return all 37 to Claude, together with the 951 mandatory return paths. Choosing a different split does not revoke Claude's already-authorized capture precedence.", "",
          "| # | Shared path | Proposed disposition |", "|---:|---|---|"]
packet += [f"| {i} | `{r['path']}` | Return to Claude, subject to TJ |" for i,r in enumerate(shared, 1)]
packet += ["", "## Per-path accounting and concurrent work", "",
           "[988-row draft](HANDBACK-PATHS-DRAFT.tsv) gives audit commits, dirty state, per-path check evidence, local-master comparison and open findings. [Detailed evidence](HANDBACK-PATH-EVIDENCE.json) preserves the ledger's run/source-only/proposed-test distinctions; it is not a claim that every named test ran.", "",
           "Dirty returned application paths at this snapshot:"]
packet += [f"- `{p}` — concurrent work preserved; transfer explicitly, do not stage or revert." for p in sorted(dirty & {r['path'] for r in released})]
packet += ["", "The rebuild-score handler/test changes were specifically retained at TJ's direction in Claude's mailbox. They add failure metadata and do not fix partial-write atomicity. `web/next-env.d.ts` and unrelated Claude diaries/lease/mailbox changes remain untouched. No dirty path is represented as clean.", "",
           "## Records and work to return", "",
           "- `tasks/artifacts/calculation-inventory-2026-11-10/master/**`, including the audit report, ledger, local evidence and open finding register. Audit records remain local/uncommitted and are to be transferred explicitly as such; no audit commit or release is claimed.",
           "- `tasks/TASKS/repository-audit-remediation/migration-authority.json`.",
           "- `web/lib/supabase/supportedBaselineMigration.test.ts` (also one of the 37 shared paths; capture precedence already applies to its capture count pin).",
           "- `tasks/TASKS/super-goal/super-goal-final-summary.md`.",
           "- `tasks/tasks-fix-sprint-closeout-2026-11-13.md` and every open work item transferred by the release, plus this audit's unresolved findings/gates.",
           "- Scout retains the one-entry `web/vercel.json` and `web/lib/cron/combinedCronInventory.test.ts` claims; other pre-existing Codex ownership excluded from the release is unchanged.", "",
           "Production reads/restarts, migrations, deployments, rebuilds and capture execution remain separate direct-TJ approvals. Later capture commits are not a general hand-back; future policy installation is not approved. After TJ's fix/shared-path decisions and any approved fixes, post the required mailbox hand-back, stop editing all returned paths, then await Claude's acknowledgement."]
(E / "OWNERSHIP-DECISION-PACKET.md").write_text("\n".join(packet) + "\n")
(E / "HANDBACK-SNAPSHOT.json").write_text(json.dumps({"head":head,"master":master,"paths":988,"mandatory_return":951,"shared_pending":37,"dirty_returned":[r['path'] for r in rows if r['path'] in dirty],"posted":False},indent=2)+"\n")
print(json.dumps({"paths":len(rows),"shared":len(shared),"dirty_returned":[r['path'] for r in rows if r['path'] in dirty],"posted":False}))
