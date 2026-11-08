"""Copy an isolated, environment-free web source snapshot and pin its contents."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tempfile

root = Path('/Users/tim/Code/fhfhockey.com')
source = root / 'web'
artifact = root / 'tasks/artifacts/roster-autopsy-usability-2026-10-29'
metadata = artifact / 'SNAPSHOT.json'
manifest = artifact / 'SOURCE-MANIFEST.sha256'
if metadata.exists() or manifest.exists():
    raise SystemExit('Snapshot evidence already exists; preserve it before another attempt.')
head_before = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
snapshot = Path(tempfile.mkdtemp(prefix='fhfh-autopsy-snapshot-'))
excludes = ['node_modules', '.env*', '.next*', '.ms-playwright', '.vercel', '.pytest_cache', '.DS_Store',
            'test-results', 'playwright-report', 'coverage', '*.tsbuildinfo', '.temp']
args = ['rsync', '-a'] + [f'--exclude={item}' for item in excludes] + [str(source) + '/', str(snapshot) + '/']
result = subprocess.run(args, text=True, capture_output=True, timeout=120)
if result.returncode:
    raise SystemExit(f'Snapshot copy failed ({result.returncode}): {result.stderr[:2000]}')
os.symlink(source / 'node_modules', snapshot / 'node_modules', target_is_directory=True)
(snapshot / 'vitest.snapshot.config.mts').write_text('''import { defineConfig, mergeConfig } from "vitest/config";\nimport base from "./vitest.config.mts";\nexport default mergeConfig(base, defineConfig({ cacheDir: ".vitest-autopsy-cache" }));\n''')
(snapshot / 'tsconfig.autopsy-verify.json').write_text(json.dumps({
    'extends': './tsconfig.json', 'include': [], 'files': ['next-bootstrap.d.ts', 'lib/rosterAutopsy/manual.ts',
    'lib/rosterAutopsy/manual.test.ts', 'components/RosterAutopsy/RosterAutopsy.tsx',
    'components/RosterAutopsy/RosterAutopsy.test.tsx', 'pages/roster-autopsy.tsx']
}, indent=2) + '\n')

lines = []
for directory, dirs, files in os.walk(snapshot, followlinks=False):
    for name in dirs:
        if name != 'node_modules' and (Path(directory) / name).is_symlink():
            raise SystemExit(f'Unpinned source directory symlink in snapshot: {Path(directory) / name}')
    dirs[:] = sorted(name for name in dirs if name != 'node_modules' and not name.startswith('.next') and name != '.vitest-autopsy-cache')
    for name in sorted(files):
        path = Path(directory) / name
        if name == 'next-env.d.ts' or name.endswith('.tsbuildinfo'):
            continue
        if path.is_symlink():
            raise SystemExit(f'Unpinned source symlink in snapshot: {path}')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        lines.append(f'{digest}  {path.relative_to(snapshot).as_posix()}')
with manifest.open('x') as out:
    out.write('\n'.join(lines) + '\n')
head_after = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
if head_before != head_after:
    raise SystemExit('Checkout HEAD changed during snapshot capture; preserve the evidence and retry with a stable candidate.')
source_files = ['pages/roster-autopsy.tsx', 'lib/rosterAutopsy/manual.ts', 'lib/rosterAutopsy/manual.test.ts',
                'components/RosterAutopsy/RosterAutopsy.tsx', 'components/RosterAutopsy/RosterAutopsy.module.scss',
                'components/RosterAutopsy/RosterAutopsy.test.tsx']
matching = {name: hashlib.sha256((snapshot / name).read_bytes()).hexdigest() == hashlib.sha256((source / name).read_bytes()).hexdigest()
            for name in source_files}
if not all(matching.values()):
    raise SystemExit('Autopsy source changed during snapshot capture; inspect the preserved snapshot and retry only with a new stable candidate.')
info = {'capturedAtUtc': datetime.now(timezone.utc).isoformat(), 'sourceHeadBefore': head_before, 'sourceHeadAfter': head_after,
        'snapshotPath': str(snapshot), 'manifestPath': str(manifest), 'manifestSha256': hashlib.sha256(manifest.read_bytes()).hexdigest(),
        'sourceFileCount': len(lines), 'autopsyFilesMatchCheckoutAtCapture': matching,
        'excluded': excludes + ['next-env.d.ts from manifest (Next-generated)'],
        'dependencyBoundary': 'node_modules is a read-only-use symlink to the existing installation; package-lock.json is included in source manifest.'}
with metadata.open('x') as out:
    json.dump(info, out, indent=2); out.write('\n')
print(json.dumps(info))
