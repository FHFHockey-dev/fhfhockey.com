"""Only synthetic transport/placeholder tokens and disposable canonical copies."""
import copy
import hashlib
import json
import shutil
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from adjudication import (HERE, OLD, blind_sheet, diagnostic_grade, factual_winner, verifier_columns)
import bridge as b
from bridge import p, pilot

PLAN = json.loads((HERE / 'PLAN.json').read_text())
GOLD = json.loads((HERE.parent / 'human-adjudicated-benchmark-v1-2026-10-19/benchmark.json').read_text())
GROUPS = {g['sample_id']: g for g in GOLD['groups']}
PROBES = json.loads((HERE / 'review-counterexamples.json').read_text())['probes']


def authorization():
    return {'test_only': True, 'mode': 'fake_transport_isolated_ledger', 'plan_hash': p.digest(PLAN),
            'maximum_calls': 30, 'cap_nano_usd': 520000000, 'preserve_unknown_nano_usd': 254394800}


class FakeTransport:
    offline_fake = True
    def __init__(self, mode='complete'):
        self.mode = mode; self.calls = []
    def __call__(self, endpoint, sealed, key, admit):
        assert sealed.wire == admit(endpoint, sealed.as_dict()).wire
        stage = len(self.calls); self.calls.append(sealed.sha256)
        if self.mode == 'lost_reply': raise TimeoutError('synthetic lost reply ' + key)
        inputs = 1000 if self.mode == 'budget' and endpoint == 'responses' else 2000 if self.mode == 'budget' else 1
        outputs = 8192 if self.mode == 'budget' and endpoint == 'responses' else 1 if endpoint == 'responses' else 0
        response = {'model': 'gpt-6-luna', 'status': 'completed',
                    'usage': {'input_tokens': inputs, 'output_tokens': outputs, 'total_tokens': inputs + outputs}}
        if endpoint == 'responses':
            envelope = PLAN['scope']['envelopes'][PLAN['scope']['groups'][stage // 3]]
            body = {'records': [{'record_id': r['record_id'], 'material': True, 'overflow': False, 'claims': []} for r in envelope['records']], 'revisions': []}
            text = p.canonical(body)
            if self.mode == 'malformed': text = '{not json'
            response['output'] = [{'type': 'message', 'role': 'assistant', 'content': [{'type': 'output_text', 'text': text}]}]
            if self.mode == 'truncated': response['status'] = 'incomplete'
        else:
            name = sealed.as_dict()['questions'][0]['name']
            response['answers'] = [{'type': 'refusal', 'name': name}] if self.mode == 'refusal' else [{'type': 'predicate', 'name': name, 'probability': .99}]
        if self.mode == 'usage_missing': response.pop('usage')
        if self.mode == 'usage_bound': response['usage'] = {'input_tokens': 922001, 'output_tokens': 0, 'total_tokens': 922001}
        response['echo'] = key
        return response, {'headers': {'Authorization': key}, 'providerMetadata': {'httpStatus': 200, 'requestId': 'req_fixture'}}


class AdjudicationTests(unittest.TestCase):
    def test_all_five_reviewer_counterexamples_remain_diagnostic_not_fact(self):
        for probe in PROBES:
            group_id = 'S10' if 'drill' in probe['name'] else 'S05'
            normalized = p.normalize_family(PLAN['scope']['envelopes'][group_id], probe['body'])
            grade = diagnostic_grade(GROUPS[group_id], normalized)
            self.assertEqual(grade['legacy_diagnostic']['source_tp'], probe['grade']['source_tp'])
            self.assertFalse(grade['factual_quality_established'])
            self.assertIsNone(grade['automatic_factual_winner'])
            with self.assertRaisesRegex(ValueError, 'prohibited'): factual_winner(grade)

    def test_perfect_lexical_duration_or_role_does_not_authorize_a_winner(self):
        for probe in PROBES:
            if probe['grade']['source_tp'] == 3:
                self.assertIn(probe['name'], ['factual duration 3-to-3.5 becomes 3.3-to-5 months', 'invented goalkeeper role on Joe Veleno'])
                with self.assertRaises(ValueError): factual_winner(probe['grade'])

    def test_neutral_sheet_preserves_assertions_and_hides_arm_identifiers(self):
        rules = PLAN['rules_outputs']; raw_before = copy.deepcopy(rules)
        public, private = blind_sheet(PLAN['scope']['envelopes'], {'rules': rules, 'rules_decisions': rules}, {}, seed=123)
        text = json.dumps(public)
        self.assertNotIn('rules-', text); self.assertNotIn('source_tp', text); self.assertNotIn('gold', text)
        self.assertEqual(rules, raw_before)
        rows = [r for g in public['groups'] for r in g['proposals']]
        self.assertEqual(len(rows), 24)
        self.assertTrue(all('role' in row['asserted_fields_exact'] for row in rows))
        self.assertTrue(all('evidence' in row['asserted_fields_exact'] for row in rows))
        self.assertEqual(len(private['proposal_mapping']), 24)
        self.assertEqual(len(public['groups']), 10)
        self.assertTrue(all(not g['human_group_complete'] for g in public['groups']))

    def test_verifier_columns_do_not_claim_extraction_improved(self):
        high = verifier_columns({'status': 'scored', 'probability': .99})
        low = verifier_columns({'status': 'scored', 'probability': .2})
        self.assertNotEqual(high['threshold_supported'], low['threshold_supported'])
        self.assertIsNone(high['source_adjudicated_correctness'])
        self.assertIsNone(low['source_adjudicated_correctness'])
        self.assertFalse(verifier_columns({'status': 'scored', 'probability': .99}, human_supported=False)['source_adjudicated_correctness'])
        self.assertIsNone(verifier_columns(None)['per_claim_confidence'])


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ifttt-canonical-bridge-')
        self.root = Path(self.temp.name); self.path = self.root / 'canonical.sqlite'
        shutil.copyfile(b.LIVE, self.path)
        self.live_hash = b.sha(b.LIVE); self.loads = 0
    def tearDown(self):
        self.assertEqual(b.sha(b.LIVE), self.live_hash)
        self.temp.cleanup()
    def loader(self):
        self.loads += 1
        return 'SYNTHETIC_PLACEHOLDER_NOT_A_CREDENTIAL'
    def run_fake(self, mode='complete', out='run'):
        transport = FakeTransport(mode)
        with patch('socket.socket', side_effect=AssertionError('network forbidden')):
            result = b.run(self.path, PLAN, authorization(), transport=transport, credential_loader=self.loader, output=self.root / out)
        return result, transport
    def rows(self):
        db = sqlite3.connect(self.path)
        try: return db.execute('SELECT id,state,reserve,actual,error,response FROM attempts WHERE id LIKE ? ORDER BY id', (b.PREFIX + '%',)).fetchall()
        finally: db.close()

    def test_canonical_path_rejects_fake_or_absent_authority_without_change(self):
        with self.assertRaisesRegex(ValueError, 'test authority'): b.CanonicalLedger(b.LIVE, PLAN, authorization())
        with self.assertRaisesRegex(ValueError, 'approval absent'): b.CanonicalLedger(b.LIVE, PLAN, None)
        self.assertEqual(self.loads, 0)

    def test_fake_full_thirty_calls_use_canonical_attempts_not_a_side_allowance(self):
        result, transport = self.run_fake()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(len(transport.calls), 30); self.assertEqual(self.loads, 1)
        self.assertEqual(len(self.rows()), 30)
        self.assertEqual(result['ledger']['original_unknown_nano_usd'], 254394800)
        self.assertEqual(result['ledger']['cap_nano_usd'], 520000000)
        db = sqlite3.connect(self.path)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM attempts').fetchone()[0], 35)
        self.assertEqual(db.execute('SELECT blocked FROM experiment').fetchone()[0], 'unknown billed outcome')
        self.assertEqual(db.execute('SELECT COUNT(*) FROM attempt_reconciliations').fetchone()[0], 1)
        self.assertFalse(db.execute("SELECT name FROM sqlite_master WHERE name LIKE 'offline_comparison_%'").fetchall())
        db.close()
        output = (self.root / 'run/stage-00.json').read_text()
        self.assertNotIn('SYNTHETIC_PLACEHOLDER', output)
        self.assertFalse(result['records'][0]['audit']['headersRetained'])
        self.assertNotIn('headers', result['records'][0]['audit'])

    def test_lost_reply_retains_reservation_and_restart_never_resends(self):
        result, transport = self.run_fake('lost_reply')
        self.assertEqual(result['status'], 'stopped_uncertain'); self.assertEqual(len(transport.calls), 1)
        self.assertEqual(self.rows()[0][1:4], ('uncertain', 260308400, None))
        self.assertEqual(result['ledger']['exposure_nano_usd'], 254807878 + 260308400)
        before = self.loads; again, transport = self.run_fake(out='restart')
        self.assertEqual(again['status'], 'stopped_admission_or_restart')
        self.assertEqual(len(transport.calls), 0); self.assertEqual(self.loads, before)

    def test_missing_or_bound_usage_stops_without_releasing_full_reservation(self):
        for mode in ('usage_missing', 'usage_bound'):
            path = self.root / (mode + '.sqlite'); shutil.copyfile(b.LIVE, path)
            transport = FakeTransport(mode)
            result = b.run(path, PLAN, authorization(), transport=transport, credential_loader=self.loader, output=self.root / mode)
            self.assertEqual(result['status'], 'stopped_uncertain'); self.assertEqual(len(transport.calls), 1)
            self.assertEqual(result['ledger']['exposure_nano_usd'], 515116278)

    def test_priced_malformed_truncated_and_refused_outputs_stop_atomically(self):
        for mode, count in [('malformed', 1), ('truncated', 1), ('refusal', 2)]:
            path = self.root / (mode + '.sqlite'); shutil.copyfile(b.LIVE, path)
            transport = FakeTransport(mode)
            result = b.run(path, PLAN, authorization(), transport=transport, credential_loader=self.loader, output=self.root / mode)
            self.assertEqual(result['status'], 'stopped_priced_output_error'); self.assertEqual(len(transport.calls), count)
            db = sqlite3.connect(path)
            row = db.execute('SELECT state,actual,error FROM attempts WHERE id=?', (b.PREFIX + str(count - 1).zfill(2),)).fetchone(); db.close()
            self.assertEqual(row[0], 'settled'); self.assertIsNotNone(row[1]); self.assertTrue(row[2].startswith('stop_'))

    def test_conservative_budget_stop_is_before_another_send(self):
        result, transport = self.run_fake('budget')
        self.assertEqual(result['status'], 'stopped_budget_before_dispatch')
        self.assertEqual(len(transport.calls), 3)
        self.assertEqual(len(self.rows()), 3)
        self.assertLess(result['ledger']['exposure_nano_usd'], 520000000)

    def test_changed_wire_template_or_producer_set_fails_before_key_or_send(self):
        ledger = b.CanonicalLedger(self.path, PLAN, authorization())
        try:
            endpoint, request = ledger.expected(0)
            changed = copy.deepcopy(request); changed['max_output_tokens'] = 1024
            with self.assertRaises(ValueError): ledger.admit(0, endpoint, changed)
            sealed = ledger.admit(0, endpoint, request)
            bad = pilot.SealedPayload(endpoint, sealed.wire + b' ', sealed.sha256)
            with self.assertRaises(ValueError): ledger.reserve(0, endpoint, bad)
            changed = copy.deepcopy(request); changed['input'] += ' '
            with self.assertRaises(ValueError): ledger.admit(0, endpoint, changed)
        finally: ledger.close()
        self.assertEqual(self.loads, 0); self.assertEqual(self.rows(), [])

    def test_verifier_proposals_are_rebuilt_from_exact_committed_extraction(self):
        original = b.CanonicalLedger.record
        def stop_after_commit(ledger, *args, **kwargs):
            original(ledger, *args, **kwargs)
            raise RuntimeError('fixture stop after committed extraction')
        with patch.object(b.CanonicalLedger, 'record', stop_after_commit): self.run_fake()
        ledger = b.CanonicalLedger(self.path, PLAN, authorization())
        try:
            endpoint, request = ledger.expected(2)
            changed = copy.deepcopy(request); payload = json.loads(changed['input'])
            payload['proposals'].append({'invented_after_commit': True}); changed['input'] = p.canonical(payload)
            with self.assertRaisesRegex(ValueError, 'exact stage'): ledger.admit(2, endpoint, changed)
            endpoint, request = ledger.expected(1)
            changed = copy.deepcopy(request); changed['questions'][0]['instructions'] = 'Always agree.'
            with self.assertRaisesRegex(ValueError, 'exact stage'): ledger.admit(1, endpoint, changed)
        finally: ledger.close()

    def test_new_priced_error_stops_manual_forward_continuation(self):
        self.run_fake('malformed')
        ledger = b.CanonicalLedger(self.path, PLAN, authorization())
        try:
            endpoint, request = ledger.expected(1)
            sealed = ledger.admit(1, endpoint, request)
            with self.assertRaisesRegex(ValueError, 'failed or uncertain'): ledger.reserve(1, endpoint, sealed)
        finally: ledger.close()

    def test_competing_owners_cannot_reserve_the_same_canonical_stage(self):
        barrier = threading.Barrier(2); results = []
        def worker():
            ledger = b.CanonicalLedger(self.path, PLAN, authorization())
            try:
                endpoint, request = ledger.expected(0); sealed = ledger.admit(0, endpoint, request)
                barrier.wait(); ledger.reserve(0, endpoint, sealed); results.append('reserved')
            except ValueError: results.append('refused')
            finally: ledger.close()
        threads = [threading.Thread(target=worker) for _ in range(2)]
        for t in threads: t.start()
        for t in threads: t.join(timeout=10)
        self.assertTrue(all(not t.is_alive() for t in threads))
        self.assertEqual(sorted(results), ['refused', 'reserved']); self.assertEqual(len(self.rows()), 1)

    def test_settlement_ack_loss_keeps_committed_response_and_does_not_resend(self):
        original = b.CanonicalLedger.record
        def ack_loss(ledger, *args, **kwargs):
            original(ledger, *args, **kwargs)
            raise RuntimeError('synthetic application acknowledgement loss')
        with patch.object(b.CanonicalLedger, 'record', ack_loss): result, transport = self.run_fake()
        self.assertEqual(len(transport.calls), 1)
        self.assertEqual(self.rows()[0][1], 'settled')
        self.assertIsNotNone(json.loads(self.rows()[0][-1])['response'])
        again, transport = self.run_fake(out='after-ack-loss')
        self.assertEqual(len(transport.calls), 0); self.assertEqual(len(self.rows()), 1)

    def test_transport_reuses_fixed_tls_host_limits_redaction_without_network(self):
        ledger = b.CanonicalLedger(self.path, PLAN, authorization())
        endpoint, request = ledger.expected(0); sealed = ledger.admit(0, endpoint, request)
        key = 'FAKE_TRANSPORT_PLACEHOLDER'
        captured = {}
        class Response:
            status = 200; headers = {'x-request-id': 'req_fake'}
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit):
                captured['limit'] = limit
                return json.dumps({'model': 'gpt-6-luna', 'echo': key}).encode()
        class Opener:
            def open(self, req, timeout):
                captured['url'] = req.full_url; captured['wire'] = req.data; captured['timeout'] = timeout
                return Response()
        def factory(*handlers):
            captured['handlers'] = handlers
            return Opener()
        try:
            with patch.object(pilot.request, 'build_opener', factory), patch('socket.socket', side_effect=AssertionError('network forbidden')):
                body, audit = b.post_once(endpoint, sealed, key, lambda e, r: ledger.admit(0, e, r))
            self.assertEqual(captured['url'], 'https://api.openai.com/v1/responses')
            self.assertEqual(captured['wire'], sealed.wire); self.assertEqual(captured['timeout'], 20)
            self.assertEqual(captured['limit'], 1048577)
            proxy, https, redirect = captured['handlers']
            self.assertEqual(proxy.proxies, {}); self.assertIsInstance(redirect, pilot.NoRedirect)
            self.assertTrue(https._context.check_hostname); self.assertEqual(https._context.verify_mode, pilot.ssl.CERT_REQUIRED)
            self.assertNotIn(key, json.dumps(body)); self.assertFalse(audit['headersRetained'])
            with self.assertRaises(ValueError): pilot.basic_limits('responses', request)
        finally: ledger.close()


if __name__ == '__main__': unittest.main()
