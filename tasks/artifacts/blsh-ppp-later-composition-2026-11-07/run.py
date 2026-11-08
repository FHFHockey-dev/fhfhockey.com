"""Bounded offline runner; authenticate only the evidence needed for this candidate."""
import sys
sys.dont_write_bytecode = True
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import hashlib
import json
import socket

from compose import (canonical_hash, compose_profiles, compose_rows, index_unique,
                     need, stamp, validate_selection)

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
BASE = Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
AUDIT = REPO / 'tasks/artifacts/blsh-current-ppp-direct-audit-2026-11-02'
DIRECT = BASE / 'current-ppp-direct-comparison-20261102-01'
OLD = BASE / 'ppp-sidecar-composition-20261101-01'
REQUEST = BASE / 'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json'
CONTEXT = BASE / 'current-refresh-reader-20261101-01/production-context-02/CONTEXTS.json'
ANNOTATIONS = BASE / 'older-ppp-observation-contract-20261101-01/candidate-01/ANNOTATIONS.json'
COMBINED = BASE / 'fresh-box-qualification-20261101-01/qualification-01/COMBINED-ROW-EVIDENCE.json'
ANCHORS = {
    str(AUDIT / 'PINS.json'): '751fa3578ea9ac732a4e0b7e562cc1ccaa5edfb22331798c1ea893018a367e14',
    str(AUDIT / 'RESULT.json'): '224671271c818f162124bd3908d9bfea1a8d9c065393349bbdde35afb9d90647',
    str(AUDIT / 'verify.py'): '9119907159c5e1549312bc9ea4133170d1a9329c0de0eead29a43049dd41b948',
    str(OLD / 'HANDOFF-RECEIPT.json'): '9bfe74102225ac4f2dda98fab6d6487f0f69a172326e45b766d757f820597f37',
}


def deny_network(*args, **kwargs):
    raise RuntimeError('Offline evidence composition forbids network access')


socket.socket.connect = deny_network
socket.socket.connect_ex = deny_network
socket.create_connection = deny_network
socket.getaddrinfo = deny_network


class Inputs:
    def __init__(self):
        self.bindings = {}
        self.bytes = {}

    def checked(self, path, expected, binding):
        path = str(path)
        need(isinstance(expected, str) and len(expected) == 64, 'missing_retained_binding')
        data = Path(path).read_bytes()
        need(hashlib.sha256(data).hexdigest() == expected, 'authenticated_file_drift: ' + path)
        if path in self.bindings:
            need(self.bindings[path]['sha256'] == expected, 'conflicting_input_pin')
        else:
            self.bindings[path] = dict(sha256=expected, binding=binding)
        self.bytes[path] = data
        return data

    def json(self, path, expected, binding):
        return json.loads(self.checked(path, expected, binding))

    def unchanged(self):
        for path, pin in self.bindings.items():
            need(hashlib.sha256(Path(path).read_bytes()).hexdigest() == pin['sha256'], 'input_changed_during_run')


