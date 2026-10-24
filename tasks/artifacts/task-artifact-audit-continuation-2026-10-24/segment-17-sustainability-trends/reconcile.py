"""Prepare, inspect, then CAS-write a focused documentary reconciliation."""
from pathlib import Path
import collections, copy, datetime, difflib, hashlib, json, re, sys

R = Path('/Users/tim/Code/fhfhockey.com')
B = Path(__file__).resolve().parent
P = ['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md',
     'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md',
     'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json']
sha = lambda raw: hashlib.sha256(raw).hexdigest()
load = lambda name: json.loads((B/name).read_text())
def dump(name, value):
    (B/name).write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n')

start, cov, spec = load('START.json'), load('COVERAGE.json'), load('PROPOSED-CHANGES.json')
raws = {p: (R/p).read_bytes() for p in P}
assert {p: sha(v) for p,v in raws.items()} == start['canonical_before'], 'Canonical drift; no write'
for e in cov['entries']:
    assert sha((R/e['path']).read_bytes()) == e['sha256'], 'Reviewed source drift: '+e['path']
stamp = B/'CHECKPOINT-TIME.txt'
if not stamp.exists():
    stamp.write_text(datetime.datetime.now(datetime.timezone.utc).isoformat()+'\n')
now = stamp.read_text().strip()
old = json.loads(raws[P[2]])
assert len(old['tasks']) == 213 and sum(len(t['evidence']) for t in old['tasks']) == 1149
new = copy.deepcopy(old)
by = {t['taskID']: t for t in new['tasks']}
changes, added = copy.deepcopy(spec['changes']), []
for item in spec['additions']:
    t = copy.deepcopy(item['row']); tid = t['taskID']
    assert tid not in by
    new['tasks'].append(t); by[tid] = t; added.append(tid)
    changes[tid] = dict(fields={'children': copy.deepcopy(item['children'])} if item.get('children') else {},
                        refs=item['refs'], is_new=True)

snapdir = B/'source-snapshots'; snapdir.mkdir(exist_ok=True)
snapshot_index, pins = {}, {}
reviewed = {e['path']: e for e in cov['entries']}
for tid,c in changes.items():
    assert not tid.startswith('MASTER-')
    t = by[tid]
    c['before_fields'] = {k: t.get(k) for k in c['fields']}
    c['evidence'] = []
    for path,line in c.pop('refs'):
        raw = (R/path).read_bytes(); h = sha(raw)
        assert path in reviewed and 1 <= line <= len(raw.decode().splitlines())
        assert any(a <= line <= z for a,z in reviewed[path]['reviewed_ranges'])
        dest = snapdir/(h[:12]+'-'+Path(path).name)
        if dest.exists(): assert dest.read_bytes() == raw
        else: dest.write_bytes(raw)
        rel = str(dest.relative_to(R)); pins[rel] = h
        snapshot_index[path] = dict(path=rel, sha256=h, original_path=path, observed_at=now,
                                    review_scope=reviewed[path]['review_scope'])
        c['evidence'].append(dict(path=rel, original_path=path, line=line, sha256=h, observed_at=now,
            review_scope=reviewed[path]['review_scope']))
    prior_child_ids = {x['child_id'] for x in (c['before_fields'].get('children') or [])}
    for child in c['fields'].get('children', []):
        if child['child_id'] in prior_child_ids: continue
        source = child['source']; e = reviewed[source['path']]
        assert any(a <= source['line'] <= z for a,z in e['reviewed_ranges'])
    t.setdefault('artifact_audit_segment17', []).append(dict(at=now, before_fields=c['before_fields'],
        note='Documentary reconciliation only; prior scope, evidence and narrower closures retained. No new authority.'))
    t.update(c['fields']); t['as_of'] = now; t['evidence'].extend(c['evidence'])

labels = dict(user_impact='User impact', implementation='Implementation', acceptance='Acceptance', release='Release',
    owner='Owner', reviewer='Reviewer', dependencies='Dependencies', verification='Verification',
    acceptance_release_gate='Acceptance/release gate', next_action='Next', evidence_level='Evidence level',
    evidence_scope='Evidence scope', dispatch_class='Dispatch class')
def block(s, tid):
    m = re.search(r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)', s, re.M|re.S)
    assert m, tid
    return m
