from pathlib import Path
import subprocess,os,json
repo=Path.cwd();out=repo/'tasks/artifacts/player-cards-candidate-audit-2026-11-01/fix-rereview';lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'independent-player-card-fix-rereview','pid':os.getpid()}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
try:
 env=os.environ.copy();env['NODE_OPTIONS']='--require='+str(repo/'tasks/artifacts/blsh-visual-january-audit-2026-11-01/deny-network.cjs')
 cmd=['/usr/local/bin/node','node_modules/vitest/vitest.mjs','run','--config',str(out.parent/'audit.vitest.config.mts'),'components/player-cards/PlayerAnalysisStudio.test.tsx','lib/player-cards/sharedGoalieOutlook.test.ts']
 r=subprocess.run(cmd,cwd=repo/'web',env=env,capture_output=True,text=True,timeout=60);(out/'tests.log').write_text(r.stdout+r.stderr);(out/'tests.json').write_text(json.dumps({'command':cmd,'exitCode':r.returncode,'networkDenied':True},indent=2)+'\n');print(r.stdout);assert r.returncode==0,r.stderr
finally:
 assert json.loads((lock/'owner.json').read_text())==owner;lock.rename(out/'test-lock-released')