def load_inputs():
    inputs = Inputs()
    anchors = {path: inputs.checked(path, sha, 'retained_local_audit_or_handoff_anchor')
               for path, sha in ANCHORS.items()}
    pins = json.loads(anchors[str(AUDIT / 'PINS.json')])
    audit = json.loads(anchors[str(AUDIT / 'RESULT.json')])
    need(audit['state'] == 'PASS' and audit['laterCandidates'] == 44 and audit['exposureHolds'] == 18,
         'prior_audit_disposition_drift')

    def accepted(path):
        return inputs.json(path, pins[str(path)], str(AUDIT / 'PINS.json'))

    comparisons = accepted(DIRECT / 'COMPARISONS.json')
    inputs.checked(DIRECT / 'CHECKPOINT.md', pins[str(DIRECT / 'CHECKPOINT.md')], str(AUDIT / 'PINS.json'))
    input_pins = accepted(DIRECT / 'INPUT-PINS.json')
    receipt = accepted(DIRECT / 'FINAL-RECEIPT.json')
    for filename in ('COMPARISONS.json', 'CHECKPOINT.md', 'INPUT-PINS.json'):
        need(receipt['files'][filename] == pins[str(DIRECT / filename)], 'direct_receipt_binding_drift')
    request = accepted(REQUEST)
    contexts = accepted(CONTEXT)
    rows = accepted(OLD / 'candidate-01/ROWS.json')
    annotations = accepted(ANNOTATIONS)
    combined = accepted(COMBINED)
    for path in (REQUEST, OLD / 'candidate-01/ROWS.json', ANNOTATIONS, COMBINED):
        need(input_pins[str(path)] == pins[str(path)], 'comparison_input_binding_drift')
    handoff = json.loads(anchors[str(OLD / 'HANDOFF-RECEIPT.json')])
    old_receipt = inputs.json(OLD / 'FINAL-RECEIPT.json', handoff['finalReceiptSHA256'],
                              str(OLD / 'HANDOFF-RECEIPT.json'))
    need(old_receipt['files'][str(OLD / 'candidate-01/ROWS.json')] == pins[str(OLD / 'candidate-01/ROWS.json')],
         'old_sidecar_binding_drift')
    profiles = inputs.json(OLD / 'candidate-01/PROFILES.json',
                           old_receipt['files'][str(OLD / 'candidate-01/PROFILES.json')],
                           str(OLD / 'FINAL-RECEIPT.json'))
    # Read and pin the old algorithm as lineage, but do not execute it or follow its broad input graph.
    inputs.checked(OLD / 'compose.py', old_receipt['files'][str(OLD / 'compose.py')],
                   str(OLD / 'FINAL-RECEIPT.json'))
    need(contexts['captureSHA256'] == pins[str(REQUEST)], 'context_capture_binding_drift')
    capture_at = request['wgo']['capture']['retrievedAtUTC']
    need(request['asOfUTC'] == capture_at and request['seasonId'] == 20262027, 'capture_contract_drift')
    raw = index_unique(request['wgo']['rows'], 'id')
    selected = [sid for p in contexts['profiles'] for sid in p['sourceIds']]
    need(len(raw) == 8135 and len(selected) == 3461 and len(contexts['profiles']) == 740,
         'frozen_population_drift')
    sources = [raw[sid] for sid in selected]
    validate_selection(rows, sources, contexts['profiles'], profiles, capture_at)
    row_by = index_unique(rows, 'sourceId')
    annotation_by = index_unique(annotations, 'sourceId')
    combined_by = index_unique(combined, 'sourceId')
    need(set(row_by) == set(combined_by), 'combined_selected_scope_drift')
    unresolved = {sid for sid, row in row_by.items() if row['fields']['pp_points']['state'] == 'unknown'}
    older = {sid for sid, a in annotation_by.items() if a['state'] == 'older_observation_agrees'}
    comparison_by = index_unique(comparisons, 'sourceId')
    need(len(unresolved) == 212 and len(older) == 150 and older <= unresolved, 'unresolved_population_drift')
    need(len(annotations) == 207 and len(comparisons) == 62 and set(comparison_by) == unresolved - older,
         'comparison_population_drift')
    for proof in comparisons:
        sid = proof['sourceId']
        need(proof['priorCombined'] == combined_by[sid] and proof['priorOlderObservation'] == annotation_by.get(sid),
             'retained_comparison_lineage_drift')
        authenticate_native(inputs, pins, receipt, proof, raw[sid])
    need({p['sourceId'] for p in comparisons if p['laterMatchingEvidenceCandidate']} == set(audit['candidateIds']),
         'accepted_candidate_set_drift')
    skipped = {path: ('obsolete_or_unrelated_application_pin_not_read' if '/web/' in path else
                      'historical_code_not_read_or_executed' if '/historical-' in path else
                      'unneeded_audit_input_not_read')
               for path in pins if path not in inputs.bindings}
    return dict(inputs=inputs, pins=pins, audit=audit, request=request, contexts=contexts, rows=rows,
                sources=sources, profiles=profiles, annotations=annotations, comparisons=comparisons,
                skipped=skipped, capture_at=capture_at)


