import os,json,subprocess,time,sys
from pathlib import Path
art=Path(__file__).resolve().parent
snapshot=Path((art/'snapshot-path.txt').read_text().strip())
mode=sys.argv[1]
checkcwd=snapshot/'web'
commands={
 'native':['node','node_modules/vitest/vitest.mjs','run','lib/forge-v2/history.test.ts','--reporter=verbose'],
 'intake':['python3','-m','unittest','-v','test_intake_check.py'],
 'chronology-build':[str(snapshot/'web/node_modules/.bin/esbuild'),'../tasks/artifacts/forge-v2-remediation-2026-10-30/chronology-check.ts','--bundle','--platform=node','--format=cjs','--outfile='+str(snapshot/'chronology.cjs')],
 'chronology':['node',str(snapshot/'chronology.cjs')],
 'suite':['node','node_modules/vitest/vitest.mjs','run','--reporter=verbose'],
 'browser':['node','node_modules/@playwright/test/cli.js','test','e2e/forge-v2.spec.ts','--project=chromium','--workers=1','--output='+str(art/'browser-results')],
 'outside':['node','node_modules/vitest/vitest.mjs','run','outside-','--reporter=verbose'],
 'native-race':['node','node_modules/vitest/vitest.mjs','run','independent-native-race.test.ts','-t','independent:','--reporter=verbose'],
 'concurrency':['node','node_modules/vitest/vitest.mjs','run','independent-concurrency.test.ts','--reporter=verbose'],
 'adverse':['node','node_modules/vitest/vitest.mjs','run','independent-','--reporter=verbose'],
}
if mode=='intake':checkcwd=snapshot/'tasks/artifacts/forge-v2-remediation-2026-10-30'
lock=Path('/private/tmp/fhfh-heavy.lock');lock.mkdir()
(lock/'independent-owner.json').write_text(json.dumps({'pid':os.getpid(),'task':'FORGE independent testing','check':mode}))
env={'PYTHONDONTWRITEBYTECODE':'1','LC_ALL':'C','LANG':'C','PATH':'/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin','HOME':str(snapshot),'TMPDIR':'/tmp','NODE_ENV':'test','NEXT_TELEMETRY_DISABLED':'1','FORGE_V2_POSTGRES_BIN':'/opt/homebrew/opt/postgresql@17/bin','PLAYWRIGHT_SKIP_WEB_SERVER':'1','PLAYWRIGHT_BROWSERS_PATH':'/Users/tim/Library/Caches/ms-playwright'}
start=time.time()
try:
 with (art/(mode+'.log')).open('w') as log:
  p=subprocess.run(commands[mode],cwd=checkcwd,env=env,stdout=log,stderr=subprocess.STDOUT)
 receipt={'check':mode,'command':commands[mode],'cwd':str(checkcwd),'exit':p.returncode,'durationSeconds':time.time()-start,'environment':'allowlisted; no inherited credentials; no env files copied','log':mode+'.log'}
 (art/(mode+'-receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n')
 print((art/(mode+'.log')).read_text()[-9000:]);print(json.dumps(receipt))
finally:
 (lock/'independent-owner.json').unlink();lock.rmdir()

raise SystemExit(p.returncode)
