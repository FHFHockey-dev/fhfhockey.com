from pathlib import Path
import datetime,hashlib,json,os,subprocess
O=Path(__file__).resolve().parent;R=Path('/Users/tim/Code/fhfhockey.com')
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','LANG']}
env.update(NODE_OPTIONS='--require='+str(O/'network-deny.cjs'),TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}',TS_NODE_TRANSPILE_ONLY='0')
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'CODEX-INDEPENDENT-RSO-SETTLEMENT-PROBES','pid':os.getpid(),'atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
try:
    p=subprocess.run(['node','-r','ts-node/register','-r','tsconfig-paths/register',str(O/'probes.cjs')],cwd=R/'web',env=env,text=True,capture_output=True,timeout=50)
    (O/'probes-02.stdout').write_text(p.stdout);(O/'probes-02.stderr').write_text(p.stderr)
    print('exitCode',p.returncode)
    if p.returncode==0:
        data=json.loads(p.stdout);(O/'PROBES.json').write_text(json.dumps(data,indent=2)+'\n');print(json.dumps(data,indent=2))
    else:print(p.stderr[:4000])
    assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest()==pin for path,pin in json.loads((O/'SOURCE-PINS.json').read_text()).items())
finally:
    assert json.loads((lock/'owner.json').read_text())==owner
    lock.rename(O/'probes-02-lock-released')
