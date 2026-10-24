from pathlib import Path
import datetime, hashlib, json, os, shutil, socket, subprocess, tempfile, uuid

R = Path('/Users/tim/Code/fhfhockey.com')
O = Path(__file__).resolve().parent
P = Path('/Users/tim/Documents/Codex/2026-10-22/task-3/evidence/visual-v2')
candidate = json.loads((P/'CANDIDATE.json').read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert all(sha(R/n) == v['after_sha256'] for n, v in candidate['files'].items())
base = Path(json.loads((O.parent/'selected-model-baseline/SNAPSHOT.json').read_text())['path'])
S = Path(tempfile.mkdtemp(prefix='fhfh-grid-r4-review-'))
W = S/'web'
shutil.copytree(base/'web', W, ignore=shutil.ignore_patterns('node_modules', '.next', '.audit-home', '.audit-tmp', '*.tsbuildinfo'))
(W/'node_modules').symlink_to(R/'web/node_modules', target_is_directory=True)
for n in candidate['files']:
    dest = S/n
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(R/n, dest)
port = 43129
with socket.socket() as probe:
    probe.bind(('127.0.0.1', port))
for n in ['e2e/game-grid-previews.config.ts', 'e2e/fixtures/game-grid-previews/server.mjs']:
    path = W/n
    path.write_text(path.read_text().replace('3112', str(port)))
(S/'home').mkdir()
(S/'tmp').mkdir()
env = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(S/'home'), 'TMPDIR': str(S/'tmp'),
       'TZ': 'UTC', 'PLAYWRIGHT_BROWSERS_PATH': '/Users/tim/Library/Caches/ms-playwright',
       'npm_config_offline': 'true', 'npm_config_update_notifier': 'false', 'CI': '1'}
args = ['npm', 'exec', '--offline', '--no', '--', 'playwright', 'test', '--config',
        'e2e/game-grid-previews.config.ts', '--grep', 'Game Grid visual footprint and semantic headers',
        '--reporter=json', '--output', str(O/'browser-artifacts')]
dump = lambda n, v: (O/n).write_text(json.dumps(v, indent=2)+'\n')
dump('COMMAND.json', {'cwd': str(W), 'argv': args, 'environment': env,
                     'fixtureOnlyPortNormalization': port,
                     'snapshotPins': {n: sha(S/n) for n in candidate['files']}})
L = Path('/private/tmp/fhfh-heavy.lock')
owner = {'pid': os.getpid(), 'token': str(uuid.uuid4()), 'thread': '01a1637a-4222-70c0-8439-cb3cc46b20c4',
         'scope': 'Independent Game Grid r4 six-viewport review', 'at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
try:
    L.mkdir()
except FileExistsError:
    raise SystemExit('LOCK_OCCUPIED: '+(L/'owner.json').read_text())
(L/'owner.json').write_text(json.dumps(owner))
inode = L.stat().st_ino
try:
    assert subprocess.check_output(['node', '--version'], env=env, text=True).strip() == 'v22.11.0'
    with (O/'browser.json').open('w') as out, (O/'browser.stderr.log').open('w') as err:
        result = subprocess.run(args, cwd=W, env=env, stdout=out, stderr=err)
    dump('RESULT.json', {'exitCode': result.returncode,
        'canonicalDrift': [n for n, v in candidate['files'].items() if sha(R/n) != v['after_sha256']]})
    print('browser exit', result.returncode, flush=True)
finally:
    if L.is_dir() and L.stat().st_ino == inode and json.loads((L/'owner.json').read_text())['token'] == owner['token']:
        (L/'owner.json').unlink()
        L.rmdir()
