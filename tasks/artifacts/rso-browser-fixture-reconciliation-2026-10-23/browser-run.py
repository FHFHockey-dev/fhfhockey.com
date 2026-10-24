from pathlib import Path
import os,sys,json,subprocess,time,uuid,signal,urllib.request,shutil
root=Path(__file__).resolve().parent;web=root/'snapshot/web';repo=Path('/Users/tim/Code/fhfhockey.com');port=3139
for p in ['web/e2e/roster-schedule-optimizer.spec.ts','web/e2e/roster-schedule-optimizer-fixtures.ts']:shutil.copyfile(repo/p,root/'snapshot'/p)
(web/'e2e/acceptance').mkdir(exist_ok=True);shutil.copyfile(root/'harness-v2/rso-p07-acceptance.spec.ts',web/'e2e/acceptance/rso-p07-acceptance.spec.ts')
(web/'e2e/reconciliation.config.ts').write_text('''import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'roster-schedule-optimizer.spec.ts',timeout:60000,expect:{timeout:15000},workers:1,retries:0,use:{baseURL:'http://127.0.0.1:3139',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}]});
''')
(web/'e2e/acceptance/reconciliation.config.ts').write_text('''import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'rso-p07-acceptance.spec.ts',timeout:90000,expect:{timeout:20000},workers:1,retries:0,use:{baseURL:'http://127.0.0.1:3139',trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},{name:'mobile',use:{...devices['Pixel 5'],viewport:{width:375,height:812}}}]});
''')
lock=Path('/private/tmp/fhfh-heavy.lock');token=uuid.uuid4().hex
try:lock.mkdir()
except FileExistsError:print('BLOCKED shared heavy lock');raise SystemExit(75)
inode=lock.stat().st_ino;(lock/'owner.json').write_text(json.dumps({'owner':'RSO fixture reconciliation','thread':'01a168af-30c9-71b7-af0a-f25a9d90a02a','pid':os.getpid(),'token':token,'at':time.time()}))
env={'PATH':'/usr/local/bin:/usr/bin:/bin','TZ':'UTC','LANG':'en_US.UTF-8','NEXT_TELEMETRY_DISABLED':'1','PLAYWRIGHT_ISOLATED_NEXT':'1','NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:9','NEXT_PUBLIC_SUPABASE_PUBLIC_KEY':'fixture-public-key','CMS_URL':'http://127.0.0.1:9','NEXT_PUBLIC_SITE_URL':'http://127.0.0.1:3139','NEXT_PUBLIC_SANITY_PROJECT_ID':'fixture0','NEXT_PUBLIC_SANITY_DATASET':'fixture','NEXT_PUBLIC_SANITY_GRAPHQL_URI':'http://127.0.0.1:9','NEXT_PUBLIC_SERVERLESS_API_URL':'http://127.0.0.1:9','PUPPETEER_ENDPOINT':'ws://127.0.0.1:9','RSO_GOALIE_POLICY':'server-confirmed','PLAYWRIGHT_BROWSERS_PATH':'/Users/tim/Library/Caches/ms-playwright','npm_config_offline':'true'}
serverfile=root/'SERVER.json';server=None
try:
 if serverfile.exists():
  serverinfo=json.loads(serverfile.read_text());os.kill(serverinfo['pid'],0)
 else:
  log=(root/'next-dev.log').open('w');server=subprocess.Popen(['/usr/local/bin/node',str(web/'node_modules/next/dist/bin/next'),'dev','-H','127.0.0.1','-p',str(port)],cwd=web,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  serverinfo={'pid':server.pid,'cwd':str(web),'port':port,'argv':server.args};serverfile.write_text(json.dumps(serverinfo,indent=2)+'\n')
  for _ in range(60):
   if server.poll() is not None:raise RuntimeError('isolated Next exited; inspect next-dev.log')
   try:
    with urllib.request.urlopen('http://127.0.0.1:3139/roster-schedule-optimizer',timeout=3) as r:
     if r.status==200:break
   except Exception:time.sleep(1)
  else:raise RuntimeError('isolated Next did not become ready')
 label=sys.argv[1];kind=sys.argv[2];grep=sys.argv[3] if len(sys.argv)>3 else None
 config='e2e/acceptance/reconciliation.config.ts' if kind=='acceptance' else 'e2e/reconciliation.config.ts'
 out=root/label;out.mkdir(exist_ok=True)
 argv=['/usr/local/bin/node',str(web/'node_modules/@playwright/test/cli.js'),'test','--config',config,'--output',str(out/'results'),'--reporter=line,json']
 if grep:argv+=['--grep',grep]
 if len(sys.argv)>4:argv+=['--project',sys.argv[4]]
 env['PLAYWRIGHT_JSON_OUTPUT_FILE']=str(out/'results.json')
 (out/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(web),'environment':env,'server':serverinfo},indent=2)+'\n')
 print('Ready; running '+label,flush=True)
 with (out/'run.log').open('w') as log:result=subprocess.run(argv,cwd=web,env=env,stdout=log,stderr=subprocess.STDOUT)
 print('Browser exit '+str(result.returncode),flush=True);(out/'EXIT.json').write_text(json.dumps({'exit':result.returncode})+'\n')
finally:
 if lock.exists() and lock.stat().st_ino==inode and json.loads((lock/'owner.json').read_text()).get('token')==token:(lock/'owner.json').unlink();lock.rmdir()
