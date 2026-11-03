from pathlib import Path
import datetime,hashlib,json,os,subprocess
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','LANG']}
env.update(NODE_OPTIONS='--require='+str(O.parent/'network-deny.cjs'),TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}',TS_NODE_TRANSPILE_ONLY='0')
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'CODEX-INDEPENDENT-RSO-TIMESTAMP-REPROBES','pid':os.getpid(),'atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner));results=[]
try:
    jobs=[(tz,['node','-r','ts-node/register','-r','tsconfig-paths/register',str(O/'probes.cjs')]) for tz in ['UTC','America/New_York']]
    jobs.append(('loader',['node',str(O/'loader-probe.mjs')]))
    for name,command in jobs:
        p=subprocess.run(command,cwd=R/'web',env={**env,'TZ':'UTC' if name=='loader' else name},capture_output=True,text=True,timeout=50)
        key=name.replace('/','_');(O/(key+'.stdout')).write_text(p.stdout);(O/(key+'.stderr')).write_text(p.stderr)
        record={'name':name,'exitCode':p.returncode}
        if p.returncode==0:record['result']=json.loads(p.stdout)
        else:record['error']=p.stderr[:2000]
        results.append(record)
    pins=json.loads((O/'PINS.json').read_text());assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest()==h for path,h in pins.items())
    (O/'PROBES.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
finally:
    assert json.loads((lock/'owner.json').read_text())==owner
    lock.rename(O/'probes-lock-released')
