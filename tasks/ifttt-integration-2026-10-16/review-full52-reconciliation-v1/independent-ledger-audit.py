import hashlib, json
from pathlib import Path

own = Path(__file__).resolve().parent
task = own.parent
owner = task / 'full-acceptance-reconciliation'
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
key = lambda v: json.dumps(v, sort_keys=True, ensure_ascii=False, separators=(',', ':'))

spec_path = task / 'handoff/extracted-reviewed/ifttt-claim-replay-tests-2026-10-15/acceptance-cases.json'
spec = read(spec_path)
assert sha(spec_path) == 'd9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b'
assert len(spec['cases']) == spec['caseCount'] == 52
assert len({c['id'] for c in spec['cases']}) == 52
ledger = read(owner / 'outputs/full52-reconciliation.json')
rows = {c['id']: c for c in ledger['rows']}
assert set(rows) == {c['id'] for c in spec['cases']}

fresh_normal = read(own / 'outputs/acceptance-identity-candidate-results.json')
fresh_mutation = read(own / 'outputs/acceptance-identity-negative-control-results.json')
for filename, fresh in [('acceptance-identity-candidate-results.json', fresh_normal), ('acceptance-identity-negative-control-results.json', fresh_mutation)]:
    assert fresh['results'] == read(owner / 'outputs' / filename)['results']
    assert fresh['results'] == read(task / 'review-durable-occurrence-v3' / filename)['results']
normal = {r['id']: r for r in fresh_normal['results']}
mutant = {r['id']: r for r in fresh_mutation['results']}
assert normal['CR019']['assertions'][2]['actual'] == 0
assert mutant['CR019']['assertions'][2]['actual'] == 1
assert mutant['CR019']['assertions'][2]['pass'] is False

persistence = {}
for filename, ids in [
    ('review-durable-occurrence-v3/exact-persistence-results.json', ['CR036', 'CR039', 'CR040', 'CR052']),
    ('review-parent-recovery-v1/exact-parent-persistence-results.json', ['CR037', 'CR041']),
    ('review-consumer-binding-v2/correction-v2/consumer-binding-results.json', ['CR042', 'CR043', 'CR044']),
]:
    evidence = read(task / filename)
    assert evidence['originalOracleSha256'] == sha(spec_path)
    results = {c['id']: c for c in evidence['results']}
    assert len(results) == len(evidence['results'])
    for case_id in ids:
        persistence[case_id] = (filename, results[case_id])

def passes(assertion, actual):
    if assertion['op'] == 'equals':
        return key(actual) == key(assertion['value'])
    assert assertion['op'] in ['same', 'pairwise_distinct']
    if not isinstance(actual, list) or len(actual) != len(assertion['records']) or any(v is None for v in actual):
        return False
    count = len(set(map(key, actual)))
    return count == 1 if assertion['op'] == 'same' else count == len(actual)

counts = {'cases': 52, 'assertions': 0, 'matchingAssertions': 0, 'fullyMatchingCases': 0,
          'pureCases': 0, 'pureAssertions': 0, 'pureMatchingAssertions': 0,
          'persistenceCases': 0, 'persistenceAssertions': 0, 'persistenceMatchingAssertions': 0}
