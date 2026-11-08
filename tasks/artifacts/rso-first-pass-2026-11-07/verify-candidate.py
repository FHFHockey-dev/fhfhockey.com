from pathlib import Path
import datetime, hashlib, json, os, shutil, signal, subprocess, sys, uuid
out=Path(__file__).resolve().parent
manifest=json.loads((out/'CANDIDATE.json').read_text()); root=Path(manifest['exportRoot']); cwd=root/'web'
for row in manifest['overlayFiles']:
 assert hashlib.sha256((root/row['path']).read_bytes()).hexdigest()==row['sha256'], row['path']
assert not list(cwd.glob('.env*'))
guard=out/'loopback-only.cjs'
if not guard.exists():
 shutil.copy2(out.parent/'rso-resume-2026-11-01/release-prep/loopback-only.cjs',guard)
lock=Path('/private/tmp/fhfh-heavy.lock'); token=str(uuid.uuid4())
try:lock.mkdir()
except FileExistsError:raise SystemExit('Heavy slot occupied; no checks started')
inode=lock.stat().st_ino
(lock/'owner.json').write_text(json.dumps({'owner':'Scout RSO first-pass exact-candidate verification','token':token,'pid':os.getpid(),'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'artifact':str(out)}))
env={'PATH':'/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin','HOME':os.environ['HOME'],'TMPDIR':os.environ.get('TMPDIR','/tmp'),'NODE_OPTIONS':'--require '+str(guard),'NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:9','NEXT_PUBLIC_SUPABASE_PUBLIC_KEY':'synthetic-public-key','SUPABASE_SERVICE_ROLE_KEY':'synthetic-service-role-key','NEXT_TELEMETRY_DISABLED':'1','TZ':'UTC'}
def run(name,cmd,timeout):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();proc=None;timed=False
 try:
  with (out/(name+'.log')).open('w') as log:
   proc=subprocess.Popen(cmd,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   try:code=proc.wait(timeout=timeout)
   except subprocess.TimeoutExpired:
    timed=True;os.killpg(proc.pid,signal.SIGTERM);code=proc.wait(timeout=15)
 finally:
  if proc:
   try:os.killpg(proc.pid,signal.SIGTERM)
   except ProcessLookupError:pass
 result={'name':name,'command':cmd,'cwd':str(cwd),'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':code,'timedOut':timed,'candidateTree':manifest['candidateTree'],'network':'inert environment and Node outbound guard','log':name+'.log'}
 (out/(name+'.json')).write_text(json.dumps(result,indent=2)+'\n')
 print(name,code,flush=True);print((out/(name+'.log')).read_text()[-3500:],flush=True)
 return result
try:
 results=[]
 results.append(run('regressions',['node','node_modules/vitest/vitest.mjs','run','lib/rosterScheduleOptimizer','lib/rosterScheduleData','components/RosterScheduleOptimizer','hooks/useRosterPlanning.test.tsx','hooks/useRosterScheduleOptimizer.test.tsx','__tests__/pages/roster-schedule-optimizer.test.tsx','__tests__/pages/api/v1/roster-schedule-optimizer','yahoo','Yahoo','lib/player-forecasts/contributions.test.ts','lib/player-forecasts/planningContributions.test.ts','lib/player-forecasts/rsoUsePolicy.test.ts','--maxWorkers=4','--reporter=dot','--reporter=json','--outputFile.json='+str(out/'regressions-results.json')],180))
 results.append(run('types',['node','--max-old-space-size=8192','node_modules/typescript/bin/tsc','--noEmit'],240))
 paths=[p['path'][4:] for p in manifest['overlayFiles']]
 results.append(run('lint',['node','node_modules/eslint/bin/eslint.js',*paths],120))
 (out/'CHECKS.json').write_text(json.dumps(results,indent=2)+'\n')
finally:
 if lock.exists() and lock.stat().st_ino==inode and json.loads((lock/'owner.json').read_text())['token']==token:
  (lock/'owner.json').unlink();lock.rmdir()
