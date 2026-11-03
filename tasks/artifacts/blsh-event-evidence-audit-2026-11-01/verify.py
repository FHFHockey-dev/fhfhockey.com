"""Independent retained-body recount. Does not import the qualification engine."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
from collections import Counter
from datetime import datetime, date
import csv
import hashlib
import json
import os
import re
from bs4 import BeautifulSoup

OUT = Path(__file__).resolve().parent
BASE = Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
PACKET = BASE / 'official-event-evidence-20261101-01'
PREPARED = BASE / 'nst-lineage-and-gs-alternatives-20261101-01/prepared-event-scope-01'
FIELDS = ['es_goals_for', 'pp_goals_for', 'sh_goals_for', 'es_goals_against', 'pp_goals_against', 'sh_goals_against']
KEYS = ['evenStrengthGoalsFor', 'powerPlayGoalFor', 'shortHandedGoalsFor', 'evenStrengthGoalsAgainst', 'powerPlayGoalsAgainst', 'shortHandedGoalsAgainst']
read = lambda p: json.loads(Path(p).read_text())
sha = lambda b: hashlib.sha256(b).hexdigest()
stamp = lambda t: datetime.fromisoformat(t.replace('Z', '+00:00'))
pins = {}

def pin(path, expected):
    path = Path(path)
    raw = path.read_bytes()
    assert sha(raw) == expected, str(path)
    pins[str(path)] = expected
    return raw

def deny_network(event, args):
    if event in ('socket.connect', 'socket.bind', 'socket.getaddrinfo'):
        raise RuntimeError('Audit prohibits network: ' + event)

sys.addaudithook(deny_network)
lock = Path('/private/tmp/fhfh-heavy.lock')
owner = {'owner': 'codex-blsh-event-audit-recount', 'pid': os.getpid()}
lock.mkdir()
(lock / 'owner.json').write_text(json.dumps(owner))
try:
    final = read(PACKET / 'FINAL-RECEIPT.json')
    pin(PACKET / 'FINAL-RECEIPT.json', sha((PACKET / 'FINAL-RECEIPT.json').read_bytes()))
    for group in ('files', 'sharedSourcePins'):
        for path, digest in final[group].items():
            pin(path, digest)
    for name in ('INPUT-PINS.json', 'RUN-PINS.json'):
        for path, digest in read(PACKET / name).items():
            pin(path, digest)
    plan = read(PREPARED / 'PROPOSED-READ-PLAN.json')
    prepared = read(PREPARED / 'PREPARED-GAMES.json')
    assert len(prepared) == len(plan['requests']) == 38
    assert len({g['gameId'] for g in prepared}) == 38
    assert {r['gameId']: r['url'] for r in plan['requests']} == {g['gameId']: g['missingPlayByPlayURL'] for g in prepared}
    prior_pins = read(OUT.parent / 'blsh-nst-gs-audit-2026-11-01/PINS.json')
    partial_path = BASE / 'nst-lineage-and-gs-alternatives-20261101-01/goal-absence-01/ROWS.json'
    partial = {r['sourceId']: r for r in json.loads(pin(partial_path, prior_pins[str(partial_path)]))}
    current_path = BASE / 'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json'
    current = json.loads(pin(current_path, 'c6d1d13dc7327baa54742c3eb7efe0a1e5d96c6ef6ffefc66de23f4092c12ba2'))
    source_rows = {r['id']: r for r in current['wgo']['rows']}
    targets = {r['sourceId']: r for r in read(BASE / 'fresh-source-qualification-20261101-01/MISSING-ROWS.json')}
    prior = {r['sourceId']: r for r in read(BASE / 'fresh-box-qualification-20261101-01/qualification-01/ROW-QUALIFICATION.json')}
    rows = read(PACKET / 'qualification-01/ROWS.json')
    by_id = {r['sourceId']: r for r in rows}
    game_results = {g['gameId']: g for g in read(PACKET / 'qualification-01/GAMES.json')}
    references = read(PACKET / 'qualification-01/EVIDENCE.json')
    result = read(PACKET / 'collection-01/RESULT.json')
    assert len(rows) == len(by_id) == len(targets) == 280 and set(by_id) == set(targets)
    tally = Counter()
    totals_by_date = Counter()
    dispatches, completion_times, bytes_per_body, games, shootouts, held = [], [], [], [], [], []
    for g in prepared:
        gid = g['gameId']
        url = f'https://www.nhl.com/scores/htmlreports/20262027/PL{gid % 1000000:06d}.HTM'
        body_path = PACKET / f'collection-01/{gid}.body.html'
        raw = body_path.read_bytes()
        receipt_path = PACKET / f'collection-01/{gid}.receipt.json'
        receipt = read(receipt_path)
        transport = read(PACKET / f'collection-01/{gid}.transport.json')
        dispatch = read(PACKET / f'collection-01/{gid}.dispatch.json')
        assert url == g['missingPlayByPlayURL'] == receipt['url'] == transport['url'] == dispatch['url']
        assert dispatch['state'] == 'dispatch_started_no_retry'
        assert receipt['status'] == 'success' and transport['status'] == 'transport_complete_validation_pending'
        assert all(receipt[k] == v for k, v in transport.items() if k != 'status')
        assert receipt['httpStatus'] == 200 and receipt['TLSVerified'] is True
        assert receipt['CA_SHA256'] == result['CA_SHA256'] == '94edeb66e91774fcae93a05650914e29096259a5c7e871a1f65d461ab5201b47'
        assert receipt['bytes'] == len(raw) and receipt['sha256'] == sha(raw)
        assert receipt['attributionQualified'] is False and receipt['scopeAndFinalLedgerChecked'] is True
        assert 'text/html' in receipt['headers']['Content-Type'].lower()
        assert receipt['headers']['Content-Encoding'] in (None, 'identity')
        length = receipt['headers']['Content-Length']
        assert length is None or int(length) == len(raw)
        dispatches.append(stamp(dispatch['atUTC'])); completion_times.append(stamp(receipt['retrievedAtUTC']))
        assert 0 <= (completion_times[-1] - dispatches[-1]).total_seconds() <= plan['bounds']['timeoutSecondsEach']
        bytes_per_body.append(len(raw))
        assert len(raw) <= plan['bounds']['maxBodyBytesEach']
        e = g['boxEvidence']
        box = json.loads(pin(e['bodyPath'], e['bodySHA256']))
        br = json.loads(pin(e['receiptPath'], e['receiptSHA256']))
        assert br['status'] == 'success' and br['httpStatus'] == 200 and br['TLSVerified'] is True
        assert br['url'] == e['url'] == f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'
        assert br['sha256'] == e['bodySHA256'] and br['bytes'] == Path(e['bodyPath']).stat().st_size
        assert (box['id'], box['season'], box['gameType'], box['gameDate']) == (gid, 20262027, 2, g['date'])
        assert box['gameState'] in ('OFF', 'FINAL')
        view_meta = g['derivedReportView']
        view = json.loads(pin(view_meta['path'], view_meta['sha256']))
        native_rows, report_times = {}, []
        for capture in view_meta['sourceCaptures']:
            page = json.loads(pin(capture['bodyPath'], capture['bodySHA256']))
            for r in page['data']:
                if r['gameId'] == gid:
                    assert r['playerId'] not in native_rows
                    native_rows[r['playerId']] = r
            report_times.append(stamp(capture.get('capturedAtUTC') or capture['captureIntervalUTC'][1]))
        assert view_meta['notANativeHTTPResponse'] is True
        assert view['total'] == len(view['data']) == len(native_rows) == 36
        assert {r['playerId']: r for r in view['data']} == native_rows
        reference = references[str(gid)]
        assert reference['notANativeSingleGameReportReceipt'] is True and reference['derivedReportView'] == view_meta
        assert reference['playByPlay'] == {'bodyPath': str(body_path), 'receiptPath': str(receipt_path), 'receiptSHA256': sha(receipt_path.read_bytes()), **receipt}
        assert reference['box']['bodySHA256'] == e['bodySHA256'] and reference['box']['receiptSHA256'] == e['receiptSHA256']
        numbers, skaters, player_goals, counts = {}, {}, Counter(), {}
        for side in ('awayTeam', 'homeTeam'):
            team = box[side]['abbrev']
            for category in ('forwards', 'defense', 'goalies'):
                for player in box['playerByGameStats'][side][category]:
                    key = (team, player['sweaterNumber'])
                    assert key not in numbers
                    numbers[key] = (player, category == 'goalies')
                    if category != 'goalies':
                        pid = player['playerId']; assert pid not in skaters
                        skaters[pid] = (player, team)
                        counts[pid] = dict.fromkeys(FIELDS, 0)
                        player_goals[pid] = player['goals']
        played = {pid for pid, (p, _) in skaters.items() if p['toi'] not in ('00:00', '0:00')}
        assert played == set(native_rows)
        soup = BeautifulSoup(raw, 'html.parser')
        assert soup.title.get_text(strip=True) == 'Play By Play'
        header = soup.get_text(' ', strip=True)[:1000]
        assert 'Final' in header and f'Game {gid % 10000:04d}' in header
        assert date.fromisoformat(g['date']).strftime('%B %-d, %Y') in header
        events, headers = [], []
        for tr in soup.find_all('tr'):
            cells = tr.find_all('td', recursive=False)
            if len(cells) != 8: continue
            values = [c.get_text(' ', strip=True) for c in cells]
            if values[0] == '#': headers.append(values)
            if values[0].isdigit(): events.append((cells, values))
        assert headers and all(h[6:] == [box['awayTeam']['abbrev'] + ' On Ice', box['homeTeam']['abbrev'] + ' On Ice'] for h in headers)
        assert [int(v[0]) for _, v in events] == list(range(1, len(events) + 1))
        assert len(events) == receipt['eventCount']
        endings = [i for i, (_, v) in enumerate(events) if v[4] == 'GEND']
        assert len(endings) == 1
        end = events[endings[0]][1]
        assert all(v[4] == 'GOFF' or (v[4] == 'PEND' and v[1] == end[1] and v[3] == end[3] and v[5].startswith('Period End-')) for _, v in events[endings[0] + 1:])
        goal_totals, scorers, special = Counter(), Counter(), Counter()
        for cells, v in events:
            if v[4] == 'DELPEN' or re.search('delayed penalty', v[5], re.I): special['delayedPenaltyEvents'] += 1
            if v[4] != 'GOAL': continue
            period = int(v[1])
            if period == 5:
                assert box['gameOutcome']['lastPeriodType'] == 'SO'
                special['shootoutGoalEventsExcluded'] += 1
                continue
            assert 1 <= period <= 4 and v[2] in ('EV', 'PP', 'SH')
            assert 'Penalty Shot' not in v[5]
            match = re.match(r'^([A-Z]{2,3})\s+#(\d+)', v[5]); assert match is not None
            scoring_team, scoring_number = match[1], int(match[2])
            scorer, is_goalie = numbers[scoring_team, scoring_number]
            assert not is_goalie
            scorers[scorer['playerId']] += 1; goal_totals[scoring_team] += 1; special['goalCount'] += 1
            for col, side in ((6, 'awayTeam'), (7, 'homeTeam')):
                team = box[side]['abbrev']; tags = cells[col].find_all(attrs={'title': True})
                assert 4 <= len(tags) <= 6
                jerseys = [int(t.get_text(strip=True)) for t in tags]
                assert len(jerseys) == len(set(jerseys))
                goalie_count = 0
                for tag, jersey in zip(tags, jerseys):
                    p, goalie = numbers[team, jersey]
                    pos = tag['title'].split(' - ')[0]
                    assert pos in ('Center', 'Left Wing', 'Right Wing', 'Defense', 'Goalie')
                    assert (pos == 'Goalie') == goalie
                    goalie_count += goalie
                    if not goalie:
                        field = {'EV': 'es', 'PP': 'pp', 'SH': 'sh'}[v[2]] + '_goals_' + ('for' if team == scoring_team else 'against')
                        counts[p['playerId']][field] += 1
                assert goalie_count <= 1
                special['goalieAbsentAtGoalSides'] += goalie_count == 0
                if team == scoring_team: assert scoring_number in jerseys
        assert scorers == player_goals
        scores = {box[side]['abbrev']: box[side]['score'] for side in ('awayTeam', 'homeTeam')}
        if box.get('gameOutcome', {}).get('lastPeriodType') == 'SO':
            assert len(set(goal_totals.get(team, 0) for team in scores)) == 1
            winner = max(scores, key=scores.get)
            assert all(scores[team] - goal_totals[team] == int(team == winner) for team in scores)
            shootouts.append(gid)
        else:
            assert dict(goal_totals) == {k: v for k, v in scores.items() if v}
        control_rows = 0
        for pid, native in native_rows.items():
            assert (native['gameId'], native['gameDate'], native['teamAbbrev']) == (gid, g['date'], skaters[pid][1])
            known = [native[k] for k in KEYS]
            assert all(x is None for x in known) or all(type(x) is int and x >= 0 for x in known)
            if all(x is None for x in known): tally['nativeNullCells'] += 6
            else:
                assert known == [counts[pid][f] for f in FIELDS], (gid, pid, known, counts[pid])
                control_rows += 1
                tally['controlNonzeroCells'] += sum(x != 0 for x in known)
                tally['controlZeroCells'] += sum(x == 0 for x in known)
        assert control_rows > 0 or not special['goalCount']
        selected = [r for r in rows if r['gameId'] == gid]
        assert sorted(r['sourceId'] for r in selected) == sorted(g['sourceIds'])
        available = max(completion_times[-1], stamp(br['retrievedAtUTC']), *report_times)
        for r in selected:
            sid, pid = r['sourceId'], r['playerId']; target = targets[sid]; earlier = prior[sid]; source = source_rows[sid]
            assert (pid, gid, r['date'], r['team']) == (source['player_id'], source['game_id'], source['date'], source['team_abbrev']) == (target['playerId'], target['gameId'], target['date'], target['team'])
            assert r['originalCounts'] == target['sourceCounts'] == source['counts']
            assert all(r['originalCounts'][f] is None for f in FIELDS)
            assert all(native_rows[pid][k] is None for k in KEYS)
            assert r['sourceCapturedAtUTC'] == target['capturedAtUTC'] == current['asOfUTC']
            assert stamp(r['evidenceAvailableAtUTC']) == available > stamp(r['sourceCapturedAtUTC'])
            assert r['originalPublicationUTC'] is None and r['availableAtEarlierSourceCapture'] is False
            assert r['containsRecoveredFirstPageWitness'] == g['containsRecoveredFirstPageWitness']
            assert r['evidenceKey'] == str(gid)
            assert all(r[k] is False for k in ('scoreComputed', 'admittedToScoring', 'canonicalRepairAuthorized'))
            p, team = skaters[pid]; mins, secs = map(int, p['toi'].split(':')); official_toi = 60 * mins + secs
            assert team == r['team'] and official_toi > 0 and 0 <= secs < 60
            assert earlier['TOI']['wgo'] == source['toi_per_game'] and earlier['TOI']['official'] == official_toi
            assert counts[pid] == dict.fromkeys(FIELDS, 0)
            if source['toi_per_game'] != official_toi:
                assert sid == 5599858 and source['toi_per_game'] == 445 and official_toi == 444
                assert r['derivedComponents'] is None and r['state'] == 'unavailable' and r['reason'] == 'prior_identity_exposure_or_finality_held'
                held.append({'sourceId': sid, 'playerId': pid, 'gameId': gid, 'sourceTOI': source['toi_per_game'], 'officialTOI': official_toi})
            else:
                assert earlier['state'] == 'identity_team_exposure_qualified' and earlier['gameFinality'] == 'final'
                assert r['state'] == 'component_evidence_supported' and r['reason'] is None
                assert r['derivedComponents'] == counts[pid] and r['independentRecount'] == 'all_six_match'
                tally['supportedRows'] += 1; totals_by_date[r['date']] += 1
                for field, value in partial[sid]['derivedComponents'].items():
                    if value is not None:
                        assert r['derivedComponents'][field] == value
                        tally['previousPartialComponentsMatched'] += 1
        gr = game_results[gid]
        assert gr['state'] == 'evaluated' and gr['rows'] == selected and gr['recountGoalCount'] == special['goalCount']
        assert gr['special']['completeOfficialControls'] == control_rows
        assert gr['special']['penaltyShotGoals'] == 0 and gr['special']['consistentAttributionAlternatives'] == 1
        for key in ('goalCount', 'goalieAbsentAtGoalSides', 'delayedPenaltyEvents'): assert gr['special'][key] == special[key]
        tally.update(special); tally['controlRows'] += control_rows
        games.append({'gameId': gid, 'eventCount': len(events), 'controlRows': control_rows, 'targetRows': len(selected), **special})
        print(json.dumps({'gameId': gid, 'independentRecount': 'passed'}), flush=True)
    assert tally['supportedRows'] == 279 and len(held) == 1
    assert tally['goalCount'] == 244 and tally['goalieAbsentAtGoalSides'] == 24 and tally['delayedPenaltyEvents'] == 76
    assert tally['controlRows'] == 1088 and tally['controlZeroCells'] == 4771 and tally['controlNonzeroCells'] == 1757 and tally['nativeNullCells'] == 1680
    assert tally['previousPartialComponentsMatched'] == 174
    assert shootouts == [2026020192, 2026020219]
    assert sum(g['containsRecoveredFirstPageWitness'] for g in prepared) == 11
    assert sum(bytes_per_body) == result['bytes'] == 46313371 <= plan['bounds']['maxTotalBodyBytes']
    assert max(bytes_per_body) == 1382886
    assert len(list((PACKET / 'collection-01').glob('*.dispatch.json'))) == len(list((PACKET / 'collection-01').glob('*.body.html'))) == len(list((PACKET / 'collection-01').glob('*.receipt.json'))) == len(list((PACKET / 'collection-01').glob('*.transport.json'))) == 38
    intervals = [(b - a).total_seconds() for a, b in zip(dispatches, dispatches[1:])]
    assert min(intervals) >= plan['bounds']['secondsBetweenStarts']
    assert all(a < b for a, b in zip(completion_times, dispatches[1:]))
    assert (stamp(result['finishedAtUTC']) - dispatches[0]).total_seconds() <= plan['bounds']['maxElapsedSeconds']
    exported = list(csv.DictReader((PACKET / 'qualification-01/COMPONENT-EVIDENCE.csv').open()))
    assert len(exported) == 280 and {int(r['sourceId']) for r in exported} == set(by_id)
    for r in exported:
        original = by_id[int(r['sourceId'])]
        assert r['state'] == original['state'] and r['reason'] == (original['reason'] or '')
        assert [r[f] for f in FIELDS] == (['0'] * 6 if original['derivedComponents'] is not None else [''] * 6)
    for path, digest in pins.items(): assert sha(Path(path).read_bytes()) == digest
    report = {'pass': True, 'pinsVerifiedAndUnchanged': len(pins), 'networkDenied': True, 'sourceImports': False,
              'verifiedReceipts': 38, 'totalBodyBytes': sum(bytes_per_body), 'largestBodyBytes': max(bytes_per_body),
              'minimumDispatchSpacingSeconds': min(intervals), 'maximumTransportSeconds': max((b-a).total_seconds() for a,b in zip(dispatches, completion_times)),
              'firstDispatchUTC': dispatches[0].isoformat(), 'lastBodyCapturedUTC': completion_times[-1].isoformat(),
              'componentCellsSupported': 6*tally['supportedRows'], 'originalNullsPreserved': 1680, 'byDate': dict(totals_by_date),
              'tallies': dict(tally), 'shootoutGames': shootouts, 'held': held, 'weakWitnessGames': 11, 'CSVMatchesJSON': True,
              'GameScoresComputed': 0, 'sourceRepairs': 0, 'games': games}
    (OUT / 'VERIFICATION.json').write_text(json.dumps(report, indent=2) + '\n')
    (OUT / 'PINS.json').write_text(json.dumps(pins, indent=2) + '\n')
    print(json.dumps({k:v for k,v in report.items() if k != 'games'}))
finally:
    assert read(lock / 'owner.json') == owner
    lock.rename(OUT / 'recount-lock-released')
