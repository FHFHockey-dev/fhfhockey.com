from pathlib import Path
import subprocess,time,json,sys
p=Path(__file__).resolve().parent
commands={
'local-transport':['node','--test',str(p/'live-source.test.mjs')],
'unit':['npm','test','--','--run','--config',str(p/'vitest.config.mts')],
'final-types':['npx','--no-install','tsc','--noEmit','--project',str(p/'tsconfig.json')],
'final-lint':['npx','--no-install','eslint','components/player-cards/CurrentPlayerCardStudio.tsx','components/player-cards/CurrentPlayerCardStudio.test.tsx'],
'render':['node',str(p/'render-preview.mjs')]}
for name,cmd in commands.items():
 start=time.monotonic()
 with (p/(name+'.log')).open('w') as f:r=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,timeout=30)
 (p/(name+'-command.json')).write_text(json.dumps({'command':cmd,'exitCode':r.returncode,'elapsedSeconds':round(time.monotonic()-start,3),'sharedSlot':'parent verify token'},indent=2)+'\n');print(name,r.returncode,flush=True)
 if r.returncode:sys.exit(r.returncode)
