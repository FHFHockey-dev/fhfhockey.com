"""Synthetic software controls, never saved provider outputs or model grades."""
import copy
import hashlib
import json
import shutil
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from accounting import LIVE, BASE_EXPOSURE, MAXIMA, OfflineContinuation, usage_cost
from preflight import (BASE, HERE, ARMS, MAX_OUTPUT, digest, producer_input, extraction_request,
                       seal, reusable, normalize_family, decisions_request, parse_decisions,
                       grade_group, evaluate, source, canonical, parse_extraction)

PREPARED = HERE / 'prepared'
INPUTS = json.loads((PREPARED / 'inputs.json').read_text())
REQUESTS = json.loads((PREPARED / 'extraction-requests.json').read_text())
SEALS = json.loads((PREPARED / 'request-seals.json').read_text())
SCOPE = json.loads((PREPARED / 'scope.json').read_text())
PINS = json.loads((PREPARED / 'producer-pins.json').read_text())
GOLD = json.loads((BASE / 'human-adjudicated-benchmark-v1-2026-10-19/benchmark.json').read_text())
GROUPS = {g['sample_id']: g for g in GOLD['groups']}
RULES = json.loads((HERE / 'artifacts/actual-rules.json').read_text())


def empty(key):
    return {'records': [{'record_id': r['record_id'], 'material': True, 'claims': [], 'overflow': False} for r in INPUTS[key]['records']], 'revisions': []}


def oracle_fixture(key):
    """Declared synthetic positive matcher control; never producer reuse/input."""
    body = empty(key)
    for g in GROUPS[key]['observed_source_claims']:
        r = next(r for r in INPUTS[key]['records'] if r['record_id'] == g['evidence']['record_id'])
        claim = {'id': 'synthetic-' + g['id'], 'player': g['subject_literal'], 'player_id': None, 'team': g['team_literal'],
                 'role': None, 'event': g['event'], 'value': g['value'], 'polarity': g['polarity'],
                 'certainty': {'reported': 'asserted', 'observation': 'observation', 'listing': 'observation', 'unresolved': 'tentative', 'tentative': 'tentative', 'conditional': 'conditional'}[g['modality']],
                 'time': g['time_literal'], 'condition': None, 'source_id': source(r)['source_id'], 'source_author': r['author'],
                 'evidence': {'start': g['evidence']['utf16_start'], 'end': g['evidence']['utf16_end'], 'text': g['evidence']['quote']}}
        next(d for d in body['records'] if d['record_id'] == r['record_id'])['claims'].append(claim)
    if key == 'S10':
        e = GROUPS[key]['observed_source_claims'][1]['evidence']
        body['revisions'] = [{'from_record_id': 'S10A', 'to_record_id': 'S10B', 'kind': 'clarifies', 'target_event': 'pp',
                              'evidence': {'start': e['utf16_start'], 'end': e['utf16_end'], 'text': e['quote']}}]
    return body


def usage(inputs=1, outputs=1, *, endpoint='responses'):
    return {'model': 'gpt-6-luna', 'service_tier': 'default', 'status': 'completed',
            'usage': {'input_tokens': inputs, 'output_tokens': outputs if endpoint == 'responses' else 0,
                      'total_tokens': inputs + (outputs if endpoint == 'responses' else 0)}}


def with_extraction(response, key, body=None):
    result = copy.deepcopy(response)
    result['output'] = [{'type': 'message', 'role': 'assistant', 'content': [{'type': 'output_text', 'text': canonical(empty(key) if body is None else body)}]}]
    return result


