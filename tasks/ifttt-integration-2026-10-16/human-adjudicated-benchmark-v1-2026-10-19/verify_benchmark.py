"""Offline artifact, source and adjudication-boundary validation; no writes."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def validate(benchmark, inputs):
    assert benchmark['split'] == 'previously_exposed_historical_development'
    assert benchmark['untouched_holdout'] is False
    assert benchmark['calibrated_starter_probability'] is None
    assert len(benchmark['groups']) == len(inputs) == 10
    records = {r['record_id']: r for group in inputs for r in group['records']}
    assert len(records) == 12
    assert all('Lindgren' not in r['text'] and r['original_id'] != '2108233461026726263' for r in records.values())
    assert all(set(g) == {'sample_id', 'records', 'retained_relations', 'verified_external_context'} for g in inputs)
    assert all(not g['verified_external_context'] for g in inputs)
    groups = {g['sample_id']: g for g in benchmark['groups']}
    claims = [c for g in groups.values() for c in g['observed_source_claims']]
    assert len(claims) == len({c['id'] for c in claims}) == 50
    assert benchmark['source_claim_unit_count'] == 50
    assert benchmark['claim_counts'] == {k: len(g['observed_source_claims']) for k, g in groups.items()}
    for group in groups.values():
        assert group['independent_world_truth'] is None
        assert group['owner_publication_readiness'] is None
        assert group['production_publishable'] is None
        assert group['context_binding_prerequisites']
    for row in claims:
        for field in ('canonical_player_id', 'canonical_team_id', 'canonical_game_id', 'canonical_season_id'):
            assert row[field] is None
        e = row['evidence']
        text = records[e['record_id']]['text']
        span = text.encode('utf-16-le')[2 * e['utf16_start']:2 * e['utf16_end']].decode('utf-16-le')
        assert span == e['quote'] and text.count(e['quote']) == 1
    for record in records.values():
        assert sha(record['text'].encode()) == record['text_sha256']
    sanderson = [c for c in groups['S02']['observed_source_claims'] if c['subject_literal'] == 'Sanderson']
    assert len(sanderson) == 3
    assert any(c['time_literal'] == 'this weekend' and c['modality'] == 'tentative' for c in sanderson)
    assert all('1–2' not in str(c) and '1-2' not in str(c) for c in sanderson)
    inference = groups['S02']['analyst_inferences'][0]
    assert inference['explicit_source_fact'] is False and inference['expected_source_extraction'] is False
    assert groups['S05']['observed_source_claims'][0]['time_literal'] == '4 weeks from today'
    assert groups['S05']['observed_source_claims'][2]['time_literal'] == 'rest of the season'
    assert 'lower body injury' in groups['S05']['observed_source_claims'][2]['qualifiers']
    s08 = groups['S08']['hockey_parsing_conventions'][1]['confirmation_rule']
    assert s08['timing_alone_sufficient'] is False and s08['category_from_current_input'] == 'projected'
    s09 = groups['S09']['hockey_parsing_conventions'][0]['semantic_projection']
    assert s09['category'] == 'projected_starter' and s09['confirmed'] is False and s09['game_binding_verified'] is False
    assert groups['S09']['observed_source_claims'][0]['team_literal'] is None
    s10 = groups['S10']['hockey_parsing_conventions'][0]['final_state']
    assert s10 == {'regular_pp_update': False, 'retain_both_sources': True, 'retract_or_supersede_A_regular_PP_proposal': True}
    assert groups['S10']['source_records'] == ['S10A', 'S10B']
    return {'groups': 10, 'source_records': 12, 'source_units': 50, 'boundary_checks': 'passed'}


def verify_files():
    manifest = json.loads((HERE / 'manifest.json').read_text())
    for name, digest in manifest['files'].items():
        assert sha((HERE / name).read_bytes()) == digest, name
    for name, digest in manifest['preserved_prior_files'].items():
        assert sha((ROOT / name).read_bytes()) == digest, name
    for name, digest in manifest['producer_reference_pins'].items():
        assert sha((ROOT / name).read_bytes()) == digest, name
    budget = ROOT / 'tasks/ifttt-integration-2026-10-16/comparison-retry-execution-2026-10-19/aggregate-budget.sqlite'
    assert sha(budget.read_bytes()) == manifest['budget_ledger_sha256']
    benchmark = json.loads((HERE / 'benchmark.json').read_text())
    inputs = json.loads((HERE / 'evaluation-inputs.json').read_text())
    result = validate(benchmark, inputs)
    packet = ROOT / 'tasks/ifttt-integration-2026-10-16/human-grading-packet-2026-10-19/retained-source-records.json'
    originals = {r['sample_record_id']: r for group in json.loads(packet.read_text()) for r in group['records']}
    for group in inputs:
        for r in group['records']:
            original = originals[r['record_id']]
            assert r['text'] == original['text']
            assert r['url'] == original['url'] and r['author'] == original['author']
            assert r['published_at'] == original['publication'] and r['received_at'] == original['receipt']
    plan = json.loads((HERE / 'run-plan.json').read_text())
    assert plan['status'] == 'proposal_only_not_executable_or_authorized'
    assert plan['maximum_new_calls'] == {'responses': 10, 'decisions': 20, 'total_paid_provider_requests': 30, 'automatic_retries': 0, 'token_count_probes': 0, 'extra_judge_or_tuning_calls': 0}
    b = plan['budget']
    assert b['aggregate_cap_nano_usd'] == 520000000
    assert b['baseline_exposure_nano_usd'] == 254807878
    assert b['original_unknown_reservation_nano_usd'] == 254394800
    assert b['available_nano_usd'] == 265192122
    assert b['first_responses_peak_nano_usd'] == b['baseline_exposure_nano_usd'] + b['full_context_responses_reservation_nano_usd'] < b['aggregate_cap_nano_usd']
    assert b['all_independent_maxima_nano_usd'] == 7223084000 > b['available_nano_usd']
    assert b['remaining_charge_margin_before_full_context_responses_refuses_nano_usd'] == 4883722
    assert b['remaining_charge_margin_before_decisions_refuses_nano_usd'] == 34192122
    assert b['full_pass_guaranteed'] is False
    assert b['estimate_scenarios'][1]['estimated_nano_usd'] == 22550000
    assert manifest['provider_requests'] == manifest['new_provider_spend_nano_usd'] == 0
    return dict(result, status='passed', benchmark_sha256=manifest['benchmark_sha256'],
                preserved_prior_files=len(manifest['preserved_prior_files']),
                source_and_ledger_hashes_unchanged=True, comparison_executed=False)


if __name__ == '__main__':
    print(json.dumps(verify_files(), indent=2))
