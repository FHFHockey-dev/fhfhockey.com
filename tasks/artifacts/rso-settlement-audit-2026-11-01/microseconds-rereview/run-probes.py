from pathlib import Path
import hashlib
import json
import os
import subprocess
R = Path('/Users/tim/Code/fhfhockey.com'); O = Path(__file__).resolve().parent
env = {k: v for k, v in os.environ.items() if k in ['PATH', 'HOME', 'TMPDIR', 'LANG']}
env.update(NODE_OPTIONS='--require=' + str(O.parent / 'network-deny.cjs'), TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}', TS_NODE_TRANSPILE_ONLY='0')
lock = Path('/private/tmp/fhfh-heavy.lock'); owner = {'owner': 'codex-rso-microseconds-rereview-probes', 'pid': os.getpid()}
lock.mkdir(); (lock / 'owner.json').write_text(json.dumps(owner)); results = []
try:
    for name in ['UTC', 'America/New_York', 'loader']:
        command = ['node', str(O / 'loader-probe.mjs')] if name == 'loader' else ['node', '-r', 'ts-node/register', '-r', 'tsconfig-paths/register', str(O / 'probes.cjs')]
        p = subprocess.run(command, cwd=R / 'web', env={**env, 'TZ': 'UTC' if name == 'loader' else name}, capture_output=True, text=True, timeout=50)
        key = name.replace('/', '_'); (O / (key + '.stdout')).write_text(p.stdout); (O / (key + '.stderr')).write_text(p.stderr)
        assert p.returncode == 0, (name, p.stderr[:1500])
        results.append({'name': name, 'exitCode': p.returncode, 'result': json.loads(p.stdout)})
    a, b = (dict(r['result']) for r in results[:2]); a.pop('timezone'); b.pop('timezone'); assert a == b
    pins = json.loads((O / 'PINS.json').read_text())
    assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest() == h for path, h in pins.items())
    (O / 'PROBES.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps({'bothOriginalDefectsReproducedBeforeAndClosedAfter': True, 'timezonesIdentical': True, 'boundaryCasesEachTimezone': len(a['boundaryCases']), 'invalidCasesEachTimezone': len(a['invalidCases']), 'loader': results[2]['result'], 'allPinsUnchanged': len(pins)}))
finally:
    assert json.loads((lock / 'owner.json').read_text()) == owner
    lock.rename(O / 'probes-lock-released')
