"""Render the final audit from reviewed ledgers and retained evidence; no app/network execution."""
import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

E = Path(__file__).parent
M = E.parent
ROOT = M.parents[3]
PIN = "89da739cb45d7d572ed59bfa0b209c79c5d99299"
ledger = list(csv.DictReader((M / "ASTRA-FULL-AUDIT-LEDGER-20261114.tsv").open(), delimiter="\t"))
by_path = defaultdict(list)
for r in ledger:
    by_path[r["path"]].append(r)
assert len(by_path) == 1078 and len(ledger) == 112127
assert not any(r["verdict"] == "pending" for r in ledger)
findings = json.loads((E / "finding-catalog.json").read_text())
areas = json.loads((E / "area-accounting-working.json").read_text())
counts = {s: sum(x["severity"] == s for x in findings) for s in ["P0", "P1", "P2"]}

def esc(value):
    if isinstance(value, list):
        value = "; ".join(map(str, value))
    return str(value).replace("|", "&#124;").replace("\n", "<br>")

def table(headers, rows):
    return "\n".join(["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)] +
                     ["| " + " | ".join(esc(x) for x in r) + " |" for r in rows])

def ids(path):
    return sorted({x["id"] for x in findings if path in x["ledger_paths"]})

def report_refs(path):
    reports = sorted({x["primary"]["report"] for x in findings if path in x["ledger_paths"]})
    return "; ".join(f"[{r}](astra-full-audit-20261114/{r})" for r in reports) or "Canonical ledger: exact per-symbol contracts and check limits"

out = [f"""# Astra full audit — 2026-11-14

**Read-only audit report issued. Frozen source coverage is complete; live verification is incomplete. No fixes, releases or general ownership hand-back are approved by this report.**

## Verdict and evidence boundary

All **1,078 scope files** are accounted for: **1,052 audited, 26 wholly no-math, zero pending**, with **296 finding-referenced files** and **112,127 unique ledger rows**. A further **54 retained production runners/guards** were reviewed separately. The consolidated frozen-source/retained-runner register has **417 finding IDs: 242 P1 and 175 P2**. No P0 was established by this audit. These are source/receipt findings, not a claim that 417 defects were observed live. Related implementations keep distinct IDs; this is not a count of independent root causes.

The main audit is pinned to `{PIN}`, range `1cdb1dc8f..89da739cb`. Current checkout changes were not substituted. Claude's later capture work is reviewed separately at exact commits in [successor review](astra-full-audit-20261114/SUCCESSOR-CAPTURE-REVIEW.md): three additional P1 guard findings were routed to Claude. The retained Pilot 3 local cryptographic check passed; current database readback remains unverified.

Release TSV: 988 rows, SHA256 `2a01975517f45f52c73511e8a9ab3d351bc4583d56fff9145ad1f55d192d15c1`; mailbox supplied only a matching prefix. Scope TSV: 1,078 rows, SHA256 `a63d6d510271556999205f6f1971af8b8d647e47600dce69ae0fc5ee387b2b53`; no independent mailbox hash was supplied. TJ directly accepted that checked-in scope with the verification gap recorded. The ownership amendment gives Claude capture precedence now, including overlapping paths; all other §8 obligations remain.

Accept/accept-with-findings below describes the reviewed area at the frozen pin. It does not approve a release, dormant activation, production operation or replacement of previously issued history. **A clean full-audit/live-page acceptance is rejected** because reachable defects and explicit verification gaps remain.

## Verdicts by area
"""]
rows = []
for area, c in areas.items():
    verdict = "accept with findings" if c["finding_files"] else "accept"
    why = f"{c['files']} files; {c['no_math']} no-math; {c['finding_files']} finding-referenced"
    if "test" in area or area == "web/e2e":
        why += "; source assertions reviewed; runtime status is separate"
    rows.append([area, verdict, why])
rows += [
    ["Database", "accept with findings", "58 object contracts reviewed from approved catalog receipts: 31 scoped matches, 27 views strictly unverified; SQL-01–04 remain. No payload correctness certification."],
    ["Scripts and retained runners", "accept with findings", "All named source accounted; unsafe/insufficient guards block affected future runs. Test-only or offline labels do not grant execution authority."],
    ["Historical production actions", "accept with findings", "Approvals/bounds/retained receipts reconciled; absent original readbacks and pacing/approval records remain explicit."],
    ["Live pages", "reject", "Incomplete: only home observed at two widths. Full API-status capture and remaining pages unverified; restart held before any load on possible-write source evidence."],
]
out += [table(["Area", "Verdict", "Reason"], rows), "\n## Findings and decision register\n",
"The following table retains the exact reviewed finding text, including location, checked claim, evidence, wrong result, concrete scenario, suggested correction and affected readers. The severity column is authoritative where an earlier worker paragraph said proposed or used another severity. All main rows refer to the frozen pin above unless their evidence explicitly names an older retained runner. Source review, exact isolated probes, supplied tests read only, and hosted receipts remain distinguished. No suggested correction is authorized yet.\n",
(E / "findings-table.md").read_text(),
"\n### Additional capture findings and superseded item\n",
table(["ID", "Severity / status", "Exact candidate", "Finding and evidence"], [
    ["CAP-294-01", "P1 open", "29451c57304866d54abd2a3302625f0696472ab0", "Declared RPC wait budget unenforced; [full finding and exact probe](astra-full-audit-20261114/capture-294-budget-finding.md)."],
    ["CAP-294-02", "P1 open", "29451c57304866d54abd2a3302625f0696472ab0", "Delayed qualified witness can follow terminal nonqualified closure; [full SQL scenario](astra-full-audit-20261114/capture-294-outcome-finding.md)."],
    ["CAP-SLATE-01", "P1 open", "e0cbb19a8b800d95313b19722816c456baeaf52c", "Queue can dispatch after stop while awaiting load gate; [full finding and exact probe](astra-full-audit-20261114/slate-e0-stop-finding.md)."],
    ["CAP-D462-01", "closed in successor", "d4625ed4 → 29451c573", "Claim clock now sampled after lock. Do not reopen without new evidence."],
    ["CAP-D462-02", "P2 bounded API-input concern", "d4625ed4 / retained successor verifier", "Invalid injected negative fallback accuracy; positive pinned pilot profile and SQL guard contain actual pilot path. [Original evidence](astra-full-audit-20261114/capture-d4625ed4-review.md)."],
]),
"\n## Ledger and checks\n",
"[Canonical ledger](ASTRA-FULL-AUDIT-LEDGER-20261114.tsv) accounts for every scope path and relevant symbol. [Finding catalog](astra-full-audit-20261114/finding-catalog.json) preserves IDs and evidence references. No-math is a whole-file disposition only where all scoped content supports it. Finding-bearing is overlapping, not an additional count.\n\nPerformed: pinned-source reads/hash comparisons, retained source/receipt arithmetic, 51 selected existing Python cases, and the isolated exact-source probes whose receipts are linked by each batch. Local PostgreSQL fixture startup failed on shared-memory permission before server/SQL execution; SQL proof runtime is **blocked**, not passed. Supplied Vitest/E2E sources were reviewed; no full application suite, typecheck, lint or build is claimed for this read-only audit. No application code/test edit occurred. No provider call, cron invocation, production write, push, merge or deployment was made by Astra.\n\nTwo directly approved production catalog batches used 6 + 7 sequential SELECTs, returning 929 + 975 metadata rows; both are exhausted. One approved live health SELECT returned zero other active queries, zero age and zero unknown visibility. One home reload supplied two viewport observations. Restart used **zero** navigations and **zero** health queries. No retry or extra route invocation occurred. The approved private local Pilot 3 check used OpenSSL once successfully, plus independent hash/binding checks; no private packet content was copied into the report.\n",
"\n## Database object table\n",
"`yes` means the exact scoped contract in the readback column, not a whole historical schema or data correctness claim. Function bodies and specified metadata were compared directly; all 27 deparsed views retain `unverified` for exact dependency/type/compiled-tree equivalence. Superseded authorities 88/133/135/134 are resolved against their terminal replacements, not falsely compared to obsolete bodies. Rollbacks were source-reviewed; none was executed.\n"]
one = json.loads((E / "catalog-batch-1/comparison.json").read_text())
two = json.loads((E / "catalog-batch-2/comparison.json").read_text())
dbrows = []
for x in one["objects"]:
    finding = "AFULL-SQL-01" if "goalie_weekly" in x["object"] else "AFULL-SQL-02" if x["object"].endswith("_rates") else "—"
    dbrows.append([x["object"], x["terminal_authority"], x["applied_matches_source"],
                   x["comparison_scope"] + " [receipt](astra-full-audit-20261114/catalog-batch-1/COMPARISON.md)",
                   "Paired SQL proof/rollback source reviewed; runtime blocked; no rollback performed", finding])
for x in two["object_table"]:
    dbrows.append([x["object"], x["migration_row"], x["applied_matches_source"],
                   x["scope"] + " [receipt](astra-full-audit-20261114/catalog-batch-2/COMPARISON.md)", x["rollback"], x["finding_ids"] or "—"])
assert len(dbrows) == 58
out.append(table(["Object", "Migration row", "Applied matches source", "Readback / scope", "Rollback", "Finding IDs"], dbrows))
out.append("\n## Scripts and execution guards\n\nBounds are source findings, not approved run budgets. Linked batch reports contain the full stop/resume/secret-handling analysis. Tests and fixture files are explicitly separated from executable production authority.\n")
script_contracts = {}
for f in sorted(E.glob("batch-scripts-*.md")):
    for line in f.read_text().splitlines():
        if not line.startswith("| "):
            continue
        parts = [v.strip() for v in line.strip().strip("|").split("|")]
        key = parts[0].strip("`")
        if key in {"audit-ctpi-formula", "benchmark-nhl-xg-baselines", "nativeProcessCaptureBootstrap", "nativeProcessCaptureRunner", "compare-xg-adjusted-impact-empty-net", "fit-forge-dispersion", "forge-calendar-execution", "forge-counterfactual-backtest", "import-player-forecast-season-settlement", "qualify-native-players-offline", "train-nhl-xg-baseline", "train-nhl-xg-rebound-heads-offline"}:
            script_contracts[key] = (parts[1:], f.name)
scriptrows = []
for path in sorted(p for p in by_path if p.startswith(("web/scripts/", "modeling/", "supabase/tests/"))):
    stem = Path(path).stem
    if ".test." in path or "/tests/" in path and path.startswith("modeling/"):
        bounds = "Declared fixture/test cases only; assertions stop failures. No whole-suite runtime pass claimed."
        gates = "Test source reviewed; no production execution authority. L15_PG_DSN local-only guard gap is AFULL-TEST-01."
    elif path.startswith("supabase/tests/"):
        bounds = "Exact paired migration fixture/rollback scope; assertions or rollback guards stop. Read per-symbol ledger for object predicates."
        gates = "Disposable local proof only; PostgreSQL runtime blocked. Rollback is a mutation requiring separate approval on any hosted database; never executed here."
    elif stem in script_contracts:
        parts, report = script_contracts[stem]
        bounds, gates = parts[0], "; ".join(parts[1:]) + f" [details](astra-full-audit-20261114/{report})"
    elif path.endswith((".json", ".md")):
        bounds, gates = "Static fixture/document; not an executable.", "No runtime, resume or production authority."
    else:
        bounds = "Model/research harness over supplied season/game/export scope; no general production read or run budget established by this audit."
        gates = "Exact entry points, admissions, stops and output behavior are enumerated in the canonical ledger and modeling batches; do not infer resume safety or fit/publish approval. " + report_refs(path)
    scriptrows.append([path, bounds, gates, ids(path) or "—"])
for r in csv.DictReader((E / "production-runner-safety.tsv").open(), delimiter="\t"):
    scriptrows.append([r["path"], r["bounds_stops"], r["write_gate"] + "; " + r["resume_readback"] + "; " + r["provider_secrets"], r["finding_ids"] or "—"])
assert len(scriptrows) == 124
out.append(table(["Script / fixture", "Bounds and stop rule", "Resume-safe / gated / evidence limit", "Finding IDs"], scriptrows))
out.append("\n## Production-action review\n\nThe following retained-record reconciliation covers the numbered queue, later actions, releases and read-only diagnostics. Approval statements relayed in these records are historical evidence only; they never authorize Astra to repeat an action. Current production state cannot establish missing historical before/after evidence. **Overall verdict: accept with findings; repeat-run approval is withheld.** Each row's limitations are its specific acceptance conditions.\n")
production = (E / "production-action-reconciliation.md").read_text()
production = production[production.index("## Production-action matrix"):]
production = re.sub(r"^## ", "### ", production, flags=re.M)
production_rows = []
production_lines = production.splitlines()
for index, line in enumerate(production_lines):
    if line.startswith("|"):
        if re.match(r"^\|[\s:|-]+$", line):
            line += "---|"
        elif index + 1 < len(production_lines) and re.match(r"^\|[\s:|-]+$", production_lines[index + 1]):
            line += " Review verdict |"
        else:
            line += " accept with findings; retained-record limits apply |"
    production_rows.append(line)
production = "\n".join(production_rows)
out.append(production)
out.append("\n## Live-page table\n\nHome was observed at 1440×900 and 375×812 after one reload. The existing Game Grid console had 503s of unknown age; no fresh Grid request or current outage is asserted. The stricter approved stop rule was honored. The approved restart was then held in source preflight: all signed-in pages mount profile/settings reconciliation that may write; date range calls NHL and Start Chart entitlement checks may call Patreon. `/goalies` also redirects outside the restart's no-redirect budget. `/db` was excluded because mount performs full-table counts. [Holdback evidence](astra-full-audit-20261114/LIVE-RESTART-HOLDBACK.md). No assertion that the earlier home reload made no account write can be established. No further live work is authorized by the unused numerical budget while this stop condition remains.\n")
home = [r for r in csv.DictReader((E / "live-page-plan.tsv").open(), delimiter="\t") if r["url"] == "https://fhfhockey.com/"]
remaining = list(csv.DictReader((E / "live-page-restart-plan.tsv").open(), delimiter="\t"))
live = home + remaining
for url, widths, reason in [("https://fhfhockey.com/game-grid", [1440,375], "held: automatic Yahoo startup can call providers and persist account/token state"), ("https://fhfhockey.com/db", [1440], "excluded: full-table counts on load")]:
    for width in widths:
        live.append({"url": url, "width": width, "renders": reason, "console_network": "unverified", "text_scan": "unverified", "math_cross_check": "unverified", "labels": "unverified", "debug_leak": "unverified", "screenshot": "none", "finding_ids": "—"})
live_rows = []
for r in live:
    screenshot = r["screenshot"]
    if screenshot.startswith("pages/"):
        screenshot = f"[image](astra-full-audit-20261114/{screenshot})"
    live_rows.append([r[k] for k in ["url","width","renders","console_network","text_scan","math_cross_check","labels","debug_leak"]] + [screenshot, r["finding_ids"] or "—"])
out.append(table(["URL", "Width", "Renders", "Console/network", "Text scan", "Math cross-check", "Labels", "Debug leak", "Screenshot", "Finding IDs"], live_rows))
out.append("\n## Unverified items and exact next-read proposals\n\nAll proposed batches below are **unapproved and unexecuted**. Each needs TJ's own new decision. Every SQL batch starts with its own one-row health check, then sequential read-only transactions, 5-second statement/1-second lock/15-second idle timeout, no retries. Stop above five other active queries, any older than ten seconds, unknown visibility, error, missing object, mismatched expected row or row-limit sentinel. No application route is an alternative way around those gates.\n")
proposals = [
    ["27 view bindings / strict source equivalence", "[Exact four-query proposal](astra-full-audit-20261114/PROPOSED-catalog-bindings.sql): hygiene1 + rules≤28 + dependencies≤2001 + columns≤2001 =4031 returned-row ceiling; expected27 rules; metadata only.", "Collects dependency/type/compiled-tree evidence. Local compatible PostgreSQL compilation remains needed for an exact source comparison; the read alone will not manufacture equivalence."],
    ["Current changed pg_cron jobs", "[Exact three-query proposal](astra-full-audit-20261114/PROPOSED-cron-state.sql): hygiene1 + jobs283/305/364/388≤5 + latest2 metadata entries each≤8; total14 ceiling. No command/query text or returned payload.", "Confirms current schedule/status, not original approval or historical output correctness. Vercel's 32 frozen cron entries were source-reviewed; current deployment config not fetched."],
    ["Pilot3 current stored equality (D4)", "[Exact two-query hash alternative](astra-full-audit-20261114/PROPOSED-pilot3-hash-readback.sql): hygiene1 + one exact claim/game/policy, limit2 sentinel; hashes/metadata only; hash packet only at≤4MiB, no packet/token/statement bytes returned.", "Separate direct approval needed; local evidence approval does not cover this. This verifies current stored equality against retained hashes, not collection completeness or model quality."],
    ["Current deployed code and seven named flags", "One existing production deployment metadata record for fhfhockey.com, plus only FORGE_RESERVE_PASS_ENABLED, PP_STORED_CALCULATION_WRITES_ENABLED and PP_SHARE_SERVING_ENABLED boolean states, maximum3 entries; no unrelated env values. No build/deploy/request. Remaining four values are code constants and require an exact deployed SHA comparison.", "Needs a separate metadata/env-read decision if requested. No secret values requested. Historical PP writer/serving behavior supports earlier enabling but not the current state."],
    ["Remaining live pages and cross-surface math", "No safe repeat packet is approved. A new packet must resolve automatic profile/settings writes and explicit provider/redirect paths first. The exact previously held URL/viewport list is above; navigation count alone does not authorize side effects.", "A production read cannot replace render evidence. All unobserved pages and full API-status inventories remain unverified."],
    ["Missing historical raw receipts, approvals and timing records", "Recover the exact absent artifacts named in the production-action table (team after-snapshots, original canary ES baseline, original NST admission/timing log and pacing approval). No fresh production query is proposed as a substitute for historical evidence.", "Current rows cannot prove the prior run stayed inside its approved scope. Preserve the gap rather than rerun the writer or infer success from a later state."],
    ["Prevalence of reachable source findings", "No blanket data scan. The report establishes bounded counterexamples; after TJ selects a finding, prepare its exact identity/date/column-limited sample and hygiene batch for a separate decision.", "No P1 is silently promoted to observed-live P0. The audit does not claim current prevalence for every source scenario."],
]
out.append(table(["Unverified item", "Exact bounded next action", "What it would and would not establish"], proposals))
out.append("\n### Frozen flags and reader inventory\n")
out.append("The adjacent [flag inventory](astra-full-audit-20261114/FLAG-INVENTORY.md) lists definitions and direct/helper readers. Current production values are unverified unless explicitly described as historical receipt evidence.\n")
out.append("""
## Blockers for release, rebuild or cron execution

1. Resolve or explicitly accept the relevant P1 findings before releasing their affected paths or operating their writers. In particular, retain unknown/partial coverage, align numerator/denominator populations, bind read scope and ranking cohorts, and correct write completion/resume/deadline guards. Use the exact IDs and counterexamples above; no broad rewrite is authorized.
2. Do not run the three successor capture failure paths unchanged: enforce custody waits, serialize terminal outcomes and witnesses, and recheck queue stop state after awaited gates. Claude owns these overlapping fixes. The approved local pilot proof is not queue-run approval.
3. Do not treat catalog matching, a source-only test review or a retained fixture as proof of current data correctness, applied view bindings, full live-page acceptance, scientific calibration or safe publication. Dormant P2 admission/label/test defects remain blockers before their respective activation or qualification.
4. Preserve closed fixes and issued historical values. Existing closure confirmations and rejected hypotheses remain in the batch reports; this report does not revive them. Subsequent Rankings releases and migrations151/152 are separate owner-reported state, not silent changes to this pin's verdict.
5. Production reads, providers, page loads with possible writes, env changes, migrations, releases, rebuilds and forced/natural cron changes each retain their direct approval gates. No blanket disable, production replay, repair or rollout is requested by this report.

## Decision and hand-back state

Audit findings are ready for TJ's direct fix decision. No findings are implemented by Astra. The 951 return-to-Claude paths and 37 decide-with-TJ paths remain in the original ownership release manifest; a concrete per-path hand-back draft accompanies the decision packet. Audit-created commits on returned app paths: none. Concurrent uncommitted work is preserved and must be handed over explicitly, not staged or reverted by Astra.

Before posting the final ownership hand-back, TJ must decide the 37 shared paths and any selected fix work must be completed. The required hand-back includes sprint records, migration-authority trio, closeout checklist, open findings and unreleased state; Scout retains the one-entry vercel.json and combinedCronInventory.test.ts claims. After posting, Astra stops editing returned paths and waits for Claude's mailbox acknowledgement. This report alone is not that hand-back.
""")
(M / "ASTRA-FULL-AUDIT-20261114.md").write_text("\n\n".join(out))
summary = {"source_pin": PIN, "scope_files": len(by_path), "ledger_rows": len(ledger), "audited": 1052, "no_math": 26, "pending": 0,
           "finding_files": 296, "frozen_and_runner_findings": len(findings), "severities": counts, "database_objects": len(dbrows),
           "script_rows": len(scriptrows), "live_table_rows": len(live_rows), "live_observed": 2, "live_loads": 1,
           "report_sha256": hashlib.sha256((M / "ASTRA-FULL-AUDIT-20261114.md").read_bytes()).hexdigest()}
(E / "REPORT-ACCOUNTING.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary))
