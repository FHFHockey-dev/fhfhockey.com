"""Guarded documentary reconciliation; no application imports or Git."""
from pathlib import Path
import collections, copy, datetime, difflib, hashlib, json, re, sys
R = Path('/Users/tim/Code/fhfhockey.com')
B = R / 'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-09-draft-yahoo-audit'
P = ['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md',
     'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md',
     'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json']
sha = lambda b: hashlib.sha256(b).hexdigest()
load = lambda n: json.loads((B / n).read_text())
dump = lambda n, d: (B / n).write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
start, cov, spec = load('START.json'), load('COVERAGE.json'), load('PROPOSED-CHANGES.json')
raws = {p: (R / p).read_bytes() for p in P}
assert all(sha(raws[p]) == start['canonical_before'][p] for p in P), 'Canonical drift; no write'
for e in cov['entries']:
    assert sha((R / e['path']).read_bytes()) == e['sha256'], 'Reviewed source changed: ' + e['path']
narrow = load('NARROW-SOURCE-COVERAGE.json')
assert sha((R / narrow['path']).read_bytes()) == narrow['sha256'], 'Narrow contradiction source changed'
stamp = B / 'CHECKPOINT-TIME.txt'
if not stamp.exists():
    stamp.write_text(datetime.datetime.now(datetime.timezone.utc).isoformat() + '\n')
now = stamp.read_text().strip()
old = json.loads(raws[P[2]])
assert len(old['tasks']) == 207 and sum(len(t['evidence']) for t in old['tasks']) == 982
for p, raw in raws.items():
    dest = B / ('BASELINE-' + Path(p).name)
    if dest.exists():
        assert dest.read_bytes() == raw
    else:
        dest.write_bytes(raw)
new = copy.deepcopy(old)
byid = {t['taskID']: t for t in new['tasks']}
changes = copy.deepcopy(spec['changes'])
added_ids = []
for addition in spec['additions']:
    t = copy.deepcopy(addition['row'])
    tid = t['taskID']
    assert tid not in byid
    added_ids.append(tid)
    new['tasks'].append(t)
    byid[tid] = t
    changes[tid] = dict(fields={}, refs=copy.deepcopy(addition['refs']), is_new=True)
snapdir = B / 'source-snapshots'
snapdir.mkdir(exist_ok=True)
snaps, pins = {}, {}
for tid, c in changes.items():
    assert not tid.startswith('MASTER-')
    t = byid[tid]
    c['before_fields'] = {k: t.get(k) for k in c['fields']}
    c['evidence'] = []
    for path, line in c.pop('refs'):
        raw = (R / path).read_bytes()
        h = sha(raw)
        assert 1 <= line <= len(raw.decode().splitlines())
        dest = snapdir / (h[:12] + '-' + Path(path).name)
        if dest.exists():
            assert dest.read_bytes() == raw
        else:
            dest.write_bytes(raw)
        rel = str(dest.relative_to(R))
        pins[rel] = h
        snaps[path] = dict(path=rel, sha256=h, original_path=path, observed_at=now)
        c['evidence'].append(dict(path=rel, original_path=path, line=line, sha256=h,
                                  observed_at=now,
                                  review_scope='Full referenced document or explicitly bounded extract reviewed. Underlying app/coordination/visual/hosted claims retain documented limits; no stored command executed. Snapshot is evidence, not authority.'))
    t.setdefault('artifact_audit_segment09', []).append(dict(at=now, before_fields=c['before_fields'],
        note='Dated documentary/status overlay; prior scopes/evidence, original failures and narrower closures preserved. No implementation/external authority.'))
    t.update(c['fields'])
    t['as_of'] = now
    t['evidence'].extend(c['evidence'])

