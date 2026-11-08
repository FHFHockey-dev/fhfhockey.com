from pathlib import Path
import subprocess,time,json,sys
p=Path(__file__).resolve().parent
commands={
 'types':['npx','--no-install','tsc','--noEmit','--project',str(p/'tsconfig.json')],
 'lint':['npx','--no-install','eslint','lib/player-cards/alphaOutline.ts','lib/player-cards/alphaOutline.test.ts','lib/player-cards/portraitTreatment.ts','components/player-cards/HeroPlayerCard.tsx','components/player-cards/PlayerCardShareStudio.tsx','components/player-cards/PlayerCardShareStudio.test.tsx','lib/player-cards/shareExport.test.ts'],
 'render':['node',str(p/'render-preview.mjs')]
}
for action,command in commands.items():
 start=time.monotonic()
 with (p/(action+'.log')).open('w') as output:
  result=subprocess.run(command,stdout=output,stderr=subprocess.STDOUT,timeout=20)
 (p/(action+'-command.json')).write_text(json.dumps({'action':action,'command':command,'exitCode':result.returncode,'elapsedSeconds':round(time.monotonic()-start,3),'heldBy':'qualify parent resource slot'},indent=2)+'\n')
 if result.returncode: sys.exit(result.returncode)
print('Scoped types/lint/render passed sequentially in one resource slot')
