from pathlib import Path
import datetime,hashlib,json,os,subprocess,uuid
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent
m=json.loads((O/'CANDIDATE.json').read_text());S=Path(m['snapshot']);W=S/'web';H=S.parent/'home';T=S.parent/'tmp';H.mkdir(exist_ok=True);T.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert not (O/'RESULT.json').exists(),'preserve previous result'
assert sha(R/'web/package-lock.json')==sha(W/'package-lock.json'),'dependencies changed'
env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':str(H),'TMPDIR':str(T),'NEXT_PUBLIC_SUPABASE_URL':'https://unit-tests.supabase.invalid','NEXT_PUBLIC_SUPABASE_PUBLIC_KEY':'synthetic-public-key','SUPABASE_SERVICE_ROLE_KEY':'synthetic-service-role-key','NODE_OPTIONS':'--max-old-space-size=8192 --require '+str(O/'offline-network-deny.cjs'),'npm_config_offline':'true','npm_config_audit':'false','npm_config_fund':'false','npm_config_update_notifier':'false','TZ':'UTC','CI':'1','PLAYWRIGHT_ISOLATED_NEXT':'1'}
assert 'GIT_DIR' not in env
paths=['lib/projections/apiHelpers.runAdmission.test.ts','lib/player-forecasts/nativeContributionAdmission.test.ts','lib/rosterScheduleOptimizer/currentPlanningRead.test.ts','lib/integrations/yahoo/planningConfirmationRoute.test.ts','__tests__/pages/api/v1/start-chart.test.ts']
lint=sorted(n[4:] for n in m['selectedPins'] if n.endswith(('.ts','.tsx','.js','.mjs')))
commands=[('tests',['npm','exec','--no','--','vitest','run',*paths,'--maxWorkers=1','--minWorkers=1','--reporter=json','--outputFile='+str(O/'tests.json')]),('types',['npm','exec','--no','--','tsc','--noEmit','--pretty','false']),('lint',['npm','exec','--no','--','eslint',*lint])]
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'pid':os.getpid(),'token':str(uuid.uuid4()),'thread':'01a1637a-4222-70c0-8439-cb3cc46b20c4','scope':'Frozen3637-file web candidate;5 targeted test files then application TS and109-pin lint; no fullsuite/server','at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
try:lock.mkdir()
except FileExistsError:print('LOCK_OCCUPIED; nothing started',flush=True);raise SystemExit(2)
(lock/'owner.json').write_text(json.dumps(owner));ino=lock.stat().st_ino;results=[]
try:
 node=subprocess.check_output(['node','--version'],env=env,text=True).strip();npm=subprocess.check_output(['npm','--version'],env=env,text=True).strip();assert node=='v22.11.0',node
 (O/'COMMANDS.json').write_text(json.dumps({'cwd':str(W),'environment':env,'node':node,'npm':npm,'commands':commands,'lock':owner,'packageLockSha256':sha(W/'package-lock.json'),'installedDependencyLockSha256':sha(R/'web/node_modules/.package-lock.json') if (R/'web/node_modules/.package-lock.json').exists() else None},indent=2)+'\n')
 for name,argv in commands:
  start=datetime.datetime.now(datetime.timezone.utc).isoformat();print(name+' started',flush=True)
  with (O/(name+'.log')).open('w') as out:p=subprocess.run(argv,cwd=W,env=env,stdout=out,stderr=subprocess.STDOUT)
  results.append({'name':name,'exitCode':p.returncode,'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat()});print(name+' exit '+str(p.returncode),flush=True)
finally:
 drift=[n for n,h in m['files'].items() if not (S/n).is_file() or sha(S/n)!=h]
 current=[n for n,h in m['selectedPins'].items() if not (R/n).is_file() or sha(R/n)!=h]
 (O/'RESULT.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results,'snapshotDrift':drift,'currentSelectedPinDrift':current,'contentTreeSha256':m['contentTreeSha256'],'archiveSha256':m['archiveSha256'],'sourceFiles':len(m['files'])},indent=2)+'\n')
 if lock.is_dir() and lock.stat().st_ino==ino and json.loads((lock/'owner.json').read_text())['token']==owner['token']:(lock/'owner.json').unlink();lock.rmdir()
