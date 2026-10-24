from pathlib import Path
import datetime,hashlib,json,os,subprocess,uuid
R=Path('/Users/tim/Code/fhfhockey.com');V=Path(__file__).resolve().parent;O=V.parent;M=json.loads((V/'CANDIDATE.json').read_text());S=Path(M['snapshot']);W=S/'web';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert not (V/'RESULT.json').exists(),'preserve existing result'
env=json.loads((O/'COMMANDS.json').read_text())['environment'];env.update(HOME=str(S.parent/'home'),TMPDIR=str(S.parent/'tmp'))
Path(env['HOME']).mkdir();Path(env['TMPDIR']).mkdir();assert 'GIT_DIR' not in env
paths=['lib/projections/apiHelpers.runAdmission.test.ts','lib/player-forecasts/nativeContributionAdmission.test.ts','lib/integrations/yahoo/planningConfirmationRoute.test.ts','__tests__/pages/api/v1/start-chart.test.ts'];assert all((W/n).is_file() for n in paths)
config={'extends':str(W/'tsconfig.json'),'compilerOptions':{'incremental':False},'include':[str(W/'next-bootstrap.d.ts'),str(W/'yahoo-fantasy.d.ts'),str(W/'__tests__/pages/api/v1/start-chart.test.ts')]}
(V/'tsconfig.json').write_text(json.dumps(config,indent=2)+'\n')
commands=[('tests',['npm','exec','--no','--','vitest','run',*paths,'--maxWorkers=1','--minWorkers=1','--reporter=json','--outputFile='+str(V/'tests.json')]),('scoped-types',['npm','exec','--no','--','tsc','--project',str(V/'tsconfig.json'),'--noEmit','--pretty','false']),('scoped-lint',['npm','exec','--no','--','eslint','__tests__/pages/api/v1/start-chart.test.ts'])]
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'pid':os.getpid(),'token':str(uuid.uuid4()),'thread':'01a1637a-4222-70c0-8439-cb3cc46b20c4','scope':'R1 parent-reviewed test-only correction;4 matched boundary files then changed-file scoped types/lint; no server/fullsuite','at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
try:lock.mkdir()
except FileExistsError:print('LOCK_OCCUPIED; nothing started',flush=True);raise SystemExit(2)
(lock/'owner.json').write_text(json.dumps(owner));ino=lock.stat().st_ino;results=[]
try:
 node=subprocess.check_output(['node','--version'],env=env,text=True).strip();npm=subprocess.check_output(['npm','--version'],env=env,text=True).strip();assert node=='v22.11.0',node
 (V/'COMMANDS.json').write_text(json.dumps({'cwd':str(W),'environment':env,'node':node,'npm':npm,'matchedFiles':paths,'commands':commands,'lock':owner,'packageLockSha256':sha(W/'package-lock.json')},indent=2)+'\n')
 for name,argv in commands:
  start=datetime.datetime.now(datetime.timezone.utc).isoformat();print(name+' started',flush=True)
  with (V/(name+'.log')).open('w') as out:r=subprocess.run(argv,cwd=W,env=env,stdout=out,stderr=subprocess.STDOUT)
  results.append({'name':name,'exitCode':r.returncode,'started':start,'finished':datetime.datetime.now(datetime.timezone.utc).isoformat()});print(name+' exit '+str(r.returncode),flush=True)
finally:
 drift=[n for n,h in M['files'].items() if not (S/n).is_file() or sha(S/n)!=h]
 (V/'RESULT.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results,'snapshotDrift':drift,'sourceFiles':len(M['files']),'contentTreeSha256':M['contentTreeSha256'],'archiveSha256':M['archiveSha256'],'canonicalLeasedFileSha256':sha(R/'web/__tests__/pages/api/v1/start-chart.test.ts'),'oldArchiveUnchanged':sha(O/'candidate-source.tar.gz')==M['parentArchiveSha256'],'oldFailureReceiptSha256':sha(O/'tests.json'),'oldDiagnosticsReceiptSha256':sha(O/'diagnostics/tests.json')},indent=2)+'\n')
 if lock.is_dir() and lock.stat().st_ino==ino and json.loads((lock/'owner.json').read_text())['token']==owner['token']:(lock/'owner.json').unlink();lock.rmdir()
