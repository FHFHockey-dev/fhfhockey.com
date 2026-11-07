import sys
sys.dont_write_bytecode=True
from pathlib import Path
from datetime import datetime
from collections import Counter
from copy import deepcopy
from decimal import Decimal
import hashlib, gzip, json, socket, unittest
ROOT=Path(__file__).resolve().parent
SOURCE=Path('/Users/tim/Documents/Codex/2026-10-27/task-3/historical-ppp-composition-20261102-01')
sys.path.insert(0,str(SOURCE))
import test_compose
from compose import compose_row
def deny(*args,**kwargs):raise AssertionError('Independent composition audit forbids network')
socket.socket.connect=deny;socket.socket.connect_ex=deny;socket.create_connection=deny;socket.getaddrinfo=deny
sha=lambda b:hashlib.sha256(b).hexdigest()
load=lambda p:json.loads(Path(p).read_text())
stamp=lambda s:datetime.fromisoformat(s.replace('Z','+00:00'))
pins=load(ROOT/'PINS.json')
def auth(p,h=None):
    p=Path(p);actual=sha(p.read_bytes())
    if h is not None:assert actual==h,p
    pins[str(p)]=actual
def verify_pins():
    for p,h in pins.items():assert sha(Path(p).read_bytes())==h,p
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'codex-blsh-historical-PPP-composition-independent-audit'}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
try:
    verify_pins()
    with (ROOT/'TESTS.log').open('w') as f:
        tests=unittest.TextTestRunner(stream=f,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(test_compose))
    assert tests.wasSuccessful()
    contract=load(SOURCE/'CONTRACT.json');assert sha((SOURCE/'CONTRACT.json').read_bytes())==(SOURCE/'CONTRACT.sha256').read_text().strip()=='ecb4dc4fafaaa7304ebd05cfe9825e20b10c2e7828392cc1fee7d0956f2a529b'
    frozen=stamp(contract['frozenUTC']);paths=contract['paths']
    base1=load(paths['baselineOne']);base2=load(paths['baselineTwo'])
    raw=base1['originalRecordedRows']+[r for b in base2 for r in b['originalRows']]
    assert len(raw)==len({r['id'] for r in raw})==150
    original={r['id']:r for r in raw}
    links={r['sourceId']:r for r in load(paths['links'])}
    census={r['sourceId']:r for r in load(paths['census']) if r['cohort']=='historical_reference_unresolved'}
    direct={r['sourceId']:r for r in load(paths['direct'])}
    ledger=load(SOURCE/'composition-01/PPP-EVIDENCE-LEDGER.json');summary=load(SOURCE/'composition-01/SUMMARY.json');receipt=load(SOURCE/'composition-01/RECEIPT.json')
    for f,h in receipt['files'].items():auth(SOURCE/'composition-01'/f,h)
    assert receipt['inputPins']==contract['inputs'] and receipt['contractSHA256']==sha((SOURCE/'CONTRACT.json').read_bytes())
    assert frozen<=stamp(summary['atUTC'])==stamp(receipt['atUTC'])
    assert len(ledger)==150 and [r['sourceId'] for r in ledger]==sorted(original)
    assert set(original)==set(links) and len(census)==49 and len(direct)==27
    memberships={'zero':{sid for sid,l in links.items() if l['PPPIndependentOfficialCheck']},'census':{sid for sid,c in census.items() if c['state']=='uniquely_implied'},'direct':set(direct)}
    assert [len(memberships[k]) for k in ['zero','census','direct']]==[101,22,27]
    assert len(set.union(*memberships.values()))==150 and sum(map(len,memberships.values()))==150
    boxes={};methods=Counter();zeros=Counter();holds=[];earliest=None;latest=None
    for out in ledger:
        sid=out['sourceId'];raw=original[sid];link=links[sid];c=census.get(sid);d=direct.get(sid)
        rowhash=sha(json.dumps(raw,sort_keys=True,separators=(',',':')).encode());assert rowhash==link['originalRowSHA256']==out['originalRowSHA256']
        assert raw['season_id']==20222023 and raw['player_id'] in [8479293,8478398,8478864]
        game=link['derivedGameId'];date=raw['date'];ev=link['evidence'];rp=Path(ev['receipt_path']);bp=rp.with_suffix('.gz')
        auth(rp,ev['receipt_sha256']);auth(bp);boxreceipt=load(rp)
        if game not in boxes:
            body=gzip.decompress(bp.read_bytes());assert len(body)==boxreceipt['bytes'] and sha(body)==boxreceipt['sha256']==ev['body_sha256']
            boxes[game]=(json.loads(body),len(body),sha(body))
        box,bodylen,bodyhash=boxes[game]
        assert bodyhash==ev['body_sha256']==boxreceipt['sha256'] and bodylen==boxreceipt['bytes']
        assert (box['id'],box['season'],box['gameType'],box['gameDate'])==(game,20222023,2,date) and box['gameState'] in ['OFF','FINAL']
        url=f'https://api-web.nhle.com/v1/gamecenter/{game}/boxscore'
        assert boxreceipt['url']==ev['sourceURL']==url and boxreceipt['status']=='success' and boxreceipt['http_status']==200 and boxreceipt['TLS_verified'] is True
        observed=boxreceipt['completed_at_utc'];assert observed==ev['retrievedAtUTC'] and stamp(observed)<frozen
        sides=[s for s in ['homeTeam','awayTeam'] if box[s]['abbrev']==link['derivedTeam']];assert len(sides)==1
        group=box['playerByGameStats'][sides[0]];found=[p for p in group['forwards']+group['defense'] if p['playerId']==raw['player_id']];assert len(found)==1;frame=found[0]
        m,s=map(int,frame['toi'].split(':'));assert raw['games_played']==1 and raw['toi_per_game']==m*60+s>0 and raw['assists']==frame['assists']
        boxproof=dict(URL=url,bodyPath=str(bp),bodySHA256=bodyhash,receiptPath=str(rp),receiptSHA256=ev['receipt_sha256'],retrievedAtUTC=observed,sourcePublicationUTC=None,bodyBytes=bodylen)
        evidence=[boxproof]
        if sid in memberships['zero']:
            assert c is None and d is None and raw['assists']==frame['assists']==0
            value=frame['powerPlayGoals'];method='official_PP_goals_with_observed_zero_assists'
        elif sid in memberships['census']:
            assert d is None and c['state']=='uniquely_implied' and c['lowerPPP']==c['upperPPP']==c['impliedPPP'] and c['wgoComparison']=='matches_unique_value'
            value=c['impliedPPP'];method='official_team_goal_census_unique_integer_value'
        else:
            assert d is not None and c['state'] in ['ambiguous','unknown']
            for f,h in [('bodyPath','bodySHA256'),('transportReceipt','transportReceiptSHA256'),('fieldCheckPath','fieldCheckSHA256')]:auth(d[f],d[h])
            payload=json.loads(Path(d['bodyPath']).read_text(),parse_float=Decimal);assert payload['total']==len(payload['data'])==1
            native=payload['data'][0];tr=load(d['transportReceipt']);fc=load(d['fieldCheckPath'])
            assert (native['playerId'],native['gameId'],native['gameDate'],native['teamAbbrev'],native['gamesPlayed'])==(raw['player_id'],game,date,link['derivedTeam'],1)
            assert native['timeOnIcePerGame']==Decimal(str(raw['toi_per_game']))
            assert d['directPPP']==native['ppPoints']==fc['officialPPP']==raw['pp_points'] and fc['state']==d['comparison']=='match'
            assert d['retrievedAtUTC']==tr['atUTC'] and tr['sha256']==d['bodySHA256'] and tr['url']==d['nativeURL'] and tr['TLSVerified'] is True and tr['httpStatus']==200
            assert stamp(observed)<stamp(d['retrievedAtUTC'])<frozen and d['originalPublicationUTC'] is None
            assert d['priorCensusState']==c['state'] and d['priorCensusReason']==c['reason'] and d['lowerPPP']==c['lowerPPP'] and d['upperPPP']==c['upperPPP']
            assert d['scoringAdmission'] is False and d['sourceValuesChanged'] is False
            value=native['ppPoints'];method='direct_official_native_ppPoints_report';evidence.append(deepcopy(d))
        for proof in [c,d]:
            if proof is not None:assert (proof['sourceId'],proof['playerId'],proof['gameId'],proof['date'],proof['team'],proof['sourceRowSHA256'])==(sid,raw['player_id'],game,date,link['derivedTeam'],rowhash)
        assert type(value) is int and value>=0 and value==raw['pp_points']
        expected=dict(sourceId=sid,playerId=raw['player_id'],date=date,season=20222023,gameId=game,team=link['derivedTeam'],originalRowSHA256=rowhash,capturedPPP=raw['pp_points'],corroboratedPPP=value,fieldStatus='corroborated',method=method,reason=None,priorLink=deepcopy(link),priorCensus=deepcopy(c),evidence=evidence,wholeProfileQualified=False,scoringAdmission=False,historicalPublicationUTC=None,baselineValuesChanged=False,referenceAgeImproved=False,proofObservedAtUTC=max(evidence,key=lambda e:stamp(e['retrievedAtUTC']))['retrievedAtUTC'],reviewRefs=contract['reviews'])
        assert out==expected,sid
        calculated=compose_row(raw,link,c,d,frame,boxproof);calculated['proofObservedAtUTC']=expected['proofObservedAtUTC'];calculated['reviewRefs']=contract['reviews'];assert calculated==expected
        if c and c['state']=='unknown':
            assert c['reason']=='goal_census_score_mismatch_no_shootout_or_goalie_adjustment' and c['lowerPPP'] is c['upperPPP'] is None
            holds.append(sid)
        methods[method]+=1;zeros[method]+=int(value==0)
        observed_time=stamp(out['proofObservedAtUTC']);earliest=min(earliest,observed_time) if earliest else observed_time;latest=max(latest,observed_time) if latest else observed_time
    assert len(boxes)==146 and holds==[3085027,3087408]
    assert summary['referenceRows']==summary['corroboratedPPP']==150 and summary['unknownPPP']==0 and summary['retainedBoxesAuthenticated']==146
    assert summary['methods']==dict(methods) and summary['actualZero']==sum(zeros.values())==117 and summary['nonzero']==33
    assert Counter(r['playerId'] for r in ledger)=={8479293:50,8478398:50,8478864:50}
    assert summary['perPlayer']=={str(k):v for k,v in Counter(r['playerId'] for r in ledger).items()}
    assert summary['originalBaselineSummaries']==[base1['baseline']]+[b['baseline'] for b in base2]
    for b in summary['originalBaselineSummaries']:
        assert len(b['source_ids'])==50 and set(b['source_ids'])=={r['sourceId'] for r in ledger if r['playerId']==b['player_id']}
    for key in ['baselineRowsOrStatsChanged','historicalPublicationQualified','wholeProfileQualification','scoringAdmission','broaderSnapshotReferencesQualified','referenceFreshnessImproved']:assert summary[key] is False
    assert summary['requests']==summary['databaseCalls']==receipt['requests']==0
    verify_pins();(ROOT/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n')
    result=dict(state='PASS',tests=tests.testsRun,pins=len(pins),records=150,perPlayer=summary['perPlayer'],methods=dict(methods),zeroByMethod=dict(zeros),zeros=117,nonzero=33,distinctBoxes=146,retainedHoldIds=holds,fullLedgerExactlyRebuilt=True,baselineSummariesAndMembershipUnchanged=True,proofObservedMinimum=earliest.isoformat(),proofObservedMaximum=latest.isoformat(),installedGateSHA256=pins['/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/currentProcessEvidence.server.ts'],installedTestsSHA256=pins['/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/currentProcessEvidence.server.test.ts'],installedQualifierSHA256=pins['/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh/currentInput.ts'],networkRequests=0,sourceEdits=0,scorePromotion=False)
    (ROOT/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:
    assert load(lock/'owner.json')==owner
    lock.rename(ROOT/'RELEASED-LOCK')
