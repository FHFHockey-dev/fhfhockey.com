import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from contextlib import closing
import reconciliation as r


class ReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.path=Path(self.tmp.name)/'aggregate.sqlite'
        self.path.write_bytes((r.HERE/'before/aggregate-budget.sqlite').read_bytes())

    def sha(self):return hashlib.sha256(self.path.read_bytes()).hexdigest()

    def test_only_reviewed_retry_settled_and_original_block_unchanged(self):
        record=r.reconcile(self.path,self.sha())
        with closing(sqlite3.connect(self.path)) as db:
            self.assertEqual(db.execute('SELECT id,state,actual,reserve FROM attempts ORDER BY id').fetchall(),
                [('lindgren-0','uncertain',None,254394800),(r.ATTEMPT,'settled',0,254394800)])
            self.assertEqual(db.execute('SELECT cap,blocked FROM experiment').fetchone(),(520000000,'unknown billed outcome'))
            self.assertEqual(json.loads(db.execute('SELECT record_json FROM attempt_reconciliations').fetchone()[0]),record)
        self.assertEqual(record['releasedReservationNanoUsd'],254394800)

    def test_wrong_before_hash_refuses_without_writes(self):
        before=self.path.read_bytes()
        with self.assertRaises(ValueError):r.reconcile(self.path,'wrong')
        self.assertEqual(self.path.read_bytes(),before)

    def test_changed_incident_is_not_reconciled(self):
        with closing(sqlite3.connect(self.path)) as db:
            row=db.execute('SELECT response FROM attempts WHERE id=?',(r.ATTEMPT,)).fetchone()
            response=json.loads(row[0]);response['failure']['verify_code']=99
            db.execute('UPDATE attempts SET response=? WHERE id=?',(json.dumps(response),r.ATTEMPT));db.commit()
        before=self.path.read_bytes()
        with self.assertRaises(ValueError):r.reconcile(self.path,self.sha())
        self.assertEqual(self.path.read_bytes(),before)

    def test_audit_is_append_only_and_repeat_cannot_release_twice(self):
        before_sha=self.sha();r.reconcile(self.path,before_sha)
        with closing(sqlite3.connect(self.path)) as db:
            for sql in ['UPDATE attempt_reconciliations SET evidence_sha=\'changed\'','DELETE FROM attempt_reconciliations']:
                with self.assertRaises(sqlite3.IntegrityError):db.execute(sql)
                db.rollback()
            self.assertEqual(db.execute('SELECT count(*) FROM attempt_reconciliations').fetchone()[0],1)
        after=self.path.read_bytes()
        with self.assertRaises(ValueError):r.reconcile(self.path,before_sha)
        with self.assertRaises(ValueError):r.reconcile(self.path,self.sha())
        self.assertEqual(self.path.read_bytes(),after)

    def test_intra_transaction_fault_rolls_back_both_audit_and_settlement(self):
        with closing(sqlite3.connect(self.path)) as db:
            db.execute("CREATE TRIGGER fault BEFORE UPDATE ON attempts BEGIN SELECT RAISE(ABORT,'synthetic fault'); END");db.commit()
        before=self.path.read_bytes()
        with self.assertRaises(sqlite3.IntegrityError):r.reconcile(self.path,self.sha())
        self.assertEqual(self.path.read_bytes(),before)
        with closing(sqlite3.connect(self.path)) as db:
            self.assertIsNone(db.execute("SELECT 1 FROM sqlite_master WHERE name='attempt_reconciliations'").fetchone())


if __name__=='__main__':unittest.main(verbosity=2)
