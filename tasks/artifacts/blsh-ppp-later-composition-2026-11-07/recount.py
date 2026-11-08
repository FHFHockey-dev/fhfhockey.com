"""Separate read-only recount. Does not import the composer, runner, or old algorithms."""
from collections import Counter
from copy import deepcopy
from datetime import datetime
from decimal import Decimal
from pathlib import Path
import hashlib
import json
import socket

ROOT = Path(__file__).resolve().parent
BASE = Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
OUT = ROOT / 'candidate-01'


def deny(*args, **kwargs):
    raise AssertionError('Recount forbids network')


socket.socket.connect = deny
socket.socket.connect_ex = deny
socket.create_connection = deny
socket.getaddrinfo = deny
load = lambda p: json.loads(Path(p).read_text())
sha = lambda b: hashlib.sha256(b).hexdigest()
canonical = lambda x: sha(json.dumps(x, sort_keys=True, separators=(',', ':'), allow_nan=False).encode())


def time(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    assert result.tzinfo is not None and result.utcoffset() is not None
    return result


def main():
    bindings = load(ROOT / 'INPUT-BINDINGS.json')
    for path, binding in bindings.items():
        assert sha(Path(path).read_bytes()) == binding['sha256'], path
    for name, expected in load(ROOT / 'CANDIDATE-SHA256.json').items():
        assert sha((OUT / name).read_bytes()) == expected, name
    old_root = BASE / 'ppp-sidecar-composition-20261101-01/candidate-01'
    old_rows, rows = load(old_root / 'ROWS.json'), load(OUT / 'ROWS.json')
    old_profiles, profiles = load(old_root / 'PROFILES.json'), load(OUT / 'PROFILES.json')
    request = load(BASE / 'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json')
    context = load(BASE / 'current-refresh-reader-20261101-01/production-context-02/CONTEXTS.json')
    comparisons = load(OUT / 'COMPARISONS.json')
    summary = load(OUT / 'SUMMARY.json')
    decisions = load(OUT / 'DECISIONS.json')
    raw = {v['id']: v for v in request['wgo']['rows']}
    old_by, new_by = {r['sourceId']: r for r in old_rows}, {r['sourceId']: r for r in rows}
    selected = [sid for p in context['profiles'] for sid in p['sourceIds']]
    assert len(raw) == len(request['wgo']['rows']) == 8135
    assert len(selected) == len(set(selected)) == len(rows) == len(old_rows) == 3461
    assert set(selected) == set(old_by) == set(new_by)
    assert [r['sourceId'] for r in old_rows] == [r['sourceId'] for r in rows]
    assert len(profiles) == len(old_profiles) == len(context['profiles']) == 740
    capture = request['asOfUTC']
    assert capture == request['wgo']['capture']['retrievedAtUTC'] == summary['sourceCaptureAtUTC']
    candidate_ids, held_ids, older_held = set(), set(), set()
    for proof in comparisons:
        sid = proof['sourceId']
        source = raw[sid]
        assert proof['sourceRowSHA256'] == canonical(source)
        assert proof['priorSidecar'] == old_by[sid]
        assert (proof['playerId'], proof['gameId'], proof['date'], proof['team']) == (
            source['player_id'], source['game_id'], source['date'], source['team_abbrev'])
        assert proof['sourceCaptureAtUTC'] == capture
        ev = proof['nativeEvidence']
        body = Path(ev['bodyPath']).read_bytes()
        assert sha(body) == ev['bodySHA256']
        assert sha(Path(ev['receiptPath']).read_bytes()) == ev['receiptSHA256']
        payload = json.loads(body, parse_float=Decimal)
        native = [r for r in payload['data'] if r['playerId'] == source['player_id']]
        assert len(native) == 1
        native = native[0]
        assert native['ppPoints'] == source['counts']['pp_points'] == proof['nativePPP'] == proof['capturedPPP']
        matched_toi = native['timeOnIcePerGame'] == Decimal(str(source['toi_per_game']))
        before_capture = time(proof['observedAtUTC']) < time(capture)
        assert proof['observationPrecedesCapture'] == before_capture
        assert proof['scoringAdmission'] is False and proof['wholeProfileQualification'] is False
        if matched_toi:
            assert proof['admissionHolds'] == [] and proof['laterMatchingEvidenceCandidate'] is True
            assert time(capture) < time(proof['observedAtUTC']) <= time(summary['composedAtUTC'])
            assert old_by[sid]['exposureState'] == 'matched'
            assert proof['priorCombined']['boxQualification']['gameFinality'] == 'final'
            assert all(native[field] == source['counts'][field] for field in ('goals', 'assists', 'shots'))
            candidate_ids.add(sid)
        else:
            assert proof['laterMatchingEvidenceCandidate'] is False
            assert 'direct_exposure_unmatched' in proof['admissionHolds']
            assert old_by[sid] == new_by[sid]
            held_ids.add(sid)
            if before_capture:
                older_held.add(sid)
    assert len(comparisons) == len({p['sourceId'] for p in comparisons}) == 62
    assert len(candidate_ids) == 44 and len(held_ids) == 18 and len(older_held) == 16
    assert held_ids - older_held == {5598688, 5599832}
    assert {d['sourceId'] for d in decisions if d['state'] == 'later_field_evidence_composed'} == candidate_ids
    assert {d['sourceId'] for d in decisions if d['state'] == 'held_unchanged'} == held_ids
    changed_rows, changed_fields = set(), []
    fields = ('goals', 'assists', 'shots', 'hits', 'blocked_shots', 'pp_points')
    for original, row in zip(old_rows, rows):
        sid = row['sourceId']
        source = raw[sid]
        assert (row['playerId'], row['gameId'], row['date']) == (source['player_id'], source['game_id'], source['date'])
        assert source['season_id'] == 20262027
        assert row['scoringAdmission'] is False and row['fullProfileQualified'] is False
        for field in fields:
            if original['fields'][field] != row['fields'][field]:
                changed_fields.append((sid, field))
        if row != original:
            changed_rows.add(sid)
            assert row['fields']['pp_points'] == dict(state='matched', method='official_later_exact_player_summary_PPP',
                                                     official=source['counts']['pp_points'])
            track = row['tracks']['fantasyPoints']
            assert track['unknownFields'] == [f for f in fields if row['fields'][f]['state'] == 'unknown']
            assert track['differentFields'] == [f for f in fields if row['fields'][f]['state'] == 'different']
            assert track['allSelectedOperandsMatched'] == (not track['unknownFields'] and not track['differentFields'])
            assert track['corroboratedForThisRow'] == (track['allSelectedOperandsMatched'] and track['identityExposureFinalityMatched'])
            provenance = row['laterPPPEvidence']
            proof = next(p for p in comparisons if p['sourceId'] == sid)
            assert provenance['comparisonSHA256'] == canonical(proof)
            assert provenance['priorSidecarSHA256'] == canonical(original)
            assert provenance['priorFieldEvidence'] == original['fields']['pp_points']
            assert provenance['sourceRowSHA256'] == canonical(source)
            for field in ('sourceCaptureAtUTC', 'observedAtUTC', 'nativeEvidence', 'originalPublicationUTC'):
                assert provenance[field] == proof[field]
            for flag in ('sourceValuesChanged', 'sourceFreshnessEstablished', 'sourceRevisionEstablished',
                         'currentRecommendationQualified', 'scoringAdmission', 'wholeProfileQualification'):
                assert provenance[flag] is False
            reverted = deepcopy(row)
            reverted.pop('laterPPPEvidence')
            reverted['fields']['pp_points'] = original['fields']['pp_points']
            reverted['tracks']['fantasyPoints'] = original['tracks']['fantasyPoints']
            assert reverted == original
    assert changed_rows == candidate_ids
    assert set(changed_fields) == {(sid, 'pp_points') for sid in candidate_ids}

    def window_rows(profile, index):
        selected_rows = [index[sid] for sid in profile['sourceIds']]
        supported = [r for r in selected_rows if r['exposureState'] == 'matched' and
                     r['tracks']['fantasyPoints']['identityExposureFinalityMatched'] and
                     all(r['fields'][f]['state'] == 'matched' for f in fields)]
        return selected_rows, supported

    before_windows, after_windows, promoted, deltas = [], [], [], []
    for original, profile, ctx in zip(old_profiles, profiles, context['profiles']):
        assert profile['playerId'] == original['playerId'] == ctx['playerId']
        assert profile['sourceIds'] == original['sourceIds'] == ctx['sourceIds']
        assert profile['dates'] == [raw[sid]['date'] for sid in profile['sourceIds']] == ctx['dates']
        assert all(raw[sid]['player_id'] == profile['playerId'] for sid in profile['sourceIds'])
        assert profile['fullProfileQualified'] is False and profile['productionAdopted'] is False
        assert profile['combinedScore'] is None and profile['buySellLabel'] is None
        assert profile['baselineComparison'] is None and profile['confidenceProbability'] is None
        assert profile['captureFreshness'] == original['captureFreshness']
        for p, index in ((original, old_by), (profile, new_by)):
            all_rows, supported = window_rows(p, index)
            track = p['tracks']['fantasyPoints']
            assert track['matchedSelectedRecords'] == len(supported)
            assert track['allSelectedCountsAndExposureMatched'] == (len(supported) == len(all_rows))
            assert track['unresolvedBySourceId'] == {str(r['sourceId']): [f for f in fields if r['fields'][f]['state'] == 'unknown']
                   for r in all_rows if any(r['fields'][f]['state'] == 'unknown' for f in fields)}
            assert track['differencesBySourceId'] == {str(r['sourceId']): [f for f in fields if r['fields'][f]['state'] == 'different']
                   for r in all_rows if any(r['fields'][f]['state'] == 'different' for f in fields)}
            assert track['exposureHeldSourceIds'] == [r['sourceId'] for r in all_rows if r['exposureState'] != 'matched']
            assert track['methodCounts'] == dict(Counter(r['fields']['pp_points'].get('method', 'unresolved') for r in all_rows))
        old_supported = original['tracks']['fantasyPoints']['allSelectedCountsAndExposureMatched']
        new_supported = profile['tracks']['fantasyPoints']['allSelectedCountsAndExposureMatched']
        if old_supported:
            before_windows.append(profile['playerId'])
            assert new_supported
        if new_supported:
            after_windows.append(profile['playerId'])
        if new_supported and not old_supported:
            promoted.append(profile['playerId'])
        for track in ('fantasyPoints', 'rawPoints'):
            assert profile['tracks'][track]['capturedMetric'] == original['tracks'][track]['capturedMetric'] == next(
                m for m in ctx['metrics'] if m['key'] == track)
        assert profile['capturedGameScore'] == next(m for m in ctx['metrics'] if m['key'] == 'wigoGameScore')
        if profile != original:
            deltas.append(dict(playerId=profile['playerId'], sourceIds=profile['sourceIds'],
                               composedSourceIds=sorted(set(profile['sourceIds']) & candidate_ids),
                               beforeSupported=old_supported, afterSupported=new_supported,
                               beforeMatchedRows=original['tracks']['fantasyPoints']['matchedSelectedRecords'],
                               afterMatchedRows=profile['tracks']['fantasyPoints']['matchedSelectedRecords'],
                               capturedMetricsChanged=False, fullProfileQualified=False))
            reverted = deepcopy(profile)
            reverted['tracks']['fantasyPoints'] = original['tracks']['fantasyPoints']
            assert reverted == original
    assert (len(before_windows), len(after_windows), len(promoted), len(deltas)) == (482, 507, 25, 44)
    annotations_path = BASE / 'older-ppp-observation-contract-20261101-01/candidate-01/ANNOTATIONS.json'
    assert (OUT / 'OLDER-ANNOTATIONS.json').read_bytes() == annotations_path.read_bytes()
    assert (OUT / 'COMPARISONS.json').read_bytes() == (BASE / 'current-ppp-direct-comparison-20261102-01/COMPARISONS.json').read_bytes()
    annotations = load(OUT / 'OLDER-ANNOTATIONS.json')
    older_ids = {a['sourceId'] for a in annotations if a['state'] == 'older_observation_agrees'}
    assert len(annotations) == 207 and len(older_ids) == 150
    assert not (older_ids & changed_rows)
    assert all(new_by[sid] == old_by[sid] and new_by[sid]['fields']['pp_points']['state'] == 'unknown' for sid in older_ids)
    unknown_before = sum(r['fields']['pp_points']['state'] == 'unknown' for r in old_rows)
    unknown_after = sum(r['fields']['pp_points']['state'] == 'unknown' for r in rows)
    rows_before = sum(all(r['fields'][f]['state'] == 'matched' for f in fields) and
                      r['tracks']['fantasyPoints']['identityExposureFinalityMatched'] for r in old_rows)
    rows_after = sum(all(r['fields'][f]['state'] == 'matched' for f in fields) and
                     r['tracks']['fantasyPoints']['identityExposureFinalityMatched'] for r in rows)
    assert (unknown_before, unknown_after, rows_before, rows_after) == (212, 168, 3140, 3184)
    assert summary['FPCountExposureWindows'] == len(after_windows)
    assert summary['FPCountExposureRows'] == rows_after and summary['unresolvedPPP'] == unknown_after
    assert summary['sourceCaptureFreshnessAtComposition'] == 'stale'
    assert (time(summary['composedAtUTC']) - time(capture)).total_seconds() > 24 * 3600
    metrics = lambda pp: [{k: p[k] for k in ('playerId', 'sourceIds', 'selectedRecords', 'appearances', 'seconds',
                                           'shots', 'capturedGameScore')} |
                          {'capturedMetrics': {t: p['tracks'][t]['capturedMetric'] for t in ('fantasyPoints', 'rawPoints')}}
                         for p in pp]
    assert canonical(metrics(old_profiles)) == canonical(metrics(profiles))
    result = dict(state='PASS_SEPARATE_RECOUNT_NOT_INDEPENDENT_REVIEW', checkedInputFiles=len(bindings),
                  selectedRows=3461, selectedProfiles=740, changedRows=len(changed_rows),
                  changedFields=len(changed_fields), changedProfiles=len(deltas),
                  before=dict(unresolvedPPP=unknown_before, FPCountExposureRows=rows_before, FPCountExposureWindows=len(before_windows)),
                  after=dict(unresolvedPPP=unknown_after, FPCountExposureRows=rows_after, FPCountExposureWindows=len(after_windows)),
                  delta=dict(unresolvedPPP=unknown_after-unknown_before, FPCountExposureRows=rows_after-rows_before,
                             FPCountExposureWindows=len(after_windows)-len(before_windows)),
                  newlySupportedPlayerIds=promoted, lostSupportedWindows=0, heldRowsUnchanged=len(held_ids),
                  olderAgreementsUnchanged=len(older_ids), olderAnnotationBytesUnchanged=True,
                  allSourceCountHashesUnchanged=True, allCapturedMetricsSHA256=canonical(metrics(profiles)),
                  selectedSourceRowsSHA256=canonical([raw[sid] for sid in selected]),
                  changedSourceIds=sorted(changed_rows), sourceValuesChanged=False, scoringAdmission=False,
                  fullProfileQualified=False, wholeProfileQualification=False,
                  networkRequests=0, databaseCalls=0, scoresComputed=0, holdoutReads=0)
    (ROOT / 'RECOUNT.json').write_text(json.dumps(result, indent=2) + '\n')
    (ROOT / 'PROFILE-DELTAS.json').write_text(json.dumps(deltas, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