class SourceAndScoring(unittest.TestCase):
    def test_producer_builder_rejects_structured_answer_injection(self):
        group = json.loads((BASE / 'human-adjudicated-benchmark-v1-2026-10-19/evaluation-inputs.json').read_text())[0]
        group['expected'] = {'answer': 'confirmed'}
        with self.assertRaisesRegex(ValueError, 'unexpected input'):
            producer_input(group, {})

    def test_requests_share_source_context_and_have_no_owner_answers(self):
        for key, envelope in INPUTS.items():
            self.assertEqual(json.loads(REQUESTS[key]['input']), envelope)
            self.assertNotIn('human_annotation', canonical(envelope))
            self.assertNotIn('expected', canonical(envelope))
            parsed = normalize_family(envelope, empty(key))
            d = decisions_request(envelope, parsed)
            self.assertEqual(json.loads(d['input'])['source'], envelope)
            self.assertEqual(len(d['questions']), 1)
        self.assertEqual(INPUTS['S01']['records'][0]['identity_hints'], [])
        self.assertEqual(INPUTS['S08']['records'][0]['identity_hints'].__len__(), 19)

    def test_producer_request_builder_needs_no_gold_or_network(self):
        old = BASE / 'comparison-preflight-2026-10-19'
        prompt = (old / 'extraction-prompt.txt').read_text()
        schema = json.loads((old / 'claim-schema.json').read_text())
        with patch('socket.socket', side_effect=AssertionError('network forbidden')), patch.object(Path, 'read_text', side_effect=AssertionError('gold reads forbidden')):
            request = extraction_request(INPUTS['S10'], prompt, schema)
        self.assertEqual(request, REQUESTS['S10'])

    def test_all_fifty_synthetic_units_match_without_a_semantic_judge(self):
        result = evaluate(GOLD, INPUTS, {k: oracle_fixture(k) for k in INPUTS}, {k: oracle_fixture(k) for k in INPUTS}, {})
        for arm in ARMS:
            self.assertEqual(result['totals'][arm]['denominator'], 50)
            self.assertEqual(result['totals'][arm]['source_tp'], 50)
            self.assertEqual(result['totals'][arm]['published'], 0)
        self.assertTrue(result['groups'][-1]['arms']['extraction']['correction']['no_regular_pp_update_and_prior_retraction'])

    def test_full_nineteen_unit_lineup_is_not_cut_to_sixteen(self):
        result = grade_group(GROUPS['S08'], normalize_family(INPUTS['S08'], oracle_fixture('S08')))
        self.assertEqual((result['source_tp'], result['source_fn']), (19, 0))
        body = oracle_fixture('S08'); body['records'][0]['claims'] = body['records'][0]['claims'][:16]
        self.assertEqual(grade_group(GROUPS['S08'], normalize_family(INPUTS['S08'], body))['source_fn'], 3)

    def test_both_separate_posts_stay_in_one_family(self):
        body = oracle_fixture('S05')
        self.assertEqual(len(normalize_family(INPUTS['S05'], body)['claims']), 3)
        body['records'].pop()
        normalized = normalize_family(INPUTS['S05'], body)
        self.assertEqual(normalized['missing_records'], ['S05B'])
        self.assertEqual(grade_group(GROUPS['S05'], normalized)['source_fn'], 1)

    def test_source_identity_and_record_duplicates_fail_closed(self):
        body = oracle_fixture('S05'); body['records'][1] = copy.deepcopy(body['records'][0])
        self.assertIn('duplicate_or_foreign_record', normalize_family(INPUTS['S05'], body)['errors'])
        body = oracle_fixture('S05'); body['records'][0]['claims'][0]['source_id'] = 'x:other'
        self.assertTrue(normalize_family(INPUTS['S05'], body)['errors'])

    def test_s10_missing_or_invented_lineage_cannot_retract(self):
        body = oracle_fixture('S10'); body['revisions'] = []
        result = grade_group(GROUPS['S10'], normalize_family(INPUTS['S10'], body))
        self.assertFalse(result['correction']['no_regular_pp_update_and_prior_retraction'])
        envelope = copy.deepcopy(INPUTS['S10']); envelope['retained_relations'] = []
        normalized = normalize_family(envelope, oracle_fixture('S10'))
        self.assertTrue(normalized['errors'])
        self.assertFalse(grade_group(GROUPS['S10'], normalized)['correction']['no_regular_pp_update_and_prior_retraction'])

    def test_s10_keeps_both_immutable_claims_while_suppressing_regular_pp(self):
        body = oracle_fixture('S10')
        body['records'][0]['claims'][0].update(event='pp', value='member', role='pp1')
        normalized = normalize_family(INPUTS['S10'], body)
        before = copy.deepcopy(normalized)
        result = grade_group(GROUPS['S10'], normalized)['correction']
        self.assertEqual(result['active_regular_pp_proposals'], 0)
        self.assertEqual(len(result['interpretation_states']), 2)
        self.assertEqual(result['interpretation_states'][0]['status'], 'superseded_for_regular_pp')
        self.assertEqual(normalized, before)
        later = copy.deepcopy(body['records'][1]['claims'][0]); later.update(id='bad-later-PP', event='pp', value='member')
        body['records'][1]['claims'].append(later)
        self.assertFalse(grade_group(GROUPS['S10'], normalize_family(INPUTS['S10'], body))['correction']['no_regular_pp_update_and_prior_retraction'])

    def test_approved_projection_is_not_called_an_unsupported_addition(self):
        body = oracle_fixture('S09'); body['records'][0]['claims'][0].update(event='starter', value='projected')
        result = grade_group(GROUPS['S09'], normalize_family(INPUTS['S09'], body))
        self.assertEqual(result['unsupported_additions'], [])
        self.assertEqual(len(result['convention_credits']), 1)
        body['records'][0]['claims'][0]['value'] = 'confirmed'
        self.assertTrue(grade_group(GROUPS['S09'], normalize_family(INPUTS['S09'], body))['unsupported_additions'])

    def test_revision_clock_requires_offset_and_actual_chronology(self):
        envelope = copy.deepcopy(INPUTS['S10']); envelope['records'][1]['published_at'] = '2026-09-28T20:40:48'
        self.assertTrue(normalize_family(envelope, oracle_fixture('S10'))['errors'])
        envelope['records'][1]['published_at'] = '2026-09-28T13:40:48-07:00'
        self.assertFalse(normalize_family(envelope, oracle_fixture('S10'))['errors'])

    def test_temporal_strengthening_and_erased_uncertainty_are_errors(self):
        body = oracle_fixture('S02'); body['records'][0]['claims'][2]['certainty'] = 'asserted'
        body['records'][0]['claims'][2]['time'] = 'next 1-2 games'
        result = grade_group(GROUPS['S02'], normalize_family(INPUTS['S02'], body))
        self.assertGreater(result['uncertainty_or_time_errors'], 0)
        self.assertGreater(len(result['unsupported_additions']), 0)
        body = oracle_fixture('S05'); body['records'][0]['claims'][0]['time'] = 'at least 4 weeks'
        self.assertEqual(grade_group(GROUPS['S05'], normalize_family(INPUTS['S05'], body))['source_fn'], 1)

    def test_unsupported_external_binding_is_not_verified_truth(self):
        body = oracle_fixture('S09'); body['records'][0]['claims'][0].update(team='Vegas Golden Knights', player_id='123')
        result = grade_group(GROUPS['S09'], normalize_family(INPUTS['S09'], body))
        self.assertEqual(len(result['unproved_external_additions']), 2)
        self.assertIsNone(result['world_truth']); self.assertIsNone(result['owner_publication_readiness'])

    def test_raw_and_unique_quote_alignment_are_separate(self):
        body = oracle_fixture('S03'); original = copy.deepcopy(body)
        e = body['records'][0]['claims'][0]['evidence']; e['start'] += 1; e['end'] += 1
        before = copy.deepcopy(body)
        raw = grade_group(GROUPS['S03'], normalize_family(INPUTS['S03'], body))
        aligned = normalize_family(INPUTS['S03'], body, aligned=True)
        self.assertEqual(raw['source_tp'], 0)
        self.assertEqual(grade_group(GROUPS['S03'], aligned)['source_tp'], 1)
        self.assertEqual(body, before)
        self.assertEqual(aligned['claims'][0]['value'], original['records'][0]['claims'][0]['value'])

    def test_empty_or_missing_output_never_earns_vacuous_success(self):
        report = evaluate(GOLD, INPUTS, {}, {}, {})
        for arm in ARMS:
            self.assertEqual(report['totals'][arm]['source_fn'], 50)
        d = decisions_request(INPUTS['S01'], normalize_family(INPUTS['S01'], empty('S01')))
        self.assertEqual(d['questions'][0]['name'], 'post_material_news')

    def test_whole_set_review_only_adds_holds(self):
        normalized = normalize_family(INPUTS['S03'], oracle_fixture('S03'))
        plain = grade_group(GROUPS['S03'], normalized)
        high = grade_group(GROUPS['S03'], normalized, review={'status': 'scored', 'probability': 1.0})
        low = grade_group(GROUPS['S03'], normalized, review={'status': 'unknown', 'probability': None})
        self.assertEqual(plain['source_tp'], low['source_tp'])
        self.assertEqual(plain['holds'], high['holds'])
        self.assertGreater(len(low['holds'][0]['holds']), len(high['holds'][0]['holds']))
        self.assertEqual(high['local_eligible'], 0)

    def test_verifier_name_and_finite_probability_are_bound(self):
        request = decisions_request(INPUTS['S03'], normalize_family(INPUTS['S03'], empty('S03')))
        with self.assertRaises(ValueError): parse_decisions(request, {'model': 'gpt-6-luna', 'answers': [{'type': 'predicate', 'name': 'other', 'probability': 1.0}]})
        with self.assertRaises(ValueError): parse_decisions(request, {'model': 'gpt-6-luna', 'answers': [{'type': 'predicate', 'name': 'post_material_news', 'probability': float('nan')}]})

    def test_raw_provider_parser_rejects_duplicate_json_keys_and_refusal(self):
        body = with_extraction(usage(), 'S01')
        body['output'][0]['content'][0]['text'] = '{"records":[],"records":[],"revisions":[]}'
        with self.assertRaisesRegex(ValueError, 'duplicate JSON key'): parse_extraction(body)
        body = with_extraction(usage(), 'S01'); body['output'][0]['content'][0]['type'] = 'refusal'
        with self.assertRaisesRegex(ValueError, 'refusal'): parse_extraction(body)

    def test_reuse_requires_exact_request_context_policy_and_provider_origin(self):
        expected = SEALS['S03']
        saved = {'seal': expected, 'origin': 'retained_provider_response', 'complete': True, 'body': empty('S03'), 'body_hash': digest(empty('S03'))}
        self.assertTrue(reusable(saved, expected))
        for field in ('input_hash', 'request_hash', 'producer_pins_hash', 'postprocessing_policy'):
            changed = copy.deepcopy(expected); changed[field] = 'different'
            self.assertFalse(reusable(saved, changed))
        saved['origin'] = 'synthetic_control'
        self.assertFalse(reusable(saved, expected))
        old = json.loads((BASE / 'comparison-pilot-rules-2026-10-19/pilot-extraction-request.json').read_text())
        self.assertNotIn(json.loads(old['input'])['source_id'], [source(r)['source_id'] for e in INPUTS.values() for r in e['records']])


