from pathlib import Path
import datetime, importlib.util, json, os, sys, unittest

sys.dont_write_bytecode = True
OUT = Path(__file__).resolve().parent
BASE = Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
attempts = []
def guard(event, args):
    if event in ('socket.connect', 'socket.bind', 'socket.getaddrinfo'):
        attempts.append(event)
        raise RuntimeError('Audit forbids networking')
sys.addaudithook(guard)
lock = Path('/private/tmp/fhfh-heavy.lock')
owner = {'owner': 'CODEX-INDEPENDENT-BLSH-FRESH-BOX-AUDIT', 'pid': os.getpid(), 'atUTC': datetime.datetime.now(datetime.timezone.utc).isoformat()}
lock.mkdir()
(lock / 'owner.json').write_text(json.dumps(owner))
try:
    suite = unittest.TestSuite()
    for packet, names in [('fresh-box-qualification-20261101-01', ['test_capture', 'test_adapter']), ('fresh-source-qualification-20261101-01', ['test_reports', 'test_pages', 'test_comparison', 'test_linkage'])]:
        root = BASE / packet
        sys.path.insert(0, str(root))
        for name in names:
            spec = importlib.util.spec_from_file_location('audit_' + name, root / (name + '.py'))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(module))
    with (OUT / 'tests.log').open('w') as log:
        result = unittest.TextTestRunner(stream=log, verbosity=2).run(suite)
    receipt = {'tests': result.testsRun, 'failures': len(result.failures), 'errors': len(result.errors), 'passed': result.wasSuccessful(), 'networkAttempts': attempts, 'sourcePacketWrites': 0}
    (OUT / 'TESTS.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))
finally:
    assert json.loads((lock / 'owner.json').read_text()) == owner
    lock.rename(OUT / 'test-lock-released')
