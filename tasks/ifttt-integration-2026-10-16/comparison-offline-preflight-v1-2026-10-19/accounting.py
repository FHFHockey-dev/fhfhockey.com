"""Offline-only sequential continuation, exercised solely in disposable ledgers.

The canonical live budget path is refused before opening SQLite. No transport
exists. A future paid executor/approval is a separate integration boundary.
"""
from __future__ import annotations

import json
import math
import sqlite3
from contextlib import contextmanager
from fractions import Fraction
from pathlib import Path

from preflight import BASE, MODEL, MAX_OUTPUT, canonical, digest, require, parse_extraction, normalize_family, proposal_hash

LIVE = (BASE / 'comparison-retry-execution-2026-10-19/aggregate-budget.sqlite').resolve()
CAP = 520000000
BASE_EXPOSURE = 254807878
ORIGINAL_UNKNOWN = 254394800
MAXIMA = {'responses': 260308400, 'decisions': 231000000}


def integer(value):
    require(type(value) is int and value >= 0, 'invalid usage integer')
    return value


def ceil(value):
    return -(-value.numerator // value.denominator)


def response_hash(value):
    try:
        return digest(value)
    except (ValueError, TypeError):
        return None


def usage_cost(endpoint, body):
    require(endpoint in MAXIMA, 'unpriced endpoint')
    require(body.get('model') == MODEL and body.get('service_tier', 'default') == 'default', 'unpriced model/tier')
    usage = body.get('usage')
    require(isinstance(usage, dict) and set(usage) <= {'input_tokens', 'output_tokens', 'total_tokens', 'input_tokens_details', 'output_tokens_details'}, 'unknown billed usage')
    inputs = integer(usage.get('input_tokens')); outputs = integer(usage.get('output_tokens'))
    require(integer(usage.get('total_tokens')) == inputs + outputs, 'usage total mismatch')
    require(inputs <= (922000 if endpoint == 'responses' else 1050000), 'input bound violation')
    require(outputs <= (MAX_OUTPUT if endpoint == 'responses' else 0), 'output bound violation')
    details = usage.get('input_tokens_details') or {}; out_details = usage.get('output_tokens_details') or {}
    require(isinstance(details, dict) and set(details) <= {'cached_tokens', 'cache_write_tokens'}, 'unknown input category')
    require(isinstance(out_details, dict) and set(out_details) <= {'reasoning_tokens'}, 'unknown output category')
    require(integer(details.get('cached_tokens', 0)) + integer(details.get('cache_write_tokens', 0)) <= inputs, 'cache accounting mismatch')
    require(integer(out_details.get('reasoning_tokens', 0)) <= outputs, 'reasoning accounting mismatch')
    long = inputs > 272000
    rate = Fraction('.25' if long else '.125') if endpoint == 'responses' else Fraction('.20' if long else '.10')
    out_rate = Fraction('.75' if long else '.50')
    return ceil((inputs * rate + outputs * out_rate) * Fraction('1.10') * 1000)


def prior_rows(db):
    return db.execute('SELECT id,endpoint,reserve,state,actual FROM attempts ORDER BY rowid').fetchall()


class OfflineContinuation:
    def __init__(self, path, scope):
        path = Path(path).resolve()
        require(path != LIVE and not path.samefile(LIVE) if path.exists() else path != LIVE, 'live budget forbidden')
        require(path.is_file(), 'existing disposable ledger copy required')
        require(scope['mode'] == 'offline_fixture_only', 'paid execution unsupported')
        require(scope['maximum_requests'] == 30 and len(scope['groups']) == 10 and len(set(scope['groups'])) == 10, 'scope limits')
        self.scope = scope
        self.db = sqlite3.connect(path, timeout=2, isolation_level=None)
        self.db.execute('PRAGMA synchronous=FULL')
        try:
            require(self.db.execute('SELECT cap,blocked FROM experiment WHERE id=1').fetchone() == (CAP, 'unknown billed outcome'), 'prior aggregate state mismatch')
            original = prior_rows(self.db)
            require(digest(original) == scope['original_rows_hash'], 'prior attempts changed')
            require(digest(self.db.execute('SELECT * FROM attempts ORDER BY rowid').fetchall()) == scope['original_full_rows_hash'], 'prior full attempt rows changed')
            require(sum(r[4] if r[3] == 'settled' else max(r[2], r[4] or 0) for r in original) == BASE_EXPOSURE, 'prior exposure mismatch')
            unknown = [r for r in original if r[3] != 'settled']
            require(len(unknown) == 1 and unknown[0][0] == 'lindgren-0' and unknown[0][2:] == (ORIGINAL_UNKNOWN, 'uncertain', None), 'prior unknown reservation changed')
            with self.tx():
                self.db.execute('CREATE TABLE IF NOT EXISTS offline_comparison_scope(id INTEGER PRIMARY KEY CHECK(id=1), scope_hash TEXT NOT NULL, stopped TEXT)')
                self.db.execute('CREATE TABLE IF NOT EXISTS offline_comparison_attempts(stage INTEGER PRIMARY KEY CHECK(stage>=0 AND stage<30), endpoint TEXT NOT NULL, request_hash TEXT NOT NULL, reserve INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN (\'reserved\',\'sent\',\'settled\',\'uncertain\')), actual INTEGER, response_hash TEXT, output_proposals_hash TEXT, latency_ms REAL, usage_json TEXT)')
                self.db.execute('INSERT OR IGNORE INTO offline_comparison_scope VALUES(1,?,NULL)', (digest(scope),))
                require(self.db.execute('SELECT scope_hash FROM offline_comparison_scope').fetchone()[0] == digest(scope), 'continuation scope mismatch')
        except BaseException:
            self.db.close()
            raise

    @contextmanager
    def tx(self):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            yield
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK')
            raise

    def close(self):
        self.db.close()

    def _exposure(self):
        require(digest(prior_rows(self.db)) == self.scope['original_rows_hash'], 'original attempts changed')
        require(digest(self.db.execute('SELECT * FROM attempts ORDER BY rowid').fetchall()) == self.scope['original_full_rows_hash'], 'original full attempt rows changed')
        require(self.db.execute('SELECT cap,blocked FROM experiment WHERE id=1').fetchone() == (CAP, 'unknown billed outcome'), 'original cap/block changed')
        extra = self.db.execute("SELECT COALESCE(SUM(CASE WHEN state='settled' THEN actual ELSE MAX(reserve,COALESCE(actual,0)) END),0) FROM offline_comparison_attempts").fetchone()[0]
        return BASE_EXPOSURE + extra

    def snapshot(self):
        return {'exposure': self._exposure(), 'cap': CAP,
                'stopped': self.db.execute('SELECT stopped FROM offline_comparison_scope').fetchone()[0],
                'rows': self.db.execute('SELECT * FROM offline_comparison_attempts ORDER BY stage').fetchall(),
                'prior_rows': prior_rows(self.db)}

    def reserve(self, stage, request, seal):
        require(type(stage) is int and 0 <= stage < 30, 'request count cap')
        expected_endpoint = 'responses' if stage % 3 == 0 else 'decisions'
        require(seal['endpoint'] == expected_endpoint and seal['group_id'] == self.scope['groups'][stage // 3], 'stage identity mismatch')
        require(seal['request_hash'] == digest(request), 'request differs from seal')
        import hashlib
        wire = canonical(request).encode()
        require(seal['wire_sha256'] == hashlib.sha256(wire).hexdigest() and seal['wire_bytes'] == len(wire), 'wire differs from seal')
        require(seal['input_hash'] == self.scope['input_hashes'][seal['group_id']], 'context changed')
        require(seal['producer_pins_hash'] == self.scope['producer_pins_hash'], 'producer changed')
        require(request.get('model') == MODEL, 'unexpected model')
        if expected_endpoint == 'responses':
            require(request.get('max_output_tokens') == MAX_OUTPUT and request.get('tools') == [] and request.get('service_tier') == 'default', 'Responses pricing/limit mismatch')
            require(digest(request) == self.scope['extraction_request_hashes'][seal['group_id']], 'extraction not presealed')
        else:
            require(len(request.get('questions', [])) == 1 and request['questions'][0].get('type') == 'predicate', 'single question required')
            require(seal.get('postprocessing_policy') == ('strict-raw-v1' if stage % 3 == 1 else 'unique-exact-quote-v1'), 'unreviewed processing policy')
            require(set(request) == {'model', 'input', 'questions'} and digest(request['questions']) in self.scope['decision_question_hashes'], 'verifier template changed')
            payload = json.loads(request['input'])
            require(set(payload) == {'source', 'proposals', 'revisions'} and payload['source'] == self.scope['envelopes'][seal['group_id']], 'verifier source/context mismatch')
            require(isinstance(payload['proposals'], list) and isinstance(payload['revisions'], list), 'verifier proposal shape')
        failure = None
        with self.tx():
            stopped = self.db.execute('SELECT stopped FROM offline_comparison_scope').fetchone()[0]
            require(stopped is None, 'scope already stopped: ' + str(stopped))
            rows = self.db.execute('SELECT stage,state FROM offline_comparison_attempts ORDER BY stage').fetchall()
            require(all(s == 'settled' for _, s in rows), 'unsettled prior call; no continuation')
            require(stage == len(rows), 'out of order or duplicate stage')
            if expected_endpoint == 'decisions':
                if stage % 3 == 1:
                    expected_proposals = self.scope['rules_proposal_hashes'][seal['group_id']]
                else:
                    expected_proposals = self.db.execute('SELECT output_proposals_hash FROM offline_comparison_attempts WHERE stage=?', (stage - 2,)).fetchone()[0]
                require(expected_proposals is not None and digest({'proposals': payload['proposals'], 'revisions': payload['revisions']}) == expected_proposals, 'verifier proposal set not bound to producer output')
            if self._exposure() + MAXIMA[expected_endpoint] > CAP:
                failure = 'budget_stop_before_dispatch'
                self.db.execute('UPDATE offline_comparison_scope SET stopped=?', (failure,))
            else:
                self.db.execute('INSERT INTO offline_comparison_attempts VALUES(?,?,?,?,\'reserved\',NULL,NULL,NULL,NULL,NULL)',
                                (stage, expected_endpoint, digest(request), MAXIMA[expected_endpoint]))
        if failure:
            raise ValueError(failure)

    def begin(self, stage, request):
        with self.tx():
            self._exposure()
            require(self.db.execute('SELECT stopped FROM offline_comparison_scope').fetchone()[0] is None, 'scope stopped')
            row = self.db.execute('SELECT state,request_hash FROM offline_comparison_attempts WHERE stage=?', (stage,)).fetchone()
            require(row == ('reserved', digest(request)), 'not reserved or already sent; never resend')
            require(not self.db.execute('SELECT 1 FROM offline_comparison_attempts WHERE state IN (\'sent\',\'uncertain\')').fetchone(), 'one in flight')
            self.db.execute('UPDATE offline_comparison_attempts SET state=\'sent\' WHERE stage=?', (stage,))

    def settle(self, stage, response, *, body_valid=True, latency_ms=None):
        require(latency_ms is None or type(latency_ms) in (int, float) and math.isfinite(latency_ms) and latency_ms >= 0, 'invalid observed latency')
        failure = None
        with self.tx():
            row = self.db.execute('SELECT endpoint,reserve,state FROM offline_comparison_attempts WHERE stage=?', (stage,)).fetchone()
            require(row and row[2] == 'sent', 'not a sent attempt')
            try:
                charge = usage_cost(row[0], response)
                require(charge <= row[1], 'reservation bound violation')
            except (ValueError, TypeError, KeyError, AttributeError):
                failure = 'ambiguous_or_unpriced_usage'
                self.db.execute('UPDATE offline_comparison_attempts SET state=\'uncertain\',response_hash=? WHERE stage=?', (response_hash(response), stage))
            else:
                self.db.execute('UPDATE offline_comparison_attempts SET state=\'settled\',actual=?,response_hash=?,latency_ms=?,usage_json=? WHERE stage=?',
                                (charge, response_hash(response), latency_ms, canonical(response['usage']), stage))
                if row[0] == 'responses' and body_valid:
                    try:
                        output = parse_extraction(response)
                        envelope = self.scope['envelopes'][self.scope['groups'][stage // 3]]
                        normalized = normalize_family(envelope, output, aligned=True)
                        require(not normalized['errors'], 'invalid extraction after exact alignment')
                        self.db.execute('UPDATE offline_comparison_attempts SET output_proposals_hash=? WHERE stage=?', (proposal_hash(normalized), stage))
                    except (ValueError, KeyError, TypeError):
                        body_valid = False
                if not body_valid:
                    failure = 'invalid_or_incomplete_body_after_priced_usage'
            if failure:
                self.db.execute('UPDATE offline_comparison_scope SET stopped=?', (failure,))
        if failure:
            raise ValueError(failure)

    def uncertain(self, stage):
        with self.tx():
            row = self.db.execute('SELECT state FROM offline_comparison_attempts WHERE stage=?', (stage,)).fetchone()
            require(row == ('sent',), 'only a sent attempt may become uncertain')
            self.db.execute('UPDATE offline_comparison_attempts SET state=\'uncertain\' WHERE stage=?', (stage,))
            self.db.execute('UPDATE offline_comparison_scope SET stopped=\'uncertain_transport_outcome\'')
