"""Offline expected-key coverage reconciliation for the retained 2026-10-16 daily package.

Engineering replay over retained private files only: no network, database or producer
calls. The expected universe is enumerated independently from the acquisition
contract (players x next-20 scheduled team games x required targets), then every
key is classified against the pinned ability sources and participation receipts.

Usage: python3 -I coverage-reconciliation.py PRIVATE_ROOT AS_OF_ISO OUT_PRIVATE_DETAIL OUT_SUMMARY
"""
import collections
import datetime
import hashlib
import json
import os
import sys

root, as_of, detail_path, summary_path = sys.argv[1:5]
now = datetime.datetime.fromisoformat(as_of.replace('Z', '+00:00'))
for path in (detail_path, summary_path):
    assert not os.path.exists(path), 'Preserve prior outputs; choose a new path.'

PLAN_FILES = {
    'candidate-conditional-publication-candidate-v2/final-publication-plan.json': '08f19107625784687a338c8d12c10e8298b7cceabf68f7704cb98c952e4b404b',
    'goalie-summary-win-preparation-v1/final-publication-plan.compact.json': '2d654e6dd527a6410c0babd2c08d6f533a11485768120f9c1a49d98a61a44828',
    'native-publication-candidate-v1/final-publication-plan.json': '1f04d55947a618e809e3c14a149d2fa9a7a089b3534dd852e556769d0ed63880',
    'candidate-participation-preparation-v1/immediate14-v1/final-publication-plan.json': '1460e6893e8f87c211f1c43d3272eeb2066df3cf304f9d91e09c982dfb2d8840',
    'candidate-participation-preparation-v2/additional25-v1/final-publication-plan.json': 'bf42484f36b9c6093f299cdf9c0753c77502e5f2584bafe0c6a22805c9091b70',
}
PINS = ('consumer-browser-v3/final-combined-pins.json', '8ffbee2c568378a10275489ed5a45585af8e1d398e8726b9800f0d6665c3106f')
CONTRACT = 'daily-acquisition-contract-20261016-v1/plan.json'
TARGETS = {
    'skater': ['GOALS', 'ASSISTS', 'PP_POINTS', 'SHOTS_ON_GOAL', 'HITS', 'BLOCKED_SHOTS', 'PENALTY_MINUTES'],
    # SV% and GAA are ratios derived from SV, GA, SA and minutes; they are not separate heads.
    'goalie': ['SAVES_GOALIE', 'GOALS_AGAINST_GOALIE', 'SHOTS_AGAINST_GOALIE', 'GOALIE_MINUTES', 'WINS_GOALIE', 'SHUTOUTS_GOALIE'],
}
PARTICIPATION = {'skater': 'skater-roster-observation-participation-bundle-v1',
                 'goalie': 'goalie-roster-observation-participation-bundle-v1'}
START = 'goalie-roster-observation-start-bundle-v1'


def load(relative, pin=None):
    data = open(os.path.join(root, relative), 'rb').read()
    digest = hashlib.sha256(data).hexdigest()
    if pin:
        assert digest == pin, f'{relative} changed'
    return json.loads(data), digest


def instant(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))


rows = [row for name, pin in PLAN_FILES.items() for row in load(name, pin)[0]['rows']]
pins, _ = load(*PINS)
pins = pins['proposedPins']
contract, contract_hash = load(CONTRACT)
pinned_bundles = set(pins['PLAYER_FORECAST_BASELINE_RELEASE_IDS'].split(','))
pinned_participation = {entry.split(':')[0] for key, value in pins.items() if key != 'PLAYER_FORECAST_BASELINE_RELEASE_IDS'
                        for entry in value.split(',') if entry}

by_id = {}
for row in rows:
    old = by_id.get(row['id'])
    assert old is None or old['payload_hash'] == row['payload_hash'], 'conflicting duplicate row id'
    by_id[row['id']] = row
assert pinned_bundles <= set(by_id) and pinned_participation <= set(by_id), 'pinned release missing from retained plans'

