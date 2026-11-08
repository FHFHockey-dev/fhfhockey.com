"""Isolated synthetic verification; no environment files, credentials or provider access."""
import hashlib,json,os,shutil,subprocess,sys,tempfile,time
from pathlib import Path
art=Path(__file__).resolve().parent
root=art.parents[2]
mode=sys.argv[1]
saved=art/'snapshot-path.txt'
snapshot=Path(saved.read_text().strip())
commands={'independent':['node','node_modules/vitest/vitest.mjs','run','lib/forge-v2/independent-concurrency.test.ts','--reporter=verbose']}
shutil.copyfile(art/'independent-concurrency.test.ts',snapshot/'web/lib/forge-v2/independent-concurrency.test.ts')
lock=Path('/private/tmp/fhfh-heavy.lock');lock.mkdir()
owner=lock/'independent-review.json';owner.write_text(json.dumps({'pid':os.getpid(),'mode':mode}))
env={'PYTHONDONTWRITEBYTECODE':'1','LC_ALL':'C','LANG':'C','PATH':'/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin','HOME':str(snapshot),'TMPDIR':'/tmp','NODE_ENV':'test','NEXT_TELEMETRY_DISABLED':'1','FORGE_V2_POSTGRES_BIN':'/opt/homebrew/opt/postgresql@17/bin'}
started=time.time();code=1;log=art/(mode+'.txt')
try:
 with log.open('w') as out:
  code=subprocess.run(commands[mode],cwd=root/'web' if mode in ['types','lint'] else snapshot/'web',env=env,stdout=out,stderr=subprocess.STDOUT,timeout=120).returncode
finally:
 (art/(mode+'-receipt.json')).write_text(json.dumps({'check':mode,'command':commands[mode],'exit':code,'durationSeconds':time.time()-started,'log':log.name,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest(),'syntheticOnly':True,'remoteActions':0},indent=2)+'\n')
 owner.unlink();lock.rmdir()
print(log.read_text()[-10000:]);raise SystemExit(code)
