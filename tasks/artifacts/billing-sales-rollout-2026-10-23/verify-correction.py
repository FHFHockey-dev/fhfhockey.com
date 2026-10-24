from pathlib import Path
import json,hashlib,subprocess,shutil,uuid,os
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent
snap=json.loads((O/'SNAPSHOT.json').read_text());W=Path(snap['snapshot'])/'web';env=json.loads((O/'COMMAND.json').read_text())['environment'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
changed=['web/components/account/DraftProPanel.tsx','web/lib/integrations/providerSyncRolloutRoutes.test.ts','web/lib/integrations/yahoo/liveDraftAccess.ts']
assert all(sha(R/n)==h for n,h in snap['owned'].items() if n not in changed)
for n in changed:shutil.copyfile(R/n,Path(snap['snapshot'])/n);snap['owned'][n]=sha(R/n)
(O/'CORRECTED-SNAPSHOT.json').write_text(json.dumps(snap,indent=2)+'\n')
source=[n[4:] for n in snap['owned'] if n.endswith(('.ts','.tsx'))]
(W/'tsconfig.billing-check.json').write_text(json.dumps({'extends':'./tsconfig.json','include':['next-bootstrap.d.ts','yahoo-fantasy.d.ts',*source]}))
cmds=[('corrected-tests',['npm','test','--','--run','--config','audit.vitest.config.mts','components/account/DraftProPanel.test.tsx','lib/integrations/providerSyncRolloutRoutes.test.ts','--reporter=json','--outputFile='+str(O/'corrected-tests.json')]),('types',['npm','exec','--offline','--no','--','tsc','--noEmit','--project','tsconfig.billing-check.json']),('lint',['npm','exec','--offline','--no','--','eslint',*source])]
(O/'CORRECTION-COMMANDS.json').write_text(json.dumps(dict(cwd=str(W),environment=env,commands=cmds),indent=2)+'\n')
L=Path('/private/tmp/fhfh-heavy.lock');token=str(uuid.uuid4())
try:L.mkdir()
except FileExistsError:raise SystemExit('HEAVY_LOCK_OCCUPIED')
(L/'owner.json').write_text(json.dumps(dict(pid=os.getpid(),token=token,scope='billing sales correction tests/types/lint')))
results=[]
try:
 for name,cmd in cmds:
  with (O/(name+'.log')).open('w') as f:p=subprocess.run(cmd,cwd=W,env=env,stdout=f,stderr=subprocess.STDOUT)
  results.append(dict(name=name,exit_code=p.returncode));(O/'CORRECTION-RESULTS.json').write_text(json.dumps(results,indent=2)+'\n');print(name,p.returncode,flush=True)
finally:
 (O/'CORRECTION-INTEGRITY.json').write_text(json.dumps({'source_drift':[n for n,h in snap['owned'].items() if sha(R/n)!=h]},indent=2)+'\n')
 if L.is_dir() and json.loads((L/'owner.json').read_text())['token']==token:(L/'owner.json').unlink();L.rmdir()
