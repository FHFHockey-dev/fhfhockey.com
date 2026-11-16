"""Finalize approved ownership records only. Posting the mailbox remains the final step."""
import csv
import hashlib
import json
import re
import subprocess
from pathlib import Path

E = Path(__file__).parent
M = E.parent
ROOT = E.parents[4]
ENTRY = "CODEX-OWNERSHIP-HANDBACK-TO-CLAUDE-20261115"
APPROVAL = "TJ direct answers to call_99b22e37e7484911a485aaddff3472c2: No Astra fixes; hand findings to Claude. Return all 37 to Claude."

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True)

head = git("rev-parse", "HEAD").strip()
local_master = git("rev-parse", "master").strip()
reported_release = git("rev-parse", "c0c5fe9b2").strip()
dirty = set(git("diff", "--name-only").splitlines()) | set(git("diff", "--cached", "--name-only").splitlines())
release_diff = set(git("diff", "--name-only", reported_release, head).splitlines())
rows = list(csv.DictReader((E / "HANDBACK-PATHS-DRAFT.tsv").open(), delimiter="\t"))
assert len(rows) == 988 and len({r['path'] for r in rows}) == 988
assert sum(r['original_rule']=='decide with TJ' for r in rows) == 37
for r in rows:
    r['owner_at_mailbox_ack'] = 'Claude'
    r.pop('proposed_owner')
    r.pop('local_release_comparison')
    r['uncommitted_changes'] = 'EXPLICITLY TRANSFERRED: concurrent dirty diff preserved; no Astra app edit' if r['path'] in dirty else 'clean at hand-back snapshot'
    r['reported_release_candidate_comparison'] = ('different from #451 candidate; local code not included in that reported release' if r['path'] in release_diff else 'same committed bytes as #451 candidate; fresh hosted verification not performed')
    r['authority'] = 'original mandatory return' if r['original_rule']=='return to Claude' else 'TJ directly chose return to Claude on 2026-11-15'
with (E / 'HANDBACK-PATHS.tsv').open('w') as f:
    w=csv.DictWriter(f,rows[0].keys(),delimiter='\t');w.writeheader();w.writerows(rows)

preserved = {}
for p in ['web/pages/api/v1/sustainability/rebuild-score.ts','web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts','web/next-env.d.ts']:
    preserved[p] = hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
assert preserved['web/pages/api/v1/sustainability/rebuild-score.ts']=='c0d6efca7d0a3732ee3bbe06f824e8a7f77b0b44d36e415f12470874253137c2'
assert preserved['web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts']=='2eac62c899f264df9fc35bb29f8fc24179f8e977de91d03f7804b5569581a561'
assert preserved['web/next-env.d.ts']=='ced3cb1bdbb8082cae388902481ba6a8a1e454ec7daed6125b368118f06e4a77'

packet=E/'OWNERSHIP-DECISION-PACKET.md'
t=packet.read_text().replace('# Ownership decision packet — draft, no hand-back posted','# Ownership decision packet — TJ approved all 37 returns')
t=t.replace("TJ must decide these 37 shared paths before the required general hand-back. Proposed disposition: return all 37 to Claude, together with the 951 mandatory return paths. Choosing a different split does not revoke Claude's already-authorized capture precedence.", "TJ directly chose no Astra fixes and return of all 37 shared paths to Claude on 2026-11-15. Together with the 951 mandatory paths, all 988 return. Codex keeps none of these 37. Claude's capture precedence and Scout's excluded cron claims remain intact.")
t=t.replace('Proposed disposition','Approved disposition').replace('Return to Claude, subject to TJ','Return to Claude — TJ approved')
t=t.replace('[988-row draft](HANDBACK-PATHS-DRAFT.tsv)','[988-row final accounting](HANDBACK-PATHS.tsv)').replace('[record-path inventory](HANDBACK-RECORDS-DRAFT.tsv)','[final record-path inventory](HANDBACK-RECORDS.tsv)')
t=t.replace("After TJ's fix/shared-path decisions and any approved fixes, post the required mailbox hand-back, stop editing all returned paths, then await Claude's acknowledgement.", "The direct decisions are complete; no Astra fixes are authorized. The final mailbox hand-back is the hand-off event; Astra then stops editing returned paths and awaits Claude's acknowledgement.")
t+='\nThe local master ref above predates the audit baseline and is not release authority. Final per-path release comparison uses owner-reported #451 candidate `'+reported_release+'`; current deployment remains unverified.\n'
packet.write_text(t)

