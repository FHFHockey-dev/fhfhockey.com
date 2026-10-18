"""Prove the private token-vault restore against a fresh, socket-only PostgreSQL 17.

Two databases share one disposable cluster:
- ledger: connected_accounts plus the archived production-ledger statements that
  built the private vault (the state production is expected to hold);
- fresh:  connected_accounts plus the baseline public wrappers only (a fresh
  replay of the active chain), then the new migration.
The catalog of the private vault must match between them, a second apply on the
ledger database must change nothing, and the wrappers must work end to end on a
stub Vault. Nothing here connects to a hosted database.
"""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile

base = Path(__file__).resolve().parent
repo = base.parents[2]
run_id = sys.argv[1] if len(sys.argv) > 1 else 'v1'
assert re.fullmatch(r'v[1-9][0-9]*', run_id)
output = base / f'token-vault-pg-result-{run_id}.json'
assert not output.exists(), 'Preserve prior receipts; use a new run ID.'
baseline_path = repo / 'supabase/migrations/20260716112908_production_schema_baseline.sql'
migration_path = repo / 'supabase/migrations/20261018190022_restore_private_token_vault.sql'
ledger_dir = repo / 'supabase/migration-archive/pre-baseline-20260716/production-ledger'
ledger_files = {
    'platform': ledger_dir / '20260713055508_auth_user_settings_platform_baseline.sql',
    'vault': ledger_dir / '20260713055537_encrypt_connected_account_tokens_with_vault.sql',
    'rpc': ledger_dir / '20260713055538_expose_connected_account_token_rpc.sql',
    'harden': ledger_dir / '20260713060931_harden_auth_provider_ownership_and_refresh_tokens.sql',
}
binary = Path('/opt/homebrew/opt/postgresql@17/bin')
cluster = Path(tempfile.mkdtemp(prefix='fhfh-tv-', dir='/private/tmp'))
os.chmod(cluster, 0o700)
(cluster / 'socket').mkdir()
port = str(55000 + secrets.randbelow(9000))
environment = {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C', 'TMPDIR': str(cluster)}

USER_A = '00000000-0000-4000-8000-00000000000a'
USER_B = '00000000-0000-4000-8000-00000000000b'
ACCOUNT_A = '10000000-0000-4000-8000-00000000000a'
ACCOUNT_A2 = '10000000-0000-4000-8000-0000000000a2'
cases = []
running = False


def run(command, check=True):
    result = subprocess.run(command, env=environment, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(f'{command[0]} failed: {result.stderr.strip()}')
    return result


def psql(db):
    return [str(binary / 'psql'), '-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
            '-h', str(cluster / 'socket'), '-p', port, '-U', 'fixture', '-d', db]


def sql(db, statement):
    return run(psql(db) + ['-c', statement]).stdout.strip()


def as_role(db, role, statement):
    return run(psql(db) + ['-c', f'set role {role}; {statement}'], check=False)


def sqlstate(result):
    match = re.search(r'ERROR:\s+([0-9A-Z]{5}):', result.stderr)
    return match.group(1) if match else None


def record(name, expected, observed):
    cases.append({'case': name, 'expected': expected, 'observed': observed, 'passed': observed == expected})


def expect_ok(db, name, role, statement, expected):
    result = as_role(db, role, statement)
    lines = result.stdout.strip().splitlines()
    record(name, expected, (lines[-1] if lines else '') if result.returncode == 0 else sqlstate(result))


def expect_error(db, name, role, statement, code):
    result = as_role(db, role, statement)
    record(name, code, 'success' if result.returncode == 0 else sqlstate(result))


def apply(db, path):
    result = run(psql(db) + ['-f', str(path)], check=False)
    return 'success' if result.returncode == 0 else result.stderr.strip()


baseline = baseline_path.read_text()


def connected_accounts_fixture():
    subject = re.compile(r'^(?:CREATE TABLE|ALTER TABLE ONLY|CREATE (?:UNIQUE )?INDEX \S+ ON) public\.connected_accounts\b')
    statements = []
    for raw in re.split(r';\n', baseline):
        body = '\n'.join(line for line in raw.split('\n') if not line.startswith('--')).strip()
        if subject.match(body):
            statements.append(body + ';')
    return statements


def baseline_wrappers():
    functions = re.findall(
        r'^CREATE FUNCTION public\.(?:get|upsert)_connected_account_tokens_secure\(.*?\$\$.*?\$\$;$',
        baseline, re.S | re.M)
    acls = re.findall(
        r'^(?:GRANT|REVOKE) .* ON FUNCTION public\.(?:get|upsert)_connected_account_tokens_secure\(.*;$',
        baseline, re.M)
    assert len(functions) == 2, functions
    return functions + acls


SETUP = '''
  create schema auth;
  create table auth.users (id uuid primary key);
  create schema vault;
  create table vault.secrets (
    id uuid primary key default gen_random_uuid(), name text unique, description text,
    secret text not null, updated_at timestamptz not null default now());
  create view vault.decrypted_secrets as
    select id, name, description, secret as decrypted_secret, updated_at from vault.secrets;
  create function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
    returns uuid language sql as $$
      insert into vault.secrets (secret, name, description) values (new_secret, new_name, new_description) returning id $$;
  create function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null,
    new_description text default null) returns void language sql as $$
      update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name),
        description = coalesce(new_description, description), updated_at = now() where id = secret_id $$;
'''

SIGNATURE = '''
select json_build_object(
  'schemaAcl', (select nspacl::text from pg_namespace where nspname = 'private'),
  'tableAcl', (select relacl::text from pg_class where oid = 'private.connected_account_tokens'::regclass),
  'columns', (select json_agg(json_build_array(a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull,
                pg_get_expr(d.adbin, d.adrelid), col_description(a.attrelid, a.attnum)) order by a.attnum)
              from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
              where a.attrelid = 'private.connected_account_tokens'::regclass and a.attnum > 0 and not a.attisdropped),
  'indexes', (select json_agg(pg_get_indexdef(indexrelid) order by pg_get_indexdef(indexrelid))
              from pg_index where indrelid = 'private.connected_account_tokens'::regclass),
  'constraints', (select json_agg(json_build_array(conname, pg_get_constraintdef(oid), convalidated) order by conname)
                  from pg_constraint where conrelid = 'private.connected_account_tokens'::regclass),
  'triggers', (select json_agg(pg_get_triggerdef(oid) order by tgname)
               from pg_trigger where tgrelid = 'private.connected_account_tokens'::regclass and not tgisinternal),
  'routines', (select json_agg(json_build_array(n.nspname || '.' || p.proname, pg_get_function_identity_arguments(p.oid),
                 pg_get_function_result(p.oid), p.prosecdef, p.proconfig, md5(p.prosrc), p.proacl::text)
                 order by n.nspname, p.proname)
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'private'
                  or (n.nspname = 'public' and p.proname like '%connected_account_tokens_secure'))
)::text
'''

try:
    run([str(binary / 'initdb'), '-D', str(cluster / 'data'), '-U', 'fixture', '-A', 'trust', '--no-locale'])
    run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-l', str(cluster / 'server.log'),
         '-o', f"-F -k {cluster / 'socket'} -c listen_addresses='' -p {port}", '-w', '-t', '10', 'start'])
    running = True
    version = sql('postgres', 'show server_version')
    sql('postgres', 'create role anon nologin; create role authenticated nologin; '
                    'create role service_role nologin bypassrls')
    for db in ('ledger', 'fresh'):
        sql('postgres', f'create database {db}')

    fixture = connected_accounts_fixture()
    for db in ('ledger', 'fresh'):
        sql(db, SETUP)
        run(psql(db) + ['-c', '\n'.join(fixture)])
        sql(db, 'grant usage on schema public to anon, authenticated, service_role')

    # ledger: the archived statements that built the vault in production.
    platform = ledger_files['platform'].read_text().splitlines()
    start = next(i for i, line in enumerate(platform) if line.startswith('CREATE SCHEMA IF NOT EXISTS private'))
    end = next(i for i, line in enumerate(platform) if line.startswith('ALTER TABLE user_profiles ENABLE'))
    harden = ledger_files['harden'].read_text()
    harden_private = (
        re.search(r'CREATE INDEX IF NOT EXISTS idx_connected_account_tokens_connected_account_user\n[^;]*;', harden).group(0)
        + '\n' + re.search(r'ALTER TABLE private\.connected_account_tokens\nVALIDATE CONSTRAINT [^;]*;', harden).group(0)
        + '\n' + harden[harden.index('CREATE OR REPLACE FUNCTION public.get_connected_account_tokens_secure'):])
    ledger_script = cluster / 'ledger.sql'
    ledger_script.write_text('set search_path = public;\n' + '\n'.join(platform[start:end]) + '\n'
                             + ledger_files['vault'].read_text() + '\n' + ledger_files['rpc'].read_text()
                             + '\n' + harden_private)
    record('ledger fixture replays the archived private-vault statements', 'success', apply('ledger', ledger_script))

    # fresh: what an active-chain replay holds before this migration.
    wrappers = cluster / 'wrappers.sql'
    wrappers.write_text('set check_function_bodies = false;\n' + '\n'.join(baseline_wrappers()) + '\n')
    record('baseline wrappers load without the private vault (check_function_bodies off)', 'success',
           apply('fresh', wrappers))
    sql('fresh', f"insert into auth.users values ('{USER_A}'), ('{USER_B}'); "
                 f"insert into public.connected_accounts (id, user_id, provider) values "
                 f"('{ACCOUNT_A}', '{USER_A}', 'yahoo'), ('{ACCOUNT_A2}', '{USER_A}', 'patreon')")
    upsert = (f"select public.upsert_connected_account_tokens_secure('{ACCOUNT_A}', '{USER_A}', 'yahoo', "
              f"'access-1', 'refresh-1', 'bearer') is not null")
    expect_error('fresh', 'before: a fresh replay cannot store a token (private schema missing)', 'service_role',
                 upsert, '3F000')

    record('migration applies to the fresh replay', 'success', apply('fresh', migration_path))
    record('migration re-applies to the fresh replay', 'success', apply('fresh', migration_path))
    record('migration applies over the production-ledger state', 'success', apply('ledger', migration_path))

    ledger_signature = json.loads(sql('ledger', SIGNATURE))
    fresh_signature = json.loads(sql('fresh', SIGNATURE))
    # Compare everything except the public wrappers' bodies, which the baseline
    # dump re-rendered; their identity, security and ACL still must match.
    def comparable(signature):
        copy = dict(signature)
        copy['routines'] = [row[:5] + ([row[5]] if row[0].startswith('private.') else []) + row[6:]
                            for row in signature['routines']]
        return copy
    mismatched = sorted(key for key in ledger_signature
                        if comparable(ledger_signature)[key] != comparable(fresh_signature)[key])
    record('fresh vault catalog matches the production-ledger vault catalog', [], mismatched)
    record('eleventh composite owner key exists and is validated', True, any(
        row[0] == 'connected_account_tokens_connected_account_user_fk'
        and 'FOREIGN KEY (connected_account_id, user_id) REFERENCES connected_accounts(id, user_id) ON DELETE CASCADE' in row[1]
        and row[2] for row in fresh_signature['constraints']))
    record('no raw token columns exist', [], [c[0] for c in fresh_signature['columns']
                                              if c[0] in ('access_token', 'refresh_token')])

    # Runtime on the fresh replay.
    expect_ok('fresh', 'after: service role stores tokens through the public wrapper', 'service_role', upsert, 't')
    read = (f"select access_token || '/' || refresh_token || '/' || token_type "
            f"from public.get_connected_account_tokens_secure('{ACCOUNT_A}', '{USER_A}')")
    expect_ok('fresh', 'service role reads decrypted tokens back', 'service_role', read, 'access-1/refresh-1/bearer')
    expect_ok('fresh', 'rotating only the access token keeps the refresh token and secret ids', 'service_role',
              f"select public.upsert_connected_account_tokens_secure('{ACCOUNT_A}', '{USER_A}', 'yahoo', 'access-2') "
              f"is not null; {read}", 'access-2/refresh-1/bearer')
    record('vault holds exactly two secrets and no raw tokens in the token table', '2',
           sql('fresh', 'select count(*) from vault.secrets'))
    expect_error('fresh', "a token row cannot pair one user's account with another user", 'service_role',
                 f"select public.upsert_connected_account_tokens_secure('{ACCOUNT_A2}', '{USER_B}', 'patreon')", '23503')
    for role in ('anon', 'authenticated'):
        expect_error('fresh', f'{role} cannot call the token wrapper', role,
                     f"select * from public.get_connected_account_tokens_secure('{ACCOUNT_A}', '{USER_A}')", '42501')
        expect_error('fresh', f'{role} cannot reach the private schema', role,
                     'select count(*) from private.connected_account_tokens', '42501')
    sql('fresh', f"delete from public.connected_accounts where id in ('{ACCOUNT_A}', '{ACCOUNT_A2}')")
    record('deleting the account cascades the token row and its Vault secrets', '0/0',
           sql('fresh', "select (select count(*) from private.connected_account_tokens) || '/' || "
                        "(select count(*) from vault.secrets)"))

    # Second apply over a populated vault must not touch rows or secrets.
    sql('ledger', f"insert into auth.users values ('{USER_A}'); "
                  f"insert into public.connected_accounts (id, user_id, provider) values ('{ACCOUNT_A}', '{USER_A}', 'yahoo')")
    as_role('ledger', 'service_role', upsert.replace('is not null', ''))
    snapshot = ("select md5(string_agg(t::text, ',' order by t.id)) || '/' || "
                "(select md5(string_agg(s::text, ',' order by s.id)) from vault.secrets s) "
                "from private.connected_account_tokens t")
    before = sql('ledger', snapshot)
    signature_before = sql('ledger', SIGNATURE)
    result = apply('ledger', migration_path)
    record('re-apply over a populated production-like vault leaves rows, secrets and catalog unchanged',
           ['success', before, signature_before], [result, sql('ledger', snapshot), sql('ledger', SIGNATURE)])

    passed = all(case['passed'] for case in cases)
    output.write_text(json.dumps({
        'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'postgres': version,
        'transport': 'Unix socket only (listen_addresses empty); disposable cluster removed afterwards',
        'vault': 'stub schema (secrets table, decrypted_secrets view, create_secret/update_secret); not Supabase Vault',
        'migration': {'path': str(migration_path.relative_to(repo)),
                      'sha256': hashlib.sha256(migration_path.read_bytes()).hexdigest()},
        'ledgerSources': {name: {'path': str(path.relative_to(repo)),
                                 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                          for name, path in ledger_files.items()},
        'passed': passed,
        'cases': cases,
    }, indent=2) + '\n')
    print(json.dumps({'passed': passed, 'cases': len(cases), 'failed': [c for c in cases if not c['passed']]},
                     indent=2)[:4000])
    sys.exit(0 if passed else 1)
finally:
    if running:
        run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-m', 'immediate', 'stop'], check=False)
    shutil.rmtree(cluster, ignore_errors=True)
