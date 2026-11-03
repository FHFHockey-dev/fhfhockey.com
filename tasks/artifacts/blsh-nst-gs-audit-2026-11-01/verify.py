from pathlib import Path
from collections import Counter
from datetime import datetime
import csv,hashlib,json

O=Path(__file__).resolve().parent
B=Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
P=B/'nst-lineage-and-gs-alternatives-20261101-01';F=B/'fresh-box-qualification-20261101-01';S=B/'fresh-source-qualification-20261101-01'
load=lambda p:json.loads(Path(p).read_text());sha=lambda b:hashlib.sha256(b).hexdigest();pins={}
def pin(path,digest):
    path=Path(path);b=path.read_bytes();assert sha(b)==digest,str(path);pins[str(path)]=digest;return b
final=load(P/'FINAL-RECEIPT.json')
for k in ['files','sharedSourcePins']:
    for path,h in final[k].items():pin(path,h)
for path,h in load(P/'NST-LINEAGE-INVENTORY.json')['sources'].items():pin(path,h)
plan=load(P/'GOAL-ABSENCE-PLAN.json')
for path,h in plan['pins'].items():pin(path,h)
assert sha((P/'GOAL-ABSENCE-PLAN.json').read_bytes())=='bfef2cbe08624fc3025cffea1cea0ca8750eaa43d67fab4b8f3e406768e08eaa'
accepted=load(O.parent/'blsh-fresh-box-audit-2026-11-01/PINS.json')
for path in [S/'diagnosis-01/DATE-COHORT-COMPARISON.json',B/'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json']:
    pin(path,accepted[str(path)])
manifest=load(S/'MISSING-ROWS.json');targets={r['sourceId']:r for r in manifest}
assert len(manifest)==len(targets)==280
prior={r['sourceId']:r for r in load(F/'qualification-01/ROW-QUALIFICATION.json')}
boxmeta=load(F/'qualification-01/BOX-EVIDENCE.json');ev=load(P/'goal-absence-01/EVIDENCE.json');boxes={};players={}
stamp=lambda s:datetime.fromisoformat(s.replace('Z','+00:00'))
for gid,e in ev.items():
    meta=boxmeta[gid];body=pin(e['bodyPath'],e['bodySHA256']);rb=pin(e['receiptPath'],e['receiptSHA256']);receipt=json.loads(rb);b=json.loads(body)
    assert e['bodyPath']==meta['bodyPath'] and e['receiptPath']==meta['receiptPath']
    assert e['bodySHA256']==meta['bodySHA256'] and e['receiptSHA256']==meta['receiptSHA256']
    assert e['URL']==receipt['url']==meta['url']==f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'
    assert receipt['status']=='success' and receipt['TLSVerified'] is True and receipt['httpStatus']==200
    assert e['bodyBytes']==receipt['bytes']==len(body) and receipt['sha256']==sha(body)
    assert e['retrievedAtUTC']==receipt['retrievedAtUTC']==meta['retrievedAtUTC'] and e['sourcePublicationUTC'] is None
    assert (b['id'],b['season'],b['gameType'])==(int(gid),20262027,2) and b['gameState'] in ['OFF','FINAL']
    assert stamp(e['retrievedAtUTC'])<stamp(plan['atUTC'])
    boxes[int(gid)]=b;group={};ids=[]
    assert b['homeTeam']['id']!=b['awayTeam']['id'] and b['homeTeam']['abbrev']!=b['awayTeam']['abbrev']
    for side in ['homeTeam','awayTeam']:
        team=b[side];ps=b['playerByGameStats'][side]['forwards']+b['playerByGameStats'][side]['defense'];assert ps
        for p in ps:
            assert type(p['playerId']) is int and p['playerId']>0;ids.append(p['playerId'])
            assert all(type(p[k]) is int and p[k]>=0 for k in ['goals','assists','powerPlayGoals']) and p['powerPlayGoals']<=p['goals']
        G=sum(p['goals'] for p in ps)
        assert all(p['assists']<=G-p['goals'] for p in ps) and sum(p['assists'] for p in ps)<=2*G
        group[team['abbrev']]={'players':ps,'goals':G,'score':team['score']}
    assert len(ids)==len(set(ids));players[int(gid)]=group
