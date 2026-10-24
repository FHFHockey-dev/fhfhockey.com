from pathlib import Path
import json,hashlib,datetime,os,subprocess,uuid
O=Path(__file__).resolve().parent;F=O/'export-completion';S=Path((O/'snapshot-path.txt').read_text().strip());W=S/'web';L=Path('/private/tmp/fhfh-heavy.lock')
def read(p):return json.loads(p.read_text())
def dump(n,d):(F/n).write_text(json.dumps(d,indent=2)+'\n')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files=read(F/'FIXED-SNAPSHOT.json')['files']
def integrity():return dict(checked_at=now(),file_count=len(files),mismatches=[p for p,h in files.items() if not (S/p).is_file() or sha(S/p)!=h])
start=integrity();assert not start['mismatches'];dump('START-INTEGRITY.json',start)
env=read(O/'COMMANDS.json')['environment']
commands=[('migration-fixtures',['npm','test','--','--run','--config','audit.vitest.config.mts','lib/supabase/supportedBaselineMigration.test.ts','--reporter=json','--outputFile='+str(F/'migration-fixtures.json')]),('application-types',['npm','exec','--offline','--no','--','tsc','--noEmit','--incremental','false','--project','audit.integration-application-tsconfig.json'])]
dump('COMMANDS.json',dict(cwd=str(W),environment=env,commands=dict(commands)))
owner=dict(pid=os.getpid(),token=str(uuid.uuid4()),thread='01a1637a-4222-70c0-8439-cb3cc46b20c4',started_at=now(),scope='complete isolated fixture export and application-only type scope')
try:L.mkdir()
except FileExistsError:dump('LOCK-BLOCKER.json',dict(path=str(L),status='pending; retained other owner'));raise SystemExit('HEAVY_LOCK_OCCUPIED')
(L/'owner.json').write_text(json.dumps(owner)+'\n');inode=L.stat().st_ino;dump('LOCK-OWNER.json',owner)
results=[]
try:
 for name,argv in commands:
  begin=now();print('START '+name,flush=True)
  with (F/(name+'.log')).open('w') as out:r=subprocess.run(argv,cwd=W,env=env,stdout=out,stderr=subprocess.STDOUT)
  results.append(dict(name=name,argv=argv,started_at=begin,ended_at=now(),exit_code=r.returncode,log=name+'.log'));dump('RESULTS.json',results);print('END '+name+' '+str(r.returncode),flush=True)
finally:
 dump('END-INTEGRITY.json',integrity())
 if L.is_dir() and L.stat().st_ino==inode and read(L/'owner.json')['token']==owner['token']:
  (L/'owner.json').unlink();L.rmdir();dump('LOCK-RELEASE.json',dict(released_own_lock=True,at=now()))
 else:dump('LOCK-RELEASE.json',dict(released_own_lock=False,reason='owner changed; retained'))
