import sys
sys.dont_write_bytecode=True
from pathlib import Path
from collections import Counter
from datetime import datetime
from decimal import Decimal
from copy import deepcopy
from urllib.parse import urlsplit,parse_qs
from email.utils import parsedate_to_datetime
import csv,hashlib,json,socket,unittest
ROOT=Path(__file__).resolve().parent
BASE=Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
SOURCE=BASE/'current-ppp-direct-comparison-20261102-01'
sys.path.insert(0,str(SOURCE))
import test_compare
from compare import compare
def deny(*args,**kwargs):raise AssertionError('Independent audit forbids network')
socket.socket.connect=deny;socket.socket.connect_ex=deny;socket.create_connection=deny;socket.getaddrinfo=deny
load=lambda p:json.loads(Path(p).read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
stamp=lambda s:datetime.fromisoformat(s.replace('Z','+00:00'))
pins=load(ROOT/'PINS.json')
def verify_pins():
    for p,h in pins.items():assert sha(Path(p).read_bytes())==h,p
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'codex-blsh-current-PPP-direct-independent-audit'}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
try:
    verify_pins()
    with (ROOT/'TESTS.log').open('w') as f:tests=unittest.TextTestRunner(stream=f,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(test_compare))
    assert tests.wasSuccessful()
    plan=load(SOURCE/'READ-PLAN.json');planhash=sha((SOURCE/'READ-PLAN.json').read_bytes())
    assert planhash==(SOURCE/'READ-PLAN.sha256').read_text().strip()=='c3787e47c674a84609081f999a28c7f3970f01e0799366f1aedb1e0932a650a0'
    assert sha(Path(plan['CAFile']).read_bytes())==plan['CA_SHA256'];frozen=stamp(plan['frozenUTC'])
    request=load(BASE/'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json')
    raw={r['id']:r for r in request['wgo']['rows']}
    sidecar={r['sourceId']:r for r in load(BASE/'ppp-sidecar-composition-20261101-01/candidate-01/ROWS.json')}
    older={r['sourceId']:r for r in load(BASE/'older-ppp-observation-contract-20261101-01/candidate-01/ANNOTATIONS.json')}
    combined={r['sourceId']:r for r in load(BASE/'fresh-box-qualification-20261101-01/qualification-01/COMBINED-ROW-EVIDENCE.json')}
    context=load(BASE/'current-refresh-reader-20261101-01/production-context-02/CONTEXTS.json')
    selected=[sid for p in context['profiles'] for sid in p['sourceIds']]
    assert len(selected)==len(set(selected))==len(sidecar)==len(combined)==3461 and len(context['profiles'])==740
    assert set(selected)==set(sidecar)==set(combined)
    unresolved={sid for sid,r in sidecar.items() if r['fields']['pp_points']['state']!='matched'}
    oldagree={sid for sid,r in older.items() if r['state']=='older_observation_agrees'}
    assert len(unresolved)==212 and len(oldagree)==150 and oldagree<=unresolved
    targets=load(SOURCE/'TARGETS.json');assert len(targets)==len({t['sourceId'] for t in targets})==62
    assert {t['sourceId'] for t in targets}==unresolved-oldagree
    retained=[t for t in targets if t['retainedSummary']];fresh=[t for t in targets if not t['retainedSummary']]
    assert len(retained)==16 and len(fresh)==46 and [t['sourceId'] for t in fresh]==plan['newSourceIds']
    assert len({t['gameId'] for t in fresh})==12
    outputs=load(SOURCE/'COMPARISONS.json');out_by={o['sourceId']:o for o in outputs}
    assert len(outputs)==len(out_by)==62 and set(out_by)=={t['sourceId'] for t in targets}
    with (SOURCE/'COMPARISONS.csv').open() as f:csv_rows=list(csv.DictReader(f))
    csv_by={int(r['sourceId']):r for r in csv_rows};assert len(csv_rows)==len(csv_by)==62 and set(csv_by)==set(out_by)
    prior_plan=load(BASE/'source-vintage-20261101-01/EVIDENCE-PLAN.json')
    fresh_entries={r['sourceId']:r for r in plan['requests']};assert len(fresh_entries)==46
    body_metadata={};native_rows={};held=[];candidate_ids=[];zero_shots=[];summary_counts=Counter();native_field_differences=[]
    for t in targets:
        sid=t['sourceId'];r=raw[sid];out=out_by[sid]
        assert t['sourceRow']==r and sha(json.dumps(r,sort_keys=True,separators=(',',':')).encode())==t['sourceRowSHA256']
        assert (r['id'],r['player_id'],r['game_id'],r['date'],r['team_abbrev'])==(sid,t['playerId'],t['gameId'],t['date'],t['team'])
        assert r['season_id']==20262027 and '2026-10-08'<=r['date']<='2026-10-31' and r['games_played']==1
        assert t['sourceCaptureAtUTC']==request['asOfUTC']==request['wgo']['capture']['retrievedAtUTC']
        assert t['priorSidecar']==sidecar[sid] and t['priorCombined']==combined[sid] and t['priorOlderObservation']==older.get(sid)
        for prior in [sidecar[sid],combined[sid]]:assert (prior['sourceId'],prior['playerId'],prior['gameId'],prior['date'])==(sid,t['playerId'],t['gameId'],t['date'])
        assert combined[sid]['boxQualification']['TOI']['wgo']==r['toi_per_game']
        for k in ['goals','assists','shots','hits','blocked_shots']:assert combined[sid]['boxQualification']['counts'][k]['wgo']==r['counts'][k]
        ev=out['nativeEvidence'];bp=Path(ev['bodyPath']);rp=Path(ev['receiptPath']);body=bp.read_bytes();rec=load(rp)
        assert sha(body)==ev['bodySHA256']==rec['sha256'] and sha(rp.read_bytes())==ev['receiptSHA256'] and len(body)==rec['bytes']
        assert rec['url']==ev['url'] and rec['TLSVerified'] is True and rec['httpStatus']==200 and rec['CA_SHA256']==plan['CA_SHA256']
        assert 'application/json' in rec['headers']['Content-Type'].lower()
        reused=t['retainedSummary'] is not None;limit=100 if reused else 2
        parsed=urlsplit(ev['url']);q=parse_qs(parsed.query)
        assert parsed.scheme=='https' and parsed.netloc=='api.nhle.com' and parsed.path=='/stats/rest/en/skater/summary' and not parsed.fragment
        cay=f"gameId={t['gameId']} and gameTypeId=2"+('' if reused else f" and playerId={t['playerId']}")
        assert q=={'isAggregate':['false'],'isGame':['true'],'start':['0'],'limit':[str(limit)],'sort':['[{"property":"playerId","direction":"ASC"}]'],'factCayenneExp':['gamesPlayed>=1'],'cayenneExp':[cay]}
        if reused:
            assert ev==t['retainedSummary'] and rec['state']=='verified'
            dispatch=load(ev['dispatchPath']);assert sha(Path(ev['dispatchPath']).read_bytes())==ev['dispatchSHA256']
            assert rec['item']==dispatch['item'] and rec['item'] in prior_plan and rec['item']==dict(gameId=t['gameId'],date=t['date'],kind='summary',url=ev['url'])
            observed=rec['at'];dispatch_at=dispatch['at'];origin='retained_November_1_report'
            assert stamp(observed)<stamp(t['sourceCaptureAtUTC'])
        else:
            folder=SOURCE/'live-01'/str(sid);dispatch=load(folder/'DISPATCH.json')
            assert rec['url']==dispatch['url']==fresh_entries[sid]['url'] and dispatch['sourceId']==sid and dispatch['planSHA256']==planhash
            observed=rec['atUTC'];dispatch_at=dispatch['atUTC'];origin='new_exact_player_report'
            assert frozen<stamp(dispatch_at)<=stamp(observed) and len(body)<=plan['bounds']['perResponseBytes'] and rec['sourcePublicationUTC'] is None
            assert load(folder/'FIELD-COMPARISON.json')==out
        assert 0<=(stamp(observed)-stamp(dispatch_at)).total_seconds()<=10
        assert abs((stamp(observed)-parsedate_to_datetime(rec['headers']['Date'])).total_seconds())<2
        payload=json.loads(body,parse_float=Decimal);rows=payload['data']
        assert type(payload['total']) is int and payload['total']==len(rows) and 0<len(rows)<limit
        assert len({v['playerId'] for v in rows})==len(rows)
        for v in rows:
            assert type(v['playerId']) is int and type(v['gameId']) is int and type(v['gamesPlayed']) is int
            assert (v['gameId'],v['gameDate'],v['gamesPlayed'])==(t['gameId'],t['date'],1)
        assert len(rows)==(36 if reused else 1)
        values=[v for v in rows if v['playerId']==t['playerId']];assert len(values)==1;v=values[0];assert v['teamAbbrev']==t['team']
        for k in ['ppPoints','ppGoals','goals','assists','points','evPoints','shPoints','evGoals','shGoals','shots']:assert type(v[k]) is int and v[k]>=0
        assert v['points']==v['goals']+v['assists']==v['evPoints']+v['ppPoints']+v['shPoints']
        assert v['goals']==v['evGoals']+v['ppGoals']+v['shGoals']
        for s in ['ev','pp','sh']:assert v[s+'Goals']<=v[s+'Points']
        assert v['ppPoints']==r['counts']['pp_points'] and type(r['counts']['pp_points']) is int
        assert v['timeOnIcePerGame']>0
        exposure='match' if v['timeOnIcePerGame']==Decimal(str(r['toi_per_game'])) else 'different'
        before=stamp(observed)<stamp(t['sourceCaptureAtUTC']);holds=[]
        if sidecar[sid]['exposureState']!='matched':holds.append('prior_exposure_hold_preserved')
        if combined[sid]['boxQualification']['gameFinality']!='final':holds.append('prior_finality_unknown')
        if exposure!='match':holds.append('direct_exposure_unmatched')
        if any(v[k]!=r['counts'][k] for k in ['goals','assists']):holds.append('direct_goals_or_assists_unmatched')
        if before:holds.append('observation_precedes_source_capture')
        counts={k:dict(captured=r['counts'].get(k),native=v[k],state='match' if r['counts'].get(k)==v[k] else 'different') for k in ['goals','assists','shots']}
        expected=dict(sourceId=sid,playerId=t['playerId'],gameId=t['gameId'],date=t['date'],team=t['team'],sourceRowSHA256=t['sourceRowSHA256'],capturedPPP=r['counts']['pp_points'],nativePPP=v['ppPoints'],comparison='match',reason=None,observedAtUTC=observed,sourceCaptureAtUTC=t['sourceCaptureAtUTC'],observationPrecedesCapture=before,originalPublicationUTC=None,priorSidecar=deepcopy(sidecar[sid]),priorCombined=deepcopy(combined[sid]),priorOlderObservation=deepcopy(older.get(sid)),sourceValuesChanged=False,scoringAdmission=False,wholeProfileQualification=False,currentFieldStateUnchanged=True,laterMatchingEvidenceCandidate=not holds,exposureComparison=dict(captured=r['toi_per_game'],native=v['timeOnIcePerGame'],state=exposure),countComparisons=counts,admissionHolds=holds,nativeEvidence=ev,evidenceOrigin=origin)
        assert out==expected,sid
        calculated=compare(json.loads(body),t,observed,not reused);calculated.update(nativeEvidence=ev,evidenceOrigin=origin);assert calculated==expected
        flat=dict(sourceId=sid,playerId=t['playerId'],player=r['player_name'],gameId=t['gameId'],date=t['date'],team=t['team'],capturedPPP=r['counts']['pp_points'],nativePPP=v['ppPoints'],comparison='match',evidenceOrigin=origin,observedAtUTC=observed,sourceCaptureAtUTC=t['sourceCaptureAtUTC'],observationPrecedesCapture=before,capturedTOI=r['toi_per_game'],nativeTOI=str(v['timeOnIcePerGame']),exposureComparison=exposure,priorExposureState=sidecar[sid]['exposureState'],priorExposureReasons=';'.join(sidecar[sid]['exposureReasons']),admissionHolds=';'.join(holds),laterMatchingEvidenceCandidate=not holds,zeroShot=r['counts']['shots']==0,bodyPath=str(bp),bodySHA256=ev['bodySHA256'],receiptPath=str(rp),receiptSHA256=ev['receiptSHA256'],url=ev['url'],scoringAdmission=False)
        assert csv_by[sid]=={k:str(val) for k,val in flat.items()}
        body_metadata[str(bp)]=dict(rows=len(rows),game=t['gameId'],observed=observed,reused=reused,bytes=len(body))
        native_rows[sid]=v
        if holds:held.append(dict(sourceId=sid,captured=r['toi_per_game'],native=str(v['timeOnIcePerGame']),reused=reused,holds=holds))
        else:candidate_ids.append(sid)
        if r['counts']['shots']==0:zero_shots.append(sid)
        summary_counts['zero']+=int(v['ppPoints']==0);summary_counts['nonzero']+=int(v['ppPoints']>0);summary_counts['older']+=int(before)
        if any(x['state']!='match' for x in counts.values()):native_field_differences.append(sid)
    assert len(body_metadata)==49 and sum(b['reused'] for b in body_metadata.values())==3
    assert summary_counts=={'zero':47,'nonzero':15,'older':16} and len(candidate_ids)==44 and len(held)==18
    assert all(h['captured']!=Decimal(h['native']) for h in held) and sum(h['reused'] for h in held)==16
    assert {h['sourceId'] for h in held if not h['reused']}=={5598688,5599832}
    assert len(zero_shots)==12 and len(set(zero_shots)&set(candidate_ids))==7 and not native_field_differences
    previous=None;total=0
    for n,sid in enumerate(plan['newSourceIds'],1):
        folder=SOURCE/'live-01'/str(sid);dispatch=load(folder/'DISPATCH.json');rec=load(folder/'TRANSPORT-RECEIPT.json');total+=rec['bytes']
        if previous:assert (stamp(dispatch['atUTC'])-previous).total_seconds()>=1
        previous=stamp(rec['atUTC']);cp=load(SOURCE/'live-01'/f'CHECKPOINT-{n:02d}.json')
        assert cp['dispatchAttempts']==cp['verifiedTransport']==cp['fieldComparisons']==n and cp['totalBytes']==total and cp['states']=={'match':n}
    assert total==24661
    run=load(SOURCE/'live-01/RESULT.json');assert run['state']=='COMPLETE' and run['dispatchAttempts']==run['verifiedTransport']==run['fieldComparisons']==46 and run['totalBytes']==total
    assert run['retries']==run['redirects']==run['NSTRequests']==run['databaseCalls']==run['sourceWrites']==0 and run['ownedLockReleased'] and not run['scoringAdmission'] and not run['currentFieldStateChanged']
    assert sum(all(sidecar[sid]['tracks']['fantasyPoints']['corroboratedForThisRow'] for sid in p['sourceIds']) for p in context['profiles'])==482
    verify_pins()
    result=dict(state='PASS',tests=tests.testsRun,pins=len(pins),selectedRecords=3461,profiles=740,unresolvedPPP=212,olderAgreements=150,targets=62,nativePPPMatches=62,zeros=47,nonzero=15,laterCandidates=44,exposureHolds=18,olderHeldRecords=16,newHeldSourceIds=[5598688,5599832],zeroShotRecords=12,zeroShotCandidates=7,retainedBodies={p:b for p,b in body_metadata.items() if b['reused']},newReports=46,newBytes=total,allOverlappingGoalsAssistsShotsMatch=True,allComparisonObjectsExactlyRebuilt=True,csvParity=True,unchangedFPWindows=482,sourceValuesChanged=False,scoringAdmission=False,networkRequests=0,held=held,candidateIds=candidate_ids)
    (ROOT/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['held','candidateIds','retainedBodies']}))
finally:
    assert load(lock/'owner.json')==owner
    lock.rename(ROOT/'RELEASED-LOCK')
