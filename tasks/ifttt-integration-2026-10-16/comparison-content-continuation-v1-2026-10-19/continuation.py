"""One bounded missing-output continuation, reusing the reviewed transport.

Content failures remain recorded/held and do not abort independent evaluation.
Unknown spend/transport still stops. The canonical aggregate is never reset.
"""
import copy
import hashlib
import json
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

from adapter import HERE, BASE, VERSION, bridge, p, response_view
pilot = bridge.pilot
PREFIX = 'content-cont-v1-'
CAP = 520000000


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def pins(plan):
    for path, value in plan['runtime_pins'].items(): p.require(sha(path) == value, 'continuation pin drift')


def authority(plan, path, auth):
    p.require(isinstance(auth, dict) and auth.get('plan_hash') == p.digest(plan), 'exact continuation approval absent')
    live = Path(path).samefile(bridge.LIVE)
    if auth.get('test_only'):
        p.require(not live and auth.get('mode') == 'fake_transport_isolated_ledger', 'fake authority cannot mutate live ledger')
    else:
        p.require(live and auth.get('approved') is True and auth.get('authority') == 'owner-bounded-comparison-continuation'
                  and auth.get('owner_messages') == ['Sentinel_ebb4741523d08191a5c1758e396d6513', 'Sentinel_310f334b9f788191b3953303dbe16e1d'], 'owner scope mismatch')
    p.require(auth.get('maximum_calls') == 17 and auth.get('cap_nano_usd') == CAP and auth.get('preserve_unknown_nano_usd') == 254394800, 'scope or cap changed')


