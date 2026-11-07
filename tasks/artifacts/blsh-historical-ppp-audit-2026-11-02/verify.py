import sys
sys.dont_write_bytecode=True
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit, parse_qs
import csv, gzip, hashlib, io, json, socket, unittest

ROOT=Path(__file__).resolve().parent
BASE=Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
BATCH=BASE/'historical-ppp-direct-report-20261102-batch-01'
PILOT=BASE/'historical-ppp-direct-report-20261102-pilot-01'
sys.path.insert(0,str(BATCH))
import test_qualification
from qualify import qualify
def deny(*args,**kwargs):raise AssertionError('Audit forbids network access')
socket.socket.connect=deny;socket.socket.connect_ex=deny;socket.create_connection=deny;socket.getaddrinfo=deny
import urllib.request
urllib.request.urlopen=deny;urllib.request.OpenerDirector.open=deny
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads(p.read_text())
stamp=lambda s:datetime.fromisoformat(s.replace('Z','+00:00'))
pins=read(ROOT/'PINS.json')
def verify_pins():
    for p,h in pins.items():assert sha(Path(p).read_bytes())==h,p
def auth_file(p,expected=None):
    h=sha(p.read_bytes())
    if expected is not None:assert h==expected,p
    pins[str(p)]=h
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'codex-blsh-historical-PPP-independent-audit'}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
try:
    verify_pins()
    with (ROOT/'TESTS.log').open('w') as stream:
        tests=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(test_qualification))
    assert tests.wasSuccessful()
    plan=read(BATCH/'READ-PLAN.json');pp=read(PILOT/'READ-PLAN.json')
    assert sha((BATCH/'READ-PLAN.json').read_bytes())==(BATCH/'READ-PLAN.sha256').read_text().strip()=='4592fc8c3fc2e439cb3e6c3e6c5042769a7092b2a92e442d5de6466f348bd887'
    assert sha((PILOT/'READ-PLAN.json').read_bytes())==(PILOT/'READ-PLAN.sha256').read_text().strip()
    assert sha(Path(plan['CAFile']).read_bytes())==plan['CA_SHA256']==pp['CA_SHA256']
    census=[r for r in read(Path(plan['sourceRows'])) if r['cohort']=='historical_reference_unresolved']
    assert len(census)==49 and all(r['season']==20222023 for r in census)
    census_by={r['sourceId']:r for r in census};unresolved={r['sourceId'] for r in census if r['state'] in ['ambiguous','unknown']}
    unique={r['sourceId'] for r in census if r['state']=='uniquely_implied'}
    links=read(BASE/'baseline-card-provenance-20261101-01/baseline-01/BASELINE-ROW-LINKS.json')
    assert len(links)==150 and len({r['sourceId'] for r in links})==150 and all(r['season']==20222023 for r in links)
    previous={r['sourceId'] for r in links if r['PPPIndependentOfficialCheck']}
    originals=read(BASE/'absence-ledger-replay-20261101-01/replay-02/BASELINE.json')['originalRecordedRows']
    originals+= [r for group in read(BASE/'midseason-absence-cohort-20261101-01/replay-02/BASELINES.json') for r in group['originalRows']]
    source={r['id']:r for r in originals};assert len(source)==len(originals)==150 and all(r['season_id']==20222023 for r in originals)
    for link in links:
        assert sha(json.dumps(source[link['sourceId']],sort_keys=True,separators=(',',':')).encode())==link['originalRowSHA256']
    items=[(pp,PILOT/'live-01',pp)]+[(item,BATCH/'live-01'/str(item['target']['sourceId']),plan) for item in plan['requests']]
    actual={i['target']['sourceId'] for i,_,_ in items}
    assert len(items)==len(actual)==27 and actual==unresolved
    assert len(previous)==101 and len(unique)==22 and not (previous&unique or previous&actual or unique&actual)
    assert previous|unique|actual==set(source)
    assert {i['target']['sourceId'] for i in plan['requests']}==set(plan['scope']['sourceIds'])==actual-{3067595}
    comparisons=[];times=[];total_bytes=0;batch_bytes=0;holds=[]
    for index,(item,folder,local_plan) in enumerate(items):
        t=item['target'];sid=t['sourceId'];assert t==census_by[sid] and t['priorQualified'] is True
        assert t['sourceRowSHA256']==sha(json.dumps(source[sid],sort_keys=True,separators=(',',':')).encode())
        assert source[sid]['pp_points']==t['wgoPPP'] and type(t['wgoPPP']) is int
        parsed=urlsplit(item['url']);q=parse_qs(parsed.query)
        assert parsed.scheme=='https' and parsed.netloc=='api.nhle.com' and parsed.path=='/stats/rest/en/skater/summary' and not parsed.fragment
        assert q=={'isAggregate':['false'],'isGame':['true'],'start':['0'],'limit':['2'],'sort':['[{"property":"playerId","direction":"ASC"}]'],'factCayenneExp':['gamesPlayed>=1'],'cayenneExp':[f"gameId={t['gameId']} and gameTypeId=2 and playerId={t['playerId']}"]}
        rec=read(folder/'TRANSPORT-RECEIPT.json');dispatch=read(folder/'DISPATCH.json');body=(folder/'BODY.json').read_bytes()
        assert rec['url']==dispatch['url']==item['url'] and rec['httpStatus']==200 and rec['TLSVerified'] is True
        assert rec['bytes']==len(body) and rec['sha256']==sha(body) and rec['CA_SHA256']==plan['CA_SHA256']
        assert rec['sourcePublicationUTC'] is None if 'sourcePublicationUTC' in rec else index==0
        assert 'application/json' in rec['headers']['Content-Type'].lower()
        assert dispatch.get('readPlanSHA256',dispatch.get('planSHA256'))==sha(((PILOT if index==0 else BATCH)/'READ-PLAN.json').read_bytes())
        dt,rt=stamp(dispatch['atUTC']),stamp(rec['atUTC']);assert dt.tzinfo and rt.tzinfo and stamp(local_plan['frozenUTC'])<dt<=rt
        assert 0<=(rt-dt).total_seconds()<=10
        assert abs((rt-parsedate_to_datetime(rec['headers']['Date'])).total_seconds())<2
        if index>1:assert (dt-times[-1][1]).total_seconds()>=1
        times.append((dt,rt));total_bytes+=len(body)
        if index:batch_bytes+=len(body);assert len(body)<=plan['bounds']['perResponseBytes']
        else:assert len(body)<=pp['bounds']['maxResponseBytes']
        payload=json.loads(body,parse_float=Decimal);assert type(payload['total']) is int and payload['total']==len(payload['data'])==1
        row=payload['data'][0]
        for k in ['playerId','gameId','gamesPlayed']:assert type(row[k]) is int
        assert (row['playerId'],row['gameId'],row['gameDate'],row['teamAbbrev'],row['gamesPlayed'])==(t['playerId'],t['gameId'],t['date'],t['team'],1)
        assert row['timeOnIcePerGame']==Decimal(str(t['seconds']))>0
        for k in ['ppPoints','ppGoals','goals','assists','points','evPoints','shPoints','evGoals','shGoals','shots']:assert type(row[k]) is int and row[k]>=0
        assert row['points']==row['goals']+row['assists']==row['evPoints']+row['ppPoints']+row['shPoints']
        assert row['goals']==row['evGoals']+row['ppGoals']+row['shGoals']
        for strength in ['ev','pp','sh']:assert row[strength+'Goals']<=row[strength+'Points']
        assert row['ppPoints']-row['ppGoals']<=row['assists'] and row['ppPoints']==t['wgoPPP']
        ev=item['priorEvidence'];rp=Path(ev['receiptPath']);bp=Path(ev['bodyPath']);auth_file(rp,ev['receiptSHA256']);auth_file(bp)
        br=read(rp);uncompressed=gzip.decompress(bp.read_bytes());box=json.loads(uncompressed)
        assert len(uncompressed)==ev['bodyBytes']==br['bytes'] and sha(uncompressed)==ev['bodySHA256']==br['sha256']
        assert br['url']==ev['URL']==f"https://api-web.nhle.com/v1/gamecenter/{t['gameId']}/boxscore" and br['http_status']==200 and br['TLS_verified'] is True and br['status']=='success'
        assert br['completed_at_utc']==ev['retrievedAtUTC'] and stamp(ev['retrievedAtUTC'])<dt
        assert (box['id'],box['season'],box['gameType'],box['gameDate'])==(t['gameId'],20222023,2,t['date']) and box['gameState'] in ['OFF','FINAL']
        side=[s for s in ['homeTeam','awayTeam'] if box[s]['abbrev']==t['team']];assert len(side)==1
        ps=box['playerByGameStats'][side[0]];matched=[p for p in ps['forwards']+ps['defense'] if p['playerId']==t['playerId']];assert len(matched)==1;frame=matched[0]
        minutes,seconds=map(int,frame['toi'].split(':'));assert minutes*60+seconds==t['seconds']
        for native,old in [('goals','goals'),('assists','assists'),('ppGoals','powerPlayGoals'),('shots','sog')]:assert row[native]==frame[old]
        candidate=read(folder/'FIELD-CHECK.json');assert candidate['state']=='match' and candidate['officialPPP']==row['ppPoints'] and candidate['sourceValuesChanged'] is False and candidate['scoringAdmission'] is False
        current=qualify(json.loads(body),t,frame);assert current['state']=='match' and current['officialPPP']==row['ppPoints'] and current['historicalPublicationQualified'] is False
        if index:assert current==candidate
        if t['lowerPPP'] is None:
            assert t['upperPPP'] is None and t['state']=='unknown' and t['reason']=='goal_census_score_mismatch_no_shootout_or_goalie_adjustment'
            assert current['priorCensus']=={k:t[k] for k in ['state','reason','lowerPPP','upperPPP']} and current['censusBoundsChecked'] is False
            holds.append(sid)
        else:assert t['lowerPPP']<=row['ppPoints']<=t['upperPPP'] and current['censusBoundsChecked'] is True
        comparisons.append(dict(sourceId=sid,player=row['skaterFullName'],playerId=row['playerId'],gameId=row['gameId'],date=row['gameDate'],saved=t['wgoPPP'],native=row['ppPoints'],priorState=t['state'],bodySHA256=sha(body),seconds=t['seconds']))
        if index:
            cp=read(BATCH/'live-01'/f'CHECKPOINT-{index:02d}.json');assert cp['dispatchAttempts']==cp['verifiedTransport']==cp['fieldChecks']==index and cp['totalBytes']==batch_bytes and cp['states']=={'match':index}
    assert set(holds)=={3085027,3087408}
    assert sum(r['native']==0 for r in comparisons)==13 and sum(r['native']>0 for r in comparisons)==14
    assert Counter(r['player'] for r in comparisons)=={'Kirill Kaprizov':11,'Kyle Connor':11,'Brandon Tanev':5}
    assert total_bytes==14435 and batch_bytes==13893
    br=read(BATCH/'live-01/RESULT.json');pr=read(PILOT/'live-01/RESULT.json')
    assert br['state']=='COMPLETE' and br['dispatchAttempts']==br['verifiedTransport']==br['fieldChecks']==26 and br['totalBytes']==batch_bytes
    assert pr['state']=='READ_AND_FIELD_CHECK_COMPLETE' and pr['dispatched']==pr['verifiedTransport']==1 and pr['bytes']==542
    for result in [br,pr]:assert result['ownedLockReleased'] and result['retries']==result['redirects']==result['databaseCalls']==result['sourceWrites']==0 and not result['scoringAdmission']
    export=read(BATCH/'DIRECT-PPP-COMPARISONS.json');export_by={r['sourceId']:r for r in export}
    assert len(export)==len(export_by)==27 and set(export_by)==actual
    for r in comparisons:
        e=export_by[r['sourceId']]
        assert (e['capturedPPP'],e['directPPP'],e['bodySHA256'],e['playerId'],e['gameId'],e['date'])==(r['saved'],r['native'],r['bodySHA256'],r['playerId'],r['gameId'],r['date'])
        assert e['originalPublicationUTC'] is None and not e['scoringAdmission'] and not e['sourceValuesChanged']
    with (BATCH/'DIRECT-PPP-COMPARISONS.csv').open() as f:csv_rows=list(csv.DictReader(f))
    assert len(csv_rows)==27 and {int(r['sourceId']) for r in csv_rows}==actual
    for r in csv_rows:
        e=export_by[int(r['sourceId'])]
        assert all(r[k]==('' if v is None else str(v)) for k,v in e.items())
    verify_pins();(ROOT/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n')
    report=dict(state='PASS',tests=tests.testsRun,pins=len(pins),nativeMatches=27,zero=13,nonzero=14,perPlayer=dict(Counter(r['player'] for r in comparisons)),priorMethodHolds=holds,coverage={'earlier':len(previous),'uniqueCensus':len(unique),'newDirect':len(actual),'disjointTotal':len(previous|unique|actual),'denominator':150},pilotCaptureUTC=times[0][1].isoformat(),batchStartUTC=times[1][0].isoformat(),batchEndUTC=times[-1][1].isoformat(),totalBytes=total_bytes,allPriorOverlapsMatch=True,exportParity=True,historicalPublicationQualified=False,scoreChanges=0,networkCalls=0,comparisons=comparisons)
    (ROOT/'RESULT.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='comparisons'}))
finally:
    assert read(lock/'owner.json')==owner
    lock.rename(ROOT/'RELEASED-LOCK')
