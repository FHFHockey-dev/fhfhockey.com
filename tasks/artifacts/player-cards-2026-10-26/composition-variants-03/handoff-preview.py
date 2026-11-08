"""Guarded handoff of this worker's exact loopback fixture server only."""
from pathlib import Path
from datetime import datetime, timezone
import subprocess, os, signal, time, json, hashlib, urllib.request

root = Path(__file__).resolve().parent
pins = json.loads((root / 'candidate-pins.json').read_text())
old_root = root.parents[1] / 'player-cards-2026-10-24'
old_script = root.parent / 'composition-variants-02' / 'serve-preview.mjs'
old_command = '/usr/local/bin/node ' + str(old_script)

def verify(path, pin):
    content = path.read_bytes()
    assert len(content) == pin['bytes'] and hashlib.sha256(content).hexdigest() == pin['sha256'], str(path)

for name in ['preview.html', 'serve-preview.mjs']:
    verify(root / name, pins[name])
verify(root.parents[1] / 'player-cards-2026-10-25' / 'portrait-treatments-01' / 'comparison.html', pins['priorPortraits'])
verify(root.parents[1] / 'player-cards-2026-10-25' / 'hero-share-checkpoint-01' / 'preview.html', pins['priorHero'])
verify(old_root / 'slice-03-r1' / 'preview.html', pins['priorFunctional'])
verify(old_root / 'visual-checkpoint-01' / 'preview.html', pins['priorEditorial'])

def listeners():
    result = subprocess.run(['/usr/sbin/lsof', '-nP', '-t', '-iTCP:3125', '-sTCP:LISTEN'], capture_output=True, text=True)
    assert result.returncode in [0, 1], 'Listener inspection failed'
    return set(result.stdout.split())

current = listeners()
assert not current or current == {'55021'}, 'Another listener owns3125; no process controlled'
receipt = {'at': datetime.now(timezone.utc).isoformat(), 'previousListeners': list(current), 'stoppedOwnPid': None, 'bind': '127.0.0.1:3125', 'automaticRestart': False, 'systemStartupChanges': False}
if current:
    command = subprocess.check_output(['/bin/ps', '-p', '55021', '-o', 'command='], text=True).strip()
    assert command == old_command, 'PID55021 is no longer the worker server; no process controlled'
    receipt['verifiedOwnCommand'] = command
    os.kill(55021, signal.SIGTERM)
    receipt['stoppedOwnPid'] = 55021
    for _ in range(40):
        state = listeners()
        if not state: break
        assert state == {'55021'}, 'Another listener appeared; no further process controlled'
        time.sleep(.05)
    else:
        raise RuntimeError('Own listener did not release3125; no new process started')

def launch(script, log_name):
    with (root / log_name).open('ab', buffering=0) as log:
        return subprocess.Popen(['/usr/local/bin/node', str(script)], stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True, close_fds=True)

assert not listeners(), 'Port ownership changed; no new process started'
child = launch(root / 'serve-preview.mjs', 'server.log')
receipt.update({'pid': child.pid, 'launcherPid': os.getpid(), 'startNewSession': True, 'stdin': 'DEVNULL', 'stdoutStderr': 'server.log', 'execSession': None})
for _ in range(40):
    state = listeners()
    if state == {str(child.pid)}: break
    assert not state, 'Another listener appeared; no process controlled'
    if child.poll() is not None:
        if not listeners():
            fallback = launch(old_script, 'restore-editorial.log')
            receipt['restoredPriorPid'] = fallback.pid
        (root / 'runtime-failure.json').write_text(json.dumps(receipt, indent=2) + '\n')
        raise RuntimeError('New preview failed; exact prior preview restoration attempted if port free')
    time.sleep(.05)
else:
    raise RuntimeError('New listener not confirmed; inspect own process before further action')

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
readbacks = []
for route, expected in [('/player-cards', pins['comparison.html']), ('/player-cards/compositions', pins['comparison.html']), ('/player-cards/studio', pins['preview.html']), ('/player-cards/compositions-02', pins['priorComposition02']), ('/player-cards/observed-evidence', pins['observedEvidence'])]:
    url = 'http://127.0.0.1:3125' + route
    with opener.open(url, timeout=3) as response:
        body = response.read(expected['bytes'] + 1)
        item = {'url': url, 'status': response.status, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
    assert item['status'] == 200 and item['bytes'] == expected['bytes'] and item['sha256'] == expected['sha256']
    if route in ['/player-cards','/player-cards/compositions']: assert b'data-checkpoint="sequential03"' in body
    if route == '/player-cards/studio': assert b'fhfh-sequential-v1' in body and b'ILLUSTRATIVE STATS' in body
    if route == '/player-cards/observed-evidence': assert b'GP unverified' in body
    readbacks.append(item)
receipt.update({'readbacks': readbacks, 'localReadOnlyGets': len(readbacks), 'upstreamRequests': 0, 'lifecycle': 'Detached POSIX session, independent of launcher; host/environment shutdown or explicit stop ends process. No automatic restart or system startup.'})
(root / 'runtime.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt), flush=True)
