from pathlib import Path
import datetime, json, os, subprocess, sys
root=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent
lock=Path("/private/tmp/fhfh-heavy.lock")
if "GIT_DIR" in os.environ: raise SystemExit("Refusing tests with inherited GIT_DIR")
try: lock.mkdir()
except FileExistsError: raise SystemExit("Pending: existing heavy-check lock, no check started")
owner={"owner":"goalie-workload-forge-2026-10-25", "pid":os.getpid(), "at":datetime.datetime.now(datetime.timezone.utc).isoformat()}
(lock/"owner.json").write_text(json.dumps(owner))
env=os.environ.copy()
env.update({"NODE_OPTIONS":f"--require {out}/offline.cjs", "NEXT_PUBLIC_SUPABASE_URL":"https://unit-tests.supabase.invalid", "NEXT_PUBLIC_SUPABASE_PUBLIC_KEY":"synthetic-public-key", "SUPABASE_SERVICE_ROLE_KEY":"synthetic-service-role-key", "NEXT_TELEMETRY_DISABLED":"1"})
try:
 mode=sys.argv[1]
 changed=["components/GoalieShareChart/index.tsx","components/GoalieShareChart/GoalieShareChart.test.ts","components/GoalieShareChart/GoalieShareChart.pagination.test.tsx","lib/goalieWorkload.ts","lib/projections/goalie/workloadEvidence.ts","lib/projections/goalie/workloadEvidence.test.ts"]
 if mode=="focused": commands=[["node","node_modules/vitest/vitest.mjs","run","--config",str(out/"vitest.config.mts"),changed[1],changed[2],changed[5]]]
 elif mode=="controls": commands=[["node","node_modules/vitest/vitest.mjs","run","--config",str(out/"vitest.config.mts"),"lib/player-forecasts/rollingWindowParticipation.test.ts","lib/projections/goaliePipeline.test.ts","lib/rosterScheduleData/forgeDailyBridge.test.ts","__tests__/pages/api/v1/start-chart.test.ts"]]
 elif mode=="static": commands=[["node","node_modules/typescript/bin/tsc","--noEmit","-p",str(out/"tsconfig.json")],["node","node_modules/eslint/bin/eslint.js",*changed]]
 else: raise ValueError(mode)
 results=[]
 for index,command in enumerate(commands):
  log=out/f"{mode}-{index+1}.log"
  with log.open("w") as stream:
   result=subprocess.run(command,cwd=root/"web",env=env,stdout=stream,stderr=subprocess.STDOUT)
  results.append({"command":command,"cwd":str(root/"web"),"exitCode":result.returncode,"log":str(log.relative_to(root))})
  print(log.read_text()[-6500:])
 (out/f"{mode}-results.json").write_text(json.dumps(results,indent=2)+"\n")
finally:
 if json.loads((lock/"owner.json").read_text())==owner:
  (lock/"owner.json").unlink(); lock.rmdir()