class Ledger(pilot.Ledger):
    def __init__(self, path, plan, auth):
        authority(plan, path, auth); pins(plan); self.plan = plan
        self.db = sqlite3.connect('file:' + str(Path(path).resolve()) + '?mode=rw', uri=True, timeout=2, isolation_level=None)
        self.db.execute('PRAGMA synchronous=FULL')
        try:
            with self.tx():
                self.check_baseline()
                self.db.execute('INSERT OR IGNORE INTO continuation_authorizations VALUES(?,?,?,?)',
                    (PREFIX, plan['baseline']['ledger_sha256'], p.digest(auth), p.digest(plan)))
                p.require(self.db.execute('SELECT baseline_sha,authorization_sha,manifest_sha FROM continuation_authorizations WHERE attempt_prefix=?', (PREFIX,)).fetchone()
                    == (plan['baseline']['ledger_sha256'], p.digest(auth), p.digest(plan)), 'continuation registration changed')
        except BaseException: self.db.close(); raise

    def check_baseline(self):
        b = self.plan['baseline']; slots = ','.join('?' for _ in b['attempt_ids'])
        p.require(p.digest(self.db.execute('SELECT * FROM attempts WHERE id IN (' + slots + ') ORDER BY id', b['attempt_ids']).fetchall()) == b['attempt_rows_hash'], 'historical attempts changed')
        for table, key, order in [('experiment', 'experiment_hash', 'id'), ('attempt_reconciliations', 'reconciliations_hash', 'id')]:
            p.require(p.digest(self.db.execute('SELECT * FROM ' + table + ' ORDER BY ' + order).fetchall()) == b[key], 'historical budget/reconciliation changed')
        p.require(p.digest(self.db.execute('SELECT * FROM continuation_authorizations WHERE attempt_prefix<>? ORDER BY attempt_prefix', (PREFIX,)).fetchall()) == b['authorizations_hash'], 'historical authorizations changed')

    def stages(self):
        ids = self.plan['baseline']['attempt_ids']; slots = ','.join('?' for _ in ids)
        return self.db.execute('SELECT id,state,error FROM attempts WHERE id NOT IN (' + slots + ') ORDER BY id', ids).fetchall()

    def committed_response(self, stage):
        row = self.db.execute('SELECT state,response FROM attempts WHERE id=?', (PREFIX + str(stage).zfill(2),)).fetchone()
        p.require(row and row[0] == 'settled' and row[1], 'committed response missing')
        return json.loads(row[1])['response']

    def view(self, item):
        response = self.plan['saved_S05_response'] if item['group'] == 'S05' else self.committed_response(item['producer_stage'])
        return response_view(self.plan['envelopes'][item['group']], response)

    def expected(self, stage):
        p.require(type(stage) is int and 0 <= stage < len(self.plan['schedule']) == 17, 'bounded stage count')
        item = self.plan['schedule'][stage]; envelope = self.plan['envelopes'][item['group']]
        if item['kind'] == 'extraction': return 'responses', self.plan['extraction_requests'][item['group']], None
        if item['kind'] == 'rules_decisions':
            normalized = p.normalize_family(envelope, self.plan['rules_outputs'][item['group']])
            p.require(not normalized['errors'], 'frozen rules output invalid')
            coverage = {'scored_record_ids': [r['record_id'] for r in envelope['records']], 'held_record_ids': [], 'content_held': False}
        else:
            coverage = self.view(item)
            normalized = coverage['verifier_set']
        return 'decisions', p.decisions_request(envelope, normalized), coverage

    def admit(self, stage, endpoint, request):
        pins(self.plan)
        expected, payload, _ = self.expected(stage)
        p.require(endpoint == expected and request == payload, 'request/source/proposal identity changed')
        if endpoint == 'responses':
            cap = self.plan['schedule'][stage]['output_cap']
            p.require(request['max_output_tokens'] == cap and request['tools'] == [] and request['reasoning'] == {'effort': 'none'}
                and request['service_tier'] == 'default' and request['store'] is False, 'unpriced extraction limit')
        wire = p.canonical(request).encode()
        return pilot.SealedPayload(endpoint, wire, hashlib.sha256(wire).hexdigest())

    def reserve(self, stage, endpoint, sealed):
        self.admit(stage, endpoint, sealed.as_dict())
        p.require(hashlib.sha256(sealed.wire).hexdigest() == sealed.sha256, 'wire hash mismatch')
        amount = self.plan['schedule'][stage]['reserve_nano_usd']
        with self.tx():
            self.check_baseline(); rows = self.stages()
            p.require(len(rows) == stage and all(r[0] == PREFIX + str(i).zfill(2) and r[1] == 'settled'
                and (r[2] is None or r[2].startswith('content_hold:')) for i, r in enumerate(rows)), 'new unresolved/duplicate stage; no retry')
            if self._exposure() + amount > CAP: raise pilot.BudgetStop('full next-call reservation cannot fit')
            self.db.execute("INSERT INTO attempts(id,bundle,endpoint,request,request_hash,reserve,state) VALUES(?,?,?,?,?,?,'reserved')",
                (PREFIX + str(stage).zfill(2), VERSION, endpoint, sealed.wire.decode(), p.digest(sealed.as_dict()), amount))

    def begin(self, stage, sealed):
        with self.tx():
            self.check_baseline(); rows = self.stages(); ident = PREFIX + str(stage).zfill(2)
            p.require(len(rows) == stage + 1 and rows[-1] == (ident, 'reserved', None)
                and all(r[1] == 'settled' and (r[2] is None or r[2].startswith('content_hold:')) for r in rows[:-1]), 'unresolved call; no resend')
            p.require(self.db.execute('SELECT request_hash FROM attempts WHERE id=?', (ident,)).fetchone() == (p.digest(sealed.as_dict()),), 'begin request changed')
            self.db.execute("UPDATE attempts SET state='sent',started=? WHERE id=?", (datetime.now(timezone.utc).isoformat(), ident))

    def record(self, stage, data, charge, content_hold):
        pilot.integer(charge)
        with self.tx():
            self.check_baseline(); ident = PREFIX + str(stage).zfill(2)
            row = self.db.execute('SELECT state,reserve FROM attempts WHERE id=?', (ident,)).fetchone()
            p.require(row and row[0] == 'sent' and charge <= row[1], 'settlement bound/state violation')
            self.db.execute("UPDATE attempts SET state='settled',actual=?,response=?,error=?,finished=? WHERE id=?",
                (charge, pilot.canonical(data), 'content_hold:producer_or_verifier' if content_hold else None, datetime.now(timezone.utc).isoformat(), ident))

    def unknown(self, stage, failure):
        super().uncertain(PREFIX + str(stage).zfill(2), 'continuation_unknown_spend', {'failure': failure})

    def snapshot(self):
        value = super().snapshot(); value['cap_nano_usd'] = CAP; value['original_unknown_nano_usd'] = 254394800
        return value


