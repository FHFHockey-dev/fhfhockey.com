"""Prepare source-review artifacts and bridge plan. No execution or approval."""
import hashlib
import json
import sqlite3
import secrets
from pathlib import Path

from adjudication import HERE, OLD, blind_sheet, render_sheet
from bridge import BASE, LIVE, pilot, p


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(name, value):
    with (HERE / name).open('x', encoding='utf-8') as f:
        f.write(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def prepare():
    old_manifest = json.loads((OLD / 'manifest.json').read_text())
    root = BASE.parents[1]
    for name, h in old_manifest['files'].items(): assert sha(OLD / name) == h, name
    preserved = old_manifest['preserved_inputs']
    for name, h in preserved.items(): assert sha(root / name) == h, name
    scope = json.loads((OLD / 'prepared/scope.json').read_text())
    requests = json.loads((OLD / 'prepared/extraction-requests.json').read_text())
    rules = json.loads((OLD / 'artifacts/actual-rules.json').read_text())
    envelopes = scope['envelopes']
    body_arms = {'rules': rules, 'rules_decisions': rules, 'extraction': {}, 'extraction_decisions': {}}
    seed = secrets.randbits(128)  # private blinding shuffle, not a credential
    public, private = blind_sheet(envelopes, body_arms, {}, seed=seed)
    private['blinding_seed'] = seed
    write('SHEET.json', public); write('SHEET.md', render_sheet(public)); write('private-mapping.json', private)
    db = sqlite3.connect('file:' + str(LIVE.resolve()) + '?mode=ro', uri=True)
    try:
        rows = db.execute('SELECT * FROM attempts ORDER BY id').fetchall()
        baseline = {'ledger_sha256': sha(LIVE), 'attempt_ids': [r[0] for r in rows], 'attempt_rows_hash': p.digest(rows),
            'experiment_hash': p.digest(db.execute('SELECT * FROM experiment ORDER BY id').fetchall()),
            'reconciliations_hash': p.digest(db.execute('SELECT * FROM attempt_reconciliations ORDER BY id').fetchall()),
            'authorizations_hash': p.digest(db.execute('SELECT * FROM continuation_authorizations ORDER BY attempt_prefix').fetchall())}
        assert len(rows) == 5 and sum(r[7] if r[6] == 'settled' else max(r[5], r[7] or 0) for r in rows) == 254807878
    finally: db.close()
    assert baseline['ledger_sha256'] == '8b9574da4b587e756cb177360b97cb7af6d410e59686d0c5a2953d5bfa20db1a'
    runtime = {str((OLD / name).resolve()): h for name, h in old_manifest['files'].items()}
    runtime.update({str((root / name).resolve()): h for name, h in old_manifest['source_reference_pins'].items()})
    for file in [BASE / 'comparison-sequential-pilot-2026-10-19/pilot.py', Path(pilot.certifi.__file__), Path(pilot.certifi.core.__file__), Path(pilot.certifi.where())]:
        runtime[str(file.resolve())] = sha(file)
    for file in HERE.iterdir():
        if file.suffix in ('.py', '.md', '.json') and file.name != 'PLAN.json': runtime[str(file.resolve())] = sha(file)
    plan = {'version': 'canonical-multi-record-bridge-v1', 'status': 'prepared_no_paid_approval', 'maximum_calls': 30,
            'cap_nano_usd': 520000000, 'baseline_exposure_nano_usd': 254807878, 'unknown_reservation_nano_usd': 254394800,
            'baseline': baseline, 'runtime_pins': runtime, 'scope': scope, 'extraction_requests': requests, 'rules_outputs': rules,
            'old_candidate_manifest_sha256': sha(OLD / 'manifest.json'), 'source_sheet_sha256': sha(HERE / 'SHEET.md'),
            'semantic_quality_winner_permitted': False, 'ordinary_bounds_unchanged': True,
            'requests_executed': 0, 'clearance': None}
    write('PLAN.json', plan)
    write('preserved-inputs.json', {str((root / name).resolve()): h for name, h in preserved.items()})
    print(json.dumps({'status': plan['status'], 'groups': 10, 'neutral_proposals': sum(len(g['proposals']) for g in public['groups']),
                      'plan_sha256': sha(HERE / 'PLAN.json'), 'paid_calls': 0}, indent=2))


if __name__ == '__main__': prepare()
