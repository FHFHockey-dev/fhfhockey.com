from pathlib import Path
import json,os,uuid,subprocess,shutil,hashlib,datetime
root=Path(__file__).resolve().parent;web=root/'snapshot/web';repo=Path('/Users/tim/Code/fhfhockey.com');out=root/'scoped-static';out.mkdir(exist_ok=True)
paths=['e2e/roster-schedule-optimizer.spec.ts','e2e/roster-schedule-optimizer-fixtures.ts','e2e/acceptance/rso-p07-acceptance.spec.ts','components/RosterScheduleOptimizer/CompactSchedule.tsx']
for p in paths[:2]:shutil.copyfile(repo/'web'/p,web/p)
config={'extends':str(web/'tsconfig.json'),'compilerOptions':{'incremental':False,'noEmit':True},'include':[str(web/p) for p in paths]+[str(web/'next-env.d.ts')],'exclude':[str(web/'node_modules')]}
(out/'tsconfig.json').write_text(json.dumps(config,indent=2))
lock=Path('/private/tmp/fhfh-heavy.lock');token=uuid.uuid4().hex
try:lock.mkdir()
except FileExistsError:raise SystemExit('BLOCKED: shared lock already owned')
inode=lock.stat().st_ino;(lock/'owner.json').write_text(json.dumps({'owner':'RSO fixture scoped static','thread':'01a168af-30c9-71b7-af0a-f25a9d90a02a','pid':os.getpid(),'token':token}))
commands=[['/usr/local/bin/node',str(web/'node_modules/eslint/bin/eslint.js'),*paths],['/usr/local/bin/node',str(web/'node_modules/typescript/bin/tsc'),'--project',str(out/'tsconfig.json'),'--pretty','false']]
receipt={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pins':{p:hashlib.sha256((web/p).read_bytes()).hexdigest() for p in paths},'checks':[]}
try:
 for name,argv in zip(['eslint','typescript'],commands):
  with (out/(name+'.log')).open('w') as f:x=subprocess.run(argv,cwd=web,env={'PATH':'/usr/local/bin:/usr/bin:/bin','LANG':'en_US.UTF-8','NEXT_TELEMETRY_DISABLED':'1'},stdout=f,stderr=subprocess.STDOUT)
  receipt['checks'].append({'name':name,'argv':argv,'exit':x.returncode});print(name,x.returncode,flush=True)
  (out/'RECEIPT.json').write_text(json.dumps(receipt,indent=2))
finally:
 if lock.exists() and lock.stat().st_ino==inode and json.loads((lock/'owner.json').read_text()).get('token')==token:(lock/'owner.json').unlink();lock.rmdir()
