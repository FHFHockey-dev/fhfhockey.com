from pathlib import Path
import json,os,subprocess,uuid,datetime,sys
O=Path(__file__).resolve().parent
snapshot=json.loads((O/'SNAPSHOT.json').read_text());W=Path(snapshot['path'])/'web'
env=json.loads((O/'COMMAND.json').read_text())['environment']
files=[n.removeprefix('web/') for n in json.loads((O/'LEASE.json').read_text())['before'] if (W/n.removeprefix('web/')).exists()]
(W/'audit.yahoo.tsconfig.json').write_text(json.dumps({'extends':'./tsconfig.json','compilerOptions':{'incremental':False},'include':['next-bootstrap.d.ts','yahoo-fantasy.d.ts',*files]},indent=2))
L=Path('/private/tmp/fhfh-heavy.lock');owner={'pid':os.getpid(),'token':str(uuid.uuid4()),'thread':'01a1637a-4222-70c0-8439-cb3cc46b20c4','scope':'Release C model parity / scoped TypeScript / lint','at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
try:L.mkdir()
except FileExistsError:raise SystemExit('LOCK_OCCUPIED: '+(L/'owner.json').read_text())
(L/'owner.json').write_text(json.dumps(owner));inode=L.stat().st_ino
results=[]

commands=[('parity',['npm','test','--','--run','--config','audit.vitest.config.mts','lib/projections/releaseModelParity.test.ts','--reporter=json','--outputFile='+str(O/'parity.json')]),('types',['npm','exec','--offline','--no','--','tsc','--noEmit','--incremental','false','-p','audit.yahoo.tsconfig.json']),('lint',['npm','exec','--offline','--no','--','eslint',*files])]
if len(sys.argv)>1:commands=[item for item in commands if item[0] in sys.argv[1:]]
try:
 for name,args in commands:
  with (O/(name+'.log')).open('w') as log:code=subprocess.run(args,cwd=W,env=env,stdout=log,stderr=subprocess.STDOUT).returncode
  results.append({'name':name,'argv':args,'exit_code':code});print(name,code,flush=True)
  (O/'STATIC.json').write_text(json.dumps({'cwd':str(W),'results':results},indent=2))
finally:
 if L.is_dir() and L.stat().st_ino==inode and json.loads((L/'owner.json').read_text())['token']==owner['token']:(L/'owner.json').unlink();L.rmdir()
