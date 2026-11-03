from pathlib import Path
import datetime, hashlib, json, os, subprocess

ROOT=Path('/Users/tim/Code/fhfhockey.com'); OUT=Path(__file__).resolve().parent
P=ROOT/'tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-capture'
files=[P/n for n in ['normalize-settlement.mjs','normalize-settlement.test.mjs','normalize-readbacks.ts','normalize-readbacks.test.ts','SETTLEMENT-HANDOFF.md','PROTOCOL.md']]
files += [P.parent/'qualification-readbacks/tooling/check-readbacks.mjs',P.parent/'qualification-readbacks/scope.json',ROOT/'web/lib/rosterScheduleData/planningDataTransport.ts']
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
pins={str(p):digest(p) for p in files}
lock=Path('/private/tmp/fhfh-heavy.lock'); owner={'owner':'CODEX-INDEPENDENT-RSO-SETTLEMENT-AUDIT','pid':os.getpid(),'atUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()}
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','TMPDIR','LANG']}
env.update(NODE_OPTIONS='--require='+str(OUT/'network-deny.cjs'),TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS","moduleResolution":"node"}',TS_NODE_TRANSPILE_ONLY='0')
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
results=[]
try:
    jobs=[('settlement-tests',['node','--test',str(P/'normalize-settlement.test.mjs')]),('readback-tests',['node','-r','ts-node/register','-r','tsconfig-paths/register','--test',str(P/'normalize-readbacks.test.ts')])]
    for name,command in jobs:
        proc=subprocess.run(command,cwd=ROOT/'web',env=env,text=True,capture_output=True,timeout=50)
        (OUT/(name+'.log')).write_text(proc.stdout+proc.stderr)
        results.append({'name':name,'exitCode':proc.returncode,'command':command})
    assert all(digest(Path(p))==h for p,h in pins.items())
    (OUT/'SOURCE-PINS.json').write_text(json.dumps(pins,indent=2)+'\n')
    (OUT/'TESTS.json').write_text(json.dumps({'checks':results,'allPassed':all(r['exitCode']==0 for r in results),'sourcePinsUnchanged':True,'productionEnvironmentAbsent':True,'networkGuard':str(OUT/'network-deny.cjs')},indent=2)+'\n')
    print(json.dumps(results))
finally:
    assert json.loads((lock/'owner.json').read_text())==owner
    lock.rename(OUT/'tests-lock-released')