def render_new(t):
    lines = ['### '+t['taskID']+' — '+t['scope'], '']
    lines.extend('- **'+label+':** '+t[k] for k,label in labels.items())
    lines.append('- **Source aliases:** '+'; '.join(t['source_inputs']))
    return '\n'.join(lines)+'\n\n'

overlay = f'''## Remaining Sustainability family reconciliation — {now}

213 stable parent IDs preserve all prior scopes/evidence. Nine readable children now expose six distinct historical trend/team/provenance decisions, two rolling source/sweep/application stages and one eligible-only FORGE result gate. These remain reconciliation-first under existing parents; no new operation or model work is dispatched.

The exact August2 WGO season-identity repair and zero-change replay are recorded complete, superseding older pre-repair paragraphs. The volatility/Sandbox plan retains 19/19 closure. Existing-row repair and missing-history fill remain separate; all 21 contaminated FORGE runs and their 1,344 missing results stay terminally excluded. Generated inventory unknowns and research suggestions are not automatically new tasks. Later source/migration/reader receipts must govern surviving gates.

Six remaining Sustainability texts (190,548 bytes) were fully read. Two historical JSON snapshots received complete structural/count/cross-link checks and selected-record semantic inspection, not all-row content acceptance. This completes documentary disposition of the captured Sustainability family; underlying app/runtime/data were not audited and the overall tasks-tree audit remains unfinished. Parent-reported Testing Grounds viewing success and player-card visual-direction approval are recorded separately from runner/Auth activation and final design acceptance. See [segment17 report](/Users/tim/Code/fhfhockey.com/tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-17-sustainability-trends/REPORT.md). No application code/tests, Git, production or additional workers.

'''
prepared, scalar_checks = [], []
for i in [0,1]:
    s = raws[P[i]].decode()
    s = re.sub(r'As of `[^`]+`', f'As of `{now}`', s, count=1)
    s = s.replace('**213 current ledger rows**', '**213 current ledger rows**', 1)
    cut = s.index('\n## '); s = s[:cut]+'\n\n'+overlay.rstrip()+'\n'+s[cut:]
    for tid in added: s = s.rstrip()+'\n\n'+render_new(by[tid])
    for tid,c in changes.items():
        m = block(s,tid); n = m.group()
        for k,value in c['fields'].items():
            if k == 'children':
                prior_children = c['before_fields'][k] or []
                assert value[:len(prior_children)] == prior_children
                added_children = value[len(prior_children):]
                n = n.rstrip()+'\n\n**Readable task children (source obligations; no new parent IDs):**\n\n'
                for child in added_children:
                    src = child['source']; deps = ', '.join(child['depends_on']) or 'existing parent contracts and receipt reconciliation'
                    n += '- [ ] **'+child['child_id']+' — '+child['title']+'.** '+child['status']+'. Next: '+child['next_action']+' Owner: '+child['owner']+'. Dependencies: '+deps+'. Gate: '+child['approval_gate'].rstrip('.')+'. Source: [clause](</Users/tim/Code/fhfhockey.com/'+src['path']+':'+str(src['line'])+'>). Credit retained: '+child['existing_work_credit']+'\n'
                n += '\n'; continue
            label = labels[k]
            lp = '(?:Verification|Evidence)(?: / evidence)?' if k == 'verification' else re.escape(label)
            pattern = r'(\*\*(?:Current )?'+lp+r':\*\* )(.*?)(?= \*\*[^*\n]+:\*\*|\n|$)'
            match = re.search(pattern,n)
            if match:
                val = value + ('.' if n[match.end():].startswith(' **') and not value.endswith('.') else '')
                n = n[:match.start(2)]+val+n[match.end(2):]
            else: n = n.rstrip()+'\n- **Current '+label+':** '+value+'\n\n'
            actual = re.search(pattern,n).group(2)
            assert actual == value or actual == value+'.', (tid,k)
            scalar_checks.append(dict(document=P[i], taskID=tid, field=k, label_value_matched=True))
        refs = '; '.join(f'[{e["original_path"]}:{e["line"]}](</Users/tim/Code/fhfhockey.com/{e["path"]}:{e["line"]}>) SHA256 `{e["sha256"]}`' for e in c['evidence'])
        n = n.rstrip()+f'\n- **Segment17 reconciliation date:** `{now}`.\n- **Segment17 evidence:** '+refs+'.\n\n'
        s = s[:m.start()]+n+s[m.end():]
    prepared.append(s.rstrip()+'\n')

