"""Narrow multi-record transport/canonical-accounting bridge; no executable CLI.

No credential loader is imported/called by this module. Execution requires an
injected loader and exact approval; shipped tests inject fake transport and use
disposable copies of the one canonical SQLite aggregate.
"""
import hashlib
import json
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
sys.path.insert(0, str(BASE / 'comparison-offline-preflight-v1-2026-10-19'))
import preflight as p
from accounting import MAXIMA, usage_cost
sys.path.insert(0, str(BASE / 'comparison-sequential-pilot-2026-10-19'))
import pilot

LIVE = BASE / 'comparison-retry-execution-2026-10-19/aggregate-budget.sqlite'
PREFIX = 'human-benchmark-v2-'
CAP = 520000000


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_plan():
    return json.loads((HERE / 'PLAN.json').read_text())


def check_pins(plan):
    for path, expected in plan['runtime_pins'].items():
        p.require(sha(Path(path)) == expected, 'bridge dependency drift')


def approved(plan, path, authorization):
    p.require(isinstance(authorization, dict), 'explicit exact approval absent')
    live = Path(path).resolve() == LIVE.resolve() or Path(path).samefile(LIVE)
    if authorization.get('test_only') is True:
        p.require(not live and authorization.get('mode') == 'fake_transport_isolated_ledger', 'test authority cannot open canonical ledger')
    else:
        p.require(live, 'paid execution must use the canonical aggregate')
        p.require(authorization.get('authority') == 'owner-exact-comparison-approval'
                  and authorization.get('approved') is True and bool(authorization.get('owner_message_id'))
                  and authorization.get('ordinary_billing_assumptions_accepted') is True, 'specific owner approval required')
    p.require(authorization.get('plan_hash') == p.digest(plan) and authorization.get('maximum_calls') == 30
              and authorization.get('cap_nano_usd') == CAP and authorization.get('preserve_unknown_nano_usd') == 254394800,
              'approval plan/count/budget mismatch')


