"""Exact review SQL against a fresh synthetic Unix-socket PostgreSQL17 only."""
from pathlib import Path
import concurrent.futures
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
run_id = sys.argv[1] if len(sys.argv) > 1 else 'v1'
assert re.fullmatch(r'v[1-9][0-9]*', run_id)
output = base / f'native-catalog-head-pg-result-{run_id}.json'
log_path = base / f'native-catalog-head-pg-log-{run_id}.txt'
assert not output.exists() and not log_path.exists(), 'Preserve prior receipts; use a new run ID.'
sql_path = base / 'native-catalog-head-review.sql'
binary = Path('/opt/homebrew/opt/postgresql@17/bin')
cluster = Path(tempfile.mkdtemp(prefix='fhfh-nh-', dir='/private/tmp'))
os.chmod(cluster, 0o700)
(cluster / 'socket').mkdir()
port = str(55000 + secrets.randbelow(9000))
environment = {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C', 'TMPDIR': str(cluster)}
logs, cases = [], []
running, passed, failure = False, False, None


def run(args, expected=None):
    result = subprocess.run(args, env=environment, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, timeout=30)
    logs.append(result.stdout)
    if expected:
        assert result.returncode != 0 and expected in result.stdout, result.stdout
    elif result.returncode:
        raise RuntimeError(result.stdout)
    return result.stdout.strip()


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


try:
    run([str(binary / 'initdb'), '-D', str(cluster / 'data'), '-U', 'fixture', '-A', 'trust', '--no-locale'])
    run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-l', str(cluster / 'server.log'),
         '-o', f"-F -k {cluster / 'socket'} -c listen_addresses='' -p {port}", '-w', '-t', '10', 'start'])
    running = True
    psql = [str(binary / 'psql'), '-X', '-w', '-qAt', '-h', str(cluster / 'socket'), '-p', port,
            '-U', 'fixture', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
    run(psql + ['-c', '''CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE TABLE public.player_forecast_source_observations (
        id uuid PRIMARY KEY, provider text, dataset_key text, entity_kind text, entity_key text,
        source_url text, source_revision_key text, observed_at timestamptz, available_at timestamptz,
        payload_hash text, payload jsonb, metadata jsonb);
      GRANT SELECT,INSERT ON public.player_forecast_source_observations TO service_role;'''])
    run(psql + ['-f', str(sql_path)])
    now = datetime.datetime.now(datetime.timezone.utc)
    observations = []
    for number, season, expired, kind in [(1, 20262027, False, 'catalog_selection'),
                                          (2, 20262027, False, 'catalog_selection'),
                                          (3, 20252026, False, 'catalog_selection'),
                                          (4, 20262027, True, 'catalog_selection'),
                                          (5, 20262027, False, 'not_a_selection'),
                                          (6, 20262027, False, 'catalog_selection'),
                                          (7, 20262027, False, 'catalog_selection'),
                                          (8, 20262027, False, 'catalog_selection'),
                                          (9, 20262027, False, 'catalog_selection')]:
        issued = (now - datetime.timedelta(minutes=2)).isoformat()
        payload = {'version': 'native-catalog-selection-v1', 'seasonId': season, 'issuedAt': issued,
                   'expiresAt': (now + datetime.timedelta(seconds=-1 if expired else 3600)).isoformat(),
                   'packageHash': str(number) * 64, 'pins': {}, 'releases': []}
        if number == 6:
            payload.pop('expiresAt')
        if number == 7:
            payload['expiresAt'] = None
        if number == 8:
            payload.pop('seasonId')
        if number == 9:
            payload['seasonId'] = None
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        identity = f'00000000-0000-4000-8000-{number:012d}'
        run(psql + ['-c', f'''INSERT INTO public.player_forecast_source_observations VALUES (
          {literal(identity)},'fhfh','native-catalog-selection-v1',{literal(kind)},{literal(season)},NULL,NULL,
          {literal(issued)},{literal(issued)},{literal(digest)},{literal(json.dumps(payload))}::jsonb,'{{}}');'''])
        observations.append((identity, digest))

    def cas(head, revision, previous, observation, season=20262027):
        identity, digest = observations[observation - 1]
        return f'''SET ROLE service_role; SELECT revision FROM public.cas_native_forecast_catalog_head(
          {literal(head)},{season},{revision},{'NULL' if previous is None else literal(previous)},
          {literal(identity)},{literal(digest)});'''

    head = '10000000-0000-4000-8000-000000000001'
    assert run(psql + ['-c', cas(head, 0, None, 1)]) == '1'
    cases.append('initial service-role CAS and exact returned revision')
    run(psql + ['-c', cas(head, 0, None, 2)], expected='Native catalog CAS conflict')
    run(psql + ['-c', cas(head, 1, 'f' * 64, 2)], expected='Native catalog CAS conflict')
    run(psql + ['-c', cas(head, 2, observations[0][1], 2)], expected='Native catalog CAS conflict')
    assert run(psql + ['-c', f'SELECT revision FROM public.native_forecast_catalog_heads WHERE id={literal(head)}']) == '1'
    cases.append('revision and previous-hash conflicts leave head unchanged')
    assert run(psql + ['-c', cas(head, 1, observations[0][1], 2)]) == '2'
    cases.append('matching revision and previous hash advance exactly once')
    for observation, season in [(3, 20262027), (4, 20262027), (5, 20262027), (6, 20262027), (7, 20262027), (8, 20262027), (9, 20262027)]:
        run(psql + ['-c', cas(head, 2, observations[1][1], observation, season)], expected='selection envelope mismatch')
    cases.append('wrong season, expired selection, wrong kind, missing/null expiry and missing/null season rejected')
    race_head = '10000000-0000-4000-8000-000000000002'

    def contender(observation):
        result = subprocess.run(psql + ['-c', cas(race_head, 0, None, observation)], env=environment,
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30)
        logs.append(result.stdout)
        return result.returncode, result.stdout

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        race = list(pool.map(contender, [1, 2]))
    assert sum(code == 0 for code, _ in race) == 1, race
    assert all(code == 0 or 'Native catalog CAS conflict' in text for code, text in race), race
    assert run(psql + ['-c', f'SELECT count(*),min(revision),max(revision) FROM public.native_forecast_catalog_heads WHERE id={literal(race_head)}']) == '1|1|1'
    cases.append('two concurrent initial callers have exactly one winner')
    for role in ['anon', 'authenticated']:
        run(psql + ['-c', f'SET ROLE {role}; SELECT * FROM public.native_forecast_catalog_heads'], expected='permission denied')
        query = cas(head, 2, observations[1][1], 1).replace('SET ROLE service_role', f'SET ROLE {role}')
        run(psql + ['-c', query], expected='permission denied')
    run(psql + ['-c', f'SET ROLE service_role; UPDATE public.native_forecast_catalog_heads SET revision=999 WHERE id={literal(head)}'], expected='permission denied')
    assert run(psql + ['-c', 'SET ROLE service_role; SELECT count(*) FROM public.native_forecast_catalog_heads']) == '2'
    cases.append('anonymous/authenticated lack read/execute and service role cannot directly update heads')
    passed = True
except Exception as error:
    failure = str(error)
finally:
    if running:
        try:
            run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-m', 'fast', '-w', '-t', '10', 'stop'])
        except Exception as error:
            failure = str(error)
            passed = False
    if (cluster / 'server.log').exists():
        logs.append((cluster / 'server.log').read_text())
    cleaned = not (cluster / 'data' / 'postmaster.pid').exists()
    if cleaned:
        shutil.rmtree(cluster)
    receipt = {'passed': passed, 'cases': cases, 'failure': failure,
               'sqlPath': str(sql_path), 'sqlSHA256': hashlib.sha256(sql_path.read_bytes()).hexdigest(),
               'transport': 'new disposable synthetic PostgreSQL17 Unix socket; TCP disabled',
               'ownedClusterStoppedAndRemoved': cleaned, 'existingInstancesTouched': False,
               'hostedRequests': 0, 'schemaAppliedToHosted': False}
    with output.open('x') as handle:
        json.dump(receipt, handle, indent=2)
        handle.write('\n')
    with log_path.open('x') as handle:
        handle.write(''.join(logs))
    print(json.dumps(receipt))
if not passed:
    raise SystemExit(1)
