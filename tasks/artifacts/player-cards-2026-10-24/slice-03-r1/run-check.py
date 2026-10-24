from pathlib import Path
import subprocess, os, json, time, uuid, sys

artifact = Path(__file__).resolve().parent
repo = artifact.parents[3]
action = sys.argv[1]
commands = {
 'probes': ['npm','test','--','--run','--config','../tasks/artifacts/player-cards-2026-10-24/slice-03-r1/review.vitest.config.mts','--maxWorkers=1','--no-file-parallelism','tasks/artifacts/player-cards-2026-10-24/slice-03-r1/interaction-controls.test.tsx'],
 'types': ['npx','--no-install','tsc','--noEmit','--project','../tasks/artifacts/player-cards-2026-10-24/slice-03-r1/tsconfig.json'],
 'lint': ['npx','--no-install','eslint','components/player-cards/InteractiveCard.tsx','components/player-cards/PlayerCardFlow.tsx','components/player-cards/PlayerCardFlow.test.tsx'],
 'render': ['node',str(artifact/'render-preview.mjs')],
 'browser': ['python3',str(artifact/'run-browser.py')],
 'banner': ['node',str(artifact/'banner-control.mjs')],
}
command = commands[action]
lock = Path('/private/tmp/fhfh-heavy.lock')
try: lock.mkdir()
except FileExistsError:
 print('BLOCKED: shared heavy lock already exists; not stolen')
 sys.exit(75)
token = str(uuid.uuid4())
owner = lock/'owner.json'
owner.write_text(json.dumps({'owner':'player-cardS03R1','pid':os.getpid(),'token':token,'action':action}))
try:
 env = os.environ.copy(); env.pop('GIT_DIR',None)
 overrides = {'npm_config_cache':str(artifact/'.npm-cache'),'npm_config_logs_dir':str(artifact/'.npm-logs'),'NO_UPDATE_NOTIFIER':'1','NEXT_TELEMETRY_DISABLED':'1'}
 env.update(overrides)
 start = time.monotonic()
 with (artifact/(action+'.log')).open('w') as output:
  result = subprocess.run(command,cwd=repo/'web',env=env,stdout=output,stderr=subprocess.STDOUT,timeout=60)
 receipt = {'action':action,'command':command,'cwd':str(repo/'web'),'exitCode':result.returncode,'elapsedSeconds':round(time.monotonic()-start,3),'environmentOverrides':overrides,'lockOwnedAndReleased':True}
 (artifact/(action+'-command.json')).write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt));sys.exit(result.returncode)
finally:
 if owner.exists() and json.loads(owner.read_text()).get('token')==token:
  owner.unlink();lock.rmdir()
