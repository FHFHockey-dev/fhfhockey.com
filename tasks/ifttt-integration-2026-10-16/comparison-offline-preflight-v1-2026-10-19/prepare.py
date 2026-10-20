"""Seal ten source-only requests, accounting scope and provenance; no dispatch."""
import hashlib
import json
import sqlite3
from pathlib import Path

from preflight import BASE, ROOT, HERE, canonical, digest, producer_input, extraction_request, seal, decisions_request, normalize_family, proposal_hash


def write(path, value):
    with path.open('x', encoding='utf-8') as f:
        f.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def prepare():
    benchmark = BASE / 'human-adjudicated-benchmark-v1-2026-10-19'
    packet = BASE / 'human-grading-packet-2026-10-19'
    fixture = ROOT / 'web/lib/sources/fixtures/october11TroublesomeTweets.json'
    old = BASE / 'comparison-preflight-2026-10-19'
    groups = json.loads((benchmark / 'evaluation-inputs.json').read_text())
    prior = {r['tweetId']: r for r in json.loads(fixture.read_text())['records']}
    prompt = (old / 'extraction-prompt.txt').read_text()
    schema = json.loads((old / 'claim-schema.json').read_text())
    inputs = {g['sample_id']: producer_input(g, prior) for g in groups}
    reference_paths = [old / 'rules-adapter.ts', old / 'extraction-prompt.txt', old / 'claim-schema.json',
        ROOT / 'web/lib/sources/tweetPlayerEvents.ts', ROOT / 'web/lib/sources/tweetInterpretation.ts',
        ROOT / 'web/lib/sources/playerIdentity.ts', ROOT / 'web/lib/supabase/pagination.ts', fixture,
        BASE / 'comparison-preflight-2026-10-19/comparison.py',
        BASE / 'comparison-source-anchoring-2026-10-19/anchors.py']
    # The actual baseline's imported source closure is hash-pinned, not copied
    # over or altered. These pure imports never fetch a live roster.
    pins = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in reference_paths}
    for p in HERE.iterdir():
        if p.suffix in ('.py', '.ts', '.mjs'):
            pins[str(p.relative_to(ROOT))] = hashlib.sha256(p.read_bytes()).hexdigest()
    requests = {key: extraction_request(envelope, prompt, schema) for key, envelope in inputs.items()}
    seals = {key: seal(requests[key], envelope, pins, endpoint='responses') for key, envelope in inputs.items()}
    ledger = BASE / 'comparison-retry-execution-2026-10-19/aggregate-budget.sqlite'
    ledger_hash = hashlib.sha256(ledger.read_bytes()).hexdigest()
    require_hash = '8b9574da4b587e756cb177360b97cb7af6d410e59686d0c5a2953d5bfa20db1a'
    assert ledger_hash == require_hash
    db = sqlite3.connect('file:' + str(ledger.resolve()) + '?mode=ro', uri=True)
    rows = db.execute('SELECT id,endpoint,reserve,state,actual FROM attempts ORDER BY rowid').fetchall()
    full = db.execute('SELECT * FROM attempts ORDER BY rowid').fetchall()
    db.close()
    sample = next(iter(inputs.values()))
    empty = {'claims': [], 'revisions': [], 'errors': []}
    nonempty = dict(empty, revisions=[{'fixture': 'template cardinality only; never a dispatched input'}])
    questions = [decisions_request(sample, x)['questions'] for x in (empty, nonempty)]
    rules_path = HERE / 'artifacts/actual-rules.json'
    rules_outputs = json.loads(rules_path.read_text()) if rules_path.exists() else None
    rules_hashes = {}
    for key, envelope in inputs.items():
        output = normalize_family(envelope, rules_outputs[key]) if rules_outputs else None
        assert output is None or not output['errors'], (key, output['errors'])
        rules_hashes[key] = proposal_hash(output) if output is not None else None
    scope = {'mode': 'offline_fixture_only', 'maximum_requests': 30, 'groups': list(inputs),
             'input_hashes': {key: digest(e) for key, e in inputs.items()},
             'envelopes': inputs, 'producer_pins_hash': digest(pins),
             'extraction_request_hashes': {key: digest(r) for key, r in requests.items()},
             'decision_question_hashes': [digest(q) for q in questions],
             'rules_proposal_hashes': rules_hashes,
             'rules_artifact_sha256': hashlib.sha256(rules_path.read_bytes()).hexdigest() if rules_path.exists() else None,
             'original_rows_hash': digest(rows), 'original_full_rows_hash': digest(full),
             'canonical_live_ledger_hash': ledger_hash, 'paid_execution_authorized': False}
    (HERE / 'prepared').mkdir(exist_ok=False)
    for name, obj in [('inputs.json', inputs), ('extraction-requests.json', requests), ('request-seals.json', seals), ('scope.json', scope), ('producer-pins.json', pins)]:
        write(HERE / 'prepared' / name, obj)
    prior_files = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in benchmark.iterdir() if p.is_file()}
    prior_files.update({str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in packet.rglob('*') if p.is_file()})
    write(HERE / 'prepared/preserved-inputs.json', dict(prior_files, **{str(ledger.relative_to(ROOT)): ledger_hash}))
    assert hashlib.sha256(ledger.read_bytes()).hexdigest() == ledger_hash
    print(json.dumps({'sealed_groups': len(inputs), 'source_records': sum(len(e['records']) for e in inputs.values()),
                      'requests': len(requests), 'paid_calls': 0, 'scope_hash': digest(scope)}, indent=2))


if __name__ == '__main__':
    prepare()
