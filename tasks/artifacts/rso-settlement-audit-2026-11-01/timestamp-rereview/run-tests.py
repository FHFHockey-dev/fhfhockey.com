from pathlib import Path
import datetime,hashlib,json,os,re,subprocess
R=Path('/Users/tim/Code/fhfhockey.com');O=Path(__file__).resolve().parent
P=R/'tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-capture'
pins={str(R/x['path']):x['sha256'] for x in json.loads((P/'timestamp-review-fix/SOURCE-PINS.json').read_text())['files']}
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in pins.items())
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','LANG']}
env.update(NODE_OPTIONS='--require='+str(O.parent/'network-deny.cjs'),TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}',TS_NODE_TRANSPILE_ONLY='0')
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'CODEX-INDEPENDENT-RSO-TIMESTAMP-REREVIEW','pid':os.getpid(),'atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner));results=[]
try:
    for tz in ['UTC','America/New_York']:
        for kind in ['settlement','readbacks']:
            command=['node']+(['-r','ts-node/register','-r','tsconfig-paths/register'] if kind=='readbacks' else [])+['--test',str(P/('normalize-'+kind+'.test.'+('ts' if kind=='readbacks' else 'mjs')))]
            result=subprocess.run(command,cwd=R/'web',env={**env,'TZ':tz},capture_output=True,text=True,timeout=50)
            log=result.stdout+result.stderr;name=kind+'-'+tz.replace('/','_')
            (O/(name+'.log')).write_text(log)
            counts={k:int(v) for k,v in re.findall(r'^# (tests|pass|fail) (\d+)$',log,re.M)}
            results.append({'check':name,'exitCode':result.returncode,'counts':counts})
    assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in pins.items())
    receipt={'checks':results,'allPassed':all(r['exitCode']==0 for r in results),'sourcePinsUnchanged':len(pins),'productionEnvironmentAbsent':True,'networkGuard':str(O.parent/'network-deny.cjs')}
    (O/'TESTS.json').write_text(json.dumps(receipt,indent=2)+'\n');(O/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n');print(json.dumps(receipt,indent=2))
finally:
    assert json.loads((lock/'owner.json').read_text())==owner
    lock.rename(O/'tests-lock-released')
