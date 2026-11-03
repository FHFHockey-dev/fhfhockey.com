"""One full local TypeScript check under the shared atomic lock; preserve the lock receipt."""
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import subprocess
import sys
import uuid

root = Path('/Users/tim/Code/fhfhockey.com')
artifact = root / 'tasks/artifacts/roster-autopsy-verification-2026-10-29'
lock = Path('/private/tmp/fhfh-heavy.lock')
token = str(uuid.uuid4())
archive = Path(f'/private/tmp/fhfh-autopsy-typecheck-released-{token}')
log = artifact / 'TYPECHECK.log'
if log.exists():
    raise SystemExit('A type-check log already exists; preserve it and inspect before another attempt.')
try:
    lock.mkdir()
except FileExistsError:
    raise SystemExit('Shared heavy lock is occupied; no type-check was started.')
owner = {'owner': 'Roster Autopsy full TypeScript verification', 'token': token, 'created_utc': datetime.now(timezone.utc).isoformat()}
try:
    (lock / 'owner.json').write_text(json.dumps(owner) + '\n')
    env = {**os.environ, 'NODE_OPTIONS': '--max-old-space-size=8192'}
    with log.open('x') as output:
        try:
            result = subprocess.run([str(root / 'web/node_modules/.bin/tsc'), '--noEmit'], cwd=root / 'web', env=env,
                                    stdout=output, stderr=subprocess.STDOUT, timeout=180)
            code = result.returncode
        except subprocess.TimeoutExpired:
            output.write('\nType-check exceeded the 180 second bound.\n')
            code = 124
finally:
    owner_path = lock / 'owner.json'
    if owner_path.is_file() and json.loads(owner_path.read_text()).get('token') == token:
        lock.rename(archive)
    else:
        print('Lock ownership changed or could not be verified; lock was not altered.', file=sys.stderr)
        raise SystemExit(2)
print(json.dumps({'check': 'web full tsc --noEmit', 'exit_code': code, 'log': str(log), 'preserved_lock_receipt': str(archive)}))
raise SystemExit(code)
