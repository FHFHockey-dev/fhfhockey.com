import datetime
import json
import os
from pathlib import Path
import subprocess
import uuid

ROOT = Path('/Users/tim/Code/fhfhockey.com')
ARTIFACT = Path(__file__).resolve().parent
LOCK = Path('/private/tmp/fhfh-heavy.lock')
TOKEN = str(uuid.uuid4())
FILES = ['lib/nst/goalieCatchup.server.ts', 'lib/nst/goalieCatchup.server.test.ts']
try:
    LOCK.mkdir()
except FileExistsError:
    raise SystemExit('BLOCKED: shared heavy lock exists; no checks started.')
(LOCK / 'owner.json').write_text(json.dumps({'task': 'NST-GOALIE-CHECKPOINT-ADAPTER-20261101', 'token': TOKEN, 'pid': os.getpid()}))
checks = []
try:
    version = subprocess.check_output(['node', '--version'], cwd=ROOT / 'web', text=True).strip()
    assert version == 'v22.11.0', version
    env = dict(os.environ)
    env['NODE_OPTIONS'] = f'--require={ARTIFACT / "offline.cjs"}'
    commands = [
        ('tests', ['npm', 'test', '--', '--run', FILES[1], '--maxWorkers=1', '--minWorkers=1']),
        ('types', ['node', 'node_modules/typescript/bin/tsc', '--project', str(ARTIFACT / 'tsconfig.adapter.json')]),
        ('lint', ['node', 'node_modules/eslint/bin/eslint.js', *FILES]),
    ]
    phases = os.environ.get("NST_CHECK_PHASES", "tests,types,lint").split(",")
    for name, command in commands:
        if name not in phases:
            continue
        print(f'Starting {name}', flush=True)
        result = subprocess.run(command, cwd=ROOT / 'web', env=env, capture_output=True, text=True, timeout=120)
        (ARTIFACT / f'adapter-{name}.log').write_text(result.stdout + result.stderr)
        checks.append({'name': name, 'command': command, 'exitCode': result.returncode})
        print(result.stdout[-3000:] + result.stderr[-1500:], flush=True)
        if result.returncode:
            raise SystemExit(result.returncode)
finally:
    (ARTIFACT / 'ADAPTER-CHECKS.json').write_text(json.dumps({
        'atUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'checks': checks, 'networkGuard': 'offline.cjs',
        'scope': 'Unwired checkpoint adapter; mocked transactional store only. No SQL execution, migration, provider or production verification.'
    }, indent=2) + '\n')
    if json.loads((LOCK / 'owner.json').read_text()).get('token') == TOKEN:
        (LOCK / 'owner.json').unlink()
        LOCK.rmdir()
