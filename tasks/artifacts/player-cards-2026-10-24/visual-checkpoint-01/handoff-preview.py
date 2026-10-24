"""Guarded, one-time handoff of the worker's exact loopback fixture listener."""
from pathlib import Path
import subprocess, os, signal, time, json, hashlib, urllib.request

root = Path(__file__).resolve().parent
pins = json.loads((root / 'candidate-pins.json').read_text())
def verify(path, pin):
    content = path.read_bytes()
    assert len(content) == pin['bytes'] and hashlib.sha256(content).hexdigest() == pin['sha256'], str(path)
for name in ['preview.html', 'serve-preview.mjs']:
    verify(root / name, pins[name])
accepted = root.parent / 'slice-03-r1' / 'preview.html'
verify(accepted, pins['acceptedFunctional'])
old_script = root.parent / 'slice-03-r1-preview-handoff' / 'serve-preview.mjs'
old_command = '/usr/local/bin/node ' + str(old_script)
listener_cmd = ['/usr/sbin/lsof', '-nP', '-t', '-iTCP:3125', '-sTCP:LISTEN']
def listeners():
    result = subprocess.run(listener_cmd, capture_output=True, text=True)
    assert result.returncode in [0, 1], 'Listener inspection failed'
    return set(result.stdout.split())
current = listeners()
assert not current or current == {'81978'}, 'Another listener owns3125; no process controlled'
receipt = {'previousListeners': list(current), 'stoppedOwnPid': None, 'bind': '127.0.0.1:3125', 'automaticRestart': False, 'systemStartupChanges': False}
if current:
    command = subprocess.check_output(['/bin/ps', '-p', '81978', '-o', 'command='], text=True).strip()
    assert command == old_command, 'PID81978 is no longer the worker server; no process controlled'
    receipt['verifiedOwnCommand'] = command
    os.kill(81978, signal.SIGTERM)
    receipt['stoppedOwnPid'] = 81978
    for _ in range(40):
        state = listeners()
        if not state:
            break
        assert state == {'81978'}, 'Another listener appeared; no further process controlled'
        time.sleep(.05)
    else:
        raise RuntimeError('Own listener did not release3125; no new process started')
def launch(script, log_name):
    with (root / log_name).open('ab', buffering=0) as log:
        return subprocess.Popen(['/usr/local/bin/node', str(script)], stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True, close_fds=True)
child = launch(root / 'serve-preview.mjs', 'server.log')
receipt.update({'pid': child.pid, 'launcherPid': os.getpid(), 'startNewSession': True, 'stdin': 'DEVNULL', 'stdoutStderr': 'server.log', 'execSession': None})
for _ in range(40):
    state = listeners()
    if state == {str(child.pid)}:
        break
    assert not state, 'Another listener appeared; no process controlled'
    if child.poll() is not None:
        if not listeners():
            fallback = launch(old_script, 'restore-accepted.log')
            receipt['restoredAcceptedPid'] = fallback.pid
        (root / 'runtime-failure.json').write_text(json.dumps(receipt, indent=2) + '\n')
        raise RuntimeError('New preview failed; exact accepted preview restoration attempted if port free')
    time.sleep(.05)
else:
    raise RuntimeError('New listener not confirmed; inspect own process before further action')
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
readbacks = []
for route, expected in [('/player-cards', pins['preview.html']), ('/player-cards/functional', pins['acceptedFunctional'])]:
    url = 'http://127.0.0.1:3125' + route
    with opener.open(url, timeout=3) as response:
        body = response.read(600000)
        item = {'url': url, 'status': response.status, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
    assert item['status'] == 200 and item['bytes'] == expected['bytes'] and item['sha256'] == expected['sha256']
    assert b'SYNTHETIC FIXTURE' in body and b'premium activation remain' in body
    readbacks.append(item)
receipt.update({'readbacks': readbacks, 'localReadOnlyGets': len(readbacks), 'upstreamRequests': 0, 'lifecycle': 'Detached POSIX session, independent of launcher; host/environment shutdown or explicit stop ends process. No automatic restart/system startup.'})
(root / 'runtime.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt), flush=True)
