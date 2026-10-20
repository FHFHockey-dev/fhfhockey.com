import copy
import json
import socket
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from contextlib import closing
from unittest.mock import patch
import verifier as v
from test_pilot import answer


class VerifierSafety(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.db=self.root/'aggregate.sqlite';self.db.write_bytes(v.BASELINE.read_bytes())
        self.output=self.root/'output'
        for name,value in [('LEDGER',self.db),('OUTPUT',self.output)]:
            p=patch.object(v,name,value);p.start();self.addCleanup(p.stop)
        p=patch.object(socket.socket,'connect',side_effect=AssertionError('offline only'));self.net=p.start();self.addCleanup(p.stop)
        report,rows,requests=v.prepare_inputs()
        self.plan={'authorizationSha256':'synthetic-approval','manifestSha256':'synthetic-manifest',
                   'manifest':{'files':[{'path':str(p.resolve()),'sha256':v.sha(p)} for p in v.inputs()]},
                   'requests':requests,'rows':rows,'offlineReport':report}
        self.baseline=[tuple(r) for r in self.read('SELECT * FROM attempts ORDER BY id')]

    def read(self,sql,args=()):
        with closing(sqlite3.connect('file:'+str(self.db)+'?mode=ro',uri=True)) as db:return db.execute(sql,args).fetchall()

    def tearDown(self):
        self.net.assert_not_called()
        self.assertEqual(self.read('SELECT * FROM attempts WHERE id IN (?,?,?) ORDER BY id',v.BASE_IDS),self.baseline)
        self.assertEqual(v.sha(v.BASELINE),v.BASELINE_SHA)

    def test_requests_are_two_one_question_checks_without_gold_or_extraction(self):
        for r in self.plan['requests']:
            self.assertEqual(set(r),{'model','input','questions'});self.assertEqual(len(r['questions']),1)
            self.assertEqual(r['questions'][0]['type'],'predicate')
            for field in ['gradable','human_adjudication','lindgren-provisional']:self.assertNotIn(field,r['input'])
        self.assertEqual([len(json.loads(r['input'])['proposals']) for r in self.plan['requests']],[1,2])

    def test_two_sequential_known_calls_complete_without_clearing_holds(self):
        calls=[]
        def transport(endpoint,payload,key):
            calls.append(endpoint);return answer(payload,n=100,p=.2 if len(calls)==1 else .999),{}
        result=v.run(self.plan,transport=transport,key_loader=lambda:'OFFLINE_SECRET')
        self.assertEqual(calls,['decisions','decisions']);self.assertEqual(result['ledger']['exposure_nano_usd'],254673788)
        self.assertEqual(len(result['arms']),4);self.assertFalse(result['nativeEligible'])
        self.assertEqual(result['arms']['extraction_decisions']['grade']['held'],2)
        self.assertEqual([r['holds'] for r in result['arms']['extraction_decisions']['rows']],[['unresolved_time'],['single_subject_evidence_unproved']])
        self.assertTrue(all(a['grade']['accepted']==0 for a in result['arms'].values()))

    def test_unknown_first_result_stops_second_and_retains_full_reservation(self):
        calls=[]
        def transport(*_):calls.append(1);raise TimeoutError('OFFLINE_SECRET')
        result=v.run(self.plan,transport=transport,key_loader=lambda:'OFFLINE_SECRET')
        self.assertEqual(len(calls),1);self.assertEqual(result['ledger']['exposure_nano_usd'],485651788)
        db=v.VerifierLedger(self.plan)
        try:
            with self.assertRaises(ValueError):db.reserve(0,self.plan['requests'][0])
            with self.assertRaises(ValueError):db.reserve(1,self.plan['requests'][1])
        finally:db.close()
        self.assertNotIn('OFFLINE_SECRET',(self.output/'run-01/stopped-partial-comparison.json').read_text())

    def test_missing_usage_stops_and_preserves_safe_status_and_request_id(self):
        calls=[]
        def transport(endpoint,payload,key):
            calls.append(1);body=answer(payload);del body['usage'];body['private']='OFFLINE_SECRET'
            return body,{'providerMetadata':{'httpStatus':200,'requestId':'req_OFFLINE_CONTROL'}}
        result=v.run(self.plan,transport=transport,key_loader=lambda:'OFFLINE_SECRET')
        self.assertEqual(len(calls),1);self.assertEqual(result['failure']['provider']['requestId'],'req_OFFLINE_CONTROL')
        self.assertEqual(result['failure']['provider']['httpStatus'],200)
        stored=self.read('SELECT response FROM attempts WHERE id=?',(v.PREFIX+'0',))[0][0]
        self.assertNotIn('OFFLINE_SECRET',stored)

    def test_invalid_answer_after_known_usage_is_charged_and_stops(self):
        calls=[]
        def transport(endpoint,payload,key):
            calls.append(1);body=answer(payload);body['answers'][0]['probability']='invalid';return body,{}
        result=v.run(self.plan,transport=transport,key_loader=lambda:'OFFLINE_SECRET')
        self.assertEqual(len(calls),1);self.assertEqual(result['ledger']['exposure_nano_usd'],254662788)
        self.assertEqual(self.read('SELECT state,actual FROM attempts WHERE id=?',(v.PREFIX+'0',)),[('settled',11000)])

    def test_expensive_first_settlement_refuses_second_full_reservation(self):
        calls=[]
        def transport(endpoint,payload,key):calls.append(1);return answer(payload,n=500000),{}
        result=v.run(self.plan,transport=transport,key_loader=lambda:'OFFLINE_SECRET')
        self.assertEqual(len(calls),1);self.assertEqual(result['status'],'stopped_budget')
        self.assertEqual(result['ledger']['exposure_nano_usd'],364651788)

    def test_exact_second_call_boundary_includes_unknown_and_known_prior_cost(self):
        db=v.VerifierLedger(self.plan)
        try:
            db.reserve(0,self.plan['requests'][0]);db.begin(v.PREFIX+'0',self.plan['requests'][0]);db.settle(v.PREFIX+'0',{},34348212)
            db.reserve(1,self.plan['requests'][1]);self.assertEqual(db.snapshot()['exposure_nano_usd'],v.CAP)
        finally:db.close()

    def test_one_nano_over_boundary_refuses_before_second_send(self):
        db=v.VerifierLedger(self.plan)
        try:
            db.reserve(0,self.plan['requests'][0]);db.begin(v.PREFIX+'0',self.plan['requests'][0]);db.settle(v.PREFIX+'0',{},34348213)
            with self.assertRaises(v.pilot.BudgetStop):db.reserve(1,self.plan['requests'][1])
        finally:db.close()

    def test_concurrent_first_reservation_has_one_winner(self):
        db=v.VerifierLedger(self.plan);db.close();barrier=threading.Barrier(2);out=[]
        def work():
            db=v.VerifierLedger(self.plan)
            try:barrier.wait(timeout=3);db.reserve(0,self.plan['requests'][0]);out.append('reserved')
            except ValueError:out.append('refused')
            finally:db.close()
        ts=[threading.Thread(target=work) for _ in range(2)]
        for t in ts:t.start()
        for t in ts:t.join(timeout=5)
        self.assertEqual(sorted(out),['refused','reserved'])

    def test_verifier_cannot_clear_hold_or_change_claim(self):
        review={'status':'scored','probability':1}
        rows=self.plan['rows'][1]
        self.assertEqual(v.reviewed_rows(rows,review),rows)
        changed=copy.deepcopy(rows);changed[0]['holds']=[];changed[0]['accepted']=True
        with patch.object(v.pilot,'apply_review',return_value=changed):
            with self.assertRaises(ValueError):v.reviewed_rows(rows,review)

    def test_refusal_adds_hold_and_never_promotes(self):
        rows=v.reviewed_rows(self.plan['rows'][1],{'status':'unknown','probability':None})
        self.assertTrue(all(not r['accepted'] for r in rows))
        self.assertTrue(all('one_question_verifier_unknown_or_not_all_supported' in r['holds'] for r in rows))

    def test_changed_approval_or_request_hash_cannot_reset_history(self):
        db=v.VerifierLedger(self.plan);db.close()
        with self.assertRaises(ValueError):v.VerifierLedger(dict(self.plan,authorizationSha256='other'))
        db=v.VerifierLedger(self.plan)
        try:
            db.reserve(0,self.plan['requests'][0])
            changed=copy.deepcopy(self.plan['requests'][0]);changed['input']='other source'
            with self.assertRaises(ValueError):db.begin(v.PREFIX+'0',changed)
        finally:db.close()

    def test_verify_rejects_resealed_changed_question_before_dispatch(self):
        paths=[self.root/'request0.json',self.root/'request1.json']
        requests=copy.deepcopy(self.plan['requests']);requests[0]['questions'][0]['instructions']='changed question'
        for path,request in zip(paths,requests):path.write_text(json.dumps(request))
        manifest=self.root/'manifest.json';authorization=self.root/'authorization.json'
        with patch.object(v,'REQUESTS',paths),patch.object(v,'MANIFEST',manifest),patch.object(v,'AUTHORIZATION',authorization):
            manifest.write_text(json.dumps({'files':[{'path':str(p.resolve()),'sha256':v.sha(p)} for p in v.inputs()]}))
            authorization.write_text(json.dumps({'userReply':'yes','approvalQuestion':v.QUESTION,'checksAuthorized':2,'totalCapNanoUsd':v.CAP,'manifestSha256':v.sha(manifest)}))
            with self.assertRaises(ValueError):v.verify()


if __name__=='__main__':unittest.main(verbosity=2)