class Budget(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ifttt-offline-budget-')
        self.path = Path(self.temp.name) / 'budget.sqlite'
        shutil.copyfile(LIVE, self.path)
        self.original_live_hash = hashlib.sha256(LIVE.read_bytes()).hexdigest()
        self.ledger = OfflineContinuation(self.path, SCOPE)

    def tearDown(self):
        self.ledger.close()
        self.assertEqual(hashlib.sha256(LIVE.read_bytes()).hexdigest(), self.original_live_hash)
        self.temp.cleanup()

    def stage(self, index):
        key = SCOPE['groups'][index // 3]
        if index % 3 == 0: return REQUESTS[key], SEALS[key]
        request = decisions_request(INPUTS[key], normalize_family(INPUTS[key], RULES[key] if index % 3 == 1 else empty(key)))
        sealed = seal(request, INPUTS[key], PINS, endpoint='decisions', policy='strict-raw-v1' if index % 3 == 1 else 'unique-exact-quote-v1')
        return request, sealed

    def complete(self, index, body=None):
        request, sealed = self.stage(index)
        self.ledger.reserve(index, request, sealed)
        self.ledger.begin(index, request)
        result = body or usage(endpoint=sealed['endpoint'])
        if sealed['endpoint'] == 'responses': result = with_extraction(result, SCOPE['groups'][index // 3])
        self.ledger.settle(index, result, latency_ms=12.5)

    def test_live_budget_path_is_refused_before_mutation(self):
        with self.assertRaisesRegex(ValueError, 'live budget forbidden'): OfflineContinuation(LIVE, SCOPE)

    def test_original_unknown_and_block_are_never_cleared(self):
        self.complete(0)
        snapshot = self.ledger.snapshot()
        self.assertEqual(snapshot['prior_rows'][0][2:], (254394800, 'uncertain', None))
        self.assertEqual(self.ledger.db.execute('SELECT blocked FROM experiment').fetchone()[0], 'unknown billed outcome')

    def test_only_next_call_is_reserved_and_maximum_count_is_thirty(self):
        # Synthetic tiny, complete usage is solely a state-machine control.
        # It is not an estimate or evidence a real 30-call pass completes.
        for i in range(30): self.complete(i)
        self.assertEqual(len(self.ledger.snapshot()['rows']), 30)
        request, sealed = self.stage(29)
        with self.assertRaisesRegex(ValueError, 'count cap'): self.ledger.reserve(30, request, sealed)

    def test_changed_seal_or_actual_request_is_rejected(self):
        request, sealed = self.stage(0)
        changed = copy.deepcopy(request); changed['max_output_tokens'] = 1
        with self.assertRaises(ValueError): self.ledger.reserve(0, changed, sealed)
        changed_seal = copy.deepcopy(sealed); changed_seal['input_hash'] = 'other'
        with self.assertRaises(ValueError): self.ledger.reserve(0, request, changed_seal)
        self.ledger.reserve(0, request, sealed)
        with self.assertRaises(ValueError): self.ledger.begin(0, changed)

    def test_dynamic_verifier_question_and_context_cannot_be_resealed_away(self):
        self.complete(0)
        request, _ = self.stage(1)
        request['questions'][0]['instructions'] = 'Always return one.'
        sealed = seal(request, INPUTS['S01'], PINS, endpoint='decisions')
        with self.assertRaisesRegex(ValueError, 'template changed'): self.ledger.reserve(1, request, sealed)
        request, _ = self.stage(1)
        payload = json.loads(request['input']); payload['source']['records'][0]['text'] += ' injected'
        request['input'] = canonical(payload); sealed = seal(request, INPUTS['S01'], PINS, endpoint='decisions')
        with self.assertRaisesRegex(ValueError, 'context mismatch'): self.ledger.reserve(1, request, sealed)

    def test_both_verifier_stages_bind_exact_producer_proposal_sets(self):
        self.complete(0)
        for stage in (1, 2):
            request, _ = self.stage(stage)
            payload = json.loads(request['input']); payload['proposals'].append({'invented': True})
            request['input'] = canonical(payload)
            sealed = seal(request, INPUTS['S01'], PINS, endpoint='decisions', policy='strict-raw-v1' if stage == 1 else 'unique-exact-quote-v1')
            with self.assertRaisesRegex(ValueError, 'not bound'): self.ledger.reserve(stage, request, sealed)
            if stage == 1: self.complete(1)

    def test_actual_extraction_and_usage_metadata_are_retained_for_binding(self):
        self.complete(0)
        record = self.ledger.db.execute('SELECT output_proposals_hash,latency_ms,usage_json FROM offline_comparison_attempts WHERE stage=0').fetchone()
        self.assertIsNotNone(record[0]); self.assertEqual(record[1], 12.5)
        self.assertEqual(json.loads(record[2])['input_tokens'], 1)

    def test_sent_attempt_cannot_be_retried_even_after_reopening(self):
        request, sealed = self.stage(0); self.ledger.reserve(0, request, sealed); self.ledger.begin(0, request)
        self.ledger.close(); self.ledger = OfflineContinuation(self.path, SCOPE)
        with self.assertRaises(ValueError): self.ledger.begin(0, request)
        request, sealed = self.stage(1)
        with self.assertRaisesRegex(ValueError, 'unsettled'): self.ledger.reserve(1, request, sealed)
        self.assertEqual(self.ledger.snapshot()['exposure'], BASE_EXPOSURE + MAXIMA['responses'])

    def test_ambiguous_usage_retains_full_reservation_and_stops(self):
        request, sealed = self.stage(0); self.ledger.reserve(0, request, sealed); self.ledger.begin(0, request)
        with self.assertRaisesRegex(ValueError, 'ambiguous'): self.ledger.settle(0, {'model': 'gpt-6-luna'})
        self.assertEqual(self.ledger.snapshot()['exposure'], BASE_EXPOSURE + MAXIMA['responses'])
        self.assertEqual(self.ledger.snapshot()['rows'][0][4], 'uncertain')
        request, sealed = self.stage(1)
        with self.assertRaisesRegex(ValueError, 'stopped'): self.ledger.reserve(1, request, sealed)

    def test_usage_categories_totals_tier_and_bounds_are_priced_or_held(self):
        for edit in [lambda b:b.update(service_tier='fast'), lambda b:b['usage'].update(input_tokens=True),
                     lambda b:b['usage'].update(total_tokens=123), lambda b:b['usage'].update(input_tokens_details={'audio_tokens':1}),
                     lambda b:b['usage'].update(output_tokens=8193,total_tokens=8194)]:
            body = usage(); edit(body)
            with self.assertRaises(ValueError): usage_cost('responses', body)
        body = usage(100, 20); body['usage']['input_tokens_details'] = {'cached_tokens': 10, 'cache_write_tokens': 20}
        body['usage']['output_tokens_details'] = {'reasoning_tokens': 10}
        self.assertEqual(usage_cost('responses', body), 24750)

    def test_priced_truncation_stops_without_repeat(self):
        request, sealed = self.stage(0); self.ledger.reserve(0, request, sealed); self.ledger.begin(0, request)
        body = usage(); body['status'] = 'incomplete'
        with self.assertRaisesRegex(ValueError, 'incomplete'): self.ledger.settle(0, body)
        self.assertEqual(self.ledger.snapshot()['rows'][0][4], 'settled')
        self.assertIsNotNone(self.ledger.snapshot()['stopped'])

    def test_conservative_reservations_stop_well_before_spend_cap(self):
        self.complete(0, usage(1000, 8192))
        self.complete(1, usage(2000, endpoint='decisions'))
        self.complete(2, usage(2000, endpoint='decisions'))
        request, sealed = self.stage(3)
        with self.assertRaisesRegex(ValueError, 'budget_stop'): self.ledger.reserve(3, request, sealed)
        snapshot = self.ledger.snapshot()
        self.assertEqual(len(snapshot['rows']), 3)
        self.assertLess(snapshot['exposure'], 520000000)
        self.assertEqual(snapshot['stopped'], 'budget_stop_before_dispatch')

    def test_two_owners_cannot_reserve_the_same_next_call(self):
        barrier = threading.Barrier(2); outcomes = []
        def worker():
            ledger = OfflineContinuation(self.path, SCOPE)
            try:
                request, sealed = self.stage(0); barrier.wait(); ledger.reserve(0, request, sealed); outcomes.append('reserved')
            except ValueError: outcomes.append('refused')
            finally: ledger.close()
        threads = [threading.Thread(target=worker) for _ in range(2)]
        for t in threads:t.start()
        for t in threads:t.join(timeout=5)
        self.assertTrue(all(not t.is_alive() for t in threads))
        self.assertEqual(sorted(outcomes), ['refused', 'reserved'])
        self.assertEqual(len(self.ledger.snapshot()['rows']), 1)


if __name__ == '__main__': unittest.main()