def authenticate_native(inputs, pins, final_receipt, proof, source):
    """Recheck the exact retained native operands, complete payloads and transport lineage."""
    evidence = proof['nativeEvidence']
    body_path = Path(evidence['bodyPath'])
    receipt_path = Path(evidence['receiptPath'])
    for path, field in ((body_path, 'bodySHA256'), (receipt_path, 'receiptSHA256')):
        need(pins[str(path)] == evidence[field], 'native_proof_binding_drift')
    body = inputs.checked(body_path, evidence['bodySHA256'], str(AUDIT / 'PINS.json'))
    receipt = inputs.json(receipt_path, evidence['receiptSHA256'], str(AUDIT / 'PINS.json'))
    need(receipt['sha256'] == evidence['bodySHA256'] and receipt['bytes'] == len(body), 'native_body_receipt_drift')
    need(receipt['url'] == evidence['url'] and receipt['TLSVerified'] is True and receipt['httpStatus'] == 200,
         'native_transport_drift')
    need('application/json' in receipt['headers']['Content-Type'].lower(), 'native_content_type_drift')
    reused = proof['evidenceOrigin'] == 'retained_November_1_report'
    need(proof['evidenceOrigin'] in ('retained_November_1_report', 'new_exact_player_report'), 'native_origin_drift')
    if reused:
        need(body_path.parent == BASE / 'source-vintage-20261101-01/live-02', 'retained_body_path_drift')
        dispatch_path = Path(evidence['dispatchPath'])
        need(pins[str(dispatch_path)] == evidence['dispatchSHA256'], 'dispatch_binding_drift')
        observed = receipt['at']
    else:
        folder = DIRECT / 'live-01' / str(source['id'])
        need(body_path == folder / 'BODY.json' and receipt_path == folder / 'TRANSPORT-RECEIPT.json',
             'exact_player_body_path_drift')
        dispatch_path = folder / 'DISPATCH.json'
        for path in (body_path, receipt_path, dispatch_path):
            need(final_receipt['files'][str(path.relative_to(DIRECT))] == pins[str(path)], 'new_report_final_binding_drift')
        observed = receipt['atUTC']
        need(receipt['sourcePublicationUTC'] is None, 'native_publication_not_established')
    dispatch = inputs.json(dispatch_path, pins[str(dispatch_path)], str(AUDIT / 'PINS.json'))
    dispatch_at = dispatch['at'] if reused else dispatch['atUTC']
    if not reused:
        need(dispatch['sourceId'] == source['id'] and dispatch['url'] == evidence['url'] and
             dispatch['planSHA256'] == final_receipt['files']['READ-PLAN.json'], 'dispatch_identity_drift')
    else:
        need(dispatch['item'] == receipt['item'], 'retained_dispatch_identity_drift')
    need(proof['observedAtUTC'] == observed, 'observed_time_drift')
    need(0 <= (stamp(observed) - stamp(dispatch_at)).total_seconds() <= 10, 'transport_chronology_drift')
    need(abs((stamp(observed) - parsedate_to_datetime(receipt['headers']['Date'])).total_seconds()) < 2,
         'http_date_drift')
    url = urlsplit(evidence['url'])
    limit = 100 if reused else 2
    cayenne = f"gameId={source['game_id']} and gameTypeId=2" + ('' if reused else f" and playerId={source['player_id']}")
    need(url.scheme == 'https' and url.netloc == 'api.nhle.com' and url.path == '/stats/rest/en/skater/summary'
         and not url.fragment, 'native_endpoint_drift')
    need(parse_qs(url.query) == {'isAggregate': ['false'], 'isGame': ['true'], 'start': ['0'],
         'limit': [str(limit)], 'sort': ['[{"property":"playerId","direction":"ASC"}]'],
         'factCayenneExp': ['gamesPlayed>=1'], 'cayenneExp': [cayenne]}, 'native_query_drift')
    payload = json.loads(body, parse_float=Decimal)
    values = payload['data']
    need(type(payload['total']) is int and payload['total'] == len(values) == (36 if reused else 1)
         and len(values) < limit, 'native_partial_or_duplicate_payload')
    need(len({r['playerId'] for r in values}) == len(values), 'native_duplicate_player')
    for row in values:
        need(type(row['playerId']) is int and type(row['gameId']) is int and type(row['gamesPlayed']) is int,
             'native_identity_type_drift')
        need((row['gameId'], row['gameDate'], row['gamesPlayed']) == (source['game_id'], source['date'], 1),
             'native_identity_drift')
    matches = [r for r in values if r['playerId'] == source['player_id']]
    need(len(matches) == 1, 'native_player_missing_or_duplicate')
    native = matches[0]
    need(native['teamAbbrev'] == source['team_abbrev'], 'native_team_drift')
    for field in ('ppPoints', 'ppGoals', 'goals', 'assists', 'points', 'evPoints', 'shPoints', 'evGoals', 'shGoals', 'shots'):
        need(type(native[field]) is int and native[field] >= 0, 'native_count_type_drift')
    need(native['points'] == native['goals'] + native['assists'] ==
         native['evPoints'] + native['ppPoints'] + native['shPoints'], 'native_point_partition_drift')
    need(native['goals'] == native['evGoals'] + native['ppGoals'] + native['shGoals'] and
         all(native[s + 'Goals'] <= native[s + 'Points'] for s in ('ev', 'pp', 'sh')), 'native_goal_partition_drift')
    need(native['ppPoints'] == proof['nativePPP'] == source['counts']['pp_points'], 'native_PPP_drift')
    need(native['timeOnIcePerGame'] == Decimal(str(proof['exposureComparison']['native'])), 'native_TOI_drift')
    for field in ('goals', 'assists', 'shots'):
        need(native[field] == proof['countComparisons'][field]['native'], 'native_comparison_operand_drift')


