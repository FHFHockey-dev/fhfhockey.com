"""Synthetic-only context capture checks. No network, credentials or private input."""
from datetime import date, timedelta
import json
from pathlib import Path
import runpy
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

M = runpy.run_path(str(Path(__file__).with_name('capture-nhl-context.py')))
NOW = '2026-10-16T04:00:00Z'
HEADER_DATE = 'Fri, 16 Oct 2026 04:00:00 GMT'


def fixture(root):
    ids = M['CLUBS'] + [i for i in range(1, 60) if i not in M['CLUBS']][:19]
    teams = [{'teamId': team, 'abbreviation': 'Q' + chr(65 + i // 26) + chr(65 + i % 26)} for i, team in enumerate(ids)]
    directory = {row['teamId']: row['abbreviation'] for row in teams}
    sources = []
    for i in range(2):
        path = root / f'approved-metadata-{i}.json'
        path.write_bytes(b'{"synthetic":true}')
        sources.append({'path': str(path), 'sha256': M['sha'](path.read_bytes())})
    data = {'version': 'forge-rso-nhl-context-allocation-v1', 'seasonId': 20262027,
        'historicalDates': ['2026-09-29', '2026-10-12'], 'futureDates': ['2026-10-16', '2026-12-17'],
        'protectedOutcomeDates': ['2026-10-13', '2026-10-25'], 'scheduleDates': M['HISTORICAL'] + M['FUTURE'],
        'rosterClubIds': M['CLUBS'], 'teamDirectory': teams,
        'roster': [{'playerId': 1000+i, 'nhlPlayerId': 9000000+i, 'teamId': M['CLUBS'][i % 13]} for i in range(19)],
        'bindingSources': sources, 'wholeBodyExposure': 'Synthetic whole-body scope only'}
    data['requests'] = [f'https://api-web.nhle.com/v1/schedule/{day}' for day in data['scheduleDates']] + [
        f'https://api-web.nhle.com/v1/roster/{directory[team]}/20262027' for team in M['CLUBS']]
    return data


def body_for(request, data, index):
    if request['kind'] == 'roster':
        return {'forwards': [{'id': row['nhlPlayerId']} for row in data['roster'] if row['teamId'] == request['teamId']], 'defensemen': [], 'goalies': []}
    start = date.fromisoformat(request['date'])
    days = [{'date': (start + timedelta(days=i)).isoformat(), 'games': []} for i in range(7)]
    teams = data['teamDirectory']
    days[0]['games'] = [{'id': 2026020001 + index * 100, 'season': 20262027, 'gameType': 2,
        'gameDate': request['date'], 'startTimeUTC': request['date'] + 'T23:00:00Z',
        'gameState': 'FINAL' if request['kind'] == 'historical' else 'FUT',
        'homeTeam': {'id': teams[0]['teamId'], 'abbrev': teams[0]['abbreviation']},
        'awayTeam': {'id': teams[1]['teamId'], 'abbrev': teams[1]['abbreviation']}}]
    return {'gameWeek': days}


def continuation_fixture(root):
    data = fixture(root)
    original_requests = M['validate'](data)
    rows, events = [], []
    for index, request in enumerate(original_requests[:3]):
        payload = body_for(request, data, index)
        if index == 2:
            payload['gameWeek'][0]['games'][0]['periodDescriptor'] = {'number': 1, 'periodType': 'REG', 'maxRegulationPeriods': 3}
        raw = json.dumps(payload).encode()
        path = root / f'original-{index}.json'
        M['private_write'](path, raw)
        rows.append({'url': request['url'], 'path': str(path), 'bodySha256': M['sha'](raw), 'capturedAt': NOW,
            'status': 'successful_historical' if index < 2 else 'quarantined_pregame_requires_new_approval'})
        events += [{'action': 'original_body_retained', 'url': request['url'], 'bodySha256': M['sha'](raw), 'capturedAt': NOW},
            {'action': 'whole_body_validated' if index < 2 else 'failed_stopped', 'url': request['url']}]
    ledger = root / 'old-exposure-ledger.jsonl'
    M['private_write'](ledger, ('\n'.join(json.dumps(row) for row in events) + '\n').encode())
    data.update({'version': 'forge-rso-nhl-context-continuation-v1', 'requests': data['requests'][3:],
        'scheduleDates': M['FUTURE'][1:], 'reuse': rows, 'priorCaptureLedger': {'path': str(ledger), 'sha256': M['sha'](ledger.read_bytes())}})
    return data


class ContextCaptureTests(unittest.TestCase):
    def test_exact_scope_and_plan_mode_without_opening_binding_sources(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = fixture(root)
            self.assertEqual(len(M['validate'](data)), 24)
            data['bindingSources'][0]['path'] = '/does/not/exist/no-secret-read'
            allocation = root / 'allocation.json'
            allocation.write_text(json.dumps(data))
            result = subprocess.run([sys.executable, str(Path(__file__).with_name('capture-nhl-context.py')), '--allocation', str(allocation)],
                check=True, capture_output=True, text=True)
            self.assertEqual(json.loads(result.stdout)['sourceRequests'], 0)
            self.assertEqual(json.loads(result.stdout)['mode'], 'plan_only')
            for change in ('query', 'host', 'extra', 'protected', 'club', 'duplicate'):
                invalid = json.loads(json.dumps(data))
                if change == 'query': invalid['requests'][0] += '?refresh=1'
                if change == 'host': invalid['requests'][0] = invalid['requests'][0].replace('api-web.nhle.com', 'elsewhere.invalid')
                if change == 'extra': invalid['requests'].append(invalid['requests'][0])
                if change == 'protected': invalid['scheduleDates'][0] = '2026-10-13'
                if change == 'club': invalid['rosterClubIds'][0] = 99
                if change == 'duplicate': invalid['roster'][1]['nhlPlayerId'] = invalid['roster'][0]['nhlPlayerId']
                with self.assertRaises((ValueError, KeyError)):
                    M['validate'](invalid)

    def test_schedule_complete_days_empty_days_and_pregame_only(self):
        with tempfile.TemporaryDirectory() as temp:
            data = fixture(Path(temp))
            requests = M['validate'](data)
            for kind in ('historical', 'future'):
                request = next(row for row in requests if row['kind'] == kind)
                payload = body_for(request, data, 0)
                self.assertEqual(len(M['validate_payload'](payload, request, data, NOW)['emptyDates']), 6)
                for change in ('missing', 'unexpected_protected', 'duplicate_day', 'wrong_club', 'wrong_season', 'wrong_id', 'wrong_date', 'duplicate_game'):
                    invalid = json.loads(json.dumps(payload))
                    game = invalid['gameWeek'][0]['games'][0]
                    if change == 'missing': invalid['gameWeek'].pop()
                    if change == 'unexpected_protected': invalid['gameWeek'][-1]['date'] = '2026-10-13'
                    if change == 'duplicate_day': invalid['gameWeek'][-1]['date'] = invalid['gameWeek'][0]['date']
                    if change == 'wrong_club': game['homeTeam']['abbrev'] = 'BAD'
                    if change == 'wrong_season': game['season'] = 20252026
                    if change == 'wrong_id': game['id'] = 2025020001
                    if change == 'wrong_date': game['gameDate'] = '2026-10-13'
                    if change == 'duplicate_game': invalid['gameWeek'][0]['games'].append(game)
                    with self.assertRaises(ValueError): M['validate_payload'](invalid, request, data, NOW)
            future = next(row for row in requests if row['kind'] == 'future')
            placeholder = body_for(future, data, 2)
            placeholder['gameWeek'][0]['games'][0]['periodDescriptor'] = {'number': 1, 'periodType': 'REG', 'maxRegulationPeriods': 3}
            self.assertEqual(M['validate_payload'](placeholder, future, data, NOW)['games'], 1)
            for descriptor in ({'number': 2, 'periodType': 'REG', 'maxRegulationPeriods': 3},
                    {'number': True, 'periodType': 'REG', 'maxRegulationPeriods': 3},
                    {'number': 1, 'periodType': 'REG', 'maxRegulationPeriods': 3, 'unexpected': 'field'}):
                invalid = json.loads(json.dumps(placeholder))
                invalid['gameWeek'][0]['games'][0]['periodDescriptor'] = descriptor
                with self.assertRaises(ValueError): M['validate_payload'](invalid, future, data, NOW)
            for change in ('final', 'score', 'started', 'outcome', 'winner', 'scorer'):
                payload = json.loads(json.dumps(placeholder))
                game = payload['gameWeek'][0]['games'][0]
                if change == 'final': game['gameState'] = 'OFF'
                if change == 'score': game['homeTeam']['score'] = 0
                if change == 'started': game['startTimeUTC'] = '2026-10-16T03:00:00Z'
                if change == 'outcome': game['gameOutcome'] = {'lastPeriodType': 'REG'}
                if change == 'winner': game['winningGoalie'] = {}
                if change == 'scorer': game['winningGoalScorer'] = {}
                with self.assertRaises(ValueError): M['validate_payload'](payload, future, data, NOW)

    def test_schema_family_optional_schedule_metadata_and_null_game_date(self):
        with tempfile.TemporaryDirectory() as temp:
            data = fixture(Path(temp))
            request = M['validate'](data)[2]
            payload = body_for(request, data, 2)
            payload.update({'numberOfGames': 1, 'nextStartDate': '2026-10-23', 'previousStartDate': '2026-10-09',
                'regularSeasonStartDate': '2026-09-29', 'playoffEndDate': '2027-06-30', 'oddsPartners': []})
            for day in payload['gameWeek']:
                day.update({'dayAbbrev': 'FRI', 'datePromo': [], 'numberOfGames': len(day['games'])})
            game = payload['gameWeek'][0]['games'][0]
            game.update({'gameDate': None, 'venue': {'default': 'Synthetic venue'}, 'tvBroadcasts': [],
                'periodDescriptor': {'number': 1, 'periodType': 'REG', 'maxRegulationPeriods': 3}})
            for state in ('FUT', 'PRE'):
                game['gameState'] = state
                self.assertEqual(M['validate_payload'](payload, request, data, NOW)['games'], 1)
            del game['gameDate']
            self.assertEqual(M['validate_payload'](payload, request, data, NOW)['games'], 1)
            for change in ('top_count', 'day_count', 'missing_start', 'null_start'):
                invalid = json.loads(json.dumps(payload))
                if change == 'top_count': invalid['numberOfGames'] = 2
                if change == 'day_count': invalid['gameWeek'][1]['numberOfGames'] = 1
                if change == 'missing_start': del invalid['gameWeek'][0]['games'][0]['startTimeUTC']
                if change == 'null_start': invalid['gameWeek'][0]['games'][0]['startTimeUTC'] = None
                with self.assertRaises((ValueError, AttributeError)): M['validate_payload'](invalid, request, data, NOW)
            empty = json.loads(json.dumps(payload))
            empty['numberOfGames'] = 0
            for day in empty['gameWeek']:
                day['games'] = []
                day['numberOfGames'] = 0
            self.assertEqual(len(M['validate_payload'](empty, request, data, NOW)['emptyDates']), 7)

    def test_schema_family_roster_optional_metadata_is_not_eligibility(self):
        with tempfile.TemporaryDirectory() as temp:
            data = fixture(Path(temp))
            request = M['validate'](data)[11]
            payload = body_for(request, data, 11)
            payload.update({'teamId': request['teamId'], 'teamAbbrev': request['abbreviation'], 'seasonId': 20262027,
                'season': 20262027, 'teamName': {'default': 'Synthetic club'}})
            payload['forwards'][0].update({'firstName': {'default': 'Synthetic'}, 'lastName': {'default': 'Player'},
                'sweaterNumber': None, 'birthDate': '2000-01-01', 'positionCode': 'C', 'headshot': None})
            result = M['validate_payload'](payload, request, data, NOW)
            self.assertTrue(result['bindings'][0]['present'])
            self.assertFalse(result['historicalEligibilityEstablished'])
            for field in ('teamId', 'teamAbbrev', 'seasonId', 'season'):
                invalid = json.loads(json.dumps(payload))
                invalid[field] = 'wrong'
                with self.assertRaises(ValueError): M['validate_payload'](invalid, request, data, NOW)
            for field in ('forwards', 'defensemen', 'goalies'):
                invalid = json.loads(json.dumps(payload))
                invalid[field] = None
                with self.assertRaises(ValueError): M['validate_payload'](invalid, request, data, NOW)
            duplicate = json.loads(json.dumps(payload))
            duplicate['goalies'] = [duplicate['forwards'][0]]
            with self.assertRaises(ValueError): M['validate_payload'](duplicate, request, data, NOW)

    def test_roster_identity_absence_stays_unknown_and_no_historical_eligibility(self):
        with tempfile.TemporaryDirectory() as temp:
            data = fixture(Path(temp))
            request = M['validate'](data)[11]
            payload = body_for(request, data, 11)
            result = M['validate_payload'](payload, request, data, NOW)
            self.assertFalse(result['historicalEligibilityEstablished'])
            self.assertTrue(result['bindings'][0]['present'])
            payload['forwards'] = [{'id': 8000001}]
            result = M['validate_payload'](payload, request, data, NOW)
            self.assertFalse(result['bindings'][0]['present'])
            self.assertEqual(result['absenceMeaning'], 'unknown')
            payload['teamId'] = 99
            with self.assertRaises(ValueError): M['validate_payload'](payload, request, data, NOW)

    def test_serial_capture_preserves_original_bytes_and_exclusive_private_outputs(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = fixture(root)
            requests = M['validate'](data)
            raw = json.dumps(data).encode()
            calls, sleeps = [], []
            def fetch(url, path, maximum, timeout, allocation_path, digest):
                index = len(calls)
                self.assertEqual(url, requests[index]['url'])
                self.assertEqual(maximum, M['MAX_BODY'])
                self.assertEqual(timeout, 8)
                self.assertEqual(M['sha'](allocation_path.read_bytes()), digest)
                calls.append(url)
                M['private_write'](path, (json.dumps(body_for(requests[index], data, index)) + '\n').encode())
                return {'sourceDate': HEADER_DATE, 'age': '0'}
            with patch.dict(M['capture'].__globals__, {'clock': lambda: NOW}):
                output = root / 'out'
                result = M['capture'](raw, M['sha'](raw), 'synthetic-only', output, fetch, lambda: 0, sleeps.append)
                self.assertEqual(result['successfulRequests'], 24)
                self.assertEqual(len(calls), 24)
                self.assertEqual(sleeps, [1] * 23)
                receipt = json.loads((output / 'receipts.json').read_bytes())
                self.assertEqual(len(receipt['receipts']), 24)
                first = receipt['receipts'][0]
                body = (output / '01-historical.json').read_bytes()
                self.assertEqual(first['rawBody'].encode(), body)
                self.assertEqual(first['bodySha256'], M['sha'](body))
                self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o700)
                self.assertTrue(all(stat.S_IMODE(path.stat().st_mode) == 0o600 for path in output.iterdir()))
                with self.assertRaises(FileExistsError): M['capture'](raw, M['sha'](raw), 'synthetic-only', output, fetch)

    def test_first_failure_retains_bytes_no_retry_and_future_outcome_quarantined(self):
        for mode in ('partial', 'stale', 'future_outcome', 'duplicate_cross_page'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                data = fixture(root)
                requests = M['validate'](data)
                raw = json.dumps(data).encode()
                calls = []
                def fetch(url, path, maximum, timeout, allocation_path, digest):
                    index = len(calls)
                    calls.append(url)
                    payload = body_for(requests[index], data, index)
                    if mode == 'partial':
                        M['private_write'](path, b'{partial')
                        raise M['TransportFailure']('synthetic_interruption')
                    if mode == 'future_outcome' and index == 2: payload['gameWeek'][0]['games'][0]['homeTeam']['score'] = 1
                    if mode == 'duplicate_cross_page' and index == 1: payload['gameWeek'][0]['games'][0]['id'] = 2026020001
                    M['private_write'](path, json.dumps(payload).encode())
                    return {'sourceDate': HEADER_DATE if mode != 'stale' else 'Thu, 15 Oct 2026 04:00:00 GMT'}
                with patch.dict(M['capture'].__globals__, {'clock': lambda: NOW}):
                    output = root / 'out'
                    result = M['capture'](raw, M['sha'](raw), 'synthetic-only', output, fetch, lambda: 0, lambda _: None)
                self.assertEqual(result['failures'], 1)
                expected = {'partial': 1, 'stale': 1, 'future_outcome': 3, 'duplicate_cross_page': 2}[mode]
                self.assertEqual(len(calls), expected)
                self.assertEqual(result['unattemptedRequests'], 24 - expected)
                ledger = [json.loads(line) for line in (output / 'exposure-ledger.jsonl').read_text().splitlines()]
                self.assertEqual(ledger[-1]['action'], 'failed_stopped')
                self.assertTrue(ledger[-1]['unexpectedScopeMustBeReviewed'])
                self.assertGreater(ledger[-1]['bodyBytes'], 0)

    def test_exact_approval_and_changed_metadata_stop_before_transport(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = fixture(root)
            raw = json.dumps(data).encode()
            def forbidden(*args): self.fail('Network must not be called')
            with self.assertRaises(ValueError): M['capture'](raw, '0' * 64, 'synthetic', root / 'out', forbidden)
            Path(data['bindingSources'][0]['path']).write_text('changed')
            with self.assertRaises(ValueError): M['capture'](raw, M['sha'](raw), 'synthetic', root / 'out', forbidden)
            self.assertFalse((root / 'out').exists())

    def test_child_scope_rejects_arbitrary_url_or_maximum_before_connection(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = fixture(root)
            raw = json.dumps(data).encode()
            allocation = root / 'allocation.json'
            allocation.write_bytes(raw)
            for i, (url, maximum) in enumerate([(data['requests'][0] + '?unexpected=1', 10), (data['requests'][0], M['MAX_BODY'] + 1)]):
                path = root / f'body-{i}'
                with patch.object(M['worker_entry'].__globals__['http'].client, 'HTTPSConnection', side_effect=AssertionError('No connection permitted')):
                    M['worker_entry'](url, path, maximum, allocation, M['sha'](raw))
                diagnostic = json.loads(Path(str(path) + '.transport.json').read_bytes())
                self.assertEqual(diagnostic['reason'], 'child_scope_denied')
                self.assertFalse(path.exists())

    def test_child_redirect_and_byte_ceiling_stop_without_follow_or_retry(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = fixture(root)
            raw = json.dumps(data).encode()
            allocation = root / 'allocation.json'
            allocation.write_bytes(raw)
            class Context:
                def get_ca_certs(self): return ['synthetic']
            for status in (302, 200):
                calls = []
                class Response:
                    def getheader(self, name, default=None): return 'identity' if name == 'Content-Encoding' else HEADER_DATE if name == 'Date' else default
                    def read1(self, maximum): return b'x' * maximum
                response = Response()
                response.status = status
                class Connection:
                    def __init__(self, host, timeout, context): self.host = host
                    def request(self, method, path, headers):
                        calls.append((method, path))
                        self_headers = {key.lower() for key in headers}
                        assert 'authorization' not in self_headers and 'apikey' not in self_headers
                    def getresponse(self): return response
                    def close(self): pass
                path = root / f'body-{status}'
                g = M['worker_entry'].__globals__
                with patch.object(g['ssl'], 'create_default_context', return_value=Context()), patch.object(g['http'].client, 'HTTPSConnection', Connection):
                    M['worker_entry'](data['requests'][0], path, 8, allocation, M['sha'](raw))
                diagnostic = json.loads(Path(str(path) + '.transport.json').read_bytes())
                self.assertEqual(diagnostic['reason'], 'http_status_302' if status == 302 else 'body_byte_ceiling_reached')
                self.assertEqual(len(calls), 1)
                self.assertEqual(path.stat().st_size, 0 if status == 302 else 8)

    def test_intent_fsync_exhausting_total_budget_does_not_launch_or_count_request(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = fixture(root)
            raw = json.dumps(data).encode()
            elapsed = [0]
            def forbidden(*args): self.fail('No child or source request may launch')
            def durable_intent(_fd): elapsed[0] = 240
            g = M['capture'].__globals__
            with patch.object(g['os'], 'fsync', side_effect=durable_intent):
                result = M['capture'](raw, M['sha'](raw), 'synthetic', root / 'out', forbidden, lambda: elapsed[0], lambda _: None)
            self.assertEqual(result['attemptedRequests'], 0)
            self.assertEqual(result['unattemptedRequests'], 24)
            self.assertEqual(result['successfulRequests'], 0)
            self.assertEqual(result['failures'], 1)
            ledger = [json.loads(line) for line in (root / 'out' / 'exposure-ledger.jsonl').read_text().splitlines()]
            self.assertEqual([row['action'] for row in ledger], ['acquisition_intent', 'acquisition_not_started'])
            self.assertEqual(ledger[-1]['reason'], 'total_time_exhausted_before_request')
            self.assertFalse((root / 'out' / '01-historical.json').exists())

    def test_continuation_has_exact_twenty_one_new_requests_and_explicit_three_source_reuse(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = continuation_fixture(root)
            requests = M['validate'](data)
            self.assertEqual(len(requests), 21)
            self.assertEqual(requests[0]['date'], '2026-10-23')
            self.assertFalse({row['url'] for row in requests}.intersection(row['url'] for row in data['reuse']))
            calls = []
            def fetch(url, path, maximum, timeout, allocation_path, digest):
                index = len(calls)
                self.assertEqual(url, requests[index]['url'])
                self.assertEqual(timeout, 8)
                calls.append(url)
                M['private_write'](path, json.dumps(body_for(requests[index], data, index + 3)).encode())
                return {'sourceDate': HEADER_DATE}
            raw = json.dumps(data).encode()
            with patch.dict(M['capture'].__globals__, {'clock': lambda: NOW}):
                result = M['capture'](raw, M['sha'](raw), 'new-explicit-approval', root / 'out', fetch, lambda: 0, lambda _: None)
            self.assertEqual(result['successfulRequests'], 21)
            self.assertEqual(result['attemptedRequests'], 21)
            receipt = json.loads((root / 'out' / 'receipts.json').read_bytes())
            self.assertEqual(len(receipt['reusedReceipts']), 3)
            self.assertEqual(receipt['plannedRequests'], 21)
            self.assertEqual(receipt['reusedReceipts'][2]['capturedAt'], NOW)
            self.assertEqual(receipt['reusedReceipts'][2]['bodySha256'], data['reuse'][2]['bodySha256'])
            ticks = iter([0, 210])
            with patch.dict(M['capture'].__globals__, {'clock': lambda: NOW}):
                exhausted = M['capture'](raw, M['sha'](raw), 'new-explicit-approval', root / 'expired-out',
                    lambda *args: self.fail('No request beyond continuation210-second budget'), lambda: next(ticks), lambda _: None)
            self.assertEqual(exhausted['attemptedRequests'], 0)
            self.assertEqual(exhausted['unattemptedRequests'], 21)
            plan = json.loads(raw)
            plan['reuse'][2]['path'] = '/must/not/be/opened/quarantined-body'
            plan['priorCaptureLedger']['path'] = '/must/not/be/opened/ledger'
            allocation = root / 'continuation-plan.json'
            allocation.write_text(json.dumps(plan))
            planned = subprocess.run([sys.executable, str(Path(__file__).with_name('capture-nhl-context.py')), '--allocation', str(allocation)], check=True, capture_output=True, text=True)
            self.assertEqual(json.loads(planned.stdout)['requests'], 21)
            self.assertEqual(json.loads(planned.stdout)['sourceRequests'], 0)
            invalid = json.loads(raw)
            invalid['requests'].insert(0, data['reuse'][0]['url'])
            with self.assertRaises(ValueError): M['validate'](invalid)

    def test_continuation_changed_quarantine_stops_before_any_new_request(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = continuation_fixture(root)
            Path(data['reuse'][2]['path']).write_text('changed')
            raw = json.dumps(data).encode()
            def forbidden(*args): self.fail('Quarantine failure cannot launch a request')
            with patch.dict(M['capture'].__globals__, {'clock': lambda: NOW}):
                result = M['capture'](raw, M['sha'](raw), 'new-explicit-approval', root / 'out', forbidden, lambda: 0, lambda _: None)
            self.assertEqual(result['attemptedRequests'], 0)
            self.assertEqual(result['unattemptedRequests'], 21)
            self.assertEqual(result['failures'], 1)
            ledger = [json.loads(line) for line in (root / 'out' / 'exposure-ledger.jsonl').read_text().splitlines()]
            self.assertEqual(ledger[-1]['action'], 'approved_reuse_failed_stopped')

    def test_total_deadline_before_first_request(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = fixture(root)
            raw = json.dumps(data).encode()
            ticks = iter([0, 240])
            def forbidden(*args): self.fail('Network must not be called')
            result = M['capture'](raw, M['sha'](raw), 'synthetic', root / 'out', forbidden, lambda: next(ticks), lambda _: None)
            self.assertEqual(result['attemptedRequests'], 0)
            self.assertEqual(result['unattemptedRequests'], 24)


if __name__ == '__main__':
    unittest.main()
