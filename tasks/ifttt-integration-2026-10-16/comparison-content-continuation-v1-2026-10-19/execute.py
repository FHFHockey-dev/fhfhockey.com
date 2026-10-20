"""One justified continuation. No automatic retry or second-pass entry point."""
import hashlib
import json
import shutil
from pathlib import Path
import continuation as c

HERE = Path(__file__).resolve().parent


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    manifest = json.loads((HERE / 'execution-manifest.json').read_text())
    for path, value in manifest['files'].items(): assert sha(Path(path)) == value, 'execution pin drift'
    plan = json.loads((HERE / 'PLAN.json').read_text()); c.pins(plan)
    assert sha(c.bridge.LIVE) == plan['baseline']['ledger_sha256'] == '19c48ae3244bf65ec1d293ca95a1f66f3f1e6b2f03c2d530d3e44d2b99caea52'
    auth = json.loads((HERE / 'authorization.json').read_text())
    assert auth['execution_manifest_sha256'] == sha(HERE / 'execution-manifest.json')
    assert auth['plan_hash'] == c.p.digest(plan)
    with (HERE / 'pass-1-started.json').open('x') as f:
        json.dump({'authorization_sha256': sha(HERE / 'authorization.json'),
                   'execution_manifest_sha256': sha(HERE / 'execution-manifest.json'),
                   'baseline_ledger_sha256': sha(c.bridge.LIVE), 'maximum_calls': 17, 'retry': False}, f, indent=2)
    shutil.copyfile(c.bridge.LIVE, HERE / 'baseline-budget.sqlite')
    result = c.run(c.bridge.LIVE, plan, auth, transport=c.bridge.post_once,
                   credential_loader=c.pilot.load_key, output=HERE / 'pass-1')
    print(json.dumps({'status': result['status'], 'settled_records': len(result['records']),
        'aggregate_exposure_nano_usd': result['ledger']['exposure_nano_usd'], 'cap_nano_usd': result['ledger']['cap_nano_usd'],
        'ledger_sha256': sha(c.bridge.LIVE)}, indent=2), flush=True)


if __name__ == '__main__': main()
