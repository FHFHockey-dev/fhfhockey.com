"""Finish local documentary verification after confirmed Library replacement; never retries it."""
from pathlib import Path
import collections, datetime, hashlib, json, re, subprocess
R=Path('/Users/tim/Code/fhfhockey.com')
B=R/'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-13-forge-contracts'
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
load=lambda n:json.loads((B/n).read_text())
def dump(n,d): (B/n).write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
v=load('VALIDATION-CANONICAL.json')
receipt=load('LIBRARY-DELIVERY.json')
assert receipt['tool_confirmation']['status']=='succeeded'
assert receipt['tool_confirmation']['current_version_number']==12
assert receipt['tool_confirmation']['helper_exit_code']==0
master=R/'tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md'
x=subprocess.run(['/usr/bin/xattr','-p','user.library-file-version',str(master)],capture_output=True,text=True)
assert x.returncode==0 and json.loads(x.stdout.strip())==12
assert {p:sha(R/p) for p in v['candidate_hashes']}==v['candidate_hashes']
assert receipt['local_sha256']==sha(master)
old=load('BASELINE-LEDGER.json')
new=json.loads((R/'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json').read_text())
initial=json.loads((R/'tasks/artifacts/task-artifact-reconciliation-2026-10-24/BASELINE-LEDGER.json').read_text())
by={t['taskID']:t for t in new['tasks']}
assert len(by)==211 and sum(len(t['evidence']) for t in new['tasks'])==1083
for t in old['tasks']:
    z=by[t['taskID']]
    assert z['scope']==t['scope'] and z['evidence'][:len(t['evidence'])]==t['evidence']
assert len(initial['tasks'])==189
for t in initial['tasks']: assert by[t['taskID']]['scope']==t['scope']
pins=load('SOURCE-PINS.json')
assert all(sha(R/p)==h for p,h in pins.items())
oldby={t['taskID']:t for t in old['tasks']}
refs=[e for t in new['tasks'] for e in t['evidence'][len(oldby.get(t['taskID'],{}).get('evidence',[])):]]
assert len(refs)==25
for e in refs:
    assert sha(R/e['path'])==e['sha256']
    assert 1<=e['line']<=len((R/e['path']).read_text().splitlines())
children=[c for t in new['tasks'] for c in t.get('children',[])]
assert len(children)==len({c['child_id'] for c in children})==12
for path in ['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md',
             'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md']:
    s=(R/path).read_text()
    assert collections.Counter(re.findall(r'^### (\S+) —',s,re.M))==collections.Counter(by.keys())
    before=(B/('BASELINE-'+Path(path).name)).read_text()
    for tid in [x for x in by if x.startswith('MASTER-')]:
        pat=r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)'
        assert re.search(pat,before,re.M|re.S).group()==re.search(pat,s,re.M|re.S).group()
    assert all(s.count('**'+c['child_id']+' —')==1 for c in children)
assert new['master_consolidation_plan']['after_sha256']==sha(master)
cov=load('COVERAGE.json')
drift=[dict(path=e['path'],coverage=e['coverage'],reviewed_sha256=e['sha256'],current_sha256=sha(R/e['path']))
       for e in cov['entries'] if sha(R/e['path'])!=e['sha256']]
assert not [e for e in drift if e['coverage'].startswith('content-reviewed')]
dump('LIVE-CHANGES.json',dict(at=now,full_reviewed_source_drift=[],partial_live_changes_after_cutoff=drift,
    canonical_hashes=v['candidate_hashes'],frozen_coordination_snapshot='COORDINATION-READ.json',
    scope='Checked snapshots preserve the stated cutoff; omitted and later live content remains partial.'))
c=load('CONTINUATION.json')
c.update(at=now,status='Canonical and same-identity Library v12 checkpoint complete; whole content audit unfinished.',
    library_version=12,library_checkpoint_pending=False,library_replacement_started=True,library_replacement_completed=True,
    no_pending_or_uncertain_operation=True,no_pending_audit_mutation=True,no_uncertain_operation=True,
    library_delivery='LIBRARY-DELIVERY.json',live_partial_source_changes=drift)
dump('CONTINUATION.json',c)
report=(B/'REPORT.md').read_text().replace(
    'Library delivery is pending; expected prior version11, same identity.',
    'Same-identity Library replacement11→12 succeeded; helper exited0, native version12 reads back, and local master bytes retain the validated hash. Full raw API response was not saved because local receipt serialization failed; LIBRARY-DELIVERY.json transparently reconstructs the receipt from direct success confirmation, native metadata and the unchanged file hash. No remote retry occurred.')
