from pathlib import Path
import datetime, hashlib, json, os, shutil, subprocess, tempfile, uuid, sys
R=Path('/Users/tim/Code/fhfhockey.com'); O=Path(__file__).resolve().parent
base=Path(json.loads((O.parent/'trusted-yahoo/SNAPSHOT.json').read_text())['path'])
S=Path(tempfile.mkdtemp(prefix='fhfh-selected-baseline-'))/'snapshot'; W=S/'web'
shutil.copytree(base/'web',W,ignore=shutil.ignore_patterns('node_modules','.audit-home','.audit-tmp','.next','*.tsbuildinfo'))
(W/'node_modules').symlink_to(R/'web/node_modules',target_is_directory=True)
# The CLI receipt reads only rev-parse HEAD and branch --show-current from root.
# Supply read-only origin metadata without GIT_DIR; exact tested bytes are pinned below.
(S/'.git').symlink_to(R/'.git',target_is_directory=True)
lease=json.loads((O/'LEASE.json').read_text())['before']
extra=[]
for n in list(lease)+extra:
 if (R/n).exists():
  (S/n).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(R/n,S/n)
shutil.copyfile(O.parent/'production-model-prototype/releaseLegacyProducerBoundary.test.ts',W/'scripts/releaseLegacyProducerBoundary.test.ts')
sha=lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
files={str(p.relative_to(S)):sha(p) for p in W.rglob('*') if p.is_file() and 'node_modules' not in p.parts}
def dump(n,v): (O/n).write_text(json.dumps(v,indent=2)+'\n')
dump('SNAPSHOT.json',{'path':str(S),'files':files,'overlay':list(lease)+extra})
env=json.loads((O.parent/'PROVIDER-CORRECTION-COMMAND.json').read_text())['environment']
env.update(HOME=str(S.parent/'home'),TMPDIR=str(S.parent/'tmp'),TZ='UTC',NODE_OPTIONS='--require '+str(W/'audit-network-deny.cjs'),npm_config_update_notifier='false')
Path(env['HOME']).mkdir();Path(env['TMPDIR']).mkdir()
args=['npm','test','--','--run','--config','audit.vitest.config.mts','lib/integrations/yahoo/planningConfirmations.test.ts','lib/integrations/yahoo/planningConfirmationRoute.test.ts','hooks/yahooPlanningReadBroker.test.ts','lib/rosterScheduleOptimizer/executionAdapter.test.ts','hooks/useRosterPlanning.test.tsx','lib/rosterScheduleOptimizer/providerGoalieStarts.test.ts','--reporter=json','--outputFile='+str(O/'tests.json')]
if len(sys.argv)>1:
 args=args[:6]+sys.argv[1:]+args[-2:]
dump('COMMAND.json',{'cwd':str(W),'environment':env,'argv':args})
L=Path('/private/tmp/fhfh-heavy.lock');owner={'pid':os.getpid(),'token':str(uuid.uuid4()),'thread':'01a1637a-4222-70c0-8439-cb3cc46b20c4','scope':'Selected Release C producer and consumer verification','at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
try: L.mkdir()
except FileExistsError:
 print('LOCK_OCCUPIED; did not run checks',flush=True);sys.exit(2)
(L/'owner.json').write_text(json.dumps(owner));inode=L.stat().st_ino
try:
 assert subprocess.check_output(['node','--version'],env=env,text=True).strip()=='v22.11.0'
 with (O/'tests.log').open('w') as log: result=subprocess.run(args,cwd=W,env=env,stdout=log,stderr=subprocess.STDOUT)
 dump('RESULT.json',{'exit_code':result.returncode});print('tests exit',result.returncode,flush=True)
finally:
 dump('INTEGRITY.json',{'files':len(files),'drift':[n for n,h in files.items() if sha(S/n)!=h]})
 if L.is_dir() and L.stat().st_ino==inode and json.loads((L/'owner.json').read_text())['token']==owner['token']:
  (L/'owner.json').unlink();L.rmdir()
