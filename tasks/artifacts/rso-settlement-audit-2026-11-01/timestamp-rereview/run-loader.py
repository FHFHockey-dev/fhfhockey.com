from pathlib import Path
import datetime,hashlib,json,os,subprocess
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','LANG']};env.update(NODE_OPTIONS='--require='+str(O.parent/'network-deny.cjs'),TZ='UTC')
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'CODEX-INDEPENDENT-RSO-LOADER-REREVIEW','pid':os.getpid(),'atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
try:
    p=subprocess.run(['node',str(O/'loader-probe.mjs')],cwd=R/'web',env=env,capture_output=True,text=True,timeout=30)
    (O/'loader-03.stdout').write_text(p.stdout);(O/'loader-03.stderr').write_text(p.stderr)
    result={'exitCode':p.returncode,'result':json.loads(p.stdout) if p.returncode==0 else p.stderr[:1500]}
    assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest()==h for path,h in json.loads((O/'PINS.json').read_text()).items())
    (O/'LOADER-03.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
finally:
    assert json.loads((lock/'owner.json').read_text())==owner
    lock.rename(O/'loader-03-lock-released')