marker='## Verified delivery and hashes'
if marker not in report:
    report+='\n'+marker+'\n\n'+'\n'.join('- `'+p+'`: `'+h+'`' for p,h in v['candidate_hashes'].items())
    report+='\n\nLibrary `libfile_9987e7d9d1b8819181b366a318cc9a9c`, version12. No blocked, pending or uncertain operation. All189initial/209prior scopes,211IDs,1083evidence,12children,25new references and32legacy blocks verified. Native metadata/local source integrity were checked; no independent hosted-file download checksum is claimed.\n'
(B/'REPORT.md').write_text(report)
dump('DIAGNOSTICS.json',dict(at=now,resolved_failures=[
    dict(action='Prepare own documentary spec',target=str(B/'PROPOSED-CHANGES.json'),
         reason='Inline Python parse error from missing conditional whitespace; no statements executed.',
         resolution='Saved readable prepare.py; candidate preparation and canonical validation succeeded.'),
    dict(action='Save Library replacement receipt',target=str(B/'LIBRARY-DELIVERY.json'),
         reason='Local serialization used shell quoting as Python string syntax; first recovery assumed object metadata while the xattr is scalar12.',
         completed='Remote same-identity replacement succeeded/version12; metadata helper exited0.',
         resolution='Saved honest reconstructed receipt from direct returned status/version/helper confirmation plus native metadata and unchanged local hash. No remote retry.'),
    dict(action='Final local Markdown parity assertion',target=str(B/'FINAL-CHECKPOINT.json'),
         reason='Counter(dict) interpreted row objects as counts instead of counting IDs.',
         resolution='Corrected to Counter(by.keys()); actual register content required no change.')],
    absent_alias=dict(path='tasks/artifacts/player-cards-2026-10-24/slice-03-r1-review/HANDOFF.md',
        resolution='Bounded named-file lookup found REVIEW.md; actual independent review fully read.'),
    pending_blocked_or_uncertain_operations=[]))
final=dict(v,at=now,library=dict(identity='libfile_9987e7d9d1b8819181b366a318cc9a9c',version=12,status='succeeded',
    helper_exit_code=0,native_metadata_matches=True,local_master_bytes_unchanged=True,
    original_raw_response_saved=False,receipt_recovered_without_retry=True),
    initial_189_scopes_exactly_preserved=True,full_text_documents=11,original_queue_full_text_documents=8,
    new_current_text_receipts=3,full_text_bytes=94725,full_structured_receipts=2,partial_files=6,
    remaining_unique_text_candidates=1669,remaining_raw_queue=c['remaining_base_queue_items'],
    partial_live_source_drift=drift,blocked_pending_uncertain_operations=[],no_pending_audit_mutation=True)
dump('FINAL-CHECKPOINT.json',final)
diary=R/'tasks/diaries/2026-10-24-codex-task-artifact-audit.md'
with diary.open('a') as f:
    f.write(f'\n## Segment13 delivery complete — {now}\n- Same Library identity11→12 succeeded; helper0/native12/local masterhash verified. RawAPIresponse receipt was not saved due local serialization; transparent reconstructedreceipt saved without remote retry.\n-211IDs/1083evidence/12children;189initial and209prior scopes/history,32legacy blocks and25new refs verified. Own parity-validator dictionary-count bug corrected; no register repair required. No blocked/pending/uncertain operation.\n-1669text candidates remain. Resume paired livingaudit PRD/tasks; research deferred. Full/partial/duplicates/exclusions retained; no app code/tests/Git/runtime/provider/production action.\n')
files=[p for p in B.rglob('*') if p.is_file() and p.name not in ['OWN-OUTPUTS.json','SHA256SUMS']]
manifest=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(files)]
dump('OWN-OUTPUTS.json',dict(at=now,outputs=manifest,excluded_from_recursive_reaudit=True))
(B/'SHA256SUMS').write_text(''.join(x['sha256']+'  '+x['path']+'\n' for x in manifest))
print(json.dumps(dict(ids=211,evidence=1083,children=12,library_version=12,original_baseline_scopes=189,
    legacy_blocks_each_markdown=32,new_refs_verified=25,remaining_text_candidates=1669,
    partial_live_source_changes=len(drift),blocked_pending_uncertain_operations=[])))
