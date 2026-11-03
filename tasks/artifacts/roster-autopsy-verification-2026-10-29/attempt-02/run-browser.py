"""Run one isolated local browser pass, preserving the shared-lock receipt and generated evidence."""
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import signal
import socket
import subprocess
import sys
import time
import uuid

root = Path('/Users/tim/Code/fhfhockey.com')
artifact = Path(__file__).resolve().parent
if len(sys.argv) != 2:
    raise SystemExit('Pass the prepared isolated runtime path.')
runtime = Path(sys.argv[1])
if not (runtime / 'RUNTIME-PROJECTION.json').is_file():
    raise SystemExit('Runtime projection manifest not found.')
lock = Path('/private/tmp/fhfh-heavy.lock')
token = str(uuid.uuid4())
archive = Path(f'/private/tmp/fhfh-autopsy-browser-released-{token}')
server_log = artifact / 'NEXT-SERVER.log'
browser_log = artifact / 'BROWSER.log'
summary_path = artifact / 'BROWSER-EXECUTION.json'
if any(p.exists() for p in [server_log, browser_log, summary_path, artifact / 'BROWSER-RESULT.json']):
    raise SystemExit('Browser evidence already exists; preserve it and inspect before another attempt.')
try:
    lock.mkdir()
except FileExistsError:
    raise SystemExit('Shared heavy lock is occupied; no server or browser was started.')
owner = {'owner': 'Roster Autopsy isolated browser verification', 'token': token, 'created_utc': datetime.now(timezone.utc).isoformat()}
server = None
browser = None
summary = {'runtime': str(runtime), 'port': 3135, 'serverStarted': False, 'browserStarted': False,
           'serverStopped': None, 'browserStopped': None, 'productionCallsAuthorized': False, 'result': 'not_started'}

def stop_owned(process):
    if process is None:
        return None
    if process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=10)
        except ProcessLookupError:
            pass
    return process.poll() is not None

try:
    (lock / 'owner.json').write_text(json.dumps(owner) + '\n')
    # An occupied port is not reused. This probe never sends an application request.
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        probe.bind(('127.0.0.1', 3135))
    finally:
        probe.close()
    env = {key: os.environ[key] for key in ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL'] if key in os.environ}
    env.update({
        'NEXT_PUBLIC_SUPABASE_URL': 'http://127.0.0.1:9',
        'NEXT_PUBLIC_SUPABASE_PUBLIC_KEY': 'fixture-only',
        'CMS_URL': 'http://127.0.0.1:9',
        'NEXT_TELEMETRY_DISABLED': '1',
        'PLAYWRIGHT_ISOLATED_NEXT': '1',
        'PRESERVE_NEXT_DIST': '1',
        'NODE_OPTIONS': f'--require={root / "tasks/artifacts/wigo-redesign-2026-10-25/net-deny.cjs"} --max-old-space-size=4096',
        'C7_NET_LOG': str(artifact / 'SERVER-NETWORK-DENIALS.jsonl'),
        'PLAYWRIGHT_BROWSERS_PATH': str(root / 'web/.ms-playwright'),
    })
    with server_log.open('x') as server_output, browser_log.open('x') as browser_output:
        server = subprocess.Popen(['node', str(runtime / 'node_modules/next/dist/bin/next'), 'dev', '-H', '127.0.0.1', '-p', '3135'],
                                  cwd=runtime, env=env, stdout=server_output, stderr=subprocess.STDOUT, start_new_session=True)
        summary['serverStarted'] = True
        ready = False
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if server.poll() is not None:
                raise RuntimeError(f'Local Next server exited before listening (exit {server.returncode}).')
            try:
                with socket.create_connection(('127.0.0.1', 3135), timeout=1):
                    ready = True
                    break
            except OSError:
                time.sleep(0.5)
        if not ready:
            raise RuntimeError('Local Next server did not listen within 60 seconds.')
        browser = subprocess.Popen(['node', str(artifact / 'browser-check.cjs')], cwd=root / 'web', env=env,
                                   stdout=browser_output, stderr=subprocess.STDOUT, start_new_session=True)
        summary['browserStarted'] = True
        try:
            browser_code = browser.wait(timeout=120)
        except subprocess.TimeoutExpired:
            raise RuntimeError('Browser pass exceeded 120 seconds.')
        summary['browserExitCode'] = browser_code
        summary['result'] = 'passed' if browser_code == 0 else 'failed'
except Exception as error:
    summary['result'] = 'failed'
    summary['error'] = f'{type(error).__name__}: {error}'
finally:
    summary['browserStopped'] = stop_owned(browser)
    summary['serverStopped'] = stop_owned(server)
    owner_path = lock / 'owner.json'
    if owner_path.is_file() and json.loads(owner_path.read_text()).get('token') == token:
        lock.rename(archive)
        summary['preservedLockReceipt'] = str(archive)
    else:
        summary['lockRelease'] = 'not altered: ownership could not be verified'
        summary['result'] = 'failed'
    summary_path.write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary))
raise SystemExit(0 if summary['result'] == 'passed' else 1)
