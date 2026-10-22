"""One sealed identity Responses request. Default is read-only checking; no resend API."""
import argparse
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
PILOT_DIR = REPO / 'tasks/ifttt-integration-2026-10-16/comparison-sequential-pilot-2026-10-19'
sys.path.insert(0, str(PILOT_DIR))
import pilot

LEDGER = REPO / 'tasks/ifttt-integration-2026-10-16/comparison-retry-execution-2026-10-19/aggregate-budget.sqlite'
BASE_SHA = '52d4848b5a9eb1a91b3ddfd9928625951fe2da81814669d41bdbd08a261c9b5c'
PREFIX = 'identity-s06-shadow-v1-'
ATTEMPT = PREFIX + '0'
CAP, RESERVE = 520000000, 231844800
TABLES = ('experiment', 'attempts', 'retry_authorization', 'attempt_reconciliations', 'continuation_authorizations')
GUARD = Path('/tmp/fhfh-luna-offline-network-guard.cjs')

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(name): return pilot.json_strict((HERE / name).read_text())
def save(name, value): (HERE / name).write_text(json.dumps(value, indent=2) + '\n')
def require(value, message): pilot.require(value, message)
def now(): return datetime.now(timezone.utc).isoformat()

def baseline_fingerprint(db):
    result = {}
    for table in TABLES:
        where, args = '', ()
        if table == 'attempts': where, args = ' WHERE id != ?', (ATTEMPT,)
        if table == 'continuation_authorizations': where, args = ' WHERE attempt_prefix != ?', (PREFIX,)
        result[table] = db.execute('SELECT * FROM ' + table + where + ' ORDER BY 1', args).fetchall()
    return pilot.digest(result)

def exposure(db):
    return db.execute("SELECT COALESCE(SUM(CASE WHEN state='settled' THEN actual ELSE MAX(reserve,COALESCE(actual,0)) END),0) FROM attempts").fetchone()[0]

def check_originals(db, policy):
    require(baseline_fingerprint(db) == policy['baselineFingerprint'], 'original ledger state changed')
    require(db.execute('SELECT cap,blocked FROM experiment').fetchall() == [(CAP, 'unknown billed outcome')], 'cap/block changed')
    require(db.execute("SELECT state,reserve,actual FROM attempts WHERE id='lindgren-0'").fetchone() == ('uncertain',254394800,None), 'original unknown changed')

@contextmanager
def transaction(db):
    db.execute('BEGIN IMMEDIATE')
    try:
        yield
        db.execute('COMMIT')
    except BaseException:
        db.execute('ROLLBACK')
        raise

def reserve(db, policy, manifest_sha, wire):
    with transaction(db):
        check_originals(db, policy)
        require(not db.execute('SELECT 1 FROM attempts WHERE id=?', (ATTEMPT,)).fetchone(), 'attempt already exists; no resend')
        require(not db.execute('SELECT 1 FROM continuation_authorizations WHERE attempt_prefix=?', (PREFIX,)).fetchone(), 'continuation already admitted')
        require(exposure(db) + RESERVE <= CAP, 'aggregate cannot cover full request reserve')
        db.execute('INSERT INTO continuation_authorizations VALUES(?,?,?,?)', (PREFIX,BASE_SHA,sha(HERE/'AUTHORIZATION.json'),manifest_sha))
        db.execute("INSERT INTO attempts(id,bundle,endpoint,request,request_hash,reserve,state) VALUES(?,?,?,?,?,?,'reserved')",
                   (ATTEMPT,'approved-s06-identity-shadow-only','responses',pilot.canonical(wire),pilot.digest(wire),RESERVE))