ability = collections.defaultdict(list)
for release in pinned_bundles:
    for source in by_id[release]['payload']['sources']:
        ability[(source['playerId'], source['targetKey'])].append(source)
receipts = {}
for release in pinned_participation:
    payload = by_id[release]['payload']
    for entry in payload['entries']:
        key = (payload['version'], entry['input']['scope']['playerId'], entry['input']['scope']['gameId'])
        assert key not in receipts, f'duplicate participation receipt {key}'
        receipts[key] = (entry['receipt'], payload['expiresAt'])

counts = collections.Counter()
by_horizon = collections.Counter()
reasons = collections.Counter()
team_mismatch = set()
detail = []
starts = collections.Counter()
for player in contract['universe']['players']:
    cls, pid, universe = player['class'], player['playerId'], player['universe']
    games = player['next20GameIds']
    assert len(games) == 20 and len(set(games)) == 20, f'{pid} lacks 20 distinct scheduled games'
    for index, game in enumerate(games):
        horizons = [h for h, n in (('next1', 1), ('next10', 10), ('next20', 20)) if index < n]
        participation = receipts.get((PARTICIPATION[cls], pid, game))
        if cls == 'goalie':
            start = receipts.get((START, pid, game))
            starts['present_non_null' if start and start[0].get('probability') is not None
                   else 'present_null' if start else 'missing'] += 1
        for target in TARGETS[cls]:
            sources = ability.get((pid, target), [])
            if not sources:
                status, reason = 'missing', 'no_pinned_ability_source'
            elif participation is None:
                status, reason = 'excluded', 'no_participation_receipt_for_game'
            elif participation[0].get('probability') is None:
                status, reason = 'missing', 'participation_probability_null:' + ','.join(sorted(participation[0].get('reasons') or ['unspecified']))
            else:
                status, reason = 'generated', None
            if sources and any(source['teamId'] != player['teamId'] for source in sources):
                team_mismatch.add(pid)
            expiry = min([instant(s['expiresAt']) for s in sources] + ([instant(participation[1])] if participation else []), default=None)
            current = 'expired' if expiry is not None and expiry <= now else status
            counts[(universe, cls, status)] += 1
            if reason:
                reasons[reason] += 1
            for horizon in horizons:
                by_horizon[(horizon, universe, status)] += 1
                by_horizon[(horizon, universe, 'as_of_' + current)] += 1
            detail.append({'playerId': pid, 'universe': universe, 'class': cls, 'gameId': game, 'order': index + 1,
                           'target': target, 'status': status, 'reason': reason, 'asOfStatus': current,
                           'expiresAt': expiry.isoformat() if expiry else None})

expected = sum(len(TARGETS[p['class']]) * 20 for p in contract['universe']['players'])
assert len(detail) == expected == len({(d['playerId'], d['gameId'], d['target']) for d in detail}), 'every expected key exactly once'
summary = {
    'version': 'forge-expected-key-coverage-v1', 'label': 'engineering replay of retained 2026-10-16 package; not current coverage',
    'asOf': as_of, 'contractSHA256': contract_hash, 'players': len(contract['universe']['players']),
    'playersByClass': dict(collections.Counter(p['class'] for p in contract['universe']['players'])),
    'expectedKeys': expected, 'targets': TARGETS,
    'byUniverseClassStatus': {'|'.join(k): v for k, v in sorted(counts.items())},
    'byHorizon': {'|'.join(k): v for k, v in sorted(by_horizon.items())},
    'reasons': dict(sorted(reasons.items())),
    'goalieStartReceiptsByGame': dict(starts),
    'playersWithSourceTeamDifferentFromContractTeam': len(team_mismatch),
    'networkRequests': 0, 'databaseWrites': 0, 'producerCalls': 0,
}
with open(detail_path, 'x') as handle:
    json.dump({'summary': summary, 'keys': detail}, handle)
with open(summary_path, 'x') as handle:
    json.dump(summary, handle, indent=1)
    handle.write('\n')
print(json.dumps(summary, indent=1))
