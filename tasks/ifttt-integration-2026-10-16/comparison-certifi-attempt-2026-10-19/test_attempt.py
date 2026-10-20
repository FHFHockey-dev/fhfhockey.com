import copy
import io
import hashlib
import json
import socket
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
import attempt as retry
import pilot
from test_pilot import extraction, answer


class RetrySafety(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name);self.output = self.root/'output';self.output.mkdir()
        self.original = self.root/'original.sqlite'
        self.original.write_bytes((retry.ROOT/'comparison-live-binding-2026-10-19/experiment-state/budget.sqlite').read_bytes())
        self.aggregate=self.root/'aggregate-budget.sqlite'
        self.aggregate.write_bytes((retry.ROOT/'comparison-tls-reconciliation-2026-10-19/after/aggregate-budget.sqlite').read_bytes())
        self.original_sha = retry.sha(self.original)
        for name,value in [('ORIGINAL_DB',self.original),('ORIGINAL_SHA',self.original_sha),('OUTPUT',self.output),('AGGREGATE_DB',self.aggregate)]:
            p=patch.object(retry,name,value);p.start();self.addCleanup(p.stop)
        p=patch.object(socket.socket,'connect',side_effect=AssertionError('offline only'));self.net=p.start();self.addCleanup(p.stop)
        self.plan={'authorizationSha256':'synthetic-approval','manifestSha256':'synthetic-manifest','rules':json.loads(pilot.RULES_OUTPUT.read_text())}

    def tearDown(self):
        self.assertEqual(retry.sha(self.original),self.original_sha)
        self.net.assert_not_called()

    def test_import_is_full_original_copy_plus_explicit_total_cap(self):
        db=retry.AggregateLedger(self.plan)
        try:
            self.assertEqual(db.db.execute("SELECT * FROM attempts WHERE id='lindgren-0'").fetchone(),db.original_row)
            self.assertEqual(db.snapshot()['cap_nano_usd'],520000000)
            self.assertEqual(db.snapshot()['exposure_nano_usd'],254394800)
            db.reserve(0,'responses',pilot.EXTRACTION,254394800)
            self.assertEqual(db.snapshot()['exposure_nano_usd'],508789600)
        finally:db.close()

    def test_same_stage_concurrency_has_one_reservation_winner(self):
        db=retry.AggregateLedger(self.plan);db.close();barrier=threading.Barrier(2);results=[]
        def work():
            db=retry.AggregateLedger(self.plan)
            try:
                barrier.wait(timeout=3);db.reserve(0,'responses',pilot.EXTRACTION,254394800);results.append('reserved')
            except ValueError:results.append('refused')
            finally:db.close()
        ts=[threading.Thread(target=work) for _ in range(2)]
        for t in ts:t.start()
        for t in ts:t.join(timeout=5)
        self.assertEqual(sorted(results),['refused','reserved'])

    def test_reopen_or_changed_authorization_does_not_reset(self):
        db=retry.AggregateLedger(self.plan);db.reserve(0,'responses',pilot.EXTRACTION,254394800);db.close()
        db=retry.AggregateLedger(self.plan)
        try:
            with self.assertRaises(ValueError):db.reserve(0,'responses',pilot.EXTRACTION,254394800)
        finally:db.close()
        with self.assertRaises(ValueError):retry.AggregateLedger(dict(self.plan,authorizationSha256='other'))

    def test_partial_existing_aggregate_is_never_overwritten(self):
        retry.AGGREGATE_DB.write_bytes(b'partial original-preserving marker')
        before=retry.AGGREGATE_DB.read_bytes()
        with self.assertRaises(Exception):retry.AggregateLedger(self.plan)
        self.assertEqual(retry.AGGREGATE_DB.read_bytes(),before)

    def test_exact_aggregate_boundary_includes_original_uncertainty(self):
        db=retry.AggregateLedger(self.plan)
        try:
            db.reserve(0,'responses',pilot.EXTRACTION,254394800)
            ident=retry.RETRY_PREFIX+'0';db.begin(ident,pilot.EXTRACTION);db.settle(ident,{},34605200)
            db.reserve(1,'decisions',pilot.decisions_request(self.plan['rules']),231000000)
            self.assertEqual(db.snapshot()['exposure_nano_usd'],520000000)
        finally:db.close()

    def test_one_nano_over_boundary_refuses_before_another_send(self):
        db=retry.AggregateLedger(self.plan)
        try:
            db.reserve(0,'responses',pilot.EXTRACTION,254394800)
            ident=retry.RETRY_PREFIX+'0';db.begin(ident,pilot.EXTRACTION);db.settle(ident,{},34605201)
            with self.assertRaises(pilot.BudgetStop):db.reserve(1,'decisions',pilot.decisions_request(self.plan['rules']),231000000)
        finally:db.close()

    def test_new_uncertainty_keeps_both_full_reservations_and_blocks(self):
        calls=[]
        def transport(*_):
            calls.append(1)
            raise pilot.PilotFailure(pilot.failure_metadata('open',TimeoutError('synthetic'), 'OFFLINE_ONLY',opened=True))
        result=retry.run(self.plan,transport=transport,key_loader=lambda:'OFFLINE_ONLY')
        self.assertEqual(len(calls),1);self.assertEqual(result['ledger']['exposure_nano_usd'],508789600)
        self.assertEqual(result['failure']['stage'],'open')
        db=retry.AggregateLedger(self.plan)
        try:
            with self.assertRaises(ValueError):db.reserve(0,'responses',pilot.EXTRACTION,254394800)
            with self.assertRaises(ValueError):db.reserve(1,'decisions',pilot.decisions_request(self.plan['rules']),231000000)
        finally:db.close()
        self.assertEqual(len(calls),1)

    def test_small_known_charges_complete_same_four_arms(self):
        calls=[]
        def transport(endpoint,payload,key):
            calls.append(endpoint)
            return (extraction() if endpoint=='responses' else answer(payload)),{}
        result=retry.run(self.plan,transport=transport,key_loader=lambda:'OFFLINE_ONLY')
        self.assertEqual(calls,['responses','decisions','decisions'])
        self.assertEqual(len(result['arms']),4);self.assertFalse(result['nativeEligible'])
        self.assertEqual(result['ledger']['exposure_nano_usd'],254485550)
        self.assertEqual(len(result['ledger']['attempts']),5)

    def test_actual_http_failure_is_single_safe_instrumented_attempt(self):
        token='OFFLINE_ONLY';opener=Mock()
        opener.open.side_effect=pilot.error.HTTPError('https://api.openai.com/v1/responses',401,token,
            {'x-request-id':'req_OFFLINE_CONTROL','Authorization':token},
            io.BytesIO(json.dumps({'error':{'code':'invalid_api_key','type':'authentication_error','message':token}}).encode()))
        with patch.object(pilot.request,'build_opener',return_value=opener):
            result=retry.run(self.plan,transport=pilot.post_once,key_loader=lambda:token)
        self.assertEqual(opener.open.call_count,1)
        self.assertEqual(result['failure']['stage'],'open')
        self.assertEqual(result['failure']['provider']['httpStatus'],401)
        self.assertEqual(result['failure']['provider']['requestId'],'req_OFFLINE_CONTROL')
        self.assertEqual(result['ledger']['exposure_nano_usd'],508789600)
        stored=(self.output/'run-01/stopped-partial-pair.json').read_text()
        self.assertNotIn(token,stored)
        db=retry.AggregateLedger(self.plan)
        try:self.assertNotIn(token,db.db.execute('SELECT response FROM attempts WHERE id=?',(retry.RETRY_PREFIX+'0',)).fetchone()[0])
        finally:db.close()

    def test_known_expensive_extraction_stops_before_decisions(self):
        calls=[]
        def transport(*_):calls.append(1);return extraction(260000,100),{}
        result=retry.run(self.plan,transport=transport,key_loader=lambda:'OFFLINE_ONLY')
        self.assertEqual(result['status'],'stopped_budget');self.assertEqual(len(calls),1)
        self.assertLessEqual(result['ledger']['exposure_nano_usd'],retry.CAP)

    def test_original_attempt_cannot_be_started_or_changed(self):
        db=retry.AggregateLedger(self.plan)
        try:
            with self.assertRaises(ValueError):db.begin('lindgren-0',{})
            db.db.execute("UPDATE attempts SET reserve=1 WHERE id='lindgren-0'")
            with self.assertRaises(ValueError):db.reserve(0,'responses',pilot.EXTRACTION,254394800)
        finally:db.close()

    def test_prior_zero_settlement_and_audit_remain_immutable_to_admission(self):
        db=retry.AggregateLedger(self.plan)
        try:
            with self.assertRaises(ValueError):db.begin(retry.RECONCILED_RETRY,{})
            db.db.execute('UPDATE attempts SET actual=1 WHERE id=?',(retry.RECONCILED_RETRY,))
            with self.assertRaises(ValueError):db.reserve(0,'responses',pilot.EXTRACTION,254394800)
        finally:db.close()

    def test_no_closure_or_prompt_changes_and_bad_manifest_never_loads_key(self):
        auth=self.root/'authorization.json';manifest=self.root/'manifest.json'
        paths=retry.required_paths()
        manifest.write_text(json.dumps({'files':[{'path':str(p.resolve()),'sha256':retry.sha(p)} for p in paths]}))
        auth.write_text(json.dumps({'userApproval':retry.APPROVAL,'totalCapNanoUsd':retry.CAP,'originalReservationNanoUsd':retry.ORIGINAL_RESERVE,
                                   'retriesAuthorized':1,'approvalQuestion':retry.APPROVAL_QUESTION,'payloadScope':'original Lindgren family to /v1/responses and /v1/decisions only',
                                   'executionManifestSha256':retry.sha(manifest)}))
        with patch.object(retry,'AUTHORIZATION',auth),patch.object(retry,'MANIFEST',manifest):
            self.assertEqual(retry.verify()['rules'],self.plan['rules'])
            altered=copy.deepcopy(pilot.EXTRACTION);altered['input']='unapproved source'
            with patch.object(pilot,'EXTRACTION',altered):
                with self.assertRaises(ValueError):retry.verify()
            changed=json.loads(manifest.read_text());changed['files'].pop();manifest.write_text(json.dumps(changed))
            a=json.loads(auth.read_text());a['executionManifestSha256']=retry.sha(manifest);auth.write_text(json.dumps(a))
            with self.assertRaises(ValueError):retry.verify()


if __name__=='__main__':unittest.main(verbosity=2)
