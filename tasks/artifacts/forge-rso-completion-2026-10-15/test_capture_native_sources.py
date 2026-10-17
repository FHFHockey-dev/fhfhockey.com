"""Synthetic transport checks: no external connection is created."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('capture', Path(__file__).with_name('capture-native-sources.py'))
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)
summary_spec = importlib.util.spec_from_file_location('summary_capture', Path(__file__).with_name('capture-goalie-summaries.py'))
summary = importlib.util.module_from_spec(summary_spec)
summary_spec.loader.exec_module(summary)


class CaptureChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        reserved = self.root / 'reservations.json'
        reserved.write_text('{"days": []}')
        game = {'id': 2026020001, 'date': '2026-10-01', 'seasonId': 20262027,
                'type': 2, 'homeTeamId': 1, 'awayTeamId': 2}
        self.data = {'version': 'forge-rso-native-capture-allocation-v1', 'seasonId': 20262027,
                     'games': [game], 'reservedGameIds': [],
                     'reservationMetadata': {'path': str(reserved), 'sha256': capture.sha(reserved.read_bytes())},
                     'requests': [f'https://api-web.nhle.com/v1/gamecenter/2026020001/{e}' for e in ('boxscore', 'landing')]}
        self.body = json.dumps({'id': game['id'], 'gameDate': game['date'], 'season': 20262027,
                                'gameType': 2, 'homeTeam': {'id': 1}, 'awayTeam': {'id': 2}, 'gameState': 'OFF'}).encode()
        self.calls = []

    def run_capture(self, status=200, body=None, encoding='identity'):
        calls, content = self.calls, self.body if body is None else body

        class Connection:
            sock = None

            def __init__(self, host, timeout, context):
                assert host == capture.HOST and 0 < timeout <= 8
                assert context.check_hostname and context.verify_mode == capture.ssl.CERT_REQUIRED
                assert context.get_ca_certs()
                self.offset = 0

            def request(self, method, path, headers):
                calls.append(path)
                assert method == 'GET' and 'Authorization' not in headers and 'Cookie' not in headers

            def getresponse(self):
                self.status = status
                return self

            def getheader(self, name, default):
                return encoding

            def read1(self, size):
                chunk = content[self.offset:self.offset + size]
                self.offset += len(chunk)
                return chunk

            def close(self):
                pass

        def fetch_body(url, path, maximum, timeout):
            assert 0 < timeout <= 8
            with patch.object(capture.http.client, 'HTTPSConnection', Connection):
                capture.transport_worker(url, path, maximum)

        with patch.object(capture.time, 'sleep'), patch('socket.create_connection', side_effect=AssertionError('Network forbidden')):
            return capture.capture(self.data, 'synthetic-allocation', 'synthetic-test-only', self.root / 'out', fetch_body)

    def test_success_retains_exact_bytes_and_logs_decode_without_values(self):
        result = self.run_capture()
        self.assertEqual(result['successfulRequests'], 2)
        self.assertEqual(result['unattemptedRequests'], 0)
        receipts = json.loads((self.root / 'out/receipts.json').read_text())['receipts']
        self.assertEqual(receipts[0]['rawBody'].encode(), self.body)
        self.assertEqual(receipts[0]['bodySha256'], capture.sha(self.body))
        self.assertEqual((self.root / 'out/receipts.json').stat().st_mode & 0o777, 0o600)
        ledger = [json.loads(x) for x in (self.root / 'out/exposure-ledger.jsonl').read_text().splitlines()]
        self.assertEqual([x['action'] for x in ledger[:4]], ['acquisition_intent', 'acquisition_retained',
                         'whole_body_decode_intent', 'whole_body_decode_completed'])
        self.assertTrue(all('rawBody' not in x for x in ledger))
        with self.assertRaises(FileExistsError):
            self.run_capture()
        self.assertEqual(len(self.calls), 2)

    def test_redirect_stops_without_retry(self):
        result = self.run_capture(status=302)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(result['failures'], 1)
        self.assertEqual(result['unattemptedRequests'], 1)

    def test_encoded_body_rejected_without_reading(self):
        self.run_capture(encoding='gzip')
        self.assertEqual((self.root / 'out/2026020001-boxscore.json').stat().st_size, 0)

    def test_byte_limit_stops_and_retains_partial(self):
        result = self.run_capture(body=b'x' * (capture.MAX_BODY + 1))
        self.assertEqual(result['bodyBytes'], capture.MAX_BODY)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(result['failures'], 1)

    def test_wrong_identity_retained_as_failed_exposure(self):
        result = self.run_capture(body=self.body.replace(b'2026020001', b'2026020002'))
        self.assertEqual(result['successfulRequests'], 0)
        self.assertEqual(len(self.calls), 1)
        self.assertTrue((self.root / 'out/2026020001-boxscore.json').exists())

    def test_scope_mutations_rejected(self):
        for mutation in ('date', 'reserved', 'url', 'duplicate'):
            data = copy.deepcopy(self.data)
            if mutation == 'date': data['games'][0]['date'] = '2026-10-13'
            if mutation == 'reserved': data['reservedGameIds'] = [2026020001]
            if mutation == 'url': data['requests'][0] = 'https://example.com/'
            if mutation == 'duplicate': data['games'].append(data['games'][0])
            with self.assertRaises(ValueError): capture.validate(data)

    def test_changed_reservations_rejected_before_request(self):
        Path(self.data['reservationMetadata']['path']).write_text('{"days": [1]}')
        with self.assertRaisesRegex(ValueError, 'metadata changed'):
            self.run_capture()
        self.assertEqual(self.calls, [])

    def test_child_wallclock_deadline_terminates_before_late_side_effect(self):
        late = self.root / 'late.txt'
        command = [sys.executable, '-c', 'import time,pathlib,sys; time.sleep(2); pathlib.Path(sys.argv[1]).touch()', str(late)]
        started = time.monotonic()
        with self.assertRaises(subprocess.TimeoutExpired):
            capture.bounded_process(command, 0.1)
        self.assertLess(time.monotonic() - started, 1.5)
        self.assertFalse(late.exists())

    def test_timeout_retains_partial_bytes_and_stops(self):
        calls = []
        def partial_transport(url, path, maximum, timeout):
            calls.append(url)
            capture.private_write(path, b'{"partial":')
            raise subprocess.TimeoutExpired('synthetic', timeout)
        result = capture.capture(self.data, 'synthetic', 'synthetic-test-only', self.root / 'out', partial_transport)
        self.assertEqual(len(calls), 1)
        self.assertEqual(result['bodyBytes'], 11)
        self.assertEqual(result['failures'], 1)

    def test_child_diagnostics_distinguish_http_tls_and_dns_without_error_text(self):
        for index, (error, reason) in enumerate([
            (capture.SourceHTTPError(404), 'http_status_404'),
            (capture.ssl.SSLCertVerificationError('sensitive fake diagnostic'), 'tls_certificate_verification_failed'),
            (capture.socket.gaierror('sensitive fake diagnostic'), 'dns_resolution_failed'),
        ]):
            path = self.root / f'diagnostic-{index}'
            with patch.object(capture, 'transport_worker', side_effect=error):
                capture.worker_entry(self.data['requests'][0], path, 100)
            diagnostic = Path(str(path) + '.transport.json')
            self.assertEqual(json.loads(diagnostic.read_text()), {'ok': False, 'reason': reason})
            self.assertEqual(diagnostic.stat().st_mode & 0o777, 0o600)

    def test_real_child_startup_reports_failure_without_network(self):
        # Invalid maximum is rejected before constructing any HTTPS connection.
        with self.assertRaisesRegex(capture.TransportFailure, 'ValueError'):
            capture.transport(self.data['requests'][0], self.root / 'child.json', 0, 2)

    def prior_allocation(self):
        data = copy.deepcopy(self.data)
        data.update(version='forge-rso-prior-landing-allocation-v1', seasonId=20252026)
        data['games'] = [{'id': 2025020001, 'date': '2025-10-01', 'seasonId': 20252026,
                          'type': 2, 'homeTeamId': 1, 'awayTeamId': 2, 'startTime': '2025-10-01T23:00:00Z'}]
        data['requests'] = ['https://api-web.nhle.com/v1/gamecenter/2025020001/landing']
        return data

    def test_prior_mode_retains_only_landing_and_records_original_season(self):
        self.data = self.prior_allocation()
        self.body = json.dumps({'id': 2025020001, 'season': 20252026, 'gameType': 2,
                                'gameDate': '2025-10-01', 'gameState': 'OFF',
                                'startTimeUTC': '2025-10-01T23:00:00Z',
                                'homeTeam': {'id': 1}, 'awayTeam': {'id': 2}}).encode()
        result = self.run_capture()
        self.assertEqual(result['successfulRequests'], 1)
        self.assertEqual(self.calls, ['/v1/gamecenter/2025020001/landing'])
        self.assertEqual((self.root / 'out/2025020001-landing.json').read_bytes(), self.body)
        self.assertFalse((self.root / 'out/2025020001-boxscore.json').exists())
        ledger = [json.loads(line) for line in (self.root / 'out/exposure-ledger.jsonl').read_text().splitlines()]
        self.assertTrue(all(row['seasonId'] == 20252026 for row in ledger))
        self.assertTrue(all(row['endpoint'] == 'landing' for row in ledger))

    def test_prior_mode_rejects_protected_dates_extra_endpoints_and_missing_canonical_metadata(self):
        for problem in ('protected Jan3', 'boxscore', 'missing start', 'unknown team', 'wrong season', '21 games'):
            data = self.prior_allocation()
            if problem == 'protected Jan3': data['games'][0]['date'] = '2026-01-03'
            if problem == 'boxscore': data['requests'] = [data['requests'][0].replace('/landing', '/boxscore')]
            if problem == 'missing start': del data['games'][0]['startTime']
            if problem == 'unknown team': data['games'][0]['awayTeamId'] = None
            if problem == 'wrong season': data['games'][0]['seasonId'] = 20262027
            if problem == '21 games':
                data['games'] = [{**data['games'][0], 'id': 2025020001 + index} for index in range(21)]
                data['requests'] = [f'https://api-web.nhle.com/v1/gamecenter/{game["id"]}/landing' for game in data['games']]
            with self.subTest(problem=problem), self.assertRaises(ValueError):
                capture.validate(data)
        boundary = self.prior_allocation()
        boundary['games'][0].update(date='2026-01-02', startTime='2026-01-02T23:00:00Z')
        self.assertEqual(len(capture.validate(boundary)), 1)
        self.assertEqual(self.calls, [])

    def test_prior_source_start_mismatch_retains_exposure_and_stops(self):
        self.data = self.prior_allocation()
        self.body = json.dumps({'id': 2025020001, 'season': 20252026, 'gameType': 2,
                                'gameDate': '2025-10-01', 'gameState': 'OFF',
                                'startTimeUTC': '2025-10-02T01:00:00Z',
                                'homeTeam': {'id': 1}, 'awayTeam': {'id': 2}}).encode()
        result = self.run_capture()
        self.assertEqual(result['successfulRequests'], 0)
        self.assertEqual(result['failures'], 1)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual((self.root / 'out/2025020001-landing.json').read_bytes(), self.body)

    def summary_allocation(self):
        from urllib.parse import urlencode
        rows = []
        for player in (8479394, 8479979):
            params = {'isAggregate': 'false', 'isGame': 'true', 'start': '0', 'limit': '50',
                      'factCayenneExp': 'gamesPlayed>=1', 'cayenneExp': f'playerId={player} and seasonId=20262027 and gameDate>="2026-09-29" and gameDate<="2026-10-12" and gameTypeId=2'}
            rows.append({'nhlPlayerId': player, 'url': 'https://api.nhle.com/stats/rest/en/goalie/summary?' + urlencode(params).replace('+', '%20')})
        return {'version': 'forge-rso-goalie-summary-allocation-v1', 'players': rows,
                'reservationMetadata': self.data['reservationMetadata'],
                'games': [{**self.data['games'][0], 'id': 2026020001 + n} for n in range(60)]}

    def test_summary_two_exact_pages_and_private_receipts(self):
        allocation = self.summary_allocation()
        calls = []
        def fetch(url, path, maximum, timeout):
            player = next(p for p in allocation['players'] if p['url'] == url)
            calls.append(url)
            self.assertEqual(maximum, 1048576)
            self.assertLessEqual(timeout, 8)
            capture.private_write(path, json.dumps({'data': [{'playerId': player['nhlPlayerId'],
                'gameId': 2026020001, 'gameDate': '2026-10-01', 'shutouts': 0}], 'total': 1}).encode())
        with patch.object(summary.time, 'sleep'):
            result = summary.run(allocation, 'synthetic', 'synthetic-only', self.root / 'summary', fetch)
        self.assertEqual(result['successfulRequests'], 2)
        self.assertEqual(len(calls), 2)
        self.assertEqual((self.root / 'summary/receipts.json').stat().st_mode & 0o777, 0o600)
        changed = copy.deepcopy(allocation)
        changed['players'][0]['url'] += '&limit=100'
        with self.assertRaises(ValueError): summary.validate(changed)

    def test_summary_continuation_only_unattempted_goalie_and_wrong_present_season_denied(self):
        allocation = self.summary_allocation()
        allocation['version'] = 'forge-rso-goalie-summary-continuation-v1'
        allocation['players'] = allocation['players'][1:]
        self.assertEqual(len(summary.validate(allocation)), 1)
        def fetch(url, path, maximum, timeout):
            capture.private_write(path, json.dumps({'data': [{'playerId': 8479979,
                'seasonId': 20252026, 'gameId': 2026020001, 'gameDate': '2026-10-01'}], 'total': 1}).encode())
        result = summary.run(allocation, 'synthetic', 'synthetic-only', self.root / 'continuation', fetch)
        self.assertEqual(result['successfulRequests'], 0)
        self.assertEqual(result['unattemptedRequests'], 0)
        allocation['players'][0]['nhlPlayerId'] = 8479394
        with self.assertRaises(ValueError): summary.validate(allocation)

    def test_summary_page_saturation_stops_without_more_requests(self):
        allocation = self.summary_allocation()
        calls = []
        def fetch(url, path, maximum, timeout):
            calls.append(url)
            capture.private_write(path, b'{"data":[],"total":50}')
        result = summary.run(allocation, 'synthetic', 'synthetic-only', self.root / 'summary', fetch)
        self.assertEqual(result['successfulRequests'], 0)
        self.assertEqual(result['unattemptedRequests'], 1)
        self.assertEqual(len(calls), 1)


if __name__ == '__main__':
    unittest.main()
