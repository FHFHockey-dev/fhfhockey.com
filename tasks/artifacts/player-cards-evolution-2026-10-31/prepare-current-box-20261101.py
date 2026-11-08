"""Bind reviewed local comparison output; no scorer, source requests or producer edits."""
from pathlib import Path
import copy, hashlib, json
ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
OWNER = Path('/Users/tim/Documents/Codex/2026-10-27/task-3/current-box-provenance-20261101-01')
MAP = OWNER.parent / 'baseline-card-provenance-20261101-01/cards-01/PLAYER-CARDS-PROVENANCE.json'
pins = []
def read(path, expected):
    raw = path.read_bytes(); digest = hashlib.sha256(raw).hexdigest(); assert digest == expected, path
    pins.append({'path': str(path), 'sha256': digest, 'bytes': len(raw)})
    return json.loads(raw) if path.suffix == '.json' else raw
receipt_hash = 'e51173a80e5f0f55e45abf7e914b127b2c8d0cf6f7543a38aa18a9df4f4190a0'
receipt = read(OWNER / 'FINAL-RECEIPT.json', receipt_hash)
rows = read(OWNER / 'ROW-QUALIFICATION.json', receipt['files']['ROW-QUALIFICATION.json'])
boxes = read(OWNER / 'BOX-EVIDENCE.json', receipt['files']['BOX-EVIDENCE.json'])
review = ROOT / 'tasks/artifacts/rso-blsh-independent-review-2026-11-01/CURRENT-BOX-REVIEW.md'
review_hash = '166b65ff7be1a16883d2546c4a1a03b54f286963324e494b1ebba0a41aeb2ce9'
read(review, review_hash)
base = json.loads((OUT / 'retained-blsh-provenance-input.json').read_text())
sidecar = read(MAP, base['provenance']['sidecarSHA256'])
display = read(ROOT / 'web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json', base['snapshotSHA256'])
by = {r['sourceId']: r for r in rows}; source_rows = {r['sourceId']: r for p in sidecar['profiles'] for r in p['sourceRows']}
assert len(by) == len(rows) == len(source_rows) == 3407 and by.keys() == source_rows.keys()
for key, row in by.items():
    src = source_rows[key]
    assert all(row[k] == src[k] for k in ['sourceId', 'playerId', 'gameId', 'date'])
    assert row['wgoTeam'] == src['team']
covered = [r for r in rows if r['gameFinality'] == 'final']
differing = [r for r in covered if r['TOI']['state'] == 'mismatch' or any(v['state'] == 'mismatch' for v in r['counts'].values())]
exposure_count_differences = [r for r in rows if r['state'] == 'identity_team_exposure_qualified' and any(v['state'] == 'mismatch' for v in r['counts'].values())]
assert (len(covered), len(differing), len(rows)-len(covered), len(exposure_count_differences)) == (2827, 99, 580, 46)
result = {}
for player_id in [8476453, 8484136]:
    profile = next(p for p in display['profiles'] if p['playerId'] == player_id)
    lineage = next(p for p in sidecar['profiles'] if p['playerId'] == player_id)
    selected = copy.deepcopy(base); selected['profile'] = profile
    selected['provenance'].update({'playerId': player_id, 'team': profile['team'], 'rows': [{k:r[k] for k in ['sourceId','gameId','playerId','season','date','team','regularSeasonCalendarMatched','finalityEstablished']} for r in lineage['sourceRows']]})
    selected_rows = []
    for source_id in profile['evidence']['window']['sourceIds']:
        row = copy.deepcopy(by[source_id]); box = boxes.get(str(row['evidenceGameId']))
        row['box'] = {k:box[k] for k in ['url','bodySHA256','receiptSHA256','retrievedAtUTC','originalPublicationUTC']} if box else None
        selected_rows.append(row)
    selected['currentBoxes'] = {'version':'fhfh.card-retained-box-comparison.v1','rowsSHA256':receipt['files']['ROW-QUALIFICATION.json'],'boxEvidenceSHA256':receipt['files']['BOX-EVIDENCE.json'],'receiptSHA256':receipt_hash,'sourceSidecarSHA256':base['provenance']['sidecarSHA256'],'snapshotSHA256':base['snapshotSHA256'],'wgoCapturedAt':base['metadata']['asOfUTC'],'review':{'reference':str(review.relative_to(ROOT)),'sha256':review_hash,'scope':'dated-source-comparison-only'},'rows':selected_rows}
    result[str(player_id)] = selected
(OUT / 'retained-blsh-current-box-inputs.json').write_text(json.dumps(result,indent=2)+'\n')
report = {'scope':'Consumer binding to reviewed hashes and all source-row identities; no repeat scientific review','inputPins':pins,'rows':3407,'exposureQualifiedRows':2774,'exposureQualifiedWithCountDifferences':46,'matchExposureAndFiveCounts':len(covered)-len(differing),'differentExposureOrCounts':len(differing),'unavailable':len(rows)-len(covered),'selectedPlayers':list(result),'originalSidecarPreserved':True,'researchScoresPreserved':True,'currentBinding':False,'sourceRequests':0,'repairs':0}
(OUT / 'CURRENT-BOX-CONSUMER-ASSESSMENT-20261101.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['rows','exposureQualifiedWithCountDifferences','matchExposureAndFiveCounts','differentExposureOrCounts','unavailable','selectedPlayers']}))
