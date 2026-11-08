from pathlib import Path
import datetime,importlib.util,json,os,sys,unittest
sys.dont_write_bytecode=True
O=Path(__file__).resolve().parent
P=Path('/Users/tim/Documents/Codex/2026-10-27/task-3/nst-lineage-and-gs-alternatives-20261101-01')
attempts=[]
def guard(event,args):
    if event in ('socket.connect','socket.bind','socket.getaddrinfo'):
        attempts.append(event);raise RuntimeError('Audit forbids networking')
sys.addaudithook(guard);sys.path.insert(0,str(P))
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'CODEX-INDEPENDENT-BLSH-NST-GS-AUDIT','pid':os.getpid(),'atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
try:
    suite=unittest.TestSuite()
    for name in ['test_nst_lineage','test_goal_absence','test_event_scope']:
        spec=importlib.util.spec_from_file_location(name,P/(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
        suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(m))
    with (O/'tests.log').open('w') as log:r=unittest.TextTestRunner(stream=log,verbosity=2).run(suite)
    result={'tests':r.testsRun,'failures':len(r.failures),'errors':len(r.errors),'passed':r.wasSuccessful(),'networkAttempts':attempts,'sourcePacketWrites':0}
    (O/'TESTS.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:
    assert json.loads((lock/'owner.json').read_text())==owner
    lock.rename(O/'tests-lock-released')