overlay = f'''## Draft Dashboard/Yahoo full-content checkpoint — {now}

208 stable IDs preserve all207 prior IDs/scopes and982 earlier evidence entries. One proposed/unassigned P3 SITE-PICKUP-TOKENS carries source NEW15/C0057 exactly once: the current local Yahoo-context block still contains raw colors after the prior shared-token cleanup. The old nested source pointer is absent; the actual file is web/components/PlayerPickupTable/PlayerPickupTable.module.scss. Only lines1744–1766 were read; no application edit/test/Git/production action. July restyle, responsive/accessibility and season-identity closures remain credited.

Full paired Draft/Yahoo documents preserve completed A-DRAFT work, July13 inline-settings decision and July31 canonical-reader/atomic-writer closure. Older scaffold/per-row-query/pruning/duplicate-ingestion instructions do not reopen work. Controlled provider/league equivalence, legacy retirement, resumable history and final end-to-end reconciliation remain held. October18 saved-draft private imports are a documented exception to blanket free-dashboard session-only wording, requiring verified owner facts before privacy copy.

Testing Grounds S05-R1 lifecycle correction and player-card S01/S02-R1 now have bounded independent and coordinator-recorded parent local acceptance. Original failed evidence stays intact. Owner activation remains separately blocked0of1approved reads used; card S03, phone PNG legibility, observed population/history/source/rights/premium and full-feature gates remain unaccepted here. These limited outcomes supersede earlier pending-review paragraphs, not their underlying source history.

Coverage:16full repository documents/372245bytes, plus explicitly bounded alias/coordination/current-source extracts. Original inventory, duplicate/exclusion mapping and segment08 support dispositions are retained. This is a segment checkpoint, not whole-tree content completion. See [segment09](/Users/tim/Code/fhfhockey.com/tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-09-draft-yahoo-audit/REPORT.md).

'''
labels = dict(implementation='Implementation', acceptance='Acceptance', verification='Verification',
              next_action='Next', dispatch_class='Dispatch class', dependencies='Dependencies')
def block(s, tid):
    m = re.search(r'^### ' + re.escape(tid) + r' —.*?(?=^### |^## |\Z)', s, re.M | re.S)
    assert m, tid
    return m

def new_block(t):
    lines = ['### ' + t['taskID'] + ' — ' + t['scope'], '']
    for key in ['user_impact', 'implementation', 'acceptance', 'release', 'owner', 'reviewer',
                'dependencies', 'verification', 'acceptance_release_gate', 'next_action',
                'evidence_level', 'evidence_scope', 'dispatch_class']:
        lines.append('- **' + labels.get(key, key.replace('_', ' ').capitalize()) + ':** ' + t[key])
    lines.append('- **Source aliases:** ' + '; '.join(t['source_inputs']))
    return '\n'.join(lines) + '\n\n'

prepared = []
for i in [0, 1]:
    s = raws[P[i]].decode()
    s = re.sub(r'As of `[^`]+`', f'As of `{now}`', s, count=1)
    s = s.replace('**207 current ledger rows**', '**208 current ledger rows**', 1)
    s = s.replace('**CHECKPOINT AGGREGATION COMPLETE:**', '**HISTORICAL CHECKPOINT AGGREGATION (earlier205-ID phase):**', 1)
    cut = s.index('\n## ')
    s = s[:cut] + '\n\n' + overlay.rstrip() + '\n' + s[cut:]
    for tid in added_ids:
        s = s.rstrip() + '\n\n' + new_block(byid[tid])
    for tid, c in changes.items():
        m = block(s, tid)
        n = m.group()
        for key, value in c['fields'].items():
            before = c['before_fields'][key]
            if isinstance(before, str) and before in n:
                n = n.replace(before, value, 1)
                if value.endswith('.'):
                    n = n.replace(value + '.', value, 1)
            else:
                n = n.rstrip() + f'\n- **Current {labels.get(key,key)}:** {value}\n\n'
            assert value in n
        refs = '; '.join(f'[{e["original_path"]}:{e["line"]}](</Users/tim/Code/fhfhockey.com/{e["path"]}:{e["line"]}>) SHA256 `{e["sha256"]}`' for e in c['evidence'])
        n = n.rstrip() + f'\n- **Segment09 reconciliation date:** `{now}`.\n- **Segment09 evidence:** ' + refs + '.\n\n'
        s = s[:m.start()] + n + s[m.end():]
    prepared.append(s.rstrip() + '\n')
