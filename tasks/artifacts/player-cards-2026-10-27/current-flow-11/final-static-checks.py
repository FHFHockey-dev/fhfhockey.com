from pathlib import Path
import subprocess,time,json,sys
p=Path(__file__).resolve().parent
commands={'types':['npx','--no-install','tsc','--noEmit','--project',str(p/'tsconfig.json')],'lint':['npx','--no-install','eslint','lib/player-cards/currentNhl.ts','lib/player-cards/currentNhl.test.ts','lib/player-cards/currentNhl.server.ts','lib/player-cards/currentNhl.server.test.ts','lib/player-cards/currentSelection.ts','lib/player-cards/currentSelection.test.ts','lib/player-cards/currentNhlExport.ts','components/player-cards/CurrentPlayerCard.tsx','components/player-cards/CurrentPlayerCardStudio.tsx','components/player-cards/CurrentPlayerCardStudio.test.tsx','pages/player-cards.tsx']}
for action,command in commands.items():
 start=time.monotonic()
 with (p/(action+'.log')).open('w') as output:r=subprocess.run(command,stdout=output,stderr=subprocess.STDOUT,timeout=15)
 (p/(action+'-command.json')).write_text(json.dumps({'action':action,'command':command,'exitCode':r.returncode,'elapsedSeconds':round(time.monotonic()-start,3),'heldBy':'final-static shared slot after actual touch-target fix'},indent=2)+'\n')
 if r.returncode:sys.exit(r.returncode)
