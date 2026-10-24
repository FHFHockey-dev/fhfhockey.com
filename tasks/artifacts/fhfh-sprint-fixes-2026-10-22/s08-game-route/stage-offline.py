from pathlib import Path
import hashlib, json, shutil, subprocess, sys, tempfile
queue = Path(sys.argv[1]).resolve()
repo = queue.parents[2]
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
paths = subprocess.check_output(
    ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'web'],
    cwd=repo, text=True
).split('\0')
allowed = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.json', '.scss', '.css', '.html', '.svg'}
paths = sorted({p for p in paths if p and Path(p).suffix in allowed
    and not any(x in {'.git', 'node_modules', '.next', 'dist'} for x in Path(p).parts)
    and not Path(p).name.startswith('.env')
    and Path(p).name not in {'credentials.json', 'secrets.json'}})
scratch = Path(tempfile.mkdtemp(prefix='fhfh-queue-check-', dir='/tmp'))
source = scratch / 'isolation' / 'snapshot'
web = source / 'web'
hashes = {}
for name in paths:
    original = repo / name
    if not original.is_file():
        raise SystemExit('Missing source while copying: ' + name)
    data = original.read_bytes()
    hashes[name] = hashlib.sha256(data).hexdigest()
    target = source / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
if any(not (repo / p).is_file() or hashlib.sha256((repo / p).read_bytes()).hexdigest() != h
       for p, h in hashes.items()):
    raise SystemExit('Source moved while copying; retain scratch evidence and re-coordinate')
if subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip() != head:
    raise SystemExit('HEAD moved while copying; re-coordinate')
(scratch / 'source-fingerprints.json').write_text(json.dumps({'head': head, 'files': hashes}, indent=2) + '\n')
web.joinpath('node_modules').symlink_to(repo / 'web/node_modules', target_is_directory=True)
for name in ['auditEdgecases.test.ts', 'auditStatsAsync.test.tsx', 'auditTemporalCutoff.test.ts']:
    target = web / 'lib' / name
    if target.exists():
        raise SystemExit('Audit-only filename collides with source: ' + str(target))
    shutil.copyfile(queue / 'repros' / name, target)
shutil.copyfile(queue / 'repros/audit.offline.setup.ts', web / 'audit.offline.setup.ts')
shutil.copyfile(queue / 'repros/offline.cjs', web / 'audit-network-deny.cjs')
config = (queue / 'repros/audit.vitest.config.mts').read_text()
config = config.replace('/tmp/fhfh-claude-audit-20261022/vite-cache', str(scratch / 'vite-cache'))
(web / 'audit.vitest.config.mts').write_text(config)
(web / '.audit-home').mkdir()
(web / '.audit-tmp').mkdir()
print(web)