def run(path, plan, auth, *, transport, credential_loader, output):
    authority(plan, path, auth)
    if auth.get('test_only'): p.require(getattr(transport, 'offline_fake', False), 'fake authority requires fake transport')
    output = Path(output); output.mkdir(exist_ok=False)
    ledger = Ledger(path, plan, auth); records = []; key = None; status = 'in_progress'; failure = None
    try:
        for stage, item in enumerate(plan['schedule']):
            endpoint, request, coverage = ledger.expected(stage)
            sealed = ledger.admit(stage, endpoint, request); ledger.reserve(stage, endpoint, sealed)
            if key is None: key = credential_loader()
            ledger.begin(stage, sealed); start = time.monotonic()
            try:
                body, received_audit = transport(endpoint, sealed, key, lambda e, r: ledger.admit(stage, e, r))
                body = pilot.redact_tree(body, key)
                maximum_output = item.get('output_cap', 0)
                # The enforced server output cap, not an estimated short input,
                # justifies the smaller full-model reservation.
                charge = pilot.usage_cost(endpoint, body, 922000 if endpoint == 'responses' else 1050000, maximum_output)
                # Preserve the prior stricter category allowlist too.
                p.require(bridge.usage_cost(endpoint, body) == charge, 'usage category pricing mismatch')
            except Exception as exc:
                failure = exc.metadata if isinstance(exc, pilot.PilotFailure) else pilot.failure_metadata('continuation_transport_or_usage', exc, key, opened=True)
                ledger.unknown(stage, failure); status = 'stopped_uncertain_spend'; break
            content = None; review = None; held = False
            if endpoint == 'responses':
                content = response_view(plan['envelopes'][item['group']], body); held = content['content_held']
            else:
                try: review = p.parse_decisions(request, body); held = review['status'] != 'scored' or bool(coverage and coverage.get('content_held'))
                except (ValueError, KeyError, TypeError): review = {'status': 'content_invalid', 'probability': None}; held = True
            meta = received_audit.get('providerMetadata', {}) if isinstance(received_audit, dict) else {}
            if not isinstance(meta, dict): meta = {}
            record = pilot.redact_tree({'stage': stage, 'group': item['group'], 'kind': item['kind'], 'endpoint': endpoint,
                'request': request, 'requestHash': sealed.sha256, 'response': body,
                'audit': {'rawRedactedReply': pilot.canonical(body), 'headersRetained': False,
                    'providerMetadata': pilot.provider_metadata(key, status=meta.get('httpStatus'), headers={'x-request-id': meta.get('requestId')}, body=body)},
                'latencyMs': (time.monotonic() - start) * 1000, 'conservativeChargeCeilingNanoUsd': charge,
                'content': content, 'verifierReview': review, 'verifierCoverage': coverage,
                'content_held_not_spend_uncertain': held}, key)
            ledger.record(stage, record, charge, held); records.append(record)
            with (output / ('stage-' + str(stage).zfill(2) + '.json')).open('x') as f: json.dump(record, f, ensure_ascii=False, indent=2)
            print(p.canonical({'settled_stage': stage, 'group': item['group'], 'kind': item['kind'], 'content_held': held,
                'charge_ceiling_nano_usd': charge}), flush=True)
        else: status = 'completed_bounded_continuation'
    except pilot.BudgetStop: status = 'stopped_budget_before_dispatch'
    except Exception: status = 'stopped_admission_or_restart'; failure = {'category': 'admission_or_restart_refused'}
    finally:
        if status == 'in_progress': status = 'interrupted_or_incomplete'
        result = {'status': status, 'records': records, 'failure': failure, 'ledger': ledger.snapshot(),
                  'adapter_version': VERSION, 'maximum_calls': 17, 'automatic_retries': 0,
                  'factual_quality_winner': None, 'old_pass_unchanged': True}
        ledger.close()
        with (output / 'result.json').open('x') as f: json.dump(result, f, ensure_ascii=False, indent=2)
    return result
