"""Local-only consumer contract checks. No scorer, provider, database or producer writes."""
from pathlib import Path
import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
OWNER = Path('/Users/tim/Documents/Codex/2026-10-27/task-3/baseline-card-provenance-20261101-01')
SIDECAR_HASH = '0b98ebc0fa2bbf0554b781d6c7548b820c37768b4868d11784ca837dad070d57'
SNAPSHOT_HASH = '2f380c2539390f6931ec92ab1d0b1d8cced2b55f5f4cefb8c6e88a694909f2c8'
pins = []

def read_pin(path, expected):
    data = path.read_bytes()
    actual = hashlib.sha256(data).hexdigest()
    assert actual == expected, str(path)
    pins.append({'path': str(path), 'sha256': actual, 'bytes': len(data)})
    return json.loads(data)

sidecar = read_pin(OWNER / 'cards-01/PLAYER-CARDS-PROVENANCE.json', SIDECAR_HASH)
display = read_pin(ROOT / 'web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json', SNAPSHOT_HASH)
input_pins = json.loads((OWNER / 'INPUT-PINS.json').read_text())
inputs = {}
for name in ['RAW-wgo.json', 'RAW-calendar.json']:
    matches = [Path(p) for p in input_pins if p.endswith('/current-refresh-20261029-01/' + name)]
    assert len(matches) == 1
    inputs[name] = read_pin(matches[0], input_pins[str(matches[0])])['records']
wgo = {r['id']: r for r in inputs['RAW-wgo.json']}
calendar = {r['id']: r for r in inputs['RAW-calendar.json']}
assert len(wgo) == len(inputs['RAW-wgo.json'])
assert len(calendar) == len(inputs['RAW-calendar.json'])
profiles = {p['playerId']: p for p in display['profiles']}
assert len(profiles) == len(display['profiles']) == len(sidecar['profiles']) == 729
assert sidecar['snapshotSHA256'] == SNAPSHOT_HASH
assert sidecar['independentReviewPending'] is True
assert sidecar['trusted'] is False and sidecar['productionAdopted'] is False
assert sidecar['confidenceProbability'] is None
rows = []
for profile in sidecar['profiles']:
    saved = profiles[profile['playerId']]
    assert profile['team'] == saved['team']
    assert profile['window'] == saved['evidence']['window']
    assert profile['scoreSnapshot'] == saved['score']
    assert [r['sourceId'] for r in profile['sourceRows']] == saved['evidence']['window']['sourceIds']
    assert [r['date'] for r in profile['sourceRows']] == saved['evidence']['window']['dates']
    for row in profile['sourceRows']:
        raw = wgo[row['sourceId']]
        assert (row['playerId'], row['gameId'], row['season'], row['date'], row['team']) == (raw['player_id'], raw['game_id'], raw['season_id'], raw['date'], raw['team_abbrev'])
        game = calendar[row['gameId']]
        assert row['calendarMatch'] == game
        assert game['seasonId'] == row['season'] and game['date'] == row['date'] and game['type'] == 2
        assert row['regularSeasonCalendarMatched'] is True
        rows.append(row)
assert len(rows) == len({r['sourceId'] for r in rows}) == 3407

capture = sidecar['capture']
age = (datetime.datetime.fromisoformat(sidecar['generatedAtUTC'].replace('Z', '+00:00')) - datetime.datetime.fromisoformat(capture['asOfUTC'])).total_seconds() / 3600
assert age > capture['freshnessPolicy']['maxCaptureAgeHours'] == 24
selected = next(p for p in sidecar['profiles'] if p['playerId'] == 8476453)
retained = json.loads((OUT / 'retained-blsh-input.json').read_text())
assert retained['profile'] == profiles[8476453]
review_path = ROOT / 'tasks/artifacts/rso-blsh-independent-review-2026-11-01/PROVENANCE-REVIEW.md'
review_hash = '54fbf0418908263ce5a0ed3e2b4812c78d70d152aacc818df0568567aa265701'
assert hashlib.sha256(review_path.read_bytes()).hexdigest() == review_hash
pins.append({'path': str(review_path), 'sha256': review_hash, 'bytes': review_path.stat().st_size})
retained['provenance'] = {
    'version': sidecar['version'], 'sidecarSHA256': SIDECAR_HASH, 'snapshotSHA256': SNAPSHOT_HASH,
    'independentReviewPending': True, 'generatedAtUTC': sidecar['generatedAtUTC'],
    'asOfUTC': capture['asOfUTC'], 'eventThroughDate': capture['eventThroughDate'],
    'maxCaptureAgeHours': capture['freshnessPolicy']['maxCaptureAgeHours'],
    'playerId': selected['playerId'], 'team': selected['team'], 'season': display['seasonId'],
    'rows': [{k: row[k] for k in ['sourceId', 'gameId', 'playerId', 'season', 'date', 'team', 'regularSeasonCalendarMatched', 'finalityEstablished']} for row in selected['sourceRows']],
    'limitations': [text for text in sidecar['limitations'] if 'independent review and Player Cards' not in text] + [
        'Independent review scope: dated stale provisional research only; no current recommendation or advanced observed-metric admission.',
        'Current team labels are carried from WGO; calendar capture lacks home/away fields for independent team verification.',
        'Historical baseline review covers three fixed 50-row cases, not all 729 references; 49 of 150 PPP values still rely on WGO because official boxes lack PP assists.',
    ],
    'review': {'reference': str(review_path.relative_to(ROOT)), 'sha256': review_hash, 'sidecarSHA256': SIDECAR_HASH, 'scope': 'dated-stale-research-only'},
}
(OUT / 'retained-blsh-provenance-input.json').write_text(json.dumps(retained, indent=2) + '\n')
nhl = json.loads((OUT / 'season-manifest.json').read_text())['presentation']['snapshot']
report = {
    'scope': 'Consumer contract/mapping verification only; not independent scientific acceptance',
    'inputPins': pins, 'profilesChecked': len(profiles), 'windowRowsChecked': len(rows),
    'finalityEstablishedRows': sum(r['finalityEstablished'] for r in rows),
    'selectedPlayerId': 8476453,
    'selectedGamesMatchRetainedNhl': sorted(r['gameId'] for r in selected['sourceRows']) == sorted(nhl['recent']['gameIds']),
    'selectedFinalityEstablishedRows': sum(r['finalityEstablished'] for r in selected['sourceRows']),
    'nhlObservedAt': nhl['capture']['observedAt'], 'blshObservedAt': capture['asOfUTC'],
    'captureAgeHoursAtSidecarBuild': age, 'captureAgeBudgetHours': 24,
    'independentReviewPending': False, 'rawSidecarPendingFlagPreserved': True, 'currentBindingAccepted': False,
    'remainingGates': ['Capture exceeds original24hour budget; event-relative fresh is not clock freshness', 'NHL and BLSH capture times differ; no common capture receipt', 'Only657of3407rows have finality evidence; selected Kucherov rows have none in this sidecar', 'NST model revisions/native metric strength receipts remain unavailable', 'Existing editor custody remains pending'],
    'safeUse': 'Independently reviewed lineage on separately dated stale research only; no advanced-field or observed-current admission',
    'scoreRecomputations': 0, 'databaseCalls': 0, 'providerCalls': 0,
}
(OUT / 'BLSH-SIDECAR-ASSESSMENT-20261101.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: report[k] for k in ['profilesChecked', 'windowRowsChecked', 'finalityEstablishedRows', 'selectedGamesMatchRetainedNhl', 'currentBindingAccepted']}))
