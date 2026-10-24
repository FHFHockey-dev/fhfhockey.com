from pathlib import Path
import json,hashlib,subprocess,tempfile,shutil,datetime
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent
S=Path(tempfile.mkdtemp(prefix='fhfh-release-current-',dir='/tmp'))/'isolation/snapshot';W=S/'web'
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip()
names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z','--','web'],cwd=R,text=True).split('\0')
allowed={'.ts','.tsx','.js','.jsx','.mjs','.cjs','.mts','.json','.scss','.css','.html','.svg'}
names=sorted({n for n in names if n and Path(n).suffix in allowed and not any(x in {'.git','node_modules','.next','dist'} or x.startswith('.next-') for x in Path(n).parts) and not Path(n).name.startswith('.env') and Path(n).name not in {'credentials.json','secrets.json'}})
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
pins={}
for n in names:
 p=R/n
 if not p.is_file():continue
 pins[n]=sha(p);target=S/n;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
changed=[n for n,h in pins.items() if sha(R/n)!=h]
assert not changed,changed
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip()==head
(O/'CURRENT-SNAPSHOT.json').write_text(json.dumps(dict(head=head,snapshot=str(S),files=pins),indent=2)+'\n')
queue=R/'tasks/artifacts/claude-audit-fix-queue-2026-10-22/repros'
shutil.copyfile(queue/'offline.cjs',W/'audit-network-deny.cjs');shutil.copyfile(queue/'audit.offline.setup.ts',W/'audit.offline.setup.ts')
(W/'audit.vitest.config.mts').write_text('import { defineConfig } from "vitest/config"; import react from "@vitejs/plugin-react"; import tsconfigPaths from "vite-tsconfig-paths"; export default defineConfig({envDir:false,plugins:[tsconfigPaths(),react()],cacheDir:'+json.dumps(str(S/'vite-cache'))+',test:{environment:"jsdom",setupFiles:["./__tests__/vitest.setup.js","./audit.offline.setup.ts"],pool:"threads",maxWorkers:1,minWorkers:1,exclude:["**/node_modules/**","**/e2e/**","**/.next/**"]}});\n')
(W/'node_modules').symlink_to(R/'web/node_modules',target_is_directory=True)
for n in ['.audit-home','.audit-tmp']:(W/n).mkdir()
tests=['lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts','lib/rosterScheduleData/forgeDailyBridge.test.ts','lib/projections/goalie/leagueSavePct.test.ts','lib/projections/runProjectionV2.test.ts','lib/player-forecasts/rsoUsePolicy.test.ts','lib/rosterScheduleOptimizer/executionAdapter.test.ts','lib/rosterScheduleOptimizer/providerGoalieStarts.test.ts','lib/integrations/yahoo/rosterPlanning.test.ts']
env=dict(PATH='/usr/local/bin:/usr/bin:/bin',HOME=str(W/'.audit-home'),TMPDIR=str(W/'.audit-tmp'),NEXT_PUBLIC_SUPABASE_URL='https://unit-tests.supabase.invalid',NEXT_PUBLIC_SUPABASE_PUBLIC_KEY='synthetic-public-key',SUPABASE_SERVICE_ROLE_KEY='synthetic-service-role-key',NODE_OPTIONS='--require '+str(W/'audit-network-deny.cjs'),npm_config_offline='true',npm_config_audit='false',npm_config_fund='false')
assert subprocess.check_output(['node','--version'],env=env,text=True).strip()=='v22.11.0'
cmd=['npm','test','--','--run','--config','audit.vitest.config.mts',*tests,'--reporter=json','--outputFile='+str(O/'current-boundary-tests.json')]
(O/'CURRENT-COMMAND.json').write_text(json.dumps(dict(cwd=str(W),environment=env,argv=cmd),indent=2)+'\n')
print(json.dumps(dict(head=head,snapshot=str(S),files=len(pins),test_files=len(tests))),flush=True)
with (O/'current-boundary-tests.log').open('w') as f:r=subprocess.run(cmd,cwd=W,env=env,stdout=f,stderr=subprocess.STDOUT)
(O/'CURRENT-RESULT.json').write_text(json.dumps(dict(exit_code=r.returncode,finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),snapshot_drift=[n for n,h in pins.items() if sha(S/n)!=h]),indent=2)+'\n')
print('current boundary tests exit '+str(r.returncode),flush=True)
