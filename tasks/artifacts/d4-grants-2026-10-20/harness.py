"""D4 isolated replay: fresh Unix-socket Homebrew PostgreSQL 17 cluster ONLY.

Replays the canonical migration chain with D4 at orders 89–90, then the later migrations,
with no platform auto-grants. Snapshots effective ACLs and runs the D4 SQL tests.
Never connects over TCP and never reads hosted credentials. Usage:

    python3 -I harness.py <run-id> [<d4-migration-file> ...]   (no files: replay + ACL snapshot only)
    Append --check for hash/order validation only, without creating files or a cluster.
    D4_NEGATIVE=1 skips only 89–90; expected test failures yield passed=false and exit 1.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time

base = Path(__file__).resolve().parent
repo = base.parents[2]
args = sys.argv[1:]
check_only = bool(args and args[-1] == '--check')
if check_only:
    args = args[:-1]
assert args, 'provide a new run id and optionally the exact D4 migration pair'
run_id = args[0]
assert re.fullmatch(r'v[1-9][0-9]*', run_id), 'run id must look like v1'
d4_files = args[1:]
out_dir = base / f'run-{run_id}'
assert not out_dir.exists(), 'preserve prior receipts; use a new run id'
lock = Path('/private/tmp/fhfh-heavy.lock')
binary = Path('/opt/homebrew/opt/postgresql@17/bin')
ledger_path = repo / 'tasks/TASKS/repository-audit-remediation/migration-authority.json'
ledger_bytes = ledger_path.read_bytes()
ledger = json.loads(ledger_bytes)
rows = sorted(ledger['migrations'], key=lambda r: r['order'])
assert [r['order'] for r in rows] == list(range(1, len(rows) + 1)), 'ledger orders must be contiguous'
chain = [repo / row['path'] for row in rows]
assert len(set(chain)) == len(chain), 'ledger paths must be unique'
assert all(p.resolve().parent == repo / 'supabase/migrations' for p in chain), 'canonical migrations only'
expected_d4 = ['20261020224500_data_api_explicit_default_privileges.sql',
               '20261020224600_data_api_reviewed_object_grants.sql']
assert not d4_files or d4_files == expected_d4, 'provide exactly D4 defaults then reviewed grants'
assert [p.name for p in chain[88:90]] == expected_d4, 'D4 must occupy canonical orders 89–90'
d4_paths = [repo / 'supabase/migrations' / name for name in d4_files]
before_chain = chain[:88] if d4_paths else chain
after_chain = chain[90:] if d4_paths else []
assert before_chain + d4_paths + after_chain == chain, 'prefix + D4 + suffix must match ledger order'
negative = os.environ.get('D4_NEGATIVE') == '1'
assert not negative or d4_paths, 'negative control requires the exact D4 pair'
tests = ['data_api_grants.sql', 'data_api_grants_defaults.sql',
         'data_api_grants_rso_isolation.sql', 'data_api_grants_claude.sql']
# Pin the exact bytes before starting a cluster, including concurrent working-tree tests.
sources = {p: p.read_bytes() for p in chain + [base / 'bootstrap.sql', base / 'pgtap-shim.sql',
           base / 'harness.py'] + [repo / 'supabase/tests' / n for n in tests + ['in_season_access_workspace.sql']]}
sources[ledger_path] = ledger_bytes
source_hashes = {str(p.relative_to(repo)): hashlib.sha256(data).hexdigest() for p, data in sources.items()}
for row in rows:
    assert source_hashes[row['path']] == row['sha256'], f"authority hash mismatch: {row['path']}"
replay_order = [r['order'] for r in rows if not negative or r['order'] not in (89, 90)]
if check_only:
    print(json.dumps({'chainFiles': len(chain), 'firstPassOrder': replay_order,
                      'd4Orders': [89, 90] if d4_paths else [],
                      'suffixOrders': [r['order'] for r in rows[90:]] if d4_paths else [],
                      'sourceSha256': source_hashes}, indent=2))
    raise SystemExit(0)

# Extensions the canonical baseline creates that Homebrew PG17 does not ship; bootstrap.sql
# supplies the schema-level stand-ins the chain references.
UNAVAILABLE_EXTENSIONS = ('http', 'pg_cron', 'pg_net', 'pgjwt', 'pgsodium', 'supabase_vault')

# PostgreSQL 17 deparses views differently from the hosted 15.x, so md5(pg_get_viewdef)
# contract guards cannot match here. Each patch must apply exactly once and is receipted.
PG17_PATCHES = {
    '20260731040341_privatize_unified_materialized_views.sql': [(
        "     or pg_catalog.md5(pg_catalog.pg_get_viewdef(relation.oid, true))\n        <> expected.definition_md5",
        "     /* D4 harness (PG17): view-definition md5 guard skipped */",
    )],
}

# Production-data assertions: synthetic scheduler rows inserted just before the file that
# requires them (earlier files take their documented data-free branch on an empty cron.job).
PRE_SQL = {
    '20260909161959_consolidate_duplicate_nst_and_remove_legacy_rolling.sql':
        "INSERT INTO cron.job(jobname, schedule, command) SELECT j, '0 0 1 1 *', 'select 1' FROM "
        "unnest(ARRAY['update-nst-tables-all','update-nst-team-daily','update-rolling-games-recent',"
        "'update-nst-team-daily-incremental']) j;",
}

ACL_SNAPSHOT = r"""
COPY (
  SELECT 'relation' AS kind, c.relkind::text AS subkind, n.nspname || '.' || c.relname AS object,
         coalesce(g.rolname, 'PUBLIC') AS grantee, a.privilege_type
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault(CASE WHEN c.relkind = 'S' THEN 's' ELSE 'r' END::"char", c.relowner))) a
  LEFT JOIN pg_roles g ON g.oid = a.grantee
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')
    AND coalesce(g.rolname, 'PUBLIC') IN ('PUBLIC','anon','authenticated','service_role')
  UNION ALL
  SELECT 'function', p.prokind::text, p.oid::regprocedure::text,
         coalesce(g.rolname, 'PUBLIC'), a.privilege_type
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  LEFT JOIN pg_roles g ON g.oid = a.grantee
  WHERE n.nspname = 'public'
    AND coalesce(g.rolname, 'PUBLIC') IN ('PUBLIC','anon','authenticated','service_role')
  UNION ALL
  SELECT 'default', d.defaclobjtype::text, pg_get_userbyid(d.defaclrole) || ' in ' || coalesce(n.nspname, '<all schemas>'),
         coalesce(g.rolname, 'PUBLIC'), a.privilege_type
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  LEFT JOIN pg_roles g ON g.oid = a.grantee
  ORDER BY 1, 2, 3, 4, 5
) TO STDOUT WITH (FORMAT csv, HEADER)
"""

cluster = Path(tempfile.mkdtemp(prefix='fhfh-d4-', dir='/private/tmp'))
os.chmod(cluster, 0o700)
(cluster / 'socket').mkdir()
port = str(55000 + secrets.randbelow(9000))
env = {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C', 'TMPDIR': str(cluster), 'PGCONNECT_TIMEOUT': '5'}
psql = [str(binary / 'psql'), '-X', '-w', '-q', '-h', str(cluster / 'socket'), '-p', port,
        '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
receipt = {'runId': run_id, 'postgres': None, 'clusterSocketOnly': True, 'chainFiles': len(chain),
           'd4Files': d4_files, 'negativeControl': negative, 'sourceSha256': source_hashes,
           'firstPassOrder': [], 'steps': [], 'tests': {}, 'passed': False}
running = locked = False
out_dir.mkdir()
log = open(out_dir / 'log.txt', 'w')
deadline = time.monotonic() + 300


def run(args, *, stdin=None, timeout=60, check=True, cleanup=False):
    if not cleanup:
        timeout = min(timeout, deadline - time.monotonic())
        if timeout <= 0:
            raise TimeoutError('D4 replay exceeded its 300-second budget')
    started = time.time()
    result = subprocess.run(args, env=env, text=True, input=stdin, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, timeout=timeout)
    log.write(f'$ {" ".join(map(str, args))[:300]}\n{result.stdout}\n[exit {result.returncode}, {time.time() - started:.1f}s]\n')
    log.flush()
    if check and result.returncode:
        raise RuntimeError(f'{args[-1]} failed:\n{result.stdout[-4000:]}')
    return result


def apply_file(path, sql=None):
    run(psql + ['-f', '-'], stdin=sources[path].decode() if sql is None else sql)
    receipt['steps'].append(str(path.relative_to(repo)) if path.is_relative_to(repo) else str(path))


def replay(paths):
    for path in paths:
        sql = sources[path].decode()
        if path.name.startswith('20260716112908_'):
            pattern = r'^(CREATE EXTENSION IF NOT EXISTS "?(%s)"? .*)$' % '|'.join(UNAVAILABLE_EXTENSIONS)
            sql, stripped = re.subn(pattern, r'-- D4 harness: unavailable locally: \1', sql, flags=re.M)
            assert stripped == len(UNAVAILABLE_EXTENSIONS), stripped
        for old, new in PG17_PATCHES.get(path.name, []):
            assert sql.count(old) == 1, (path.name, old)
            sql = sql.replace(old, new)
            receipt.setdefault('pg17Patches', []).append(path.name)
        if path.name in PRE_SQL:
            run(psql + ['-c', PRE_SQL[path.name]])
            receipt.setdefault('preSql', []).append(path.name)
        apply_file(path, sql)
        receipt['firstPassOrder'].append(chain.index(path) + 1)


try:
    # Do not wait on or remove another worker's lock.
    lock.mkdir()
    locked = True
    run([str(binary / 'initdb'), '-D', str(cluster / 'data'), '-U', 'postgres', '-A', 'trust',
         '--no-locale', '-E', 'UTF8'])
    running = True  # Even a failed startup must go through the owned-cluster shutdown check.
    run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-l', str(cluster / 'server.log'),
         '-o', f"-F -k {cluster / 'socket'} -c listen_addresses='' -p {port}", '-w', '-t', '20', 'start'])
    receipt['postgres'] = run(psql + ['-tAc', 'SHOW server_version']).stdout.strip()
    apply_file(base / 'bootstrap.sql')
    replay(before_chain)
    (out_dir / 'acl-before.csv').write_text(run(psql + ['-c', ACL_SNAPSHOT]).stdout)
    if not d4_paths:
        assert receipt['firstPassOrder'] == replay_order, 'first pass diverged from ledger order'
        receipt['passed'] = True
        raise SystemExit

    replay([] if negative else d4_paths)
    (out_dir / 'acl-after-d4.csv').write_text(run(psql + ['-c', ACL_SNAPSHOT]).stdout)
    replay(after_chain)
    assert receipt['firstPassOrder'] == replay_order, 'first pass diverged from ledger order'
    (out_dir / 'acl-after.csv').write_text(run(psql + ['-c', ACL_SNAPSHOT]).stdout)
    # Re-applying must be harmless (grants/revokes are idempotent).
    for path in ([] if negative else d4_paths):
        apply_file(path)
    rerun = run(psql + ['-c', ACL_SNAPSHOT]).stdout
    (out_dir / 'acl-after-reapply.csv').write_text(rerun)
    receipt['idempotentReapply'] = rerun == (out_dir / 'acl-after.csv').read_text()

    apply_file(base / 'pgtap-shim.sql')

    all_ok = True
    for name in tests:
        result = run(psql + ['-tA', '-f', '-'], stdin=sources[repo / 'supabase/tests' / name].decode(), check=False)
        lines = result.stdout.splitlines()
        oks = [l for l in lines if re.match(r'^ok \d+', l)]
        bad = [l for l in lines if re.match(r'^not ok \d+', l)]
        plan = [l for l in lines if re.match(r'^1\.\.\d+$', l)]
        complete = result.returncode == 0 and len(plan) == 1 and int(plan[0][3:]) == len(oks) + len(bad)
        good = complete and not bad and not any(l.startswith('Bail out!') for l in lines)
        all_ok &= good
        receipt['tests'][name] = {'exit': result.returncode, 'ok': len(oks), 'notOk': bad,
                                  'notOkCount': len(bad), 'complete': complete,
                                  'plan': plan[-1] if plan else None, 'passed': good}
        (out_dir / f'{name}.tap').write_text(result.stdout)
    # Pre-existing raise-on-failure fixture remains part of the overall gate.
    for name in ['in_season_access_workspace.sql']:
        result = run(psql + ['-f', '-'], stdin=sources[repo / 'supabase/tests' / name].decode(), check=False)
        receipt['tests'][name] = {'exit': result.returncode, 'tail': result.stdout[-600:]}
        all_ok &= result.returncode == 0
    receipt['passed'] = all_ok and receipt['idempotentReapply']
except SystemExit:
    pass
except Exception as error:  # keep the receipt honest
    receipt['error'] = str(error)[-4000:]
finally:
    stopped = not running
    try:
        if running:
            stop = run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-m', 'fast', '-w', '-t', '20', 'stop'],
                       timeout=30, check=False, cleanup=True)
            stopped = stop.returncode == 0
            if not stopped:
                status = run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), 'status'],
                             timeout=10, check=False, cleanup=True)
                stopped = status.returncode == 3
    except Exception as error:
        receipt['cleanupError'] = str(error)[-1000:]
    receipt['clusterStopped'] = stopped
    if (cluster / 'server.log').exists():
        shutil.copy(cluster / 'server.log', out_dir / 'server.log')
    if stopped:
        shutil.rmtree(cluster)
    else:
        receipt['passed'] = False
        receipt['retainedCluster'] = str(cluster)
    receipt['clusterRemoved'] = not cluster.exists()
    if locked and stopped:
        lock.rmdir()
    log.close()
    (out_dir / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({k: receipt[k] for k in ('runId', 'postgres', 'passed', 'tests')} | {'error': receipt.get('error')}, indent=1))
sys.exit(0 if receipt['passed'] else 1)
