"""Offline admission/usage checks. Test ledger is an in-memory disposable copy; never a new allowance."""
import importlib.util
import sqlite3
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('s06_run_once',Path(__file__).with_name('run-once.py'))
runner = importlib.util.module_from_spec(spec); spec.loader.exec_module(runner)

class AdmissionTests(unittest.TestCase):
    def setUp(self):
        original = sqlite3.connect(runner.LEDGER.as_uri()+'?mode=ro',uri=True)
        self.db = sqlite3.connect(':memory:',isolation_level=None)
        original.backup(self.db); original.close()
        self.policy = runner.read('AUTHORIZATION.json')
        self.wire = runner.read('WIRE.json')

    def tearDown(self): self.db.close()

    def test_one_reservation_preserves_original_rows_and_stops_duplicate(self):
        runner.reserve(self.db,self.policy,'reviewed-manifest',self.wire)
        self.assertEqual(runner.exposure(self.db),494021993)
        self.assertEqual(runner.baseline_fingerprint(self.db),self.policy['baselineFingerprint'])
        with self.assertRaises(ValueError): runner.reserve(self.db,self.policy,'reviewed-manifest',self.wire)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM attempts WHERE id=?',(runner.ATTEMPT,)).fetchone()[0],1)

    def test_original_drift_prevents_admission(self):
        self.db.execute("UPDATE attempts SET response='tampered' WHERE id='lindgren-0'")
        with self.assertRaises(ValueError): runner.reserve(self.db,self.policy,'reviewed-manifest',self.wire)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM attempts WHERE id=?',(runner.ATTEMPT,)).fetchone()[0],0)

    def test_cap_refusal_rolls_back_authorization_and_attempt(self):
        self.db.execute("INSERT INTO attempts(id,bundle,endpoint,request,request_hash,reserve,state) VALUES('test-unresolved','test','responses','{}','test',520000000,'reserved')")
        policy = dict(self.policy,baselineFingerprint=runner.baseline_fingerprint(self.db))
        with self.assertRaises(ValueError): runner.reserve(self.db,policy,'reviewed-manifest',self.wire)
        self.assertFalse(self.db.execute('SELECT 1 FROM continuation_authorizations WHERE attempt_prefix=?',(runner.PREFIX,)).fetchone())

    def test_usage_charge_uses_all_tokens_and_regional_ceiling(self):
        body = {'model':'gpt-6-luna','status':'completed','service_tier':'default',
                'usage':{'input_tokens':1234,'output_tokens':100,'total_tokens':1334,'input_tokens_details':{'cached_tokens':0},'output_tokens_details':{'reasoning_tokens':0}}}
        self.assertEqual(runner.charge_ceiling(body),190740)
        body['usage'].update(input_tokens=1050000,output_tokens=1024,total_tokens=1051024)
        self.assertEqual(runner.charge_ceiling(body),runner.RESERVE)

    def test_unknown_usage_or_cache_category_keeps_outcome_unpriced(self):
        for usage in (None,{'input_tokens':10,'output_tokens':2,'total_tokens':11},
                      {'input_tokens':10,'output_tokens':2,'total_tokens':12,'input_tokens_details':{'cache_write_tokens':1}},
                      {'input_tokens':10,'output_tokens':1025,'total_tokens':1035}):
            with self.subTest(usage=usage), self.assertRaises(ValueError):
                runner.charge_ceiling({'model':'gpt-6-luna','status':'completed','usage':usage})

if __name__ == '__main__': unittest.main()