def charge_ceiling(body):
    require(body.get('model') == 'gpt-6-luna' and body.get('status') == 'completed', 'unknown model/status')
    require(body.get('service_tier','default') == 'default', 'unknown billed tier')
    usage = body.get('usage'); require(isinstance(usage,dict), 'usage absent')
    n, o, total = (pilot.integer(usage.get(k)) for k in ('input_tokens','output_tokens','total_tokens'))
    require(n + o == total and n <= 1050000 and o <= 1024, 'usage bound/total invalid')
    details, output_details = usage.get('input_tokens_details') or {}, usage.get('output_tokens_details') or {}
    require(isinstance(details,dict) and isinstance(output_details,dict), 'usage details invalid')
    require(pilot.integer(details.get('cached_tokens',0)) == 0 and pilot.integer(details.get('cache_write_tokens',0)) == 0, 'unexpected cache use under explicit/no-breakpoint policy')
    require(pilot.integer(output_details.get('reasoning_tokens',0)) <= o, 'invalid reasoning usage')
    long = n > 272000
    amount = (n*Fraction('.20' if long else '.10') + o*Fraction('.75' if long else '.50'))/1000000
    charge = pilot.ceiling(amount*Fraction('1.10')*1000000000)
    require(charge <= RESERVE, 'provider charge exceeds reviewed bound')
    return charge

def dependencies():
    own = [HERE/name for name in ('run-once.py','test-admission.py','prepare-and-validate.ts','WIRE.json','PREPARED-INPUT.json','OUTPUT-SCHEMA.json','LOCAL-BASELINE.json','GRADING-BINDINGS.json','AUTHORIZATION.json')]
    source = REPO/'web/lib/sources'
    runtime = [source/(name+'.ts') for name in ('playerIdentitySnapshot','tweetIdentityCandidates','tweetIdentityProposal','tweetIdentityLocalReview','tweetNewsInference','playerAliasReview','tweetNewsPhraseDictionary')]
    evidence = [HERE.parent/'real-trial-2026-10-20'/name for name in ('DIRECTORY.json','APPROVED-EXPORT.json','OWNER-BINDINGS.json')]
    evidence += [HERE.parent/'real-trial-preflight'/name for name in ('PUBLIC-PRICING-AND-BOUND.json','WIRE-PARAMETERS.json')]
    return list(dict.fromkeys(own+runtime+evidence+[source/'fixtures/iftttComparisonObservations.json',source/'decisionsReference/adapter.mjs',GUARD]+pilot.execution_paths()))

def check_wire():
    wire, prepared = read('WIRE.json'), read('PREPARED-INPUT.json')
    require(set(wire) == {'model','max_output_tokens','reasoning','service_tier','store','tools','prompt_cache_options','instructions','input','text'}, 'wire fields changed')
    pilot.basic_limits('responses',wire)
    require(wire['prompt_cache_options'] == {'mode':'explicit','ttl':'30m'}, 'cache policy changed')
    def no_breakpoints(value):
        if isinstance(value,dict):
            return 'prompt_cache_breakpoint' not in value and all(no_breakpoints(v) for v in value.values())
        return not isinstance(value,list) or all(no_breakpoints(v) for v in value)
    require(no_breakpoints(wire), 'cache breakpoint present')
    require(pilot.json_strict(wire['input']) == prepared and wire['instructions'] == '\n'.join(prepared['content']['instructions']), 'input/instruction drift')
    require(wire['text']['format'] == {'type':'json_schema','name':'tweet_identity_proposal_v1','strict':True,'schema':read('OUTPUT-SCHEMA.json')}, 'output schema drift')
    require(len(wire['input'].encode()) <= 65536, 'input scope exceeded')
    require(prepared['content']['pass'] == 0 and len(prepared['content']['occurrences']) == 2, 'unreviewed paid widening/scope')
    baseline = read('LOCAL-BASELINE.json')
    require(baseline['modelMode'] == 'not_run' and baseline['attempts'] == 0, 'model already called')
    require([o['deterministicSelectedId'] for o in baseline['occurrences']] == ['nhl:8481617',None], 'baseline semantics changed')
    return wire