report=M/'ASTRA-FULL-AUDIT-20261114.md'
t=report.read_text()
t=t.replace('**Read-only audit report issued. Frozen source coverage is complete; live verification is incomplete. No fixes, releases or general ownership hand-back are approved by this report.**', '**Read-only audit report issued. Frozen source coverage is complete; live verification is incomplete. TJ chose no Astra fixes and return of all 988 paths to Claude. No production action is approved by this report.**')
start=t.index('## Decision and hand-back state')
t=t[:start]+'''## Decision and hand-back state

TJ directly answered the required two decisions on 2026-11-15: **no Astra fixes; hand findings to Claude**, and **return all 37 shared paths to Claude**. All 951 mandatory plus 37 shared paths therefore return; Codex keeps none of these 37. Astra made no application edits or commits. Concurrent uncommitted work is preserved and explicitly transferred.

The [final hand-back](astra-full-audit-20261114/HANDBACK-TO-CLAUDE-20261115.md) and [988-row path accounting](astra-full-audit-20261114/HANDBACK-PATHS.tsv) identify commits, dirty state, checks, reported-release comparison and open findings. Sprint records, the migration-authority trio, closeout checklist and open work return too. Scout retains its one-entry vercel.json and combinedCronInventory.test.ts claims; excluded pre-existing Codex ownership is unchanged.

The mailbox entry `CODEX-OWNERSHIP-HANDBACK-TO-CLAUDE-20261115` is the publication event. Astra stops editing every returned path upon posting. Claude takes ownership back on acknowledgement in `CLAUDE-TO-CODEX.md`; that acknowledgement is external state, not asserted by this report. Incomplete live and production verification transfers as explicit open work, with no new execution authority.
'''
report.write_text(t)
report_hash=hashlib.sha256(report.read_bytes()).hexdigest()
for name in ['REPORT-ACCOUNTING.json','REPORT-VALIDATION.json']:
    p=E/name;a=json.loads(p.read_text());a['report_sha256']=report_hash;a['closure_update']='Direct TJ decisions and hand-back references added; findings unchanged.';p.write_text(json.dumps(a,indent=2)+'\n')

changed_returned=[r['path'] for r in rows if r['path'] in release_diff]
snapshot={'head':head,'local_master':local_master,'reported_release_candidate':reported_release,'reported_release_boundary':'Owner-reported #451, not fresh deployment verification. Local master ref is older than audit pin.',
          'paths':988,'mandatory_return':951,'shared_return':37,'codex_kept_from_shared':[],'approval':APPROVAL,'fixes':'none by TJ decision','audit_app_commits':[],
          'dirty_returned':[r['path'] for r in rows if r['path'] in dirty],'different_from_reported_release':changed_returned,'preserved_working_sha256':preserved,
          'report_sha256':report_hash,'publication_entry':ENTRY,'publication_status':'prepared; mailbox entry is authoritative','acknowledgement':'pending Claude mailbox acknowledgement'}
(E/'HANDBACK-SNAPSHOT.json').write_text(json.dumps(snapshot,indent=2)+'\n')

