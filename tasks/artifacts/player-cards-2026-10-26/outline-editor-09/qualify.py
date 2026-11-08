from pathlib import Path
import subprocess,time,json,sys
p=Path(__file__).resolve().parent
commands={
 'tests':['npm','test','--','--run','--config',str(p/'vitest.config.mts')],
 'types':['npx','--no-install','tsc','--noEmit','--project',str(p/'tsconfig.json')],
 'lint':['npx','--no-install','eslint','lib/player-cards/outlineStack.ts','lib/player-cards/outlineStack.test.ts','components/player-cards/OutlineStackControls.tsx','components/player-cards/OutlineStackControls.test.tsx','lib/player-cards/shareExport.ts','lib/player-cards/alphaOutline.ts','lib/player-cards/alphaOutline.test.ts','lib/player-cards/portraitTreatment.ts','components/player-cards/HeroPlayerCard.tsx','components/player-cards/PlayerCardShareStudio.tsx','components/player-cards/PlayerCardShareStudio.test.tsx','lib/player-cards/shareExport.test.ts'],
 'render':['node',str(p/'render-preview.mjs')],
 'browser':['node',str(p/'browser-check.mjs')],
 'actual-render':['node',str(p.parent/'current-data-01'/'approved-snapshot-02'/'render-preview.mjs')],
 'actual-browser':['node',str(p.parent/'current-data-01'/'approved-snapshot-02'/'browser-check.mjs')]
}
if "--remaining" in sys.argv: commands.pop("tests")
for action,command in commands.items():
 start=time.monotonic()
 with (p/(action+'.log')).open('w') as output:
  result=subprocess.run(command,stdout=output,stderr=subprocess.STDOUT,timeout=25)
 (p/(action+'-command.json')).write_text(json.dumps({'action':action,'command':command,'exitCode':result.returncode,'elapsedSeconds':round(time.monotonic()-start,3),'heldBy':'editor09 qualify parent resource slot'},indent=2)+'\n')
 print(action+':'+str(result.returncode),flush=True)
 if result.returncode: sys.exit(result.returncode)
