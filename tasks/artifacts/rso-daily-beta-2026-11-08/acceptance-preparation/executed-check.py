import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from datetime import datetime, timezone

repo = Path('/Users/tim/Code/fhfhockey.com')
artifacts = repo / 'tasks/artifacts/rso-daily-beta-2026-11-08/acceptance-preparation'
base = 'tasks/artifacts/rso-resume-2026-11-01/release-prep/'
sources = [base + 'qualification-capture/' + name + '.mjs'
           for name in ['inspect-identity', 'inspect-issued-packet', 'normalize-settlement']]
sources += [base + 'qualification-readbacks/tooling/check-readbacks.mjs']
tests = [p.replace('.mjs', '.test.mjs') for p in sources]
name = sys.argv[1]
assert name in ['cli-regression-red', 'cli-regression-green']
command = ['node', '--test', '--test-concurrency=1']
if name.endswith('-red'):
    command += ['--test-name-pattern=CLI.*symlink']
command += tests
env = {k: v for k, v in os.environ.items() if k in ['PATH', 'HOME', 'TMPDIR', 'LANG']}
env.update({'TZ': 'UTC', 'NODE_OPTIONS': '--require=/tmp/rso-daily-beta-20261108-guard.cjs',
            'RSO_NETWORK_LOG': str(artifacts / (name + '-blocked-network.log'))})
started = datetime.now(timezone.utc).isoformat()
clock = time.monotonic()
pins = {p: hashlib.sha256((repo / p).read_bytes()).hexdigest() for p in sources + tests}
with (artifacts / (name + '.log')).open('w') as log:
    result = subprocess.run(command, cwd=repo, env=env, stdout=log, stderr=subprocess.STDOUT)
receipt = {'command': command, 'cwd': str(repo), 'startedAt': started,
           'finishedAt': datetime.now(timezone.utc).isoformat(), 'exitCode': result.returncode,
           'durationSeconds': round(time.monotonic() - clock, 2), 'sourcePins': pins,
           'node': subprocess.check_output(['node', '--version'], text=True).strip(),
           'inputs': 'Existing fictional fixtures and temporary symlinks only; inert environment; outbound network guard.'}
(artifacts / (name + '.json')).write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({k: v for k, v in receipt.items() if k != 'sourcePins'}, indent=2))
print('\n'.join((artifacts / (name + '.log')).read_text().splitlines()[-30:]))
raise SystemExit(result.returncode)
