"""One explicitly approved certifi attempt; retains the original uncertainty."""
import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / 'comparison-sequential-pilot-2026-10-19'))
import pilot

ORIGINAL_DB = ROOT / 'comparison-live-binding-2026-10-19/experiment-state/budget.sqlite'
ORIGINAL_SHA = 'ac28e83814ed20381b3cfee8049bfdc580dfc556f98ca1da33c70f0897015c44'
OUTPUT = ROOT / 'comparison-certifi-execution-2026-10-19'
AGGREGATE_DB = ROOT / 'comparison-retry-execution-2026-10-19/aggregate-budget.sqlite'
BASELINE_SHA = '3665ac2cb6506264ba9119e29356a193eda270477ba5c055b6edb88c3b8b5824'
RECONCILED_RETRY = 'lindgren-approved-retry-0'
CAP = 520_000_000
ORIGINAL_RESERVE = 254_394_800
RETRY_PREFIX = 'lindgren-certifi-attempt-'
APPROVAL = 'yes'
APPROVAL_QUESTION = 'May I make one further attempt using that fix, still within the approved $0.52 total cap?'
MANIFEST = HERE / 'execution-manifest.json'
AUTHORIZATION = HERE / 'authorization.json'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def required_paths():
    return [Path(__file__), HERE / 'test_attempt.py', *pilot.execution_paths(),
            pilot.HERE / 'test_pilot.py', ROOT / 'comparison-tls-reconciliation-2026-10-19/source-manifest.json',
            ROOT / 'comparison-tls-reconciliation-2026-10-19/reconciliation-receipt.json']


def verify():
    pilot.require(sha(Path(pilot.__file__)) == 'f51cad6f6dc67feed2b988c2451c92be216b34bd8c2269eef8d982e3b492913b', 'unapproved diagnostic binding')
    auth = json.loads(AUTHORIZATION.read_text())
    pilot.require(auth.get('userApproval') == APPROVAL and auth.get('approvalQuestion') == APPROVAL_QUESTION and auth.get('totalCapNanoUsd') == CAP, 'exact retry approval absent')
    pilot.require(auth.get('originalReservationNanoUsd') == ORIGINAL_RESERVE and auth.get('retriesAuthorized') == 1, 'retry scope changed')
    pilot.require(auth.get('payloadScope') == 'original Lindgren family to /v1/responses and /v1/decisions only', 'payload scope changed')
    pilot.require(auth.get('executionManifestSha256') == sha(MANIFEST), 'retry manifest not bound')
    m = json.loads(MANIFEST.read_text())
    pilot.require([x['path'] for x in m['files']] == [str(p.resolve()) for p in required_paths()], 'missing retry dependency')
    for entry in m['files']:
        pilot.require(sha(Path(entry['path'])) == entry['sha256'], 'retry dependency drift')
    pilot.require(pilot.digest(pilot.EXTRACTION) == '089b0f5245e08c54157766093a75e9904ce78b7baac77052ec52669e0e8d1086', 'original extraction changed')
    pilot.require(pilot.digest(pilot.PROFILE) == '3494fafa9784397e38fc528a455aacd390039c475043b6fe4225dad75ca32a68', 'source/labels/policy changed')
    rules = json.loads(pilot.RULES_OUTPUT.read_text())
    pilot.require(pilot.digest(rules) == '29c49101ec3566d16f0a8e7ae411109b5943311b78fe0dcd2fab7c38c111797c', 'rules proposals changed')
    pilot.require(sha(ORIGINAL_DB) == ORIGINAL_SHA, 'original ledger changed')
    pilot.require(sha(AGGREGATE_DB) == BASELINE_SHA, 'aggregate differs from reconciled baseline; inspect before any repeat')
    pilot.basic_limits('responses', pilot.EXTRACTION)
    pilot.require(pilot.EXTRACTION['input'] == pilot.canonical(pilot.request_input(pilot.PROFILE['source'])), 'source binding changed')
    return {'authorizationSha256': sha(AUTHORIZATION), 'manifestSha256': sha(MANIFEST), 'rules': rules}