def seal():
    require(sha(LEDGER) == BASE_SHA, 'ledger drift; read-only reconciliation needed')
    db = sqlite3.connect(LEDGER.as_uri()+'?mode=ro',uri=True)
    try:
        require(not db.execute('SELECT 1 FROM attempts WHERE id=?',(ATTEMPT,)).fetchone(), 'attempt exists')
        policy = {'scope':'User authorized generic acronym correction and exactly one bounded S06 Responses request after review, same total cap; no retries, paid widening, fan-out, alias writes or publication.',
                  'attemptId':ATTEMPT,'maxRequests':1,'capNanoUsd':CAP,'reserveNanoUsd':RESERVE,
                  'baselineLedgerSha256':BASE_SHA,'baselineFingerprint':baseline_fingerprint(db),
                  'baselineExposureNanoUsd':exposure(db),'wireSha256':pilot.digest(check_wire()),'preserveOriginalUnknown':True}
        require(policy['baselineExposureNanoUsd'] + RESERVE <= CAP, 'insufficient aggregate budget')
        save('AUTHORIZATION.json',policy)
        save('MANIFEST.json',{'version':'s06-acronym-single-request-v1','files':[{'path':str(p),'sha256':sha(p)} for p in dependencies()]})
        print(json.dumps({'status':'sealed_for_independent_review','manifestSha256':sha(HERE/'MANIFEST.json'),'wireSha256':policy['wireSha256'],'maximumExposureNanoUsd':policy['baselineExposureNanoUsd']+RESERVE,'providerCalls':0}))
    finally: db.close()

def verify():
    manifest, policy, review = read('MANIFEST.json'), read('AUTHORIZATION.json'), read('INDEPENDENT-REVIEW.json')
    require(review.get('admissionApproved') is True and review.get('manifestSha256') == sha(HERE/'MANIFEST.json'), 'independent review absent or stale')
    require([e['path'] for e in manifest['files']] == [str(p) for p in dependencies()], 'missing dependency pin')
    for item in manifest['files']: require(sha(Path(item['path'])) == item['sha256'], 'sealed dependency drift')
    require(policy['attemptId'] == ATTEMPT and policy['maxRequests'] == 1 and policy['capNanoUsd'] == CAP and policy['reserveNanoUsd'] == RESERVE, 'authorization scope drift')
    wire = check_wire(); require(pilot.digest(wire) == policy['wireSha256'], 'wire digest drift')
    require(sha(LEDGER) == BASE_SHA, 'ledger drift; inspect instead of resend')
    db = sqlite3.connect(LEDGER.as_uri()+'?mode=ro',uri=True)
    try:
        check_originals(db,policy)
        require(not db.execute('SELECT 1 FROM attempts WHERE id=?',(ATTEMPT,)).fetchone(), 'attempt exists; no resend')
        require(exposure(db)+RESERVE <= CAP, 'budget unavailable')
    finally: db.close()
    return policy,wire

