"""D4 replay, 2026-10-23: the 99-entry chain on a fresh disposable Homebrew PostgreSQL 17 cluster ONLY.

Derived from ../harness.py: the same authority validation (contiguous orders, unique canonical paths,
every SHA-256, D4 at orders 89-90), bootstrap, extension stand-ins, PG17 view-md5 patch, cron seed,
ACL snapshot and TAP parsing. Differences: four replay modes, the data directory lives under a
caller-given scratch root, the Unix socket lives in a short private /private/tmp directory (macOS
socket paths are limited to 103 bytes), receipts go to ./run-<mode>/, replay-checks.sql runs after
the four D4 suites, and the runbook's read-only hosted-preflight.sql / hosted-postcheck.sql are
exercised locally. Never connects over TCP and never reads hosted credentials.

    python3 -I replay.py <mode> <scratch-root> [--check]

    positive    1-88, 89, 90, 91-99, then 89-90 re-applied (idempotence)
    negative    1-88, 91-99 (89-90 omitted); D4 assertions must fail
    reversed    1-88, 90, 89, 91-99
    after-head  1-88, 91-99, 89, 90 (the hosted order: 91-99 are already in the hosted ledger)

--check validates hashes and prints the plan without creating files or a cluster.
Exit 0 means the mode's expectation was met (for negative: the D4 assertions failed as intended).
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
d4_dir = base.parent
repo = base.parents[3]
MODES = ('positive', 'negative', 'reversed', 'after-head')
args = sys.argv[1:]
check_only = bool(args) and args[-1] == '--check'
if check_only:
    args = args[:-1]
assert len(args) == 2 and args[0] in MODES, 'usage: replay.py <positive|negative|reversed|after-head> <scratch-root> [--check]'
mode, scratch_root = args[0], Path(args[1]).resolve()
assert scratch_root.is_dir() and not scratch_root.is_relative_to(repo), 'scratch root must exist outside the repository'
out_dir = base / f'run-{mode}'
assert not out_dir.exists(), 'preserve prior receipts; use a fresh output directory'
lock = Path('/private/tmp/fhfh-heavy.lock')
binary = Path('/opt/homebrew/opt/postgresql@17/bin')
ledger_path = repo / 'tasks/TASKS/repository-audit-remediation/migration-authority.json'
ledger_bytes = ledger_path.read_bytes()
ledger = json.loads(ledger_bytes)
rows = sorted(ledger['migrations'], key=lambda r: r['order'])
assert [r['order'] for r in rows] == list(range(1, len(rows) + 1)), 'ledger orders must be contiguous'
assert len(rows) == 99, f'expected the 99-entry chain, found {len(rows)}'
chain = [repo / row['path'] for row in rows]
assert len(set(chain)) == len(chain), 'ledger paths must be unique'
assert all(p.resolve().parent == repo / 'supabase/migrations' for p in chain), 'canonical migrations only'
assert sorted(p.name for p in (repo / 'supabase/migrations').glob('*.sql')) == [p.name for p in chain], \
    'working-tree migrations must equal the authority chain'
assert [p.name for p in chain[88:90]] == ['20261020224500_data_api_explicit_default_privileges.sql',
                                          '20261020224600_data_api_reviewed_object_grants.sql'], \
    'D4 must occupy canonical orders 89-90'
D4 = (89, 90)
prefix, suffix = list(range(1, 89)), list(range(91, len(rows) + 1))
plan = {'positive': prefix + [89, 90] + suffix,
        'negative': prefix + suffix,
        'reversed': prefix + [90, 89] + suffix,
        'after-head': prefix + suffix + [89, 90]}[mode]
tests = ['data_api_grants.sql', 'data_api_grants_defaults.sql',
         'data_api_grants_rso_isolation.sql', 'data_api_grants_claude.sql']
test_paths = [repo / 'supabase/tests' / n for n in tests] + [base / 'replay-checks.sql']
fixture = repo / 'supabase/tests/in_season_access_workspace.sql'
hosted_sql = [base / 'hosted-preflight.sql', base / 'hosted-postcheck.sql']
# Pin the exact bytes before starting a cluster.
sources = {p: p.read_bytes() for p in chain + [d4_dir / 'bootstrap.sql', d4_dir / 'pgtap-shim.sql',
           d4_dir / 'harness.py', base / 'replay.py', base / 'make_hosted_sql.py', fixture]
           + test_paths + hosted_sql}
sources[ledger_path] = ledger_bytes
source_hashes = {str(p.relative_to(repo)): hashlib.sha256(data).hexdigest() for p, data in sources.items()}
for row in rows:
    assert source_hashes[row['path']] == row['sha256'], f"authority hash mismatch: {row['path']}"
if check_only:
    print(json.dumps({'mode': mode, 'chainFiles': len(chain), 'plan': plan,
                      'sourceSha256': source_hashes}, indent=2))
    raise SystemExit(0)

UNAVAILABLE_EXTENSIONS = ('http', 'pg_cron', 'pg_net', 'pgjwt', 'pgsodium', 'supabase_vault')
PG17_PATCHES = {
    '20260731040341_privatize_unified_materialized_views.sql': [(
        "     or pg_catalog.md5(pg_catalog.pg_get_viewdef(relation.oid, true))\n        <> expected.definition_md5",
        "     /* D4 harness (PG17): view-definition md5 guard skipped */",
    )],
}
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

cluster = Path(tempfile.mkdtemp(prefix=f'fhfh-d4-{mode}-', dir=scratch_root))
socket_dir = Path(tempfile.mkdtemp(prefix='fhfh-d4s-', dir='/private/tmp'))
os.chmod(cluster, 0o700)
os.chmod(socket_dir, 0o700)
port = str(55000 + secrets.randbelow(9000))
env = {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C', 'TMPDIR': str(cluster), 'PGCONNECT_TIMEOUT': '5'}
psql = [str(binary / 'psql'), '-X', '-w', '-q', '-h', str(socket_dir), '-p', port,
        '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
receipt = {'mode': mode, 'postgres': None, 'clusterSocketOnly': True, 'port': int(port),
           'clusterDir': str(cluster), 'socketDir': str(socket_dir), 'chainFiles': len(chain),
           'plan': plan, 'sourceSha256': source_hashes, 'appliedOrder': [], 'steps': [], 'tests': {},
           'passed': False, 'expectationMet': False}
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
    receipt['steps'].append(str(path.relative_to(repo)))


def replay(order):
    path = chain[order - 1]
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
    receipt['appliedOrder'].append(order)


def snapshot(name):
    text = run(psql + ['-c', ACL_SNAPSHOT]).stdout
    (out_dir / name).write_text(text)
    return text


def tap(name, sql):
    result = run(psql + ['-tA', '-f', '-'], stdin=sql, check=False)
    lines = result.stdout.splitlines()
    oks = [l for l in lines if re.match(r'^ok \d+', l)]
    bad = [l for l in lines if re.match(r'^not ok \d+', l)]
    plan_lines = [l for l in lines if re.match(r'^1\.\.\d+$', l)]
    complete = result.returncode == 0 and len(plan_lines) == 1 and int(plan_lines[0][3:]) == len(oks) + len(bad)
    good = complete and not bad and not any(l.startswith('Bail out!') for l in lines)
    receipt['tests'][name] = {'exit': result.returncode, 'ok': len(oks), 'notOkCount': len(bad), 'notOk': bad,
                              'complete': complete, 'plan': plan_lines[-1] if plan_lines else None, 'passed': good}
    (out_dir / f'{name}.tap').write_text(result.stdout)
    return receipt['tests'][name]


try:
    lock.mkdir()  # fail rather than wait on or remove another worker's lock
    locked = True
    run([str(binary / 'initdb'), '-D', str(cluster / 'data'), '-U', 'postgres', '-A', 'trust',
         '--no-locale', '-E', 'UTF8'])
    running = True
    run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-l', str(cluster / 'server.log'),
         '-o', f"-F -k {socket_dir} -c listen_addresses='' -p {port}", '-w', '-t', '20', 'start'])
    receipt['postgres'] = run(psql + ['-tAc', 'SHOW server_version']).stdout.strip()
    receipt['listenAddresses'] = run(psql + ['-tAc', 'SHOW listen_addresses']).stdout.strip()
    apply_file(d4_dir / 'bootstrap.sql')
    for order in plan:
        if order in D4 and not (out_dir / 'acl-before-d4.csv').exists():
            snapshot('acl-before-d4.csv')
        replay(order)
    assert receipt['appliedOrder'] == plan, 'applied order diverged from the plan'
    final = snapshot('acl-final.csv')
    if mode == 'positive':
        for order in D4:
            apply_file(chain[order - 1])
        receipt['idempotentReapply'] = snapshot('acl-after-reapply.csv') == final

    apply_file(d4_dir / 'pgtap-shim.sql')
    for path in test_paths:
        tap(path.name, sources[path].decode())
    result = run(psql + ['-f', '-'], stdin=sources[fixture].decode(), check=False)
    receipt['tests'][fixture.name] = {'exit': result.returncode, 'tail': result.stdout[-600:]}

    # Runbook SQL: run each labelled read-only statement (P1-P5, Q1-Q3) and keep its rows.
    hosted = {}
    for path in hosted_sql:
        parts = re.split(r'^-- ([PQ]\d)\. .*$', sources[path].decode(), flags=re.M)
        for label, sql in zip(parts[1::2], parts[2::2]):
            hosted[label] = [l for l in run(psql + ['-tA', '-F', '|', '-c', sql]).stdout.splitlines() if l.strip()]
    (out_dir / 'hosted-sql-local.json').write_text(json.dumps(hosted, indent=1) + '\n')
    summary = {'P2_missingObjects': len(hosted['P2']), 'P4_rows': len(hosted['P4']), 'Q1_rows': len(hosted['Q1']),
               'Q2': hosted['Q2'], 'Q3_mismatches': len(hosted['Q3'])}
    receipt['hostedSqlLocal'] = summary
    if mode == 'negative':
        hosted_ok = summary['P2_missingObjects'] == 0 and summary['Q1_rows'] > 0 and summary['Q3_mismatches'] > 0
    else:
        hosted_ok = (summary['P2_missingObjects'] == 0 and summary['Q1_rows'] == 0 and len(summary['Q2']) == 1
                     and summary['Q2'][0].endswith('|f') and summary['Q3_mismatches'] == 0)
    receipt['hostedSqlExpectationMet'] = hosted_ok

    suites = [p.name for p in test_paths]
    all_green = all(receipt['tests'][n]['passed'] for n in suites) and receipt['tests'][fixture.name]['exit'] == 0
    receipt['passed'] = all_green and receipt.get('idempotentReapply', True) and hosted_ok
    if mode == 'negative':
        # Every suite must run to completion, and the D4 assertions must fail without 89-90.
        must_fail = ['data_api_grants.sql', 'data_api_grants_defaults.sql', 'data_api_grants_claude.sql',
                     'replay-checks.sql']
        receipt['expectationMet'] = (all(receipt['tests'][n]['complete'] for n in suites)
                                     and all(receipt['tests'][n]['notOkCount'] > 0 for n in must_fail) and hosted_ok)
    else:
        receipt['expectationMet'] = receipt['passed']
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
        shutil.rmtree(socket_dir)
    else:
        receipt['expectationMet'] = receipt['passed'] = False
        receipt['retainedCluster'] = str(cluster)
    receipt['clusterRemoved'] = not cluster.exists() and not socket_dir.exists()
    if locked and stopped:
        lock.rmdir()
    log.close()
    (out_dir / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({k: receipt.get(k) for k in ('mode', 'postgres', 'passed', 'expectationMet', 'idempotentReapply',
                                                  'hostedSqlLocal', 'clusterStopped', 'clusterRemoved', 'error')}
                     | {'tests': {n: (t.get('ok'), t.get('notOkCount'), t.get('exit')) for n, t in receipt['tests'].items()}},
                     indent=1))
sys.exit(0 if receipt['expectationMet'] else 1)
