"""Run the isolated candidate's real build against bounded synthetic fixtures."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import datetime
import json
import os
import subprocess
import threading
import urllib.parse

ROOT = Path('/Users/tim/Code/fhfhockey.com')
OUT = ROOT / 'tasks/artifacts/checkpoint-production-release-2026-10-16'
CANDIDATE = Path('/tmp/fhf-release-checkpoint-20261016-0424/candidate/web')
requests = []
lock = threading.Lock()
seasons = [{'id': season, 'startDate': start, 'regularSeasonEndDate': end,
            'endDate': end, 'numberOfGames': 82}
           for season, start, end in [(20262027, '2026-10-01', '2027-04-30'),
                                      (20252026, '2025-10-01', '2026-04-30')]]

class Fixture(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        host = self.headers.get('x-fixture-origin', '')
        path = urllib.parse.urlsplit(self.path).path
        with lock:
            requests.append({'method': self.command, 'host': host, 'path': path})
            over_budget = len(requests) > 2000
        body = []
        content_type = 'application/json'
        if '.sanity.io' in host:
            body = {'result': []}
        elif path == '/rest/v1/seasons':
            body = seasons
        elif host == 'api.nhle.com' and path == '/stats/rest/en/season':
            body = {'data': seasons, 'total': len(seasons)}
        elif not path.startswith('/rest/v1/'):
            body = '<?xml version="1.0"?><rss version="2.0"><channel><title>Offline fixture</title><link>https://example.invalid</link><description>Synthetic empty feed</description></channel></rss>'
            content_type = 'application/xml'
        encoded = (body if isinstance(body, str) else json.dumps(body)).encode()
        self.send_response(503 if over_budget else 200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(encoded)))
        self.send_header('Content-Range', '0-0/0')
        self.end_headers()
        self.wfile.write(encoded)

class FixtureServer(ThreadingHTTPServer):
    request_queue_size = 128

server = FixtureServer(('127.0.0.1', 0), Fixture)
worker = threading.Thread(target=server.serve_forever, daemon=True)
worker.start()
environment = {key: os.environ[key] for key in ['PATH', 'HOME', 'TMPDIR', 'SHELL'] if key in os.environ}
environment.update({
    'CI': '1', 'NEXT_TELEMETRY_DISABLED': '1',
    'FHFH_BUILD_FIXTURE_PORT': str(server.server_port),
    'NODE_OPTIONS': f'--max-old-space-size=6144 --require={OUT / "offline-build-guard.cjs"}',
    'NEXT_PUBLIC_SUPABASE_URL': 'https://unit-tests.supabase.invalid',
    'NEXT_PUBLIC_SUPABASE_PUBLIC_KEY': 'synthetic-public-key',
    'SUPABASE_SERVICE_ROLE_KEY': 'synthetic-service-role-key',
    'NEXT_PUBLIC_SANITY_PROJECT_ID': 'offlinefixture',
    'NEXT_PUBLIC_SANITY_DATASET': 'production',
    'CMS_URL': 'http://127.0.0.1:9999',
})
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
commands = [
    ['node', '--require', str(OUT / 'offline-build-guard.cjs'),
     'node_modules/next/dist/bin/next', 'build'],
    ['npm', 'run', 'postbuild'],
]
try:
    with (OUT / 'offline-production-build.log').open('w') as log:
        preflight = """
          const assert = require('node:assert/strict');
          const net = require('node:net'), tls = require('node:tls');
          assert.throws(() => net.connect({ host: '203.0.113.1', port: 443 }), /blocked/);
          assert.throws(() => tls.connect({ host: '203.0.113.1', port: 443 }), /blocked/);
          assert.throws(() => fetch('https://example.invalid', { method: 'POST' }), /blocked/);
          fetch('https://offlinefixture.api.sanity.io/v1/data/query/production')
            .then(r => r.json()).then(data => { assert.deepEqual(data, { result: [] });
              console.log('Offline transport preflight passed: socket/TLS/write guards and GET fixture.'); });
        """
        result = subprocess.run(['node', '-e', preflight], cwd=CANDIDATE,
                                env=environment, stdout=log, stderr=subprocess.STDOUT, timeout=20)
        code = result.returncode
        if code == 0:
            for command in commands:
                result = subprocess.run(command, cwd=CANDIDATE, env=environment,
                                        stdout=log, stderr=subprocess.STDOUT, timeout=600)
                code = result.returncode
                if code:
                    break
except subprocess.TimeoutExpired:
    code = 124
finally:
    server.shutdown()
    server.server_close()
receipt = {'startedAt': started, 'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'commands': commands, 'cwd': str(CANDIDATE), 'exitCode': code,
           'externalRequests': 0, 'fixtureRequestCount': len(requests), 'fixtureBudget': 2000,
           'scope': 'Real Next production compile/prerender/postbuild with synthetic source fixtures; no hosted-data or production-runtime acceptance',
           'requests': requests}
(OUT / 'offline-production-build-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({key: value for key, value in receipt.items() if key != 'requests'}))
raise SystemExit(code)
