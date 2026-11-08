from pathlib import Path
import datetime,hashlib,json,os,signal,socket,subprocess,time,urllib.error,urllib.request,uuid
out=Path(__file__).resolve().parent
m=json.loads((out/'CANDIDATE.json').read_text());cwd=(Path(m['exportRoot'])/'web').resolve();port=3164
for r in m['overlayFiles']:assert hashlib.sha256((cwd.parent/r['path']).read_bytes()).hexdigest()==r['sha256']
assert not list(cwd.glob('.env*'))
with socket.socket() as s:s.bind(('127.0.0.1',port))
lock=Path('/private/tmp/fhfh-heavy.lock');token=str(uuid.uuid4())
try:lock.mkdir()
except FileExistsError:raise SystemExit('Heavy slot occupied; no server started')
inode=lock.stat().st_ino;(lock/'owner.json').write_text(json.dumps({'owner':'Scout RSO single-request SSR diagnostic','token':token,'pid':os.getpid(),'port':port}))
env={'PATH':'/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin','HOME':os.environ['HOME'],'TMPDIR':os.environ.get('TMPDIR','/tmp'),'NODE_OPTIONS':'--require '+str(out/'ssr-diagnostic.cjs'),'NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:9','NEXT_PUBLIC_SUPABASE_PUBLIC_KEY':'synthetic-public-key','SUPABASE_SERVICE_ROLE_KEY':'synthetic-service-role-key','CMS_URL':'http://127.0.0.1:3164','NEXT_TELEMETRY_DISABLED':'1','PLAYWRIGHT_ISOLATED_NEXT':'1','TZ':'UTC'}
log=out/'ssr-diagnostic.log';receipt={'candidateTree':m['candidateTree'],'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'requestBudget':1,'path':'/roster-schedule-optimizer'};proc=None
try:
 with log.open('w') as f:
  proc=subprocess.Popen(['node','node_modules/next/dist/bin/next','dev','-H','127.0.0.1','-p',str(port)],cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
  for _ in range(100):
   if 'Ready in' in log.read_text():break
   if proc.poll() is not None:raise RuntimeError('server exited before ready')
   time.sleep(.2)
  else:raise RuntimeError('server did not become ready in 20 seconds')
  try:
   with urllib.request.urlopen(f'http://127.0.0.1:{port}/roster-schedule-optimizer',timeout=90) as response:receipt['httpStatus']=response.status;receipt['responseBytes']=len(response.read())
  except urllib.error.HTTPError as e:receipt['httpStatus']=e.code;receipt['responseBytes']=len(e.read())
  time.sleep(.2)
except Exception as e:receipt['exception']=str(e)
finally:
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM);proc.wait(timeout=15)
  except ProcessLookupError:pass
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
 listeners=subprocess.run(['/usr/sbin/lsof','-t','-nP',f'-iTCP:{port}','-sTCP:LISTEN'],capture_output=True,text=True)
 for value in listeners.stdout.split():
  detail=subprocess.run(['/usr/sbin/lsof','-a','-p',value,'-d','cwd','-Fn'],capture_output=True,text=True)
  names=[line[1:] for line in detail.stdout.splitlines() if line.startswith('n')]
  if len(names)==1 and Path(names[0]).resolve()==cwd:
   try:os.kill(int(value),signal.SIGTERM)
   except ProcessLookupError:pass
 if lock.exists() and lock.stat().st_ino==inode and json.loads((lock/'owner.json').read_text())['token']==token:
  (lock/'owner.json').unlink();lock.rmdir()
 receipt['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/'ssr-diagnostic.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt))
 if log.exists():
  s=log.read_text();i=s.find('[RSO_FIRST_HOOK_STACK]');print(s[max(0,i):i+6500] if i>=0 else s[-1800:])