def run():
    policy,wire = verify()
    with (HERE/'EXECUTION-STARTED.json').open('x') as marker: json.dump({'attemptId':ATTEMPT,'startedAt':now(),'maximumCalls':1},marker)
    db = sqlite3.connect(LEDGER.as_uri()+'?mode=rw',uri=True,timeout=2,isolation_level=None)
    db.execute('PRAGMA synchronous=FULL')
    key = None; admitted = False; state = 'pre_admission'; body = audit = None; start = time.monotonic()
    try:
        reserve(db,policy,sha(HERE/'MANIFEST.json'),wire); admitted = True; state = 'key_loading'
        key = pilot.load_key()
        sealed = pilot.seal_payload('responses',wire)
        require(sealed.sha256 == policy['wireSha256'], 'sealed wire mismatch')
        with transaction(db):
            check_originals(db,policy)
            require(db.execute('SELECT state,request_hash FROM attempts WHERE id=?',(ATTEMPT,)).fetchone() == ('reserved',sealed.sha256), 'attempt changed')
            require(exposure(db) <= CAP, 'aggregate cap exceeded')
            db.execute("UPDATE attempts SET state='sent',started=? WHERE id=?",(now(),ATTEMPT))
        state = 'transport'
        body,audit = pilot.post_once('responses',sealed,key)  # Exactly one invocation. No retry loop.
        state = 'usage_validation'
        body,audit = pilot.redact_tree(body,key),pilot.redact_tree(audit,key)
        charge = charge_ceiling(body)
        record = {'attemptId':ATTEMPT,'requestHash':sealed.sha256,'manifestSha256':sha(HERE/'MANIFEST.json'),
                  'response':body,'audit':audit,'latencyMs':round((time.monotonic()-start)*1000),
                  'conservativeChargeCeilingNanoUsd':charge,'reservedNanoUsd':RESERVE,'chargeIncludesRegionalEnvelope':True}
        save('PROVIDER-RESULT.json',record)
        with transaction(db):
            check_originals(db,policy)
            require(db.execute('SELECT state FROM attempts WHERE id=?',(ATTEMPT,)).fetchone() == ('sent',), 'settlement state invalid')
            db.execute("UPDATE attempts SET state='settled',actual=?,response=?,finished=? WHERE id=?",(charge,pilot.canonical(record),now(),ATTEMPT))
        state = 'settled_answer_validation'
        messages = [m for m in body.get('output',[]) if m.get('type') == 'message']
        require(len(messages) == 1 and len(messages[0].get('content',[])) == 1, 'invalid answer cardinality')
        pilot.json_strict(messages[0]['content'][0]['text'])  # Reject duplicate keys/nonfinite numbers before TS validation.
        env = dict(os.environ, TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}',NODE_PATH='.')
        checked = subprocess.run(['node','-r','ts-node/register/transpile-only','-r',str(GUARD),str(HERE/'prepare-and-validate.ts'),'--validate'],cwd=REPO/'web',env=env,capture_output=True,text=True)
        require(checked.returncode == 0, 'identity proposal validation failed; see retained raw reply')
        save('EXECUTION-OUTCOME.json',{'status':'completed_validated_identity_shadow_trial','providerCalls':1,'attemptId':ATTEMPT,'usage':body['usage'],
             'actualChargeCeilingNanoUsd':charge,'reservedNanoUsd':RESERVE,'aggregateExposureNanoUsd':exposure(db),'originalUnknownAndBlockPreserved':True})
        print(json.dumps(read('EXECUTION-OUTCOME.json')))
    except Exception as exc:
        failure = exc.metadata if isinstance(exc,pilot.PilotFailure) else {'stage':state,'cause':type(exc).__name__,'message':'Stopped without retry; no exception text retained.'}
        if admitted and not state.startswith('settled'):
            with transaction(db):
                check_originals(db,policy)
                db.execute("UPDATE attempts SET state='uncertain',error=?,response=?,finished=? WHERE id=? AND state IN ('reserved','sent')",('unknown new outcome; no retry',pilot.canonical({'failure':failure,'providerMetadata':(audit or {}).get('providerMetadata')}),now(),ATTEMPT))
        save('EXECUTION-OUTCOME.json',{'status':'stopped_without_retry','stage':state,'failure':failure,'attemptAdmitted':admitted,
             'providerCallCount':'one attempted' if admitted and state not in ('key_loading','pre_admission') else 0,
             'aggregateExposureNanoUsd':exposure(db),'originalUnknownAndBlockPreserved':True})
        print(json.dumps(read('EXECUTION-OUTCOME.json')))
    finally:
        check_originals(db,policy)
        save('FINAL-LEDGER.json',{'ledgerSha256':sha(LEDGER),'attempt':db.execute('SELECT id,state,reserve,actual,error FROM attempts WHERE id=?',(ATTEMPT,)).fetchone(),
             'aggregateExposureNanoUsd':exposure(db),'capNanoUsd':CAP,'blocked':db.execute('SELECT blocked FROM experiment').fetchone()[0],
             'baselineFingerprintAfter':baseline_fingerprint(db),'originalRowsUnchanged':True})
        db.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); group = parser.add_mutually_exclusive_group(); group.add_argument('--seal',action='store_true'); group.add_argument('--execute',action='store_true'); args=parser.parse_args()
    if args.seal: seal()
    elif args.execute: run()
    else:
        verify(); print(json.dumps({'status':'reviewed_preflight_passed','providerCalls':0,'ledgerMode':'ro','keyRead':False}))
