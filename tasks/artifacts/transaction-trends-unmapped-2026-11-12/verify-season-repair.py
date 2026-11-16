"""Exercise the exact repair in a disposable PostgreSQL 15 cluster, never production.

Uses only a temporary Unix socket (TCP disabled), explicit local connection
arguments, and the checked-in evidence. No dotenv, Supabase client or provider.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import select
import subprocess
import sys
import tempfile
import uuid


ROOT = Path(__file__).resolve().parent
BIN = Path('/opt/homebrew/opt/postgresql@15/bin')
EVIDENCE = json.loads((ROOT / 'REPAIR-EVIDENCE.json').read_text())
REPAIR = ROOT / 'repair-season-metadata.sql'


def literal(value):
    if value is None:
        return 'NULL'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        value = json.dumps(value)
    return "'" + str(value).replace("'", "''") + "'"


SCHEMA = """
CREATE TABLE public.seasons (id bigint PRIMARY KEY);
CREATE TABLE public.yahoo_game_keys (game_id integer PRIMARY KEY, game_key text NOT NULL, code text, season integer);
CREATE TABLE public.yahoo_players (
  player_key text PRIMARY KEY, player_id text, game_id integer, season integer,
  full_name text, last_updated timestamp, percent_ownership double precision,
  ownership_timeline jsonb DEFAULT '[]', UNIQUE(player_id,season)
);
CREATE TABLE public.fhfh_player_identities (
  id bigint PRIMARY KEY, nhl_player_id bigint UNIQUE, verification_status text,
  canonical_name text, merged_into_id bigint
);
CREATE TABLE public.fhfh_player_external_identities (
  id uuid PRIMARY KEY, provider text NOT NULL, external_player_id text NOT NULL,
  context_key text NOT NULL, season_id bigint REFERENCES public.seasons(id),
  fhfh_player_id bigint REFERENCES public.fhfh_player_identities(id), verification_status text,
  match_method text, verified_at timestamptz, verified_by_system text,
  source_provenance jsonb NOT NULL, updated_at timestamptz,
  UNIQUE(provider,context_key,external_player_id)
);
CREATE FUNCTION public.set_fhfh_player_identity_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog' AS $$
BEGIN NEW.updated_at = statement_timestamp(); RETURN NEW; END; $$;
CREATE TRIGGER set_fhfh_player_external_identities_updated_at BEFORE UPDATE
ON public.fhfh_player_external_identities FOR EACH ROW
EXECUTE FUNCTION public.set_fhfh_player_identity_updated_at();
"""


def fixture_sql():
    statements = [SCHEMA, 'INSERT INTO public.seasons VALUES (20242025),(20262027);']
    for game in EVIDENCE['gameContexts']:
        statements.append('INSERT INTO public.yahoo_game_keys VALUES (' + ','.join(
            literal(game[k]) for k in ['game_id', 'game_key', 'code', 'season']) + ');')
    for row in EVIDENCE['targets']:
        statements.append('INSERT INTO public.fhfh_player_identities VALUES (' + ','.join(
            literal(row[k]) for k in ['fhfh_player_id', 'nhl_player_id', 'canonical_status', 'canonical_name', 'merged_into_id']) + ');')
        source = [row[k] for k in ['player_key', 'player_id', 'game_id', 'season', 'full_name', 'last_updated']]
        statements.append('INSERT INTO public.yahoo_players (player_key,player_id,game_id,season,full_name,last_updated,percent_ownership) VALUES (' + ','.join(map(literal, source + [42])) + ');')
        external = [row['external_id'], 'yahoo', row['player_key']] + [row[k] for k in [
            'context_key', 'season_id', 'fhfh_player_id', 'external_status', 'match_method',
            'verified_at', 'verified_by_system', 'source_provenance', 'external_updated_at']]
        statements.append('INSERT INTO public.fhfh_player_external_identities VALUES (' + ','.join(map(literal, external)) + ');')
        # Same-player current-season sentinels must remain byte-identical.
        current_key = row['player_key'].replace('453.', '477.', 1)
        statements.append('INSERT INTO public.yahoo_players (player_key,player_id,game_id,season,full_name,last_updated,percent_ownership) VALUES (' + ','.join(map(literal, [current_key, row['player_id'], 477, 2026, row['full_name'], row['last_updated'], 73])) + ');')
        current_external = [str(uuid.uuid5(uuid.NAMESPACE_URL, current_key)), 'yahoo', current_key,
                            'yahoo:game:477:season:2026', 20262027, row['fhfh_player_id'], 'verified',
                            'season_rollover_stable_yahoo_id_exact_name', row['verified_at'], 'synthetic-fixture',
                            {'fixture': True}, row['external_updated_at']]
        statements.append('INSERT INTO public.fhfh_player_external_identities VALUES (' + ','.join(map(literal, current_external)) + ');')
    statements.append(EVIDENCE['reader'][0]['identity_reader_definition'].rstrip(';\n') + ';')
    # Exact identity projection of the captured map view; its omitted lateral
    # join decorates metadata and cannot remove/change these identity columns.
    statements.append('CREATE VIEW public.yahoo_nhl_player_map_read AS SELECT c.external_player_id AS yahoo_player_id,c.nhl_player_id::text AS nhl_player_id FROM public.verified_yahoo_player_identities_read() c JOIN public.yahoo_players y ON y.player_key=c.external_player_id;')
    return '\n'.join(statements)


def main():
    # Remove inherited libpq connection configuration; every call also receives
    # explicit local host/port/database/user arguments.
    env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    env['LC_ALL'] = 'C'
    with tempfile.TemporaryDirectory(prefix='trends-season-repair-', dir='/tmp') as scratch:
        work = Path(scratch)
        data = work / 'data'
        socket = work / 'socket'
        socket.mkdir()
        subprocess.run([str(BIN / 'initdb'), '-D', str(data), '-A', 'trust', '-U', 'fixture', '--no-locale'],
                       env=env, capture_output=True, text=True, check=True, timeout=30)
        started = False
        try:
            subprocess.run([str(BIN / 'pg_ctl'), '-D', str(data), '-l', str(work / 'server.log'),
                            '-o', f"-h '' -k {socket} -p 55439", '-w', 'start'],
                           env=env, capture_output=True, text=True, check=True, timeout=30)
            started = True
            psql = [str(BIN / 'psql'), '-X', '-h', str(socket), '-p', '55439', '-U', 'fixture',
                    '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq']

            def run(sql, success=True):
                result = subprocess.run(psql, input=sql, env=env, capture_output=True, text=True, timeout=15)
                if success and result.returncode:
                    raise AssertionError(result.stderr)
                if not success and not result.returncode:
                    raise AssertionError('Expected repair to reject fixture')
                return result

            def reset():
                run('DROP SCHEMA public CASCADE; CREATE SCHEMA public;\n' + fixture_sql())

            def snapshot():
                tables = ['yahoo_players', 'fhfh_player_external_identities', 'fhfh_player_identities', 'yahoo_game_keys', 'seasons']
                return {table: json.loads(run(f'SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),\'[]\') FROM public.{table} t;').stdout) for table in tables}

            def repaired_count():
                return int(run("SELECT count(*) FROM public.verified_yahoo_player_identities_read() WHERE external_player_id LIKE '453.p.%';").stdout)

            def readback_passes():
                lines = run((ROOT / 'post-repair-check.sql').read_text()).stdout.splitlines()
                return len(lines) == 3 and all(line.split('|')[2:] == ['t'] * 5 for line in lines)

            repair = REPAIR.read_text()
            apply = '\\set commit_repair 1\n' + repair
            reset()
            before = snapshot()
            assert repaired_count() == 0
            assert not readback_passes(), 'Postcheck accepted unrepaired rows'
            run(repair)
            assert snapshot() == before, 'Default rollback changed data'
            run(apply)
            assert repaired_count() == 3
            assert readback_passes(), 'Postcheck rejected completed repair'
            after = snapshot()
            targets = {r['player_key'] for r in EVIDENCE['targets']}
            external_ids = {r['external_id'] for r in EVIDENCE['targets']}
            for old in before['yahoo_players']:
                new = next(r for r in after['yahoo_players'] if r['player_key'] == old['player_key'])
                assert new == {**old, **({'season': 2024} if old['player_key'] in targets else {})}
            for old in before['fhfh_player_external_identities']:
                new = next(r for r in after['fhfh_player_external_identities'] if r['id'] == old['id'])
                if old['id'] not in external_ids:
                    assert new == old
                    continue
                assert new['season_id'] == 20242025 and new['context_key'] == 'yahoo:game:453:season:2024'
                provenance = dict(new['source_provenance'])
                assert provenance.pop('season_metadata_repair')['from_season_id'] is None
                assert provenance == old['source_provenance']
                for key in old.keys() - {'season_id', 'context_key', 'source_provenance', 'updated_at'}:
                    assert new[key] == old[key], key
            for table in ['fhfh_player_identities', 'yahoo_game_keys', 'seasons']:
                assert before[table] == after[table], table
            run(apply)
            assert snapshot() == after, 'Idempotent retry changed data'
            print('PASS: default rollback; exact six-row metadata repair; admission 0 -> 3; identity/provenance/current-season preservation; idempotence')

            cases = {
                'catalogue drift': "UPDATE public.yahoo_game_keys SET season=2023 WHERE game_id=453;",
                'catalogue ambiguity': "INSERT INTO public.yahoo_game_keys VALUES (999,'453','nhl',2024);",
                'missing canonical season': 'DELETE FROM public.seasons WHERE id=20242025;',
                'missing source': "DELETE FROM public.yahoo_players WHERE player_key='453.p.30111';",
                'source drift': "UPDATE public.yahoo_players SET last_updated=now() WHERE player_key='453.p.30111';",
                'partial source repair': "UPDATE public.yahoo_players SET season=2024 WHERE player_key='453.p.30111';",
                'mixed repair state': "UPDATE public.yahoo_players SET season=2024 WHERE player_key='453.p.30111'; UPDATE public.fhfh_player_external_identities SET season_id=20242025,context_key='yahoo:game:453:season:2024',source_provenance=source_provenance || '{\"season_metadata_repair\":{\"id\":\"transaction-trends-season-metadata-20261112-three-keys-v1\"}}'::jsonb WHERE external_player_id='453.p.30111';",
                'canonical identity changed': "UPDATE public.fhfh_player_identities SET nhl_player_id=9999999 WHERE id=10251;",
                'canonical unverified': "UPDATE public.fhfh_player_identities SET verification_status='review_required' WHERE id=10251;",
                'canonical merged': 'UPDATE public.fhfh_player_identities SET merged_into_id=8946 WHERE id=10251;',
                'external unverified': "UPDATE public.fhfh_player_external_identities SET verification_status='review_required' WHERE external_player_id='453.p.30111';",
                'external provenance changed': "UPDATE public.fhfh_player_external_identities SET source_provenance='{}' WHERE external_player_id='453.p.30111';",
                'season identity conflict': "INSERT INTO public.fhfh_player_external_identities SELECT '00000000-0000-4000-8000-000000000001',provider,external_player_id,'yahoo:game:453:season:2024',20242025,fhfh_player_id,verification_status,match_method,verified_at,verified_by_system,source_provenance,updated_at FROM public.fhfh_player_external_identities WHERE external_player_id='453.p.30111';",
                'source unique-key collision': "INSERT INTO public.yahoo_players SELECT '999.p.30111',player_id,999,2024,full_name,last_updated,percent_ownership,ownership_timeline FROM public.yahoo_players WHERE player_key='453.p.30111';",
            }
            for name, mutate in cases.items():
                reset()
                run(mutate)
                changed_before = snapshot()
                error = run(apply, success=False).stderr
                if name in {'catalogue drift', 'catalogue ambiguity'}:
                    expected_error = 'Yahoo game/season catalogue changed'
                elif name == 'missing canonical season':
                    expected_error = 'Canonical season missing'
                elif name == 'missing source':
                    expected_error = 'query returned no rows'
                elif name == 'partial source repair':
                    expected_error = 'Unexpected or partially repaired season state'
                elif name == 'mixed repair state':
                    expected_error = 'Mixed repair state'
                elif name in {'season identity conflict', 'source unique-key collision'}:
                    expected_error = 'Target season or identity conflict'
                else:
                    expected_error = 'Captured identity/source changed'
                assert expected_error in error, (name, error)
                assert snapshot() == changed_before, name + ' left partial changes'
                print('PASS: rejects ' + name + ' atomically')

            # A late reader failure must undo both updates, not merely fail a
            # preflight before the first write.
            reset()
            run("CREATE OR REPLACE FUNCTION public.verified_yahoo_player_identities_read() RETURNS TABLE(external_player_id text,season_id bigint,fhfh_player_id bigint,nhl_player_id bigint,canonical_name text) LANGUAGE sql AS $$ SELECT null::text,null::bigint,null::bigint,null::bigint,null::text WHERE false $$;")
            late_before = snapshot()
            assert 'Repaired identities were not admitted' in run(apply, success=False).stderr
            assert snapshot() == late_before
            print('PASS: late admission failure rolls back both table updates')

            # An idle competing transaction is deliberately outside the global
            # activity guard; the exact target-row lock must still fail safely.
            reset()
            locked_before = snapshot()
            locker = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, env=env, text=True, bufsize=1)
            try:
                locker.stdin.write("BEGIN; SELECT player_key FROM public.yahoo_players WHERE player_key='453.p.30000' FOR UPDATE;\n")
                locker.stdin.flush()
                assert select.select([locker.stdout], [], [], 5)[0], 'Lock handshake timed out'
                assert locker.stdout.readline().strip() == '453.p.30000'
                assert 'canceling statement due to lock timeout' in run(apply, success=False).stderr
            finally:
                locker.communicate('ROLLBACK;\n', timeout=5)
            assert snapshot() == locked_before
            print('PASS: competing target-row lock times out without partial writes')

            reset()
            run(apply)
            run("UPDATE public.fhfh_player_external_identities SET source_provenance=jsonb_set(source_provenance,'{season_metadata_repair,source}','\"wrong-source\"') WHERE external_player_id='453.p.30111';")
            assert not readback_passes(), 'Postcheck accepted damaged repair provenance'
            reset()
            run(apply)
            run('CREATE OR REPLACE VIEW public.yahoo_nhl_player_map_read AS SELECT c.external_player_id AS yahoo_player_id,c.nhl_player_id::text AS nhl_player_id FROM public.verified_yahoo_player_identities_read() c CROSS JOIN generate_series(1,2) duplicate;')
            assert not readback_passes(), 'Postcheck accepted duplicate mappings'
            print('PASS: postcheck rejects unrepaired/damaged/duplicate results and accepts exact repaired result')
            print(f'{3 + len(cases) + 1 + 1 + 4} scenarios passed; local PostgreSQL 15; no TCP or remote calls')
        finally:
            if started:
                subprocess.run([str(BIN / 'pg_ctl'), '-D', str(data), '-m', 'fast', '-w', 'stop'],
                               env=env, capture_output=True, text=True, check=True, timeout=30)


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        print(error.stdout or '', file=sys.stderr)
        print(error.stderr or '', file=sys.stderr)
        raise
