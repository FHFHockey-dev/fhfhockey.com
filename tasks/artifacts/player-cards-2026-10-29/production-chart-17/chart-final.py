from pathlib import Path
import subprocess
p=Path(__file__).resolve().parent
for command in [['npm','test','--','--run','--config',str(p/'vitest.config.mts'),'web/components/player-cards/CurrentPlayerCardStudio.test.tsx'],['node',str(p/'render-preview.mjs')]]:
 subprocess.run(command,check=True,timeout=30)
