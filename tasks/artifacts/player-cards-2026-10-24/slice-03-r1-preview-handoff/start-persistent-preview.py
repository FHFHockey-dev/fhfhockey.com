"""One explicit own-preview handoff into a logged POSIX background session."""
from pathlib import Path
import subprocess, os, signal, time, json, hashlib

root = Path(__file__).resolve().parent
html = (root/'preview.html').read_bytes()
expected = '6c29f6eb3dc6ffc9a6a8a546423f78ac3e6e5e1e7265129475724422d3aad9b5'
assert len(html)==318626 and hashlib.sha256(html).hexdigest()==expected
assert (root/'serve-preview.mjs').read_bytes()==(root.parent/'slice-03/serve-preview.mjs').read_bytes()
listeners = subprocess.run(['/usr/sbin/lsof','-nP','-t','-iTCP:3125','-sTCP:LISTEN'],capture_output=True,text=True)
receipt = {'previousListener':listeners.stdout.strip() or None,'stoppedOwnPid':None,'htmlSha256':expected,'bytes':len(html),'bind':'127.0.0.1:3125','automaticRestart':False,'systemStartupChanges':False}
if listeners.returncode==0:
    assert set(listeners.stdout.split())=={'81671'}, 'Different listener present; no process controlled'
    command = subprocess.check_output(['/bin/ps','-p','81671','-o','command='],text=True).strip()
    assert command=='/usr/local/bin/node '+str(root/'serve-preview.mjs'), 'Own process command changed; not stopped'
    os.kill(81671,signal.SIGTERM);receipt['stoppedOwnPid']=81671
    for _ in range(40):
        state=subprocess.run(['/usr/sbin/lsof','-nP','-t','-iTCP:3125','-sTCP:LISTEN'],capture_output=True,text=True)
        if state.returncode==1 and not state.stdout.strip():break
        assert not state.stdout.strip() or set(state.stdout.split())=={'81671'}, 'Different listener appeared; no other process controlled'
        time.sleep(0.05)
    else:raise RuntimeError('Own port not free; no background process started')
else:
    assert listeners.returncode==1 and not listeners.stdout.strip(), 'Listener inspection failed; no process started'
with (root/'server.log').open('ab',buffering=0) as log:
    child=subprocess.Popen(['/usr/local/bin/node',str(root/'serve-preview.mjs')],stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True,close_fds=True)
receipt.update({'pid':child.pid,'launcherPid':os.getpid(),'startNewSession':True,'stdin':'DEVNULL','stdoutStderr':'server.log','lifecycle':'Independent of launcher shell/session; no automatic restart. Host/environment shutdown or explicit process termination stops it. Post-turn survival still needs later observation.'})
(root/'persistent-startup.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt),flush=True)