def main():
    out = ROOT / 'candidate-01'
    need(not out.exists(), 'immutable_candidate_already_exists')
    data = load_inputs()
    as_of = datetime.now(timezone.utc).isoformat()
    bindings = {name: ANCHORS[str(AUDIT / name)] for name in ('PINS.json', 'RESULT.json', 'verify.py')}
    bindings['COMPARISONS.json'] = data['pins'][str(DIRECT / 'COMPARISONS.json')]
    rows, decisions = compose_rows(data['rows'], data['sources'], data['comparisons'], data['capture_at'], as_of, bindings)
    profiles = compose_profiles(data['profiles'], data['rows'], rows)
    changed = {d['sourceId'] for d in decisions if d['state'] == 'later_field_evidence_composed'}
    held = [d for d in decisions if d['state'] == 'held_unchanged']
    need(changed == set(data['audit']['candidateIds']) and len(changed) == 44 and len(held) == 18, 'composition_scope_drift')
    need({p['sourceId'] for p in data['comparisons'] if p['admissionHolds'] and not p['observationPrecedesCapture']}
         == {5598688, 5599832}, 'later_exposure_hold_drift')
    age_hours = (stamp(as_of) - stamp(data['capture_at'])).total_seconds() / 3600
    summary = dict(
        state='LOCAL_EVIDENCE_CANDIDATE_REQUIRES_INDEPENDENT_REVIEW', composedAtUTC=as_of,
        sourceCaptureAtUTC=data['capture_at'], eventThroughDate=data['request']['eventThroughDate'],
        selectedRows=len(rows), selectedProfiles=len(profiles), captureSourceRows=len(data['request']['wgo']['rows']),
        composedPPPFields=len(changed), literalMatches=len(data['comparisons']), exposureHolds=len(held),
        heldSourceIds=[h['sourceId'] for h in held], olderAnnotationsPreserved=len(data['annotations']),
        olderAgreementsPreserved=sum(a['state'] == 'older_observation_agrees' for a in data['annotations']),
        unresolvedPPP=sum(r['fields']['pp_points']['state'] != 'matched' for r in rows),
        FPCountExposureRows=sum(r['tracks']['fantasyPoints']['corroboratedForThisRow'] for r in rows),
        FPCountExposureWindows=sum(p['tracks']['fantasyPoints']['allSelectedCountsAndExposureMatched'] for p in profiles),
        changedProfiles=sum(p != old for p, old in zip(profiles, data['profiles'])),
        sourceCaptureAgeHoursAtComposition=age_hours,
        sourceCaptureFreshnessAtComposition='stale' if age_hours > data['request']['freshnessPolicy']['maxCaptureAgeHours'] else 'fresh',
        profileCaptureFreshnessMetadataIsHistorical=True, sourceFreshnessRequalified=False,
        sourceRevisionEstablished=False, currentRecommendationQualified=False,
        scoringAdmission=False, fullProfileQualified=False, wholeProfileQualification=False,
        sourceCountsChanged=False, capturedMetricsChanged=False, otherTrackFieldsChanged=False,
        providerRequests=0, databaseCalls=0, scoresComputed=0, holdoutReads=0, applicationChanges=0,
        runtimeRepins=0, deployments=0, NSTPolicyChanges=0, independentReview='pending',
        remainingGates=['independent_composition_review', '18_exposure_holds', '150_older_agreements_not_promoted',
                        '280_raw_Game_Score_input_gaps', 'prior_discrepant_fields',
                        'current_source_freshness_and_operational_reference_acceptance',
                        'real_NST_native_definition_acceptance_policy', 'full_scoring_and_practical_thresholds'])
    need((summary['unresolvedPPP'], summary['FPCountExposureRows']) == (168, 3184), 'row_totals_drift')
    data['inputs'].unchanged()
    out.mkdir()
    outputs = [('ROWS.json', rows), ('PROFILES.json', profiles), ('DECISIONS.json', decisions), ('SUMMARY.json', summary)]
    for name, value in outputs:
        (out / name).write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')
    # Exact byte preservation includes held/outside annotations, not only the 150 agreements.
    (out / 'OLDER-ANNOTATIONS.json').write_bytes(data['inputs'].bytes[str(ANNOTATIONS)])
    (out / 'COMPARISONS.json').write_bytes(data['inputs'].bytes[str(DIRECT / 'COMPARISONS.json')])
    (ROOT / 'INPUT-BINDINGS.json').write_text(json.dumps(data['inputs'].bindings, indent=2) + '\n')
    (ROOT / 'SKIPPED-AUDIT-PINS.json').write_text(json.dumps(data['skipped'], indent=2) + '\n')
    manifest = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.iterdir())}
    (ROOT / 'CANDIDATE-SHA256.json').write_text(json.dumps(manifest, indent=2) + '\n')
    data['inputs'].unchanged()
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
