from pathlib import Path
import datetime, hashlib, json, os, shutil, subprocess, tempfile, uuid

R = Path('/Users/tim/Code/fhfhockey.com')
O = Path(__file__).resolve().parent
original = json.loads((O.parent / 'CURRENT-SNAPSHOT.json').read_text())
S = Path(tempfile.mkdtemp(prefix='fhfh-confirmed-news-')) / 'snapshot'
shutil.copytree(Path(original['snapshot']) / 'web', S / 'web',
                ignore=shutil.ignore_patterns('node_modules', '.audit-home', '.audit-tmp', '.next', '*.tsbuildinfo'))
W = S / 'web'
(W / 'node_modules').symlink_to(R / 'web/node_modules', target_is_directory=True)
for n in ['web/lib/rosterScheduleData/forgeDailyBridge.test.ts']:
    shutil.copyfile(R / n, S / n)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
files = {str(p.relative_to(S)): sha(p) for p in W.rglob('*') if p.is_file() and 'node_modules' not in p.parts}
def dump(n, value):
    (O / n).write_text(json.dumps(value, indent=2) + '\n')
dump('SNAPSHOT.json', {'path': str(S), 'files': files})
env = json.loads((O.parent / 'PROVIDER-CORRECTION-COMMAND.json').read_text())['environment']
env.update(HOME=str(S.parent / 'home'), TMPDIR=str(S.parent / 'tmp'), TZ='UTC',
           NODE_OPTIONS='--require ' + str(W / 'audit-network-deny.cjs'), npm_config_update_notifier='false')
Path(env['HOME']).mkdir(); Path(env['TMPDIR']).mkdir()
commands = [
    ('tests', ['npm', 'test', '--', '--run', '--config', 'audit.vitest.config.mts',
               'lib/rosterScheduleData/forgeDailyBridge.test.ts', 'lib/projections/dailyBoardEvidence.test.ts',
               '--reporter=json', '--outputFile=' + str(O / 'tests.json')]),
    ('lint', ['npm', 'exec', '--offline', '--no', '--', 'eslint', 'lib/rosterScheduleData/forgeDailyBridge.test.ts']),
]
dump('COMMANDS.json', {'cwd': str(W), 'environment': env, 'commands': dict(commands)})
L = Path('/private/tmp/fhfh-heavy.lock')
owner = {'pid': os.getpid(), 'token': str(uuid.uuid4()), 'thread': '01a1637a-4222-70c0-8439-cb3cc46b20c4',
         'scope': 'trusted confirmation focused tests/lint', 'at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
try:
    L.mkdir()
except FileExistsError:
    dump('LOCK-BLOCKER.json', {'path': str(L), 'status': 'occupied; did not start checks'})
    raise SystemExit('HEAVY_LOCK_OCCUPIED')
(L / 'owner.json').write_text(json.dumps(owner) + '\n'); inode = L.stat().st_ino
results = []
try:
    assert subprocess.check_output(['node', '--version'], env=env, text=True).strip() == 'v22.11.0'
    for name, args in commands:
        with (O / (name + '.log')).open('w') as log:
            result = subprocess.run(args, cwd=W, env=env, stdout=log, stderr=subprocess.STDOUT)
        results.append({'name': name, 'exit_code': result.returncode})
        dump('RESULTS.json', results); print(name, result.returncode, flush=True)
finally:
    dump('INTEGRITY.json', {'files': len(files), 'drift': [n for n, h in files.items() if sha(S / n) != h]})
    if L.is_dir() and L.stat().st_ino == inode and json.loads((L / 'owner.json').read_text())['token'] == owner['token']:
        (L / 'owner.json').unlink(); L.rmdir()
