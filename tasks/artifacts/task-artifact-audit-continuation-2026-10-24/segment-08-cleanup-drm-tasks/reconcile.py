"""Guarded documentary checkpoint; never imports app code or invokes Git."""
from pathlib import Path
import collections, copy, datetime, difflib, hashlib, json, re, sys
ROOT=Path('/Users/tim/Code/fhfhockey.com')
B=ROOT/'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-08-cleanup-drm-tasks'
P=['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md','tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md','tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json']
sha=lambda b:hashlib.sha256(b).hexdigest()
dump=lambda p,d:p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
start=json.loads((B/'START.json').read_text());cov=json.loads((B/'COVERAGE.json').read_text());spec=json.loads((B/'PROPOSED-CHANGES.json').read_text());raws={p:(ROOT/p).read_bytes() for p in P}
assert all(sha(raws[p])==start['canonical_before'][p] for p in P),'Canonical advanced; no write'
for e in cov['entries']:assert sha((ROOT/e['path']).read_bytes())==e['sha256'],'Reviewed file changed: '+e['path']
stamp=B/'CHECKPOINT-TIME.txt'
if not stamp.exists():stamp.write_text(datetime.datetime.now(datetime.timezone.utc).isoformat()+'\n')
now=stamp.read_text().strip();old=json.loads(raws[P[2]]);new=copy.deepcopy(old);ids=lambda d:[t['taskID'] for t in d['tasks']]
assert len(old['tasks'])==207 and sum(len(t['evidence']) for t in old['tasks'])==955
for p,r in raws.items():
    dest=B/('BASELINE-'+Path(p).name)
    if dest.exists():assert dest.read_bytes()==r
    else:dest.write_bytes(r)
byid={t['taskID']:t for t in new['tasks']};changes=copy.deepcopy(spec['changes']);snapdir=B/'source-snapshots';snapdir.mkdir(exist_ok=True);snaps={};pins={}
for tid,c in changes.items():
    t=byid[tid];assert not tid.startswith('MASTER-');c['before_fields']={k:t.get(k) for k in c['fields']};c['evidence']=[]
    for path,line in c.pop('refs'):
        r=(ROOT/path).read_bytes();h=sha(r);assert 1<=line<=len(r.decode().splitlines())
        dest=snapdir/(h[:12]+'-'+Path(path).name)
        if dest.exists():assert dest.read_bytes()==r
        else:dest.write_bytes(r)
        rel=str(dest.relative_to(ROOT));pins[rel]=h;snaps[path]=dict(path=rel,sha256=h,original_path=path,observed_at=now)
        e=dict(path=rel,original_path=path,line=line,sha256=h,observed_at=now,review_scope='Full documentary source read; stored commands not executed; owner/reviewer/external receipts retain exact limited scope. Snapshot is evidence, not authority.')
        if not any((x.get('path'),x.get('line'),x.get('sha256'))==(e['path'],e['line'],e['sha256']) for x in t['evidence']):c['evidence'].append(e)
    t.setdefault('artifact_audit_segment08',[]).append(dict(at=now,before_fields=c['before_fields'],note='Dated content/status overlay. Prior scopes, evidence, narrower acceptance, parked/rejected work and original failed receipts preserved. No implementation/production authority.'))
    t.update(c['fields']);t['as_of']=now;t['evidence'].extend(c['evidence'])
overlay=f'''## Paired cleanup/DRM and Draft/Yahoo content checkpoint — {now}

207 stable IDs preserve all prior scopes and955 earlier evidence entries; no new task ID or worker. Full paired lists retain completed CLEAN/DRM cohorts and existing NEW127/86 homes. Newly reviewed Draft/Yahoo documents add held live-draft durable-worker/rehearsal and distinct session/pick retention clauses to existing PAID-SYNC/privacy/history IDs. Deferred adjacent features/cadences and two-view settings stay parked; local UI/OAuth fixtures do not establish provider or broad-rollout readiness.

WiGO exact four-file correction now has independent75offline checks/46pins and parent ACCEPT WITH LIMITS; stored data/refresh/backfill remain separate and unapproved. Player-card slice01 independent review remains ongoing, not accepted. Testing Grounds slice05 original P2 S05-R1 remount failure is under a frozen owner correction/re-review, not accepted; already-approved local owner verification remains blocked with0of1authreadsused. Earlier pending-approval wording is historical.

Coverage separates13full unique source reads from the historical generated index's bounded structural disposition and39known support-role metadata dispositions. Eight known unique reports remain queued; metadata is never full content/visual acceptance. See [segment08](/Users/tim/Code/fhfhockey.com/tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-08-cleanup-drm-tasks/REPORT.md). Overall task-tree audit remains incomplete. No application/source/test/Git/production/API/DB/cron/provider action by this auditor.

'''
labels={'implementation':'Implementation','acceptance':'Acceptance','verification':'Verification','next_action':'Next','dispatch_class':'Dispatch class','dependencies':'Dependencies'}
def block(s,tid):
    m=re.search(r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)',s,re.M|re.S);assert m,tid;return m
