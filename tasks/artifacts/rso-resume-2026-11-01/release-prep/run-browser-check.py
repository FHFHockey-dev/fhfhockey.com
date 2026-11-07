"""Two existing RSO fixture cases against the pinned verification export; no remote services."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import signal
import socket
import subprocess
import sys
import uuid

out = Path(__file__).resolve().parent
coverage_supplement = '--coverage-supplement' in sys.argv
manifest = json.loads((out / ('CANDIDATE-BROWSER-SUPPLEMENT.json' if coverage_supplement else 'CANDIDATE.json')).read_text())
cwd = Path(manifest['exportRoot']) / 'web'
manual_only = '--manual-only' in sys.argv
readiness = '--readiness' in sys.argv
prefix = 'coverage-browser' if coverage_supplement else 'readiness-browser' if readiness else 'manual-browser' if manual_only else 'candidate-browser'
selection = ('mixed Kaprizov coverage stays unresolved' if coverage_supplement else
             'connected manager bench locks constrain|mixed Kaprizov coverage stays unresolved|goalie competition stays unresolved'
             if readiness else 'manual workspace retains reviewed intent' if manual_only else
             '1\\. a nonzero selected-move refresh|manual workspace retains reviewed intent')
for item in manifest['overlayFiles']:
    file = cwd.parent / item['path']
    assert hashlib.sha256(file.read_bytes()).hexdigest() == item['sha256'], file
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 3162))

# Verification configuration only; no canonical application/configuration writes.
config = cwd / '.rso-verification-playwright.config.ts'
config.write_text('''import base from "./playwright.config";
export default { ...base, webServer: {
  command: "npm run dev:stable -- -H 127.0.0.1 -p 3162",
  env: { PLAYWRIGHT_ISOLATED_NEXT: "1" },
  url: "http://127.0.0.1:3162/roster-schedule-optimizer",
  reuseExistingServer: false,
  timeout: 120000,
} };
''')
lock = Path('/private/tmp/fhfh-heavy.lock')
token = str(uuid.uuid4())
try:
    lock.mkdir()
except FileExistsError:
    raise SystemExit('Heavy slot occupied; no browser/server started')
inode = lock.stat().st_ino
(lock / 'owner.json').write_text(json.dumps({
    'owner': 'RSO isolated fixture browser check',
    'thread': '01a19764-091f-763d-a983-8c692d79200b',
    'token': token, 'pid': os.getpid(), 'port': 3162,
}))
env = {
    'PATH': '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    'HOME': os.environ['HOME'], 'TMPDIR': os.environ.get('TMPDIR', '/tmp'),
    'NODE_OPTIONS': '--require ' + str(out / 'loopback-only.cjs'),
    'NEXT_PUBLIC_SUPABASE_URL': 'http://127.0.0.1:9',
    'NEXT_PUBLIC_SUPABASE_PUBLIC_KEY': 'synthetic-public-key',
    'SUPABASE_SERVICE_ROLE_KEY': 'synthetic-service-role-key',
    'CMS_URL': 'http://127.0.0.1:3162', 'NEXT_TELEMETRY_DISABLED': '1',
    'PLAYWRIGHT_PORT': '3162', 'PLAYWRIGHT_ISOLATED_NEXT': '1',
    'PLAYWRIGHT_HTML_OPEN': 'never',
}
cmd = [
    'node', 'node_modules/@playwright/test/cli.js', 'test',
    '--config', str(config),
    'e2e/rso-continuity.spec.ts', 'e2e/roster-schedule-optimizer.spec.ts',
    '--grep', selection,
    '--workers=1', '--retries=0', '--reporter=line',
    '--output', str(out / (prefix + '-output')),
]
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
proc = None
timed_out = False
try:
    with (out / (prefix + '.log')).open('w') as log:
        proc = subprocess.Popen(cmd, cwd=cwd, env=env, stdout=log,
                                stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = proc.wait(timeout=240)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(proc.pid, signal.SIGTERM)
            code = proc.wait(timeout=15)
    (out / (prefix + '.json')).write_text(json.dumps({
        'startedAt': start,
        'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'exitCode': code, 'timedOut': timed_out, 'command': cmd, 'cwd': str(cwd),
        'candidateTree': manifest['candidateTree'],
        'environment': 'curated inert values; no environment files',
        'network': 'Node loopback-only guard plus test browser interception',
        'log': prefix + '.log',
    }, indent=2) + '\n')
    print((out / (prefix + '.log')).read_text()[-7000:])
    print('EXIT', code)
finally:
    if proc:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    if lock.stat().st_ino == inode and json.loads((lock / 'owner.json').read_text())['token'] == token:
        (lock / 'owner.json').unlink()
        lock.rmdir()
