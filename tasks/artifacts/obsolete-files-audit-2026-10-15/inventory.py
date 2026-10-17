"""Read filesystem metadata only; write solely to this audit's report directory.

Never reads file bodies, follows symlinks, invokes application code, or mutates
the checkout. The compressed manifest records paths, sizes and timestamps;
protected research/credential files receive metadata coverage only.
"""
from __future__ import annotations

import collections
import datetime
import gzip
import json
import os
from pathlib import Path
import stat
import subprocess

ROOT = Path('/Users/tim/Code/fhfhockey.com')
OUT = Path(__file__).resolve().parent
OWN = OUT.relative_to(ROOT).as_posix()
ENV = dict(os.environ, GIT_OPTIONAL_LOCKS='0')


def git(*args: str) -> str:
    return subprocess.check_output(['git', *args], cwd=ROOT, env=ENV).decode()


def category(path: str) -> str:
    parts = path.split('/')
    if parts[0] == '.git':
        return 'git-preserve'
    if path.startswith('web/.next-codex-reconcile/'):
        return 'protected-repository-mirror'
    if any(x in {'.env', '.env.local', '.env.production', '.env.development',
                 '.aws', '.vercel', '.ssh', 'credentials.json'} or x.startswith('.env.') for x in parts):
        return 'protected-configuration-metadata-only'
    if any(x in {'node_modules', '.ms-playwright'} for x in parts) or parts[0] == '.venv':
        return 'installed-dependencies-preserve'
    if any(x.startswith('.next') for x in parts) or any(x in {'dist', 'build', '.sanity'} for x in parts):
        return 'generated-build-review-process-use'
    if any(x in {'test-results', 'playwright-report', 'coverage'} for x in parts):
        return 'test-diagnostics-preserve-until-reviewed'
    if any(x in {'.npm-cache', '.pytest_cache', '__pycache__', '.pnpm-store', '.cache'} for x in parts):
        return 'local-cache-review-process-use'
    if parts[-1] in {'.DS_Store', 'tsconfig.tsbuildinfo'} or parts[-1].endswith('.pyc'):
        return 'generated-metadata-review'
    if parts[0] == '.tmp' or any(x in {'output', 'outputs', 'artifacts', 'evidence', 'datasets'} for x in parts):
        return 'evidence-or-output-preserve-metadata-only'
    return 'source-documents-assets-or-configuration'


def main() -> None:
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    tracked = set(git('ls-files', '-z').split('\0')) - {''}
    initial = {
        'timestamp_utc': started,
        'branch': git('branch', '--show-current').strip(),
        'head': git('rev-parse', 'HEAD').strip(),
        'status': git('status', '--porcelain=v1', '-uall').splitlines(),
        'tracked_file_count': len(tracked),
        'worktrees': git('worktree', 'list', '--porcelain'),
        'instruction_paths_absent': [p for p in ['.agents', '.agents/skills', '.codex'] if not (ROOT / p).exists()],
    }
    (OUT / 'initial-state.json').write_text(json.dumps(initial, indent=2) + '\n')
    totals: dict[str, dict] = {}
    seen: set[tuple[int, int]] = set()
    errors: list[dict] = []
    largest: list[dict] = []
    tracked_observed: set[str] = set()

    def add(key: str, row: dict) -> None:
        item = totals.setdefault(key, {'files': 0, 'symlinks': 0, 'apparent_bytes': 0,
                                       'allocated_bytes_unique_inodes': 0, 'tracked_files': 0})
        item['files'] += row['kind'] == 'file'
        item['symlinks'] += row['kind'] == 'symlink'
        item['apparent_bytes'] += row['bytes']
        item['allocated_bytes_unique_inodes'] += row['unique_allocated_bytes']
        item['tracked_files'] += row['tracked']

    def walk_error(error: OSError) -> None:
        errors.append({'path': str(error.filename), 'error': str(error)})

    with gzip.open(OUT / 'filesystem-metadata.jsonl.gz', 'wt', encoding='utf8') as handle:
        for base, dirs, files in os.walk(ROOT, followlinks=False, onerror=walk_error):
            relbase = Path(base).relative_to(ROOT).as_posix()
            dirs[:] = sorted(d for d in dirs if (Path(base) / d).relative_to(ROOT).as_posix() != OWN)
            names = sorted(files + [d for d in dirs if (Path(base) / d).is_symlink()])
            for name in names:
                p = Path(base) / name
                rel = p.relative_to(ROOT).as_posix()
                try:
                    info = p.lstat()
                except OSError as error:
                    errors.append({'path': rel, 'error': str(error)})
                    continue
                kind = 'symlink' if stat.S_ISLNK(info.st_mode) else 'file' if stat.S_ISREG(info.st_mode) else 'other'
                inode = (info.st_dev, info.st_ino)
                unique_allocated = info.st_blocks * 512 if inode not in seen else 0
                seen.add(inode)
                row = {'path': rel, 'kind': kind, 'bytes': info.st_size,
                       'unique_allocated_bytes': unique_allocated,
                       'device': info.st_dev, 'inode': info.st_ino, 'links': info.st_nlink,
                       'mtime_ns': info.st_mtime_ns, 'tracked': rel in tracked,
                       'category': category(rel)}
                if row['tracked']:
                    tracked_observed.add(rel)
                handle.write(json.dumps(row, separators=(',', ':')) + '\n')
                add('all', row)
                add('category:' + row['category'], row)
                parts = rel.split('/')
                for depth in range(1, min(len(parts), 4)):
                    add('path:' + '/'.join(parts[:depth]), row)
                if len(parts) == 1:
                    add('path:' + rel, row)
                if info.st_size >= 10_000_000:
                    largest.append({k: row[k] for k in ['path', 'bytes', 'tracked', 'category']})
    summary = {
        'started_utc': started,
        'finished_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': str(ROOT), 'own_report_excluded': OWN,
        'method': 'lstat only; no symlink traversal or file-body reads; directory inode sizes omitted',
        'space_caveat': 'Apparent bytes are logical file lengths. st_blocks deduplicates device/inode within this traversal only; APFS clones, compression and snapshots prevent a physical-space saving promise.',
        'totals': totals, 'errors': errors,
        'tracked_missing': sorted(tracked - tracked_observed),
        'large_files': sorted(largest, key=lambda x: -x['bytes']),
    }
    (OUT / 'filesystem-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps({k: summary[k] for k in ['started_utc', 'finished_utc', 'tracked_missing', 'errors']}))
    for key, value in totals.items():
        if key == 'all' or key.startswith('category:') or (key.startswith('path:') and '/' not in key):
            print(key, json.dumps(value))


if __name__ == '__main__':
    main()
