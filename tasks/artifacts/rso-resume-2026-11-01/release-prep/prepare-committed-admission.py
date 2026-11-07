"""Prepare an admission patch only from the exact, already-created RSO candidate commit.

Default: read-only identity check. --prepare runs the existing offline verifier and
writes a receipt/proposed patch under this artifact folder. Never edits canonical
source, the Git index, objects or refs, and never pushes/builds/deploys.
"""
from pathlib import Path
import argparse
import difflib
import hashlib
import json
import os
import re
import subprocess
import uuid


def sha256(content):
    return hashlib.sha256(content).hexdigest()


def validate_candidate_selection(manifest, required, custody):
    """Reject stale or partially updated preparation records after any release."""
    if not custody.get('candidateBaseStatus', '').startswith('SELECTED_'):
        raise ValueError('Candidate base is not selected; reconcile the latest release before admission preparation')
    proposal = custody.get('replacementProposal', {})
    tree = manifest.get('candidateTree')
    base = manifest.get('selectedCommittedBase')
    if (not tree or not base or required.get('candidateTree') != tree or
            custody.get('candidateTree') != tree or proposal.get('candidateTree') != tree or
            required.get('selectedBase') != base or proposal.get('base') != base):
        raise ValueError('Candidate selection records disagree; reconcile the manifest, admission requirements and custody request')


