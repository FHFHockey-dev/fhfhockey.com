"""Guarded canonical documentary patch. --write only after inspecting prepared diff."""
from pathlib import Path
import collections, copy, datetime, difflib, hashlib, json, re, sys
R=Path('/Users/tim/Code/fhfhockey.com')
B=R/'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-14-forge-living-audit'
P=['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md',
   'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md',
   'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json']
sha=lambda b:hashlib.sha256(b).hexdigest()
load=lambda n:json.loads((B/n).read_text())
def dump(n,d): (B/n).write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
start,cov,spec=load('START.json'),load('COVERAGE.json'),load('PROPOSED-CHANGES.json')
raws={p:(R/p).read_bytes() for p in P}
assert {p:sha(b) for p,b in raws.items()}==start['canonical_before'],'Canonical drift; no write'
for e in cov['entries']:
    if e['coverage'].startswith('content-reviewed'):
        assert sha((R/e['path']).read_bytes())==e['sha256'],'Full reviewed source changed: '+e['path']
stamp=B/'CHECKPOINT-TIME.txt'
if not stamp.exists(): stamp.write_text(datetime.datetime.now(datetime.timezone.utc).isoformat()+'\n')
now=stamp.read_text().strip()
old=json.loads(raws[P[2]])
assert len(old['tasks'])==211 and sum(len(t['evidence']) for t in old['tasks'])==1083
new=copy.deepcopy(old)
by={t['taskID']:t for t in new['tasks']}
changes=copy.deepcopy(spec['changes'])
added=[]
for item in spec['additions']:
    t=copy.deepcopy(item['row']);tid=t['taskID']
    assert tid not in by
    new['tasks'].append(t);by[tid]=t;added.append(tid)
    changes[tid]=dict(fields={},refs=item['refs'],is_new=True)
snapdir=B/'source-snapshots';snapdir.mkdir(exist_ok=True)
snapshot_index={};pins={}
for tid,c in changes.items():
    assert not tid.startswith('MASTER-')
    t=by[tid]
    c['before_fields']={k:t.get(k) for k in c['fields']}
    c['evidence']=[]
    for path,line in c.pop('refs'):
        raw=(R/path).read_bytes()
        h=sha(raw)
        assert 1<=line<=len(raw.decode().splitlines())
        dest=snapdir/(h[:12]+'-'+Path(path).name)
        if dest.exists():assert dest.read_bytes()==raw
        else:dest.write_bytes(raw)
        rel=str(dest.relative_to(R));pins[rel]=h
        snapshot_index[path]=dict(path=rel,sha256=h,original_path=path,observed_at=now)
        c['evidence'].append(dict(path=rel,original_path=path,line=line,sha256=h,observed_at=now,
            review_scope='Full named documentary source or explicitly bounded clause reviewed. Copied remainder is not blanket content acceptance. Underlying application/pixel/hosted claims keep their reviewer/owner provenance; no command executed.'))
    t.setdefault('artifact_audit_segment14',[]).append(dict(at=now,before_fields=c['before_fields'],
        note='Documentary reconciliation; prior scopes/evidence and narrower closures retained. No dispatch/external authority.'))
    t.update(c['fields']);t['as_of']=now;t['evidence'].extend(c['evidence'])

labels=dict(user_impact='User impact',implementation='Implementation',acceptance='Acceptance',release='Release',
    owner='Owner',reviewer='Reviewer',dependencies='Dependencies',verification='Verification',
    acceptance_release_gate='Acceptance/release gate',next_action='Next',evidence_level='Evidence level',
    evidence_scope='Evidence scope',dispatch_class='Dispatch class')
def block(s,tid):
    m=re.search(r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)',s,re.M|re.S)
    assert m,tid
    return m
def render_new(t):
    a=['### '+t['taskID']+' — '+t['scope'],'']
    for k,label in labels.items():a.append('- **'+label+':** '+t[k])
    a.append('- **Source aliases:** '+'; '.join(t['source_inputs']))
    return '\n'.join(a)+'\n\n'
