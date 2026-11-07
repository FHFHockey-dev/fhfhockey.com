from pathlib import Path
import subprocess, os, json, time, uuid, sys

artifact = Path(__file__).resolve().parent
repo = artifact.parents[3]
action = sys.argv[1]
commands = {
    'nav-lint': ['npx', '--no-install', 'eslint', 'components/SocialShare/SocialShare.tsx'],
    'tests': ['npm', 'test', '--', '--run', '--config', '../tasks/artifacts/player-cards-2026-10-25/hero-share-checkpoint-01/vitest.config.mts'],
    'types': ['npx', '--no-install', 'tsc', '--noEmit', '--project', '../tasks/artifacts/player-cards-2026-10-25/hero-share-checkpoint-01/tsconfig.json'],
    'lint': ['npx', '--no-install', 'eslint', 'components/player-cards/EditorialPlayerCard.tsx', 'components/player-cards/HeroPlayerCard.tsx', 'components/player-cards/PlayerCardShareStudio.tsx', 'components/player-cards/PlayerCardShareStudio.test.tsx', 'lib/player-cards/shareExport.ts', 'lib/player-cards/shareExport.test.ts', 'lib/player-cards/reviewedHeroSamples.ts', 'pages/social-share/player-cards.tsx'],
    'render': ['node', str(artifact / 'render-preview.mjs')],
    'browser': ['node', str(artifact / 'browser-check.mjs')],
}
lock = Path('/private/tmp/fhfh-heavy.lock')
try:
    lock.mkdir()
except FileExistsError:
    print('BLOCKED: shared heavy lock exists; not stolen')
    sys.exit(75)
token = str(uuid.uuid4())
owner = lock / 'owner.json'
owner.write_text(json.dumps({'owner': 'player-card-visual01', 'pid': os.getpid(), 'token': token, 'action': action}))
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