def propose_admission(source, test, entry):
    """Render proposed files; this pure step does not create or qualify a receipt."""
    closure, commit = entry['closureSha256'], entry['commit']
    anchor = '\n];\n\nconst FULL_SHA'
    if source.count(anchor) != 1 or closure in source:
        raise ValueError('Unexpected admission list shape or already-listed closure')
    entry_text = '  {\n' + ''.join(f'    {key}: {json.dumps(value)},\n' for key, value in entry.items()) + '  },\n'
    proposed_source = source.replace(anchor, '\n' + entry_text + '];\n\nconst FULL_SHA')
    previous_row = '      ["bf23edfea5b5c9301fcedd2b5c3fa86016ceecd86d1d2d49c0a6d6c687e7ab3b", "eff1b377ae8c831705710758979cc67e9d38846b"],\n'
    if test.count(previous_row) != 1:
        raise ValueError('Unexpected admission test shape; review before proposing a patch')
    proposed_test = test.replace(previous_row, previous_row + f'      ["{closure}", "{commit}"],\n')
    return proposed_source, proposed_test


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--prepare', action='store_true')
    args = parser.parse_args()
    out = Path(__file__).resolve().parent
    root = out.parents[3]
    manifest = json.loads((out / 'CANDIDATE.json').read_text())
    required = json.loads((out / 'ADMISSION-REQUIREMENTS.json').read_text())
    custody = json.loads((out / 'CUSTODY-REQUEST-STATUS.json').read_text())
    validate_candidate_selection(manifest, required, custody)

    def git(*arguments):
        env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
        return subprocess.check_output(['git', *arguments], cwd=root, env=env)

    commit = args.commit
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('A full lowercase 40-character committed SHA is required')
    if git('rev-parse', '--verify', commit + '^{commit}').decode().strip() != commit:
        raise ValueError('The SHA is not a commit in the canonical repository')
    tree = git('rev-parse', commit + '^{tree}').decode().strip()
    if tree != manifest['candidateTree']:
        raise ValueError(f'Wrong candidate tree: observed {tree}; expected {manifest["candidateTree"]}. Do not substitute HEAD or a tree-only receipt.')
    for item in manifest['overlayFiles']:
        if sha256(git('show', commit + ':' + item['path'])) != item['sha256']:
            raise ValueError('Committed source pin mismatch: ' + item['path'])
    for path, key in [('web/scripts/verify-forge-release-sha.ts', 'verifierSha256'),
                      ('web/scripts/forge-producer-closure.ts', 'closureWalkerSha256')]:
        if sha256((root / path).read_bytes()) != required[key]:
            raise ValueError('Verifier changed; re-review before proceeding: ' + path)

    result = {'commit': commit, 'tree': tree, 'sourcePinsMatched': len(manifest['overlayFiles']),
              'expectedClosureSha256': required['expectedClosureSha256'], 'prepared': False}
    if not args.prepare:
        print(json.dumps(result, indent=2))
        return

    destination = out / 'admission' / commit
    verifier_export = Path('/private/tmp/forge-release-verify-' + commit)
    if destination.exists() or verifier_export.exists():
        raise ValueError('Existing receipt/export must be reconciled by its owner; nothing overwritten')
    lock = Path('/private/tmp/fhfh-heavy.lock')
    lock.mkdir()  # An occupied shared heavy slot stops preparation.
    inode = lock.stat().st_ino
    token = str(uuid.uuid4())
    (lock / 'owner.json').write_text(json.dumps({'owner': 'RSO committed admission preparation',
        'thread': '01a19764-091f-763d-a983-8c692d79200b', 'pid': os.getpid(), 'token': token}))
    try:
        destination.mkdir(parents=True)
        receipt_path = destination / 'receipt.json'
        env = {'PATH': '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
               'HOME': os.environ['HOME'], 'TMPDIR': os.environ.get('TMPDIR', '/tmp'),
               'NODE_PATH': str(root / 'web'),
               'NODE_OPTIONS': '--require ' + str(out / 'loopback-only.cjs')}
        command = ['node', 'node_modules/ts-node/dist/bin.js', '--transpile-only',
            '--compiler-options', '{"module":"commonjs","moduleResolution":"node"}',
            'scripts/verify-forge-release-sha.ts', commit, '--receipt', str(receipt_path)]
        with (destination / 'verifier.log').open('w') as log:
            subprocess.run(command, cwd=root / 'web', env=env, stdout=log,
                           stderr=subprocess.STDOUT, check=True, timeout=120)
        receipt_bytes = receipt_path.read_bytes()
        receipt = json.loads(receipt_bytes)
        expected = {'sha': commit, 'verified': True, 'findings': [],
                    'verifierSha256': required['verifierSha256'],
                    'closureWalkerSha256': required['closureWalkerSha256']}
        if any(receipt.get(k) != v for k, v in expected.items()) or 'source' in receipt:
            raise ValueError('Receipt is not the expected committed, passing verification')
        closure = required['expectedClosureSha256']
        if (receipt['commit']['tree'] != tree or
                receipt['producerIdentity']['closureSha256'] != closure or
                receipt['closure']['modulesSha256'] != closure or
                receipt['closure']['moduleCount'] != required['moduleCount']):
            raise ValueError('Committed receipt tree/closure/module count mismatch')
        entry = {'closureSha256': closure, 'commit': commit,
                 'receipt': str(receipt_path.relative_to(root)),
                 'receiptSha256': sha256(receipt_bytes), 'verifierVersion': receipt['version'],
                 'note': f'RSO issued-method lineage and retained participation replay, commit {commit[:9]}: 195-module closure, 0 findings.'}
        paths = ['web/lib/projections/verifiedForgeReleases.ts',
                 'web/lib/projections/verifiedForgeReleases.test.ts']
        source, test = [git('show', manifest['selectedCommittedBase'] + ':' + path).decode() for path in paths]
        for path, original in zip(paths, [source, test]):
            if (root / path).read_text() != original:
                raise ValueError('Admission source drift; coordinate before proposing a patch: ' + path)
        proposed_source, proposed_test = propose_admission(source, test, entry)
        patch = ''
        for path, original, proposed in zip(paths, [source, test], [proposed_source, proposed_test]):
            (destination / Path(path).name).write_text(proposed)
            patch += ''.join(difflib.unified_diff(original.splitlines(keepends=True),
                proposed.splitlines(keepends=True), fromfile='a/' + path, tofile='b/' + path))
        (destination / 'admission.patch').write_text(patch)
        (destination / 'entry.json').write_text(json.dumps(entry, indent=2) + '\n')
        result.update(prepared=True, entry=entry, canonicalSourceChanged=False,
                      runtimeAdmissionTests='pending isolated test of proposed files', gitMutations=0)
        (destination / 'PREPARED.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result, indent=2))
    finally:
        if lock.stat().st_ino == inode and json.loads((lock / 'owner.json').read_text())['token'] == token:
            (lock / 'owner.json').unlink()
            lock.rmdir()


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        raise SystemExit(str(error))
