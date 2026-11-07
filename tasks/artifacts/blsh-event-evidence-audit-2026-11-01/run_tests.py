"""Audit harness: source tests unchanged, fixtures redirected locally, no network."""
import sys
sys.dont_write_bytecode = True
import importlib.util
import json
import os
from pathlib import Path
import unittest

OUT = Path(__file__).resolve().parent
SOURCE = Path('/Users/tim/Documents/Codex/2026-10-27/task-3/official-event-evidence-20261101-01')
LOCK = Path('/private/tmp/fhfh-heavy.lock')
owner = {'owner': 'codex-blsh-event-audit-tests', 'pid': os.getpid()}

def audit(event, args):
    if event in ('socket.connect', 'socket.bind', 'socket.getaddrinfo'):
        raise RuntimeError('Audit prohibits network: ' + event)

sys.addaudithook(audit)
LOCK.mkdir()
(LOCK / 'owner.json').write_text(json.dumps(owner))
try:
    sys.path.insert(0, str(SOURCE))
    suite = unittest.TestSuite()
    for name in ('test_collect', 'test_qualify'):
        spec = importlib.util.spec_from_file_location(name, SOURCE / (name + '.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.__file__ = str(OUT / (name + '.py'))
        suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(module))
    with (OUT / 'TESTS.log').open('x') as stream:
        result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    summary = {'testsRun': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors),
               'success': result.wasSuccessful(), 'networkDenied': True, 'fixtureRoot': str(OUT / 'test-artifacts')}
    (OUT / 'TESTS.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary))
    if not result.wasSuccessful():
        raise SystemExit(1)
finally:
    assert json.loads((LOCK / 'owner.json').read_text()) == owner
    LOCK.rename(OUT / 'tests-lock-released')