assert len(boxes)==38 and set(boxes)=={t['gameId'] for t in manifest}
fields=['es_goals_for','pp_goals_for','sh_goals_for','es_goals_against','pp_goals_against','sh_goals_against']
rows=load(P/'goal-absence-01/ROWS.json');byid={r['sourceId']:r for r in rows};assert len(rows)==len(byid)==280 and set(byid)==set(targets)
states=Counter();reasons=Counter();known=0;partial_dates=Counter();partial_games=set();directions=Counter()
for sid,r in byid.items():
    t=targets[sid];q=prior[sid];b=boxes[t['gameId']];teams=players[t['gameId']]
    assert (r['playerId'],r['gameId'],r['date'],r['team'])==(t['playerId'],t['gameId'],t['date'],t['team'])==(q['playerId'],q['gameId'],q['date'],q['wgoTeam'])
    assert b['gameDate']==t['date'] and r['originalSourceCounts']==t['sourceCounts'] and r['originalMissingFields']==fields
    assert all(k in r['originalSourceCounts'] and r['originalSourceCounts'][k] is None for k in fields)
    assert r['scoreComputed'] is False and r['admittedToScoring'] is False and r['evidenceKey']==str(t['gameId'])
    want={k:None for k in fields};hold=None
    if q['state']!='identity_team_exposure_qualified' or q['gameFinality']!='final':hold='prior_identity_exposure_or_finality_held'
    elif any(team['goals']!=team['score'] for team in teams.values()):hold='goal_census_score_mismatch_no_shootout_or_goalie_adjustment'
    if hold:assert r['state']=='held' and r['reason']==hold
    else:
        own=teams[t['team']];opp=next(team for name,team in teams.items() if name!=t['team'])
        p=next(p for p in own['players'] if p['playerId']==t['playerId']);m,s=map(int,p['toi'].split(':'));assert 0<=s<60 and 60*m+s==q['TOI']['official']>0
        if own['goals']==0:
            for k in fields[:3]:want[k]=0
        if opp['goals']==0:
            for k in fields[3:]:want[k]=0
        n=sum(v is not None for v in want.values());assert r['componentsKnown']==n and r['completeSixFieldEvidence']==(n==6)
        assert r['teamGoals']=={'own':own['goals'],'opponent':opp['goals']} and r['reason'] is None
        assert r['state']==('partial_team_absence_evidence' if n else 'lineup_evidence_required')
    assert r['derivedComponents']==want
    n=sum(v is not None for v in want.values());known+=n
    assert n in [0,3]
    if n:partial_dates[r['date']]+=1;partial_games.add(r['gameId']);directions['for' if want[fields[0]]==0 else 'against']+=1
    states[r['state']]+=1
    if r['reason']:reasons[r['reason']]+=1
assert states=={'partial_team_absence_evidence':58,'lineup_evidence_required':210,'held':12}
assert reasons=={'goal_census_score_mismatch_no_shootout_or_goalie_adjustment':11,'prior_identity_exposure_or_finality_held':1}
assert known==174 and 280*6-known==1506 and len(partial_games)==4
assert partial_dates=={'2026-10-27':37,'2026-10-28':11,'2026-10-31':10}
summary=load(P/'goal-absence-01/SUMMARY.json');assert summary['states']==states and summary['reasons']==reasons and summary['derivedZeroComponents']==174 and summary['unknownComponents']==1506
assert summary['rowsWithAllSixComponents']==summary['GameScoresComputed']==0 and summary['automaticAdmission'] is False
csvrows=list(csv.DictReader((P/'goal-absence-01/PARTIAL-EVIDENCE.csv').open()));assert len(csvrows)==280
for r in csvrows:
    q=byid[int(r['sourceId'])];assert (int(r['playerId']),int(r['gameId']),r['date'],r['team'])==(q['playerId'],q['gameId'],q['date'],q['team'])
    assert r['derivedZeroFields']=='|'.join(k for k in fields if q['derivedComponents'][k] is not None)
    assert r['unknownFields']=='|'.join(k for k in fields if q['derivedComponents'][k] is None)

# Independently reconstruct exact native rows from their accepted page origin links.
links=load(S/'diagnosis-01/DATE-COHORT-COMPARISON.json');native={};origins={};pages={}
for r in links:
    e=r['nativeEvidence'];path=e['bodyPath']
    if path not in pages:pages[path]=json.loads(pin(path,e['bodySHA256']))
    key=(r['playerId'],r['gameId']);found=[x for x in pages[path]['data'] if (x['playerId'],x['gameId'])==key];assert len(found)==1 and key not in native
    native[key]=found[0];origins[key]=e
