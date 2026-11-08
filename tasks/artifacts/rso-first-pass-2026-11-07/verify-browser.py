from pathlib import Path
import datetime,hashlib,json,os,signal,socket,subprocess,sys,uuid
label='browser-reviewed-v2' if '--reviewed-v2' in sys.argv else 'browser-clean-react' if '--fixed-react' in sys.argv else 'browser-private-deps' if '--private-deps' in sys.argv else 'browser-authorized' if '--authorized-local' in sys.argv else 'browser'
out=Path(__file__).resolve().parent;m=json.loads((out/'CANDIDATE.json').read_text());cwd=Path(m['exportRoot'])/'web';port=3164
for r in m['overlayFiles']:assert hashlib.sha256((cwd.parent/r['path']).read_bytes()).hexdigest()==r['sha256']
assert not list(cwd.glob('.env*'))
with socket.socket() as s:s.bind(('127.0.0.1',port))
config=cwd/'.rso-first-pass-playwright.config.ts'
config.write_text('''import base from "./playwright.config";
export default { ...base, webServer: {
 command: "npm run dev:stable -- -H 127.0.0.1 -p 3164",
 env: { PLAYWRIGHT_ISOLATED_NEXT: "1" },
 url: "http://127.0.0.1:3164/roster-schedule-optimizer",
 reuseExistingServer: false, timeout: 120000,
} };
''')
lock=Path('/private/tmp/fhfh-heavy.lock');token=str(uuid.uuid4())
try:lock.mkdir()
except FileExistsError:raise SystemExit('Heavy slot occupied; no browser/server started')
inode=lock.stat().st_ino;(lock/'owner.json').write_text(json.dumps({'owner':'Scout RSO exact-candidate browser check','token':token,'pid':os.getpid(),'port':port}))
env={'PATH':'/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin','HOME':os.environ['HOME'],'TMPDIR':os.environ.get('TMPDIR','/tmp'),'NODE_OPTIONS':'--require '+str(out/'loopback-only.cjs'),'NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:9','NEXT_PUBLIC_SUPABASE_PUBLIC_KEY':'synthetic-public-key','SUPABASE_SERVICE_ROLE_KEY':'synthetic-service-role-key','CMS_URL':'http://127.0.0.1:3164','NEXT_TELEMETRY_DISABLED':'1','PLAYWRIGHT_PORT':str(port),'PLAYWRIGHT_ISOLATED_NEXT':'1','PLAYWRIGHT_HTML_OPEN':'never','TZ':'UTC'}
cmd=['node','node_modules/@playwright/test/cli.js','test','--config',str(config),'e2e/roster-schedule-optimizer.spec.ts','e2e/rso-acceptance.spec.ts','e2e/rso-continuity.spec.ts','--workers=1','--retries=0','--max-failures=1','--reporter=line','--output',str(out/(label+'-output'))]
start=datetime.datetime.now(datetime.timezone.utc).isoformat();proc=None;timed=False
try:
 with (out/(label+'.log')).open('w') as log:
  proc=subprocess.Popen(cmd,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  try:code=proc.wait(timeout=720)
  except subprocess.TimeoutExpired:timed=True;os.killpg(proc.pid,signal.SIGTERM);code=proc.wait(timeout=20)
 (out/(label+'.json')).write_text(json.dumps({'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':code,'timedOut':timed,'command':cmd,'candidateTree':m['candidateTree'],'environment':'inert values, no .env files; node loopback guard and browser fixture interception','log':label+'.log'},indent=2)+'\n')
 print((out/(label+'.log')).read_text()[-9000:]);print('EXIT',code)
finally:
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM)
  except ProcessLookupError:pass
 # dev:stable may leave Next in its own process group; stop only a listener whose cwd is this export.
 listeners=subprocess.run(['/usr/sbin/lsof','-t','-nP',f'-iTCP:{port}','-sTCP:LISTEN'],capture_output=True,text=True)
 for value in listeners.stdout.split():
  detail=subprocess.run(['/usr/sbin/lsof','-a','-p',value,'-d','cwd','-Fn'],capture_output=True,text=True)
  names=[line[1:] for line in detail.stdout.splitlines() if line.startswith('n')]
  if len(names)==1 and Path(names[0]).resolve()==cwd.resolve():
   try:os.kill(int(value),signal.SIGTERM)
   except ProcessLookupError:pass
 if lock.exists() and lock.stat().st_ino==inode and json.loads((lock/'owner.json').read_text())['token']==token:
  (lock/'owner.json').unlink();lock.rmdir()
