"""One isolated existing RSO browser case, with synthetic services and no external network."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import signal
import socket
import subprocess
import uuid

out = Path(__file__).resolve().parent
prepared = json.loads((out / 'PREPARED.json').read_text())
web = Path(prepared['exportRoot']) / 'web'
for item in prepared['sourcePins']:
    assert hashlib.sha256((web.parent / item['path']).read_bytes()).hexdigest() == item['sha256']
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 3162))
lock = Path('/private/tmp/fhfh-heavy.lock')
token = str(uuid.uuid4())
try:
    lock.mkdir()
except FileExistsError:
    raise SystemExit('Heavy slot occupied; no browser/server started')
inode = lock.stat().st_ino
(lock / 'owner.json').write_text(json.dumps({'owner': 'RSO isolated offline browser case',
    'thread': '01a19764-091f-763d-a983-8c692d79200b', 'token': token, 'pid': os.getpid(), 'port': 3162}))
env = {'PATH': '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin', 'HOME': os.environ['HOME'],
    'TMPDIR': os.environ.get('TMPDIR', '/tmp'), 'NODE_OPTIONS': '--require ' + str(out.parent / 'loopback-only.cjs'),
    'NEXT_PUBLIC_SUPABASE_URL': 'http://127.0.0.1:9', 'NEXT_PUBLIC_SUPABASE_PUBLIC_KEY': 'synthetic-public-key',
    'SUPABASE_SERVICE_ROLE_KEY': 'synthetic-service-role-key', 'CMS_URL': 'http://127.0.0.1:3162',
    'NEXT_TELEMETRY_DISABLED': '1', 'PLAYWRIGHT_PORT': '3162', 'PLAYWRIGHT_ISOLATED_NEXT': '1',
    'PLAYWRIGHT_HTML_OPEN': 'never'}
cmd = ['node', 'node_modules/@playwright/test/cli.js', 'test', '--config',
    str(web / '.rso-verification-playwright.config.ts'), 'e2e/rso-continuity.spec.ts',
    '--grep', r'7\. a browser that misreports offline', '--workers=1', '--retries=0',
    '--reporter=line', '--output', str(out / 'browser-output')]
proc = None
timed_out = False
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
try:
    with (out / 'browser.log').open('w') as log:
        proc = subprocess.Popen(cmd, cwd=web, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = proc.wait(timeout=240)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(proc.pid, signal.SIGTERM)
            code = proc.wait(timeout=15)
    result = {**prepared, 'startedAt': started, 'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'command': cmd, 'cwd': str(web), 'exitCode': code, 'timedOut': timed_out,
        'environment': 'curated inert values; no environment files',
        'network': 'Node loopback-only guard and existing browser isolateNetwork/account/provider/data interception',
        'providerRequests': 0, 'databaseRequests': 0, 'productionRequests': 0, 'builds': 0,
        'deployments': 0, 'runtimeSourceChanges': 0, 'gitMutations': 0}
    (out / 'EVIDENCE.json').write_text(json.dumps(result, indent=2) + '\n')
    print((out / 'browser.log').read_text()[-4000:])
    print('EXIT', code)
finally:
    if proc:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    if lock.exists() and lock.stat().st_ino == inode and json.loads((lock / 'owner.json').read_text())['token'] == token:
        (lock / 'owner.json').unlink()
        lock.rmdir()
