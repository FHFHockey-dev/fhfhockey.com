"""Prepare by default; execution needs a separately authorized follow-up task.

This launcher has no existing-database mode and never loads env/credential files.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import stat
import tempfile
import uuid

BASE = Path(__file__).resolve().parent
ARTIFACT = BASE.parent
ROOT = BASE.parents[3]
BIN = Path('/opt/homebrew/opt/postgresql@17/bin')
MIGRATION = ROOT / 'supabase/migrations/20260829161013_add_roster_optimizer_team_game_schedule.sql'
DDL = ARTIFACT / 'database-prerequisite.sql'
FROZEN_SHA = '2515e4b9e1391484656cf6a0a81d8f74c3ed6589d6309532df95edee2e8ebc41'
NODE = Path(shutil.which('node') or '')

def verify_frozen():
    frozen = ARTIFACT / 'FROZEN-V2.json'
    assert hashlib.sha256(frozen.read_bytes()).hexdigest() == FROZEN_SHA
    manifest = json.loads(frozen.read_text())
    for relative, digest in manifest['files'].items():
        assert hashlib.sha256((ARTIFACT / relative).read_bytes()).hexdigest() == digest, relative
    pins = json.loads((ARTIFACT / 'source-bindings.json').read_text())
    expected = pins['sourceSha256'][str(MIGRATION.relative_to(ROOT))]
    assert hashlib.sha256(MIGRATION.read_bytes()).hexdigest() == expected
    for name in ['postgres', 'initdb', 'pg_ctl', 'psql', 'createdb']:
        assert (BIN / name).is_file() and os.access(BIN / name, os.X_OK), name
    assert NODE.is_file()
    execution_pins = json.loads((BASE / 'execution-pins.json').read_text())
    assert execution_pins['frozenCandidateSha256'] == FROZEN_SHA
    for item in execution_pins['executables']:
        executable = Path(item['path'])
        assert str(executable.resolve()) == item['resolvedPath'], item['path']
        assert hashlib.sha256(executable.read_bytes()).hexdigest() == item['sha256'], item['path']
    for relative, digest in execution_pins['fixtureSha256'].items():
        assert hashlib.sha256((BASE / relative).read_bytes()).hexdigest() == digest, relative
    assert execution_pins['reviewSha256'] == hashlib.sha256((ARTIFACT / 'independent-review-v2.md').read_bytes()).hexdigest()

def verify_owned_target(cluster, marker):
    resolved = cluster.resolve()
    assert resolved.parent in [Path('/tmp'), Path('/private/tmp')]
    assert cluster.name.startswith('fhfh-schedule-pg-') and not cluster.is_symlink()
    assert cluster.stat().st_uid == os.getuid() and stat.S_IMODE(cluster.stat().st_mode) == 0o700
    assert (cluster / 'OWNED-SYNTHETIC-FIXTURE').read_text() == marker
    assert (cluster / 'socket').resolve() == resolved / 'socket'
    assert stat.S_IMODE((cluster / 'socket').stat().st_mode) == 0o700

def commands(cluster, marker):
    data, socket = cluster / 'data', cluster / 'socket'
    connection = ['-h', str(socket), '-p', '65439', '-U', 'fixture_owner', '-w']
    settings = ["listen_addresses=''", 'unix_socket_permissions=0700', 'max_connections=12',
        'shared_buffers=16MB', 'work_mem=1MB', 'maintenance_work_mem=16MB',
        'max_wal_size=64MB', 'min_wal_size=32MB', 'statement_timeout=10000',
        'lock_timeout=1000', 'idle_in_transaction_session_timeout=10000']
    options = '-k ' + shlex.quote(str(socket)) + ' -p 65439 ' + ' '.join('-c ' + value for value in settings)
    psql = [str(BIN / 'psql'), *connection, '-d', 'roster_schedule_fixture', '-X', '-v', 'ON_ERROR_STOP=1']
    return [
        [str(BIN / 'initdb'), '-D', str(data), '-U', 'fixture_owner', '--auth-local=trust', '--auth-host=reject', '--no-locale', '--no-instructions'],
        [str(BIN / 'pg_ctl'), '-D', str(data), '-p', str(BIN / 'postgres'), '-l', str(cluster / 'server.log'), '-o', options, '-w', '-t', '15', 'start'],
        [str(BIN / 'createdb'), *connection, 'roster_schedule_fixture'],
        [*psql, '-f', str(BASE / 'bootstrap.sql')],
        [*psql, '-f', str(MIGRATION)],
        [*psql, '-f', str(DDL)],
        [str(NODE), str(BASE / 'cases.cjs'), str(socket), str(data), marker],
    ]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute-after-approval', action='store_true', help='Starts a NEW private synthetic cluster; do not use without separate authorization')
    parser.add_argument('--plan', action='store_true', help='Print exact commands only (default)')
    args = parser.parse_args()
    assert not (args.plan and args.execute_after_approval)
    verify_frozen()
    if not args.execute_after_approval:
        print('PREPARATION ONLY: no cluster, connection, schema or process is started.')
        print('After separate authorization, the launcher creates a new mode-0700 /tmp directory, socket directory and ownership marker.')
        for command in commands(Path('/tmp/fhfh-schedule-pg-NEW-UNIQUE'), 'NEW-OWNERSHIP-UUID'):
            print(shlex.join(command))
        print('Cleanup: only pg_ctl -D <that-new-cluster>/data -m fast -w -t 10 stop; remove the owned directory only after successful stop/no postmaster.pid.')
        return

    # Do not inherit PGHOST, service/password files, cloud credentials or dotenv.
    os.umask(0o077)
    cluster = Path(tempfile.mkdtemp(prefix='fhfh-schedule-pg-', dir='/tmp'))
    marker = str(uuid.uuid4())
    (cluster / 'OWNED-SYNTHETIC-FIXTURE').write_text(marker)
    (cluster / 'socket').mkdir(mode=0o700)
    verify_owned_target(cluster, marker)
    assert not (cluster / 'data').exists()
    (cluster / 'isolation-preflight.json').write_text(json.dumps({
        'candidateSha256': FROZEN_SHA, 'cluster': str(cluster), 'resolvedCluster': str(cluster.resolve()),
        'cleanupDataDirectory': str(cluster / 'data'), 'socketDirectory': str(cluster / 'socket'),
        'tcpListenAddresses': '', 'environmentKeys': ['PATH','LANG','LC_ALL','TZ','TMPDIR','PGPASSFILE','PGSERVICEFILE','PSQL_HISTORY'],
        'onlyNewSyntheticCluster': True, 'existingDatabaseConnection': False,
    }, indent=2) + '\n')
    environment = {'PATH': f'{BIN}:/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C', 'TZ': 'UTC',
        'TMPDIR': str(cluster), 'PGPASSFILE': '/dev/null', 'PGSERVICEFILE': '/dev/null', 'PSQL_HISTORY': '/dev/null'}
    print(f'Owned synthetic cluster: {cluster}', flush=True)
    succeeded = False
    stopped = True
    start_attempted = False
    start_acknowledged = False
    try:
        for index, command in enumerate(commands(cluster, marker)):
            if index == 1:
                verify_owned_target(cluster, marker)
                assert (cluster / 'data/PG_VERSION').read_text().strip() == '17'
                start_attempted = True
            with (cluster / f'step-{index + 1}.log').open('w') as log:
                subprocess.run(command, env=environment, cwd=BASE, stdout=log, stderr=subprocess.STDOUT,
                    check=True, timeout=60 if index == 0 else 35)
            if index == 1:
                start_acknowledged = True
        succeeded = True
        print((cluster / 'step-7.log').read_text(), flush=True)
    finally:
        verify_owned_target(cluster, marker)
        # This command can target only the data directory created above. A start
        # timeout can be uncertain, so check the owned PID file even after errors.
        if (cluster / 'data/postmaster.pid').exists():
            try:
                result = subprocess.run([str(BIN / 'pg_ctl'), '-D', str(cluster / 'data'), '-m', 'fast', '-w', '-t', '10', 'stop'],
                    env=environment, cwd=BASE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=15)
                stopped = result.returncode == 0 and not (cluster / 'data/postmaster.pid').exists()
                print(result.stdout, flush=True)
            except subprocess.TimeoutExpired:
                stopped = False
        elif start_attempted and not start_acknowledged:
            # An uncertain start is not proof of no server merely because a
            # PID file is absent at this instant. Preserve for inspection.
            stopped = False
        if not stopped or (cluster / 'data/postmaster.pid').exists():
            print(f'STOP UNCONFIRMED: preserve {cluster}; do not delete or target any other cluster.', flush=True)
        else:
            # Preserve only this fixture's bounded logs, not the data directory.
            result_dir = BASE / 'execution-evidence' / cluster.name
            result_dir.mkdir(parents=True, exist_ok=False)
            for log in cluster.glob('*.log'):
                shutil.copy2(log, result_dir / log.name)
            shutil.copy2(cluster / 'isolation-preflight.json', result_dir / 'isolation-preflight.json')
            assert (cluster / 'OWNED-SYNTHETIC-FIXTURE').read_text() == marker
            assert cluster.parent == Path('/tmp') and cluster.name.startswith('fhfh-schedule-pg-')
            shutil.rmtree(cluster)
            print(f'Owned cluster removed; synthetic logs retained at {result_dir}', flush=True)
        if not succeeded or not stopped:
            raise SystemExit(1)

if __name__ == '__main__':
    main()
