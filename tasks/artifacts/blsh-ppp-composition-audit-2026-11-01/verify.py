"""Independent local audit. Producer main functions are never invoked."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
from collections import Counter
from copy import deepcopy
from datetime import datetime
import hashlib, importlib, json, os, re, unittest
from bs4 import BeautifulSoup

OUT = Path(__file__).resolve().parent
BASE = Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
C = BASE / 'ppp-sidecar-composition-20261101-01'
A = BASE / 'assist-credit-consistency-20261101-01'
P = BASE / 'ppp-event-attribution-20261101-01'
S = BASE / 'production-track-evidence-20261101-01'
PREV = OUT.parent / 'blsh-ppp-event-audit-2026-11-01'
load = lambda p: json.loads(Path(p).read_text())
stamp = datetime.fromisoformat
pins = {}
def pin(path, expected=None):
    path = Path(path)
    value = hashlib.sha256(path.read_bytes()).hexdigest()
    assert expected is None or value == expected, f'pin drift: {path}'
    assert str(path) not in pins or pins[str(path)] == value
    pins[str(path)] = value
    return value
def pin_map(values):
    for path, expected in values.items(): pin(path, expected)
def no_network(event, args):
    if event in ('socket.connect', 'socket.bind', 'socket.getaddrinfo'):
        raise RuntimeError('Independent audit forbids network')
sys.addaudithook(no_network)
lock = Path('/private/tmp/fhfh-heavy.lock')
owner = {'owner': 'codex-blsh-ppp-composition-independent-audit', 'pid': os.getpid()}
lock.mkdir()
(lock / 'owner.json').write_text(json.dumps(owner))
try:
    for root in (C, A):
        final = load(root / 'FINAL-RECEIPT.json')
        pin(root / 'FINAL-RECEIPT.json')
        pin_map(final['files']); pin_map(final['sharedSourcePins'])
    pin(PREV / 'REVIEW.md', 'a8ef7a429163e907567e727cc1bb570c07c79b3d16365f0aee8631d6933757b7')
    pin(PREV / 'PINS.json', 'b0221825ecdc616d35efca249eeeb0d79acc94c2bb7cfd71b0fa257598dca173')
    pin_map(load(PREV / 'PINS.json'))
    pin_map(load(C / 'ACCEPTANCE-BINDINGS.json'))
    pin_map(load(C / 'RUN-PINS.json'))
    for name in ('INPUT-PINS.json', 'SUPPLEMENTARY-PINS.json', 'FACEOFF-INPUT-PINS.json', 'RUN-PINS.json', 'FACEOFF-RUN-PINS.json'):
        pin_map(load(A / name))
    sidecar_final = load(S / 'FINAL-RECEIPT.json')
    pin_map(sidecar_final['files']); pin_map(sidecar_final['sharedSourcePins'])

    # Focused producer regression tests, in a network-denied process.
    sys.path[:0] = [str(C), str(A)]
    suite = unittest.TestSuite()
    for name in ('test_compose', 'test_compare', 'test_faceoffs'):
        module = importlib.import_module(name)
        suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(module))
    with (OUT / 'TESTS.log').open('w') as stream:
        result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    assert result.wasSuccessful() and result.testsRun == 20

    capture = load(BASE / 'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json')
    sources = {r['id']: r for r in capture['wgo']['rows']}
    assert len(sources) == len(capture['wgo']['rows']) == 8135
    captured_at = capture['wgo']['capture']['retrievedAtUTC']
    contexts = load(BASE / 'current-refresh-reader-20261101-01/production-context-02/CONTEXTS.json')['profiles']
    selected = [sid for p in contexts for sid in p['sourceIds']]
    assert len(selected) == len(set(selected)) == 3461
    original = load(S / 'sidecar-01/ROW-TRACK-EVIDENCE.json')
    old = {r['sourceId']: r for r in original}
    old_profiles = load(S / 'sidecar-01/PROFILE-TRACK-EVIDENCE.json')
    rows = load(C / 'candidate-01/ROWS.json')
    current = {r['sourceId']: r for r in rows}
    profiles = load(C / 'candidate-01/PROFILES.json')
    summary = load(C / 'candidate-01/SUMMARY.json')
    proofs = load(P / 'qualification-01/ROWS.json')
    proof_map = {r['sourceId']: r for r in proofs}
    assert len(proofs) == len(proof_map) == 200
    assert len(rows) == len(current) == len(old) == 3461 and set(current) == set(old) == set(selected)
    assert [r['sourceId'] for r in rows] == [r['sourceId'] for r in original]
    changed, held, new_fp, remaining_differences = [], [], [], []
    decisions = []
    method = 'official_PP_event_credit_full_roster_reconciled'
    for sid, before in old.items():
        expected = deepcopy(before)
        p = proof_map.get(sid)
        if p and p['state'] == 'matched':
            src = sources[sid]
            assert (src['player_id'], src['game_id'], src['date'], src['team_abbrev']) == (p['playerId'], p['gameId'], p['date'], p['team'])
            assert src['counts']['pp_points'] == p['capturedPPP'] == p['eventPPP']
            assert p['sourceCaptureAtUTC'] == captured_at
            assert stamp(captured_at) < stamp(p['evidenceAvailableAtUTC']) < stamp(summary['atUTC'])
            assert p['originalPublicationUTC'] is None
            expected['fields']['pp_points'] = {'state': 'matched', 'method': method, 'official': p['eventPPP']}
            track = expected['tracks']['fantasyPoints']
            track['unknownFields'].remove('pp_points')
            track['allSelectedOperandsMatched'] = not track['unknownFields'] and not track['differentFields']
            track['corroboratedForThisRow'] = track['allSelectedOperandsMatched'] and track['identityExposureFinalityMatched']
            expected['additionalPPPEvidence'] = {
                'priorFieldEvidence': before['fields']['pp_points'], 'eventEvidenceSourceId': sid,
                'evidenceAvailableAtUTC': p['evidenceAvailableAtUTC'], 'originalPublicationUTC': None,
                'acceptedReviewSHA256': pins[str(PREV / 'REVIEW.md')], 'sourceCaptureAtUTC': captured_at,
                'rawCountsUnchanged': True, 'weakGFAAndGameScoreHoldsUnchanged': True}
            changed.append(sid)
            if track['corroboratedForThisRow']: new_fp.append(sid)
            else: remaining_differences.append({'sourceId': sid, 'fields': track['differentFields']})
        elif p:
            assert p['state'] == 'held' and p['eventPPP'] is None
            held.append(sid)
        assert expected == current[sid], sid
        assert current[sid]['fullProfileQualified'] is False and current[sid]['scoringAdmission'] is False
    for p in proofs:
        decisions.append({'sourceId': p['sourceId'], 'state': 'field_evidence_composed' if p['state'] == 'matched' else 'held_unchanged', 'reason': p['reason']})
    assert decisions == load(C / 'candidate-01/DECISIONS.json')
    assert len(changed) == 195 and len(held) == 5 and len(new_fp) == 190 and len(remaining_differences) == 5
    assert set(held) == {5598688, 5599832, 5600780, 5600805, 5600831}
    assert sum(r['fields']['pp_points']['state'] == 'unknown' for r in rows) == summary['unresolvedPPP'] == 212
    assert sum(r['tracks']['fantasyPoints']['corroboratedForThisRow'] for r in rows) == summary['FPCountExposureRows'] == 3140
    assert dict(Counter(r['fields']['pp_points'].get('method', 'unresolved') for r in rows)) == summary['PPPmethods']
    assert len(profiles) == len(old_profiles) == len(contexts) == 740
    assert len({p['playerId'] for p in profiles}) == 740
    new_windows = []
    for p, before, context in zip(profiles, old_profiles, contexts):
        assert p['playerId'] == before['playerId'] == context['playerId']
        # Everything other than the FP evidence and elapsed capture age must be byte-value identical.
        for k in set(p) | set(before):
            if k not in ('tracks', 'captureFreshness'): assert p[k] == before[k], (p['playerId'], k)
        assert p['tracks']['rawPoints'] == before['tracks']['rawPoints']
        fp = p['tracks']['fantasyPoints']
        assert fp['capturedMetric'] == before['tracks']['fantasyPoints']['capturedMetric'] == next(m for m in context['metrics'] if m['key'] == 'fantasyPoints')
        members = [current[sid] for sid in p['sourceIds']]
        flags = [r['tracks']['fantasyPoints'] for r in members]
        assert fp['matchedSelectedRecords'] == sum(t['corroboratedForThisRow'] for t in flags)
        assert fp['allSelectedCountsAndExposureMatched'] == all(t['corroboratedForThisRow'] for t in flags)
        assert fp['selectedRecords'] == len(members) == context['selectedRecords']
        assert fp['unresolvedBySourceId'] == {str(r['sourceId']): r['tracks']['fantasyPoints']['unknownFields'] for r in members if r['tracks']['fantasyPoints']['unknownFields']}
        assert fp['differencesBySourceId'] == {str(r['sourceId']): r['tracks']['fantasyPoints']['differentFields'] for r in members if r['tracks']['fantasyPoints']['differentFields']}
        assert fp['exposureHeldSourceIds'] == [r['sourceId'] for r in members if not r['tracks']['fantasyPoints']['identityExposureFinalityMatched']]
        assert fp['methodCounts'] == dict(Counter(r['fields']['pp_points'].get('method', 'unresolved') for r in members))
        freshness = p['captureFreshness']
        age = (stamp(summary['atUTC']) - stamp(captured_at)).total_seconds() / 3600
        assert freshness == {'state': 'fresh' if age <= capture['freshnessPolicy']['maxCaptureAgeHours'] else 'stale', 'ageHours': age, 'capturedAtUTC': captured_at, 'asOfUTC': summary['atUTC'], 'appliesOnlyToInputCapture': True}
        if fp['allSelectedCountsAndExposureMatched'] and not before['tracks']['fantasyPoints']['allSelectedCountsAndExposureMatched']: new_windows.append(p['playerId'])
        for key in ('combinedScore', 'buySellLabel', 'baselineComparison', 'confidenceProbability'): assert p[key] is None
        assert p['supportQualification'] == 'NST_native_definition_gate_unresolved'
    assert sum(p['tracks']['fantasyPoints']['allSelectedCountsAndExposureMatched'] for p in old_profiles) == 379
    assert sum(p['tracks']['fantasyPoints']['allSelectedCountsAndExposureMatched'] for p in profiles) == summary['FPCountExposureWindows'] == 482
    assert len(new_windows) == 103 and sum(p['shots'] == 0 for p in profiles) == 20

    # Independently parse native HTML; do not reuse either producer's event/parser functions.
    plan = load(A / 'PLAN.json'); face_plan = load(A / 'FACEOFF-PLAN.json')
    assert plan['games'] == face_plan['games'] and len(plan['games']) == 30
    prior_games = {g['gameId']: g for g in load(P / 'qualification-01/GAMES.json')}
    refs = {g['gameId']: g['evidence'] for g in load(P / 'PLAN.json')['games']}
    assert {g['gameId'] for g in plan['games']} == {gid for gid, g in prior_games.items() if g['state'] == 'reconciled'}
    assist_rows = load(A / 'comparison-01/ROWS.json'); face_rows = load(A / 'faceoff-comparison-01/ROWS.json')
    assist = {(r['playerId'], r['gameId']): r for r in assist_rows}
    face = {(r['playerId'], r['gameId']): r for r in face_rows}
    faces_by_game = {g['gameId']: g for g in load(A / 'faceoff-comparison-01/GAMES.json')}
    by_identity = {(r['player_id'], r['game_id']): r for r in sources.values()}
    assert len(by_identity) == len(sources)
    assert len(assist) == len(assist_rows) == len(face) == len(face_rows) == 1080 and set(assist) == set(face)
    stats = Counter(); strengths = Counter(); exposure_held = []; differences = []; games = []
    discrepancy_players = {}; head_to_head = []
    for g in plan['games']:
        gid = g['gameId']; evidence = refs[gid]
        box = load(evidence['box']['bodyPath'])
        raw = Path(evidence['playByPlay']['bodyPath']).read_bytes()
        assert box['season'] == 20262027 and box['gameType'] == 2 and box['gameState'] in ('OFF', 'FINAL')
        assert (box['id'], box['gameDate']) == (gid, g['date'])
        lookup, players = {}, {}
        for side in ('awayTeam', 'homeTeam'):
            for group in ('forwards', 'defense'):
                for player in box['playerByGameStats'][side][group]:
                    team = box[side]['abbrev']; key = (team, player['sweaterNumber']); pid = player['playerId']
                    assert key not in lookup and pid not in players
                    lookup[key] = pid; players[pid] = (team, player)
        assert len(players) == 36
        counts = {pid: Counter() for pid in players}; face_events = []; goals = []
        ledger = []
        for tr in BeautifulSoup(raw, 'html.parser').find_all('tr'):
            cells = tr.find_all('td', recursive=False)
            if len(cells) == 8:
                v = [c.get_text(' ', strip=True) for c in cells]
                if v[0].isdigit(): ledger.append(v)
        assert [int(v[0]) for v in ledger] == list(range(1, len(ledger) + 1))
        assert sum(v[4] == 'GEND' for v in ledger) == 1
        for v in ledger:
            period = int(v[1]); desc = v[5]
            if v[4] == 'GOAL' and period <= 4:
                assert v[2] in ('EV', 'PP', 'SH')
                team = desc.split(' ', 1)[0]
                actors = list(re.finditer(r'#(\d{1,2})\s+([^#;()]+)\((\d+)\)', desc))
                assert 1 <= len(actors) <= 3 and len(actors) == desc.count('#')
                marker = re.search(r'\bAssists?:', desc)
                assert bool(marker) == (len(actors) > 1)
                if marker: assert desc[marker.end():].strip() == '; '.join(a.group(0) for a in actors[1:])
                ids = [lookup[team, int(actor[1])] for actor in actors]
                assert len(ids) == len(set(ids))
                for position, pid in enumerate(ids[1:]): counts[pid]['primary' if position == 0 else 'secondary'] += 1
                counts[ids[0]]['goals'] += 1
                if v[2] == 'PP': counts[ids[0]]['PPG'] += 1
                strengths[v[2]] += 1
                goals.append({'eventNumber': int(v[0]), 'period': period, 'strength': v[2], 'team': team, 'scorerId': ids[0], 'assistIds': ids[1:], 'description': desc})
            if v[4] != 'FAC': continue
            assert 1 <= period <= 4 and v[2] in ('EV', 'PP', 'SH')
            winner_text, pair = desc.split(' - ', 1)
            winner, zone = winner_text.split(' won ', 1)
            assert zone in ('Neu. Zone', 'Off. Zone', 'Def. Zone')
            actors = pair.split(' vs '); assert len(actors) == 2
            identities = []
            for actor in actors:
                team, number, name = actor.split(' ', 2)
                assert number.startswith('#') and number[1:].isdigit() and name
                identities.append((team, lookup[team, int(number[1:])]))
            assert identities[0][0] != identities[1][0]
            win = [pid for team, pid in identities if team == winner]
            lose = [pid for team, pid in identities if team != winner]
            assert len(win) == len(lose) == 1
            counts[win[0]]['wins'] += 1; counts[lose[0]]['losses'] += 1
            face_events.append({'eventNumber': int(v[0]), 'period': period, 'strength': v[2], 'winnerId': win[0], 'loserId': lose[0], 'description': desc})
            if gid == 2026020199 and {win[0], lose[0]} == {8477989, 8479400}: head_to_head.append(int(v[0]))
        assert goals == prior_games[gid]['events']
        assert faces_by_game[gid] == {'gameId': gid, 'date': g['date'], 'state': 'evaluated', 'reason': None, 'events': face_events}
        assert sum(c['wins'] for c in counts.values()) == sum(c['losses'] for c in counts.values()) == len(face_events)
        for pid, (team, player) in players.items():
            src = by_identity[pid, gid]; ar = assist[pid, gid]; fr = face[pid, gid]; c = counts[pid]
            assert src['id'] in selected and (src['season_id'], src['date'], src['team_abbrev']) == (20262027, g['date'], team)
            assert ar['sourceIds'] == [src['id']] and fr['sourceId'] == src['id']
            assert ar['team'] == fr['team'] == team and ar['date'] == fr['date'] == g['date']
            assert ar['firstCreditCount'] == c['primary'] and ar['secondCreditCount'] == c['secondary']
            assert ar['sourceCounts'] == {'primary': src['counts']['total_primary_assists'], 'secondary': src['counts']['total_secondary_assists'], 'totalAssists': src['counts']['assists']}
            assert src['counts']['total_primary_assists'] == c['primary'] and src['counts']['total_secondary_assists'] == c['secondary']
            assert c['primary'] + c['secondary'] == src['counts']['assists'] == player['assists']
            assert c['goals'] == player['goals'] and c['PPG'] == player['powerPlayGoals']
            informative = c['primary'] != c['secondary']
            assert ar['firstOrderMatches'] is True and ar['reversedOrderMatches'] == (not informative)
            assert ar['orderInformative'] == informative and ar['storedAssistSumConsistent'] is True
            assert ar['state'] == ('first_order_only' if informative else 'both_orders_match')
            minutes, seconds = map(int, player['toi'].split(':')); official_seconds = minutes * 60 + seconds
            exposure = src['games_played'] == 1 and src['toi_per_game'] == official_seconds > 0
            assert ar['sourceSeconds'] == src['toi_per_game'] and ar['officialSeconds'] == official_seconds
            assert ar['exposureState'] == fr['exposureState'] == ('matched' if exposure else 'held')
            if not exposure: exposure_held.append(src['id'])
            different = False
            for field, key in (('total_fow', 'wins'), ('total_fol', 'losses')):
                val = src['counts'][field]; count = c[key]
                assert type(val) is int and val >= 0
                assert fr['fields'][field] == {'state': 'matched' if val == count else 'different', 'captured': val, 'events': count}
                different |= val != count
            if different:
                differences.append(src['id']); discrepancy_players[src['id']] = {'wins': c['wins'], 'losses': c['losses'], 'boxFraction': player['faceoffWinningPctg']}
                assert round(c['wins'] / (c['wins'] + c['losses']), 6) == player['faceoffWinningPctg']
            assert ar['sourceShots'] == fr['sourceShots'] == src['counts']['shots']
            assert ar['scoringAdmission'] is False and fr['scoringAdmission'] is False and fr['otherHoldsUnchanged'] is True
            stats['records'] += 1; stats['informative'] += informative
            stats['nonzeroAssist'] += c['primary'] + c['secondary'] > 0
            stats['zeroShots'] += src['counts']['shots'] == 0
            stats['faceoffParticipants'] += c['wins'] + c['losses'] > 0
        stats['faceoffEvents'] += len(face_events)
        games.append({'gameId': gid, 'goalEvents': len(goals), 'faceoffEvents': len(face_events), 'records': len(players)})
        print(json.dumps({'gameId': gid, 'independentAssistFaceoffRecount': 'passed'}), flush=True)
    assert dict(stats) == {'records': 1080, 'informative': 249, 'nonzeroAssist': 269, 'zeroShots': 324, 'faceoffParticipants': 406, 'faceoffEvents': 1719}
    assert dict(strengths) == {'EV': 152, 'PP': 51, 'SH': 2}
    assert set(exposure_held) == {5598839, 5598688, 5599762, 5599858, 5599832, 5599965}
    assert set(differences) == {5599478, 5599416}
    assert head_to_head == [5, 20, 38, 112, 222, 239, 252]
    assert next(g['faceoffEvents'] for g in games if g['gameId'] == 2026020199) == 52
    cross = load(A / 'FACEOFF-INDEPENDENT-CROSSCHECK.json')
    for r in cross['rows']:
        independent = discrepancy_players[r['sourceId']]
        assert (r['eventWins'], r['eventLosses'], r['officialBoxDisplayedWinFraction']) == (independent['wins'], independent['losses'], independent['boxFraction'])
        assert r['canonicalRepair'] is False
    # Recheck every examined input at exit; no write to inputs is tolerated.
    for path, value in list(pins.items()): pin(path, value)
    verification = {'status': 'passed', 'focusedTests': result.testsRun, 'authenticatedFiles': len(pins),
        'composition': {'records': 3461, 'profiles': 740, 'PPPProofsComposed': len(changed), 'heldProofs': held, 'unresolvedPPP': 212, 'newCorroboratedFPRows': len(new_fp), 'corroboratedFPRows': 3140, 'FPWindowsBefore': 379, 'FPWindowsAfter': 482, 'newFPWindows': len(new_windows), 'otherDifferencesPreserved': remaining_differences, 'zeroShotWindows': 20, 'allOriginalMetricsAndNonPPPFieldsUnchanged': True},
        'assistFaceoff': {**dict(stats), 'goalStrengths': dict(strengths), 'exposureHeldSourceIds': exposure_held, 'faceoffDifferentSourceIds': differences, 'discrepancyIndependentCounts': discrepancy_players, 'headToHeadEvents': head_to_head, 'games': games},
        'limits': ['evidence-only composition; previous full sidecar acceptance not implied', 'assist credit agreement is observational, not normative definition evidence', 'later evidence; original publication/provider revision unknown', 'source/profile/scoring admission remains closed'],
        'productionRequests': 0, 'providerRequests': 0, 'databaseCalls': 0, 'producerMainCalls': 0, 'sourceEdits': 0, 'holdoutAccess': 0}
    (OUT / 'PINS.json').write_text(json.dumps(pins, indent=2) + '\n')
    (OUT / 'VERIFICATION.json').write_text(json.dumps(verification, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'tests': result.testsRun, 'pins': len(pins), 'FPWindows': 482, 'assistFaceoffRows': 1080}), flush=True)
finally:
    assert load(lock / 'owner.json') == owner
    lock.rename(OUT / 'RELEASED-LOCK')
