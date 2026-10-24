from pathlib import Path
import json, os, shutil, hashlib, subprocess, datetime, uuid
R=Path('/Users/tim/Code/fhfhockey.com'); O=Path(__file__).resolve().parent
prior=json.loads((O/'CURRENT-SNAPSHOT.json').read_text()); S=Path(prior['snapshot']); W=S/'web'; L=Path('/private/tmp/fhfh-heavy.lock')
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def dump(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
# The adversarial external fixture is retained in artifacts; it is not application source.
oracle=W/'lib/rosterScheduleOptimizer/releaseProviderStartAuthority.test.ts'
if oracle.exists():
 assert sha(oracle)==sha(O/'provider-start-authority.test.ts')
 oracle.unlink()
extras=subprocess.check_output(['git','ls-files','-z','--','supabase/migrations','supabase/migration-archive','supabase/config.toml','web/supabase/migrations'],cwd=R,text=True).split('\0')
extras+=['tasks/TASKS/repository-audit-remediation/migration-authority.json','tasks/TASKS/super-goal/super-goal-final-summary.md']
for n in extras:
 if not n or not (R/n).is_file():continue
 t=S/n;t.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(R/n,t)
files={n:sha(S/n) for n in prior['files'] if (S/n).is_file()}
files.update({n:sha(S/n) for n in extras if n and (S/n).is_file()})
for n in ['audit-network-deny.cjs','audit.offline.setup.ts','audit.vitest.config.mts']:files['web/'+n]=sha(W/n)
dump('VERIFIED-SNAPSHOT.json',dict(head=prior['head'],snapshot=str(S),files=files))
env=json.loads((O/'PROVIDER-CORRECTION-COMMAND.json').read_text())['environment']
env.update(NODE_OPTIONS=env['NODE_OPTIONS']+' --max-old-space-size=8192',TZ='UTC',npm_config_update_notifier='false')
tests=['lib/player-forecasts/nativeContributionAdmission.test.ts','lib/player-forecasts/nativeCatalogHead.test.ts','lib/player-forecasts/forecastServingSource.test.ts','lib/player-forecasts/nativeBaselinePublication.test.ts','lib/player-forecasts/planningContributions.test.ts','lib/projections/startChartPipeline.test.ts','lib/rosterScheduleData/planning.test.ts','lib/supabase/supportedBaselineMigration.test.ts']
commands=[('release-gates',['npm','test','--','--run','--config','audit.vitest.config.mts',*tests,'--reporter=json','--outputFile='+str(O/'release-gates.json')]),('current-types',['npm','exec','--offline','--no','--','tsc','--noEmit','--incremental','false']),('correction-lint',['npm','exec','--offline','--no','--','eslint','lib/rosterScheduleOptimizer/currentPlanningRead.ts','lib/rosterScheduleOptimizer/executionAdapter.test.ts'])]
dump('VERIFICATION-COMMANDS.json',dict(cwd=str(W),environment=env,commands=dict(commands)))
owner=dict(pid=os.getpid(),token=str(uuid.uuid4()),thread='01a1637a-4222-70c0-8439-cb3cc46b20c4',scope='October23 release current types and narrow correction lint',started_at=now())
try:L.mkdir()
except FileExistsError:dump('LOCK-BLOCKER.json',dict(path=str(L),status='retained other owner; no checks started'));raise SystemExit('HEAVY_LOCK_OCCUPIED')
(L/'owner.json').write_text(json.dumps(owner)+'\n'); inode=L.stat().st_ino;dump('LOCK-OWNER.json',owner)
results=[]
try:
 assert subprocess.check_output(['node','--version'],env=env,text=True).strip()=='v22.11.0'
 for name,argv in commands:
  start=now(); print('START '+name,flush=True)
  with (O/(name+'.log')).open('w') as f:r=subprocess.run(argv,cwd=W,env=env,stdout=f,stderr=subprocess.STDOUT)
  results.append(dict(name=name,argv=argv,started_at=start,ended_at=now(),exit_code=r.returncode));dump('VERIFICATION-RESULTS.json',results);print('END '+name+' '+str(r.returncode),flush=True)
finally:
 dump('VERIFICATION-INTEGRITY.json',dict(files=len(files),snapshot_drift=[n for n,h in files.items() if not (S/n).is_file() or sha(S/n)!=h]))
 if L.is_dir() and L.stat().st_ino==inode and json.loads((L/'owner.json').read_text())['token']==owner['token']:
  (L/'owner.json').unlink();L.rmdir();dump('LOCK-RELEASE.json',dict(at=now(),released_own_lock=True))
