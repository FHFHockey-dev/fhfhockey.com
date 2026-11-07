"""Bounded local-only FORGE v2 remediation checks; never installs or contacts hosted services."""
import argparse
import json
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument('check', choices=['unit', 'acceptance', 'compatibility', 'native', 'browser', 'types', 'lint'])
args = parser.parse_args()
checks = {
    'unit': ['npm', 'test', '--', '--run', 'lib/forge-v2/pipeline.test.ts', 'lib/forge-v2/uncertainty.test.ts', 'lib/forge-v2/refresh.test.ts', 'lib/forge-v2/evaluation.test.ts', 'lib/forge-v2/preparation.test.ts', 'lib/forge-v2/api.test.ts', 'lib/forge-v2/integration.test.ts', 'lib/forge-v2/contracts.test.ts', 'components/ForgeV2/ForecastExplorer.test.tsx', '--maxWorkers=1', '--minWorkers=1'],
    'acceptance': ['npm', 'test', '--', '--run', 'lib/forge-v2/preparation.test.ts', 'lib/forge-v2/data.test.ts', 'lib/forge-v2/model.test.ts', 'lib/forge-v2/schedule.test.ts', 'lib/forge-v2/lifecycle.test.ts', '--maxWorkers=1', '--minWorkers=1'],
    'compatibility': ['npm', 'test', '--', '--run', 'lib/player-forecasts/rsoUsePolicy.test.ts', 'lib/player-forecasts/forecastServingSource.test.ts', 'lib/rosterScheduleOptimizer/healthyReserves.test.ts', '--maxWorkers=1', '--minWorkers=1'],
    'native': ['npm', 'test', '--', '--run', 'lib/forge-v2/history.test.ts', '--maxWorkers=1', '--minWorkers=1'],
    'browser': ['npm', 'run', 'test:e2e', '--', 'e2e/forge-v2.spec.ts', '--project=chromium', '--workers=1', '--output=/tmp/forge-remediation-browser-results'],
    'types': ['./node_modules/.bin/tsc', '--noEmit', '--project', '/tmp/forge-v2-remediation-tsconfig.json'],
    'lint': ['./node_modules/.bin/eslint', 'lib/forge-v2', 'components/ForgeV2', 'pages/forge/v2', 'pages/api/v2/forge', 'e2e/forge-v2.spec.ts'],
}
if subprocess.check_output(['node', '--version'], text=True).strip() != 'v22.11.0':
    raise SystemExit('Use repository Node 22.11.0')
if args.check == 'types':
    Path('/tmp/forge-v2-remediation-tsconfig.json').write_text(json.dumps({'extends': str(root / 'web/tsconfig.json'), 'compilerOptions': {'incremental': False}, 'include': [str(root / ('web/' + path)) for path in ['next-bootstrap.d.ts', 'lib/forge-v2/**/*.ts', 'components/ForgeV2/**/*.tsx', 'pages/forge/v2/**/*.tsx', 'pages/api/v2/forge/**/*.ts', 'e2e/forge-v2.spec.ts']], 'exclude': [str(root / 'web/node_modules')]}))
lock = Path('/private/tmp/fhfh-heavy.lock')
try:
    lock.mkdir()
except FileExistsError:
    raise SystemExit('BLOCKED: shared heavy lock occupied; never remove another owner lock')
owner = lock / 'forge-remediation-owner.json'
owner.write_text(json.dumps({'thread': os.environ.get('CODEX_THREAD_ID'), 'pid': os.getpid(), 'check': args.check}))
env = os.environ.copy()
if args.check == 'native':
    env['FORGE_V2_POSTGRES_BIN'] = '/opt/homebrew/opt/postgresql@17/bin'
if args.check == 'browser':
    env['PLAYWRIGHT_SKIP_WEB_SERVER'] = '1'
log = Path('/tmp/forge-remediation-' + args.check + '.log')
try:
    with log.open('w') as stream:
        result = subprocess.run(checks[args.check], cwd=root / 'web', env=env, stdout=stream, stderr=subprocess.STDOUT)
    print(log.read_text()[-18000:])
    print(json.dumps({'check': args.check, 'exit': result.returncode, 'log': str(log)}))
    raise SystemExit(result.returncode)
finally:
    owner.unlink()
    lock.rmdir()
