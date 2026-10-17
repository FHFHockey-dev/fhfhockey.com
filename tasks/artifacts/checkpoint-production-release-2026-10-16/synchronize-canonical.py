"""Apply the reviewed local branch synchronization after the remote release exists."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path('/Users/tim/Code/fhfhockey.com')
OUT = ROOT / 'tasks/artifacts/checkpoint-production-release-2026-10-16'
RELEASE = '457435eb3010c5b3dd92d2e1a46d9c75d851780a'
BASE = '90d3d5963f47dccfe690d5582dae3d23a598e16d'
OCTOBER = 'a8f58de6178e282acd3a71851c66f4a56b119f14'
SYNC = 'f08e59095260a35405f5eb121b497a4b2bfffce7'
assert sys.argv[1:] == ['--apply-after-release', RELEASE]

def git(*args, input=None, env=None):
    return subprocess.check_output(['git', *args], cwd=ROOT, input=input, env=env)

def text(*args):
    return git(*args).decode().strip()

def digest(path):
    value = ROOT / path
    return hashlib.sha256(value.read_bytes()).hexdigest() if value.is_file() else None

assert text('branch', '--show-current') == 'octoberBranch'
assert text('rev-parse', 'HEAD') == OCTOBER
assert text('rev-parse', 'master') == BASE
assert not text('diff', '--cached', '--name-only')
assert text('show', '-s', '--format=%P', SYNC).split() == [OCTOBER, RELEASE]
remote = text('ls-remote', 'origin', 'refs/heads/master').split()[0]
assert remote == RELEASE, 'Remote master must already be the exact reviewed release'
manifest = json.loads((OUT / 'proposed-release-manifest-v4.json').read_text())
fixtures = [row for row in manifest['files'] if row['increment'] == 'admin-auth-route-fixtures']
for row in fixtures:
    assert digest(row['path']) == row['headSha256'], row['path']

paths = set(git('diff', '--name-only', '--no-renames', '-z', 'HEAD').decode().split('\0'))
paths.update(git('ls-files', '--others', '--exclude-standard', '-z', 'web').decode().split('\0'))
paths = sorted(path for path in paths if path and not Path(path).name.startswith('.env'))
before = {path: digest(path) for path in paths}
(OUT / 'canonical-preservation-before.json').write_text(json.dumps(before, indent=2) + '\n')
gitdir = Path(text('rev-parse', '--absolute-git-dir'))
for state in ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'index.lock']:
    assert not (gitdir / state).exists(), state
index = Path('/tmp/fhf-release-checkpoint-20261016-0424/canonical-sync.index')
assert not index.exists()
environment = dict(os.environ, GIT_INDEX_FILE=str(index))
git('read-tree', SYNC, env=environment)
patch = OUT / 'canonical-auth-fixtures.patch'
assert hashlib.sha256(patch.read_bytes()).hexdigest() == '1f430e25ae12ed79081bacd7a69a9dfba221e1ba063552ecf595142dd2d8a0e5'
git('apply', '--check', '--whitespace=error-all', str(patch))
original_index = (gitdir / 'index').read_bytes()
original_index_sha = hashlib.sha256(original_index).hexdigest()
backup = OUT / ('canonical-sync-backup-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
backup.mkdir()
(backup / 'original.index').write_bytes(original_index)
for row in fixtures:
    target = backup / row['path']
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes((ROOT / row['path']).read_bytes())
journal = {'status': 'prepared', 'backup': str(backup), 'originalIndexSha256': original_index_sha,
           'oldMaster': BASE, 'oldOctober': OCTOBER, 'release': RELEASE, 'sync': SYNC,
           'preparedIndex': str(index), 'scriptExecutionAuthorizedByScout': 'must be confirmed before invocation'}
(backup / 'journal.json').write_text(json.dumps(journal, indent=2) + '\n')
lock = gitdir / 'index.lock'
own_lock = False
try:
    with lock.open('xb') as handle:
        own_lock = True
        assert hashlib.sha256((gitdir / 'index').read_bytes()).hexdigest() == original_index_sha
        for row in fixtures:
            assert digest(row['path']) == row['headSha256'], row['path']
        handle.write(index.read_bytes())
        handle.flush()
        os.fsync(handle.fileno())
    git('apply', '--whitespace=error-all', str(patch))
    for row in fixtures:
        assert digest(row['path']) == row['sha256'], row['path']
    transaction = f'start\nupdate refs/heads/master {RELEASE} {BASE}\nupdate refs/heads/octoberBranch {SYNC} {OCTOBER}\nprepare\ncommit\n'
    git('update-ref', '--stdin', input=transaction.encode())
    os.replace(lock, gitdir / 'index')
    own_lock = False
    journal['status'] = 'refs-and-index-updated'
except BaseException as error:
    journal.update({'status': 'stopped-inspect-before-any-retry', 'error': str(error),
                    'observedMaster': text('rev-parse', 'master'), 'observedOctober': text('rev-parse', 'octoberBranch')})
    # Ref and index replacement are separate operations. Preserve our prepared lock
    # if refs advanced so a reviewer can complete the index replacement safely.
    keep_lock = journal['observedMaster'] == RELEASE or journal['observedOctober'] == SYNC
    journal['preparedLockPreservedForRecovery'] = own_lock and lock.exists() and keep_lock
    if own_lock and lock.exists() and not keep_lock:
        lock.unlink()
    (backup / 'journal.json').write_text(json.dumps(journal, indent=2) + '\n')
    raise
fixture_paths = {row['path'] for row in fixtures}
after = {path: digest(path) for path in paths}
drift = [path for path in paths if path not in fixture_paths and before[path] != after[path]]
assert text('rev-parse', 'HEAD') == SYNC
assert text('rev-parse', 'master') == RELEASE
assert not text('diff', '--cached', '--name-only')
result = {'releasedMaster': RELEASE, 'octoberSync': SYNC,
          'originalIndexBackup': str(backup / 'original.index'), 'fixtureBackups': str(backup / 'web'),
          'preservedPathsChecked': len(paths) - len(fixture_paths),
          'unrelatedWorkingByteDrift': drift,
          'intentionalFixtureUpdates': sorted(fixture_paths),
          'sharedIndexClean': True, 'resetStashForcePushOrCheckoutUsed': False,
          'remoteOctoberChanged': False}
(OUT / 'canonical-synchronization-result.json').write_text(json.dumps(result, indent=2) + '\n')
journal['status'] = 'verified' if not drift else 'unrelated-drift-observed-inspect-without-overwriting'
(backup / 'journal.json').write_text(json.dumps(journal, indent=2) + '\n')
print(json.dumps(result))
assert not drift, 'Concurrent or unexpected working-byte drift recorded; inspect without overwriting'
