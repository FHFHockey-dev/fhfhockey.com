from pathlib import Path
import collections, datetime, difflib, hashlib, json, re, sys
ROOT=Path('/Users/tim/Code/fhfhockey.com');OUT=Path(__file__).resolve().parent
S=json.loads((OUT/'START.json').read_text());PATHS=list(S['canonical_checkpoint']);canonical='--canonical' in sys.argv
BASE=[(OUT/('BASELINE-'+Path(p).name)).read_text() for p in PATHS]
TEXT=[(ROOT/p if canonical else OUT/('CANDIDATE-'+Path(p).name)).read_text() for p in PATHS]
B=json.loads(BASE[2]);J=json.loads(TEXT[2]);L=json.loads((OUT/'CHANGELOG.json').read_text());by={t['taskID']:t for t in J['tasks']};ids=list(by)
assert len(J['tasks'])==len(ids)==206 and ids==[t['taskID'] for t in B['tasks']]
def block(s,tid):
 m=re.search(r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)',s,re.M|re.S);assert m,tid;return m.group(0)
for b in B['tasks']:
 a=by[b['taskID']];assert a['scope']==b['scope'];assert a['evidence'][:len(b['evidence'])]==b['evidence']
 if b['taskID'] not in L['changes']:assert a==b,b['taskID']
 assert a['owner'] in J['owners'] and a['reviewer'] in J['owners']
for i in [0,1]:
 before=re.findall(r'^### (\S+) —',BASE[i],re.M);after=re.findall(r'^### (\S+) —',TEXT[i],re.M)
 assert before==after and collections.Counter(after)==collections.Counter(ids)
 for tid,c in L['changes'].items():
  section=block(TEXT[i],tid)
  for k,v in c['fields'].items():assert v in section,(PATHS[i],tid,k)
  for e in c['new_evidence']:assert e['sha256'] in section
legacy=['MASTER-'+x for x in B['master_consolidation_plan']['legacy_ids']]
for tid in legacy:
 for i in [0,1]:assert block(BASE[i],tid)==block(TEXT[i],tid),(PATHS[i],tid)
checked=0
for c in L['changes'].values():
 for e in c['new_evidence']:
  b=(ROOT/e['path']).read_bytes();assert hashlib.sha256(b).hexdigest()==e['sha256'];assert 1<=e['line']<=len(b.splitlines());checked+=1
coverage=json.loads((OUT/'COVERAGE.json').read_text())
for e in coverage['entries']:
 b=(ROOT/e['path']).read_bytes();assert hashlib.sha256(b).hexdigest()==e['sha256'],e['path']+' changed since read'
 for lo,hi in e['reviewed_ranges']:assert 1<=lo<=hi<=len(b.splitlines())
assert J['sprint_control']==B['sprint_control']
assert hashlib.sha256((ROOT/B['master_consolidation_plan']['archive']).read_bytes()).hexdigest()==B['master_consolidation_plan']['before_sha256']
assert J['master_consolidation_plan']['after_sha256']==hashlib.sha256(TEXT[0].encode()).hexdigest()
assert 'ACCEPT WITH LIMITS' in by['BILLING-CANCEL-RELOAD']['implementation']
assert 'physical retention guarantee' in by['BILLING-CANCEL-RELOAD']['acceptance']
assert 'CHANGES REQUIRED' in by['SITE-FORGE-TESTING-GROUNDS']['acceptance'] and 'S03-R1' in by['SITE-FORGE-TESTING-GROUNDS']['next_action']
assert 'intentionally parked' in by['REPO-DOCUMENTATION']['next_action']
patch=''.join(''.join(difflib.unified_diff(b.splitlines(True),a.splitlines(True),fromfile=p+'.v4',tofile=p)) for p,b,a in zip(PATHS,BASE,TEXT));(OUT/'CANONICAL-CHECKPOINT.patch').write_text(patch)
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':'canonical' if canonical else 'candidate','ids_preserved':206,'new_ids':0,'all_scopes_preserved':True,'baseline_evidence_preserved':sum(len(t['evidence']) for t in B['tasks']),'evidence_after':sum(len(t['evidence']) for t in J['tasks']),'new_evidence_hash_line_checks':checked,'changed_existing_rows':len(L['changes']),'unchanged_rows_identical':206-len(L['changes']),'legacy_blocks_identical_both_markdown':len(legacy),'markdown_order_and_field_parity':True,'coverage_exact_hash_checks':len(coverage['entries']),'archive_and_sprint_control_preserved':True,'hashes':{p:hashlib.sha256(t.encode()).hexdigest() for p,t in zip(PATHS,TEXT)},'application_tests':0,'source_repairs':0,'production_requests':0,'git_mutations':0,'overall_tree_audit_complete':False}
(OUT/('VALIDATION-canonical.json' if canonical else 'VALIDATION-candidate.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
