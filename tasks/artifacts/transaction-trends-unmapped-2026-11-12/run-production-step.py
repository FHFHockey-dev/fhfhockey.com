"""One-shot operator wrapper. No retries; reviewed SQL remains byte-identical."""
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
PROJECT = 'fyhftlxokyjtpndbkfse'
PSQL = '/opt/homebrew/opt/postgresql@15/bin/psql'
PINS = {
    'repair-season-metadata.sql': '99a528b95429e64123e276351240db8ca730da7abcb2440883911c1e15a8f10f',
    'post-repair-check.sql': '9544dfa2fc23c965b9eab3ec06e2d8c80e81340774662c14252abc13b43a581f',
    'REPAIR-EVIDENCE.json': '1519a4123fed3cda925c8a0f71b115c4b6ec475ec4838e6ddd9748403aca56d6',
    'READINESS-EVIDENCE.json': 'e334b775d979f8b504eb92e429055bafd35c09fae3a5c0a04510d69ac81641be',
}


def now():
    return datetime.now(timezone.utc).isoformat()


def sorted_json(items):
    return sorted(json.dumps(item, sort_keys=True) for item in items)


def check_preflight(observed):
    assert observed['database'] == 'postgres'
    assert observed['full_visibility'] and observed['update_privileges']
    assert all(value == 0 for value in observed['activity'].values()), observed['activity']
    old = json.loads((ROOT / 'READINESS-EVIDENCE.json').read_text())
    expected_triggers = []
    for t in old['triggerConstraints'][0]['metadata']['triggers']:
        row = {k: t[k] for k in ('name', 'table', 'enabled', 'internal', 'definition')}
        row['function_md5'] = None if t['internal'] else hashlib.md5(t['function_definition'].encode()).hexdigest()
        expected_triggers.append(row)
    assert sorted_json(observed['triggers']) == sorted_json(expected_triggers), 'Trigger drift'
    assert sorted_json(observed['constraints']) == sorted_json(old['triggerConstraints'][0]['metadata']['constraints']), 'Constraint drift'
    for key in ('indexes', 'rules', 'tables'):
        assert sorted_json(observed[key]) == sorted_json(old['readSurfaces'][0]['metadata'][key]), key + ' drift'
    reader = json.loads((ROOT / 'REPAIR-EVIDENCE.json').read_text())['reader'][0]['identity_reader_definition']
    assert observed['reader_md5'] == hashlib.md5(reader.encode()).hexdigest(), 'Reader drift'
    view = old['readSurfaces'][0]['metadata']['mapping_view_definition']
    assert observed['view_md5'] == hashlib.md5(view.encode()).hexdigest(), 'View drift'


def main():
    mode = sys.argv[1]
    assert mode in ('preflight', 'apply', 'postcheck')
    for name, expected in PINS.items():
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name + ' changed'
    receipt_path = ROOT / ('PRODUCTION-' + mode.upper() + '.json')
    assert not receipt_path.exists(), 'An attempt receipt already exists; no automatic retry'
    if mode == 'apply':
        preflight = json.loads((ROOT / 'PRODUCTION-PREFLIGHT.json').read_text())
        assert preflight.get('verified') is True, 'Preflight did not pass'
        age = datetime.now(timezone.utc) - datetime.fromisoformat(preflight['finished_at'])
        assert 0 <= age.total_seconds() < 180, 'Fresh preflight required; stop rather than retry'
    if mode == 'postcheck':
        assert (ROOT / 'PRODUCTION-APPLY.json').exists(), 'No recorded apply attempt'
    match = re.search(r'^\s*(?:export\s+)?SUPABASE_DB_URL\s*=\s*(.+)$', (REPO / 'web/.env.local').read_text(), re.M)
    assert match, 'Existing connection missing'
    values = shlex.split(match.group(1), comments=True)
    assert len(values) == 1
    url = urlsplit(values[0])
    options = parse_qs(url.query)
    assert url.scheme == 'postgresql' and url.hostname == 'db.' + PROJECT + '.supabase.co'
    assert url.path == '/postgres' and url.port == 5432 and url.username == 'postgres'
    assert set(options) <= {'sslmode'} and options.get('sslmode') in (['require'], ['verify-ca'], ['verify-full'])
    password = unquote(url.password or '')
    assert password, 'Existing password missing'
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    env.update(PGHOST=url.hostname, PGPORT='5432', PGDATABASE='postgres', PGUSER='postgres',
               PGPASSWORD=password, PGSSLMODE=options['sslmode'][0], PGCONNECT_TIMEOUT='5',
               PGSERVICEFILE='/dev/null', PGPASSFILE='/dev/null',
               PGAPPNAME='trends-six-row-repair-20261112-' + mode)
    filename = {'preflight': 'production-preflight.sql', 'apply': 'repair-season-metadata.sql', 'postcheck': 'post-repair-check.sql'}[mode]
    cmd = [PSQL, '-X', '--no-password', '-v', 'ON_ERROR_STOP=1']
    if mode == 'apply':
        cmd += ['-v', 'commit_repair=1']
    elif mode == 'preflight':
        cmd += ['-qAt']
    else:
        cmd += ['--csv']
    cmd += ['--file', str(ROOT / filename)]
    receipt = {'mode': mode, 'started_at': now(), 'project_id': PROJECT, 'host': url.hostname,
               'sql_file': filename, 'sql_sha256': hashlib.sha256((ROOT / filename).read_bytes()).hexdigest(),
               'status': 'attempt_started', 'verified': False}
    with receipt_path.open('x') as f:
        json.dump(receipt, f, indent=2)
        f.write('\n')
    try:
        result = subprocess.run(cmd, env=env, text=True, capture_output=True, timeout=30)
        receipt.update(returncode=result.returncode, stdout=result.stdout.replace(password, '[REDACTED]'),
                       stderr=result.stderr.replace(password, '[REDACTED]'), status='returned')
        assert result.returncode == 0, 'psql failed; stop and inspect receipt'
        if mode == 'preflight':
            receipt['observed'] = json.loads(result.stdout)
            check_preflight(receipt['observed'])
            receipt['verified'] = True
        elif mode == 'apply':
            receipt['commit_acknowledged'] = 'COMMIT' in result.stdout.splitlines()
            assert receipt['commit_acknowledged'], 'COMMIT not acknowledged; reconcile before acting'
        # Exact postcheck result is interpreted separately; command success is insufficient.
    except BaseException as exc:
        receipt['status'] = 'stopped'
        receipt['error'] = str(exc).replace(password, '[REDACTED]')
        if isinstance(exc, subprocess.TimeoutExpired):
            receipt['outcome'] = 'uncertain; reconcile exact rows before any action'
        raise
    finally:
        receipt['finished_at'] = now()
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
        print(json.dumps({k: receipt[k] for k in ('mode', 'status', 'verified', 'started_at', 'finished_at')}))


if __name__ == '__main__':
    main()
