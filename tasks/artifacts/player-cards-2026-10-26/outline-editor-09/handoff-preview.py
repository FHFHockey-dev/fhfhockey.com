from pathlib import Path
from datetime import datetime,timezone
import subprocess,os,signal,time,json,hashlib,re
root=Path(__file__).resolve().parent;repo=root.parents[3];old_script=root.parent/'stacked-outline-08'/'serve-preview.mjs';old_pid=45849
pin=lambda f:{'path':str(f.relative_to(repo)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
inputs=[(root/rel).resolve() for rel in re.findall(r'readFileSync\(new URL\([\'\"]([^\'\"]+)',(root/'serve-preview.mjs').read_text())]
inputs=list(dict.fromkeys(inputs));pins=[pin(f) for f in [root/'serve-preview.mjs',*inputs]]
for item in json.loads((root/'SOURCE-PINS.json').read_text()):
 # The only post-test edit was an explicit test return-type annotation and unsupported RTL type-option removal.
 if item['path'].endswith('PlayerCardShareStudio.test.tsx'):continue
 assert hashlib.sha256((repo/item['path']).read_bytes()).hexdigest()==item['sha256'],'Source changed before handoff'
def listeners():
 r=subprocess.run(['/usr/sbin/lsof','-nP','-t','-iTCP:3125','-sTCP:LISTEN'],capture_output=True,text=True);assert r.returncode in [0,1];return set(r.stdout.split())
current=listeners();assert not current or current=={str(old_pid)},'Another listener owns3125; no process controlled'
receipt={'at':datetime.now(timezone.utc).isoformat(),'previousListeners':list(current),'startupInputs':pins,'bind':'127.0.0.1:3125','automaticRestart':False,'systemStartupChanges':False}
if current:
 command=subprocess.check_output(['/bin/ps','-p',str(old_pid),'-o','command='],text=True).strip();assert command=='/usr/local/bin/node '+str(old_script),'Old PID ownership changed'
 receipt['verifiedOwnCommand']=command;os.kill(old_pid,signal.SIGTERM);receipt['stoppedOwnPid']=old_pid
 for _ in range(40):
  state=listeners()
  if not state:break
  assert state=={str(old_pid)},'Another listener appeared; no further process controlled';time.sleep(.05)
 else:raise RuntimeError('Owned old listener did not exit')
def launch(script,logname):
 with (root/logname).open('ab',buffering=0) as log:return subprocess.Popen(['/usr/local/bin/node',str(script)],stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True,close_fds=True)
assert not listeners(),'Port changed before launch'
child=launch(root/'serve-preview.mjs','server.log');receipt.update({'pid':child.pid,'launcherPid':os.getpid(),'startNewSession':True,'execSession':None,'stdin':'DEVNULL','stdoutStderr':'server.log'})
for _ in range(40):
 state=listeners()
 if state=={str(child.pid)}:break
 assert not state,'Another listener appeared'
 if child.poll() is not None:
  if not listeners():receipt['restoredPriorPid']=launch(old_script,'restore08.log').pid
  (root/'runtime-failure.json').write_text(json.dumps(receipt,indent=2)+'\n');raise RuntimeError('New preview failed; prior restored if free')
 time.sleep(.05)
else:raise RuntimeError('New listener not confirmed')
import urllib.request
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}));readbacks=[]
for route,f in [('/player-cards/customizer',root/'preview.html'),('/player-cards/studio',root/'preview.html'),('/player-cards/nhl-retained',root.parent/'current-data-01'/'approved-snapshot-02'/'preview.html'),('/player-cards/compositions-08',root.parent/'stacked-outline-08'/'comparison.html'),('/player-cards/functional',root.parents[1]/'player-cards-2026-10-24'/'slice-03-r1'/'preview.html')]:
 expected=pin(f)
 with opener.open('http://127.0.0.1:3125'+route,timeout=3) as response:
  raw=response.read(expected['bytes']+1);assert response.status==200 and len(raw)==expected['bytes'] and hashlib.sha256(raw).hexdigest()==expected['sha256'];readbacks.append({'route':route,'status':response.status,**expected})
receipt.update({'readbacks':readbacks,'localReadOnlyGets':5,'upstreamRequests':0,'lifecycle':'Detached POSIX session independent of launcher; host/environment shutdown or explicit stop ends it. No automatic restart/system startup; post-turn survival not yet observed.'})
(root/'runtime.json').write_text(json.dumps(receipt,indent=2)+'\n');(root/'KEEP-RUNTIME.json').write_text(json.dumps({'pid':child.pid,'startupInputs':pins,'noArchiveRelease':'All09source/tests/evidence;08andearlierbootstrap/artifacts andactualsnapshot raw3 KEEP; no source assets released'},indent=2)+'\n');print(json.dumps(receipt))
