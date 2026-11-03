from pathlib import Path
import subprocess,os,signal,time,json,hashlib,urllib.request,datetime
root=Path.cwd();a=root/'tasks/artifacts/player-cards-2026-10-29/recent-comparison-15';old=root/'tasks/artifacts/player-cards-2026-10-28/name-search-14'
pid=95367
command=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()
expected='/usr/local/bin/node '+str(old/'serve-preview.mjs')
if command!=expected:raise RuntimeError('Old listener command changed; no handoff: '+command)
listeners=subprocess.check_output(['lsof','-t','-iTCP:3125','-sTCP:LISTEN'],text=True).split()
if listeners!=[str(pid)]:raise RuntimeError('Unexpected port owner; untouched')
# All original dependencies stay readable and byte-identical before stopping anything.
runtime=json.loads((old/'runtime.json').read_text())
inputs=runtime['startupInputs']
if not inputs:raise RuntimeError('Original runtime dependency list unavailable')
for item in inputs:
 p=root/item['path'];b=p.read_bytes()
 if hashlib.sha256(b).hexdigest()!=item['sha256']:raise RuntimeError('Dependency changed: '+str(p))
for f in ['preview.html','provider.mjs','provider-contract.mjs','serve-preview.mjs','current-snapshot-15/landing.json','current-snapshot-15/game-log.json','current-snapshot-15/team-schedule.json','current-snapshot-15/RECEIPT.json']:
 p=a/f;b=p.read_bytes();inputs.append({'path':str(p.relative_to(root)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
subprocess.run(['/usr/local/bin/node','--check',str(a/'serve-preview.mjs')],check=True)
(a/'KEEP-RUNTIME.json').write_text(json.dumps(inputs,indent=2)+'\n')
os.kill(pid,signal.SIGTERM)
for _ in range(30):
 if subprocess.run(['lsof','-t','-iTCP:3125','-sTCP:LISTEN'],stdout=subprocess.DEVNULL).returncode!=0:break
 time.sleep(.1)
else:raise RuntimeError('Port still occupied; no additional stop or start')
log=(a/'server.log').open('ab')
process=subprocess.Popen(['/usr/local/bin/node',str(a/'serve-preview.mjs')],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
for _ in range(30):
 if process.poll() is not None:raise RuntimeError('New server exited: '+(a/'server.log').read_text()[-1500:])
 if '"port":3125' in (a/'server.log').read_text():break
 time.sleep(.1)
else:raise RuntimeError('Server startup unknown; do not duplicate')
checks=[]
for route,file in [('/player-cards/recent',a/'preview.html'),('/player-cards/current-14',old/'preview.html')]:
 with urllib.request.urlopen('http://127.0.0.1:3125'+route,timeout=3) as response:body=response.read(2*1024*1024);assert response.status==200
 assert body==file.read_bytes();checks.append({'route':route,'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body)})
receipt={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':process.pid,'stoppedOwnPid':pid,'verifiedOwnCommand':command,'bind':'127.0.0.1:3125','startNewSession':True,'automaticRestart':False,'upstreamRequests':0,'readbacks':checks,'inputs':inputs}
(a/'runtime.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:v for k,v in receipt.items() if k!='inputs'}))
