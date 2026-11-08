"""Recheck every pinned source file and reject unexpected new source files."""
from pathlib import Path
import hashlib
import json
import os

artifact = Path('/Users/tim/Code/fhfhockey.com/tasks/artifacts/roster-autopsy-usability-2026-10-29')
info = json.loads((artifact / 'SNAPSHOT.json').read_text())
snapshot = Path(info['snapshotPath'])
manifest = artifact / 'SOURCE-MANIFEST.sha256'
if hashlib.sha256(manifest.read_bytes()).hexdigest() != info['manifestSha256']:
    raise SystemExit('Snapshot manifest changed.')
expected = {}
for line in manifest.read_text().splitlines():
    digest, name = line.split('  ', 1)
    expected[name] = digest
actual = {}
for directory, dirs, files in os.walk(snapshot, followlinks=False):
    for name in dirs:
        if name != 'node_modules' and (Path(directory) / name).is_symlink():
            raise SystemExit(f'Unexpected directory symlink: {Path(directory) / name}')
    dirs[:] = sorted(name for name in dirs if name != 'node_modules' and not name.startswith('.next') and name != '.vitest-autopsy-cache')
    for name in sorted(files):
        if name == 'next-env.d.ts' or name.endswith('.tsbuildinfo'):
            continue
        path = Path(directory) / name
        if path.is_symlink(): raise SystemExit(f'Unexpected symlink: {path}')
        actual[path.relative_to(snapshot).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
if actual != expected:
    changed = sorted(name for name in set(expected) | set(actual) if expected.get(name) != actual.get(name))
    raise SystemExit(f'Snapshot drift: {changed[:30]}')
print(json.dumps({'result': 'passed', 'sourceFileCount': len(actual), 'manifestSha256': info['manifestSha256']}))
