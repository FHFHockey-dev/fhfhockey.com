# Safe offline verification recipe

These are **future verification commands**, not new passing receipts. Reconciliation reused the prior runs because the 3,562 source hashes still matched. Do not run tests directly in the canonical checkout: ignored local env files and unmocked imports can reach real services. No installation, server, build, migration, provider request or production call is needed.

## 1. Stage a pinned local copy

Use Node **22.11.0** and npm (the current Mac has Node 22.11.0/npm 10.9.0). Run from the canonical repository. This recipe copies current tracked/untracked source files, excludes env/credential files and generated directories, checks for source/HEAD drift, reuses installed dependencies, and installs only the preserved synthetic tests in a fresh `/tmp` tree. It never writes application files in the canonical checkout. The extra directory nesting keeps the tested relative dotenv fallbacks inside the fresh private tree.

```sh
task_queue_root='/Users/tim/Code/fhfhockey.com/tasks/artifacts/claude-audit-fix-queue-2026-10-22'
task_snapshot_dir=$(python3 - "$task_queue_root" <<'PY'
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
PY
)
cd "$task_snapshot_dir"
node --version

audit_test() {
  env -i \
    PATH=/usr/local/bin:/usr/bin:/bin \
    HOME="$task_snapshot_dir/.audit-home" \
    TMPDIR="$task_snapshot_dir/.audit-tmp" \
    NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
    NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
    SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
    NODE_OPTIONS="--require $task_snapshot_dir/audit-network-deny.cjs" \
    npm test -- --run --config audit.vitest.config.mts "$@"
}
```

Stop if snapshot staging fails or the Node version differs. The preload denies sockets/HTTP(S); setup denies unmocked fetch. A request blocked by those guards must be diagnosed/mocked, never allowed through. The current check commands are listed per packet in [QUEUE.md](QUEUE.md); run only the relevant packet, not every command by default.

## 2. Demonstrate the current defects, then check a real fix

One bounded reproduction command for the nine original synthetic assertions:

```sh
audit_test lib/auditTemporalCutoff.test.ts lib/auditEdgecases.test.ts lib/auditStatsAsync.test.tsx
```

On the reconciled bytes this is expected to fail **nine** assertions: temporal cutoff, exact-game bridge, ledger completeness, ledger coverage, Yahoo null points, late lease, unpaired stats, incomplete goalie pages, and stale Shot Map completion. The original pass ran these as smaller focused invocations; [evidence/](evidence/) preserves the actual receipts.

A10's four existing provider-route assertions:

```sh
audit_test lib/integrations/yahoo/rosterPlanning.test.ts -t 'provider snapshot route'
```

Expected current failures are 503 instead of 429/502/403 and false instead of true success, due to stale entitlement mocks. This is a failed verification seam, not evidence of an authorization bypass. Central access/paywall tests remain separate checks.

After an authorized implementation, stage its **new** pinned copy and run that packet's reproduction plus nearest tests. The reviewer must verify behavior/outputs and the exact diff. If a legitimate approved data contract changes an original assertion's oracle, document the new oracle and coverage; do not silently weaken/remove the assertion. Do not copy an implementer's unexamined success claim into acceptance.

No type-check/lint/build was run for this document-only queue. When actual TS fixes are implemented, run the smallest relevant test first, then focused lint/type checks as justified, in the isolated copy. Do not use production or remote builds as acceptance tests. Never load env files, regenerate dependencies/types, or use GIT_DIR.
