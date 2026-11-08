"""Independent receipt/copy/window reconciliation. No score or provider operation."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
from collections import Counter
from copy import deepcopy
from datetime import datetime
from urllib.parse import urlparse, parse_qs
import hashlib
import importlib.util
import json
import os

OUT = Path(__file__).resolve().parent
BASE = Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
PACKET = BASE / 'isolated-component-admission-20261101-01'
PREP = BASE / 'component-admission-preparation-20261101-01'
EVENT = BASE / 'official-event-evidence-20261101-01'
FIELDS = ('es_goals_for', 'pp_goals_for', 'sh_goals_for', 'es_goals_against', 'pp_goals_against', 'sh_goals_against')
GS = ('goals', 'total_primary_assists', 'total_secondary_assists', 'shots', 'blocked_shots', 'penalties_drawn', 'penalties', 'total_fow', 'total_fol', 'sat_for', 'sat_against') + FIELDS
read = lambda p: json.loads(Path(p).read_text())
sha = lambda b: hashlib.sha256(b).hexdigest()
digest = lambda x: sha(json.dumps(x, sort_keys=True, separators=(',', ':'), allow_nan=False).encode())
stamp = lambda t: datetime.fromisoformat(t.replace('Z', '+00:00'))
pins = {}
def pin(path, expected):
    path = Path(path); raw = path.read_bytes(); assert sha(raw) == expected, str(path)
    pins[str(path)] = expected; return raw
def deny_network(event, args):
    if event in ('socket.connect', 'socket.bind', 'socket.getaddrinfo'): raise RuntimeError('Audit forbids network: ' + event)
sys.addaudithook(deny_network)
lock = Path('/private/tmp/fhfh-heavy.lock'); owner = {'owner': 'codex-blsh-component-independent-reconciliation', 'pid': os.getpid()}
lock.mkdir(); (lock / 'owner.json').write_text(json.dumps(owner))
try:
    final = read(PACKET / 'FINAL-RECEIPT.json')
    pin(PACKET / 'FINAL-RECEIPT.json', sha((PACKET / 'FINAL-RECEIPT.json').read_bytes()))
    for group in ('files', 'sharedSourcePins'):
        for path, expected in final[group].items(): pin(path, expected)
    for path, expected in read(PACKET / 'RUN-PINS-02.json').items(): pin(path, expected)
    accepted = read(OUT.parent / 'blsh-event-evidence-audit-2026-11-01/PINS.json')
    authority = dict(accepted); manifest_chain = []
    for path in [BASE / 'fresh-box-qualification-20261101-01/FINAL-RECEIPT.json', BASE / 'fresh-source-qualification-20261101-01/FINAL-RECEIPT.json']:
        manifest = json.loads(pin(path, authority[str(path)]))
        added = 0
        for child, expected in manifest['files'].items():
            assert child not in authority or authority[child] == expected
            added += child not in authority; authority[child] = expected
        manifest_chain.append({'manifest': str(path), 'sha256': authority[str(path)], 'newChildPins': added})
    event_sha = '1dad73c32ba0d83649bfd94efefccb976011f0e311a266a47efa0541226378b3'
    pin(EVENT / 'FINAL-RECEIPT.json', event_sha)
    assert authority[str(EVENT / 'FINAL-RECEIPT.json')] == event_sha
    prep_final = read(PREP / 'FINAL-RECEIPT.json')
    for path, expected in prep_final['files'].items(): pin(path, expected)
    refs = read(PREP / 'prepared-01/EVIDENCE-GRAPH.json')
    accepted_refs = json.loads(pin(EVENT / 'qualification-01/EVIDENCE.json', authority[str(EVENT / 'qualification-01/EVIDENCE.json')]))
    assert refs == accepted_refs
    accepted_rows = json.loads(pin(EVENT / 'qualification-01/ROWS.json', authority[str(EVENT / 'qualification-01/ROWS.json')]))
    accepted_by_id = {r['sourceId']: r for r in accepted_rows}
    candidates = read(PREP / 'prepared-01/CANDIDATES.json'); candidate_by_id = {c['sourceId']: c for c in candidates}
    assert len(candidates) == len(candidate_by_id) == len(accepted_rows) == len(accepted_by_id) == 280
    assert set(candidate_by_id) == set(accepted_by_id)
    current_path = BASE / 'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json'
    capture = read(current_path); sources = {r['id']: r for r in capture['wgo']['rows']}
    assert len(sources) == len(capture['wgo']['rows']) == 8135
    assert len({(r['player_id'], r['game_id']) for r in sources.values()}) == 8135
    trial = read(PACKET / 'verification-and-trial-01/ISOLATED-TRIAL.json')
    proofs = read(PACKET / 'verification-and-trial-01/NATIVE-RECEIPT-VERIFICATION.json')
    summary = read(PACKET / 'verification-and-trial-01/SUMMARY.json')
    assert len(refs) == len(proofs) == 38 and set(refs) == set(proofs)
    page_cache, games = {}, {}
    for key, ref in refs.items():
        gid = int(key); proof = proofs[key]; bmeta = ref['box']; pmeta = ref['playByPlay']; vmeta = ref['derivedReportView']
        assert ref['notANativeSingleGameReportReceipt'] is True and vmeta['notANativeHTTPResponse'] is True
        boxraw = pin(bmeta['bodyPath'], authority[bmeta['bodyPath']]); box = json.loads(boxraw)
        br = json.loads(pin(bmeta['receiptPath'], authority[bmeta['receiptPath']]))
        pbpraw = pin(pmeta['bodyPath'], authority[pmeta['bodyPath']])
        pr = json.loads(pin(pmeta['receiptPath'], authority[pmeta['receiptPath']]))
        for body, receipt, url in [(boxraw, br, f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'), (pbpraw, pr, f'https://www.nhl.com/scores/htmlreports/20262027/PL{gid % 1000000:06d}.HTM')]:
            assert receipt['url'] == url and receipt['status'] == 'success' and receipt['httpStatus'] == 200 and receipt['TLSVerified'] is True
            assert receipt['sha256'] == sha(body) and receipt['bytes'] == len(body)
        assert (box['id'], box['season'], box['gameType']) == (gid, 20262027, 2) and box['gameState'] in ('OFF', 'FINAL')
        assert pr['scopeAndFinalLedgerChecked'] is True
        dates = {c['date'] for c in candidates if c['gameId'] == gid}; assert dates == {box['gameDate']}; day = box['gameDate']
        times = [br['retrievedAtUTC'], pr['retrievedAtUTC']]; all_native = []; starts = set(); pages = []; weak = False
        for page in vmeta['sourceCaptures']:
            path = page['bodyPath']; body = pin(path, authority[path]); assert sha(body) == page['bodySHA256']
            data = json.loads(body); u = urlparse(page['url']); q = parse_qs(u.query, keep_blank_values=True)
            assert (u.scheme, u.netloc, u.path, u.fragment) == ('https', 'api.nhle.com', '/stats/rest/en/skater/goalsForAgainst', '')
            assert set(q) == {'isAggregate', 'isGame', 'sort', 'start', 'limit', 'factCayenneExp', 'cayenneExp'} and all(len(v) == 1 for v in q.values())
            q = {k: v[0] for k, v in q.items()}
            assert q['isAggregate'] == 'false' and q['isGame'] == 'true' and q['factCayenneExp'] == 'gamesPlayed>=1'
            assert q['cayenneExp'] == f'seasonId=20262027 and gameDate>="{day}" and gameDate<="{day} 23:59:59" and gameTypeId=2'
            assert json.loads(q['sort']) == [{'property':'playerId','direction':'ASC'}, {'property':'gameId','direction':'ASC'}]
            start = int(q['start']); assert start >= 0 and start % 100 == 0 and start not in starts; starts.add(start)
            recovered = page['transportEvidence'] == 'recovered_from_dispatch_body_and_controlled_code_path'
            assert q['limit'] == ('500' if recovered else '100')
            assert len(data['data']) == min(100, data['total'] - start) > 0
            keys = [(r['playerId'], r['gameId']) for r in data['data']]
            assert len(keys) == len(set(keys)) and keys == sorted(keys)
            assert all(r['gameDate'] == day and r['gamesPlayed'] == 1 and r['gameId'] // 10000 == 202602 for r in data['data'])
            all_native.extend(data['data'])
            if recovered:
                weak = True; assert start == 0 and day == '2026-10-27'
                interval = page['captureIntervalUTC']; assert stamp(interval[0]) <= stamp(interval[1]); times.append(interval[1]); receipt_path = None
            else:
                assert page['transportEvidence'] == 'retained_verified_receipt'
                receipt_path = path.replace('.body.json', '.receipt.json'); rr = json.loads(pin(receipt_path, authority[receipt_path]))
                assert rr['url'] == page['url'] and rr['state'] == 'verified' and rr['httpStatus'] == 200 and rr['TLSVerified'] is True
                assert rr['bytes'] == len(body) and rr['sha256'] == sha(body) and rr['atUTC'] == page['capturedAtUTC']; times.append(rr['atUTC'])
            pages.append({'url':page['url'], 'bodyPath':path, 'bodySHA256':page['bodySHA256'], 'receiptPath':receipt_path, 'transportWitness':page['transportEvidence']})
            page_cache[path] = {'date':day, 'start':start, 'total':data['total'], 'data':data['data'], 'weak':recovered}
        native_rows = [r for r in all_native if r['gameId'] == gid]; native = {r['playerId']:r for r in native_rows}
        assert len(native_rows) == len(native) == 36
        view = json.loads(pin(vmeta['path'], authority[vmeta['path']]))
        assert view['total'] == len(view['data']) == 36 and {r['playerId']:r for r in view['data']} == native
        roster = {}; ids = []
        for side in ['awayTeam', 'homeTeam']:
            for group in ['forwards', 'defense']:
                for p in box['playerByGameStats'][side][group]:
                    ids.append(p['playerId']); m, s = map(int, p['toi'].split(':')); assert m >= 0 and 0 <= s < 60
                    if m*60+s > 0: roster[str(p['playerId'])] = {'team':box[side]['abbrev'], 'seconds':m*60+s}
        assert len(ids) == len(set(ids)) and set(map(int,roster)) == set(native)
        assert all(native[int(pid)]['teamAbbrev'] == r['team'] for pid,r in roster.items())
        expected = {'gameId':gid, 'state':'weaker_report_witness' if weak else 'complete_native_transport_and_projection_checked', 'availableAtUTC':max(times,key=stamp), 'oldestEvidenceAtUTC':min(times,key=stamp), 'roster':roster, 'nativePages':pages, 'localProjectionSHA256':vmeta['sha256'], 'acceptedEventPacketSHA256':event_sha}
        assert proof == expected
        assert stamp(capture['asOfUTC']) < min(map(stamp,times)) <= max(map(stamp,times)) < stamp(trial['asOfUTC'])
        games[key] = {'weak':weak, 'date':day, 'roster':roster}
    # Verify full date-page coverage too, not just the projected games.
    for day in sorted({p['date'] for p in page_cache.values()}):
        pages = sorted([p for p in page_cache.values() if p['date']==day],key=lambda p:p['start'])
        assert len({p['total'] for p in pages}) == 1
        assert [p['start'] for p in pages] == list(range(0,pages[0]['total'],100))
        keys = [(r['playerId'],r['gameId']) for p in pages for r in p['data']]
        assert len(keys) == len(set(keys)) == pages[0]['total'] and keys == sorted(keys)
    decisions = {d['sourceId']:d for d in trial['decisions']}; copies = {c['sourceId']:c for c in trial['copies']}
    assert len(trial['decisions']) == len(decisions) == 280 and set(decisions) == set(candidate_by_id)
    assert len(trial['copies']) == len(copies) == 163
    states, reasons, dates = Counter(), Counter(), Counter(); expected_copies = {}; all_original_nulls = 0
    for sid, c in candidate_by_id.items():
        a = accepted_by_id[sid]; original = sources[sid]; d = decisions[sid]; proof = proofs[str(c['gameId'])]
        assert c['rawSourceRow'] == original and c['rawSourceRowSHA256'] == digest(original)
        assert (c['sourceId'],c['playerId'],c['playerName'],c['gameId'],c['date'],c['team']) == (a['sourceId'],a['playerId'],a['playerName'],a['gameId'],a['date'],a['team'])
        assert (c['sourceId'],c['playerId'],c['playerName'],c['gameId'],c['date'],c['team']) == (original['id'],original['player_id'],original['player_name'],original['game_id'],original['date'],original['team_abbrev'])
        assert original['counts'] == a['originalCounts'] and c['candidateValues'] == a['derivedComponents']
        assert all(original['counts'][f] is None for f in FIELDS); all_original_nulls += 6
        assert all(c[k] is False for k in ['admitted','scoreComputed','compatibleWithCurrentInputV1'])
        expected_d = {'sourceId':sid,'state':'withheld','reason':None,'applicationAdmission':False,'scoreComputed':False}
        if c['state'] == 'held':
            assert sid == 5599858 and c['candidateValues'] is None and original['toi_per_game'] == 445
            assert proof['roster'][str(c['playerId'])]['seconds'] == 444
            expected_d['reason'] = 'prior_identity_exposure_or_finality_held'
        elif games[str(c['gameId'])]['weak']:
            assert c['containsRecoveredFirstPageWitness'] is True
            expected_d['reason'] = 'weaker_report_witness_retained'
        else:
            assert c['containsRecoveredFirstPageWitness'] is False and c['state'] == 'candidate_for_review'
            assert c['candidateValues'] == dict.fromkeys(FIELDS,0)
            assert original['games_played'] == 1 and original['toi_per_game'] == proof['roster'][str(c['playerId'])]['seconds'] > 0
            assert original['team_abbrev'] == proof['roster'][str(c['playerId'])]['team']
            assert stamp(c['availableAtUTC']) == stamp(proof['availableAtUTC']) <= stamp(c['asOfUTC']) <= stamp(trial['asOfUTC'])
            assert c['sourceCapturedAtUTC'] == capture['asOfUTC'] and c['originalPublicationUTC'] is None
            after = deepcopy(original); after['counts'].update(c['candidateValues'])
            expected_d.update(state='composed_for_offline_review', beforeSHA256=digest(original), afterSHA256=digest(after), evidenceKey=str(c['gameId']), availableAtUTC=proof['availableAtUTC'], oldestEvidenceAtUTC=proof['oldestEvidenceAtUTC'])
            expected_copy = {'sourceId':sid,'original':original,'researchCopy':after,'evidenceKey':str(c['gameId']),'originalCaptureHashDoesNotDescribeResearchCopy':True}
            assert copies[sid] == expected_copy and digest(after) != digest(original)
            expected_copies[sid] = after; dates[c['date']] += 1
        assert d == expected_d
        states[d['state']] += 1
        if d['reason']: reasons[d['reason']] += 1; assert sid not in copies
    assert set(copies) == set(expected_copies)
    assert states == {'withheld':117,'composed_for_offline_review':163}
    assert reasons == {'weaker_report_witness_retained':116,'prior_identity_exposure_or_finality_held':1}
    assert all_original_nulls == 1680
    assert trial['version'] == 'fhfh.blsh.isolated-component-trial.v1'
    assert all(trial[k] is False for k in ['applicationAdmission','productionAdopted','scoreComputed']) and trial['canonicalWrites'] == 0
    assert trial['rawCaptureReference'] == {'path':str(current_path),'sha256':sha(current_path.read_bytes()),'captureMetadata':capture['wgo']['capture'],'eventThroughDate':capture['eventThroughDate']}
    assert capture['eventThroughDate'] == '2026-10-31' and capture['asOfUTC'] == '2026-11-01T19:57:38.026058+00:00'
    coverage = read(PACKET / 'WINDOW-OPERAND-COVERAGE.json')
    contexts_path = BASE / 'current-refresh-reader-20261101-01/production-context-02/CONTEXTS.json'
    contexts = json.loads(pin(contexts_path,'7336bfc30cc56ce18c28af5527e4072baaeaeb99f63f3f32321185e194b29325'))['profiles']
    by_player = {p['playerId']:p for p in contexts}; windows = {p['playerId']:p for p in coverage['profiles']}
    assert len(contexts) == len(by_player) == len(coverage['profiles']) == len(windows) == 740 and set(windows) == set(by_player)
    complete = lambda r: all(r['counts'].get(f) is not None for f in GS)
    counts = Counter(); selected = []; improved = []; changed_but_incomplete = []
    for pid, context in by_player.items():
        ids = context['sourceIds']; selected.extend(ids); p = windows[pid]
        assert p['sourceIds'] == ids and p['selectedRecords'] == len(ids) and p['name'] == context['name']
        assert all(sources[sid]['player_id'] == pid for sid in ids)
        raw_complete = all(complete(sources[sid]) for sid in ids)
        remaining = [sid for sid in ids if not complete(expected_copies.get(sid,sources[sid]))]
        changed = sum(sid in expected_copies for sid in ids)
        zero = all(sources[sid]['counts']['shots'] == 0 for sid in ids)
        assert p['rawAll17OperandsPresent'] == raw_complete and p['trialAll17OperandsPresent'] == (not remaining)
        assert p['remainingIncompleteSourceIds'] == remaining and p['trialChangedRecords'] == changed
        assert p['withheldReasons'] == dict(Counter(decisions[sid]['reason'] for sid in remaining))
        assert p['zeroShotWindow'] == zero and p['scoreComputed'] is False and p['profileQualified'] is False and p['sourceDiscrepanciesNotCleared'] is True
        counts['rawComplete'] += raw_complete; counts['trialComplete'] += not remaining; counts['zeroShot'] += zero
        if not raw_complete and not remaining: improved.append(pid)
        if changed and remaining: changed_but_incomplete.append(pid)
    assert len(selected) == len(set(selected)) == 3461 and set(copies) <= set(selected)
    assert counts == {'rawComplete':512,'trialComplete':624,'zeroShot':20} and len(improved) == 112
    assert coverage['summary']['remainingIncompleteWindows'] == 740-counts['trialComplete'] == 116
    assert summary['researchTrialCopies'] == 163 and summary['trialComponentCells'] == 978
    # Exercise the actual pure composition entrypoint, without running main or writing packet outputs.
    spec = importlib.util.spec_from_file_location('reviewed_admission', PACKET/'admission.py')
    adapter = importlib.util.module_from_spec(spec); spec.loader.exec_module(adapter)
    fresh = adapter.compose(capture['wgo']['rows'],candidates,proofs,trial['asOfUTC'],event_sha)
    assert fresh == {k:v for k,v in trial.items() if k!='rawCaptureReference'}
    repeat_sources = [expected_copies.get(r['id'],r) for r in capture['wgo']['rows']]
    again = adapter.compose(repeat_sources,candidates,proofs,trial['asOfUTC'],event_sha)
    assert Counter(d['state'] for d in again['decisions']) == {'withheld':117,'already_satisfied_in_trial':163}
    assert again['copies'] == trial['copies']
    for path, expected in pins.items(): assert sha(Path(path).read_bytes()) == expected
    report = {'pass':True,'pinsVerifiedAndUnchanged':len(pins),'manifestChain':manifest_chain,'reportPages':len(page_cache),'strongReportPages':sum(not p['weak'] for p in page_cache.values()),'weakReportPages':sum(p['weak'] for p in page_cache.values()),
        'games':len(games),'strongGames':sum(not g['weak'] for g in games.values()),'weakGames':sum(g['weak'] for g in games.values()),'states':dict(states),'withheldReasons':dict(reasons),'copies':len(copies),'changedCells':978,'acceptedByDate':dict(dates),'originalNullsPreserved':all_original_nulls,
        'profiles':len(windows),'selectedRecords':len(selected),'windowCounts':dict(counts),'newlyOperandCompleteWindows':len(improved),'changedButStillIncompleteWindows':len(changed_but_incomplete),'remainingIncompleteWindows':116,'allFullRowsPreservedExceptSixCopyFields':True,'pureEntrypointMatchesArtifact':True,'realDataRepeatIdempotent':True,
        'originalSourceAsOfUTC':capture['asOfUTC'],'eventThroughDate':capture['eventThroughDate'],'trialAsOfUTC':trial['asOfUTC'],'networkDenied':True,'scoreComputation':False,'productionAdmission':False}
    (OUT/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n'); (OUT/'VERIFICATION.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report))
finally:
    assert json.loads((lock/'owner.json').read_text()) == owner
    lock.rename(OUT/'verification-lock-released')