prepared=load(P/'prepared-event-scope-01/PREPARED-GAMES.json');proposal=load(P/'prepared-event-scope-01/PROPOSED-READ-PLAN.json')
assert len(prepared)==len(proposal['requests'])==38
assert len({x['gameId'] for x in prepared})==38 and {x['gameId'] for x in prepared}==set(boxes)
count=0;weaker=0;viewkeys=set();oldcachefound=0;all_target_ids=[]
for x,request in zip(prepared,proposal['requests']):
    gid=x['gameId'];date=x['date'];v=x['derivedReportView'];body=pin(v['path'],v['sha256']);view=json.loads(body);b=boxes[gid]
    expected=sorted((r for (pid,game),r in native.items() if game==gid),key=lambda r:r['playerId'])
    assert view=={'total':len(expected),'data':expected} and v['rows']==len(expected)==36
    assert v['representation']=='local_per_game_projection_of_authenticated_date_pages' and v['notANativeHTTPResponse'] is True
    assert x['boxEvidence']==boxmeta[str(gid)] and x['targetOriginalNullsPreserved'] is True and x['onIceCountsDerived'] is False
    roster={p['playerId']:team for team,ps in players[gid].items() for p in ps['players'] if any(int(s)>0 for s in p['toi'].split(':'))}
    assert {r['playerId'] for r in expected}==set(roster)
    for r in expected:
        assert r['gameDate']==date==b['gameDate'] and r['gamesPlayed']==1 and r['teamAbbrev']==roster[r['playerId']]
        key=(r['playerId'],gid);assert key not in viewkeys;viewkeys.add(key)
    wanted_origins={origins[(r['playerId'],gid)]['bodyPath']:origins[(r['playerId'],gid)] for r in expected}
    assert {e['bodyPath']:e for e in v['sourceCaptures']}==wanted_origins
    weak=any(e['transportEvidence'].startswith('recovered_') for e in v['sourceCaptures'])
    assert x['containsRecoveredFirstPageWitness']==weak;weaker+=weak
    ids=[t['sourceId'] for t in manifest if t['gameId']==gid]
    assert x['sourceIds']==request['targetSourceIds']==ids;all_target_ids+=ids
    url=f'https://www.nhl.com/scores/htmlreports/20262027/PL{str(gid)[4:]}.HTM'
    assert x['missingPlayByPlayURL']==request['url']==url and (request['gameId'],request['date'])==(gid,date)
    oldcachefound+=(B/'row-repair-01/live-read-01/store/cache'/(sha(url.encode())+'.body')).exists()
    count+=len(expected)
assert count==len(viewkeys)==1368 and weaker==11 and oldcachefound==0
assert len(all_target_ids)==len(set(all_target_ids))==280 and set(all_target_ids)==set(targets)
assert proposal['executionAuthorizedByThisPacket'] is False and proposal['existingExactCacheBodies']==0 and proposal['newCountingOrBoxRequests']==0
assert proposal['reuse']=={'officialBoxes':38,'nativeCountingReportRows':1368}
assert proposal['bounds']=={'maxRequests':38,'concurrency':1,'secondsBetweenStarts':2,'timeoutSecondsEach':10,'maxBodyBytesEach':4194304,'maxTotalBodyBytes':67108864,'maxElapsedSeconds':180,'retries':0}
assert proposal['firstPageWitnessGames']==11
capture=load(B/'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json');raw={r['id']:r for r in capture['wgo']['rows']}
assert all(raw[sid]['counts']==targets[sid]['sourceCounts'] for sid in targets)
assert all(sha(Path(path).read_bytes())==h for path,h in pins.items())
result={'pinsVerified':len(pins),'sharedSourcePinsUnchanged':10,'inventorySourcePinsUnchanged':6,'testsExpected':22,'rowsReconciled':280,'authenticatedBoxes':38,'states':states,'heldReasons':reasons,'partialRecords':58,'derivedZeroComponents':174,'unknownComponents':1506,'completeGameScoreRows':0,'partialDates':partial_dates,'partialGameIds':sorted(partial_games),'partialDirections':directions,'projectedGames':38,'projectedNativeRows':1368,'targetRecords':280,'healthyControlRows':1088,'weakerFirstPageWitnessGames':11,'exactOldCacheKeysPresent':oldcachefound,'newCollectionAuthorized':False,'originalNullsUnchanged':True,'actualNstBodiesExamined':0,'actualNstRowsRequalified':0,'auditProviderRequests':0,'auditSourceEdits':0,'auditHoldoutReads':0}
(O/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n');(O/'VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
