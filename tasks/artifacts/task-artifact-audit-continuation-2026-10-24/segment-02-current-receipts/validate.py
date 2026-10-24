from pathlib import Path
import collections, datetime, difflib, hashlib, json, re, sys

ROOT=Path('/Users/tim/Code/fhfhockey.com'); OUT=Path(__file__).resolve().parent
START=json.loads((OUT/'START.json').read_text()); PATHS=[e['path'] for e in START['canonical_before']]
CANONICAL='--canonical' in sys.argv
BASE=[(OUT/('BASELINE-'+Path(p).name)).read_text() for p in PATHS]
TEXT=[(ROOT/p if CANONICAL else OUT/('CANDIDATE-'+Path(p).name)).read_text() for p in PATHS]
B=json.loads(BASE[2]); J=json.loads(TEXT[2]); LOG=json.loads((OUT/'CHANGELOG.json').read_text())
by={t['taskID']:t for t in J['tasks']}; ids=list(by); original=[t['taskID'] for t in B['tasks']]
assert len(J['tasks'])==len(ids)==206 and ids[:205]==original
assert ids[-1]=='AUTH-PATREON-TRANSACTION'
changed=set(LOG['changes'])
def block(text,tid):
    m=re.search(r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)',text,re.M|re.S);assert m,tid;return m.group(0)
for b in B['tasks']:
    a=by[b['taskID']];assert a['scope']==b['scope']
    assert a['evidence'][:len(b['evidence'])]==b['evidence']
    if b['taskID'] not in changed:assert a==b,b['taskID']
    assert a['owner'] in J['owners'] and a['reviewer'] in J['owners']
for i in [0,1]:
    before=re.findall(r'^### (\S+) —',BASE[i],re.M);after=re.findall(r'^### (\S+) —',TEXT[i],re.M)
    assert after[:205]==before and collections.Counter(after)==collections.Counter(ids)
    for tid,c in LOG['changes'].items():
        section=block(TEXT[i],tid)
        for k,v in c['fields'].items():assert v in section,(PATHS[i],tid,k)
        for e in c['new_evidence']:assert e['sha256'] in section,(PATHS[i],tid,e['path'])
        for clause in c['retained_clauses']:assert clause in section
legacy=['MASTER-'+x for x in B['master_consolidation_plan']['legacy_ids']]
for tid in legacy:
    for i in [0,1]:assert block(BASE[i],tid)==block(TEXT[i],tid),(PATHS[i],tid)
checked=[]
oldby={t['taskID']:t for t in B['tasks']}
for t in J['tasks']:
    for e in t['evidence'][len(oldby.get(t['taskID'],{}).get('evidence',[])):]:
        data=(ROOT/e['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==e['sha256'],e['path']
        assert 1<=e['line']<=e.get('end_line',e['line'])<=len(data.splitlines()),e['path']
        checked.append(e)
coverage=json.loads((OUT/'COVERAGE.json').read_text());coverage_checked=[]
for e in coverage['entries']:
    data=(ROOT/e['path']).read_bytes(); actual=hashlib.sha256(data).hexdigest()
    assert actual==e['sha256'],e['path']+' coverage advanced; read changed clauses before delivery'
    for lo,hi in e['reviewed_ranges']:assert 1<=lo<=hi<=len(data.splitlines())
    coverage_checked.append(e['path'])
assert J['sprint_control']==B['sprint_control']
archive=B['master_consolidation_plan']['archive']
assert hashlib.sha256((ROOT/archive).read_bytes()).hexdigest()==B['master_consolidation_plan']['before_sha256']
assert J['master_consolidation_plan']['after_sha256']==hashlib.sha256(TEXT[0].encode()).hexdigest()
new=J['tasks'][-1]
assert new['owner']==new['reviewer']=='UNASSIGNED'
for k in ['user_impact','next_action','dependencies','acceptance_release_gate','source_inputs']:assert new[k]
assert 'Proposed' in new['acceptance'] and 'No new release' in new['release']
assert 'superseded' in by['STATS-S06']['acceptance'] and 'exit2' in by['STATS-S06']['acceptance']
assert 'S12' in by['LUNA-LOCAL']['next_action'] and 'S12' in by['CRON-AUDIT-COVERAGE']['next_action']
assert 'independent Sol review' in by['SITE-FORGE-TESTING-GROUNDS']['dispatch_class']
patch=''.join(''.join(difflib.unified_diff(b.splitlines(True),a.splitlines(True),fromfile=p+'.before',tofile=p)) for p,b,a in zip(PATHS,BASE,TEXT))
(OUT/'CANONICAL-CHECKPOINT.patch').write_text(patch)
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'canonical' if CANONICAL else 'candidate','unique_ids':206,'prior205_ids_scopes_preserved':True,'original188_ids_retained_via_prior_checkpoint':True,'legacy_blocks_byte_identical_in_both_markdown_files':len(legacy),'prior_evidence_entries_preserved':sum(len(t['evidence']) for t in B['tasks']),'evidence_entries_after':sum(len(t['evidence']) for t in J['tasks']),'new_evidence_hash_line_checks':len(checked),'unchanged_rows_identical':205-len(changed),'changed_existing_rows':len(changed),'new_ids':[new['taskID']],'markdown_id_order_and_parity':True,'all_changed_fields_present_in_both_markdown_files':True,'archive_and_sprint_control_preserved':True,'coverage_current_hash_checks':len(coverage_checked),'hashes':{p:hashlib.sha256(s.encode()).hexdigest() for p,s in zip(PATHS,TEXT)},'application_test_runs':0,'production_requests':0,'git_mutations':0}
(OUT/('VALIDATION-canonical.json' if CANONICAL else 'VALIDATION-candidate.json')).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
