from pathlib import Path
import subprocess,time,json,sys
p=Path(__file__).resolve().parent
commands={
 'tests':['npm','test','--','--run','--config',str(p/'vitest.config.mts'),'web/lib/player-cards/researchFixtures.server.test.ts'],
 'types':['npx','--no-install','tsc','--noEmit','--project',str(p/'tsconfig.json')],
 'lint': ['npx', '--no-install', 'eslint', 'lib/player-cards/researchSnapshot.types.ts', 'lib/player-cards/researchSnapshot.ts', 'lib/player-cards/researchSnapshot.test.ts', 'lib/player-cards/researchFixtures.server.ts', 'lib/player-cards/researchFixtures.server.test.ts', 'lib/player-cards/researchExamples.ts', 'lib/player-cards/researchExport.ts', 'components/player-cards/ResearchCardEvidence.tsx', 'components/player-cards/ResearchPlayerCard.tsx', 'components/player-cards/ResearchPlayerCardStudio.tsx', 'components/player-cards/ResearchPlayerCardStudio.test.tsx', 'pages/api/v1/player-cards/research.ts', 'lib/player-cards/currentNhl.ts', 'lib/player-cards/currentNhlExport.ts', 'components/player-cards/CurrentPlayerCardStudio.tsx', 'components/player-cards/CurrentPlayerCardStudio.test.tsx', 'pages/social-share/player-cards.tsx'],
 'render':['node',str(p/'render-preview.mjs')],
 'browser':['node',str(p/'browser-check.mjs')],
}
for action,command in commands.items():
 start=time.monotonic()
 with (p/(action+'.log')).open('w') as output:result=subprocess.run(command,stdout=output,stderr=subprocess.STDOUT,timeout=25)
 (p/(action+'-command.json')).write_text(json.dumps({'action':action,'command':command,'exitCode':result.returncode,'elapsedSeconds':round(time.monotonic()-start,3),'heldBy':'research10 sequential owner slot'},indent=2)+'\n')
 print(action+':'+str(result.returncode),flush=True)
 if result.returncode:sys.exit(result.returncode)
