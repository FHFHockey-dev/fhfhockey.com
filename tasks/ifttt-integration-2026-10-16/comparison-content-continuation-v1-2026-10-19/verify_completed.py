"""Read-only final checks; no provider call, credential read or budget mutation."""
import copy
import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from adapter import HERE, BASE, bridge, p


def load(path):
    return json.loads(Path(path).read_text())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def sealed_manifest(path):
    manifest = load(path)
    for name, expected in manifest['files'].items():
        assert sha(path.parent / name) == expected, str(path.parent / name)
    return {'path': str(path), 'sha256': sha(path), 'verified_files': len(manifest['files'])}


def without_numeric_evidence_offsets(body):
    result = copy.deepcopy(body)
    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key == 'evidence' and isinstance(item, dict):
                    item.pop('start', None)
                    item.pop('end', None)
                walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
    walk(result)
    return result


def main():
    plan = load(HERE / 'PLAN.json')
    for path, expected in plan['runtime_pins'].items():
        assert sha(path) == expected, path
    bridge.check_pins(bridge.load_plan())
    protected = [sealed_manifest(BASE / name / 'manifest.json') for name in [
        'comparison-approved-execution-2026-10-19',
        'human-adjudicated-benchmark-v1-2026-10-19',
        'comparison-adjudication-bridge-v1-2026-10-19',
        'comparison-approved-execution-2026-10-19/human-adjudications/0001-S01-P003-classification',
    ]]
    raw = load(HERE / 'all-raw-producers.json')
    selected = load(HERE / 'selected-aligned-producers.json')
    assert set(raw) == set(selected) == set(plan['envelopes'])
    normalized = {}
    for group in raw:
        assert without_numeric_evidence_offsets(raw[group]) == without_numeric_evidence_offsets(selected[group]), group
        normalized[group] = p.normalize_family(plan['envelopes'][group], selected[group])
        assert not normalized[group]['errors'], group
    assert sum(len(item['claims']) for item in normalized.values()) == 51
    assert sum(len(item['revisions']) for item in normalized.values()) == 1
    assert sum(len(envelope['records']) for envelope in plan['envelopes'].values()) == 12
    costs = load(HERE / 'cost-and-ledger-reconciliation.json')
    assert sha(bridge.LIVE) == costs['live_ledger_sha256'] == sha(HERE / 'final-budget-evidence.sqlite')
    live = sqlite3.connect('file:' + str(bridge.LIVE.resolve()) + '?mode=ro', uri=True)
    before = sqlite3.connect('file:' + str((HERE / 'baseline-budget.sqlite').resolve()) + '?mode=ro', uri=True)
    try:
        old = before.execute('select * from attempts order by id').fetchall()
        assert len(old) == 18
        ids = [row[0] for row in old]
        marks = ','.join('?' for _ in ids)
        assert live.execute('select * from attempts where id in (' + marks + ') order by id', ids).fetchall() == old
        for table in ['experiment', 'attempt_reconciliations']:
            assert live.execute('select * from ' + table + ' order by id').fetchall() == before.execute('select * from ' + table + ' order by id').fetchall()
        assert live.execute('select state,count(*) from attempts group by state order by state').fetchall() == [('settled', 35), ('uncertain', 1)]
        assert live.execute("select id,reserve,actual from attempts where state='uncertain'").fetchall() == [('lindgren-0', 254394800, None)]
        assert live.execute('select sum(actual) from attempts').fetchone()[0] == 7782393
        assert 7782393 + 254394800 == costs['aggregate_exposure_nano_usd'] == 262177193
        assert costs['peak_reserved_exposure_nano_usd'] <= costs['cap_nano_usd'] == 520000000
    finally:
        live.close()
        before.close()
    calls = load(HERE / 'all-authentic-call-usage.json')
    assert len(calls) == 31
    assert sum(row['endpoint'] == 'responses' for row in calls) == 10
    assert sum(row['charge_ceiling_nano_usd'] for row in calls) == costs['sample_total_nano_usd'] == 7369315
    coverage = load(HERE / 'coverage.json')
    for path in ['rules', 'rules_decisions', 'extraction', 'extraction_decisions']:
        assert coverage[path]['outputs'] == 10 and coverage[path]['missing'] == 0
    verifier = load(HERE / 'verifier-results-private.json')
    assert sum(item['extraction_decisions']['threshold_supported'] for item in verifier.values()) == 4
    assert sum(item['rules_decisions']['question_name'] == 'post_material_news' for item in verifier.values()) == 6
    queue = load(HERE / 'FOCUSED-HUMAN-QUEUE.json')['items']
    assert [item['proposal']['proposal_id'] for item in queue] == ['S01-P004', 'S08-P056', 'S09-P001']
    assert all(item['owner_verdict'] is None for item in queue)
    for name in ['RESULT.md', 'ASSISTANT-ANALYSIS.md', 'FOCUSED-HUMAN-QUEUE.md']:
        for target in re.findall(r'\]\(([^)]+)\)', (HERE / name).read_text()):
            assert (HERE / target).is_file(), target
    result = {
        'status': 'passed_offline_finalization_checks',
        'checked_at_utc': datetime.now(timezone.utc).isoformat(),
        'protected_manifests': protected,
        'runtime_pins_verified': len(plan['runtime_pins']),
        'semantic_fields_and_source_quotations_preserved': True,
        'selected_structurally_valid_claims': 51,
        'selected_structurally_valid_revisions': 1,
        'all_four_paths_complete_groups': 10,
        'missing_group_outputs': 0,
        'sample_calls': 31,
        'sample_cost_ceiling_nano_usd': 7369315,
        'aggregate_exposure_nano_usd': 262177193,
        'original_18_attempts_and_reconciliations_unchanged': True,
        'original_unknown_preserved': True,
        'new_uncertain_attempts': 0,
        'canonical_ledger_sha256': sha(bridge.LIVE),
        'human_encoding_queue_size': 3,
        'automatic_factual_winner': None,
        'provider_or_credential_calls_performed': 0,
        'production_actions_performed': 0,
    }
    with (HERE / 'verification.json').open('x') as output:
        output.write(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