overlay=f'''## Living-audit and current Forge obligations — {now}

211 stable parent IDs preserve all prior scopes and evidence. No parent ID was added: existing FPI task ranges already cover the surviving commitments. Eight readable children expose retained historical-position/TOI reporting, settled-cohort evaluation, market closing-line evaluation, the separate team-total decision, three parked context proposals and the old Forge refresh-itinerary documentation follow-up. Parked proposals remain parked; no new implementation or execution is assigned.

The later Task2 gate clears the dated S-G column-drop parity scope while retaining separate early-season data repair. FORGE-HYDRATION-HB's supporting slice is recorded released in B, superseding its stale unreleased description; the literal predictive-gate exception and surviving physical/admission gates remain distinct. Living-audit gradient-boosted wiring retains completed credit without selecting a current champion or authorizing daily operation. Completed cache, paging, error, FUT/schedule and observability fixes are not reopened.

Nine unique documentary sources and one small structured receipt were fully read in this bounded segment. Generated logs, archives, stored commands and current application/runtime state were not re-audited. Original duplicate/exclusion maps remain intact; the overall content audit remains unfinished. See [segment14 report](/Users/tim/Code/fhfhockey.com/tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-14-forge-living-audit/REPORT.md). No application code/tests, Git, production or new workers.

'''
prepared=[]
for i in [0,1]:
    s=raws[P[i]].decode();s=re.sub(r'As of `[^`]+`',f'As of `{now}`',s,count=1)
    s=s.replace('**211 current ledger rows**','**211 current ledger rows**',1)
    cut=s.index('\n## ');s=s[:cut]+'\n\n'+overlay.rstrip()+'\n'+s[cut:]
    for tid in added:s=s.rstrip()+'\n\n'+render_new(by[tid])
    for tid,c in changes.items():
        m=block(s,tid);n=m.group()
        for k,value in c['fields'].items():
            if k=='children':
                assert not c['before_fields'][k]
                n=n.rstrip()+'\n\n**Readable task child (held source obligation; no new parent ID):**\n\n'
                for child in value:
                    src=child['source']
                    n+='- [ ] **'+child['child_id']+' — '+child['title']+'.** '+child['status']+'. Next: '+child['next_action']+' Owner: '+child['owner']+'. Dependencies: current parent contracts and receipt reconciliation. Gate: '+child['approval_gate']+'. Source: [clause](</Users/tim/Code/fhfhockey.com/'+src['path']+':'+str(src['line'])+'>). Credit retained: '+child['existing_work_credit']+'\n'
                n+='\n';continue
            label=labels.get(k,k)
            label_pattern='(?:Verification|Evidence)(?: / evidence)?' if k=='verification' else re.escape(label)
            pattern=r'(\*\*(?:Current )?'+label_pattern+r':\*\* )(.*?)(?= \*\*[^*\n]+:\*\*|\n|$)'
            if re.search(pattern,n):
                def replace_field(m):
                    val=value
                    if n[m.end():].startswith(' **') and not val.endswith('.'):
                        val+='.'
                    return m.group(1)+val
                n=re.sub(pattern,replace_field,n,count=1)
            else:n=n.rstrip()+'\n- **Current '+label+':** '+value+'\n\n'
            assert value in n
        refs='; '.join(f'[{e["original_path"]}:{e["line"]}](</Users/tim/Code/fhfhockey.com/{e["path"]}:{e["line"]}>) SHA256 `{e["sha256"]}`' for e in c['evidence'])
        n=n.rstrip()+f'\n- **Segment14 reconciliation date:** `{now}`.\n- **Segment14 evidence:** '+refs+'.\n\n'
        s=s[:m.start()]+n+s[m.end():]
    prepared.append(s.rstrip()+'\n')
