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
for e in cov['entries'] + cov['reused_prior_full_reviews'] + cov['structured_support'] + cov['metadata_support']:
    assert sha((R/e['path']).read_bytes()) == e['sha256'], 'Reviewed source drift: '+e['path']
stamp = B/'CHECKPOINT-TIME.txt'
if not stamp.exists():
    stamp.write_text(datetime.datetime.now(datetime.timezone.utc).isoformat()+'\n')
now = stamp.read_text().strip()
old = json.loads(raws[P[2]])
assert len(old['tasks']) == 215 and sum(len(t['evidence']) for t in old['tasks']) == 1253
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
for e in cov['reused_prior_full_reviews']:
    reviewed[e['path']] = dict(e, reviewed_ranges=[[1,len((R/e['path']).read_text().splitlines())]], review_scope='Exact hash reuse of a prior full documentary review; this segment inspects only named clauses. No application or hosted acceptance inherited.')
for tid,c in changes.items():
    assert not tid.startswith('MASTER-')
    t = by[tid]
    c['before_fields'] = {k: t.get(k) for k in c['fields']}
    c['evidence'] = []
    for path,line in c.pop('refs'):
        raw = (R/path).read_bytes(); h = sha(raw)
        assert path in reviewed and 1 <= line <= len(raw.decode().splitlines())
        assert any(a <= line <= z for a,z in reviewed[path]['reviewed_ranges'])
        source_meta = reviewed[path]
        snapshot_raw = raw
        transformed = source_meta.get('snapshot_mode') == 'reviewed-clauses-redacted-preserve-lines'
        if transformed:
            lines = raw.decode().splitlines()
            keep = source_meta['reviewed_ranges']
            out = []
            for number, value in enumerate(lines,1):
                if not any(a <= number <= z for a,z in keep):
                    value = '[Not content-reviewed in segment23; body not copied.]'
                else:
                    value = re.sub(r'\b[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\b','<identifier redacted>',value)
                    value = re.sub(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','<address redacted>',value)
                out.append(value)
            snapshot_raw = ('\n'.join(out)+'\n').encode()
        sh = sha(snapshot_raw)
        dest = snapdir/(h[:12]+('-reviewed-clauses-' if transformed else '-')+Path(path).name)
        if dest.exists(): assert dest.read_bytes() == snapshot_raw
        else: dest.write_bytes(snapshot_raw)
        rel = str(dest.relative_to(R)); pins[rel] = sh
        snapshot_index[path] = dict(path=rel, sha256=sh, original_path=path, original_sha256=h,
            observed_at=now, review_scope=source_meta['review_scope'], reviewed_ranges=source_meta['reviewed_ranges'],
            transformed_clause_snapshot=transformed, original_line_numbers_preserved=True)
        c['evidence'].append(dict(path=rel, original_path=path, line=line, sha256=sh, original_sha256=h,
            observed_at=now, review_scope=source_meta['review_scope'], transformed_clause_snapshot=transformed))
    prior_child_ids = {x['child_id'] for x in (c['before_fields'].get('children') or [])}
    for child in c['fields'].get('children', []):
        if child['child_id'] in prior_child_ids: continue
        source = child['source']; e = reviewed[source['path']]
        assert any(a <= source['line'] <= z for a,z in e['reviewed_ranges'])
    t.setdefault('artifact_audit_segment23', []).append(dict(at=now, before_fields=c['before_fields'],
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

overlay = f'''## In-season trust/clarity evidence reconciliation — {now}

217 stable parent IDs preserve every prior scope/evidence entry. Two proposed/held parents retain shared in-season human/native-AT/real-account acceptance and parked Rankings dataset/component/stability qualification. Nine readable children expose those gates plus exact News execution lineage, historical Starter Board producer attribution and WiGO aggregate/metric-basis provenance under existing parents. Four existing rows receive only bounded evidence/status reconciliation; no source repair or implementation is dispatched.

Today/upcoming Starter Board recovery, zero/zero DIFF, fantasy-preset and News consumer decisions are already resolved. Extensive local five-width/native zoom, sample/preset/PP-read/URL/timeout, RSO race/retained-provider read-only/manual-fork and other consumer fixes retain their scope. Candidate News batches and goalie-v2 run receipts narrow attribution but do not bind historical items/rows to immutable execution/code/input evidence. Current accepted News/WiGO packets, underlying rolling-history repair, AUDIT-A7 query acceptance, paused Rankings research and per-owner release/admission gates remain separate.

The 104,259-byte PRD/task pair is fully read. 243 of 542 owner-memo lines were read for actual decisions/contradictions; 299 historical UI/QA-detail lines remain unreviewed. Private identifiers are redacted in clause snapshots, with original hashes and line numbers preserved separately. 33 structured receipts receive bounded parse/schema/count disposition and 79 historical image/log/script files metadata-only disposition. No pixels, source scripts, current application/tests, accounts, provider/production/cron/SQL, Git or additional workers. Overall audit remains unfinished. See [segment23 report](/Users/tim/Code/fhfhockey.com/tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-23-inseason-trust-clarity/REPORT.md).

'''
prepared, scalar_checks = [], []
for i in [0,1]:
    s = raws[P[i]].decode()
    s = re.sub(r'As of `[^`]+`', f'As of `{now}`', s, count=1)
    s = s.replace('**215 current ledger rows**', '**217 current ledger rows**', 1)
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
        n = n.rstrip()+f'\n- **Segment23 reconciliation date:** `{now}`.\n- **Segment23 evidence:** '+refs+'.\n\n'
        s = s[:m.start()]+n+s[m.end():]
    prepared.append(s.rstrip()+'\n')

new['as_of'] = now
new['artifact_audit_segment23_20261024'] = dict(at=now, added_ids=added,
    changed_existing_ids=list(spec['changes']), visible_children_added=9,
    coverage=str((B/'COVERAGE.json').relative_to(R)), whole_tree_content_complete=False)
new['master_consolidation_plan'].update(after_sha256=sha(prepared[0].encode()), completed_at=now,
    task_rows_after=217, status='Segment23:217 IDs;80 readable children; full content audit unfinished.')
cand = {P[0]:prepared[0].encode(), P[1]:prepared[1].encode(), P[2]:(json.dumps(new,indent=2,ensure_ascii=False)+'\n').encode()}
oldids = [t['taskID'] for t in old['tasks']]; newids = [t['taskID'] for t in new['tasks']]
assert newids == oldids+added and len(set(newids)) == 217
for a,z in zip(old['tasks'],new['tasks']):
    assert a['scope'] == z['scope'] and z['evidence'][:len(a['evidence'])] == a['evidence']
    if a['taskID'] not in spec['changes']: assert a == z
legacy = [tid for tid in oldids if tid.startswith('MASTER-')]; assert len(legacy) == 32
for i in [0,1]:
    s = cand[P[i]].decode()
    assert collections.Counter(re.findall(r'^### (\S+) —',s,re.M)) == collections.Counter(newids)
    for tid in legacy: assert block(raws[P[i]].decode(),tid).group() == block(s,tid).group()
children = [v for t in new['tasks'] for v in t.get('children',[])]
assert len(children) == len({v['child_id'] for v in children}) == 80
ev = sum(len(t['evidence']) for t in new['tasks'])
assert ev == 1253 + sum(len(c['evidence']) for c in changes.values())
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
v = dict(at=now,before_ids=215,after_ids=217,before_evidence=1253,after_evidence=ev,
    added_ids=added,changed_existing_ids=list(spec['changes']), all_prior_ids_scopes_evidence_prefixes_preserved=True,
    legacy_blocks_byte_identical=32,unchanged_existing_rows_identical=211,
    readable_children_before=71,readable_children_after=80,scalar_label_checks=scalar_checks,
    canonical_before=start['canonical_before'],candidate_hashes={p:sha(raw) for p,raw in cand.items()},
    no_added_trailing_whitespace=True,application_tests_git_or_external_operations=0,whole_tree_content_audit_complete=False)
dump('VALIDATION-PREPARED.json',v)
if '--write' in sys.argv:
    assert {p:sha((R/p).read_bytes()) for p in P} == start['canonical_before'], 'Canonical drift; no write'
    assert all(sha((R/p).read_bytes()) == h for p,h in pins.items()), 'Snapshot drift; no write'
    assert all(sha((R/e['path']).read_bytes()) == e['sha256'] for e in cov['entries'] + cov['reused_prior_full_reviews'] + cov['structured_support'] + cov['metadata_support']), 'Reviewed source drift; no write'
    for p,raw in cand.items(): (R/p).write_bytes(raw)
    assert {p:sha((R/p).read_bytes()) for p in P} == v['candidate_hashes']
    dump('VALIDATION-CANONICAL.json',dict(v,canonical_written=True))
print(json.dumps({k:v for k,v in v.items() if k not in ['scalar_label_checks','canonical_before']}))
