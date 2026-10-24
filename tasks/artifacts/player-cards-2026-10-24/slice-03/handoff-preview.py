"""One explicit owned-process handoff; never stops an unidentified listener."""
from pathlib import Path
import subprocess, os, signal, time, json, hashlib

root = Path(__file__).resolve().parent
node = Path('/usr/local/bin/node')
target = root / 'serve-preview.mjs'
html = (root / 'preview.html').read_bytes()
assert node.is_file() and target.is_file()
listeners = subprocess.run(['/usr/sbin/lsof','-nP','-t','-iTCP:3125','-sTCP:LISTEN'],capture_output=True,text=True)
assert listeners.returncode == 0 and set(listeners.stdout.split()) == {'67734'}, 'Owned listener changed; handoff not performed'
command = subprocess.check_output(['/bin/ps','-p','67734','-o','command='],text=True).strip()
assert command == '/usr/local/bin/node /Users/tim/Code/fhfhockey.com/tasks/artifacts/player-cards-2026-10-24/slice-03/serve-preview.mjs', 'Owned command changed; handoff not performed'
receipt = {'fromPid':67734,'fromCommand':command,'toScript':str(target),'toHtmlSha256':hashlib.sha256(html).hexdigest(),'toHtmlBytes':len(html),'bind':'127.0.0.1:3125','action':'authorized own static preview handoff after offline QA'}
(root/'runtime-before.json').write_text(json.dumps(receipt,indent=2)+'\n')
os.kill(67734,signal.SIGTERM)
for _ in range(40):
    state = subprocess.run(['/usr/sbin/lsof','-nP','-t','-iTCP:3125','-sTCP:LISTEN'],capture_output=True,text=True)
    if state.returncode == 1 and not state.stdout.strip(): break
    if state.stdout.strip() and set(state.stdout.split()) != {'67734'}: raise RuntimeError('Another listener appeared; not stopped or replaced')
    time.sleep(0.05)
else: raise RuntimeError('Owned port did not become free; no other process stopped')
os.execv(str(node),[str(node),str(target)])