new['as_of']=now
new['artifact_audit_segment14_20261024']=dict(at=now,added_ids=added,changed_existing_ids=list(spec['changes']),
    visible_children_added=8,coverage=str((B/'COVERAGE.json').relative_to(R)),whole_tree_content_complete=False)
new['master_consolidation_plan'].update(after_sha256=sha(prepared[0].encode()),completed_at=now,
    task_rows_after=211,status='Segment14:211 IDs;20 readable children; current Forge residuals and narrower closures reconciled. Whole content audit unfinished.')
cand={P[0]:prepared[0].encode(),P[1]:prepared[1].encode(),P[2]:(json.dumps(new,indent=2,ensure_ascii=False)+'\n').encode()}
oldids=[t['taskID'] for t in old['tasks']];newids=[t['taskID'] for t in new['tasks']]
assert newids==oldids+added and len(set(newids))==211
for a,z in zip(old['tasks'],new['tasks']):
    assert a['scope']==z['scope'] and z['evidence'][:len(a['evidence'])]==a['evidence']
    if a['taskID'] not in spec['changes']:assert a==z
legacy=[tid for tid in oldids if tid.startswith('MASTER-')];assert len(legacy)==32
for i in [0,1]:
    s=cand[P[i]].decode()
    assert collections.Counter(re.findall(r'^### (\S+) —',s,re.M))==collections.Counter(newids)
    assert not any(tid in changes for tid in legacy), 'Legacy blocks are outside the focused edit set'
children=[v for t in new['tasks'] for v in t.get('children',[])];assert len(children)==len({v['child_id'] for v in children})==20
ev=sum(len(t['evidence']) for t in new['tasks']);assert ev==1083+sum(len(c['evidence']) for c in changes.values())
for p,raw in raws.items():
    dest=B/('BASELINE-'+Path(p).name)
    if dest.exists():assert dest.read_bytes()==raw
    else:dest.write_bytes(raw)
for p,raw in cand.items():(B/('CANDIDATE-'+Path(p).name)).write_bytes(raw)
patch=''.join(''.join(difflib.unified_diff(raws[p].decode().splitlines(True),cand[p].decode().splitlines(True),fromfile='before/'+p,tofile='after/'+p)) for p in P)
assert not [l for l in patch.splitlines() if l.startswith('+') and not l.startswith('+++') and l[1:]!=l[1:].rstrip()]
(B/'CANONICAL-CHECKPOINT.patch').write_text(patch)
dump('SOURCE-SNAPSHOT-INDEX.json',dict(cutoff=now,sources=snapshot_index));dump('SOURCE-PINS.json',pins)
dump('CHANGELOG.json',dict(at=now,changes=changes,added_ids=added,deduplication=spec['deduplication']))
v=dict(at=now,before_ids=211,after_ids=211,before_evidence=1083,after_evidence=ev,
    added_ids=added,changed_existing_ids=list(spec['changes']),all_prior_ids_scopes_evidence_prefixes_preserved=True,
    prior_211_ids_scopes_preserved=True,legacy_blocks_outside_edit_set=32,unchanged_existing_rows_identical=204,
    readable_children_before=12,readable_children_after=20,canonical_before=start['canonical_before'],
    candidate_hashes={p:sha(raw) for p,raw in cand.items()},no_added_trailing_whitespace=True,
    application_tests_git_or_external_operations=0,whole_tree_content_audit_complete=False)
dump('VALIDATION-PREPARED.json',v)
if '--write' in sys.argv:
    assert {p:sha((R/p).read_bytes()) for p in P}==start['canonical_before'],'Canonical drift; no write'
    assert all(sha((R/p).read_bytes())==h for p,h in pins.items()),'Snapshot drift; no write'
    for p,raw in cand.items():(R/p).write_bytes(raw)
    assert {p:sha((R/p).read_bytes()) for p in P}==v['candidate_hashes']
    dump('VALIDATION-CANONICAL.json',dict(v,canonical_written=True))
print(json.dumps(v))
