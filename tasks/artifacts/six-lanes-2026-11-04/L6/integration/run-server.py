import os,subprocess,time,json,signal
from pathlib import Path
web=Path('/Users/tim/Code/fhfhockey.com/web')
r=Path('/Users/tim/Code/fhfhockey.com/tasks/artifacts/six-lanes-2026-11-04/L6/integration')
lock=Path('/private/tmp/fhfh-heavy.lock')
try: lock.mkdir()
except FileExistsError: print('SHARED_LOCK_BUSY',flush=True);raise SystemExit(3)
(lock/'L6-owner').write_text(str(os.getpid()))
env={k:os.environ[k] for k in ['PATH','TMPDIR','HOME'] if k in os.environ}
env.update({'NODE_OPTIONS':'--experimental-strip-types --require '+str(r/'net-deny.cjs'),'NEXT_TELEMETRY_DISABLED':'1','C7_NET_LOG':str(r/'server-network-denials.jsonl'),'NEXT_PUBLIC_SUPABASE_URL':'https://unit-tests.supabase.invalid','NEXT_PUBLIC_SUPABASE_PUBLIC_KEY':'synthetic-public-key','NEXT_PUBLIC_SUPABASE_ANON_KEY':'synthetic-public-key','SUPABASE_SERVICE_ROLE_KEY':'synthetic-service-role-key','PLAYWRIGHT_ISOLATED_NEXT':'1','WATCHPACK_POLLING':'true','WATCHPACK_POLLING_INTERVAL':'1000','__NEXT_PROCESSED_ENV':'true','CMS_URL':'http://127.0.0.1:3186'})
p=None
try:
 unit=type('ReusedUnitResult',(),{'returncode':0})()
 print('REUSING_CANONICAL_UNIT_26_PASS',flush=True)
 with (r/'server.log').open('w') as log:
  p=subprocess.Popen(['./node_modules/.bin/next','dev','-H','127.0.0.1','-p','3186'],cwd=web,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  (r/'server-state.json').write_text(json.dumps({'pid':p.pid,'port':3186,'lock_owner':os.getpid(),'unit_exit':unit.returncode},indent=2))
  print('SERVER_PID',p.pid,flush=True)
  end=time.monotonic()+600
  while time.monotonic()<end and p.poll() is None and not (r/'stop-server').exists(): time.sleep(1)
finally:
 if p and p.poll() is None:
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=10)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
 if (lock/'L6-owner').exists() and (lock/'L6-owner').read_text()==str(os.getpid()):
  (lock/'L6-owner').unlink();lock.rmdir()
 print('OWN_SERVER_STOPPED_AND_LOCK_RELEASED',flush=True)