doc=f'''# Hand-back to Claude — 2026-11-15

Authority: {APPROVAL}

Publication entry: `{ENTRY}` in `tasks/artifacts/cross-platform/2026-10-24-coordination/CODEX-TO-CLAUDE.md`. This package is prepared before that append. Posting ends Astra editing on returned paths; Claude's own acknowledgement in its outbox completes the transfer. No acknowledgement is fabricated here.

## Files, records and work

- **All 988 original release paths return:** 951 mandatory and all 37 shared, with none retained by Codex. [Per-path accounting](HANDBACK-PATHS.tsv); [37-path direct decision](OWNERSHIP-DECISION-PACKET.md).
- Return `tasks/artifacts/calculation-inventory-2026-11-10/master/**`, including all audit findings, source records, production packets and local evidence. [Record-path inventory](HANDBACK-RECORDS.tsv) explicitly transfers uncommitted records in place; no commit/push/deploy is implied.
- Return the authority trio: `tasks/TASKS/repository-audit-remediation/migration-authority.json`, `web/lib/supabase/supportedBaselineMigration.test.ts`, and `tasks/TASKS/super-goal/super-goal-final-summary.md`.
- Return `tasks/tasks-fix-sprint-closeout-2026-11-13.md` and all open work from debrief §§9/12/13, prior adopted proposals and this audit's finding catalog. Existing closed fixes stay closed absent new evidence.
- Scout keeps the one-entry `web/vercel.json` and `web/lib/cron/combinedCronInventory.test.ts` claims. Pre-existing Codex ownership excluded from the 988-row release is unchanged. Claude's capture precedence continues.

## Commits, uncommitted changes and checks

Astra application commits and fixes: **none**. All returned app paths are clean at this snapshot except `web/pages/api/v1/sustainability/rebuild-score.ts`, whose concurrent dirty diff is explicitly handed back unchanged. The accompanying dirty `web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts` is outside the original 988-row manifest; it remains Claude's retained concurrent work and is not overwritten. Generated `web/next-env.d.ts`, other diaries, mailboxes and leases are preserved. Working-file hashes are in [snapshot](HANDBACK-SNAPSHOT.json).

Per-path test/oracle descriptions are retained in [evidence map](HANDBACK-PATH-EVIDENCE.json), including source-only and proposed checks; a proposed test is not a pass. Actual checks and limits are in the report/batch receipts: 51 selected existing Python cases, isolated exact-source probes, catalog metadata comparisons, artifact integrity, and the approved local OpenSSL/hash check. PostgreSQL fixture startup was blocked; full Vitest/E2E/typecheck/lint/build were not run by this read-only audit. Claude's reported successor suites remain owner-reported. No production acceptance is inferred.

## Release and operational state

Snapshot branch `octoberBranch`, HEAD `{head}`. The local master ref `{local_master}` is from November 10 and predates the audit baseline; it is not used to call all paths unreleased. Per-path comparisons use owner-reported #451 candidate `{reported_release}`: **{len(changed_returned)} returned paths differ** in committed bytes. Exact paths are in the snapshot/TSV; dirty changes are additional. This is a local comparison, not a fresh deployed-SHA check.

The separate capture, loader/trend reader and slate work remains distinct from the frozen audit. The mailbox reports migrations150/151/152 applied and notes151/152 authority/migration files only on octoberBranch; Astra does not repeat or independently certify those applies. Preserve existing code and authority records. Do not release any candidate merely because it is handed back.

## Findings and remaining gates

- [Main report](../ASTRA-FULL-AUDIT-20261114.md), SHA256 `{report_hash}`: 1,078 paths accounted, 1,052 audited +26 no-math, 296 finding-referenced, 112,127 ledger rows. Frozen/retained-runner findings:417 (242P1/175P2), no P0 established; no Astra fixes selected.
- [Capture successor review](SUCCESSOR-CAPTURE-REVIEW.md): CAP-294-01, CAP-294-02 and CAP-SLATE-01 remain open at their exact candidates; 17 overlapping frozen findings are separately routed in `CAPTURE-OVERLAP-FINDINGS.tsv`. Pilot3 retained cryptographic proof passed, D4 current readback remains unverified.
- 27 view bindings remain strictly unverified. Two catalog batches are exhausted. One health SELECT, one home reload and two widths were observed; the restart consumed no health query/navigation and is held on possible startup writes/provider calls. Remaining live pages and full network inventory are unverified.
- The three `PROPOSED-*.sql` batches are **not approved or executed**. New reads, providers, page restart, env changes, migrations, releases, backfills, rebuilds and cron actions each need TJ's own approval. Historical receipt gaps cannot be closed by pretending a current row is historical evidence.

Please acknowledge `{ENTRY}` in `CLAUDE-TO-CODEX.md`, accepting the files, explicit dirty/local-record transfer and open work. Astra will make no further edits to returned paths after publication.
'''
(E/'HANDBACK-TO-CLAUDE-20261115.md').write_text(doc)

# Enumerate the final record set, including this inventory's own row and the validation receipt to be written next.
scopes=['tasks/artifacts/calculation-inventory-2026-11-10/master','tasks/TASKS/repository-audit-remediation/migration-authority.json','tasks/TASKS/super-goal/super-goal-final-summary.md','tasks/tasks-fix-sprint-closeout-2026-11-13.md']
paths=set(git('ls-files','--cached','--others','--exclude-standard','--',*scopes).splitlines())
paths.update(str((E/name).relative_to(ROOT)) for name in ['HANDBACK-RECORDS.tsv','HANDBACK-VALIDATION.json'])
tracked=set(git('ls-files','--cached','--',*scopes).splitlines())
records=[]
for path in sorted(paths):
    records.append({'path':path,'astra_audit_commits':'none','working_state':'local uncommitted artifact explicitly transferred in place' if path not in tracked else 'concurrent uncommitted changes explicitly transferred in place' if path in dirty else 'clean at snapshot',
                    'checks':'Record/executable evidence as documented in main report and ledger; inventory membership alone is not a test or audit pass.',
                    'release_state':'No publication authorized by transfer; retained records and authority evidence keep their stated limits.',
                    'owner_on_ack':'Claude','publication_entry':ENTRY})
with (E/'HANDBACK-RECORDS.tsv').open('w') as f:
    w=csv.DictWriter(f,records[0].keys(),delimiter='\t');w.writeheader();w.writerows(records)

assert len({r['path'] for r in rows})==988
assert all(r['owner_at_mailbox_ack']=='Claude' for r in rows)
for file in [report,E/'OWNERSHIP-DECISION-PACKET.md',E/'HANDBACK-TO-CLAUDE-20261115.md']:
    for link in re.findall(r'\]\(([^)]+)\)',file.read_text()):
        if link.startswith(('https:','http:','#')):continue
        assert (file.parent/link.split('#')[0]).exists(),(file.name,link)
validation={'passed':True,'paths_returned':988,'mandatory':951,'shared_approved':37,'retained_shared':0,'records':len(records),
            'returned_dirty_paths':snapshot['dirty_returned'],'different_from_reported_release':len(changed_returned),'report_sha256':report_hash,
            'preserved_dirty_app_hashes':preserved,'links':'resolve','boundary':'Local hand-back record validation only; no app edits, tests, Git mutations or remote operations.'}
(E/'HANDBACK-VALIDATION.json').write_text(json.dumps(validation,indent=2)+'\n')
print(json.dumps(validation))
