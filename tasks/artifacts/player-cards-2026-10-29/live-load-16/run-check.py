from pathlib import Path
import subprocess, os, json, time, uuid, sys

artifact = Path(__file__).resolve().parent
repo = artifact.parents[3]
action = sys.argv[1]
commands = {
    'reproduce':['node',str(artifact/'reproduce.mjs')],
    'verify': ['python3', str(artifact / 'verify-batch.py')],
    'white-probe-old': ['node', str(artifact / 'white-probe.mjs'), str(artifact.parent / 'outline-colors-07' / 'preview.html')],
    'white-probe': ['node', str(artifact / 'white-probe.mjs')],
    'actual-render': ['node', str(artifact.parent / 'current-data-01' / 'approved-snapshot-02' / 'render-preview.mjs')],
    'actual-browser': ['node', str(artifact.parent / 'current-data-01' / 'approved-snapshot-02' / 'browser-check.mjs')],
    'qualify-remaining': ['python3', str(artifact / 'qualify.py'), '--remaining'],
    'final-static':['python3',str(artifact/'final-static-checks.py')],
    'qualify': ['python3', str(artifact / 'qualify.py')],
    'served': ['node', str(artifact / 'verify-served.mjs')],
    'diagnose-after': ['node', str(artifact / 'diagnose-logo-after.mjs')],
    'diagnose': ['node', str(artifact / 'diagnose-logo.mjs')],
    'tests': ['npm', 'test', '--', '--run', '--config', '../tasks/artifacts/player-cards-2026-10-29/live-load-16/vitest.config.mts'],
    'types': ['npx', '--no-install', 'tsc', '--noEmit', '--project', '../tasks/artifacts/player-cards-2026-10-29/live-load-16/tsconfig.json'],
    'lint': ['npx', '--no-install', 'eslint', 'lib/player-cards/currentNhl.ts', 'lib/player-cards/currentNhl.test.ts', 'lib/player-cards/currentSelection.ts', 'lib/player-cards/currentSelection.test.ts', 'lib/player-cards/currentNhlExport.ts', 'components/player-cards/CurrentPlayerCard.tsx', 'components/player-cards/CurrentPlayerCardStudio.tsx', 'components/player-cards/CurrentPlayerCardStudio.test.tsx'],
    'render': ['node', str(artifact / 'render-preview.mjs')],
    'browser': ['node', str(artifact / 'browser-check.mjs')],
}
lock = Path('/private/tmp/fhfh-heavy.lock')
deadline = time.monotonic() + (30 if len(sys.argv) > 2 and sys.argv[2] == 'wait' else 0)
while True:
    try:
        lock.mkdir()
        break
    except FileExistsError:
        if time.monotonic() >= deadline:
            print('BLOCKED: shared heavy lock exists; not stolen')
            sys.exit(75)
        time.sleep(.5)
token = str(uuid.uuid4())
owner = lock / 'owner.json'
owner.write_text(json.dumps({'owner': 'player-card-live16', 'pid': os.getpid(), 'token': token, 'action': action}))
try:
    env = os.environ.copy()
    env.pop('GIT_DIR', None)
    overrides = {'npm_config_cache': str(artifact / '.npm-cache'), 'npm_config_logs_dir': str(artifact / '.npm-logs'), 'NO_UPDATE_NOTIFIER': '1', 'NEXT_TELEMETRY_DISABLED': '1'}
    env.update(overrides)
    start = time.monotonic()
    with (artifact / (action + '.log')).open('w') as output:
        result = subprocess.run(commands[action], cwd=repo / 'web', env=env, stdout=output, stderr=subprocess.STDOUT, timeout=60)
    receipt = {'action': action, 'command': commands[action], 'cwd': str(repo / 'web'), 'exitCode': result.returncode, 'elapsedSeconds': round(time.monotonic() - start, 3), 'environmentOverrides': overrides, 'lockOwnedAndReleased': True}
    (artifact / (action + '-command.json')).write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))
    sys.exit(result.returncode)
finally:
    if owner.exists() and json.loads(owner.read_text()).get('token') == token:
        owner.unlink()
        lock.rmdir()
