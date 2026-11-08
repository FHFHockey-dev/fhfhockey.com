from pathlib import Path
import datetime,hashlib,json,os,subprocess,sys,uuid
label='review-regressions-green' if '--green' in sys.argv else 'review-regressions-red'
out=Path(__file__).resolve().parent;m=json.loads((out/'CANDIDATE.json').read_text());cwd=Path(m['exportRoot'])/'web'
lock=Path('/private/tmp/fhfh-heavy.lock');token=str(uuid.uuid4())
try:lock.mkdir()
except FileExistsError:raise SystemExit('Heavy slot occupied; no checks started')
(lock/'owner.json').write_text(json.dumps({'owner':'Scout RSO review regression proof','token':token,'pid':os.getpid()}))
env={'PATH':'/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin','HOME':os.environ['HOME'],'TMPDIR':os.environ.get('TMPDIR','/tmp'),'NODE_OPTIONS':'--require '+str(out/'loopback-only.cjs'),'NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:9','NEXT_PUBLIC_SUPABASE_PUBLIC_KEY':'synthetic-public-key','SUPABASE_SERVICE_ROLE_KEY':'synthetic-service-role-key','NEXT_TELEMETRY_DISABLED':'1','TZ':'UTC'}
cmd=['node','node_modules/vitest/vitest.mjs','run','lib/rosterScheduleOptimizer/planning.test.ts','-t','injured started-game locks|claims only strictly post-acquisition games','--maxWorkers=1','--reporter=dot','--reporter=json','--outputFile.json='+str(out/(label+'-results.json'))]
try:
 with (out/(label+'.log')).open('w') as log:r=subprocess.run(cmd,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=60)
 receipt={'exitCode':r.returncode,'command':cmd,'runtimeSourceSha256':hashlib.sha256((cwd/'lib/rosterScheduleOptimizer/planning.ts').read_bytes()).hexdigest(),'testSourceSha256':hashlib.sha256((cwd/'lib/rosterScheduleOptimizer/planning.test.ts').read_bytes()).hexdigest(),'at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 (out/(label+'.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));print((out/(label+'.log')).read_text()[-4500:])
finally:
 if lock.exists() and json.loads((lock/'owner.json').read_text())['token']==token:(lock/'owner.json').unlink();lock.rmdir()