class AggregateLedger(pilot.Ledger):
    """Continue the existing aggregate; never create, copy or reset a ledger."""
    def __init__(self, plan):
        original_bytes = ORIGINAL_DB.read_bytes()
        pilot.require(hashlib.sha256(original_bytes).hexdigest() == ORIGINAL_SHA, 'original ledger changed')
        source = sqlite3.connect('file:' + str(ORIGINAL_DB) + '?mode=ro', uri=True)
        try:
            originals = source.execute('SELECT * FROM attempts ORDER BY id').fetchall()
            old_experiment = source.execute('SELECT * FROM experiment').fetchone()
        finally:
            source.close()
        pilot.require(len(originals) == 1 and originals[0][0] == 'lindgren-0', 'unexpected original inventory')
        self.original_row = originals[0]
        pilot.require(self.original_row[6:8] == ('uncertain', None) and self.original_row[5] == ORIGINAL_RESERVE, 'original exposure changed')
        pilot.require(old_experiment[2:] == (260_000_000, 'unknown billed outcome'), 'unexpected original budget')
        self.original_block = old_experiment[3]
        self.receipt = json.loads((ROOT / 'comparison-tls-reconciliation-2026-10-19/reconciliation-receipt.json').read_text())
        self.db = sqlite3.connect('file:' + str(AGGREGATE_DB.resolve()) + '?mode=rw', uri=True, timeout=2, isolation_level=None)
        try:
            self.db.execute('PRAGMA synchronous=FULL')
            with self.tx():
                pilot.require(self.db.execute('SELECT cap FROM experiment').fetchone() == (CAP,), 'aggregate cap drift')
                self.zero_row = self.db.execute('SELECT * FROM attempts WHERE id=?',(RECONCILED_RETRY,)).fetchone()
                pilot.require(self.zero_row is not None and self.zero_row[5:8] == (ORIGINAL_RESERVE,'settled',0), 'reviewed zero settlement missing')
                zero_digest = hashlib.sha256(json.dumps(self.zero_row,sort_keys=True,separators=(',',':')).encode()).hexdigest()
                pilot.require(zero_digest == self.receipt['afterRowSha256'], 'reconciled retry row changed')
                self.db.execute('CREATE TABLE IF NOT EXISTS continuation_authorizations (attempt_prefix TEXT PRIMARY KEY, baseline_sha TEXT NOT NULL, authorization_sha TEXT NOT NULL, manifest_sha TEXT NOT NULL)')
                self.db.execute('INSERT OR IGNORE INTO continuation_authorizations VALUES(?,?,?,?)',(RETRY_PREFIX,BASELINE_SHA,plan['authorizationSha256'],plan['manifestSha256']))
                pilot.require(self.db.execute('SELECT baseline_sha,authorization_sha,manifest_sha FROM continuation_authorizations WHERE attempt_prefix=?',(RETRY_PREFIX,)).fetchone() ==
                              (BASELINE_SHA,plan['authorizationSha256'],plan['manifestSha256']), 'continuation authorization drift')
                self.check_original()
        except BaseException:
            self.db.close()
            raise

    def check_original(self):
        pilot.require(self.db.execute("SELECT * FROM attempts WHERE id='lindgren-0'").fetchone() == self.original_row, 'original attempt was modified')
        pilot.require(self.db.execute('SELECT * FROM attempts WHERE id=?',(RECONCILED_RETRY,)).fetchone() == self.zero_row, 'reviewed zero attempt was modified')
        pilot.require(json.loads(self.db.execute('SELECT record_json FROM attempt_reconciliations WHERE attempt_id=?',(RECONCILED_RETRY,)).fetchone()[0]) == self.receipt, 'reconciliation audit changed')

    def reserve(self, index, endpoint, payload, amount):
        pilot.require(type(index) is int and 0 <= index < 3, 'unapproved retry stage')
        pilot.require(endpoint == ('responses', 'decisions', 'decisions')[index], 'unapproved retry endpoint')
        pilot.require(amount == (ORIGINAL_RESERVE, 231_000_000, 231_000_000)[index], 'reservation changed')
        with self.tx():
            self.check_original()
            pilot.require(self.db.execute('SELECT blocked FROM experiment').fetchone() == (self.original_block,), 'new blocking outcome')
            rows = self.db.execute("SELECT id,state FROM attempts WHERE id NOT IN ('lindgren-0','lindgren-approved-retry-0') ORDER BY id").fetchall()
            pilot.require(rows == [(RETRY_PREFIX + str(i), 'settled') for i in range(index)], 'retry exists or previous outcome unresolved; no resend')
            if self._exposure() + amount > CAP:
                raise pilot.BudgetStop('aggregate remainder cannot cover next full reservation')
            self.db.execute("INSERT INTO attempts(id,bundle,endpoint,request,request_hash,reserve,state) VALUES(?,?,?,?,?,?,'reserved')",
                            (RETRY_PREFIX + str(index), 'user-approved-single-retry', endpoint, pilot.canonical(payload), pilot.digest(payload), amount))

    def begin(self, attempt_id, request):
        with self.tx():
            self.check_original()
            pilot.require(attempt_id in [RETRY_PREFIX + str(i) for i in range(3)], 'unapproved attempt ID')
            pilot.require(not self.db.execute("SELECT 1 FROM attempts WHERE id<>'lindgren-0' AND state IN ('sent','uncertain')").fetchone(), 'new unresolved attempt; no resend')
            pilot.require(self.db.execute('SELECT state,request_hash FROM attempts WHERE id=?', (attempt_id,)).fetchone() == ('reserved', pilot.digest(request)), 'changed or sent retry')
            self.db.execute("UPDATE attempts SET state='sent',started=? WHERE id=?", (datetime.now(timezone.utc).isoformat(), attempt_id))

    def snapshot(self):
        result = super().snapshot()
        result['cap_nano_usd'] = CAP
        result['original_unresolved_reservation_nano_usd'] = ORIGINAL_RESERVE
        return result


