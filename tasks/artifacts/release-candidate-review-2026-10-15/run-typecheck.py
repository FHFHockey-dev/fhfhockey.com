from pathlib import Path
import datetime, hashlib, json, subprocess, time
root = Path('/Users/tim/Code/fhfhockey.com')
out = root / 'tasks/artifacts/release-candidate-review-2026-10-15'
manifest = json.loads((out / 'proposed-release-manifest.json').read_text())
checked = [x for x in manifest['files'] if x['sha256']]
def verify():
    return [x['path'] for x in checked if hashlib.sha256((root / x['path']).read_bytes()).hexdigest() != x['sha256']]
assert not verify(), 'Candidate drift before compiler'
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
command = ['/usr/local/bin/node', '--max-old-space-size=8192', 'node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false', '--pretty', 'false']
print('Starting one full-tree no-emit TypeScript pass; candidate files verified.', flush=True)
clock = time.monotonic()
with (out / 'full-tree-typecheck.log').open('wb') as log:
    result = subprocess.run(command, cwd=root / 'web', stdout=log, stderr=subprocess.STDOUT)
receipt = {'startedAtUTC': start, 'finishedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'command': command, 'cwd': str(root / 'web'), 'exitCode': result.returncode, 'elapsedSeconds': round(time.monotonic() - clock, 3), 'candidateManifestSha256AtStart': hashlib.sha256((out / 'proposed-release-manifest.json').read_bytes()).hexdigest(), 'candidateDriftAfter': verify(), 'logSha256': hashlib.sha256((out / 'full-tree-typecheck.log').read_bytes()).hexdigest(), 'scope': 'Full current web checkout, including preserved unrelated dirty source; not an isolated HEAD plus proposed files tree.', 'concurrency': 'Reserved by coordinator; RSO, radar, admin and SSRF owners report no competing full compiler/build. Process-list probe unavailable (sysmond absent).', 'applicationBuild': 'Not run; Next page generation can execute service reads.'}
(out / 'full-tree-typecheck-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2), flush=True)
if result.returncode:
    print((out / 'full-tree-typecheck.log').read_text()[:12000], flush=True)