new['as_of'] = now
new['artifact_audit_segment09_20261024'] = dict(at=now, changed_existing_ids=list(spec['changes']),
    added_ids=added_ids, coverage=str((B / 'COVERAGE.json').relative_to(R)), whole_tree_content_complete=False)
new['master_consolidation_plan'].update(after_sha256=sha(prepared[0].encode()), completed_at=now,
    task_rows_after=208, status='October24 segment09:208 IDs; full Draft/Yahoo chronology and narrow proposed token recurrence; full-corpus content audit unfinished.')
cand = {P[0]: prepared[0].encode(), P[1]: prepared[1].encode(),
        P[2]: (json.dumps(new, indent=2, ensure_ascii=False) + '\n').encode()}
for p, raw in cand.items():
    (B / ('CANDIDATE-' + Path(p).name)).write_bytes(raw)
old_ids = [t['taskID'] for t in old['tasks']]
new_ids = [t['taskID'] for t in new['tasks']]
assert new_ids == old_ids + added_ids and len(set(new_ids)) == 208
for a, z in zip(old['tasks'], new['tasks']):
    assert a['scope'] == z['scope'] and z['evidence'][:len(a['evidence'])] == a['evidence']
    if a['taskID'] not in spec['changes']:
        assert a == z
legacy = [tid for tid in old_ids if tid.startswith('MASTER-')]
assert len(legacy) == 32
for i in [0, 1]:
    s = cand[P[i]].decode()
    assert collections.Counter(re.findall(r'^### (\S+) —', s, re.M)) == collections.Counter(new_ids)
    for tid in legacy:
        assert block(raws[P[i]].decode(), tid).group() == block(s, tid).group(), (i, tid)
patch = ''.join(''.join(difflib.unified_diff(raws[p].decode().splitlines(True), cand[p].decode().splitlines(True),
                fromfile='before/' + p, tofile='after/' + p)) for p in P)
assert not [l for l in patch.splitlines() if l.startswith('+') and not l.startswith('+++') and l[1:] != l[1:].rstrip()]
(B / 'CANONICAL-CHECKPOINT.patch').write_text(patch)
dump('SOURCE-SNAPSHOT-INDEX.json', dict(cutoff=now, sources=snaps))
dump('SOURCE-PINS.json', pins)
dump('CHANGELOG.json', dict(at=now, changes=changes, added_ids=added_ids, deduplication=spec['deduplication']))
validation = dict(at=now, before_ids=207, after_ids=208, before_evidence=982,
    after_evidence=sum(len(t['evidence']) for t in new['tasks']), changed_existing_ids=list(spec['changes']),
    added_ids=added_ids, all_prior_ids_scopes_and_evidence_prefixes_preserved=True,
    legacy_blocks_byte_identical_each_markdown=32, unchanged_existing_rows_identical=207-len(spec['changes']),
    no_added_trailing_whitespace=True, canonical_before=start['canonical_before'],
    candidate_hashes={p: sha(raw) for p, raw in cand.items()}, application_git_or_production_operations=0,
    whole_tree_content_audit_complete=False)
dump('VALIDATION-PREPARED.json', validation)
if '--write' in sys.argv:
    assert all(sha((R / p).read_bytes()) == h for p, h in start['canonical_before'].items()), 'Canonical drift; no write'
    assert all(sha((R / p).read_bytes()) == h for p, h in pins.items()), 'Snapshot drift; no write'
    for p, raw in cand.items():
        (R / p).write_bytes(raw)
    assert all((R / p).read_bytes() == raw for p, raw in cand.items())
    validation['canonical_written_and_read_back'] = True
    dump('VALIDATION-CANONICAL.json', validation)
print(json.dumps(validation, indent=2))
