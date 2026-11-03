import datetime
import json
import os
from pathlib import Path
import subprocess
import uuid

ROOT = Path('/Users/tim/Code/fhfhockey.com')
ARTIFACT = Path(__file__).resolve().parent
OFFLINE = ARTIFACT.parents[1] / 'offline.cjs'
LOCK = Path('/private/tmp/fhfh-heavy.lock')
TOKEN = str(uuid.uuid4())
FILES = ['lib/nst/goaliePreparation.server.ts', 'lib/nst/goaliePreparation.server.test.ts', 'lib/nst/goalieFreshness.ts', 'lib/nst/goalieFreshness.server.ts', 'lib/nst/goalieFreshness.server.test.ts', 'pages/api/v1/db/update-nst-goalies.ts', '__tests__/pages/api/v1/db/update-nst-goalies.route.test.ts', 'pages/api/v1/db/cron-report.ts', '__tests__/pages/api/v1/db/cron-report.test.ts', 'components/CronReportEmail/CronAuditEmail.tsx', '__tests__/components/CronReportEmail/CronAuditEmail.test.tsx', 'lib/nst/jobLifecycle.server.ts', 'lib/nst/jobLifecycle.server.test.ts', 'lib/nst/sharedAdmission.ts', 'lib/nst/sharedAdmission.test.ts', 'lib/nst/client.ts', 'lib/nst/client.test.ts', 'lib/nst/goalieCatchup.server.ts', 'lib/nst/goalieCatchup.server.test.ts', 'pages/api/Teams/nst-team-stats.ts', '__tests__/pages/api/Teams/nst-team-stats.route.test.ts', 'pages/api/v1/db/update-nst-current-season.ts', '__tests__/pages/api/v1/db/update-nst-current-season.test.ts', 'pages/api/v1/db/update-nst-team-daily.ts', '__tests__/pages/api/v1/db/update-nst-team-daily.test.ts']
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
    env['NODE_OPTIONS'] = f'--require={OFFLINE}'
    commands = [
        ('tests', ['npm', 'test', '--', '--run', *[f for f in FILES if '.test.' in f], '--maxWorkers=1', '--minWorkers=1']),
        ('types', ['node', 'node_modules/typescript/bin/tsc', '--project', str(ARTIFACT / 'tsconfig.json')]),
        ('lint', ['node', 'node_modules/eslint/bin/eslint.js', *FILES]),
    ]
    phases = os.environ.get("NST_CHECK_PHASES", "tests,types,lint").split(",")
    for name, command in commands:
        if name not in phases:
            continue
        print(f'Starting {name}', flush=True)
        result = subprocess.run(command, cwd=ROOT / 'web', env=env, capture_output=True, text=True, timeout=120)
        (ARTIFACT / f'preparation-{name}.log').write_text(result.stdout + result.stderr)
        checks.append({'name': name, 'command': command, 'exitCode': result.returncode})
        print(result.stdout[-3000:] + result.stderr[-1500:], flush=True)
        if result.returncode:
            raise SystemExit(result.returncode)
finally:
    (ARTIFACT / 'CHECKS.json').write_text(json.dumps({
        'atUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'checks': checks, 'networkGuard': 'offline.cjs',
        'scope': 'Owned route/runner/checkpoint adapter integration with mocked I/O; isolated PostgreSQL proof recorded separately. No provider or production verification.'
    }, indent=2) + '\n')
    if json.loads((LOCK / 'owner.json').read_text()).get('token') == TOKEN:
        (LOCK / 'owner.json').unlink()
        LOCK.rmdir()