new['as_of'] = now
new['artifact_audit_segment17_20261024'] = dict(at=now, added_ids=added,
    changed_existing_ids=list(spec['changes']), visible_children_added=9,
    coverage=str((B/'COVERAGE.json').relative_to(R)), whole_tree_content_complete=False)
new['master_consolidation_plan'].update(after_sha256=sha(prepared[0].encode()), completed_at=now,
    task_rows_after=213, status='Segment17:213 IDs;45 readable children; full content audit unfinished.')
cand = {P[0]:prepared[0].encode(), P[1]:prepared[1].encode(), P[2]:(json.dumps(new,indent=2,ensure_ascii=False)+'\n').encode()}
oldids = [t['taskID'] for t in old['tasks']]; newids = [t['taskID'] for t in new['tasks']]
assert newids == oldids+added and len(set(newids)) == 213
for a,z in zip(old['tasks'],new['tasks']):
    assert a['scope'] == z['scope'] and z['evidence'][:len(a['evidence'])] == a['evidence']
    if a['taskID'] not in spec['changes']: assert a == z
legacy = [tid for tid in oldids if tid.startswith('MASTER-')]; assert len(legacy) == 32
for i in [0,1]:
    s = cand[P[i]].decode()
    assert collections.Counter(re.findall(r'^### (\S+) —',s,re.M)) == collections.Counter(newids)
    for tid in legacy: assert block(raws[P[i]].decode(),tid).group() == block(s,tid).group()
children = [v for t in new['tasks'] for v in t.get('children',[])]
assert len(children) == len({v['child_id'] for v in children}) == 45
ev = sum(len(t['evidence']) for t in new['tasks'])
assert ev == 1149 + sum(len(c['evidence']) for c in changes.values())
for p,raw in raws.items():
    dest = B/('BASELINE-'+Path(p).name)
    if dest.exists(): assert dest.read_bytes() == raw
    else: dest.write_bytes(raw)
for p,raw in cand.items(): (B/('CANDIDATE-'+Path(p).name)).write_bytes(raw)
patch = ''.join(''.join(difflib.unified_diff(raws[p].decode().splitlines(True),cand[p].decode().splitlines(True),fromfile='before/'+p,tofile='after/'+p)) for p in P)
assert not [l for l in patch.splitlines() if l.startswith('+') and not l.startswith('+++') and l[1:] != l[1:].rstrip()]
(B/'CANONICAL-CHECKPOINT.patch').write_text(patch)
dump('SOURCE-SNAPSHOT-INDEX.json',dict(cutoff=now,sources=snapshot_index)); dump('SOURCE-PINS.json',pins)
dump('CHANGELOG.json',dict(at=now,changes=changes,added_ids=added,deduplication=spec['deduplication']))
v = dict(at=now,before_ids=213,after_ids=213,before_evidence=1149,after_evidence=ev,
    added_ids=added,changed_existing_ids=list(spec['changes']), all_prior_ids_scopes_evidence_prefixes_preserved=True,
    legacy_blocks_byte_identical=32,unchanged_existing_rows_identical=207,
    readable_children_before=36,readable_children_after=45,scalar_label_checks=scalar_checks,
    canonical_before=start['canonical_before'],candidate_hashes={p:sha(raw) for p,raw in cand.items()},
    no_added_trailing_whitespace=True,application_tests_git_or_external_operations=0,whole_tree_content_audit_complete=False)
dump('VALIDATION-PREPARED.json',v)
if '--write' in sys.argv:
    assert {p:sha((R/p).read_bytes()) for p in P} == start['canonical_before'], 'Canonical drift; no write'
    assert all(sha((R/p).read_bytes()) == h for p,h in pins.items()), 'Snapshot drift; no write'
    assert all(sha((R/e['path']).read_bytes()) == e['sha256'] for e in cov['entries']), 'Reviewed source drift; no write'
    for p,raw in cand.items(): (R/p).write_bytes(raw)
    assert {p:sha((R/p).read_bytes()) for p in P} == v['candidate_hashes']
    dump('VALIDATION-CANONICAL.json',dict(v,canonical_written=True))
print(json.dumps({k:v for k,v in v.items() if k not in ['scalar_label_checks','canonical_before']}))