class CanonicalLedger(pilot.Ledger):
    """Existing canonical attempts/transactions/settlement, no side allowance."""
    def __init__(self, path, plan, authorization):
        approved(plan, path, authorization)
        check_pins(plan)
        self.plan = plan
        self.db = sqlite3.connect('file:' + str(Path(path).resolve()) + '?mode=rw', uri=True, timeout=2, isolation_level=None)
        self.db.execute('PRAGMA synchronous=FULL')
        try:
            with self.tx():
                self.check_baseline()
                self.db.execute('INSERT OR IGNORE INTO continuation_authorizations VALUES(?,?,?,?)',
                                (PREFIX, plan['baseline']['ledger_sha256'], p.digest(authorization), p.digest(plan)))
                p.require(self.db.execute('SELECT baseline_sha,authorization_sha,manifest_sha FROM continuation_authorizations WHERE attempt_prefix=?', (PREFIX,)).fetchone()
                          == (plan['baseline']['ledger_sha256'], p.digest(authorization), p.digest(plan)), 'continuation binding changed')
        except BaseException:
            self.db.close(); raise

    def check_baseline(self):
        b = self.plan['baseline']; ids = b['attempt_ids']; slots = ','.join('?' for _ in ids)
        rows = self.db.execute('SELECT * FROM attempts WHERE id IN (' + slots + ') ORDER BY id', ids).fetchall()
        p.require(p.digest(rows) == b['attempt_rows_hash'], 'prior attempt history changed')
        p.require(p.digest(self.db.execute('SELECT * FROM experiment ORDER BY id').fetchall()) == b['experiment_hash'], 'prior cap/block changed')
        p.require(p.digest(self.db.execute('SELECT * FROM attempt_reconciliations ORDER BY id').fetchall()) == b['reconciliations_hash'], 'prior reconciliation changed')
        registry = self.db.execute('SELECT * FROM continuation_authorizations WHERE attempt_prefix<>? ORDER BY attempt_prefix', (PREFIX,)).fetchall()
        p.require(p.digest(registry) == b['authorizations_hash'], 'prior authorization history changed')

    def _stages(self):
        ids = self.plan['baseline']['attempt_ids']; slots = ','.join('?' for _ in ids)
        return self.db.execute('SELECT id,state,error FROM attempts WHERE id NOT IN (' + slots + ') ORDER BY id', ids).fetchall()

    def committed(self, stage):
        row = self.db.execute('SELECT state,response FROM attempts WHERE id=?', (PREFIX + str(stage).zfill(2),)).fetchone()
        p.require(row and row[0] == 'settled' and row[1], 'committed producer output missing')
        return json.loads(row[1])

    def expected(self, stage):
        p.require(type(stage) is int and 0 <= stage < 30, 'maximum thirty requests')
        group = self.plan['scope']['groups'][stage // 3]
        envelope = self.plan['scope']['envelopes'][group]
        if stage % 3 == 0:
            return 'responses', self.plan['extraction_requests'][group]
        if stage % 3 == 1:
            raw = self.plan['rules_outputs'][group]
            normalized = p.normalize_family(envelope, raw)
        else:
            record = self.committed(stage - 2)
            raw = p.parse_extraction(record['response'])
            normalized = p.normalize_family(envelope, raw, aligned=True)
        return 'decisions', p.decisions_request(envelope, normalized)

    def admit(self, stage, endpoint, request):
        check_pins(self.plan)
        expected_endpoint, expected = self.expected(stage)
        p.require(endpoint == expected_endpoint and request == expected, 'exact stage/source/proposal/template mismatch')
        if endpoint == 'responses':
            p.require(request['max_output_tokens'] == 8192 and request['reasoning'] == {'effort': 'none'}
                      and request['tools'] == [] and request['store'] is False and request['service_tier'] == 'default', 'multi-record request limits')
        wire = p.canonical(request).encode()
        return pilot.SealedPayload(endpoint, wire, hashlib.sha256(wire).hexdigest())

    def reserve(self, stage, endpoint, sealed):
        self.admit(stage, endpoint, sealed.as_dict())
        p.require(hashlib.sha256(sealed.wire).hexdigest() == sealed.sha256, 'sealed payload corrupt')
        with self.tx():
            self.check_baseline()
            rows = self._stages()
            p.require(rows == [(PREFIX + str(i).zfill(2), 'settled', None) for i in range(stage)], 'prior stage exists, failed or uncertain; no resend')
            if self._exposure() + MAXIMA[endpoint] > CAP:
                raise pilot.BudgetStop('whole next-call reservation cannot fit aggregate cap')
            self.db.execute("INSERT INTO attempts(id,bundle,endpoint,request,request_hash,reserve,state) VALUES(?,?,?,?,?,?,'reserved')",
                            (PREFIX + str(stage).zfill(2), PREFIX, endpoint, sealed.wire.decode(), p.digest(sealed.as_dict()), MAXIMA[endpoint]))

    def begin(self, stage, sealed):
        with self.tx():
            self.check_baseline()
            ident = PREFIX + str(stage).zfill(2)
            rows = self._stages()
            p.require(rows == [(PREFIX + str(i).zfill(2), 'settled', None) for i in range(stage)] + [(ident, 'reserved', None)], 'new unresolved stage; no resend')
            p.require(self.db.execute('SELECT request_hash FROM attempts WHERE id=?', (ident,)).fetchone() == (p.digest(sealed.as_dict()),), 'begin request mismatch')
            self.db.execute("UPDATE attempts SET state='sent',started=? WHERE id=?", (datetime.now(timezone.utc).isoformat(), ident))

    def fail_closed(self, stage, failure):
        # Reuses the validated canonical unknown-reservation primitive; its
        # blocked value remains the preexisting exact string.
        super().uncertain(PREFIX + str(stage).zfill(2), 'bridge_unknown_outcome', {'failure': failure})

    def record(self, stage, record, charge, error=None):
        # Same canonical settlement fields/transaction primitive, with the stop
        # marker committed atomically so a priced invalid reply cannot look like
        # a successful prior stage after a lost application acknowledgement.
        pilot.integer(charge)
        with self.tx():
            self.check_baseline()
            ident = PREFIX + str(stage).zfill(2)
            row = self.db.execute('SELECT state,reserve FROM attempts WHERE id=?', (ident,)).fetchone()
            p.require(row and row[0] == 'sent' and charge <= row[1], 'invalid settlement state/bound')
            self.db.execute("UPDATE attempts SET state='settled',actual=?,response=?,error=?,finished=? WHERE id=?",
                            (charge, pilot.canonical(record), error, datetime.now(timezone.utc).isoformat(), ident))

    def snapshot(self):
        result = super().snapshot(); result['cap_nano_usd'] = CAP
        result['original_unknown_nano_usd'] = 254394800
        return result


def post_once(endpoint, sealed, key, admit):
    """Validated pilot transport body with new admission, old seals unchanged.

    Reuses pilot TLS/certifi/NoRedirect, fixed host, no proxy, bounded read,
    strict JSON, structural redaction and failure metadata. The only admission
    difference is the separately sealed multi-record 8192-output protocol.
    """
    stage = 'pre_dispatch'; opened = False; metadata = pilot.provider_metadata(key)
    try:
        p.require(endpoint in ('responses', 'decisions'), 'unapproved endpoint')
        admitted = admit(endpoint, sealed.as_dict())
        p.require(isinstance(sealed, pilot.SealedPayload) and admitted.wire == sealed.wire and admitted.sha256 == sealed.sha256, 'unadmitted wire')
        stage = 'construct'
        opener = pilot.request.build_opener(pilot.request.ProxyHandler({}),
            pilot.request.HTTPSHandler(context=pilot.ssl.create_default_context(cafile=pilot.certifi.where())), pilot.NoRedirect())
        req = pilot.request.Request('https://api.openai.com/v1/' + endpoint, data=sealed.wire, method='POST',
                                    headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        stage = 'open'; opened = True
        with opener.open(req, timeout=20) as response:
            metadata = pilot.provider_metadata(key, status=getattr(response, 'status', None), headers=getattr(response, 'headers', None))
            stage = 'read'; raw = response.read(1_048_577)
            p.require(len(raw) <= 1_048_576, 'reply overflow; uncertain billed outcome')
            stage = 'parse_json'; parsed = pilot.json_strict(raw.decode('utf-8'))
            metadata = pilot.provider_metadata(key, status=metadata['httpStatus'], body=parsed) | {'requestId': metadata['requestId']}
            body = pilot.redact_tree(parsed, key)
        return body, {'rawRedactedReply': pilot.canonical(body), 'representation': 'parsed_then_structurally_redacted',
                      'headersRetained': False, 'providerMetadata': metadata}
    except Exception as exc:
        if isinstance(exc, pilot.error.HTTPError):
            metadata = pilot.provider_metadata(key, status=exc.code, headers=exc.headers)
            try:
                raw = exc.read(1_048_577)
                if len(raw) <= 1_048_576:
                    parsed = pilot.json_strict(raw.decode('utf-8'))
                    metadata = pilot.provider_metadata(key, status=exc.code, body=parsed) | {'requestId': metadata['requestId']}
            except Exception: pass
            finally:
                try: exc.close()
                except Exception: pass
        raise pilot.PilotFailure(pilot.failure_metadata(stage, exc, key, opened=opened, provider=metadata)) from None


def run(path, plan, authorization, *, transport, credential_loader, output):
    """Dependency-injected transport; no default key lookup or execute CLI."""
    approved(plan, path, authorization)
    if authorization.get('test_only'):
        p.require(getattr(transport, 'offline_fake', False) is True, 'test scope requires fake transport')
    output = Path(output); output.mkdir(exist_ok=False)
    ledger = CanonicalLedger(path, plan, authorization)
    key = None; records = []; failure = None; status = 'in_progress'
    try:
        for stage in range(30):
            endpoint, request = ledger.expected(stage)
            sealed = ledger.admit(stage, endpoint, request)
            ledger.reserve(stage, endpoint, sealed)  # before any key loading
            if key is None: key = credential_loader()
            ledger.begin(stage, sealed)
            started = time.monotonic()
            try:
                body, audit = transport(endpoint, sealed, key, lambda e, r: ledger.admit(stage, e, r))
                body = pilot.redact_tree(body, key)
                meta = audit.get('providerMetadata', {}) if isinstance(audit, dict) else {}
                if not isinstance(meta, dict): meta = {}
                audit = {'rawRedactedReply': pilot.canonical(body), 'representation': 'parsed_then_structurally_redacted',
                         'headersRetained': False, 'providerMetadata': pilot.provider_metadata(key, status=meta.get('httpStatus'),
                            headers={'x-request-id': meta.get('requestId')}, body=body)}
                charge = usage_cost(endpoint, body)
            except Exception as exc:
                failure = exc.metadata if isinstance(exc, pilot.PilotFailure) else pilot.failure_metadata('transport_or_usage', exc, key, opened=True)
                ledger.fail_closed(stage, failure); status = 'stopped_uncertain'; break
            record = pilot.redact_tree({'stage': stage, 'endpoint': endpoint, 'request': request, 'requestHash': sealed.sha256,
                'response': body, 'audit': audit, 'latencyMs': (time.monotonic() - started) * 1000,
                'conservativeChargeCeilingNanoUsd': charge}, key)
            error = None
            try:
                if endpoint == 'responses':
                    raw = p.parse_extraction(body)
                    envelope = plan['scope']['envelopes'][plan['scope']['groups'][stage // 3]]
                    p.require(not p.normalize_family(envelope, raw, aligned=True)['errors'], 'invalid extraction')
                else:
                    record['verifierReview'] = p.parse_decisions(request, body)
                    if record['verifierReview']['status'] != 'scored': error = 'stop_verifier_refusal'
            except (ValueError, KeyError, TypeError): error = 'stop_malformed_or_incomplete_output'
            ledger.record(stage, record, charge, error)
            records.append(record)
            with (output / ('stage-' + str(stage).zfill(2) + '.json')).open('x') as f: json.dump(record, f, ensure_ascii=False, indent=2)
            if error: status = 'stopped_priced_output_error'; break
        else:
            status = 'completed'
    except pilot.BudgetStop:
        status = 'stopped_budget_before_dispatch'
    except Exception:
        status = 'stopped_admission_or_restart'; failure = {'category': 'admission_or_restart_refused'}
    finally:
        if status == 'in_progress': status = 'interrupted_or_incomplete'
        result = {'status': status, 'records': records, 'failure': failure, 'ledger': ledger.snapshot(),
                  'maximum_requests': 30, 'automatic_retries': 0, 'all_ten_groups_retained_in_denominator': True,
                  'missing_outputs_explicit': True, 'automatic_factual_winner': None}
        ledger.close()
        with (output / 'result.json').open('x') as f: json.dump(result, f, ensure_ascii=False, indent=2)
    return result
