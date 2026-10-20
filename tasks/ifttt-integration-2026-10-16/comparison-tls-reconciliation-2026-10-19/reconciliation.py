"""Evidence-backed one-row settlement; no transport or credential access."""
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
TARGET = HERE.parent / 'comparison-retry-execution-2026-10-19/aggregate-budget.sqlite'
EXPECTED_SHA = 'a3d98e15e73b9a58f2312d33153c15bf1b30711f0f80f48a16a83d05eb64e361'
REVIEW = HERE / 'review-evidence/REVIEW.md'
REVIEW_SHA = '1288818392cd4a7677b08b2258b81eae264e278a3f04b041118f48a6499fe99a'
ATTEMPT = 'lindgren-approved-retry-0'


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def reconcile(path, expected_sha):
    if hashlib.sha256(REVIEW.read_bytes()).hexdigest() != REVIEW_SHA:
        raise ValueError('independent non-dispatch evidence changed')
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected_sha:
        raise ValueError('aggregate differs from preserved before-image; inspect before repeating')
    db = sqlite3.connect(path, timeout=2, isolation_level=None)
    try:
        db.execute('PRAGMA synchronous=FULL');db.execute('BEGIN IMMEDIATE')
        original = db.execute("SELECT * FROM attempts WHERE id='lindgren-0'").fetchone()
        prior = db.execute('SELECT * FROM attempts WHERE id=?',(ATTEMPT,)).fetchone()
        experiment = db.execute('SELECT * FROM experiment').fetchone()
        if original is None or original[5:8] != (254394800,'uncertain',None):
            raise ValueError('first uncertain attempt must remain reserved')
        if prior is None or prior[5:8] != (254394800,'uncertain',None):
            raise ValueError('only the single reviewed uncertain retry may be settled')
        failure = json.loads(prior[8])['failure']
        if (failure['stage'],failure['exceptionType'],failure['verify_code']) != ('open','SSLCertVerificationError',20):
            raise ValueError('attempt does not match reviewed TLS incident')
        if experiment[2:] != (520000000,'unknown billed outcome'):
            raise ValueError('cap or original block changed')
        exposure_sql = "SELECT SUM(CASE WHEN state='settled' THEN actual ELSE MAX(reserve,COALESCE(actual,0)) END) FROM attempts"
        before_exposure = db.execute(exposure_sql).fetchone()[0]
        if before_exposure != 508789600 or db.execute('SELECT count(*) FROM attempts').fetchone()[0] != 2:
            raise ValueError('unexpected attempt inventory or exposure')
        db.execute('CREATE TABLE attempt_reconciliations (id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id TEXT NOT NULL UNIQUE, evidence_sha TEXT NOT NULL, record_json TEXT NOT NULL)')
        db.execute("CREATE TRIGGER reconciliation_no_update BEFORE UPDATE ON attempt_reconciliations BEGIN SELECT RAISE(ABORT,'append-only reconciliation history'); END")
        db.execute("CREATE TRIGGER reconciliation_no_delete BEFORE DELETE ON attempt_reconciliations BEGIN SELECT RAISE(ABORT,'append-only reconciliation history'); END")
        changed = db.execute("UPDATE attempts SET state='settled',actual=0 WHERE id=? AND state='uncertain' AND actual IS NULL",(ATTEMPT,))
        if changed.rowcount != 1:raise ValueError('settlement compare-and-set lost')
        after = db.execute('SELECT * FROM attempts WHERE id=?',(ATTEMPT,)).fetchone()
        expected_after = list(prior);expected_after[6]='settled';expected_after[7]=0
        if after != tuple(expected_after):raise ValueError('unexpected retry-row mutation')
        if db.execute("SELECT * FROM attempts WHERE id='lindgren-0'").fetchone() != original:
            raise ValueError('original attempt changed')
        if db.execute('SELECT * FROM experiment').fetchone() != experiment:
            raise ValueError('cap or block changed')
        after_exposure = db.execute(exposure_sql).fetchone()[0]
        if after_exposure != 254394800:raise ValueError('unexpected post-settlement exposure')
        record = {'attemptId':ATTEMPT,'classification':'reviewed_pre_http_tls_authentication_failure',
                  'authority':'Explicit parent01a15411-3560-7632-8d31-1dd2447ba00e reconciliation instruction',
                  'reviewPath':str(REVIEW),'reviewSha256':REVIEW_SHA,'beforeDatabaseSha256':expected_sha,
                  'beforeRowSha256':digest(prior),'afterRowSha256':digest(after),
                  'changes':{'state':{'before':'uncertain','after':'settled'},'actualNanoUsd':{'before':None,'after':0}},
                  'releasedReservationNanoUsd':254394800,'beforeExposureNanoUsd':before_exposure,
                  'afterExposureNanoUsd':after_exposure,'capNanoUsd':520000000,'unreservedNanoUsd':265605200,
                  'originalAttemptRowSha256':digest(original),'originalUnknownReservationNanoUsd':254394800,
                  'originalFailurePayloadAndClocksUnchanged':True,'reportedUsageInvented':False,
                  'reconciledAt':datetime.now(timezone.utc).isoformat(),'newAttemptAuthorized':False}
        db.execute('INSERT INTO attempt_reconciliations(attempt_id,evidence_sha,record_json) VALUES(?,?,?)',
                   (ATTEMPT,REVIEW_SHA,json.dumps(record,sort_keys=True)))
        db.execute('COMMIT')
        return record
    except BaseException:
        if db.in_transaction:db.execute('ROLLBACK')
        raise
    finally:
        db.close()
