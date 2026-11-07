from pathlib import Path
import sys,importlib.util,unittest,io,json,os
sys.dont_write_bytecode=True
root=Path('/Users/tim/Documents/Codex/2026-10-27/task-3/ppp-census-bounds-20261101-01');out=Path(__file__).resolve().parent
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'independent-ppp-census-audit','pid':os.getpid()};lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
network=[]
def audit(event,args):
 if event in ('socket.connect','socket.bind','socket.getaddrinfo'):network.append(event);raise RuntimeError('Independent audit forbids network')
sys.addaudithook(audit)
try:
 sys.path.insert(0,str(root));spec=importlib.util.spec_from_file_location('test_qualify',root/'test_qualify.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 # The original test writes disposable transport fixtures beneath ROOT. Redirect that test-only variable to our owned artifact directory.
 m.ROOT=out
 stream=io.StringIO();r=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(m));(out/'tests.log').write_text(stream.getvalue());result={'tests':r.testsRun,'failures':len(r.failures),'errors':len(r.errors),'passed':r.wasSuccessful(),'networkAttempts':network,'testFixtureRootRedirected':str(out),'sourcePacketWrites':0};(out/'TESTS.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));assert r.wasSuccessful()
finally:
 assert json.loads((lock/'owner.json').read_text())==owner;lock.rename(out/'test-lock-released')
