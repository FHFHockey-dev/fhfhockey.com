"""Post-run archive, reconciliation and blinded sheet. No dispatch or key load."""
import copy
import hashlib
import json
import secrets
import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CANDIDATE = HERE.parent / 'comparison-adjudication-bridge-v1-2026-10-19'
sys.path.insert(0, str(CANDIDATE))
import bridge
import adjudication


def write(name, value):
    with (HERE / name).open('x', encoding='utf-8') as f:
        f.write(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    plan = bridge.load_plan()
    result = json.loads((HERE / 'run-01/result.json').read_text())
    records = result['records']
    raw = {}; aligned = {}; reviews = {}; audit = {}; call_rows = []
    for record in records:
        stage = record['stage']; group_id = plan['scope']['groups'][stage // 3]
        body = record['response']; charge = bridge.usage_cost(record['endpoint'], body)
        assert charge == record['conservativeChargeCeilingNanoUsd']
        call_rows.append({'stage': stage, 'group': group_id, 'endpoint': record['endpoint'],
            'request_sha256': record['requestHash'], 'provider_metadata': record['audit']['providerMetadata'],
            'usage': body['usage'], 'latency_ms': record['latencyMs'], 'charge_ceiling_nano_usd': charge})
        if record['endpoint'] == 'responses':
            producer = bridge.p.parse_extraction(body)
            raw[group_id] = producer
            corrected = copy.deepcopy(producer); envelope = plan['scope']['envelopes'][group_id]
            for doc in corrected['records']:
                source_record = next(r for r in envelope['records'] if r['record_id'] == doc['record_id'])
                fixed = bridge.p.align_proposals(bridge.p.source(source_record), {k: doc[k] for k in ('material', 'claims', 'overflow')})
                doc.update(fixed['body'])
            aligned[group_id] = corrected
            raw_norm = bridge.p.normalize_family(envelope, producer)
            fixed_norm = bridge.p.normalize_family(envelope, producer, aligned=True)
            audit[group_id] = {'raw_errors': raw_norm['errors'], 'aligned_errors': fixed_norm['errors'],
                               'alignment_audit': fixed_norm['alignment_audit'], 'dispatchable_after_alignment': not fixed_norm['errors']}
        else:
            arm = 'rules_decisions' if stage % 3 == 1 else 'extraction_decisions'
            reviews[(group_id, arm)] = record['verifierReview']
    write('raw-producers.json', raw); write('aligned-producers.json', aligned); write('alignment-audit.json', audit)
    write('authentic-call-usage.json', call_rows)
    before = sqlite3.connect('file:' + str((HERE / 'baseline-budget.sqlite').resolve()) + '?mode=ro', uri=True)
    after = sqlite3.connect('file:' + str(bridge.LIVE.resolve()) + '?mode=ro', uri=True)
    try:
        originals = before.execute('SELECT * FROM attempts ORDER BY id').fetchall()
        ids = [r[0] for r in originals]; slots = ','.join('?' for _ in ids)
        assert after.execute('SELECT * FROM attempts WHERE id IN (' + slots + ') ORDER BY id', ids).fetchall() == originals
        for table in ('experiment', 'attempt_reconciliations'):
            assert before.execute('SELECT * FROM ' + table + ' ORDER BY id').fetchall() == after.execute('SELECT * FROM ' + table + ' ORDER BY id').fetchall()
        assert before.execute('SELECT * FROM continuation_authorizations ORDER BY attempt_prefix').fetchall() == after.execute('SELECT * FROM continuation_authorizations WHERE attempt_prefix<>? ORDER BY attempt_prefix', (bridge.PREFIX,)).fetchall()
        new = after.execute('SELECT id,endpoint,state,reserve,actual,error FROM attempts WHERE id LIKE ? ORDER BY id', (bridge.PREFIX + '%',)).fetchall()
        assert len(new) == len(records) == 13 and all(r[2] == 'settled' for r in new)
        assert new[-1][-1] == 'stop_malformed_or_incomplete_output'
        new_charge = sum(r[4] for r in new)
        assert new_charge == sum(r['charge_ceiling_nano_usd'] for r in call_rows)
        exposure = after.execute("SELECT SUM(CASE WHEN state='settled' THEN actual ELSE MAX(reserve,COALESCE(actual,0)) END) FROM attempts").fetchone()[0]
        original_unknown = after.execute("SELECT reserve,state,actual FROM attempts WHERE id='lindgren-0'").fetchone()
        assert original_unknown == (254394800, 'uncertain', None)
        assert exposure == 254807878 + new_charge == 257904324
        running = 254807878; peak = running
        for row in new:
            peak = max(peak, running + row[3]); running += row[4]
        assert peak <= 520000000
    finally:
        before.close(); after.close()
    write('aggregate-budget-after.sqlite.sha256', sha(bridge.LIVE) + '\n')
    # Immutable evidence copy only; not an alternative spend allowance.
    with (HERE / 'aggregate-budget-after.sqlite').open('xb') as f: f.write(bridge.LIVE.read_bytes())
    reconciliation = {'status': result['status'], 'new_calls': 13, 'responses': 5, 'decisions': 8,
        'all_new_attempts_settled': True, 'new_uncertain_reservations': 0,
        'new_usage_charge_ceiling_nano_usd': new_charge,
        'original_unknown_nano_usd': 254394800, 'known_successful_charge_ceilings_total_nano_usd': 413078 + new_charge,
        'aggregate_exposure_nano_usd': exposure, 'peak_reserved_exposure_nano_usd': peak,
        'cap_nano_usd': 520000000, 'headroom_nano_usd': 520000000 - exposure,
        'prior_attempts_reconciliations_cap_block_and_authorizations_unchanged': True,
        'complete_paired_groups': ['S01', 'S02', 'S03', 'S04'], 'partial_group': 'S05',
        'unattempted_groups': ['S06', 'S07', 'S08', 'S09', 'S10'],
        'stop_reason': 'S05 completed Response has wrong original spans; two invalid lower-body excerpts repeat within S05A and cannot be uniquely reanchored. Four other claims reanchor; frozen whole-family validity still fails. No source interpretation or anchor policy changed.',
        'new_pass_authorization_consumed': True, 'automatic_retry_or_resume': False,
        'original_five_attempt_rows_preserved': True, 'ledger_sha256': sha(bridge.LIVE),
        'cost_kind': 'Conservative usage-priced ceiling, not final invoice; aggregate actual bill remains unknown because the original attempt remains reserved.'}
    write('ledger-reconciliation.json', reconciliation)
    gold = json.loads((HERE.parent / 'human-adjudicated-benchmark-v1-2026-10-19/benchmark.json').read_text())
    review_pairs = {(g, 'rules' if arm == 'rules_decisions' else 'extraction'): value for (g, arm), value in reviews.items()}
    lexical = bridge.p.evaluate(gold, plan['scope']['envelopes'], plan['rules_outputs'], raw, review_pairs)
    write('lexical-diagnostics.json', {'meaning': 'lexical_contract_diagnostic_only', 'automatic_factual_winner': None,
        'factual_quality_established': False, 'source_adjudication_required': True, 'legacy_diagnostic': lexical,
        'coverage': {'groups_denominator': 10, 'source_unit_denominator': 50, 'paired_groups': 4,
                     'extractions_received': 5, 'one_invalid_family_retained': 'S05', 'verifier_pairs_received': 4},
        'no_missing_output_is_a_measured_negative': True})
    bodies = {'rules': plan['rules_outputs'], 'rules_decisions': plan['rules_outputs'],
              'extraction': raw, 'extraction_decisions': raw}
    seed = secrets.randbits(128)
    public, private = adjudication.blind_sheet(plan['scope']['envelopes'], bodies, reviews, seed=seed)
    private['blinding_seed'] = seed
    private['partial_run_coverage'] = reconciliation
    write('BLINDED-SHEET.json', public); write('BLINDED-SHEET.md', adjudication.render_sheet(public))
    write('private-mapping.json', private)
    write('verifier-results-private.json', {group: {arm: adjudication.verifier_columns(reviews.get((group, arm))) for arm in ('rules_decisions', 'extraction_decisions')} for group in plan['scope']['groups']})
    first = copy.deepcopy(public); first['groups'] = public['groups'][:1]
    write('FIRST-BLINDED-BATCH.json', first); write('FIRST-BLINDED-BATCH.md', adjudication.render_sheet(first))
    bridge.check_pins(plan)
    manifest = json.loads((CANDIDATE / 'manifest.json').read_text())
    for name, h in manifest['files'].items(): assert sha(CANDIDATE / name) == h
    for name, h in manifest['preserved_inputs'].items():
        if Path(name).resolve() != bridge.LIVE.resolve(): assert sha(Path(name)) == h
    print(json.dumps({'calls': 13, 'new_charge_ceiling_usd': new_charge / 1e9,
                      'exposure_usd': exposure / 1e9, 'peak_reserved_exposure_usd': peak / 1e9,
                      'neutral_proposals': sum(len(g['proposals']) for g in public['groups']),
                      'first_batch_neutral_proposals': len(public['groups'][0]['proposals']), 'candidate_and_prior_static_pins_unchanged': True}, indent=2))


if __name__ == '__main__': main()
