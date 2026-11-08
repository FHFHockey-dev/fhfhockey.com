"""Apply the delivery patch only to disposable copies; exercise its retained path."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import tempfile

R = Path('/Users/tim/Code/fhfhockey.com'); O = Path(__file__).resolve().parent
P = R / 'tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-readbacks'
relative = Path('tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling')
layout = Path(tempfile.mkdtemp(prefix='rso-microseconds-independent-', dir='/private/tmp')).resolve()
target = layout / relative; target.mkdir(parents=True)
for name in ('check-readbacks.mjs', 'check-readbacks.test.mjs'):
    shutil.copyfile(R / relative / name, target / name)
headers = [line[6:] for line in (P / 'source.patch').read_text().splitlines() if line.startswith('+++ b/')]
assert headers == [str(relative / name) for name in ('check-readbacks.mjs', 'check-readbacks.test.mjs')]
applied = subprocess.run(['git', 'apply', '--whitespace=error', str(P / 'source.patch')], cwd=layout, capture_output=True, text=True)
assert applied.returncode == 0, applied.stderr
for name in ('check-readbacks.mjs', 'check-readbacks.test.mjs'):
    assert (target / name).read_bytes() == (P / 'tooling' / name).read_bytes()
(layout / 'web').symlink_to(R / 'web', target_is_directory=True)
(target / 'fixtures').mkdir()
names = ['issued.json', 'rso.json', 'start-chart.json', 'settlement.json', 'scope.json']
for name in names:
    shutil.copyfile(P / 'tooling/fixtures' / name, target / 'fixtures' / name)
env = {k: v for k, v in os.environ.items() if k in ['PATH', 'HOME', 'TMPDIR', 'LANG']}
env.update(NODE_OPTIONS='--require=' + str(O.parent / 'network-deny.cjs'), TZ='UTC')
command = ['node', str(target / 'check-readbacks.mjs')]
for flag, name in zip(['issued', 'rso', 'start-chart', 'settlement', 'scope'], names): command.extend(['--' + flag, str(target / 'fixtures' / name)])
lock = Path('/private/tmp/fhfh-heavy.lock'); owner = {'owner': 'codex-rso-microseconds-rereview-layout', 'pid': os.getpid()}
lock.mkdir(); (lock / 'owner.json').write_text(json.dumps(owner))
try:
    result = subprocess.run(command, cwd='/tmp', env=env, capture_output=True, text=True, timeout=50)
    (O / 'layout.stdout').write_text(result.stdout); (O / 'layout.stderr').write_text(result.stderr)
    assert result.returncode == 0 and result.stdout.strip(), result.stderr
    report = json.loads(result.stdout); assert report['summary']['pass'] is True and report['summary']['settled'] == 2
    pins = json.loads((O / 'PINS.json').read_text()); assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest() == h for p, h in pins.items())
    receipt = {'layout': str(layout), 'canonicalSourceChanged': False, 'appliedToDisposableCopiesOnly': True, 'exactCandidateBytesAfterPatch': True, 'cwd': '/tmp', 'physicalEntryPathUsed': True, 'exitCode': result.returncode, 'summary': report['summary'], 'allPinsUnchanged': len(pins), 'networkDenied': True}
    (O / 'LAYOUT.json').write_text(json.dumps(receipt, indent=2) + '\n'); print(json.dumps(receipt))
finally:
    assert json.loads((lock / 'owner.json').read_text()) == owner
    lock.rename(O / 'layout-lock-released')