def run(plan, *, transport=pilot.post_once, key_loader=pilot.load_key):
    directory = OUTPUT / 'run-01'
    directory.mkdir(parents=True, exist_ok=False)
    ledger = AggregateLedger(plan)
    profile = pilot.PROFILE;source = profile['source'];rules = plan['rules']
    key = None;failure = None;stage = 'reserve';body = audit = None
    try:
        parsed = [];rules_review = pilot.decisions_request(rules, source)
        bodies = [pilot.EXTRACTION, rules_review, None]
        for i, endpoint in enumerate(('responses', 'decisions', 'decisions')):
            if i == 2:bodies[i] = pilot.decisions_request(parsed[0], source)
            sealed = pilot.seal_payload(endpoint, bodies[i]);request = sealed.as_dict()
            # Exact original extraction and reconstructed one-question reviews.
            if i == 0:pilot.require(sealed.sha256 == '089b0f5245e08c54157766093a75e9904ce78b7baac77052ec52669e0e8d1086', 'retry extraction drift')
            stage = 'reserve';failure = None
            ledger.reserve(i, endpoint, request, (ORIGINAL_RESERVE, 231_000_000, 231_000_000)[i])
            if key is None:key = key_loader()
            ident = RETRY_PREFIX + str(i);ledger.begin(ident, request)
            started = time.monotonic();body = audit = None;stage = 'transport'
            try:
                body, audit = transport(endpoint, sealed, key)
                stage = 'redact_reply';body = pilot.redact_tree(body, key);audit = pilot.redact_tree(audit, key)
                stage = 'usage_validation'
                charge = pilot.usage_cost(endpoint, body, 922000 if i == 0 else 1050000, 1024 if i == 0 else 0)
            except Exception as exc:
                provider = audit.get('providerMetadata', {}) if isinstance(audit, dict) else {}
                if not isinstance(provider, dict):provider = {}
                provider = pilot.provider_metadata(key, status=provider.get('httpStatus'), headers={'x-request-id':provider.get('requestId')}, body=body)
                failure = exc.metadata if isinstance(exc, pilot.PilotFailure) else pilot.failure_metadata(stage, exc, key, opened=True, provider=provider)
                ledger.uncertain(ident, 'PilotFailure', {'requestHash':sealed.sha256, 'failure':failure})
                raise pilot.PilotFailure(failure) from None
            record = pilot.redact_tree({'request':request, 'requestHash':sealed.sha256, 'manifestSha256':plan['manifestSha256'],
                                       'response':body, 'audit':audit, 'latencyMs':round((time.monotonic()-started)*1000),
                                       'observedChargeUpperNanoUsd':charge}, key)
            ledger.settle(ident, record, charge)
            (directory / f'attempt-{i}.json').write_text(json.dumps(record, indent=2))
            stage = 'output_validation'
            parsed.append(pilot.parse_extraction(body, source) if i == 0 else pilot.parse_decisions(request, body))
        rq = pilot.qualify(source, pilot.normalize(source, rules));xr = pilot.normalize(source, parsed[0]);xq = pilot.qualify(source, xr)
        rows = [rq, pilot.apply_review(rq, parsed[1]), xq, pilot.apply_review(xq, parsed[2])]
        result = {'status':'provisional_development_only', 'verdict':'inconclusive_single_exposed_family', 'nativeEligible':False,
                  'manifestSha256':plan['manifestSha256'], 'originalOutcome':'unresolved; reservation retained',
                  'chargeAccounting':'published usage-based conservative charge ceilings, not final account bill',
                  'reviews':parsed[1:], 'arms':{name:pilot.grade(source, profile['labels'], rows[i], (rules if i<2 else xr)['material']) for i,name in enumerate(profile['arms'])},
                  'ledger':ledger.snapshot()}
        (directory / 'report.json').write_text(json.dumps(result, indent=2))
        return result
    except Exception as exc:
        if failure is None and key is not None and stage == 'output_validation':
            failure = pilot.failure_metadata(stage, exc, key, opened=True, body=body)
        stopped = {'status':'stopped_budget' if isinstance(exc, pilot.BudgetStop) else 'stopped_partial_pair',
                   'failure':failure, 'errorType':'PilotFailure' if failure else type(exc).__name__, 'manifestSha256':plan['manifestSha256'],
                   'goldClaimsInDenominator':len(profile['labels']['claims']), 'familyMustNotBeExcluded':True,
                   'verdict':'inconclusive', 'ledger':ledger.snapshot()}
        (directory / 'stopped-partial-pair.json').write_text(json.dumps(stopped, indent=2))
        return stopped
    finally:
        (directory / 'final-ledger.json').write_text(json.dumps(ledger.snapshot(), indent=2))
        ledger.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser();parser.add_argument('--execute', action='store_true');args = parser.parse_args()
    if not args.execute:
        print(json.dumps({'status':'paused', 'keyRead':False, 'providerCalls':0, 'totalCapNanoUsd':CAP}))
    else:
        result = run(verify())
        print(json.dumps({'status':result['status'], 'verdict':result['verdict'], 'exposureNanoUsd':result['ledger']['exposure_nano_usd']}))
