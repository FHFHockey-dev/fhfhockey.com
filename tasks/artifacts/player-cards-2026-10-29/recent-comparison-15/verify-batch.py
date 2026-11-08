from pathlib import Path
import subprocess,time,json,sys
p=Path(__file__).resolve().parent
commands={
'focused-domain':['npm','test','--','--run','--config',str(p/'vitest.config.mts'),'web/lib/player-cards/currentNhl.test.ts'],
'final-types':['npx','--no-install','tsc','--noEmit','--project',str(p/'tsconfig.json')],
'final-lint':['npx','--no-install','eslint','lib/player-cards/currentNhl.ts','lib/player-cards/currentNhl.test.ts','lib/player-cards/currentSelection.ts','lib/player-cards/currentSelection.test.ts','lib/player-cards/currentNhlExport.ts','components/player-cards/CurrentPlayerCard.tsx','components/player-cards/CurrentPlayerCardStudio.tsx','components/player-cards/CurrentPlayerCardStudio.test.tsx'],
'render':['node',str(p/'render-preview.mjs')]}
for name,cmd in commands.items():
 start=time.monotonic()
 with (p/(name+'.log')).open('w') as f:r=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,timeout=40)
 receipt={'command':cmd,'cwd':str(Path.cwd()),'exitCode':r.returncode,'elapsedSeconds':round(time.monotonic()-start,3),'sharedSlot':'parent run-check.py verify owns token'}
 (p/(name+'-command.json')).write_text(json.dumps(receipt,indent=2)+'\n')
 print(name,r.returncode,flush=True)
 if r.returncode:sys.exit(r.returncode)
