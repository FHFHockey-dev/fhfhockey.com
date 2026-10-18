"""Replay the provider-linkage migration against a fresh, socket-only PostgreSQL 17.

The fixture is the exact baseline DDL, RLS, policies and grants for the four
target tables plus user_provider_preferences, with a stub auth.uid(). Nothing
here connects to a hosted database: the server listens on a Unix socket only.
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
output = base / f'provider-linkage-pg-result-{run_id}.json'
assert not output.exists(), 'Preserve prior receipts; use a new run ID.'
baseline_path = repo / 'supabase/migrations/20260716112908_production_schema_baseline.sql'
migration_path = repo / 'supabase/migrations/20261018184229_restrict_provider_linkage_browser_writes.sql'
binary = Path('/opt/homebrew/opt/postgresql@17/bin')
# Socket paths are limited to ~100 bytes, so the cluster lives in a short temp dir.
cluster = Path(tempfile.mkdtemp(prefix='fhfh-pl-', dir='/private/tmp'))
os.chmod(cluster, 0o700)
(cluster / 'socket').mkdir()
port = str(55000 + secrets.randbelow(9000))
environment = {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C', 'TMPDIR': str(cluster)}

TABLES = 'connected_accounts|external_leagues|external_teams|provider_sync_runs|user_provider_preferences'
TARGETS = ['connected_accounts', 'external_leagues', 'external_teams', 'provider_sync_runs']
USER_A = '00000000-0000-4000-8000-00000000000a'
USER_B = '00000000-0000-4000-8000-00000000000b'
ACCOUNT_A = '10000000-0000-4000-8000-00000000000a'
ACCOUNT_B = '10000000-0000-4000-8000-00000000000b'
LEAGUE_A = '20000000-0000-4000-8000-00000000000a'
LEAGUE_B = '20000000-0000-4000-8000-00000000000b'
TEAM_A = '30000000-0000-4000-8000-00000000000a'
TEAM_B = '30000000-0000-4000-8000-00000000000b'

cases = []
running = False


def run(command, check=True):
    result = subprocess.run(command, env=environment, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise RuntimeError(f'{command[0]} failed: {result.stderr.strip()}')
    return result


def psql_args():
    return [str(binary / 'psql'), '-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
            '-h', str(cluster / 'socket'), '-p', port, '-U', 'fixture', '-d', 'postgres']


def sql(statement):
    return run(psql_args() + ['-c', statement]).stdout.strip()


def as_role(role, user_id, statement):
    claim = f"select set_config('request.jwt.claim.sub', '{user_id}', false);" if user_id else ''
    return run(psql_args() + ['-c', f'set role {role}; {claim} {statement}'], check=False)


def sqlstate(result):
    match = re.search(r'ERROR:\s+([0-9A-Z]{5}):', result.stderr)
    return match.group(1) if match else None


def expect_ok(name, role, user_id, statement, expected_stdout=None):
    result = as_role(role, user_id, statement)
    stdout = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ''
    passed = result.returncode == 0 and (expected_stdout is None or stdout == expected_stdout)
    cases.append({'case': name, 'expected': expected_stdout or 'success',
                  'observed': stdout if result.returncode == 0 else sqlstate(result), 'passed': passed})


def expect_error(name, role, user_id, statement, code):
    result = as_role(role, user_id, statement)
    observed = 'success' if result.returncode == 0 else sqlstate(result)
    cases.append({'case': name, 'expected': code, 'observed': observed, 'passed': observed == code})


def baseline_fixture():
    text = baseline_path.read_text()
    subject = re.compile(
        rf'^(?:CREATE TABLE|ALTER TABLE ONLY|ALTER TABLE|CREATE (?:UNIQUE )?INDEX \S+ ON|'
        rf'CREATE POLICY \S+ ON|GRANT [A-Z,]+ ON TABLE) public\.({TABLES})\b')
    statements = []
    for raw in re.split(r';\n', text):
        body = '\n'.join(line for line in raw.split('\n') if not line.startswith('--')).strip()
        if subject.match(body):
            statements.append(body + ';')
    return statements


try:
    run([str(binary / 'initdb'), '-D', str(cluster / 'data'), '-U', 'fixture', '-A', 'trust', '--no-locale'])
    run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-l', str(cluster / 'server.log'),
         '-o', f"-F -k {cluster / 'socket'} -c listen_addresses='' -p {port}", '-w', '-t', '10', 'start'])
    running = True
    version = sql('show server_version')

    sql('''
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
    ''')
    fixture = baseline_fixture()
    run(psql_args() + ['-c', '\n'.join(fixture)])
    sql(f'''
      insert into auth.users values ('{USER_A}'), ('{USER_B}');
      insert into public.connected_accounts (id, user_id, provider, provider_user_id, status) values
        ('{ACCOUNT_A}', '{USER_A}', 'yahoo', 'yahoo-guid-a', 'connected'),
        ('{ACCOUNT_B}', '{USER_B}', 'yahoo', 'yahoo-guid-b', 'connected');
      insert into public.external_leagues (id, connected_account_id, user_id, provider, external_league_key) values
        ('{LEAGUE_A}', '{ACCOUNT_A}', '{USER_A}', 'yahoo', 'league-a'),
        ('{LEAGUE_B}', '{ACCOUNT_B}', '{USER_B}', 'yahoo', 'league-b');
      insert into public.external_teams (id, external_league_id, connected_account_id, user_id, provider, external_team_key) values
        ('{TEAM_A}', '{LEAGUE_A}', '{ACCOUNT_A}', '{USER_A}', 'yahoo', 'team-a'),
        ('{TEAM_B}', '{LEAGUE_B}', '{ACCOUNT_B}', '{USER_B}', 'yahoo', 'team-b');
      insert into public.provider_sync_runs (user_id, provider, connected_account_id) values
        ('{USER_A}', 'yahoo', '{ACCOUNT_A}'), ('{USER_B}', 'yahoo', '{ACCOUNT_B}');
    ''')

    # Red: on the baseline grants a signed-in browser can claim B's next identity.
    squat = (f"begin; insert into public.connected_accounts (user_id, provider, provider_user_id) "
             f"values ('{USER_A}', 'patreon', 'patreon-member-b'); rollback;")
    expect_ok('baseline: authenticated user can insert a connected_accounts row for any provider identity',
              'authenticated', USER_A, squat)
    expect_ok('baseline: authenticated user can truncate provider_sync_runs (TRUNCATE ignores RLS)',
              'authenticated', USER_A, 'begin; truncate public.provider_sync_runs cascade; rollback;')

    # Apply twice: the migration must be idempotent.
    for attempt in (1, 2):
        result = run(psql_args() + ['-f', str(migration_path)], check=False)
        cases.append({'case': f'migration applies cleanly (attempt {attempt})', 'expected': 'success',
                      'observed': 'success' if result.returncode == 0 else result.stderr.strip(),
                      'passed': result.returncode == 0})

    expect_error('authenticated cannot insert connected_accounts (identity squat closed)', 'authenticated', USER_A,
                 f"insert into public.connected_accounts (user_id, provider, provider_user_id) "
                 f"values ('{USER_A}', 'patreon', 'patreon-member-b')", '42501')
    expect_error('authenticated cannot insert external_leagues', 'authenticated', USER_A,
                 f"insert into public.external_leagues (connected_account_id, user_id, provider, external_league_key) "
                 f"values ('{ACCOUNT_A}', '{USER_A}', 'yahoo', 'league-new')", '42501')
    expect_error('authenticated cannot insert external_teams', 'authenticated', USER_A,
                 f"insert into public.external_teams (external_league_id, connected_account_id, user_id, provider, external_team_key) "
                 f"values ('{LEAGUE_A}', '{ACCOUNT_A}', '{USER_A}', 'yahoo', 'team-new')", '42501')
    expect_error('authenticated cannot insert provider_sync_runs', 'authenticated', USER_A,
                 f"insert into public.provider_sync_runs (user_id, provider) values ('{USER_A}', 'yahoo')", '42501')
    expect_error('authenticated cannot update its own connected account', 'authenticated', USER_A,
                 f"update public.connected_accounts set status = 'connected' where id = '{ACCOUNT_A}'", '42501')
    expect_error('authenticated cannot delete its own external team', 'authenticated', USER_A,
                 f"delete from public.external_teams where id = '{TEAM_A}'", '42501')
    expect_error('authenticated cannot truncate provider_sync_runs', 'authenticated', USER_A,
                 'truncate public.provider_sync_runs cascade', '42501')
    expect_error('anon cannot read connected_accounts', 'anon', None,
                 'select count(*) from public.connected_accounts', '42501')
    expect_ok('authenticated still reads only its own connected account', 'authenticated', USER_A,
              'select string_agg(provider_user_id, \',\') from public.connected_accounts', 'yahoo-guid-a')
    expect_ok('authenticated still reads its own teams joined to leagues', 'authenticated', USER_A,
              'select string_agg(t.external_team_key || \'/\' || l.external_league_key, \',\') '
              'from public.external_teams t join public.external_leagues l on l.id = t.external_league_id',
              'team-a/league-a')
    expect_ok('authenticated still reads only its own sync runs', 'authenticated', USER_A,
              'select count(*) from public.provider_sync_runs', '1')
    upsert = (f"insert into public.user_provider_preferences (user_id, provider, connected_account_id, "
              f"default_external_league_id, default_external_team_id) values "
              f"('{USER_A}', 'yahoo', '{ACCOUNT_A}', '{LEAGUE_A}', '{TEAM_A}') ")
    sql('create unique index if not exists fixture_upp_user_provider on public.user_provider_preferences (user_id, provider)')
    expect_ok('browser upsert of its own provider preferences still works', 'authenticated', USER_A,
              upsert + "on conflict (user_id, provider) do update set refresh_on_login = true; "
                       "select refresh_on_login from public.user_provider_preferences", 'f')
    expect_ok('browser upsert conflict path still updates its own preferences', 'authenticated', USER_A,
              upsert + "on conflict (user_id, provider) do update set refresh_on_login = true; "
                       "select refresh_on_login from public.user_provider_preferences", 't')
    expect_error("preferences cannot point at another user's connected account", 'authenticated', USER_A,
                 f"insert into public.user_provider_preferences (user_id, provider, connected_account_id) "
                 f"values ('{USER_A}', 'espn', '{ACCOUNT_B}')", '23503')
    expect_ok('service role still writes connected accounts and sync runs', 'service_role', None,
              f"begin; insert into public.connected_accounts (user_id, provider, provider_user_id) "
              f"values ('{USER_B}', 'patreon', 'patreon-member-b'); "
              f"update public.connected_accounts set status = 'connected' where provider_user_id = 'patreon-member-b'; "
              f"insert into public.provider_sync_runs (user_id, provider) values ('{USER_B}', 'patreon'); "
              f"delete from public.connected_accounts where provider_user_id = 'patreon-member-b'; "
              f"rollback; select 'ok'", 'ok')

    target_list = ','.join(f"'{name}'" for name in TARGETS)
    policies = sql(f"select string_agg(policyname, ',' order by policyname) from pg_policies "
                   f"where schemaname = 'public' and tablename in ({target_list})")
    expected_policies = ','.join(sorted(f'{name}_select_own' for name in TARGETS))
    cases.append({'case': 'only the owner SELECT policies remain on the four tables',
                  'expected': expected_policies, 'observed': policies, 'passed': policies == expected_policies})
    preference_policies = sql("select count(*) from pg_policies where tablename = 'user_provider_preferences'")
    cases.append({'case': 'user_provider_preferences keeps its four owner policies', 'expected': '4',
                  'observed': preference_policies, 'passed': preference_policies == '4'})
    privileges = sql(f'''
      select string_agg(format('%s:%s:%s', r.rolname, c.relname, p.privilege), ',' order by r.rolname, c.relname, p.privilege)
      from (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
      cross join pg_class c
      cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as p(privilege)
      where c.relnamespace = 'public'::regnamespace and c.relname in ({target_list})
        and has_table_privilege(r.rolname, c.oid, p.privilege)
        and r.rolname <> 'service_role'
    ''')
    expected_privileges = ','.join(f'authenticated:{name}:SELECT' for name in sorted(TARGETS))
    cases.append({'case': 'browser roles hold only authenticated SELECT on the four tables',
                  'expected': expected_privileges, 'observed': privileges, 'passed': privileges == expected_privileges})
    service = sql(f"select bool_and(has_table_privilege('service_role', c.oid, 'SELECT,INSERT,UPDATE,DELETE')) "
                  f"from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ({target_list})")
    cases.append({'case': 'service_role keeps SELECT/INSERT/UPDATE/DELETE', 'expected': 't',
                  'observed': service, 'passed': service == 't'})

    passed = all(case['passed'] for case in cases)
    output.write_text(json.dumps({
        'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'postgres': version,
        'transport': 'Unix socket only (listen_addresses empty); disposable cluster removed afterwards',
        'baseline': {'path': str(baseline_path.relative_to(repo)),
                     'sha256': hashlib.sha256(baseline_path.read_bytes()).hexdigest(),
                     'fixtureStatements': len(fixture)},
        'migration': {'path': str(migration_path.relative_to(repo)),
                      'sha256': hashlib.sha256(migration_path.read_bytes()).hexdigest()},
        'passed': passed,
        'cases': cases,
    }, indent=2) + '\n')
    print(json.dumps({'passed': passed, 'cases': len(cases), 'failed': [c for c in cases if not c['passed']]}, indent=2))
    sys.exit(0 if passed else 1)
finally:
    if running:
        run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-m', 'immediate', 'stop'], check=False)
    shutil.rmtree(cluster, ignore_errors=True)
