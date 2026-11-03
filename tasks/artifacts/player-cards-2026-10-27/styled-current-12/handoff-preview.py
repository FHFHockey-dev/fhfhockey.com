from pathlib import Path
from datetime import datetime,timezone
import subprocess,os,signal,time,json,hashlib,re
root=Path(__file__).resolve().parent;repo=root.parents[3];old_script=root.parent/'current-flow-11'/'serve-preview.mjs';old_pid=76531
pin=lambda f:{'path':str(f.relative_to(repo)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
from urllib.parse import urlparse,unquote
inputs=[Path(unquote(urlparse(rel).path)) if rel.startswith('file:') else (root/rel).resolve() for rel in re.findall(r'readFileSync\(new URL\([\'\"]([^\'\"]+)',(root/'serve-preview.mjs').read_text())]
inputs += [repo/'web/public/player-cards/hero-samples/8479318.png',repo/'web/public/player-cards/hero-samples/8478864.png',repo/'web/public/teamLogos/TOR.png',repo/'web/public/teamLogos/MIN.png',root/'provider.mjs',root/'provider-contract.mjs',*[root.parents[1]/'player-cards-2026-10-26'/'current-data-01'/'approved-snapshot-02'/(name+'.json') for name in ['landing','game-log','team-schedule','RECEIPT']]]
inputs=list(dict.fromkeys(f for f in inputs if not f.is_dir()));pins=[pin(f) for f in [root/'serve-preview.mjs',*inputs]]
for item in json.loads((root/'SOURCE-PINS.json').read_text()):
 # The only post-test edit was an explicit test return-type annotation and unsupported RTL type-option removal.
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
for route,f in [('/player-cards/current',root/'preview.html'),('/player-cards',root/'preview.html'),('/player-cards/customizer',root.parents[1]/'player-cards-2026-10-26'/'outline-editor-09'/'preview.html'),('/player-cards/nhl-retained',root.parents[1]/'player-cards-2026-10-26'/'current-data-01'/'approved-snapshot-02'/'preview.html'),('/player-cards/functional',root.parents[1]/'player-cards-2026-10-24'/'slice-03-r1'/'preview.html')]:
 expected=pin(f)
 with opener.open('http://127.0.0.1:3125'+route,timeout=3) as response:
  raw=response.read(expected['bytes']+1);assert response.status==200 and len(raw)==expected['bytes'] and hashlib.sha256(raw).hexdigest()==expected['sha256'];readbacks.append({'route':route,'status':response.status,**expected})
receipt.update({'readbacks':readbacks,'localReadOnlyGets':5,'upstreamRequests':0,'lifecycle':'Detached POSIX session independent of launcher; host/environment shutdown or explicit stop ends it. No automatic restart/system startup; post-turn survival not yet observed.'})
(root/'runtime.json').write_text(json.dumps(receipt,indent=2)+'\n');(root/'KEEP-RUNTIME.json').write_text(json.dumps({'pid':child.pid,'startupInputs':pins,'noArchiveRelease':'All12styled-current source/tests/evidence;09andearlierbootstrap/artifacts,paused10candidate andactualsnapshot raw3 KEEP; no source assets released'},indent=2)+'\n');print(json.dumps(receipt))
