"""Isolated synthetic verification; no environment files, credentials or provider access."""
import hashlib,json,os,shutil,subprocess,sys,tempfile,time
from pathlib import Path
art=Path(__file__).resolve().parent
root=art.parents[2]
mode=sys.argv[1]
saved=art/'snapshot-path.txt'
if mode=='prepare':
 snapshot=Path(tempfile.mkdtemp(prefix='forge-v2-concurrency-'))
 source=json.loads((root/'tasks/artifacts/forge-v2-independent-test-2026-10-30/source-pins.json').read_text())['pins']
 for entry in source:
  path=entry['path']; target=snapshot/path; target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(root/path,target)
 (snapshot/'web/node_modules').symlink_to(root/'web/node_modules',target_is_directory=True)
 (snapshot/'web/vitest.config.ts').write_text('import {defineConfig} from "vitest/config"; import react from "@vitejs/plugin-react"; export default defineConfig({envDir:false,plugins:[react()],test:{environment:"jsdom",setupFiles:["./__tests__/vitest.setup.js"],include:["lib/forge-v2/**/*.test.ts","components/ForgeV2/**/*.test.tsx"],maxWorkers:1,minWorkers:1}});\n')
 saved.write_text(str(snapshot)+'\n');print(snapshot);raise SystemExit(0)
snapshot=Path(saved.read_text().strip())
commands={
 'unit':['node','node_modules/vitest/vitest.mjs','run','lib/forge-v2/preparation.test.ts','lib/forge-v2/pipeline.test.ts','lib/forge-v2/api.test.ts','--reporter=verbose'],
 'native':['node','node_modules/vitest/vitest.mjs','run','lib/forge-v2/history.test.ts','--reporter=verbose'],
 'types':[str(root/'web/node_modules/.bin/tsc'),'--noEmit','--project',str(art/'tsconfig.json')],
 'lint':[str(root/'web/node_modules/.bin/eslint'),'lib/forge-v2/history.server.ts','lib/forge-v2/history.test.ts','lib/forge-v2/preparation.server.ts','lib/forge-v2/preparation.test.ts','lib/forge-v2/fixtureHarness.server.ts']}
if mode=='types':
 (art/'tsconfig.json').write_text(json.dumps({'extends':str(root/'web/tsconfig.json'),'compilerOptions':{'incremental':False},'include':[str(root/'web/next-bootstrap.d.ts'),str(root/'web/lib/forge-v2/**/*.ts')],'exclude':[str(root/'web/node_modules')]}))
lock=Path('/private/tmp/fhfh-heavy.lock');lock.mkdir()
owner=lock/'forge-concurrency.json';owner.write_text(json.dumps({'pid':os.getpid(),'mode':mode}))
env={'PYTHONDONTWRITEBYTECODE':'1','LC_ALL':'C','LANG':'C','PATH':'/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin','HOME':str(snapshot),'TMPDIR':'/tmp','NODE_ENV':'test','NEXT_TELEMETRY_DISABLED':'1','FORGE_V2_POSTGRES_BIN':'/opt/homebrew/opt/postgresql@17/bin'}
started=time.time();code=1;log=art/(mode+'.txt')
try:
 with log.open('w') as out:
  code=subprocess.run(commands[mode],cwd=root/'web' if mode in ['types','lint'] else snapshot/'web',env=env,stdout=out,stderr=subprocess.STDOUT,timeout=120).returncode
finally:
 (art/(mode+'-receipt.json')).write_text(json.dumps({'check':mode,'command':commands[mode],'exit':code,'durationSeconds':time.time()-started,'log':log.name,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest(),'syntheticOnly':True,'remoteActions':0},indent=2)+'\n')
 owner.unlink();lock.rmdir()
print(log.read_text()[-10000:]);raise SystemExit(code)
