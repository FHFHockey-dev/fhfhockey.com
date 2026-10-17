#!/usr/bin/env python3
"""Validate retained caches; --apply restores them without overwriting paths."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--apply', action='store_true', help='Restore after validating every retained file. Default validates only.')
args = parser.parse_args()
receipt_dir = Path(__file__).resolve().parent
manifest = json.loads((receipt_dir / 'manifest.json').read_text())
repo = Path('/Users/tim/Code/fhfhockey.com')
allowed = {'web/.next-playwright', 'web/.next-player-forecasts', 'web/.next-codex-verify', 'web/.next-codex-verify-2', 'web/.next-codex-auth-verify', '.next', '.npm-cache/_cacache', '.pnpm-store'}
assert manifest['repo'] == str(repo)
assert {m['relative_path'] for m in manifest['moves']} == allowed
trash = Path(manifest['trash_root'])
assert trash.parent == Path('/Users/tim/.Trash') and not trash.is_symlink()
assert hashlib.sha256((receipt_dir / 'cache-inventory.jsonl.gz').read_bytes()).hexdigest() == manifest['inventory_sha256']
rows = [json.loads(line) for line in gzip.open(receipt_dir / 'cache-inventory.jsonl.gz', 'rt')]
expected = {row['path']: row for row in rows}
actual = set()
for move in manifest['moves']:
    source = Path(move['trash_path'])
    destination = Path(move['original_path'])
    assert source == trash / move['relative_path']
    assert destination == repo / move['relative_path']
    assert move['status'] == 'moved' and source.is_dir() and not source.is_symlink()
    assert not os.path.lexists(destination), f'Refusing to overwrite: {destination}'
    assert all(not p.is_symlink() for p in destination.parents if p != Path('/'))
    objects = [source]
    for base, dirs, names in os.walk(source, followlinks=False):
        objects.extend(Path(base) / name for name in dirs + names)
    for path in objects:
        relative = path.relative_to(trash).as_posix()
        actual.add(relative)
        row = expected[relative]
        info = path.lstat()
        assert (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns) == (row['device'], row['inode'], row['bytes'], row['mtime_ns']), f'Metadata changed: {relative}'
        if row['type'] == 'file':
            digest = hashlib.sha256()
            with path.open('rb') as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(chunk)
            assert digest.hexdigest() == row['sha256'], f'Content changed: {relative}'
        elif row['type'] == 'symlink':
            assert os.readlink(path) == row['target']
    print(f'Validated: {source} -> {destination}', flush=True)
assert actual == set(expected)
if args.apply:
    for move in manifest['moves']:
        source = Path(move['trash_path'])
        destination = Path(move['original_path'])
        assert not os.path.lexists(destination), f'Refusing to overwrite: {destination}'
        os.rename(source, destination)
        move['status'] = 'restored'
        (receipt_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    manifest['state'] = 'restored'
    (receipt_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('Restored all eight paths. Empty recovery directories are retained.')
else:
    print(f'PASS: verified {len(actual)} filesystem objects. No restoration performed.')
