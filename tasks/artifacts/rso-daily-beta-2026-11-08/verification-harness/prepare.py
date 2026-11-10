import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone

repo = Path('/Users/tim/Code/fhfhockey.com')
artifacts = repo / 'tasks/artifacts/rso-daily-beta-2026-11-08'
artifacts.mkdir(exist_ok=True)
old = json.loads((repo / 'tasks/artifacts/rso-first-pass-2026-11-07/CANDIDATE.json').read_text())
base = subprocess.check_output(['git', 'rev-parse', 'origin/master'], cwd=repo, text=True).strip()
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
root = Path(tempfile.mkdtemp(prefix='fhfh-rso-daily-beta-20261108-', dir='/tmp'))

def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo)

def object_hash(kind, data):
    return hashlib.sha1(kind.encode() + b' ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def tree_hash(entries):
    tree = {}
    for name, mode, oid in entries:
        parent = tree
        parts = name.split('/')
        for part in parts[:-1]:
            parent = parent.setdefault(part, {})
        parent[parts[-1]] = (mode, oid)
    def encode(directory):
        data = b''
        for name, value in sorted(directory.items(), key=lambda pair: (pair[0] + ('/' if isinstance(pair[1], dict) else '')).encode()):
            mode, oid = ('40000', encode(value)) if isinstance(value, dict) else value
            data += mode.encode() + b' ' + name.encode() + b'\0' + bytes.fromhex(oid)
        return object_hash('tree', data)
    return encode(tree)

entries = []
for raw in git('ls-tree', '-rz', base).split(b'\0'):
    if not raw:
        continue
    meta, path = raw.split(b'\t', 1)
    mode, kind, oid = meta.decode().split(' ')
    assert kind == 'blob'
    entries.append((path.decode(), mode, oid))
base_tree = git('rev-parse', base + '^{tree}').decode().strip()
assert tree_hash(entries) == base_tree
omitted = []
with tarfile.open(fileobj=io.BytesIO(git('archive', base))) as archive:
    members = []
    for member in archive.getmembers():
        if Path(member.name).name.startswith('.env'):
            omitted.append(member.name)
        else:
            members.append(member)
    archive.extractall(root, members=members, filter='data')

overlays = {}
pins = []
for row in old['overlayFiles']:
    path = row['path']
    data = (repo / path).read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    assert sha == row['sha256'], path
    blob = object_hash('blob', data)
    assert blob == row['candidateBlob'], path
    assert git('rev-parse', head + ':' + path).decode().strip() == blob, path
    overlays[path] = blob
    shutil.copyfile(repo / path, root / path)
    pins.append({'path': path, 'sha256': sha, 'candidateBlob': blob, 'baseBlob': git('rev-parse', base + ':' + path).decode().strip()})
expected = [(p, m, overlays.get(p, h)) for p, m, h in entries]
candidate_tree = tree_hash(expected)
for path, mode, oid in expected:
    if path in omitted:
        continue
    target = root / path
    data = os.readlink(target).encode() if mode == '120000' else target.read_bytes()
    assert object_hash('blob', data) == oid, path

patch = repo / 'tasks/artifacts/rso-first-pass-2026-11-07/CORRECTIONS.patch'
shutil.copyfile(patch, artifacts / 'CORRECTIONS.patch')
subprocess.run(['git', 'apply', '--reverse', '--check', str(artifacts / 'CORRECTIONS.patch')], cwd=root, check=True)
record = {
    'createdAt': datetime.now(timezone.utc).isoformat(),
    'state': 'RECONCILED_NOT_YET_VERIFIED',
    'baseCommit': base, 'baseTree': base_tree,
    'observedCanonicalHead': head, 'priorCandidateTree': old['candidateTree'],
    'candidateTree': candidate_tree, 'candidateCommit': None,
    'sourceFiles': pins, 'exportRoot': str(root),
    'excludedEnvironmentFiles': omitted,
    'verifiedTrackedFiles': len(entries) - len(omitted),
    'patchSha256': hashlib.sha256(patch.read_bytes()).hexdigest(),
    'gitMutation': 'none; candidate tree calculated without writing Git objects, refs or index',
    'scope': 'Locally recorded origin/master #416 plus exactly the existing reviewed 16-file RSO overlay. No shared dirty changes included.',
    'remoteRefFreshness': 'Existing local ref only; no remote status or deployment verification performed.',
}
(artifacts / 'CANDIDATE.json').write_text(json.dumps(record, indent=2) + '\n')
(artifacts / 'SOURCE-PINS.json').write_text(json.dumps({'candidateTree':candidate_tree, 'files':[{'path':p,'mode':m,'blob':h,'omitted':p in omitted} for p,m,h in expected]}, indent=2) + '\n')
Path('/tmp/rso-daily-beta-20261108-path.txt').write_text(str(root))
print(json.dumps(record, indent=2))
