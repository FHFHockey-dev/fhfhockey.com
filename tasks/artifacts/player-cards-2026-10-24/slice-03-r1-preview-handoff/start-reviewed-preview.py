"""Start only the accepted static artifact on the worker's reserved loopback port."""
from pathlib import Path
import subprocess, os, signal, time, json, hashlib

root = Path(__file__).resolve().parent
expected = '6c29f6eb3dc6ffc9a6a8a546423f78ac3e6e5e1e7265129475724422d3aad9b5'
html = (root/'preview.html').read_bytes()
assert len(html) == 318626 and hashlib.sha256(html).hexdigest() == expected
assert all(label in html for label in [b'SYNTHETIC FIXTURE',b'fabricated',b'Live data and premium activation remain off'])
assert (root/'serve-preview.mjs').read_bytes() == (root.parent/'slice-03/serve-preview.mjs').read_bytes()
listeners = subprocess.run(['/usr/sbin/lsof','-nP','-t','-iTCP:3125','-sTCP:LISTEN'],capture_output=True,text=True)
receipt = {'previousListener':listeners.stdout.strip() or None,'stoppedOwnedPid':None,'reviewedHtmlSha256':expected,'htmlBytes':len(html),'syntheticLabelsPresent':True,'bind':'127.0.0.1:3125'}
if listeners.returncode == 0:
    assert set(listeners.stdout.split()) == {'76261'}, 'Different listener present; no process controlled'
    command = subprocess.check_output(['/bin/ps','-p','76261','-o','command='],text=True).strip()
    assert command == 'node tasks/artifacts/player-cards-2026-10-24/slice-03/serve-preview.mjs', 'Owned command changed; no process controlled'
    os.kill(76261,signal.SIGTERM);receipt['stoppedOwnedPid'] = 76261
    for _ in range(40):
        state = subprocess.run(['/usr/sbin/lsof','-nP','-t','-iTCP:3125','-sTCP:LISTEN'],capture_output=True,text=True)
        if state.returncode == 1 and not state.stdout.strip(): break
        assert not state.stdout.strip() or set(state.stdout.split()) == {'76261'}, 'Different listener appeared; no further process controlled'
        time.sleep(0.05)
    else: raise RuntimeError('Owned port not freed; no replacement started')
else:
    assert listeners.returncode == 1 and not listeners.stdout.strip(), 'Listener inspection failed; no replacement started'
(root/'startup.json').write_text(json.dumps(receipt,indent=2)+'\n')
os.execv('/usr/local/bin/node',['/usr/local/bin/node',str(root/'serve-preview.mjs')])
