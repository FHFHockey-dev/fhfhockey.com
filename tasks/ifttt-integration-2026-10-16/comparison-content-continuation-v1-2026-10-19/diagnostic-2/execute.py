"""The second and final justified test is one Decisions request only."""
import json,shutil
from pathlib import Path
import diagnostic as d

HERE=Path(__file__).resolve().parent


def main():
    plan=json.loads((HERE/'PLAN.json').read_text());auth=json.loads((HERE/'authorization.json').read_text())
    manifest=json.loads((HERE/'execution-manifest.json').read_text())
    for path,h in manifest['files'].items():assert d.sha(Path(path))==h,'diagnostic execution pin drift'
    assert auth['execution_manifest_sha256']==d.sha(HERE/'execution-manifest.json')
    assert d.sha(d.bridge.LIVE)==plan['baseline_ledger_sha256']=='16b2bd664552127824c66819b629b34bd388c1d18f28baa070263a5d52f53fec'
    with (HERE/'started.json').open('x') as f:json.dump({'maximum_calls':1,'authorization_sha256':d.sha(HERE/'authorization.json'),'hypothesis_sha256':d.sha(HERE/'HYPOTHESIS.md'),'automatic_retry':False},f,indent=2)
    shutil.copyfile(d.bridge.LIVE,HERE/'baseline-budget.sqlite')
    result=d.run_once(d.bridge.LIVE,plan,auth,transport=d.bridge.post_once,credential_loader=d.pilot.load_key,output=HERE/'run-01')
    print(json.dumps({'status':result['status'],'known_record':result.get('record') is not None,
        'aggregate_exposure_nano_usd':result['ledger']['exposure_nano_usd'],'cap_nano_usd':result['ledger']['cap_nano_usd'],'ledger_sha256':d.sha(d.bridge.LIVE)},indent=2),flush=True)


if __name__=='__main__':main()
