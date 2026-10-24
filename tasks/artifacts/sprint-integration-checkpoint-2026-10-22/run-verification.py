from pathlib import Path
import json, hashlib, os, subprocess, datetime, uuid, tarfile

ROOT=Path('/Users/tim/Code/fhfhockey.com')
OUT=Path(__file__).resolve().parent
S=Path((OUT/'snapshot-path.txt').read_text().strip())
W=S/'web'
LOCK=Path('/private/tmp/fhfh-heavy.lock')
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(name,v):(OUT/name).write_text(json.dumps(v,indent=2)+'\n')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
files=read(OUT/'FIXED-SNAPSHOT.json')['files']
def integrity():return dict(checked_at=now(),file_count=len(files),mismatches=[p for p,h in files.items() if not (S/p).is_file() or sha(S/p)!=h])
start=integrity();dump('START-INTEGRITY.json',start);assert not start['mismatches']
with tarfile.open(OUT/'fixed-source.tar.gz','w:gz') as tar:
    for p in sorted(files):tar.add(S/p,arcname=p,recursive=False)
dump('ARCHIVE.json',dict(path='fixed-source.tar.gz',sha256=sha(OUT/'fixed-source.tar.gz'),files=len(files)))
env=dict(PATH='/usr/local/bin:/usr/bin:/bin',HOME=str(W/'.audit-home'),TMPDIR=str(W/'.audit-tmp'),
         NEXT_PUBLIC_SUPABASE_URL='https://unit-tests.supabase.invalid',NEXT_PUBLIC_SUPABASE_PUBLIC_KEY='synthetic-public-key',
         SUPABASE_SERVICE_ROLE_KEY='synthetic-service-role-key',NODE_OPTIONS='--require '+str(W/'audit-network-deny.cjs')+' --max-old-space-size=8192',
         npm_config_offline='true',npm_config_audit='false',npm_config_fund='false',npm_config_update_notifier='false',TZ='UTC')
tests=read(OUT/'TEST-FILES.json'); lint=read(OUT/'LINT-FILES.json')
commands=[
 ('regressions',['npm','test','--','--run','--config','audit.vitest.config.mts',*tests,'--reporter=json','--outputFile='+str(OUT/'regressions.json')]),
 ('relocation-preflight',['node',str(S/'tasks/artifacts/in-season-billing-2026-10-21/queue-sql-verification/VERIFY-QUEUE.cjs'),'--preflight']),
 ('relocation-oracles',['node','--test',str(S/'tasks/artifacts/billing-migration-authority-2026-10-22/queue-preflight-fix/VERIFY-QUEUE-PREFLIGHT.test.cjs')]),
 ('application-types',['npm','exec','--offline','--no','--','tsc','--noEmit','--incremental','false','--project','audit.application-tsconfig.json']),
 ('scoped-lint',['npm','exec','--offline','--no','--','eslint',*lint]),
]
dump('COMMANDS.json',dict(cwd=str(W),environment=env,commands={name:argv for name,argv in commands}))
token=str(uuid.uuid4()); owner=dict(pid=os.getpid(),thread='01a1637a-4222-70c0-8439-cb3cc46b20c4',token=token,started_at=now(),scope='accepted sprint integration checkpoint offline checks')
try:LOCK.mkdir()
except FileExistsError:
    dump('LOCK-BLOCKER.json',dict(at=now(),path=str(LOCK),entries=[p.name for p in LOCK.iterdir()],status='pending; another owner lock retained'))
    raise SystemExit('HEAVY_LOCK_OCCUPIED: no checks launched; archive preserved')
(LOCK/'owner.json').write_text(json.dumps(owner,indent=2)+'\n'); inode=LOCK.stat().st_ino
dump('LOCK-OWNER.json',owner)
results=[]
try:
    runtime={name:subprocess.check_output([name,'--version'],cwd=W,env=env,text=True).strip() for name in ['node','npm']}
    assert runtime==dict(node='v22.11.0',npm='10.9.0'),runtime
    print(json.dumps(dict(runtime=runtime,lock_acquired=True,archive=sha(OUT/'fixed-source.tar.gz'))),flush=True)
    for name,argv in commands:
        begin=now();print('START '+name,flush=True)
        with (OUT/(name+'.log')).open('w') as f: result=subprocess.run(argv,cwd=W,env=env,stdout=f,stderr=subprocess.STDOUT)
        results.append(dict(name=name,argv=argv,started_at=begin,ended_at=now(),exit_code=result.returncode,log=name+'.log'))
        dump('RESULTS.json',dict(runtime=runtime,commands=results));print('END '+name+' '+str(result.returncode),flush=True)
finally:
    dump('END-INTEGRITY.json',integrity())
    if LOCK.is_dir() and LOCK.stat().st_ino==inode and read(LOCK/'owner.json')['token']==token:
        (LOCK/'owner.json').unlink();LOCK.rmdir();dump('LOCK-RELEASE.json',dict(at=now(),released_own_lock=True))
    else:dump('LOCK-RELEASE.json',dict(at=now(),released_own_lock=False,reason='owner/inode changed; no removal attempted'))
    print('FINISHED '+str(len(results))+' commands',flush=True)
