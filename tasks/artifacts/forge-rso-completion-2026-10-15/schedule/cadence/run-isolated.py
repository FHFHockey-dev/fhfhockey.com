"""Synthetic new cluster only; never connects to an existing database."""
from pathlib import Path
import concurrent.futures
import json
import os
import shutil
import subprocess
import tempfile

base = Path(__file__).resolve().parent
binary = Path('/opt/homebrew/opt/postgresql@17/bin')
cluster = Path(tempfile.mkdtemp(prefix='fhfh-cadence-fixture-'))
os.chmod(cluster, 0o700)
(cluster / 'socket').mkdir()
environment = {'PATH': '/usr/bin:/bin', 'LC_ALL': 'C', 'TMPDIR': str(cluster)}
running = False
log = []


def run(args):
    result = subprocess.run(args, env=environment, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, timeout=30)
    log.append(result.stdout)
    if result.returncode:
        raise RuntimeError(result.stdout)
    return result.stdout


try:
    run([str(binary / 'initdb'), '-D', str(cluster / 'data'), '-U', 'fixture', '-A', 'trust', '--no-locale'])
    run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-l', str(cluster / 'server.log'),
         '-o', f"-F -k {cluster / 'socket'} -c listen_addresses='' -p 55879", '-w', '-t', '10', 'start'])
    running = True
    psql = [str(binary / 'psql'), '-X', '-w', '-h', str(cluster / 'socket'), '-p', '55879',
            '-U', 'fixture', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
    for filename in ['bootstrap.sql', 'atomic-cadence-proposal.sql', 'verify.sql',
                     'native-bootstrap.sql', 'native-cadence-proposal.sql', 'native-verify.sql']:
        run(psql + ['-f', str(base / filename)])
    query = """SELECT public.enqueue_player_forecast_morning_cadence(
      (clock_timestamp() AT TIME ZONE 'America/New_York')::date,'ros',ARRAY['overnight'],
      jsonb_build_array(jsonb_build_object('key','overnight',
        'date',(clock_timestamp() AT TIME ZONE 'America/New_York')::date,'status','complete',
        'revision','concurrent-synthetic','expectedItems',0,'completedItems',0,
        'completedAt',clock_timestamp()-interval '1 minute')));"""
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: run(psql + ['-At', '-c', query]), range(2)))
    outcomes = sorted(json.loads(result)['outcome'] for result in results)
    assert outcomes == ['deduplicated', 'enqueued'], outcomes
    log.append('Concurrent duplicate callers: one enqueued, one deduplicated.\n')
    run(psql + ['-c', 'INSERT INTO public.games VALUES(2,clock_timestamp()+interval \'10 minutes\',1,2)'])
    native_query = """SELECT public.enqueue_forge_cadence_slot(2,
      (clock_timestamp() AT TIME ZONE 'America/New_York')::date,'morning',
      (SELECT "startTime" FROM public.games WHERE id=2),ARRAY['overnight'],
      jsonb_build_array(jsonb_build_object('key','overnight',
        'date',(clock_timestamp() AT TIME ZONE 'America/New_York')::date,'status','complete',
        'revision','native-concurrent-synthetic','expectedItems',0,'completedItems',0,
        'completedAt',clock_timestamp()-interval '1 minute')));"""
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        native_results = list(pool.map(lambda _: run(psql + ['-At', '-c', native_query]), range(2)))
    native_outcomes = sorted(json.loads(result)['outcome'] for result in native_results)
    assert native_outcomes.count('enqueued') == 1 and all(value in ['enqueued', 'deduplicated', 'held'] for value in native_outcomes)
    version = run(psql + ['-At', '-c', 'SELECT version FROM public.forge_game_update_queue WHERE game_id=2']).strip()
    assert version == '1', version
    (base / 'isolated-result.json').write_text(json.dumps({'passed': True, 'sqlAssertions': 13, 'nativeAssertions': 29, 'nativeConcurrentOutcomes': native_outcomes,
        'concurrentOutcomes': outcomes, 'transport': 'new synthetic Unix-socket PostgreSQL cluster'}, indent=2) + '\n')
finally:
    if running:
        run([str(binary / 'pg_ctl'), '-D', str(cluster / 'data'), '-m', 'fast', '-w', '-t', '10', 'stop'])
    (base / 'isolated-execution.log').write_text(''.join(log))
    if not (cluster / 'data' / 'postmaster.pid').exists():
        shutil.rmtree(cluster)
