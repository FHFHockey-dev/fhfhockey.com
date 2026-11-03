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
FILES = ['pages/api/v1/db/update-nst-goalies.ts', '__tests__/pages/api/v1/db/update-nst-goalies.route.test.ts', 'lib/cron/nstBurstPlans.ts', 'lib/cron/nstBurstPlans.test.ts', 'lib/routeRunner/core.ts', 'lib/routeRunner/core.test.ts', 'lib/routeRunner/registry.ts', 'lib/routeRunner/tick.ts', 'lib/routeRunner/tick.test.ts', 'lib/routeRunner/store.ts', 'lib/routeRunner/store.test.ts', 'pages/api/v1/db/cron-report.ts', '__tests__/pages/api/v1/db/cron-report.test.ts', 'components/CronReportEmail/CronAuditEmail.tsx', '__tests__/components/CronReportEmail/CronAuditEmail.test.tsx']
try:
    LOCK.mkdir()
except FileExistsError:
    raise SystemExit('BLOCKED: shared heavy lock exists; no checks started.')
(LOCK / 'owner.json').write_text(json.dumps({'task': 'NST-GOALIE-WRITER-20261101-INTEGRATION', 'token': TOKEN, 'pid': os.getpid()}))
checks = []
try:
    version = subprocess.check_output(['node', '--version'], cwd=ROOT / 'web', text=True).strip()
    assert version == 'v22.11.0', version
    env = dict(os.environ)
    env['NODE_OPTIONS'] = f'--require={ARTIFACT / "offline.cjs"}'
    commands = [
        ('tests', ['npm', 'test', '--', '--run', *[f for f in FILES if '.test.' in f], '--maxWorkers=1', '--minWorkers=1']),
        ('types', ['node', '--max-old-space-size=8192', 'node_modules/typescript/bin/tsc', '--project', str(ARTIFACT / 'tsconfig.integration.json')]),
        ('lint', ['node', 'node_modules/eslint/bin/eslint.js', *FILES]),
    ]
    phases = os.environ.get("NST_CHECK_PHASES", "tests,types,lint").split(",")
    for name, command in commands:
        if name not in phases:
            continue
        print(f'Starting {name}', flush=True)
        result = subprocess.run(command, cwd=ROOT / 'web', env=env, capture_output=True, text=True, timeout=240)
        (ARTIFACT / f'integration-{name}.log').write_text(result.stdout + result.stderr)
        checks.append({'name': name, 'command': command, 'exitCode': result.returncode})
        print(result.stdout[-3000:] + result.stderr[-1500:], flush=True)
        if result.returncode:
            raise SystemExit(result.returncode)
finally:
    (ARTIFACT / 'INTEGRATION-CHECKS.json').write_text(json.dumps({
        'atUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'checks': checks, 'networkGuard': 'offline.cjs',
        'scope': 'Transferred route/runner/report closure with mocked IO and offline guard. No production verification.'
    }, indent=2) + '\n')
    if json.loads((LOCK / 'owner.json').read_text()).get('token') == TOKEN:
        (LOCK / 'owner.json').unlink()
        LOCK.rmdir()
