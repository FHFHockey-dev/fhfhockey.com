from pathlib import Path
import json,hashlib,subprocess,tempfile,shutil,os,uuid
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent
S=Path(tempfile.mkdtemp(prefix='fhfh-billing-sales-',dir='/tmp'))/'snapshot';W=S/'web'
lease=json.loads((O/'LEASE.json').read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
owned={n:sha(R/n) for n in [*lease['before'],*lease['new']]}
names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z','--','web'],cwd=R,text=True).split('\0')
allowed={'.ts','.tsx','.js','.jsx','.mjs','.cjs','.mts','.json','.scss','.css','.html','.svg'}
for n in sorted(set(names)):
 p=R/n
 if not n or not p.is_file() or p.suffix not in allowed or any(x in {'.git','node_modules','dist'} or x.startswith('.next') for x in p.parts) or p.name.startswith('.env') or p.name in {'credentials.json','secrets.json'}:continue
 target=S/n;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
assert all(sha(S/n)==h and sha(R/n)==h for n,h in owned.items())
queue=R/'tasks/artifacts/claude-audit-fix-queue-2026-10-22/repros'
shutil.copyfile(queue/'offline.cjs',W/'audit-network-deny.cjs');shutil.copyfile(queue/'audit.offline.setup.ts',W/'audit.offline.setup.ts')
(W/'audit.vitest.config.mts').write_text('import { defineConfig } from "vitest/config"; import react from "@vitejs/plugin-react"; import tsconfigPaths from "vite-tsconfig-paths"; export default defineConfig({envDir:false,plugins:[tsconfigPaths(),react()],cacheDir:'+json.dumps(str(S/'vite-cache'))+',test:{environment:"jsdom",setupFiles:["./__tests__/vitest.setup.js","./audit.offline.setup.ts"],pool:"threads",maxWorkers:1,minWorkers:1,exclude:["**/node_modules/**","**/e2e/**","**/.next/**"]}});\n')
(W/'node_modules').symlink_to(R/'web/node_modules',target_is_directory=True)
for n in ['home','tmp']:(S/n).mkdir()
env=dict(PATH='/usr/local/bin:/usr/bin:/bin',HOME=str(S/'home'),TMPDIR=str(S/'tmp'),TZ='UTC',NEXT_PUBLIC_SUPABASE_URL='https://unit-tests.supabase.invalid',NEXT_PUBLIC_SUPABASE_PUBLIC_KEY='synthetic-public-key',SUPABASE_SERVICE_ROLE_KEY='synthetic-service-role-key',NODE_OPTIONS='--require '+str(W/'audit-network-deny.cjs'),npm_config_offline='true',npm_config_audit='false',npm_config_fund='false')
assert subprocess.check_output(['node','--version'],env=env,text=True).strip()=='v22.11.0'
tests=['components/account/DraftProPanel.test.tsx','components/account/InSeasonPanel.test.tsx','lib/draft-pro/features.test.ts','lib/draft-pro/account/index.test.ts','lib/draft-pro/api-tests/checkout.test.ts','lib/integrations/providerSyncAccess.test.ts','lib/integrations/providerSyncPaywall.test.ts','lib/integrations/providerSyncRolloutRoutes.test.ts','hooks/useDraftProAccess.test.tsx','lib/in-season/billingRoutes.test.ts','lib/integrations/yahoo/pickupApi.test.ts','lib/integrations/yahoo/liveDraftAccess.test.ts','lib/integrations/fantrax/liveDraftServer.test.ts','__tests__/components/DraftDashboard/DraftSettingsShell.test.tsx','__tests__/components/DraftDashboard/SuggestedPicks.test.tsx','__tests__/components/DraftDashboard/GodView.test.tsx','lib/draft-pro/access.test.ts','lib/integrations/stripe/fulfillment.test.ts','lib/draft-pro/api-tests/checkout-verify.test.ts']
missing=[n for n in tests if not (W/n).is_file()];assert not missing,missing
cmd=['npm','test','--','--run','--config','audit.vitest.config.mts',*tests,'--reporter=json','--outputFile='+str(O/'tests.json')]
(O/'SNAPSHOT.json').write_text(json.dumps(dict(snapshot=str(S),owned=owned),indent=2)+'\n');(O/'COMMAND.json').write_text(json.dumps(dict(cwd=str(W),environment=env,argv=cmd),indent=2)+'\n')
L=Path('/private/tmp/fhfh-heavy.lock');token=str(uuid.uuid4())
try:L.mkdir()
except FileExistsError:raise SystemExit('HEAVY_LOCK_OCCUPIED; checks not started')
(L/'owner.json').write_text(json.dumps(dict(pid=os.getpid(),token=token,scope='billing sales rollout focused tests')))
try:
 print('snapshot ready; '+str(len(tests))+' focused files',flush=True)
 with (O/'tests.log').open('w') as f:p=subprocess.run(cmd,cwd=W,env=env,stdout=f,stderr=subprocess.STDOUT)
 (O/'RESULT.json').write_text(json.dumps(dict(exit_code=p.returncode,source_drift=[n for n,h in owned.items() if sha(R/n)!=h]),indent=2)+'\n');print('test exit '+str(p.returncode),flush=True)
finally:
 if L.is_dir() and json.loads((L/'owner.json').read_text())['token']==token:(L/'owner.json').unlink();L.rmdir()
