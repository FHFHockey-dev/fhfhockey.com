from pathlib import Path
import json,hashlib,subprocess,tempfile,shutil,sys,uuid,os
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent;mode=sys.argv[1]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if mode=='red':
 old=json.loads((O.parent/'FINAL-SNAPSHOT.json').read_text());S=Path(tempfile.mkdtemp(prefix='fhfh-account-rollout-',dir='/tmp'))/'snapshot';shutil.copytree(Path(old['snapshot'])/'web',S/'web',ignore=shutil.ignore_patterns('node_modules','*.tsbuildinfo'))
 (S/'web/node_modules').symlink_to(R/'web/node_modules',target_is_directory=True)
 (S/'home').mkdir();(S/'tmp').mkdir()
 env=json.loads((O.parent/'COMMAND.json').read_text())['environment'];env.update(HOME=str(S/'home'),TMPDIR=str(S/'tmp'),NODE_OPTIONS='--require '+str(S/'web/audit-network-deny.cjs'))
 (O/'SNAPSHOT.json').write_text(json.dumps({'snapshot':str(S),'environment':env},indent=2)+'\n')
else:
 snap=json.loads((O/'SNAPSHOT.json').read_text());S=Path(snap['snapshot']);env=snap['environment']
W=S/'web'
paths=['web/components/account/InSeasonPanel.tsx','web/components/account/InSeasonPanel.test.tsx','web/components/account/InSeasonPanel.rollout.test.tsx']
for n in paths:shutil.copyfile(R/n,S/n)
(W/'tsconfig.account-rollout.json').write_text(json.dumps({'extends':'./tsconfig.json','include':['next-bootstrap.d.ts','yahoo-fantasy.d.ts',*[n[4:] for n in paths]]}))
commands=[('tests',['npm','test','--','--run','--config','audit.vitest.config.mts','components/account/InSeasonPanel.rollout.test.tsx',*(['-t','explains free rollout'] if mode=='red' else ['components/account/InSeasonPanel.test.tsx']),'--reporter=json','--outputFile='+str(O/(mode+'-tests.json'))])]
if mode!='red':commands.extend([('types',['npm','exec','--offline','--no','--','tsc','--noEmit','--project','tsconfig.account-rollout.json']),('lint',['npm','exec','--offline','--no','--','eslint',*[n[4:] for n in paths]])])
(O/(mode+'-commands.json')).write_text(json.dumps({'cwd':str(W),'environment':env,'commands':commands,'pins':{n:sha(R/n) for n in paths}},indent=2)+'\n')
L=Path('/private/tmp/fhfh-heavy.lock');token=str(uuid.uuid4())
try:L.mkdir()
except FileExistsError:raise SystemExit('HEAVY_LOCK_OCCUPIED; not run')
(L/'owner.json').write_text(json.dumps({'pid':os.getpid(),'token':token,'scope':'billing account-rollout correction'}))
results=[]
try:
 assert subprocess.check_output(['node','--version'],env=env,text=True).strip()=='v22.11.0'
 for name,cmd in commands:
  with (O/(mode+'-'+name+'.log')).open('w') as f:cp=subprocess.run(cmd,cwd=W,env=env,stdout=f,stderr=subprocess.STDOUT)
  results.append({'name':name,'exit_code':cp.returncode});print(mode,name,cp.returncode,flush=True)
finally:
 (O/(mode+'-results.json')).write_text(json.dumps(results,indent=2)+'\n')
 if L.is_dir() and json.loads((L/'owner.json').read_text())['token']==token:(L/'owner.json').unlink();L.rmdir()
