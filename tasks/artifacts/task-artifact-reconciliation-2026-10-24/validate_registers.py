from pathlib import Path
import json,re,hashlib,collections,sys,datetime
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
mode='canonical' if '--canonical' in sys.argv else 'candidate';base=json.loads((OUT/'BASELINE-LEDGER.json').read_text())
paths=['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md','tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md','tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json']
texts=[(ROOT/p if mode=='canonical' else OUT/('CANDIDATE-'+Path(p).name)).read_text() for p in paths];D=json.loads(texts[2]);ids=[t['taskID'] for t in D['tasks']];orig=[t['taskID'] for t in base['tasks']];assert len(ids)==len(set(ids))==205;assert ids[:189]==orig
for name,text in zip(['MASTER-TASKLIST-2026-10-20.md','LEDGER.md'],texts[:2]):
 found=re.findall(r'^### (\S+) —',text,re.M);baseline_order=re.findall(r'^### (\S+) —',(OUT/('BASELINE-'+name)).read_text(),re.M)
 assert collections.Counter(found)==collections.Counter(ids);assert found[:189]==baseline_order;assert found[189:]==ids[189:]
for i,b in enumerate(base['tasks']):
 a=D['tasks'][i];assert a['scope']==b['scope'];assert a['evidence'][:len(b['evidence'])]==b['evidence'];assert a['owner'] in D['owners'];assert a['reviewer'] in D['owners']
legacy=['MASTER-'+x for x in base['master_consolidation_plan']['legacy_ids']]
for tid in legacy:
 pattern=r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)'
 before=re.search(pattern,(OUT/'BASELINE-MASTER-TASKLIST-2026-10-20.md').read_text(),re.M|re.S).group(0);after=re.search(pattern,texts[0],re.M|re.S).group(0);assert before==after,tid
oldby={t['taskID']:t for t in base['tasks']};checked=[];historical_advanced=[]
coverage={r['path']:r for r in json.loads((OUT/'COVERAGE.json').read_text())['entries']}
for t in D['tasks']:
 if t['taskID'] not in D['artifact_audit_20261024']['changed_ids'] and t['taskID'] in oldby:assert t==oldby[t['taskID']]
 for e in t['evidence'][len(oldby.get(t['taskID'],{}).get('evidence',[])):]:
  p=ROOT/e['path'];b=p.read_bytes();actual=hashlib.sha256(b).hexdigest()
  if actual!=e['sha256']:
   known=coverage.get(e['path'],{});historical={x.get('sha256') for x in known.get('history',[])}
   assert e['sha256'] in historical,str(p)+' advanced without historical observation';historical_advanced.append({'path':e['path'],'dated_sha256':e['sha256'],'current_sha256':actual})
  else:checked.append(e)
  assert 1<=e['line']<=len(b.splitlines()),p
for t in D['tasks'][189:]:
 assert t['owner']=='UNASSIGNED' and t['reviewer']=='UNASSIGNED';assert t['user_impact'] and t['next_action'] and t['dependencies'] and t['acceptance_release_gate'];assert t['source_inputs'];assert 'No new release' in t['release']
assert D['sprint_control']['state']==base['sprint_control']['state'];assert D['sprint_control']['latest_policy']==base['sprint_control']['latest_policy'];assert not D['sprint_control']['bounded_dispatches_20261024']['general_sprint_resumed']
assert hashlib.sha256((ROOT/base['master_consolidation_plan']['archive']).read_bytes()).hexdigest()==base['master_consolidation_plan']['before_sha256']
hashes={p:hashlib.sha256(x.encode()).hexdigest() for p,x in zip(paths,texts)};assert D['master_consolidation_plan']['after_sha256']==hashes[paths[0]]
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':mode,'unique_ids':len(ids),'baseline_ids_preserved':len(orig),'original_ids_preserved':188,'legacy_blocks_byte_identical':len(legacy),'baseline_evidence_entries_preserved':sum(len(t['evidence']) for t in base['tasks']),'after_evidence_entries':sum(len(t['evidence']) for t in D['tasks']),'new_ids':16,'changed_existing_ids':len(D['artifact_audit_20261024']['changed_ids']),'new_evidence_refs_current_hash_line_validated':len(checked),'dated_evidence_refs_advanced_and_preserved':historical_advanced,'all_unchanged_rows_identical':True,'archive_verified':True,'hashes':hashes};(OUT/('VALIDATION-'+mode+'.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