prepared=[]
for i in [0,1]:
    s=raws[P[i]].decode();s=re.sub(r'As of `[^`]+`',f'As of `{now}`',s,count=1);cut=s.index('\n## ');s=s[:cut]+'\n\n'+overlay.rstrip()+'\n'+s[cut:]
    for tid,c in changes.items():
        m=block(s,tid);n=m.group()
        for key,value in c['fields'].items():
            before=c['before_fields'][key]
            if isinstance(before,str) and before in n:
                n=n.replace(before,value,1)
                if value.endswith('.'):n=n.replace(value+'.',value,1)
            else:n=n.rstrip()+f'\n- **Current {labels.get(key,key)}:** {value}\n\n'
            assert value in n
        refs='; '.join(f'[{e["original_path"]}:{e["line"]}](</Users/tim/Code/fhfhockey.com/{e["path"]}:{e["line"]}>) SHA256 `{e["sha256"]}`' for e in c['evidence'])
        n=n.rstrip()+f'\n- **Segment08 reconciliation date:** `{now}`.\n- **Segment08 evidence:** '+refs+'.\n\n';s=s[:m.start()]+n+s[m.end():]
    prepared.append(s.rstrip()+'\n')
new['as_of']=now;new['artifact_audit_segment08_20261024']=dict(at=now,changed_ids=list(changes),added_ids=[],coverage=str((B/'COVERAGE.json').relative_to(ROOT)),dispositions=str((B/'DISPOSITION-INDEX.json').relative_to(ROOT)),whole_tree_content_complete=False)
new['master_consolidation_plan'].update(after_sha256=sha(prepared[0].encode()),completed_at=now,task_rows_after=207,status='October24 segment08:207 IDs; paired full reads, bounded historical/support dispositions and Draft/Yahoo retained gates; full-corpus content audit unfinished.')
cand={P[0]:prepared[0].encode(),P[1]:prepared[1].encode(),P[2]:(json.dumps(new,indent=2,ensure_ascii=False)+'\n').encode()}
for p,r in cand.items():(B/('CANDIDATE-'+Path(p).name)).write_bytes(r)
assert ids(new)==ids(old)
for a,z in zip(old['tasks'],new['tasks']):
    assert a['scope']==z['scope'] and z['evidence'][:len(a['evidence'])]==a['evidence']
    if a['taskID'] not in changes:assert a==z
legacy=[t['taskID'] for t in old['tasks'] if t['taskID'].startswith('MASTER-')];assert len(legacy)==32
for i in [0,1]:
    s=cand[P[i]].decode();assert collections.Counter(re.findall(r'^### (\S+) —',s,re.M))==collections.Counter(ids(new))
    for tid in legacy:assert block(raws[P[i]].decode(),tid).group()==block(s,tid).group(),(i,tid)
patch=''.join(''.join(difflib.unified_diff(raws[p].decode().splitlines(True),cand[p].decode().splitlines(True),fromfile='before/'+p,tofile='after/'+p)) for p in P)
assert not [l for l in patch.splitlines() if l.startswith('+') and not l.startswith('+++') and l[1:]!=l[1:].rstrip()]
(B/'CANONICAL-CHECKPOINT.patch').write_text(patch);dump(B/'SOURCE-SNAPSHOT-INDEX.json',dict(cutoff=now,sources=snaps));dump(B/'SOURCE-PINS.json',pins);dump(B/'CHANGELOG.json',dict(at=now,changes=changes,added_ids=[]))
validation=dict(at=now,before_ids=207,after_ids=207,before_evidence=955,after_evidence=sum(len(t['evidence']) for t in new['tasks']),changed_ids=list(changes),all_prior_ids_scopes_and_evidence_prefixes_preserved=True,legacy_blocks_byte_identical_each_markdown=32,unchanged_existing_rows_identical=207-len(changes),no_added_trailing_whitespace=True,canonical_before=start['canonical_before'],candidate_hashes={p:sha(r) for p,r in cand.items()},application_git_or_production_operations=0,whole_tree_content_audit_complete=False)
dump(B/'VALIDATION-PREPARED.json',validation)
if '--write' in sys.argv:
    assert all(sha((ROOT/p).read_bytes())==h for p,h in start['canonical_before'].items()),'Canonical drift; no write'
    assert all(sha((ROOT/p).read_bytes())==h for p,h in pins.items()),'Snapshot drift; no write'
    for p,r in cand.items():(ROOT/p).write_bytes(r)
    assert all((ROOT/p).read_bytes()==r for p,r in cand.items())
    validation['canonical_written_and_read_back']=True;dump(B/'VALIDATION-CANONICAL.json',validation)
print(json.dumps(validation,indent=2))
