"""Freeze the continuation's missing-output schedule without dispatch."""
import copy
import hashlib
import json
import sqlite3
from pathlib import Path
from adapter import HERE, BASE, bridge, p, response_view


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    old = BASE / 'comparison-approved-execution-2026-10-19'
    assert sha(old / 'manifest.json') == '3004387e6f28fc4dd517ad400cf5589522176aef25895eccbee4f757d5948b66'
    m = json.loads((old / 'manifest.json').read_text())
    for name, h in m['files'].items(): assert sha(old / name) == h, name
    original_plan = bridge.load_plan(); bridge.check_pins(original_plan)
    assert sha(bridge.LIVE) == '19c48ae3244bf65ec1d293ca95a1f66f3f1e6b2f03c2d530d3e44d2b99caea52'
    record = json.loads((old / 'run-01/stage-12.json').read_text())
    assert record['request'] == original_plan['extraction_requests']['S05']
    assert record['requestHash'] == hashlib.sha256(p.canonical(record['request']).encode()).hexdigest()
    view = response_view(original_plan['scope']['envelopes']['S05'], record['response'])
    assert not view['content_held'] and len(view['verifier_set']['claims']) == 6
    assert sum(a['reason'] == 'exact_subject_adjacent_parenthetical' for a in view['anchor_audit']) == 2
    with (HERE / 'S05-offline-diagnosis.json').open('x') as f: json.dump(view, f, ensure_ascii=False, indent=2)
    requests = {}; schedule = [
        {'group': 'S05', 'kind': 'rules_decisions', 'reserve_nano_usd': 231000000},
        {'group': 'S05', 'kind': 'extraction_decisions', 'reserve_nano_usd': 231000000}]
    caps = {'S08': 8192, 'S06': 4096, 'S07': 4096, 'S09': 2048, 'S10': 4096}
    for group, cap in caps.items():
        request = copy.deepcopy(original_plan['extraction_requests'][group]); request['max_output_tokens'] = cap
        assert {k: v for k, v in request.items() if k != 'max_output_tokens'} == {k: v for k, v in original_plan['extraction_requests'][group].items() if k != 'max_output_tokens'}
        requests[group] = request; stage = len(schedule)
        schedule += [{'group': group, 'kind': 'extraction', 'output_cap': cap, 'reserve_nano_usd': bridge.pilot.price('responses', 922000, cap)},
                     {'group': group, 'kind': 'rules_decisions', 'reserve_nano_usd': 231000000},
                     {'group': group, 'kind': 'extraction_decisions', 'producer_stage': stage, 'reserve_nano_usd': 231000000}]
    db = sqlite3.connect('file:' + str(bridge.LIVE.resolve()) + '?mode=ro', uri=True)
    try:
        rows = db.execute('SELECT * FROM attempts ORDER BY id').fetchall()
        baseline = {'ledger_sha256': sha(bridge.LIVE), 'attempt_ids': [r[0] for r in rows], 'attempt_rows_hash': p.digest(rows),
            'experiment_hash': p.digest(db.execute('SELECT * FROM experiment ORDER BY id').fetchall()),
            'reconciliations_hash': p.digest(db.execute('SELECT * FROM attempt_reconciliations ORDER BY id').fetchall()),
            'authorizations_hash': p.digest(db.execute('SELECT * FROM continuation_authorizations ORDER BY attempt_prefix').fetchall())}
        assert len(rows) == 18 and sum(r[7] if r[6] == 'settled' else max(r[5], r[7] or 0) for r in rows) == 257904324
    finally: db.close()
    pins = dict(original_plan['runtime_pins'])
    pins[str((old / 'manifest.json').resolve())] = sha(old / 'manifest.json')
    for name, h in m['files'].items(): pins[str((old / name).resolve())] = h
    for file in (old / 'human-adjudications').rglob('*'):
        if file.is_file(): pins[str(file.resolve())] = sha(file)
    for file in HERE.iterdir():
        if file.suffix in ('.py', '.md', '.json') and file.name != 'PLAN.json': pins[str(file.resolve())] = sha(file)
    plan = {'version': 'missing-output-content-continuation-v1', 'status': 'prepared_not_dispatched',
        'baseline': baseline, 'runtime_pins': pins, 'envelopes': original_plan['scope']['envelopes'],
        'rules_outputs': original_plan['rules_outputs'], 'saved_S05_response': record['response'],
        'saved_S05_record_sha256': sha(old / 'run-01/stage-12.json'), 'extraction_requests': requests,
        'schedule': schedule, 'maximum_calls': 17, 'automatic_retries': 0,
        'original_unknown_nano_usd': 254394800, 'baseline_exposure_nano_usd': 257904324, 'cap_nano_usd': 520000000,
        'original_pass_not_rewritten': True, 'second_diagnostic_pass_enabled': False}
    assert len(schedule) == 17
    with (HERE / 'PLAN.json').open('x') as f: json.dump(plan, f, ensure_ascii=False, indent=2); f.write('\n')
    print(json.dumps({'S05_claims_valid_in_revised_view': 6, 'subject_bound_parentheticals': 2,
        'calls_planned': len(schedule), 'request_reserves': {k: bridge.pilot.price('responses', 922000, cap) for k, cap in caps.items()},
        'provider_calls': 0, 'plan_sha256': sha(HERE / 'PLAN.json')}, indent=2))


if __name__ == '__main__': main()
