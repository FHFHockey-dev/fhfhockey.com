from pathlib import Path
import ast,contextlib,copy,difflib,hashlib,io,json,os,sys,unittest
B=Path('/Users/tim/Documents/Codex/2026-10-27/task-3');F=B/'blsh-validation-fixes-20261101-01'
O=Path('/Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-blsh-independent-review-2026-11-01/fix-rereview');O.mkdir(exist_ok=True)
lock=Path('/tmp/fhfh-heavy.lock')
try:lock.mkdir()
except FileExistsError:print('BLOCKED_SHARED_HEAVY_SLOT');sys.exit(2)
owner={'owner':'codex-blsh-independent-fix-rereview','pid':os.getpid()};(lock/'owner.json').write_text(json.dumps(owner))
read=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
result={}
try:
 C=B/'midseason-absence-cohort-20261101-01';A=B/'absence-ledger-replay-20261101-01'
 for root in [C,A]:
  for manifest in ['SOURCE-PINS.json','SHARED-SOURCE-PINS.json']:
   pins=read(root/manifest);assert all(sha(Path(p))==h for p,h in pins.items()),(root,manifest)
 for p,h in read(F/'FINAL-RECEIPT.json')['filesSHA256'].items():assert sha(Path(p))==h,p
 result['allCurrentAndFinalReceiptPinsMatch']=True
 before=[F/f'before-{i}-{name}' for i,name in enumerate(['cohort.py','test_cohort.py','SOURCE-PINS.json','ledger_replay.py','test_ledger_replay.py','SOURCE-PINS.json'])]
 after=[C/'cohort.py',C/'test_cohort.py',C/'SOURCE-PINS.json',A/'ledger_replay.py',A/'test_ledger_replay.py',A/'SOURCE-PINS.json']
 patch=''.join(''.join(difflib.unified_diff(old.read_text().splitlines(True),new.read_text().splitlines(True),fromfile=f'{F.name}/{old.name}',tofile=str(new))) for old,new in zip(before,after))
 assert patch==(F/'CHANGES.patch').read_text();result['patchMatchesActualFiles']=True
 sys.path[:0]=[str(C),str(A)]
 import cohort,ledger_replay,test_cohort,test_ledger_replay
 stream=io.StringIO();suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromModule(test_cohort),unittest.defaultTestLoader.loadTestsFromModule(test_ledger_replay)])
 run=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite);(O/'tests.log').write_text(stream.getvalue());assert run.wasSuccessful();result['testsPassed']=run.testsRun
 # Run the four new regression methods against only the old guard implementations in memory.
 mutation=[]
 for mod,func,old,testclass,methods in [(cohort,'qualify_episode',before[0],test_cohort.CohortTests,['test_empty_proof_list_never_source_qualified','test_missing_or_malformed_proof_references_rejected']),(ledger_replay,'event_from_row',before[3],test_ledger_replay.AdapterTests,['test_conflicting_metric_team_rejected','test_missing_metric_team_rejected'])]:
  node=next(n for n in ast.parse(old.read_text()).body if isinstance(n,ast.FunctionDef) and n.name==func);ns=dict(vars(mod));exec(compile(ast.Module(body=[node],type_ignores=[]),str(old),'exec'),ns);fixed=getattr(mod,func);setattr(mod,func,ns[func])
  try:
   for method in methods:
    log=io.StringIO();trial=unittest.TextTestRunner(stream=log,verbosity=2).run(testclass(method));assert not trial.wasSuccessful(),method
    (O/(method+'-old-guard.log')).write_text(log.getvalue());mutation.append({'test':method,'oldGuardRejectedByRegression':True,'failures':len(trial.failures),'errors':len(trial.errors)})
  finally:setattr(mod,func,fixed)
 result['regressionSensitivity']=mutation
 # Reproduce exact original probes against the current guards.
 c,g,f,_=test_cohort.CohortTests().fixture();c['proof_ids']=[]
 try:cohort.qualify_episode(c,g,f,[])
 except ValueError as e:result['emptyProofOriginalProbe']=str(e)
 else:raise AssertionError('Empty proofs accepted')
 row=test_ledger_replay.stat();row['team_abbrev']='BOS'
 try:ledger_replay.event_from_row(test_ledger_replay.event(),row,test_ledger_replay.KNOWN)
 except ValueError as e:result['foreignTeamOriginalProbe']=str(e)
 else:raise AssertionError('Foreign team accepted')
 # Missing whole row remains an unavailable observation, not a synthetic zero or absence.
 e=ledger_replay.event_from_row(test_ledger_replay.event(),None,test_ledger_replay.KNOWN)
 assert e.participation=='appeared' and e.value is None
 result['missingWholeRowStillUnavailable']=True
 comparisons=[]
 for root,names in [(C,['SUMMARY.json','BASELINES.json','TRACES.json']),(A,['SUMMARY.json','BASELINE.json','TRACES.json','VISUAL-CHECKS.json'])]:
  for name in names:
   old=root/'replay-01'/name;new=root/'replay-02'/name;assert old.read_bytes()==new.read_bytes();comparisons.append({'file':root.name+'/'+name,'sha256':sha(old),'exactBytesEqual':True})
 old=C/'qualification-01/QUALIFICATION.json';new=C/'qualification-02/QUALIFICATION.json';assert old.read_bytes()==new.read_bytes();comparisons.append({'file':'cohort qualification','sha256':sha(old),'exactBytesEqual':True})
 claimed=read(F/'EQUIVALENCE.json')
 for x,y in zip(comparisons,claimed['exactComparisons']):assert x['file']==y['file'] and x['sha256']==y['oldSHA256']==y['newSHA256']
 result['independentExactComparisons']=comparisons
 def clean(x):
  if isinstance(x,dict):return {k:clean(v) for k,v in x.items() if k!='known_at_utc'}
  if isinstance(x,list):return [clean(v) for v in x]
  return x
 eventcount=0;misses=0;apps=0;policycount=0
 for root in [C,A]:
  old=read(root/'replay-01/ADAPTER-EVENTS.json');new=read(root/'replay-02/ADAPTER-EVENTS.json');assert clean(old)==clean(new)
  oldgroups=old if isinstance(old,list) else [old];groups=new if isinstance(new,list) else [new]
  for oldgroup,group in zip(oldgroups,groups):
   for olde,e in zip(oldgroup['events'],group['events']):
    assert olde['known_at_utc']!=e['known_at_utc'];eventcount+=1
    if e['participation']=='confirmed_absent':assert e['value'] is None;misses+=1
    else:assert e['participation']=='appeared' and e['value'] is not None;apps+=1
  traces=read(root/'replay-02/TRACES.json');sets=traces.values() if root==C else [traces]
  for policies in sets:
   assert len(policies)==5
   policycount+=sum(len(trace) for trace in policies.values())
 result['eventsEqualExceptKnownAt']=True;result['uniqueLedgerEvents']=eventcount;result['absencesNull']=misses;result['appearances']=apps;result['policySteps']=policycount
 assert (misses,apps,policycount)==(37,22,295)
 receipts=[]
 for root,dirs in [(C,['tests-02','qualification-02','replay-02']),(A,['tests-02','replay-02'])]:
  for directory in dirs:
   r=read(root/directory/'PROCESS-RECEIPT.json');assert r['exitCode']==0 and r['ownLockReleased'] is True
   receipts.append({'folder':str(root/directory),'exitCode':r['exitCode'],'elapsedSeconds':r['elapsedSeconds']})
 result['implementerProcessReceipts']=receipts
 result['newProviderCalls']=0;result['reservedSeasonReads']=0
finally:
 assert read(lock/'owner.json')==owner
 lock.rename(O/'heavy-lock-released')
(O/'RESULTS.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
