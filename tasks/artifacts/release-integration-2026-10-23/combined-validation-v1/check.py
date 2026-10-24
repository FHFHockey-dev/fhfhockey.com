from pathlib import Path
import datetime, hashlib, json, os, subprocess, uuid

O = Path(__file__).resolve().parent
R = Path('/Users/tim/Code/fhfhockey.com')
manifest = json.loads((O/'SNAPSHOT.json').read_text())
S = Path(manifest['snapshot']); W = S/'web'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
env = json.loads((O.parent/'selected-model-baseline/COMMAND.json').read_text())['environment']
env.update(HOME=str(S.parent/'home'), TMPDIR=str(S.parent/'tmp'),
           NODE_OPTIONS='--require '+str(W/'audit-network-deny.cjs'), npm_config_update_notifier='false')
Path(env['HOME']).mkdir(exist_ok=True); Path(env['TMPDIR']).mkdir(exist_ok=True)
lint_paths = sorted(n[4:] for n in manifest['overlayPins'] if n.endswith(('.ts', '.tsx', '.js', '.mjs')))
commands = [('types', ['npm','exec','--no','--','tsc','--noEmit','--pretty','false']),
            ('lint', ['npm','exec','--no','--','eslint',*lint_paths])]
lock = Path('/private/tmp/fhfh-heavy.lock')
owner = {'pid':os.getpid(), 'token':str(uuid.uuid4()), 'thread':'01a1637a-4222-70c0-8439-cb3cc46b20c4',
         'scope':'composed offline app types and 105-pin lint; no unit-suite rerun',
         'at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
try: lock.mkdir()
except FileExistsError:
    print('LOCK_OCCUPIED; checks not started'); raise SystemExit(2)
(lock/'owner.json').write_text(json.dumps(owner)); inode=lock.stat().st_ino
results=[]
try:
    node=subprocess.check_output(['node','--version'],env=env,text=True).strip()
    npm=subprocess.check_output(['npm','--version'],env=env,text=True).strip()
    assert node=='v22.11.0',node
    (O/'COMMANDS.json').write_text(json.dumps({'cwd':str(W),'environment':env,'node':node,'npm':npm,
        'commands':commands, 'lock':owner},indent=2)+'\n')
    for name, argv in commands:
        started=datetime.datetime.now(datetime.timezone.utc).isoformat()
        print(name+' started',flush=True)
        with (O/(name+'.log')).open('w') as f:
            result=subprocess.run(argv,cwd=W,env=env,stdout=f,stderr=subprocess.STDOUT)
        results.append({'name':name,'exitCode':result.returncode,'started':started,
                        'finished':datetime.datetime.now(datetime.timezone.utc).isoformat()})
        print(name+' exit '+str(result.returncode),flush=True)
finally:
    drift=[n for n,h in manifest['files'].items() if not (S/n).is_file() or sha(S/n)!=h]
    canonical_drift=[n for n,h in manifest['overlayPins'].items() if not (R/n).is_file() or sha(R/n)!=h]
    (O/'RESULT.json').write_text(json.dumps({'results':results,'snapshotDrift':drift,
        'canonicalOverlayDrift':canonical_drift,'files':len(manifest['files']),
        'finished':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n')
    if lock.is_dir() and lock.stat().st_ino==inode and json.loads((lock/'owner.json').read_text())['token']==owner['token']:
        (lock/'owner.json').unlink();lock.rmdir()
