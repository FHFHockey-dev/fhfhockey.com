"""Capture or check a pinned source copy while respecting the shared heavy-work slot."""
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import subprocess
import sys
import uuid

root = Path('/Users/tim/Code/fhfhockey.com')
artifact = Path(__file__).resolve().parent
if len(sys.argv) != 2 or sys.argv[1] not in ('prepare', 'checks'):
    raise SystemExit('Expected prepare or checks.')
phase = sys.argv[1]
record = artifact / f'{phase.upper()}-EXECUTION.json'
if record.exists():
    raise SystemExit('Phase evidence already exists; preserve and inspect it before another attempt.')
lock = Path('/private/tmp/fhfh-heavy.lock')
token = str(uuid.uuid4())
archive = Path(f'/private/tmp/fhfh-autopsy-usability-{phase}-released-{token}')
try:
    lock.mkdir()
except FileExistsError:
    raise SystemExit('Shared heavy lock is occupied; no work started.')
summary = {'phase': phase, 'result': 'not_started', 'checks': []}
try:
    (lock / 'owner.json').write_text(json.dumps({'owner': f'Roster Autopsy usability {phase}', 'token': token,
        'created_utc': datetime.now(timezone.utc).isoformat()}) + '\n')
    if phase == 'prepare':
        runs = [('SNAPSHOT-CAPTURE.log', ['python3', '-B', str(artifact / 'prepare-snapshot.py')], root)]
    else:
        snapshot = Path(json.loads((artifact / 'SNAPSHOT.json').read_text())['snapshotPath'])
        runs = [
            ('SNAPSHOT-BEFORE.log', ['python3', '-B', str(artifact / 'verify-snapshot.py')], root),
            ('TESTS.log', [str(snapshot / 'node_modules/.bin/vitest'), '--run', '--config', 'vitest.snapshot.config.mts',
                'lib/rosterAutopsy/manual.test.ts', 'components/RosterAutopsy/RosterAutopsy.test.tsx'], snapshot),
            ('TYPECHECK.log', [str(snapshot / 'node_modules/.bin/tsc'), '--noEmit', '-p', 'tsconfig.autopsy-verify.json'], snapshot),
            ('CSS.log', ['node', '-e', 'const sass = require("sass"); const postcss = require("postcss"); const local = require("postcss-modules-local-by-default"); postcss([local({mode:"pure"})]).process(sass.compile("components/RosterAutopsy/RosterAutopsy.module.scss").css,{from:undefined}).then(()=>console.log("Sass and CSS-module purity passed"),err=>{console.error(err);process.exitCode=1})'], snapshot),
            ('SNAPSHOT-AFTER-CHECKS.log', ['python3', '-B', str(artifact / 'verify-snapshot.py')], root),
        ]
    env = {key: os.environ[key] for key in ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL'] if key in os.environ}
    env['NEXT_TELEMETRY_DISABLED'] = '1'
    env['NEXT_PUBLIC_SUPABASE_URL'] = 'http://127.0.0.1:9'
    env['NEXT_PUBLIC_SUPABASE_PUBLIC_KEY'] = 'fixture-only'
    env['CMS_URL'] = 'http://127.0.0.1:9'
    env['NODE_OPTIONS'] = f'--require={artifact / "net-deny.cjs"} --max-old-space-size=8192'
    env['C7_NET_LOG'] = str(artifact / f'{phase.upper()}-NETWORK-DENIALS.jsonl')
    for log_name, command, cwd in runs:
        with (artifact / log_name).open('x') as log:
            result = subprocess.run(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=180)
        summary['checks'].append({'log': log_name, 'exitCode': result.returncode})
        if result.returncode:
            raise RuntimeError(f'{log_name} exited {result.returncode}; later checks were not started.')
    summary['result'] = 'passed'
except Exception as error:
    summary['result'] = 'failed'
    summary['error'] = f'{type(error).__name__}: {error}'
finally:
    owner_path = lock / 'owner.json'
    if owner_path.is_file() and json.loads(owner_path.read_text()).get('token') == token:
        lock.rename(archive)
        summary['preservedLockReceipt'] = str(archive)
    else:
        summary['lockRelease'] = 'not altered: ownership could not be verified'
        summary['result'] = 'failed'
    record.write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary))
raise SystemExit(0 if summary['result'] == 'passed' else 1)
