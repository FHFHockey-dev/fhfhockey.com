"""Run only checker and adapter regressions, offline, in both requested zones."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import subprocess

R = Path('/Users/tim/Code/fhfhockey.com')
O = Path(__file__).resolve().parent
P = R / 'tasks/artifacts/rso-resume-2026-11-01/release-prep'
pins = {str(R / f['path']): f['sha256'] for f in json.loads((P / 'qualification-readbacks/microseconds-review/EVIDENCE.json').read_text())['files']}
old = json.loads((O.parent / 'timestamp-rereview/PINS.json').read_text())
changed = {str(P / p) for p in ['qualification-capture/normalize-readbacks.test.ts', 'qualification-capture/normalize-settlement.test.mjs', 'qualification-readbacks/tooling/check-readbacks.mjs', 'qualification-readbacks/tooling/check-readbacks.test.mjs']}
for path, digest in old.items():
    if path not in changed:
        assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == digest, path
        pins[path] = digest
for path in [P / 'qualification-readbacks/microseconds-review/HANDOFF.md', P / 'qualification-readbacks/microseconds-review/EVIDENCE.json', P / 'qualification-readbacks/microseconds-review/before-check-readbacks.mjs', R / 'tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling/check-readbacks.mjs', R / 'tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling/check-readbacks.test.mjs']:
    pins[str(path)] = hashlib.sha256(path.read_bytes()).hexdigest()
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest() == h for p, h in pins.items())
assert hashlib.sha256(subprocess.check_output(['git', 'show', 'HEAD:web/lib/projections/evidenceTime.ts'], cwd=R)).hexdigest() == pins[str(R / 'web/lib/projections/evidenceTime.ts')]
env = {k: v for k, v in os.environ.items() if k in ['PATH', 'HOME', 'TMPDIR', 'LANG']}
env.update(NODE_OPTIONS='--require=' + str(O.parent / 'network-deny.cjs'), TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}', TS_NODE_TRANSPILE_ONLY='0')
lock = Path('/private/tmp/fhfh-heavy.lock')
owner = {'owner': 'codex-rso-microseconds-rereview-tests', 'pid': os.getpid()}
lock.mkdir(); (lock / 'owner.json').write_text(json.dumps(owner))
results = []
try:
    for tz in ['UTC', 'America/New_York']:
        for kind, target in [('checker', P / 'qualification-readbacks/tooling/check-readbacks.test.mjs'), ('readbacks', P / 'qualification-capture/normalize-readbacks.test.ts'), ('settlement', P / 'qualification-capture/normalize-settlement.test.mjs')]:
            command = ['node'] + (['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'] if kind == 'readbacks' else []) + ['--test', str(target)]
            result = subprocess.run(command, cwd=R / 'web', env={**env, 'TZ': tz}, capture_output=True, text=True, timeout=50)
            log = result.stdout + result.stderr; name = kind + '-' + tz.replace('/', '_')
            (O / (name + '.log')).write_text(log)
            counts = {k: int(v) for k, v in re.findall(r'^# (tests|pass|fail) (\d+)$', log, re.M)}
            results.append({'check': name, 'exitCode': result.returncode, 'counts': counts})
            print(json.dumps(results[-1]), flush=True)
    assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest() == h for p, h in pins.items())
    receipt = {'checks': results, 'allPassed': all(r['exitCode'] == 0 for r in results), 'sourcePinsUnchanged': len(pins), 'productionEnvironmentAbsent': True, 'networkGuard': str(O.parent / 'network-deny.cjs'), 'retainedToolingNotModified': True}
    (O / 'TESTS.json').write_text(json.dumps(receipt, indent=2) + '\n')
    (O / 'PINS.json').write_text(json.dumps(pins, indent=2) + '\n')
    assert receipt['allPassed']
finally:
    assert json.loads((lock / 'owner.json').read_text()) == owner
    lock.rename(O / 'tests-lock-released')
