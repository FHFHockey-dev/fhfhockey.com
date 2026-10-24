from pathlib import Path
import datetime
import json
import os
import subprocess
import time
import uuid

artifact = Path(__file__).resolve().parent
repo = artifact.parents[2]
lock = Path('/private/tmp/fhfh-heavy.lock')
token = str(uuid.uuid4())
env = os.environ.copy()
env.pop('GIT_DIR', None)
overrides = {
    'npm_config_cache': str(artifact / '.npm-cache'),
    'npm_config_logs_dir': str(artifact / '.npm-logs'),
    'NO_UPDATE_NOTIFIER': '1',
    'NEXT_TELEMETRY_DISABLED': '1',
}
env.update(overrides)
checks = [
    ('offline-tests', ['npm', 'test', '--', '--run', '--config',
                       '../tasks/artifacts/wigo-local-fix-independent-review-2026-10-24/review.vitest.config.mts',
                       '--maxWorkers=1', '--no-file-parallelism']),
    ('scoped-lint', ['npx', '--no-install', 'eslint',
                     'pages/api/v1/db/calculate-wigo-stats.ts', 'utils/fetchWigoPlayerStats.ts',
                     '__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts',
                     'utils/fetchWigoPlayerStats.test.ts']),
]
record = {'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'environmentOverrides': overrides, 'checks': []}
out = artifact / 'COMMANDS.json'
for label, argv in checks:
    try:
        lock.mkdir()
    except FileExistsError:
        record['checks'].append({'label': label, 'command': argv, 'cwd': 'web',
                                 'blocked': 'Shared heavy lock already exists; not stolen.'})
        out.write_text(json.dumps(record, indent=2) + '\n')
        print(label + ': BLOCKED by existing heavy lock', flush=True)
        break
    owner_file = lock / 'owner.json'
    owner_file.write_text(json.dumps({'token': token, 'pid': os.getpid(),
                                      'owner': 'independent WiGO review', 'action': label}))
    try:
        started = time.monotonic()
        with (artifact / (label + '.log')).open('w') as log:
            result = subprocess.run(argv, cwd=repo / 'web', env=env,
                                    stdout=log, stderr=subprocess.STDOUT, timeout=60)
        entry = {'label': label, 'command': argv, 'cwd': 'web',
                 'exitCode': result.returncode, 'elapsedSeconds': round(time.monotonic() - started, 3),
                 'log': label + '.log'}
        record['checks'].append(entry)
        out.write_text(json.dumps(record, indent=2) + '\n')
        print(json.dumps(entry), flush=True)
    finally:
        if json.loads(owner_file.read_text()).get('token') == token:
            owner_file.unlink()
            lock.rmdir()
