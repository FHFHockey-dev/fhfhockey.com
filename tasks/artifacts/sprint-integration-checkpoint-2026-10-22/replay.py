"""Replay the frozen checkpoint without touching the checkout or old evidence.

Default: extract and verify only. --failed-planner: reproduce the two held suites.
--all-tests: replay the deduplicated 67-file selection. --types: application scope.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,os,subprocess,tarfile,tempfile,uuid
P=argparse.ArgumentParser();P.add_argument('--failed-planner',action='store_true');P.add_argument('--all-tests',action='store_true');P.add_argument('--types',action='store_true');a=P.parse_args()
O=Path(__file__).resolve().parent;R=O.parents[2];F=O/'export-completion'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
archive=F/'fixed-source.tar.gz';assert sha(archive)==read(F/'ARCHIVE.json')['sha256']
S=Path(tempfile.mkdtemp(prefix='fhfh-integration-replay-',dir='/tmp'))
with tarfile.open(archive) as t:
 for m in t.getmembers():
  p=Path(m.name);assert not p.is_absolute() and '..' not in p.parts and m.isfile()
  target=S/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(t.extractfile(m).read())
files=read(F/'FIXED-SNAPSHOT.json')['files'];assert all(sha(S/p)==h for p,h in files.items())
W=S/'web';(W/'node_modules').symlink_to(R/'web/node_modules',target_is_directory=True)
for n in ['.audit-home','.audit-tmp']:(W/n).mkdir()
import re
config=W/'audit.vitest.config.mts';config.write_text(re.sub(r'cacheDir:"[^"]+"','cacheDir:"'+str(S/'vite-cache')+'"',config.read_text()))
env=read(O/'COMMANDS.json')['environment'];env.update(HOME=str(W/'.audit-home'),TMPDIR=str(W/'.audit-tmp'),NODE_OPTIONS='--require '+str(W/'audit-network-deny.cjs')+' --max-old-space-size=8192')
assert subprocess.check_output(['node','--version'],env=env,text=True).strip()=='v22.11.0'
print(json.dumps(dict(snapshot=str(S),verified_files=len(files),archive_sha256=sha(archive),execution_only_change='private Vitest cache path')),flush=True)
commands=[]
if a.all_tests or a.failed_planner:
 tests=read(O/'TEST-FILES.json') if a.all_tests else ['lib/rosterScheduleData/forgeDailyBridge.test.ts','lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts']
 commands.append(['npm','test','--','--run','--config','audit.vitest.config.mts',*tests])
if a.types:commands.append(['npm','exec','--offline','--no','--','tsc','--noEmit','--incremental','false','--project','audit.integration-application-tsconfig.json'])
if commands:
 L=Path('/private/tmp/fhfh-heavy.lock');L.mkdir();token=str(uuid.uuid4());inode=L.stat().st_ino
 owner=dict(pid=os.getpid(),token=token,scope='frozen integration replay',at=datetime.datetime.now(datetime.timezone.utc).isoformat());(L/'owner.json').write_text(json.dumps(owner)+'\n')
 try:
  for i,command in enumerate(commands):
   with (S/f'replay-{i}.log').open('w') as out:result=subprocess.run(command,cwd=W,env=env,stdout=out,stderr=subprocess.STDOUT)
   print(json.dumps(dict(command=command,exit_code=result.returncode,log=str(S/f'replay-{i}.log'))),flush=True)
 finally:
  if L.stat().st_ino==inode and read(L/'owner.json')['token']==token:(L/'owner.json').unlink();L.rmdir()