failures, per_case = [], []
for case in spec['cases']:
    case_id = case['id']
    persistent = case['layer'] == 'future_persistence_gate'
    if persistent:
        source, result = persistence[case_id]
        assert normal[case_id]['status'] == 'deferred_persistence'
        assert normal[case_id]['assertions'] == []
    else:
        source, result = 'full-acceptance-reconciliation/outputs/acceptance-identity-candidate-results.json', normal[case_id]
    assert rows[case_id]['source'] == source
    assert rows[case_id]['sourceSha256'] == sha(task / source)
    assert len(result['assertions']) == len(rows[case_id]['assertions']) == len(case['assertions'])
    successes = 0
    for index, original_assertion in enumerate(case['assertions']):
        observed, published = result['assertions'][index], rows[case_id]['assertions'][index]
        assert observed['assertion'] == published['assertion'] == original_assertion
        assert key(observed['actual']) == key(published['actual'])
        passed = passes(original_assertion, observed['actual'])
        assert observed['pass'] is passed and published['pass'] is passed
        successes += passed
        if not passed:
            failures.append({'case': case_id, 'assertionIndex': index, 'originalAssertion': original_assertion, 'actual': observed['actual']})
    n = len(case['assertions'])
    prefix = 'persistence' if persistent else 'pure'
    counts[prefix + 'Cases'] += 1
    counts[prefix + 'Assertions'] += n
    counts[prefix + 'MatchingAssertions'] += successes
    counts['assertions'] += n
    counts['matchingAssertions'] += successes
    counts['fullyMatchingCases'] += successes == n
    per_case.append({'id': case_id, 'matching': successes, 'originalAssertions': n, 'source': source, 'sourceSha256': sha(task / source)})
assert counts == {'cases': 52, 'assertions': 227, 'matchingAssertions': 225, 'fullyMatchingCases': 50,
                  'pureCases': 43, 'pureAssertions': 196, 'pureMatchingAssertions': 194,
                  'persistenceCases': 9, 'persistenceAssertions': 31, 'persistenceMatchingAssertions': 31}
assert [(r['case'], r['assertionIndex']) for r in failures] == [('CR011', 0), ('CR051', 1)]

fixtures = read(task / 'game-scope-fixtures-v2/cases.json')
fresh_games = {c['id']: c for c in read(own / 'outputs/versioned-game-results.json')['results']}
fresh_storage = {c['id']: c for c in read(own / 'outputs/game-storage-results.json')['results']}
original_by_id = {c['id']: c for c in spec['cases']}
positive_total, retained_total, carrier_rows = 0, 0, []
for case in fixtures['positiveCases']:
    original_id = case['id'].split('-')[0]
    prior = original_by_id[original_id]
    assert all(a in case['assertions'] for a in prior['assertions'])
    retained_total += len(prior['assertions'])
    positive_total += len(case['assertions'])
    for result in [fresh_games[case['id']], fresh_storage[case['id']]]:
        assert len(result['assertions']) == len(case['assertions'])
        for a, observed in zip(case['assertions'], result['assertions']):
            assert a == observed['assertion'] and passes(a, observed['actual'])
    negative = fresh_storage[original_id + '-AMBIGUOUS-NEGATIVE-durable']
    assert negative['canonicalOccurrences'] == 1 and len(negative['nativeEffects']) <= 1
    assert negative['holdReasons'] and all(r['status'] == 'held' and r['requires_review'] is True for r in negative['outbox'])
    carrier_rows.append({'original': original_id, 'rawCarriers': len(negative['outbox']), 'canonicalOccurrences': 1,
                         'nativeEffects': negative['nativeEffects'], 'allCarriersHeld': True})
assert positive_total == 12 and retained_total == 7
for case in fixtures['revisionCases']:
    result = fresh_games[case['id']]
    assert result['status'] == 'passed'
    assert all(a == o['assertion'] and passes(a, o['actual']) for a, o in zip(case['assertions'], result['assertions']))

result = {'independentCounts': counts, 'originalFailuresPreserved': failures, 'rows': per_case,
          'freshNormalAndMutationRowsEqualOwnerAndAcceptedHistoricalRows': True,
          'normalExit1Expected': ['CR011', 'CR051'], 'mutationExit1Expected': ['CR011', 'CR019', 'CR051'],
          'approvedSeparatePositiveAssertions': positive_total, 'allOriginalGameAssertionsRetained': retained_total,
          'rawCarrierNativeIdentityAccounting': carrier_rows, 'authenticatedEditRemainsSeparateRevision': True,
          'full52IntegratedAccepted': False, 'currentCombinedRuntimeAccepted': False, 'productionAccepted': False,
          'authenticFutureOutcomesRead': False}
(own / 'independent-ledger-audit.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'rows'}, indent=2))
