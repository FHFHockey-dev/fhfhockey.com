from pathlib import Path
import subprocess,os,json,time,uuid,sys
own=Path(__file__).resolve().parent;repo=own.parents[3];lock=Path('/private/tmp/fhfh-heavy.lock')
try:lock.mkdir()
except FileExistsError:print('BLOCKED shared lock; not stolen');sys.exit(75)
token=str(uuid.uuid4());owner=lock/'owner.json';owner.write_text(json.dumps({'owner':'portrait-independent-review','pid':os.getpid(),'token':token}))
try:
 env=os.environ.copy();env.pop('GIT_DIR',None);env.update({'npm_config_cache':str(own/'.npm-cache'),'npm_config_logs_dir':str(own/'.npm-logs'),'NO_UPDATE_NOTIFIER':'1'})
 commands=[['npm','test','--','--run','--config','../tasks/artifacts/player-cards-2026-10-25/portrait-technical-review-01/vitest.config.mts'],['/usr/local/bin/node',str(own/'read-pixels.mjs')]];receipts=[]
 for i,command in enumerate(commands):
  start=time.monotonic()
  with (own/('run-'+str(i)+'.log')).open('w') as out:result=subprocess.run(command,cwd=repo/'web',env=env,stdout=out,stderr=subprocess.STDOUT,timeout=60)
  receipts.append({'command':command,'exitCode':result.returncode,'elapsedSeconds':round(time.monotonic()-start,3)})
 (own/'commands.json').write_text(json.dumps({'receipts':receipts,'lockOwnedAndReleased':True},indent=2)+'\n');print(json.dumps(receipts));sys.exit(int(any(r['exitCode'] for r in receipts)))
finally:
 if owner.exists() and json.loads(owner.read_text()).get('token')==token:owner.unlink();lock.rmdir()
