from pathlib import Path
import sys,importlib.util,unittest,io,json,os,socket
sys.dont_write_bytecode=True
root=Path('/Users/tim/Documents/Codex/2026-10-27/task-3/practical-use-comparison-20261101-01');out=Path(__file__).resolve().parent
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'independent-blsh-practical-audit','pid':os.getpid(),'scope':'20 pure Python tests'}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
network=[]
def audit(event,args):
 if event in ('socket.connect','socket.bind','socket.getaddrinfo'):network.append(event);raise RuntimeError('Independent audit forbids network')
sys.addaudithook(audit)
results=[]
try:
 for folder,name in [(root,'test_compare'),(root/'ppp-cached-check-01','test_check')]:
  sys.path.insert(0,str(folder));spec=importlib.util.spec_from_file_location(name,folder/(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  stream=io.StringIO();result=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(module));(out/(name+'.log')).write_text(stream.getvalue())
  results.append({'suite':name,'run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'success':result.wasSuccessful()});sys.path.pop(0)
 (out/'tests.json').write_text(json.dumps({'results':results,'networkAttempts':network},indent=2)+'\n');print(json.dumps(results));assert all(x['success'] for x in results)
finally:
 assert json.loads((lock/'owner.json').read_text())==owner;lock.rename(out/'test-lock-released')
