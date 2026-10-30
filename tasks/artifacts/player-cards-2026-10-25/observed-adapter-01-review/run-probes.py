from pathlib import Path
import subprocess,os,json,time,uuid,sys
own=Path(__file__).resolve().parent
repo=own.parents[3]
lock=Path('/private/tmp/fhfh-heavy.lock')
try: lock.mkdir()
except FileExistsError:
 print('BLOCKED shared heavy lock; not stolen');sys.exit(75)
token=str(uuid.uuid4());owner=lock/'owner.json'
owner.write_text(json.dumps({'owner':'nst-independent-review','pid':os.getpid(),'token':token,'action':'one-independent-probe-suite'}))
try:
 env=os.environ.copy();env.pop('GIT_DIR',None)
 command=['/usr/local/bin/node',str(own/'probes.mjs')]
 start=time.monotonic()
 with (own/'probes.log').open('w') as output:
  result=subprocess.run(command,cwd=repo/'web',env=env,stdout=output,stderr=subprocess.STDOUT,timeout=60)
 receipt={'command':command,'cwd':str(repo/'web'),'exitCode':result.returncode,'elapsedSeconds':round(time.monotonic()-start,3),'lockOwnedAndReleased':True}
 (own/'command.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt));sys.exit(result.returncode)
finally:
 if owner.exists() and json.loads(owner.read_text()).get('token')==token:
  owner.unlink();lock.rmdir()
