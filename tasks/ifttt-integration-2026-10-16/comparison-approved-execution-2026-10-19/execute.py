"""One explicitly approved comparison pass; no retry/resume entry point."""
import hashlib
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REVIEWED = HERE.parent / 'comparison-adjudication-bridge-v1-2026-10-19'
sys.path.insert(0, str(REVIEWED))
import bridge


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    expected = '17e92b736e9557adada234f7ac84f3156ed97fab2f573ff4906d008bb177c458'
    assert sha(REVIEWED / 'manifest.json') == expected
    manifest = json.loads((REVIEWED / 'manifest.json').read_text())
    for name, digest in manifest['files'].items(): assert sha(REVIEWED / name) == digest, 'reviewed file drift'
    for name, digest in manifest['runtime_pins'].items(): assert sha(Path(name)) == digest, 'runtime dependency drift'
    for name, digest in manifest['preserved_inputs'].items(): assert sha(Path(name)) == digest, 'preserved input drift'
    assert sha(bridge.LIVE) == '8b9574da4b587e756cb177360b97cb7af6d410e59686d0c5a2953d5bfa20db1a'
    plan = bridge.load_plan()
    authorization = json.loads((HERE / 'authorization.json').read_text())
    assert authorization['reviewed_manifest_sha256'] == expected
    assert authorization['owner_message_id'] == 'Sentinel_f2ed42c53adc8191a74da983ab5205a7'
    assert authorization['owner_reply'] == 'Approved'
    assert authorization['plan_hash'] == bridge.p.digest(plan)
    assert authorization['executor_sha256'] == sha(Path(__file__))
    # A create-only execution latch precedes any canonical mutation/key access.
    with (HERE / 'execution-started.json').open('x') as f:
        json.dump({'authorization_sha256': sha(HERE / 'authorization.json'), 'reviewed_manifest_sha256': expected,
                   'baseline_ledger_sha256': sha(bridge.LIVE), 'executor_sha256': sha(Path(__file__)),
                   'maximum_calls': 30, 'automatic_retries': 0}, f, indent=2)
    shutil.copyfile(bridge.LIVE, HERE / 'baseline-budget.sqlite')
    result = bridge.run(bridge.LIVE, plan, authorization, transport=bridge.post_once,
                        credential_loader=bridge.pilot.load_key, output=HERE / 'run-01')
    print(json.dumps({'status': result['status'], 'known_call_records': len(result['records']),
                      'aggregate_exposure_nano_usd': result['ledger']['exposure_nano_usd'],
                      'cap_nano_usd': result['ledger']['cap_nano_usd'],
                      'ledger_sha256': sha(bridge.LIVE)}, indent=2), flush=True)


if __name__ == '__main__': main()
