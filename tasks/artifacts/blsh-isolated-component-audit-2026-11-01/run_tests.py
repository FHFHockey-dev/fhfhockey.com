"""Run the unchanged source tests with local-only fixtures and no network."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import importlib.util
import hashlib
import json
import os
import unittest

OUT = Path(__file__).resolve().parent
SOURCE = Path('/Users/tim/Documents/Codex/2026-10-27/task-3/isolated-component-admission-20261101-01')
pins = json.loads((SOURCE / 'RUN-PINS-02.json').read_text())
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest() == h for p, h in pins.items())
def audit(event, args):
    if event in ('socket.connect', 'socket.bind', 'socket.getaddrinfo'):
        raise RuntimeError('Independent audit forbids network: ' + event)
sys.addaudithook(audit)
lock = Path('/private/tmp/fhfh-heavy.lock'); owner = {'owner': 'codex-blsh-component-audit-tests', 'pid': os.getpid()}
lock.mkdir(); (lock / 'owner.json').write_text(json.dumps(owner))
try:
    sys.path.insert(0, str(SOURCE))
    spec = importlib.util.spec_from_file_location('test_admission', SOURCE / 'test_admission.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    module.__file__ = str(OUT / 'test_admission.py')
    with (OUT / 'TESTS.log').open('x') as stream:
        result = unittest.TextTestRunner(stream=stream, verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(module))
    receipt = {'testsRun': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors), 'success': result.wasSuccessful(), 'networkDenied': True, 'fixturesRedirected': str(OUT / 'test-artifacts')}
    assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest() == h for p, h in pins.items())
    (OUT / 'TESTS.json').write_text(json.dumps(receipt, indent=2) + '\n'); print(json.dumps(receipt))
    assert result.wasSuccessful()
finally:
    assert json.loads((lock / 'owner.json').read_text()) == owner
    lock.rename(OUT / 'tests-lock-released')
