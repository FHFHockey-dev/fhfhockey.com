"""TEST-ONLY e2e step 4: the live wrapper's run() end to end, offline. Only psycopg2.connect (-> FakeRaw over the fake DB),
the clocks, the env file (a fake DSN), the scope/receipt and the lock paths are substituted; the export is the REAL node
subprocess against the REAL candidate conversion. Sockets are blocked.
    e2e_read.py <scratch> <conversionDir> <workDir>
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE.parent), str(HERE)]
import capture_reader as c       # noqa: E402
import fake_db as f              # noqa: E402
import read_only_session as ros  # noqa: E402
import run_live_read as w        # noqa: E402
import make_scope                # noqa: E402

scratch, conversion, work = (Path(a) for a in sys.argv[1:4])
FAKE_DSN = 'postgresql://postgres:offline-fake-password-not-real@db.fyhftlxokyjtpndbkfse.supabase.co:5432/postgres'


def no_network(*_a, **_k):
    raise AssertionError('network attempted')


sha = lambda b: hashlib.sha256(b).hexdigest()
receipt = scratch / 'E2E-TESTS-RECEIPT.json'
receipt.write_text(json.dumps({'passed': 1, 'failed': 0, 'pins': make_scope.local_pins(), 'label': 'E2E ONLY'}))
scope = scratch / 'E2E-LIVE-READ-SCOPE.json'
scope.write_bytes(make_scope.encode(make_scope.build(sha(receipt.read_bytes()))))
env = scratch / 'e2e.env'
env.write_text('SUPABASE_DB_URL=%s\n' % FAKE_DSN); os.chmod(env, 0o600)
args = {'execute-read-only': True, 'candidate': 'v5', 'scope-sha': sha(scope.read_bytes()), 'conversion': str(conversion),
        'out': str(work / 'request-read'), 'request-out': str(work / 'request.json'), 'context-out': str(work / 'context.json')}
logs = []
with patch.object(c, 'utc_now', f.fixed_clock('2026-11-17T14:20:00.000000+00:00')), \
        patch.object(socket.socket, 'connect', no_network), \
        patch.object(ros.psycopg2, 'connect', lambda **kw: f.FakeRaw(f.FakeDB(), ros.HOST)):
    rc = w.run(args, own_env={'PATH': '/usr/bin:/bin', 'LC_CTYPE': 'UTF-8'},
               now=lambda: dt.datetime(2026, 11, 17, 14, 20, tzinfo=dt.timezone.utc), env_file=env,
               lock_dir=scratch / 'locks', scope_path=scope, tests_receipt=receipt, startup_modules=frozenset(sys.modules),
               candidates={'v5': {**w.CANDIDATES['v5'], 'packet': 'packet'}},  # e2e packet dir is <scratch>/packet; real v5 hashes
               log=logs.append)
blob = ''.join(p.read_text() for p in (work / 'request-read').rglob('*.json')) + json.dumps(logs)
out = {**logs[-1], 'rc': rc, 'credentialValueInOutputs': 'offline-fake-password-not-real' in blob,
       'packetLock': sorted(p.name for p in (scratch / 'locks').iterdir())}
print(json.dumps(out))
sys.exit(0 if rc == 0 and not out['credentialValueInOutputs'] else 1)
