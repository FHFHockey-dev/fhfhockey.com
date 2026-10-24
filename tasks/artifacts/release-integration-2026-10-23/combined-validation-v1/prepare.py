"""Compose an offline validation copy; this does not create a release candidate."""
from pathlib import Path
import datetime, hashlib, json, shutil, subprocess, tarfile, tempfile

R = Path('/Users/tim/Code/fhfhockey.com')
O = Path(__file__).resolve().parent
P = O.parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
packets = [
    ('trusted-yahoo', P/'trusted-yahoo/CANDIDATE.json', 'independently accepted'),
    ('selected-model-baseline', P/'selected-model-baseline/CANDIDATE.json', 'review blocked; reason not supplied'),
    ('billing', R/'tasks/artifacts/billing-sales-rollout-2026-10-23/account-rollout-correction/CANDIDATE.json', 'independently accepted'),
    ('game-grid-base', Path('/Users/tim/Documents/Codex/2026-10-22/task-3/evidence/release-fixes/CANDIDATE.json'), 'accepted; r4 supersedes overlapping paths'),
    ('game-grid-r4', Path('/Users/tim/Documents/Codex/2026-10-22/task-3/evidence/visual-v2/CANDIDATE.json'), 'independently accepted'),
    ('news-correction', Path('/Users/tim/Documents/Codex/2026-10-23/task-4/evidence/quote-author-correction/CANDIDATE.json'), 'independent review pending'),
]
pins, provenance, superseded = {}, {}, []
for name, manifest, status in packets:
    data = json.loads(manifest.read_text())
    entries = data.get('pins', data.get('files'))
    for path, value in entries.items():
        h = value if isinstance(value, str) else value.get('after_sha256', value.get('sha256'))
        assert h and len(h) == 64, (name, path)
        if path in pins and pins[path] != h:
            assert name == 'game-grid-r4' and provenance[path]['packet'] == 'game-grid-base', path
            superseded.append({'path': path, 'old': pins[path], 'new': h})
        pins[path] = h
        provenance[path] = {'packet': name, 'status': status, 'manifest': str(manifest)}
for path, h in pins.items():
    assert sha(R/path) == h, 'canonical drift: '+path

archive = P/'selected-model-baseline/fixed-source.tar.gz'
assert sha(archive) == '362c8020b99d5b7993d8c0028e6293ac588da1e62dfc76a4298dd28b75e41556'
S = Path(tempfile.mkdtemp(prefix='fhfh-combined-static-'))/'snapshot'
S.mkdir()
with tarfile.open(archive) as tar:
    for member in tar.getmembers():
        assert not member.issym() and not member.islnk()
        assert not member.name.startswith('/') and '..' not in Path(member.name).parts
    tar.extractall(S, filter='data')
removed = []
for path in ['web/audit.before-rso.tsx', 'web/scripts/releaseLegacyProducerBoundary.test.ts', 'web/audit.yahoo.tsconfig.json']:
    p = S/path
    if p.exists():
        removed.append({'path': path, 'sha256': sha(p), 'reason': 'artifact-only verification helper, not app source'})
        p.unlink()
for path in pins:
    dest = S/path
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(R/path, dest)
(S/'web/node_modules').symlink_to(R/'web/node_modules', target_is_directory=True)
files = {str(p.relative_to(S)): sha(p) for p in S.rglob('*') if p.is_file() and 'node_modules' not in p.parts}
canonical_difference = [n for n,h in files.items() if (R/n).is_file() and sha(R/n) != h]
assert canonical_difference == ['web/next-env.d.ts'] or not canonical_difference, canonical_difference
manifest = {
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'OFFLINE VALIDATION ONLY; includes explicitly pending packets; not a release commit or acceptance',
    'head': subprocess.check_output(['git','rev-parse','HEAD'], cwd=R, text=True).strip(),
    'snapshot': str(S), 'baseArchiveSha256': sha(archive), 'files': files,
    'overlayPins': pins, 'provenance': provenance, 'superseded': superseded, 'removedArtifactHelpers': removed,
    'canonicalDifferences': canonical_difference,
    'limits': ['Inherited supporting source is test context, not blanket acceptance.',
               'New isolated Luna files and research-only additions outside the frozen context are excluded.',
               'Generated next-env.d.ts retains snapshot bytes; it is excluded by app tsconfig.',
               'No environment files, private exports, Git metadata or release operation added.'],
}
(O/'SNAPSHOT.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({'snapshot': str(S), 'files': len(files), 'overlayPins': len(pins), 'supersededGridPins': len(superseded)}))
