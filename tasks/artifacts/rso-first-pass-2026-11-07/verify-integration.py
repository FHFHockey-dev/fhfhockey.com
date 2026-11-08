from pathlib import Path
import datetime,hashlib,json,os,subprocess,uuid
out=Path(__file__).resolve().parent;repo=out.parents[2];m=json.loads((out/'CANDIDATE.json').read_text());cwd=Path(m['exportRoot'])/'web';paths=['web/lib/rosterScheduleOptimizer/planning.ts','web/lib/rosterScheduleOptimizer/planning.test.ts']
for row in m['overlayFiles']:
 assert hashlib.sha256((repo/row['path']).read_bytes()).hexdigest()==row['sha256'],row['path']
 assert hashlib.sha256((cwd.parent/row['path']).read_bytes()).hexdigest()==row['sha256'],row['path']
assert not list(cwd.glob('.env*'))
lock=Path('/private/tmp/fhfh-heavy.lock');token=str(uuid.uuid4())
try:lock.mkdir()
except FileExistsError:raise SystemExit('Heavy slot occupied; no checks started')
(lock/'owner.json').write_text(json.dumps({'owner':'Scout RSO canonical integration verification','token':token,'pid':os.getpid()}))
env={'PATH':'/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin','HOME':os.environ['HOME'],'TMPDIR':os.environ.get('TMPDIR','/tmp'),'NODE_OPTIONS':'--require '+str(out/'loopback-only.cjs'),'NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:9','NEXT_PUBLIC_SUPABASE_PUBLIC_KEY':'synthetic-public-key','SUPABASE_SERVICE_ROLE_KEY':'synthetic-service-role-key','NEXT_TELEMETRY_DISABLED':'1','TZ':'UTC'}
commands=[('integration-planning',['node','node_modules/vitest/vitest.mjs','run','lib/rosterScheduleOptimizer/planning.test.ts','--maxWorkers=1','--reporter=dot','--reporter=json','--outputFile.json='+str(out/'integration-planning-results.json')]),('integration-lint',['node','node_modules/eslint/bin/eslint.js',*[p.removeprefix('web/') for p in paths]])]
results=[]
try:
 for label,cmd in commands:
  start=datetime.datetime.now(datetime.timezone.utc).isoformat()
  with (out/(label+'.log')).open('w') as log:r=subprocess.run(cmd,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=90)
  receipt={'name':label,'exitCode':r.returncode,'command':cmd,'cwd':str(cwd),'candidateTree':m['candidateTree'],'canonicalPathsMatchCandidate':True,'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'log':label+'.log','network':'inert environment and Node loopback guard'}
  (out/(label+'.json')).write_text(json.dumps(receipt,indent=2)+'\n');results.append(receipt);print(json.dumps(receipt));print((out/(label+'.log')).read_text()[-1500:])
 (out/'INTEGRATION-CHECKS.json').write_text(json.dumps(results,indent=2)+'\n')
finally:
 if lock.exists() and json.loads((lock/'owner.json').read_text())['token']==token:(lock/'owner.json').unlink();lock.rmdir()
