from pathlib import Path
import os,json,subprocess,datetime
repo=Path(__file__).resolve().parents[3]; own=Path(__file__).resolve().parent
lock=Path("/private/tmp/fhfh-heavy.lock"); owner="player-cards-independent-audit-20261101"
lock.mkdir(); (lock/"owner.json").write_text(json.dumps({"owner":owner,"pid":os.getpid(),"task":"Focused offline card audit"}))
try:
 env=os.environ.copy(); env["NODE_OPTIONS"]="--require="+str(repo/"tasks/artifacts/blsh-visual-january-audit-2026-11-01/deny-network.cjs")
 cmd=["/usr/local/bin/node","node_modules/vitest/vitest.mjs","run","--config",str(own/"audit.vitest.config.mts"),"lib/player-cards/sharedGoalieOutlook.test.ts"]
 r=subprocess.run(cmd,cwd=repo/"web",env=env,capture_output=True,text=True,timeout=90)
 (own/"goalie-tests.log").write_text(r.stdout+r.stderr)
 (own/"goalie-tests.json").write_text(json.dumps({"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"command":cmd,"exitCode":r.returncode,"networkDenied":True},indent=2)+"\n")
 print(r.stdout[-4500:]); print(r.stderr[-1500:]); print("Exit",r.returncode)
finally:
 if json.loads((lock/"owner.json").read_text())["owner"]==owner:lock.rename(own/"goalie-test-lock-released")
